/**
 * Local-only gallery storage (IndexedDB).
 * Nothing ever leaves the browser — no backend, no accounts.
 */

/** How a piece was (or will be) saved: with bg, transparent, or die-cut sticker. */
export type PieceFormat = 'png' | 'transparent' | 'sticker'

export interface Piece {
  id: string
  title: string
  author: string
  tags: string[]
  /** png (default) | transparent | sticker — how the stored blob was rendered */
  format?: PieceFormat
  /** dataURL of a downscaled preview */
  thumbnail: string
  /** full-size flattened PNG */
  blob: Blob
  /** serialized editor state (ed.serialize()) so pieces can be re-loaded into the workspace */
  project: string
  width: number
  height: number
  downloads: number
  createdAt: number
}

const DB_NAME = 'graffiti-gallery'
const DB_VERSION = 1
const STORE = 'pieces'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('downloads', 'downloads')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open gallery database'))
  })
  return dbPromise
}

function tx(mode: IDBTransactionMode): Promise<{ store: IDBObjectStore; done: Promise<void> }> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const done = new Promise<void>((res, rej) => {
          t.oncomplete = () => res()
          t.onerror = () => rej(t.error ?? new Error('Transaction failed'))
          t.onabort = () => rej(t.error ?? new Error('Transaction aborted'))
        })
        resolve({ store, done })
      }),
  )
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export async function putPiece(piece: Piece): Promise<void> {
  const { store, done } = await tx('readwrite')
  store.put(piece)
  await done
}

export async function getAllPieces(): Promise<Piece[]> {
  const { store, done } = await tx('readonly')
  const all = await reqToPromise(store.getAll() as IDBRequest<Piece[]>)
  await done
  return all
}

export async function getPiece(id: string): Promise<Piece | undefined> {
  const { store, done } = await tx('readonly')
  const piece = await reqToPromise(store.get(id) as IDBRequest<Piece | undefined>)
  await done
  return piece
}

export async function deletePiece(id: string): Promise<void> {
  const { store, done } = await tx('readwrite')
  store.delete(id)
  await done
}

export async function incrementDownloads(id: string): Promise<void> {
  const piece = await getPiece(id)
  if (!piece) return
  piece.downloads = (piece.downloads ?? 0) + 1
  await putPiece(piece)
}

export async function pieceCount(): Promise<number> {
  const { store, done } = await tx('readonly')
  const n = await reqToPromise(store.count())
  await done
  return n
}

// ---------- share packs (export / import the whole gallery as JSON) ----------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export interface GalleryPack {
  app: 'graffiti-studio-gallery'
  version: 1
  exportedAt: number
  pieces: Array<Omit<Piece, 'blob'> & { blobBase64: string }>
}

/** Serializes every piece (blobs base64-encoded) into one JSON string. */
export async function exportGalleryJSON(): Promise<string> {
  const pieces = await getAllPieces()
  const packed: GalleryPack = {
    app: 'graffiti-studio-gallery',
    version: 1,
    exportedAt: Date.now(),
    pieces: await Promise.all(
      pieces.map(async (p) => {
        const { blob, ...rest } = p
        return { ...rest, blobBase64: await blobToBase64(blob) }
      }),
    ),
  }
  return JSON.stringify(packed)
}

/** Merges an imported pack; existing ids are skipped unless `overwrite`. Returns [added, skipped]. */
export async function importGalleryJSON(json: string, overwrite = false): Promise<[number, number]> {
  const pack = JSON.parse(json) as GalleryPack
  if (pack?.app !== 'graffiti-studio-gallery' || pack.version !== 1) {
    throw new Error('Not a Graffiti Studio gallery pack')
  }
  const existing = new Set((await getAllPieces()).map((p) => p.id))
  let added = 0
  let skipped = 0
  for (const p of pack.pieces) {
    if (existing.has(p.id) && !overwrite) {
      skipped++
      continue
    }
    const { blobBase64, ...rest } = p
    await putPiece({ ...rest, blob: base64ToBlob(blobBase64) })
    added++
  }
  return [added, skipped]
}
