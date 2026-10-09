import { useRef, useState } from 'react'
import {
  Undo2, Redo2, Download, Upload, Save, FilePlus,
  ZoomIn, ZoomOut, Maximize, Magnet, Layers as LayersIcon, ImagePlus,
} from 'lucide-react'
import type { Editor } from '../editor/Editor'
import { WALL_TEXTURES, type WallTexture } from '../types'
import { saveProject, openProject, exportPNG } from '../fileio'
import { useEditorState } from '../hooks'

export function TopBar({ ed }: { ed: Editor }) {
  useEditorState(ed)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [showNew, setShowNew] = useState(false)

  const zoomPct = Math.round(ed.view.zoom * 100)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">◆</span> GRAFFITI <em>STUDIO</em>
      </div>

      <div className="btn-group">
        <button className="tb" title="New canvas" onClick={() => setShowNew(true)}>
          <FilePlus size={15} /> New
        </button>
        <button className="tb" title="Open project (.json)" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Open
        </button>
        <button className="tb" title="Save project (Ctrl+S)" onClick={() => saveProject(ed)}>
          <Save size={15} /> Save
        </button>
        <button className="tb accent" title="Export PNG (Ctrl+E)" onClick={() => exportPNG(ed)}>
          <Download size={15} /> Export PNG
        </button>
        <button className="tb" title="Export PNG without background" onClick={() => exportPNG(ed, true)}>
          <Download size={15} /> Sticker
        </button>
        <button className="tb" title="Import an image as a new layer" onClick={() => imgRef.current?.click()}>
          <ImagePlus size={15} /> Image
        </button>
        <input
          ref={imgRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) {
              try {
                await ed.importImage(f)
              } catch {
                alert('Could not read that image.')
              }
            }
            e.target.value = ''
          }}
        />
      </div>

      <div className="btn-group">
        <button className="tb icon" title="Undo (Ctrl+Z)" onClick={() => void ed.undo()}>
          <Undo2 size={16} />
        </button>
        <button className="tb icon" title="Redo (Ctrl+Shift+Z)" onClick={() => void ed.redo()}>
          <Redo2 size={16} />
        </button>
      </div>

      <div className="btn-group">
        <button className="tb" title="Mirror the whole piece left-to-right" onClick={() => ed.flip('h')}>
          Flip ↔
        </button>
        <button className="tb" title="Mirror the whole piece top-to-bottom" onClick={() => ed.flip('v')}>
          Flip ↕
        </button>
      </div>

      <div className="btn-group">
        <label className="field-inline" title="Wall surface">
          <LayersIcon size={14} />
          <select value={ed.texture} onChange={(e) => ed.setTexture(e.target.value as WallTexture)}>
            {WALL_TEXTURES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline" title="Canvas background colour">
          BG
          <input
            type="color"
            value={ed.bg === 'transparent' ? '#26262c' : ed.bg}
            onChange={(e) => {
              ed.bg = e.target.value
              ed.emit()
              ed.emitDraw()
            }}
          />
        </label>
      </div>

      <button
        className={`tb toggle${ed.options.symmetryX ? ' on' : ''}`}
        title="Mirror left/right while painting"
        onClick={() => ed.setOptions({ symmetryX: !ed.options.symmetryX })}
      >
        <Magnet size={14} /> Mirror X
      </button>
      <button
        className={`tb toggle${ed.options.symmetryY ? ' on' : ''}`}
        title="Mirror top/bottom while painting"
        onClick={() => ed.setOptions({ symmetryY: !ed.options.symmetryY })}
      >
        <Magnet size={14} /> Mirror Y
      </button>

      <div className="spacer" />

      <div className="btn-group">
        <button
          className="tb icon"
          title="Zoom out (Ctrl+-)"
          onClick={() => ed.zoomAt(1 / 1.25, size().w / 2, size().h / 2)}
        >
          <ZoomOut size={16} />
        </button>
        <span className="zoom-label">{zoomPct}%</span>
        <button
          className="tb icon"
          title="Zoom in (Ctrl++)"
          onClick={() => ed.zoomAt(1.25, size().w / 2, size().h / 2)}
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="tb icon"
          title="Fit to screen (Ctrl+0)"
          onClick={() => ed.fit(size().w, size().h)}
        >
          <Maximize size={16} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) {
            try {
              await openProject(ed, f)
            } catch {
              alert('Could not open that file — is it a Graffiti Studio project?')
            }
          }
          e.target.value = ''
        }}
      />

      {showNew && <NewProjectDialog ed={ed} onClose={() => setShowNew(false)} />}
    </header>
  )

  function size() {
    const el = document.querySelector('.stage')
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight }
  }
}

function NewProjectDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [w, setW] = useState(1600)
  const [h, setH] = useState(1000)
  const [bg, setBg] = useState('#ffffff')
  const [texture, setTexture] = useState<WallTexture>('concrete')

  const presets = [
    { label: 'Wall 1600×1000', w: 1600, h: 1000 },
    { label: 'Square 1080', w: 1080, h: 1080 },
    { label: 'Portrait 1080×1920', w: 1080, h: 1920 },
    { label: 'Banner 1920×720', w: 1920, h: 720 },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Wall</h2>
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p.label}
              className="tb"
              onClick={() => {
                setW(p.w)
                setH(p.h)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="modal-grid">
          <label>
            Width
            <input type="number" min={64} max={4096} value={w} onChange={(e) => setW(+e.target.value)} />
          </label>
          <label>
            Height
            <input type="number" min={64} max={4096} value={h} onChange={(e) => setH(+e.target.value)} />
          </label>
          <label>
            Surface
            <select value={texture} onChange={(e) => setTexture(e.target.value as WallTexture)}>
              {WALL_TEXTURES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Background
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="tb" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tb accent"
            onClick={() => {
              ed.newProject(Math.max(64, w), Math.max(64, h), bg, texture)
              onClose()
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
