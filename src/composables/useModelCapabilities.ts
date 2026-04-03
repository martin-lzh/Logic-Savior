// Composable — detects whether the current model supports image input
import { ref } from 'vue'
import type { Provider } from './useChat'

// Static allowlist for OpenAI models known to support vision (image input)
// OpenAI doesn't expose a capability flag in their /v1/models response
const OPENAI_VISION_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4-vision-preview',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini',
  'o4-mini',
])

// Cache: provider+baseUrl → Map<modelId, boolean>
const visionCache = new Map<string, Map<string, boolean>>()

function getCacheKey(provider: string, baseUrl: string): string {
  return `${provider}::${baseUrl}`
}

export function useModelCapabilities() {
  const supportsVision = ref<boolean | null>(null) // null = unknown/loading
  const checking = ref(false)

  let abortController: AbortController | null = null

  async function checkVision(provider: Provider, model: string, apiKey: string, baseUrl: string) {
    // Cancel any in-flight check
    abortController?.abort()
    abortController = new AbortController()

    checking.value = true
    supportsVision.value = null

    // Check cache first
    const cacheKey = getCacheKey(provider, baseUrl)
    const cached = visionCache.get(cacheKey)?.get(model)
    if (cached !== undefined) {
      supportsVision.value = cached
      checking.value = false
      return
    }

    if (provider === 'openai' && !isCustomBaseUrl(provider, baseUrl)) {
      // Use static allowlist for standard OpenAI endpoint
      const result = OPENAI_VISION_MODELS.has(model) || 
        Array.from(OPENAI_VISION_MODELS).some(v => model.startsWith(v))
      setCached(cacheKey, model, result)
      supportsVision.value = result
      checking.value = false
      return
    }

    if (provider === 'openrouter' && !isCustomBaseUrl(provider, baseUrl)) {
      // Query OpenRouter models API — it has architecture.input_modalities
      try {
        const res = await fetch('/api/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Provider': provider,
            'X-Base-Url': baseUrl,
          },
          signal: abortController.signal,
        })

        if (res.ok) {
          const data = await res.json()
          const models: Array<{ id: string; architecture?: { input_modalities?: string[] } }> = data.data ?? []

          // Build cache for all models from this response
          const modelMap = new Map<string, boolean>()
          for (const m of models) {
            const hasVision = m.architecture?.input_modalities?.includes('image') ?? false
            modelMap.set(m.id, hasVision)
          }
          visionCache.set(cacheKey, modelMap)

          supportsVision.value = modelMap.get(model) ?? false
        } else {
          // API error — default to allowing images (fail open for UX)
          supportsVision.value = true
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          // Network error — default to allowing images
          supportsVision.value = true
        }
      }

      checking.value = false
      return
    }

    // Custom base URL — can't detect capabilities, default to allowing
    supportsVision.value = true
    checking.value = false
  }

  function isCustomBaseUrl(provider: Provider, baseUrl: string): boolean {
    const defaults: Record<Provider, string> = {
      openrouter: 'https://openrouter.ai/api/v1',
      openai: 'https://api.openai.com/v1',
    }
    return baseUrl !== defaults[provider]
  }

  function setCached(cacheKey: string, model: string, value: boolean) {
    if (!visionCache.has(cacheKey)) visionCache.set(cacheKey, new Map())
    visionCache.get(cacheKey)!.set(model, value)
  }

  return {
    supportsVision,
    checking,
    checkVision,
  }
}
