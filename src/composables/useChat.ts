// Composable — manages LLM streaming, abort, and error taxonomy for both providers
import { ref } from 'vue'

export type Provider = 'openrouter' | 'openai'

const PROVIDER_DEFAULTS: Record<Provider, { model: string; storageKey: string; baseUrlKey: string; modelKey: string; defaultBaseUrl: string; label: string }> = {
  openrouter: {
    model: 'anthropic/claude-3.5-haiku',
    storageKey: 'openrouter_api_key',
    baseUrlKey: 'openrouter_base_url',
    modelKey: 'openrouter_model',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    label: 'OpenRouter',
  },
  openai: {
    model: 'gpt-4o-mini',
    storageKey: 'openai_api_key',
    baseUrlKey: 'openai_base_url',
    modelKey: 'openai_model',
    defaultBaseUrl: 'https://api.openai.com/v1',
    label: 'OpenAI',
  },
}

// --- Verbosity levels (1-7) ---
const VERBOSITY_INSTRUCTIONS: Record<number, string> = {
  1: 'Condense the ENTIRE input into a single sentence that captures the core message.',
  2: 'Write a TL;DR summary of 2-3 sentences covering only the most essential points.',
  3: 'Present the content as a concise bullet-point list. Each bullet should be one line. No prose paragraphs.',
  4: 'Write compact short paragraphs. Do not expand on anything — keep it tighter than the original. Remove all non-essential detail.',
  5: 'Restructure and clean the content while preserving the same level of detail as the original. Do not add or remove significant information.',
  6: 'Provide a detailed rewrite: expand abbreviations, clarify implicit references, add brief section introductions, and explain jargon where it appears.',
  7: 'Produce a comprehensive version: add relevant background context, definitions for technical terms, and supporting details drawn from general knowledge to make the content self-contained.',
}

// --- Objectivity levels (1-7) ---
const OBJECTIVITY_INSTRUCTIONS: Record<number, string> = {
  1: 'Strict fact-check mode: strip ALL opinions, subjective language, and unverifiable claims. Output only statements that can be independently verified. Flag or remove anything speculative.',
  2: 'Remove most opinions and subjective phrasing. Retain only factual claims. Where a claim is uncertain, note it briefly.',
  3: 'Rewrite in a detached third-person journalistic tone. Report what was said/claimed without endorsing it. Use attribution phrases like "the author states" or "according to the text".',
  4: 'Preserve factual content. Soften strong opinions into measured, balanced statements. Replace absolutes with hedged language (e.g., "always" → "often").',
  5: 'Preserve the author\'s original meaning, voice, and tone. Do not add information that wasn\'t implied. Keep opinions as-is.',
  6: 'Retain the author\'s emotional language, rhetorical devices, and personal perspective. Preserve emphasis, exclamations, and persuasive framing.',
  7: 'Keep ALL subjective details, hyperbole, slang, raw emotional expression, and personal color exactly as the author expressed them. Do not tone down or neutralize anything.',
}

function buildSystemPrompt(verbosity: number, objectivity: number): string {
  const v = Math.max(1, Math.min(7, verbosity))
  const o = Math.max(1, Math.min(7, objectivity))

  return `<role>
You are a professional editor. The user will paste raw text or images (screenshots, photos of text, etc.) — content may be disorganized, filled with filler words, inconsistent punctuation, or stream-of-consciousness in structure.
</role>

<task>
<step>If images are provided, first extract and recognize all text from them (OCR). Combine with any accompanying text.</step>
<step>Fix all grammar, spelling, and punctuation errors silently.</step>
<step>Identify the core logical hierarchy: main topic → subtopics → supporting details.</step>
<step>Rewrite the content as clean Markdown:
- Use ## for the main topic, ### for subtopics.
- Use bullet lists for parallel items; numbered lists only for sequential steps.
- Bold (**) the single most important phrase per section.
- Remove filler, redundancy, and meta-commentary (e.g., "so basically", "I think").</step>
</task>

<verbosity level="${v}">
${VERBOSITY_INSTRUCTIONS[v]}
</verbosity>

<objectivity level="${o}">
${OBJECTIVITY_INSTRUCTIONS[o]}
</objectivity>

<constraints>
<language>Always match the language of the user's input. If the text is in Chinese, output in Chinese. If in English, output in English. If mixed, follow the dominant language.</language>
<output>Output only the Markdown. No preamble, no explanation, no code fences.</output>
</constraints>`
}

