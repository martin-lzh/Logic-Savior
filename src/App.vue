<script setup lang="ts">
// App.vue — Single-page application shell: header, settings drawer, input, output
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings2, Moon, Sun, X, Trash2, Save, Loader2, StopCircle, Clipboard, Check, ChevronDown, ChevronUp, RefreshCw, ImageDown, ImagePlus, Languages } from 'lucide-vue-next'
import { toPng } from 'html-to-image'
import MarkdownIt from 'markdown-it'
import { useChat } from './composables/useChat'
import { useImageUpload } from './composables/useImageUpload'
import { useModelCapabilities } from './composables/useModelCapabilities'

const { t, locale } = useI18n()

function toggleLocale() {
  const next = locale.value === 'en' ? 'zh-CN' : 'en'
  locale.value = next
  localStorage.setItem('locale', next)
  document.documentElement.lang = next
}

type Provider = 'openrouter' | 'openai'

const PROVIDER_META: Record<Provider, {
  label: string
  storageKey: string
  baseUrlKey: string
  modelKey: string
  defaultBaseUrl: string
  defaultModel: string
  placeholder: string
}> = {
  openrouter: {
    label: 'OpenRouter',
    storageKey: 'openrouter_api_key',
    baseUrlKey: 'openrouter_base_url',
    modelKey: 'openrouter_model',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-haiku',
    placeholder: 'sk-or-v1-...',
  },
  openai: {
    label: 'OpenAI',
    storageKey: 'openai_api_key',
    baseUrlKey: 'openai_base_url',
    modelKey: 'openai_model',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
  },
}

// --- Dark mode ---
const isDark = ref(false)

function initDarkMode() {
  const stored = localStorage.getItem('dark_mode')
  isDark.value = stored === 'true'
  applyDarkClass()
}

function toggleDark() {
  isDark.value = !isDark.value
  localStorage.setItem('dark_mode', String(isDark.value))
  applyDarkClass()
}

function applyDarkClass() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

// --- Provider & Settings ---
const selectedProvider = ref<Provider>('openrouter')
const settingsOpen = ref(false)
const keyInput = ref('')
const baseUrlInput = ref('')
const modelInput = ref('')
const keyError = ref('')
const keySaved = ref(false)

function initProvider() {
  const stored = localStorage.getItem('selected_provider')
  if (stored === 'openai') selectedProvider.value = 'openai'
  else selectedProvider.value = 'openrouter'
}

function switchProvider(p: Provider) {
  selectedProvider.value = p
  localStorage.setItem('selected_provider', p)
  keyInput.value = ''
  keyError.value = ''
  keySaved.value = false
  loadProviderFields(p)
  triggerVisionCheck()
}

function loadProviderFields(p: Provider) {
  const meta = PROVIDER_META[p]
  baseUrlInput.value = localStorage.getItem(meta.baseUrlKey) ?? ''
  modelInput.value = localStorage.getItem(meta.modelKey) ?? ''
}

const currentMeta = computed(() => PROVIDER_META[selectedProvider.value])

// Force reactivity on key status
const keyVersion = ref(0)
const currentProviderKeyStored = computed(() => {
  void keyVersion.value
  return !!localStorage.getItem(currentMeta.value.storageKey)
})

// Active model display per provider (reacts to keyVersion bumps)
const openRouterActiveModel = computed(() => {
  void keyVersion.value
  return localStorage.getItem('openrouter_model') || PROVIDER_META.openrouter.defaultModel
})
const openAIActiveModel = computed(() => {
  void keyVersion.value
  return localStorage.getItem('openai_model') || PROVIDER_META.openai.defaultModel
})

function saveKey() {
  const meta = currentMeta.value
  const val = keyInput.value.trim()

  if (val && val.length < 8) {
    keyError.value = t('settings.apiKeyShort')
    return
  }

  // Save key if provided
  if (val) {
    localStorage.setItem(meta.storageKey, val)
  }

  // Save base URL (or remove if empty to fall back to default)
  const baseUrl = baseUrlInput.value.trim()
  if (baseUrl) {
    localStorage.setItem(meta.baseUrlKey, baseUrl)
  } else {
    localStorage.removeItem(meta.baseUrlKey)
  }

  // Save model (or remove if empty to fall back to default)
  const model = modelInput.value.trim()
  if (model) {
    localStorage.setItem(meta.modelKey, model)
  } else {
    localStorage.removeItem(meta.modelKey)
  }

  keyInput.value = ''
  keyError.value = ''
  keySaved.value = true
  keyVersion.value++
  triggerVisionCheck()

  setTimeout(() => {
    keySaved.value = false
    settingsOpen.value = false
  }, 1200)
}

