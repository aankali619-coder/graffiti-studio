import type { Editor } from './editor/Editor'
import { download } from './editor/utils'

export function saveProject(ed: Editor): void {
  const json = JSON.stringify(ed.serialize())
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  download(url, `graffiti-piece-${Date.now()}.json`)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function openProject(ed: Editor, file: File): Promise<void> {
  const text = await file.text()
  await ed.load(text)
}

export function exportPNG(ed: Editor, transparent = false): void {
  const cv = transparent
    ? (() => {
        const c = document.createElement('canvas')
        c.width = ed.width
        c.height = ed.height
        const ctx = c.getContext('2d')!
        for (const l of ed.layers) {
          if (!l.visible) continue
          ctx.globalAlpha = l.opacity
          ctx.globalCompositeOperation = l.blend
          ctx.drawImage(l.canvas, 0, 0)
        }
        return c
      })()
    : ed.composite()
  cv.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    download(url, `graffiti-piece-${Date.now()}.png`)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, 'image/png')
}
