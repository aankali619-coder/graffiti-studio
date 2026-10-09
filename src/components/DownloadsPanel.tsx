import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '../editor/Editor'
import {
  savePieceFromCanvas, fetchArtworks, downloadPiece, copyPieceToClipboard,
  loadPiece, deletePiece, type Piece, type PieceFormat,
} from '../gallery'
import { copyArtwork } from '../fileio'
import { downloadZip } from '../zip'
import { Download, Copy, FolderInput, Trash2, Package, Save, Check } from 'lucide-react'

const SCALES = [0.5, 1, 2, 4]
const MODES: [PieceFormat, string][] = [
  ['png', 'PNG'],
  ['transparent', 'Transparent'],
  ['sticker', 'Sticker'],
]

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'piece'
}

/**
 * DOWNLOADS tab: local library of saved pieces — search, sort, format-mode
 * chips, scale, per-card actions (download / copy / load / delete), ZIP pack.
 * Everything lives in IndexedDB; nothing leaves the browser.
 */
export function DownloadsPanel({ ed }: { ed: Editor }) {
  const [items, setItems] = useState<Piece[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'downloads'>('newest')
  const [mode, setMode] = useState<PieceFormat | null>(null) // active download-as format
  const [scale, setScale] = useState(1)
  const [saveTitle, setSaveTitle] = useState('My piece')
  const [layerOnly, setLayerOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await fetchArtworks())
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load pieces')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = items.filter(
      (p) => !q || p.title.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)),
    )
    return [...list].sort((a, b) =>
      sort === 'downloads' ? (b.downloads ?? 0) - (a.downloads ?? 0) : b.createdAt - a.createdAt,
    )
  }, [items, search, sort])

  // ---- card actions -------------------------------------------------------

  const onDownload = async (p: Piece) => {
    setBusy(true)
    setMsg('')
    try {
      await downloadPiece(p, { variant: mode ?? 'own', scale })
      await load() // refresh the counter
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  const onCopyImage = async (p: Piece) => {
    setMsg('')
    const ok = await copyPieceToClipboard(p)
    setMsg(ok ? 'Copied image to clipboard ✓' : 'Clipboard unavailable — use Download instead')
  }

  const onLoad = async (p: Piece) => {
    if (!confirm(`Replace the current canvas with “${p.title}”? (Undo still works)`)) return
    try {
      await loadPiece(ed, p)
      setMsg(`Loaded “${p.title}” into the workspace`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not load piece')
    }
  }

  const onDelete = async (p: Piece) => {
    if (!confirm(`Delete “${p.title}” permanently? This cannot be undone.`)) return
    await deletePiece(p.id)
    await load()
  }

  // ---- toolbar actions ----------------------------------------------------

  const onExportZip = async () => {
    if (visible.length === 0) return
    setBusy(true)
    setMsg('')
    try {
      const entries = await Promise.all(
        visible.map(async (p, i) => ({
          name: `${String(i + 1).padStart(3, '0')}_${sanitize(p.title)}.png`,
          data: new Uint8Array(await p.blob.arrayBuffer()),
        })),
      )
      downloadZip(entries, `graffiti_pack_${Date.now()}.zip`)
      setMsg(`Packed ${entries.length} piece${entries.length === 1 ? '' : 's'} into a ZIP ✓`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'ZIP export failed')
    } finally {
      setBusy(false)
    }
  }

  const onQuickSave = async () => {
    setBusy(true)
    setMsg('')
    try {
      await savePieceFromCanvas(ed, { title: saveTitle, format: mode ?? 'png' })
      setMsg(`Saved “${saveTitle.trim() || 'Untitled'}” as ${mode ?? 'png'} ✓`)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onCopyCurrent = async () => {
    setBusy(true)
    setMsg('')
    try {
      const result = await copyArtwork(ed, {
        background: (mode ?? 'png') === 'png',
        scale,
        layerOnly,
      })
      setMsg(result === 'copied' ? 'Copied current canvas ✓' : 'Clipboard unavailable — downloaded instead')
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <section className="panel dl-panel">
      <h3>Downloads</h3>

      {/* toolbar: search · sort · ZIP */}
      <div className="gallery-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or tag…"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'downloads')}>
          <option value="newest">Newest</option>
          <option value="downloads">Most downloaded</option>
        </select>
        <button
          className="tb icon zip-btn"
          title="Export all (filtered) pieces as a ZIP of PNGs"
          disabled={busy || visible.length === 0}
          onClick={() => void onExportZip()}
        >
          <Package size={13} />
        </button>
      </div>

      {/* download-as mode chips + scale */}
      <div className="dl-mode-row">
        <span className="dl-label">Download as</span>
        <div className="chips">
          {MODES.map(([id, label]) => (
            <button
              key={id}
              className={`mode-chip${mode === id ? ' on' : ''}`}
              title={
                mode === id
                  ? 'Click to clear — cards download in their saved format'
                  : `All card downloads become ${label.toLowerCase()}`
              }
              onClick={() => setMode(mode === id ? null : id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="dl-mode-row">
        <span className="dl-label">Size</span>
        <div className="segmented">
          {SCALES.map((s) => (
            <button key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p className="gallery-msg">
          <Check size={11} /> {msg}
        </p>
      )}

      {/* grid of saved pieces */}
      <div className="gallery-grid dl-grid">
        {visible.map((p) => (
          <div key={p.id} className="piece-card">
            <img
              className={`piece-thumb${p.format && p.format !== 'png' ? ' alpha' : ''}`}
              src={p.thumbnail}
              alt={p.title}
              loading="lazy"
            />
            <div className="piece-info">
              <strong title={p.title}>{p.title}</strong>
              <span>
                {formatDate(p.createdAt)} · <Download size={9} /> {p.downloads ?? 0}
                {p.format && p.format !== 'png' && <em className="fmt-badge">{p.format}</em>}
              </span>
              {p.tags.length > 0 && (
                <div className="piece-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="tag-chip static">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="piece-actions overlay">
              <button className="tb accent" disabled={busy} title="Download at the selected size" onClick={() => void onDownload(p)}>
                <Download size={13} /> Download
              </button>
              <button className="tb icon" title="Copy image" onClick={() => void onCopyImage(p)}>
                <Copy size={13} />
              </button>
              <button className="tb icon" title="Load into workspace" onClick={() => void onLoad(p)}>
                <FolderInput size={13} />
              </button>
              <button className="tb icon danger" title="Delete" onClick={() => void onDelete(p)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="gallery-hint neon-hint">
            {items.length === 0
              ? 'No pieces yet — be the first to publish!'
              : 'No pieces match your search.'}
          </p>
        )}
      </div>

      {/* quick save of the current canvas */}
      <div className="dl-quick">
        <h4>Quick save current canvas</h4>
        <div className="publish-row">
          <input
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="Piece title"
            title="Title"
          />
          <button className="tb accent" disabled={busy} onClick={() => void onQuickSave()} title="Save to your local library">
            <Save size={13} /> Save
          </button>
        </div>
        <p className="dl-meta">
          Saves as <strong>{(mode ?? 'png').toUpperCase()}</strong> · output{' '}
          {Math.round(ed.width * scale)} × {Math.round(ed.height * scale)} px
        </p>
        <div className="dl-actions">
          <button className="tb" disabled={busy} onClick={() => void onCopyCurrent()}>
            <Copy size={14} /> Copy current canvas
          </button>
          <label className="dl-check">
            <input type="checkbox" checked={layerOnly} onChange={(e) => setLayerOnly(e.target.checked)} />
            Current layer only
          </label>
        </div>
      </div>
    </section>
  )
}
