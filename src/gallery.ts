import { Editor } from './editor/Editor'
import { download } from './editor/utils'
import {
  putPiece,
  getAllPieces,
  getPiece,
  deletePiece,
  incrementDownloads,
  exportGalleryJSON,
  importGalleryJSON,
  type Piece,
  type PieceFormat,
} from './db'

export type { Piece, PieceFormat }
export { deletePiece, getPiece, exportGalleryJSON, importGalleryJSON }

const THUMB_MAX = 320

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'piece'
}

/**
 * Publishes the current canvas to the LOCAL gallery (IndexedDB).
 * Captures a flattened full-size PNG, a thumbnail, and the workspace state.
 */
export async function publishArtwork(
  ed: Editor,
  meta: { title: string; author: string; tags: string[] },
): Promise<Piece> {
  const flat = ed.composite()
  const blob: Blob = await new Promise((resolve, reject) =>
    flat.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render PNG'))), 'image/png'),
  )

  const k = Math.min(1, THUMB_MAX / Math.max(flat.width, flat.height))
  const thumb = document.createElement('canvas')
  thumb.width = Math.max(1, Math.round(flat.width * k))
  thumb.height = Math.max(1, Math.round(flat.height * k))
  thumb.getContext('2d')!.drawImage(flat, 0, 0, thumb.width, thumb.height)

  const piece: Piece = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title.trim() || 'Untitled',
    author: meta.author.trim() || 'Anonymous',
    tags: meta.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    format: 'png',
    thumbnail: thumb.toDataURL('image/png'),
    blob,
    project: JSON.stringify(ed.serialize()),
    width: ed.width,
    height: ed.height,
    downloads: 0,
    createdAt: Date.now(),
  }
  await putPiece(piece)
  return piece
}

export async function fetchArtworks(): Promise<Piece[]> {
  return getAllPieces()
}

/** Saves the current canvas as a local library piece in the requested format. */
export async function savePieceFromCanvas(
  ed: Editor,
  meta: { title: string; format: PieceFormat; tags?: string[] },
): Promise<Piece> {
  const base = ed.composite({ background: meta.format === 'png' })
  const flat = meta.format === 'sticker' ? makeSticker(base) : base
  const blob: Blob = await new Promise((resolve, reject) =>
    flat.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render PNG'))), 'image/png'),
  )
  const k = Math.min(1, THUMB_MAX / Math.max(flat.width, flat.height))
  const thumb = document.createElement('canvas')
  thumb.width = Math.max(1, Math.round(flat.width * k))
  thumb.height = Math.max(1, Math.round(flat.height * k))
  thumb.getContext('2d')!.drawImage(flat, 0, 0, thumb.width, thumb.height)
  const piece: Piece = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: meta.title.trim() || 'Untitled',
    author: 'Me',
    tags: (meta.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    format: meta.format,
    thumbnail: thumb.toDataURL('image/png'),
    blob,
    project: JSON.stringify(ed.serialize()),
    width: ed.width,
    height: ed.height,
    downloads: 0,
    createdAt: Date.now(),
  }
  await putPiece(piece)
  return piece
}

/** Downloads a piece's PNG (re-flattened from its saved layer stack at `scale`)
 *  and bumps its download counter. `variant` overrides the piece's saved format. */
export async function downloadPiece(
  piece: Piece,
  opts: { variant?: 'own' | PieceFormat; scale?: number } = {},
): Promise<void> {
  const scale = opts.scale ?? 1
  const cv = await renderPiece(piece, opts.variant ?? 'own', scale)
  const blob: Blob = await new Promise((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render PNG'))), 'image/png'),
  )
  const url = URL.createObjectURL(blob)
  download(url, `graffiti_${sanitizeFilename(piece.title)}_${Date.now()}.png`)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  await incrementDownloads(piece.id)
}

/** Copies a piece's PNG (own format, 1x) straight to the clipboard. */
export async function copyPieceToClipboard(piece: Piece): Promise<boolean> {
  try {
    const ClipboardItemCtor = (navigator as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
    if (!ClipboardItemCtor || !navigator.clipboard?.write) return false
    const cv = await renderPiece(piece, 'own', 1)
    const blob: Blob = await new Promise((resolve, reject) =>
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('No blob'))), 'image/png'),
    )
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

/**
 * Re-renders a stored piece from its saved layer stack (exact blend modes,
 * opacity, background texture) at the requested scale & variant.
 * Falls back to the stored flat blob if the project data is missing.
 */
async function renderPiece(piece: Piece, variant: 'own' | PieceFormat, scale: number): Promise<HTMLCanvasElement> {
  const fmt: PieceFormat = variant === 'own' ? piece.format ?? 'png' : variant
  if (piece.project) {
    const tmp = new Editor()
    await tmp.load(piece.project)
    const cv = tmp.composite({ background: fmt === 'png', scale })
    return fmt === 'sticker' ? makeSticker(cv) : cv
  }
  // fallback: scale the stored flat blob
  const img = await loadImage(URL.createObjectURL(piece.blob))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round((piece.width || 1600) * scale))
  cv.height = Math.max(1, Math.round((piece.height || 1000) * scale))
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
  return fmt === 'sticker' ? makeSticker(cv) : cv
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Wraps a transparent composite in a white die-cut sticker border. */
function makeSticker(cv: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = cv.width
  out.height = cv.height
  const ctx = out.getContext('2d')!
  // white silhouette of the artwork's alpha
  const sil = document.createElement('canvas')
  sil.width = cv.width
  sil.height = cv.height
  const sctx = sil.getContext('2d')!
  sctx.drawImage(cv, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = '#ffffff'
  sctx.fillRect(0, 0, sil.width, sil.height)
  const radius = Math.max(6, Math.round(cv.width / 180))
  const rings = [radius, radius * 0.55]
  const steps = 20
  for (const r of rings) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r)
    }
  }
  ctx.drawImage(sil, 0, 0)
  ctx.drawImage(cv, 0, 0)
  return out
}

/** Restores a piece (layers, blends, textures) into the workspace. */
export async function loadPiece(ed: Editor, piece: Piece): Promise<void> {
  await ed.load(piece.project)
}

/** Deep link for a piece: <origin><pathname>#piece-<id> (same browser only — data is local). */
export function pieceLink(id: string): string {
  return `${location.origin}${location.pathname}#piece-${id}`
}

export function parsePieceLink(hash: string): string | null {
  const m = /^#piece-(.+)$/.exec(hash)
  return m ? m[1] : null
}
