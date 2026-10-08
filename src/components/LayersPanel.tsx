import {
  Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
  Copy, ArrowDownToLine, Eraser,
} from 'lucide-react'
import type { Editor } from '../editor/Editor'
import { BLEND_MODES } from '../types'
import { useEditorState } from '../hooks'

export function LayersPanel({ ed }: { ed: Editor }) {
  useEditorState(ed)
  const ordered = [...ed.layers].reverse() // top layer first in the list

  return (
    <section className="panel layers-panel">
      <h3>
        Layers
        <span className="layer-actions">
          <button className="tb icon" title="Add layer" onClick={() => ed.addLayer()}>
            <Plus size={14} />
          </button>
          <button
            className="tb icon"
            title="Duplicate layer"
            onClick={() => ed.duplicateLayer(ed.activeId)}
          >
            <Copy size={13} />
          </button>
          <button
            className="tb icon"
            title="Merge down"
            onClick={() => ed.mergeDown(ed.activeId)}
          >
            <ArrowDownToLine size={13} />
          </button>
          <button
            className="tb icon"
            title="Clear layer"
            onClick={() => ed.clearLayer(ed.activeId)}
          >
            <Eraser size={13} />
          </button>
          <button
            className="tb icon"
            title="Delete layer"
            onClick={() => ed.deleteLayer(ed.activeId)}
          >
            <Trash2 size={13} />
          </button>
        </span>
      </h3>

      <ul className="layer-list">
        {ordered.map((l) => {
          const active = l.id === ed.activeId
          return (
            <li
              key={l.id}
              className={`layer-row${active ? ' active' : ''}`}
              onClick={() => ed.setActive(l.id)}
            >
              <button
                className="eye"
                title={l.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation()
                  ed.setLayer(l.id, { visible: !l.visible })
                }}
              >
                {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <div className="layer-main">
                <input
                  className="layer-name"
                  value={l.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => ed.setLayer(l.id, { name: e.target.value })}
                />
                <div className="layer-sub">
                  <select
                    value={l.blend}
                    title="Blend mode"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => ed.setLayer(l.id, { blend: e.target.value as typeof l.blend })}
                  >
                    {BLEND_MODES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={l.opacity}
                    title="Layer opacity"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => ed.setLayer(l.id, { opacity: +e.target.value })}
                  />
                  <span className="layer-op">{Math.round(l.opacity * 100)}%</span>
                </div>
              </div>
              <div className="layer-move">
                <button className="eye" title="Move up" onClick={(e) => { e.stopPropagation(); ed.moveLayer(l.id, 1) }}>
                  <ChevronUp size={13} />
                </button>
                <button className="eye" title="Move down" onClick={(e) => { e.stopPropagation(); ed.moveLayer(l.id, -1) }}>
                  <ChevronDown size={13} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