function deleteKey() {
  const meta = currentMeta.value
  localStorage.removeItem(meta.storageKey)
  localStorage.removeItem(meta.baseUrlKey)
  localStorage.removeItem(meta.modelKey)
  keyInput.value = ''
  baseUrlInput.value = ''
  modelInput.value = ''
  keyError.value = ''
  keyVersion.value++
}

function openSettings() {
  keyInput.value = ''
  keyError.value = ''
  keySaved.value = false
  loadProviderFields(selectedProvider.value)
  settingsOpen.value = true
}

// --- Chat ---
const { response, isStreaming, error: chatError, submit, abort } = useChat()
const inputText = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const inputCollapsed = ref(false)

// --- Verbosity & Objectivity sliders (i18n-reactive) ---
const verbosityLabel = computed(() => t(`verbosity.${verbosity.value}`))
const objectivityLabel = computed(() => t(`objectivity.${objectivity.value}`))

const verbosity = ref(Number(localStorage.getItem('logic_savior_verbosity')) || 5)
const objectivity = ref(Number(localStorage.getItem('logic_savior_objectivity')) || 5)

watch(verbosity, (v) => localStorage.setItem('logic_savior_verbosity', String(v)))
watch(objectivity, (v) => localStorage.setItem('logic_savior_objectivity', String(v)))

// --- Image upload ---
const { images, imageError, addFiles, removeImage, clearImages, handlePaste, handleDrop, handleDragOver } = useImageUpload()
const fileInputEl = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const lastSubmittedImages = ref<string[]>([])

function openFilePicker() {
  fileInputEl.value?.click()
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = '' // reset so same file can be re-selected
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  handleDrop(e)
}

function onDragOver(e: DragEvent) {
  isDragOver.value = true
  handleDragOver(e)
}

function onDragLeave() {
  isDragOver.value = false
}

// --- Vision capability detection ---
const { supportsVision, checkVision } = useModelCapabilities()

function triggerVisionCheck() {
  const provider = selectedProvider.value
  const meta = PROVIDER_META[provider]
  const apiKey = localStorage.getItem(meta.storageKey)
  if (!apiKey) {
    supportsVision.value = null
    return
  }
  const baseUrl = localStorage.getItem(meta.baseUrlKey) || meta.defaultBaseUrl
  const model = localStorage.getItem(meta.modelKey) || meta.defaultModel
  checkVision(provider, model, apiKey, baseUrl)
}

function autoResize() {
  const el = textareaEl.value
  if (!el) return
  if (inputCollapsed.value) {
    el.style.height = '44px'
    return
  }
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

watch(inputText, () => {
  nextTick(autoResize)
})

function toggleInputCollapse() {
  inputCollapsed.value = !inputCollapsed.value
  nextTick(autoResize)
}

function handleSubmit() {
  const text = inputText.value.trim()
  // On regenerate, reuse cached images if no new ones were added
  const currentImages = images.value.length > 0 ? [...images.value] : [...lastSubmittedImages.value]
  if ((!text && currentImages.length === 0) || isStreaming.value) return
  lastSubmittedImages.value = currentImages
  inputCollapsed.value = true
  nextTick(autoResize)
  submit(text, currentImages, verbosity.value, objectivity.value)
  clearImages()
}

function handleClear() {
  inputText.value = ''
  response.value = ''
  chatError.value = ''
  clearImages()
  lastSubmittedImages.value = []
  inputCollapsed.value = false
  nextTick(autoResize)
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(response.value)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // clipboard API not available
  }
}

// --- Export as image ---
const outputEl = ref<HTMLElement | null>(null)
const exporting = ref(false)

