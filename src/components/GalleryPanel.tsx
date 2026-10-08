import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '../editor/Editor'
import { supabaseConfigured } from '../lib/supabase'
import { artworkUrl, fetchArtworks, publishArtwork, type Artwork } from '../gallery'
import { Upload, RefreshCw } from 'lucide-react'

export function GalleryPanel({ ed }: { ed: Editor }) {
  const [title, setTitle] = useState('Untitled piece')
  const [artist, setArtist] = useState('')
  const [items, setItems] = useState<Artwork[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setMessage('')
    try {
      setItems(await fetchArtworks())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load gallery')
    }
  }, [])

  useEffect(() => {
    if (supabaseConfigured) void load()
  }, [load])

  const publish = async () => {
    setBusy(true)
    setMessage('')
    try {
      await publishArtwork(ed, title, artist)
      setMessage('Published! 🎉')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h3>
        Community Gallery
        <span className="layer-actions">
          <button className="tb icon" title="Refresh gallery" onClick={() => void load()}>
            <RefreshCw size={13} />
          </button>
        </span>
      </h3>

      {!supabaseConfigured ? (
        <p className="gallery-hint">
          Gallery is offline — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on your deployment.
        </p>
      ) : (
        <>
          <div className="publish-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Piece title"
              title="Title"
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Your tag / name"
              title="Artist"
            />
            <button className="tb accent" disabled={busy} onClick={() => void publish()} title="Upload the current canvas to the public gallery">
              <Upload size={13} />
              {busy ? '…' : 'Publish'}
            </button>
          </div>
          {message && <p className="gallery-msg">{message}</p>}

          <div className="gallery-grid">
            {items.map((a) => (
              <a
                key={a.id}
                className="gallery-item"
                href={artworkUrl(a.image_path)}
                target="_blank"
                rel="noreferrer"
                title={`${a.title} — ${a.artist}`}
              >
                <img
                  src={artworkUrl(a.image_path)}
                  alt={a.title}
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget
                    el.style.display = 'none'
                    el.parentElement?.classList.add('broken')
                  }}
                />
                <span className="gallery-cap">
                  <strong>{a.title}</strong>
                  <em>{a.artist}</em>
                </span>
              </a>
            ))}
            {items.length === 0 && <p className="gallery-hint">No pieces yet — be the first to publish!</p>}
          </div>
        </>
      )}
    </section>
  )
}
