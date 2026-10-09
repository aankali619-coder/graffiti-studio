import { useState } from 'react'
import type { Editor } from '../editor/Editor'
import { TOOL_META, type OptionKey } from '../toolMeta'
import { FONTS, type FillMode } from '../types'
import { useEditorState } from '../hooks'
import { ICON_STAMPS, LETTERS, renderStampPreview } from '../editor/stamps'

function Slider({
  label, min, max, step, value, onChange, format,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="slider-row">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="slider-value">{format ? format(value) : value}</span>
    </label>
  )
}

/** Graffiti alphabet & icon stamps. */
function StampPicker({ ed }: { ed: Editor }) {
  const o = ed.options
  const [tab, setTab] = useState<'letters' | 'icons'>('letters')

  const pickLetter = (ch: string) => {
    ed.setOptions({ stampKind: 'letter', stampValue: ch })
    ed.setTool('stamp')
  }
  const pickIcon = (id: string) => {
    ed.setOptions({ stampKind: 'icon', stampValue: id })
    ed.setTool('stamp')
  }

  return (
    <div className="stamp-picker">
      <div className="segmented">
        <button className={tab === 'letters' ? 'on' : ''} onClick={() => setTab('letters')}>
          Alphabet
        </button>
        <button className={tab === 'icons' ? 'on' : ''} onClick={() => setTab('icons')}>
          Icons
        </button>
      </div>

      {tab === 'letters' ? (
        <div className="letter-grid">
          {LETTERS.map((ch) => (
            <button
              key={ch}
              className={`letter-tile${o.stampKind === 'letter' && o.stampValue === ch ? ' active' : ''}`}
              onClick={() => pickLetter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      ) : (
        <div className="icon-grid">
          {ICON_STAMPS.map((icon) => (
            <button
              key={icon.id}
              className={`icon-tile${o.stampKind === 'icon' && o.stampValue === icon.id ? ' active' : ''}`}
              title={icon.label}
              onClick={() => pickIcon(icon.id)}
            >
              <canvas ref={(cv) => { if (cv) renderStampPreview(cv, icon.id, 'icon') }} />
            </button>
          ))}
        </div>
      )}

      <Slider label="Stamp size" min={24} max={600} step={4} value={o.fontSize}
        onChange={(v) => ed.setOptions({ fontSize: v })} format={(v) => `${v}px`} />
      <label className="check-row">
        <input
          type="checkbox"
          checked={o.drips}
          onChange={(e) => ed.setOptions({ drips: e.target.checked })}
        />
        Paint drips on stamps
      </label>
    </div>
  )
}

const SPRAY_CAPS = [
  { id: 'skinny', label: 'Skinny', size: 6, flow: 0.45, spread: 0.25 },
  { id: 'regular', label: 'Regular', size: 18, flow: 0.6, spread: 0.6 },
  { id: 'fat', label: 'Fat', size: 44, flow: 0.65, spread: 0.9 },
  { id: 'super', label: 'Super Fat', size: 96, flow: 0.7, spread: 1.3 },
]

/** Spray can cap sizes — the single biggest difference between can styles. */
function CapPicker({ ed }: { ed: Editor }) {
  const o = ed.options
  return (
    <div className="cap-row">
      {SPRAY_CAPS.map((c) => {
        const active = Math.abs(o.size - c.size) <= 2 && Math.abs(o.spread - c.spread) < 0.2
        return (
          <button
            key={c.id}
            className={`cap-btn${active ? ' active' : ''}`}
            title={`${c.label} cap — ${c.size}px`}
            onClick={() => ed.setOptions({ size: c.size, flow: c.flow, spread: c.spread })}
          >
            <span className={`cap-dot cap-${c.id}`} style={{ background: o.color }} />
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

export function OptionsPanel({ ed }: { ed: Editor }) {
  useEditorState(ed)
  const o = ed.options
  const meta = TOOL_META[ed.tool]
  const set = (patch: Parameters<Editor['setOptions']>[0]) => ed.setOptions(patch)

  const render = (key: OptionKey) => {
    switch (key) {
      case 'size':
        return (
          <Slider key={key} label="Size" min={1} max={220} step={1} value={o.size}
            onChange={(v) => set({ size: v })} format={(v) => `${v}px`} />
        )
      case 'opacity':
        return (
          <Slider key={key} label="Opacity" min={0.05} max={1} step={0.05} value={o.opacity}
            onChange={(v) => set({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )
      case 'hardness':
        return (
          <Slider key={key} label="Hardness" min={0} max={1} step={0.05} value={o.hardness}
            onChange={(v) => set({ hardness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )
      case 'flow':
        return (
          <Slider key={key} label="Flow" min={0.05} max={1} step={0.05} value={o.flow}
            onChange={(v) => set({ flow: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )
      case 'spread':
        return (
          <Slider key={key} label="Overspray" min={0} max={2} step={0.05} value={o.spread}
            onChange={(v) => set({ spread: v })} format={(v) => v.toFixed(2)} />
        )
      case 'strokeWidth':
        return (
          <Slider key={key} label="Outline" min={0} max={60} step={1} value={o.strokeWidth}
            onChange={(v) => set({ strokeWidth: v })} format={(v) => `${v}px`} />
        )
      case 'tolerance':
        return (
          <Slider key={key} label="Tolerance" min={0} max={255} step={1} value={o.tolerance}
            onChange={(v) => set({ tolerance: v })} />
        )
      case 'sides':
        return (
          <Slider key={key} label="Sides" min={3} max={24} step={1} value={o.sides}
            onChange={(v) => set({ sides: v })} />
        )
      case 'points':
        return (
          <Slider key={key} label="Points" min={3} max={24} step={1} value={o.points}
            onChange={(v) => set({ points: v })} />
        )
      case 'innerRatio':
        return (
          <Slider key={key} label="Inner radius" min={0.1} max={0.9} step={0.05} value={o.innerRatio}
            onChange={(v) => set({ innerRatio: v })} format={(v) => `${Math.round(v * 100)}%`} />
        )
      case 'fillMode':
        return (
          <div className="segmented" key={key}>
            {(['none', 'solid', 'gradient'] as FillMode[]).map((m) => (
              <button
                key={m}
                className={o.fillMode === m ? 'on' : ''}
                onClick={() => set({ fillMode: m })}
              >
                {m === 'none' ? 'Outline' : m === 'solid' ? 'Fill' : 'Fade'}
              </button>
            ))}
          </div>
        )
      case 'gradientType':
        return (
          <div className="segmented" key={key}>
            {(['linear', 'radial'] as const).map((m) => (
              <button key={m} className={o.gradientType === m ? 'on' : ''} onClick={() => set({ gradientType: m })}>
                {m}
              </button>
            ))}
          </div>
        )
      case 'text':
        return (
          <div className="text-opts" key={key}>
            <textarea
              className="text-input"
              rows={2}
              value={o.textValue}
              placeholder="Type your tag…"
              onChange={(e) => set({ textValue: e.target.value })}
            />
            <Slider label="Font size" min={24} max={480} step={4} value={o.fontSize}
              onChange={(v) => set({ fontSize: v })} format={(v) => `${v}px`} />
            <Slider label="Outline" min={0} max={40} step={1} value={o.outlineWidth}
              onChange={(v) => set({ outlineWidth: v })} format={(v) => `${v}px`} />
            <Slider label="Drop shadow" min={0} max={60} step={1} value={o.shadowOffset}
              onChange={(v) => set({ shadowOffset: v })} format={(v) => `${v}px`} />
            <label className="check-row">
              <input type="checkbox" checked={o.glow} onChange={(e) => set({ glow: e.target.checked })} />
              Neon glow
            </label>
            <label className="check-row">
              <input type="checkbox" checked={o.drips} onChange={(e) => set({ drips: e.target.checked })} />
              Paint drips
            </label>
          </div>
        )
      case 'font':
        return (
          <label className="field-block" key={key}>
            Font
            <select value={o.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f.css} value={f.css}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )
      default:
        return null
    }
  }

  return (
    <section className="panel">
      <h3>
        {meta.label} <span className="hint">{meta.hint}</span>
      </h3>
      <div className="options">
        {ed.tool === 'stamp' && <StampPicker ed={ed} />}
        {ed.tool === 'spray' && <CapPicker ed={ed} />}
        {meta.options.map(render)}
      </div>
    </section>
  )
}