async function exportAsImage() {
  if (!outputEl.value || exporting.value) return
  exporting.value = true
  try {
    const dataUrl = await toPng(outputEl.value, {
      backgroundColor: isDark.value ? '#1a1a2e' : '#ffffff',
      pixelRatio: 2,
      style: {
        padding: '24px',
      },
    })
    const link = document.createElement('a')
    link.download = 'logic-savior-output.png'
    link.href = dataUrl
    link.click()
  } catch {
    // export failed silently
  } finally {
    exporting.value = false
  }
}

// --- Markdown rendering with debounce ---
const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
const renderedHtml = ref('')
let renderTimer: ReturnType<typeof setTimeout> | null = null

watch(response, (val) => {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderedHtml.value = md.render(val)
  }, 50)
}, { immediate: true })

// --- Lifecycle ---
onMounted(() => {
  initDarkMode()
  initProvider()
  triggerVisionCheck()
  document.documentElement.lang = locale.value
})
</script>

<template>
  <div class="min-h-screen bg-bg-light dark:bg-bg-dark font-inter transition-colors duration-200">
    <!-- Header -->
    <header
      class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-sm border-b border-black/5 dark:border-white/5"
    >
      <h1 class="text-lg font-semibold tracking-tight text-accent-light dark:text-accent-dark font-sourceSerif4">
        {{ t('header.title') }}
      </h1>
      <div class="flex items-center gap-2">
        <button
          @click="toggleLocale"
          class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
          :aria-label="t('header.language')"
        >
          <Languages :size="20" class="text-accent-light dark:text-accent-dark" />
        </button>
        <button
          @click="toggleDark"
          class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
          :aria-label="t('header.toggleDarkMode')"
        >
          <Sun v-if="isDark" :size="20" class="text-accent-dark" />
          <Moon v-else :size="20" class="text-accent-light" />
        </button>
        <button
          @click="openSettings"
          class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
          :aria-label="t('header.settings')"
        >
          <Settings2 :size="20" class="text-accent-light dark:text-accent-dark" />
        </button>
      </div>
    </header>

    <!-- Settings Drawer Overlay -->
    <Transition name="fade">
      <div
        v-if="settingsOpen"
        class="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        @click="settingsOpen = false"
      />
    </Transition>

    <!-- Settings Drawer -->
    <Transition name="slide-right">
      <div
        v-if="settingsOpen"
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-surface-light dark:bg-surface-dark shadow-2xl flex flex-col"
      >
        <!-- Drawer header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
          <h2 class="text-base font-semibold text-accent-light dark:text-accent-dark">{{ t('settings.title') }}</h2>
          <button
            @click="settingsOpen = false"
            class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
            :aria-label="t('settings.close')"
          >
            <X :size="20" class="text-accent-light dark:text-accent-dark" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <!-- Provider toggle -->
          <div>
            <label class="block text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60 mb-2">
              {{ t('settings.provider') }}
            </label>
            <div class="flex rounded-lg bg-black/5 dark:bg-white/5 p-1">
              <button
                v-for="p in (['openrouter', 'openai'] as Provider[])"
                :key="p"
                @click="switchProvider(p)"
                :class="[
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 min-h-[44px]',
                  selectedProvider === p
                    ? 'bg-surface-light dark:bg-surface-dark shadow-sm text-accent-light dark:text-accent-dark'
                    : 'text-accent-light/50 dark:text-accent-dark/50 hover:text-accent-light/80 dark:hover:text-accent-dark/80',
                ]"
              >
                <span class="truncate text-left">
                  {{ PROVIDER_META[p].label }}
                  <span class="block text-[10px] font-normal opacity-50 truncate">
                    {{ p === 'openrouter' ? openRouterActiveModel : openAIActiveModel }}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <!-- API Key input -->
          <div>
            <label
              class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60 mb-2"
            >
              {{ t('settings.apiKey', { label: currentMeta.label }) }}
              <span
                v-if="currentProviderKeyStored"
                class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                :title="t('settings.apiKeySaved')"
              />
            </label>
            <input
              v-model="keyInput"
              type="password"
              :placeholder="currentMeta.placeholder"
              class="w-full px-3 py-3 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-sm text-accent-light dark:text-accent-dark placeholder:text-accent-light/30 dark:placeholder:text-accent-dark/30 focus:outline-none focus:ring-2 focus:ring-accent-light/20 dark:focus:ring-accent-dark/20 transition-shadow min-h-[44px]"
              @keydown.enter="saveKey"
            />
            <p v-if="keyError" class="mt-1.5 text-xs text-red-500">{{ keyError }}</p>
            <p v-if="keySaved" class="mt-1.5 text-xs text-emerald-500">{{ t('settings.saved') }}</p>
          </div>

          <!-- Base URL -->
          <div>
            <label
              class="block text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60 mb-2"
            >
              {{ t('settings.baseUrl') }}
            </label>
            <input
              v-model="baseUrlInput"
              type="url"
              :placeholder="currentMeta.defaultBaseUrl"
              class="w-full px-3 py-3 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-sm text-accent-light dark:text-accent-dark placeholder:text-accent-light/30 dark:placeholder:text-accent-dark/30 focus:outline-none focus:ring-2 focus:ring-accent-light/20 dark:focus:ring-accent-dark/20 transition-shadow min-h-[44px]"
            />
            <p class="mt-1 text-[11px] text-accent-light/40 dark:text-accent-dark/40">
              {{ t('settings.baseUrlHint', { url: currentMeta.defaultBaseUrl }) }}
            </p>
          </div>

          <!-- Model -->
          <div>
            <label
              class="block text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60 mb-2"
            >
              {{ t('settings.model') }}
            </label>
            <input
              v-model="modelInput"
              type="text"
              :placeholder="currentMeta.defaultModel"
              class="w-full px-3 py-3 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-sm text-accent-light dark:text-accent-dark placeholder:text-accent-light/30 dark:placeholder:text-accent-dark/30 focus:outline-none focus:ring-2 focus:ring-accent-light/20 dark:focus:ring-accent-dark/20 transition-shadow min-h-[44px]"
            />
            <p class="mt-1 text-[11px] text-accent-light/40 dark:text-accent-dark/40">
              {{ t('settings.modelHint', { model: currentMeta.defaultModel }) }}
            </p>
          </div>

          <!-- Save / Delete -->
          <div class="flex gap-3">
            <button
              @click="saveKey"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent-light dark:bg-accent-dark text-white dark:text-black text-sm font-medium active:scale-[0.97] transition-transform min-h-[44px]"
            >
              <Save :size="16" />
              {{ t('settings.save') }}
            </button>
            <button
              @click="deleteKey"
              class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/5 active:scale-[0.97] transition-transform min-h-[44px]"
            >
              <Trash2 :size="16" />
              {{ t('settings.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Main content -->
    <main class="max-w-2xl mx-auto px-4 pt-5 pb-32 md:pb-8">
      <!-- Input area -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <label
            class="text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60"
          >
            {{ t('input.label') }}
          </label>
          <button
            v-if="inputText.trim() && (isStreaming || response)"
            @click="toggleInputCollapse"
            class="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-accent-light/50 dark:text-accent-dark/50 hover:text-accent-light dark:hover:text-accent-dark hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-all min-w-[44px] min-h-[34px] justify-center"
            :aria-label="inputCollapsed ? t('input.expand') : t('input.collapse')"
          >
            <ChevronDown v-if="inputCollapsed" :size="14" />
            <ChevronUp v-else :size="14" />
            {{ inputCollapsed ? t('input.expand') : t('input.collapse') }}
          </button>
        </div>
        <div
          class="relative"
          :class="isDragOver ? 'ring-2 ring-accent-light/40 dark:ring-accent-dark/40 rounded-xl' : ''"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <textarea
            ref="textareaEl"
            v-model="inputText"
            :placeholder="t('input.placeholder')"
            rows="4"
            :class="[
              'w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark text-sm text-accent-light dark:text-accent-dark placeholder:text-accent-light/30 dark:placeholder:text-accent-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-accent-light/20 dark:focus:ring-accent-dark/20 transition-all leading-relaxed',
              inputCollapsed ? 'h-[44px] overflow-hidden cursor-pointer opacity-70' : '',
            ]"
            :readonly="inputCollapsed"
            @click="inputCollapsed && toggleInputCollapse()"
            @input="autoResize"
            @paste="handlePaste"
          />
          <!-- Upload button — bottom-right of textarea -->
          <button
            v-if="supportsVision !== false"
            @click="openFilePicker"
            class="absolute bottom-2 right-2 p-2 rounded-lg text-accent-light/40 dark:text-accent-dark/40 hover:text-accent-light dark:hover:text-accent-dark hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-all"
            :class="inputCollapsed ? 'hidden' : ''"
            :aria-label="t('input.uploadImage')"
            type="button"
          >
            <ImagePlus :size="18" />
          </button>
          <input
            ref="fileInputEl"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="onFileSelect"
          />
          <!-- Drag overlay -->
          <div
            v-if="isDragOver"
            class="absolute inset-0 rounded-xl bg-accent-light/5 dark:bg-accent-dark/5 border-2 border-dashed border-accent-light/30 dark:border-accent-dark/30 flex items-center justify-center pointer-events-none"
          >
            <span class="text-sm text-accent-light/60 dark:text-accent-dark/60">{{ t('input.dropImage') }}</span>
          </div>
        </div>

        <!-- Image previews -->
        <div v-if="images.length > 0" class="flex flex-wrap gap-2 mt-2">
          <div
            v-for="(img, idx) in images"
            :key="idx"
            class="relative group"
          >
            <img
              :src="img"
              alt="Attached image"
              class="h-20 w-20 object-cover rounded-lg border border-black/10 dark:border-white/10"
            />
            <button
              @click="removeImage(idx)"
              class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              :aria-label="t('input.removeImage')"
              type="button"
            >
              &times;
            </button>
          </div>
        </div>

        <!-- Image error -->
        <p v-if="imageError" class="mt-1.5 text-xs text-red-500">{{ imageError }}</p>
      </div>

      <!-- Verbosity & Objectivity sliders -->
      <div class="mb-5 space-y-4">
        <!-- Verbosity -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60">
              {{ t('verbosity.label') }}
            </label>
            <span class="text-xs font-medium text-accent-light dark:text-accent-dark">
              {{ verbosityLabel }}
            </span>
          </div>
          <input
            v-model.number="verbosity"
            type="range"
            min="1"
            max="7"
            step="1"
            class="slider w-full"
          />
          <div class="flex justify-between mt-1">
            <span class="text-[10px] text-accent-light/40 dark:text-accent-dark/40">{{ t('verbosity.1') }}</span>
            <span class="text-[10px] text-accent-light/40 dark:text-accent-dark/40">{{ t('verbosity.7') }}</span>
          </div>
        </div>

        <!-- Objectivity -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60">
              {{ t('objectivity.label') }}
            </label>
            <span class="text-xs font-medium text-accent-light dark:text-accent-dark">
              {{ objectivityLabel }}
            </span>
          </div>
          <input
            v-model.number="objectivity"
            type="range"
            min="1"
            max="7"
            step="1"
            class="slider w-full"
          />
          <div class="flex justify-between mt-1">
            <span class="text-[10px] text-accent-light/40 dark:text-accent-dark/40">{{ t('objectivity.1') }}</span>
            <span class="text-[10px] text-accent-light/40 dark:text-accent-dark/40">{{ t('objectivity.7') }}</span>
          </div>
        </div>
      </div>

      <!-- Error display -->
      <div
        v-if="chatError"
        class="mb-5 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-600 dark:text-red-400"
      >
        {{ chatError }}
      </div>

      <!-- Output area -->
      <div v-if="renderedHtml" class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium uppercase tracking-wider text-accent-light/60 dark:text-accent-dark/60">
            {{ t('output.label') }}
          </span>
          <div class="flex items-center gap-1">
            <button
              @click="exportAsImage"
              :disabled="exporting || isStreaming"
              :class="[
                'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs active:scale-[0.97] transition-all min-w-[44px] min-h-[44px] justify-center',
                'text-accent-light/50 dark:text-accent-dark/50 hover:text-accent-light dark:hover:text-accent-dark hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30',
              ]"
              :aria-label="t('output.saveAsImage')"
            >
              <Loader2 v-if="exporting" :size="14" class="animate-spin" />
              <ImageDown v-else :size="14" />
              {{ t('output.image') }}
            </button>
            <button
              @click="copyOutput"
              :class="[
                'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs active:scale-[0.97] transition-all min-w-[44px] min-h-[44px] justify-center',
                copied
                  ? 'text-emerald-500'
                  : 'text-accent-light/50 dark:text-accent-dark/50 hover:text-accent-light dark:hover:text-accent-dark hover:bg-black/5 dark:hover:bg-white/5',
              ]"
              :aria-label="t('output.copyMarkdown')"
            >
              <Check v-if="copied" :size="14" />
              <Clipboard v-else :size="14" />
              {{ copied ? t('output.copied') : t('output.copy') }}
            </button>
          </div>
        </div>
        <div
          ref="outputEl"
          class="px-5 py-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-white/5 prose dark:prose-invert max-w-none"
          v-html="renderedHtml"
        />
      </div>

      <!-- Streaming indicator -->
      <div v-if="isStreaming && !renderedHtml" class="mb-5 flex items-center gap-2 text-sm text-accent-light/50 dark:text-accent-dark/50">
        <Loader2 :size="16" class="animate-spin" />
        {{ t('status.generating') }}
      </div>

      <!-- Desktop action bar -->
      <div class="hidden md:flex gap-3 mt-4">
        <button
          v-if="!isStreaming"
          @click="handleSubmit"
          :disabled="!inputText.trim() && images.length === 0 && lastSubmittedImages.length === 0"
          class="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent-light dark:bg-accent-dark text-white dark:text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-transform min-h-[44px]"
        >
          <RefreshCw v-if="response" :size="16" />
          {{ response ? t('actions.regenerate') : t('actions.submit') }}
        </button>
        <button
          v-else
          @click="abort"
          class="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-[0.97] transition-transform min-h-[44px]"
        >
          <StopCircle :size="16" />
          {{ t('actions.stop') }}
        </button>
        <button
          @click="handleClear"
          :disabled="isStreaming"
          class="px-5 py-3 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium text-accent-light dark:text-accent-dark disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-h-[44px]"
        >
          {{ t('actions.clear') }}
        </button>
      </div>
    </main>

    <!-- Mobile fixed action bar -->
    <div
      class="md:hidden fixed bottom-0 left-0 right-0 z-20 flex gap-3 px-4 py-3 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-sm border-t border-black/5 dark:border-white/5"
    >
      <button
        v-if="!isStreaming"
        @click="handleSubmit"
        :disabled="!inputText.trim() && images.length === 0 && lastSubmittedImages.length === 0"
        class="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent-light dark:bg-accent-dark text-white dark:text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-transform min-h-[44px]"
      >
        <RefreshCw v-if="response" :size="16" />
        {{ response ? t('actions.regenerate') : t('actions.submit') }}
      </button>
      <button
        v-else
        @click="abort"
        class="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-[0.97] transition-transform min-h-[44px]"
      >
        <StopCircle :size="16" />
        {{ t('actions.stop') }}
      </button>
      <button
        @click="handleClear"
        :disabled="isStreaming"
        class="px-5 py-3 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium text-accent-light dark:text-accent-dark disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97] transition-transform min-h-[44px]"
      >
        {{ t('actions.clear') }}
      </button>
    </div>
  </div>
</template>

<style>
/* Drawer transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

/* Ensure prose headings use serif */
.prose h1,
.prose h2,
.prose h3,
.prose h4,
.prose h5,
.prose h6 {
  font-family: 'Source Serif 4', Georgia, ui-serif, serif;
}

/* Custom range slider */
.slider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.08);
  outline: none;
  cursor: pointer;
}

.dark .slider {
  background: rgba(255, 255, 255, 0.08);
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--thumb-color, #101010);
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider::-webkit-slider-thumb:active {
  transform: scale(1.05);
}

.dark .slider::-webkit-slider-thumb {
  background: var(--thumb-color-dark, #F5F5F5);
  border-color: rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--thumb-color, #101010);
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.dark .slider::-moz-range-thumb {
  background: var(--thumb-color-dark, #F5F5F5);
  border-color: rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.08);
}

.dark .slider::-moz-range-track {
  background: rgba(255, 255, 255, 0.08);
}
</style>
