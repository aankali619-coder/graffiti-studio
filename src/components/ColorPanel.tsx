import { ArrowLeftRight } from 'lucide-react'
import type { Editor } from '../editor/Editor'
import { SWATCHES } from '../toolMeta'
import { shade } from '../editor/utils'
import { useEditorState } from '../hooks'

export function ColorPanel({ ed }: { ed: Editor }) {
  useEditorState(ed)
  const o = ed.options

  return (
    <section className="panel">
      <h3>Paint</h3>
      <div className="color-row">
        <label className="chip primary" title="Primary paint">
          <input type="color" value={o.color} onChange={(e) => ed.setOptions({ color: e.target.value })} />
          <span>{o.color}</span>
        </label>
        <button
          className="swap-btn"
          title="Swap colours (X)"
          onClick={() => ed.setOptions({ color: o.secondary, secondary: o.color })}
        >
          <ArrowLeftRight size={14} />
        </button>
        <label className="chip secondary" title="Secondary — outlines, fades, shadows">
          <input type="color" value={o.secondary} onChange={(e) => ed.setOptions({ secondary: e.target.value })} />
          <span>{o.secondary}</span>
        </label>
      </div>

      <div className="shade-row">
        {[0.55, 0.3, 0.12, 0, -0.25, -0.5].map((a) => (
          <button
            key={a}
            className="shade"
            style={{ background: shade(o.color, a) }}
            title={shade(o.color, a)}
            onClick={() => ed.setOptions({ color: shade(o.color, a) })}
          />
        ))}
      </div>

      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={`swatch${o.color === c ? ' active' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => ed.setOptions({ color: c })}
          />
        ))}
      </div>
    </section>
  )
}
