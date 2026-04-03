// Composable — handles image upload, paste, drag-drop, compression, and preview state
import { ref } from 'vue'

const MAX_RAW_SIZE = 20 * 1024 * 1024 // 20 MB — reject files larger than this before processing
const MAX_DIMENSION = 2048 // longest side after compression
const JPEG_QUALITY = 0.85

export function useImageUpload() {
  const images = ref<string[]>([]) // base64 data URLs
  const imageError = ref('')

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_RAW_SIZE) {
        reject(new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`))
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img

          // Only downscale if exceeds MAX_DIMENSION
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)

          // Use original format for PNGs with transparency; JPEG for everything else
          const isPng = file.type === 'image/png'
          const mimeType = isPng ? 'image/png' : 'image/jpeg'
          const quality = isPng ? undefined : JPEG_QUALITY

          const dataUrl = canvas.toDataURL(mimeType, quality)
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async function addFiles(files: FileList | File[]) {
    imageError.value = ''
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (fileArray.length === 0) return

    for (const file of fileArray) {
      try {
        const dataUrl = await compressImage(file)
        images.value.push(dataUrl)
      } catch (err) {
        imageError.value = err instanceof Error ? err.message : 'Failed to process image'
      }
    }
  }

  function removeImage(index: number) {
    images.value.splice(index, 1)
  }

  function clearImages() {
    images.value = []
    imageError.value = ''
  }

  function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault() // prevent pasting image as text
      addFiles(imageFiles)
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    const files = event.dataTransfer?.files
    if (files) addFiles(files)
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
  }

  return {
    images,
    imageError,
    addFiles,
    removeImage,
    clearImages,
    handlePaste,
    handleDrop,
    handleDragOver,
  }
}
