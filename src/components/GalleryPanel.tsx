import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '../editor/Editor'
import {
  publishArtwork, fetchArtworks, downloadPiece, loadPiece,
  deletePiece, getPiece, exportGalleryJSON, importGalleryJSON,
  pieceLink, parsePieceLink, type Piece,
} from '../gallery'
import { download } from '../editor/utils'
import { Upload, RefreshCw, Download, Link2, FolderInput, Trash2, FileDown, FileUp, X } from 'lucide-react'

export function GalleryPanel({ ed }: { ed: Editor }) {
  const [items, setItems] = useState<Piece[]>([])
  const [title, setTitle] = useState('Untitled piece')
  const [author, setAuthor] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'downloads'>('newest')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [deepLink, setDeepLink] = useState<Piece | null>(null)
  const packRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setItems(await fetchArtworks())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load gallery')
    }
  }, [])

  useEffect(() => {
    void load()
    const id = parsePieceLink(location.hash)
    if (id) {
      void getPiece(id).then((p) => {
        if (p) setDeepLink(p)
      })
    }
  }, [load])

  const publish = async () => {
    setBusy(true)
    setMessage('')
    try {
      await publishArtwork(ed, {
        title,
        author,
        tags: tagsInput.split(','),
      })
      setTagsInput('')
      setMessage('Published to your local gallery ✓')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  const onDownload = async (p: Piece) => {
    await downloadPiece(p)
    await load() // refresh the counter
  }

  const onLoad = async (p: Piece) => {
    if (!confirm(`Replace the current canvas with “${p.title}”? (Undo still works)`)) return
    try {
      await loadPiece(ed, p)
      setMessage(`Loaded “${p.title}” into the workspace`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load piece')
    }
  }

  const onDelete = async (p: Piece) => {
    if (!confirm(`Delete “${p.title}” permanently? This cannot be undone.`)) return
    await deletePiece(p.id)
    if (deepLink?.id === p.id) setDeepLink(null)
    await load()
  }

  const onCopyLink = async (p: Piece) => {
    try {
      await navigator.clipboard.writeText(pieceLink(p.id))
      setMessage('Link copied — open it in this browser to share the piece')
    } catch {
      setMessage('Clipboard blocked — link: ' + pieceLink(p.id))
    }
  }

  const onExportPack = async () => {
    try {
      const json = await exportGalleryJSON()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      download(url, `graffiti_gallery_${Date.now()}.json`)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setMessage('Gallery pack exported')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const onImportPack = async (file: File) => {
    try {
      const [added, skipped] = await importGalleryJSON(await file.text())
      setMessage(`Imported ${added} piece${added === 1 ? '' : 's'}${skipped ? ` (${skipped} already existed)` : ''}`)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed — not a valid pack file')
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items.filter((p) => {
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
      const matchesTag = !tagFilter || p.tags.includes(tagFilter)
      return matchesSearch && matchesTag
    })
    list = [...list].sort((a, b) =>
      sort === 'downloads' ? (b.downloads ?? 0) - (a.downloads ?? 0) : b.createdAt - a.createdAt,
    )
    return list
  }, [items, search, sort, tagFilter])

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <section className="panel">
      <h3>
        Community Gallery
        <span className="layer-actions">
          <button className="tb icon" title="Export gallery pack (JSON)" onClick={() => void onExportPack()}>
            <FileDown size={13} />
          </button>
          <button className="tb icon" title="Import gallery pack (JSON)" onClick={() => packRef.current?.click()}>
            <FileUp size={13} />
          </button>
          <button className="tb icon" title="Refresh gallery" onClick={() => void load()}>
            <RefreshCw size={13} />
          </button>
          <input
            ref={packRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportPack(f)
              e.target.value = ''
            }}
          />
        </span>
      </h3>

      <div className="publish-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Piece title" title="Title" />
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your tag / name" title="Author" />
        <button className="tb accent" disabled={busy} onClick={() => void publish()} title="Save the current canvas to your local gallery">
          <Upload size={13} />
          {busy ? '…' : 'Publish'}
        </button>
      </div>
      <div className="publish-row">
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="tags, comma, separated"
          title="Tags"
        />
      </div>
      {message && <p className="gallery-msg">{message}</p>}

      {deepLink && (
        <div className="deeplink-note">
          <span>Saved piece: <strong>{deepLink.title}</strong></span>
          <div className="piece-actions">
            <button className="tb" title="Load into workspace" onClick={() => void onLoad(deepLink)}>
              <FolderInput size={13} /> Load
            </button>
            <button className="tb" title="Download PNG" onClick={() => void onDownload(deepLink)}>
              <Download size={13} />
            </button>
            <button className="tb icon" title="Dismiss" onClick={() => setDeepLink(null)}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="gallery-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, author, tag…"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'downloads')}>
          <option value="newest">Newest</option>
          <option value="downloads">Most downloaded</option>
        </select>
      </div>
      {tagFilter && (
        <p className="gallery-msg">
          Filtering by “{tagFilter}”{' '}
          <button className="link-btn" onClick={() => setTagFilter(null)}>clear</button>
        </p>
      )}

      <div className="gallery-grid">
        {visible.map((p) => (
          <div key={p.id} className="piece-card">
            <img className="piece-thumb" src={p.thumbnail} alt={p.title} loading="lazy" />
            <div className="piece-info">
              <strong title={p.title}>{p.title}</strong>
              <span>
                {p.author} · {formatDate(p.createdAt)} · <Download size={9} /> {p.downloads ?? 0}
              </span>
              {p.tags.length > 0 && (
                <div className="piece-tags">
                  {p.tags.map((t) => (
                    <button key={t} className="tag-chip" onClick={() => setTagFilter(t === tagFilter ? null : t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="piece-actions">
              <button className="tb icon" title="Download PNG" onClick={() => void onDownload(p)}>
                <Download size={13} />
              </button>
              <button className="tb icon" title="Copy link" onClick={() => void onCopyLink(p)}>
                <Link2 size={13} />
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
          <p className="gallery-hint">
            {items.length === 0
              ? 'No pieces yet — be the first to publish!'
              : 'No pieces match your search.'}
          </p>
        )}
      </div>
    </section>
  )
}
