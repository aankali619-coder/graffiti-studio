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

export interface ArtworkOptions {
  /** include background colour + texture (default true) */
  background?: boolean
  /** output scale, e.g. 0.5 / 1 / 2 / 4 (default 1) */
  scale?: number
  /** export only the active layer (default false) */
  layerOnly?: boolean
}

/** graffiti_<tool>_<timestamp>.png — lowercased & sanitized, no spaces */
export function artworkFilename(ed: Editor, ext = 'png'): string {
  const tool = ed.tool.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'art'
  return `graffiti_${tool}_${Date.now()}.${ext}`
}

function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof cv.toBlob !== 'function') {
      resolve(null) // very old browsers → caller falls back to toDataURL()
      return
    }
    cv.toBlob((b) => resolve(b), 'image/png')
  })
}

/** Flatten per options and download as PNG (toDataURL fallback for old browsers). */
export async function downloadArtwork(ed: Editor, opts: ArtworkOptions = {}): Promise<void> {
  const cv = ed.composite(opts)
  const name = artworkFilename(ed)
  const blob = await canvasToBlob(cv)
  if (blob) {
    const url = URL.createObjectURL(blob)
    download(url, name)
    // large PNGs (4x exports can be ~30MB) must not have their URL revoked
    // before the browser finishes writing the file
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return
  }
  // fallback: data URL download
  try {
    download(cv.toDataURL('image/png'), name)
  } catch (e) {
    alert('Download failed in this browser: ' + (e instanceof Error ? e.message : e))
  }
}

/** Copy the flattened PNG to the clipboard; falls back to downloading if unsupported. */
export async function copyArtwork(ed: Editor, opts: ArtworkOptions = {}): Promise<'copied' | 'downloaded'> {
  try {
    const ClipboardItemCtor = (navigator as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
    if (!ClipboardItemCtor || !navigator.clipboard?.write) throw new Error('Clipboard images unsupported')
    const cv = ed.composite(opts)
    const blob = await canvasToBlob(cv)
    if (!blob) throw new Error('No blob')
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
    return 'copied'
  } catch {
    await downloadArtwork(ed, opts)
    return 'downloaded'
  }
}

/** Legacy quick-export (kept for Ctrl+E / Export PNG button). */
export function exportPNG(ed: Editor, transparent = false): void {
  void downloadArtwork(ed, { background: !transparent })
}
