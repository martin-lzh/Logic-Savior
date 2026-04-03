// Vercel Edge Function — proxies LLM requests to OpenRouter or OpenAI (BYOK, zero storage)
export const config = { runtime: 'edge' }

const PROVIDER_DEFAULTS: Record<string, { defaultBaseUrl: string; extraHeaders: Record<string, string> }> = {
  openrouter: {
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    extraHeaders: {
      'HTTP-Referer': 'https://logic-savior.vercel.app',
      'X-Title': 'Logic Savior',
    },
  },
  openai: {
    defaultBaseUrl: 'https://api.openai.com/v1',
    extraHeaders: {},
  },
}

// Only allow HTTPS endpoints to prevent SSRF against internal networks
function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeError(raw: string): string {
  return raw.replace(/sk-[a-zA-Z0-9\-]+/g, '[REDACTED]')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const provider = req.headers.get('X-Provider')?.toLowerCase()
  if (!provider || !(provider in PROVIDER_DEFAULTS)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing X-Provider header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or malformed API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { defaultBaseUrl, extraHeaders } = PROVIDER_DEFAULTS[provider]

  // Allow client to override the base URL (e.g. Azure OpenAI, self-hosted)
  const customBaseUrl = req.headers.get('X-Base-Url')?.trim()
  const baseUrl = customBaseUrl && isAllowedUrl(customBaseUrl) ? customBaseUrl : defaultBaseUrl
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  let upstreamRes: Response | null
  try {
    // Read body as text so it works in both Edge runtime and Node (Vite dev)
    const body = await req.text()
    upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        ...extraHeaders,
      },
      body,
    })
  } catch (err) {
    console.error('[text-inference] Upstream fetch failed:', endpoint, err)
    upstreamRes = null
  }

  if (!upstreamRes) {
    return new Response(JSON.stringify({ error: 'Failed to reach upstream provider' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!upstreamRes.ok) {
    const raw = await upstreamRes.text().catch(() => 'Unknown upstream error')
    const sanitized = sanitizeError(raw)
    return new Response(JSON.stringify({ error: sanitized }), {
      status: upstreamRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