// Map verbosity level to max_tokens
function getMaxTokens(verbosity: number): number {
  const map: Record<number, number> = { 1: 256, 2: 512, 3: 1024, 4: 1536, 5: 2048, 6: 3072, 7: 4096 }
  return map[Math.max(1, Math.min(7, verbosity))] ?? 2048
}

// Map objectivity level to temperature
function getTemperature(objectivity: number): number {
  const map: Record<number, number> = { 1: 0.1, 2: 0.15, 3: 0.2, 4: 0.25, 5: 0.3, 6: 0.4, 7: 0.5 }
  return map[Math.max(1, Math.min(7, objectivity))] ?? 0.3
}

export function useChat() {
  const response = ref('')
  const isStreaming = ref(false)
  const error = ref('')

  let controller: AbortController | null = null

  function getProvider(): Provider {
    const stored = localStorage.getItem('selected_provider')
    if (stored === 'openai') return 'openai'
    return 'openrouter'
  }

  async function submit(userText: string, images: string[] = [], verbosity = 5, objectivity = 5) {
    const provider = getProvider()
    const config = PROVIDER_DEFAULTS[provider]
    const apiKey = localStorage.getItem(config.storageKey)

    if (!apiKey) {
      error.value = `No API key set. Open Settings to add your ${config.label} key.`
      return
    }

    const baseUrl = localStorage.getItem(config.baseUrlKey) || config.defaultBaseUrl
    const model = localStorage.getItem(config.modelKey) || config.model

    response.value = ''
    error.value = ''
    isStreaming.value = true
    controller = new AbortController()

    // Build user message content: multimodal array if images present, plain string otherwise
    const userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> =
      images.length > 0
        ? [
            { type: 'text', text: userText },
            ...images.map(url => ({ type: 'image_url', image_url: { url } })),
          ]
        : userText

    let res: Response
    try {
      res = await fetch('/api/text-inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Provider': provider,
          'X-Base-Url': baseUrl,
        },
        body: JSON.stringify({
          model,
          max_tokens: getMaxTokens(verbosity),
          temperature: getTemperature(objectivity),
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt(verbosity, objectivity) },
            { role: 'user', content: userContent },
          ],
        }),
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) {
        isStreaming.value = false
        return
      }
      error.value = 'Connection failed. Check your network and try again.'
      isStreaming.value = false
      return
    }

    if (!res.ok) {
      if (res.status === 401) {
        error.value = `Invalid API key. Please check your ${config.label} key in Settings.`
      } else if (res.status === 429) {
        error.value = 'Rate limit reached. Please wait a moment and try again.'
      } else {
        const body = await res.text().catch(() => '')
        error.value = body ? `Error ${res.status}: ${body.slice(0, 200)}` : `Error ${res.status}`
      }
      isStreaming.value = false
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      error.value = 'Connection failed. Check your network and try again.'
      isStreaming.value = false
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let insideThink = false // track whether we're inside a <think> block

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              // Strip <think>...</think> blocks (may arrive across multiple chunks)
              let filtered = ''
              let remaining = content
              while (remaining.length > 0) {
                if (insideThink) {
                  const closeIdx = remaining.indexOf('</think>')
                  if (closeIdx === -1) {
                    // Entire chunk is still inside <think>, discard
                    break
                  }
                  // Skip past </think>
                  remaining = remaining.slice(closeIdx + 8)
                  insideThink = false
                } else {
                  const openIdx = remaining.indexOf('<think>')
                  if (openIdx === -1) {
                    filtered += remaining
                    break
                  }
                  // Keep text before <think>
                  filtered += remaining.slice(0, openIdx)
                  remaining = remaining.slice(openIdx + 7)
                  insideThink = true
                }
              }
              if (filtered) {
                response.value += filtered
              }
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        error.value = 'Connection failed. Check your network and try again.'
      }
    } finally {
      isStreaming.value = false
      controller = null
    }
  }

  function abort() {
    controller?.abort()
    isStreaming.value = false
    controller = null
  }

  return { response, isStreaming, error, submit, abort }
}
