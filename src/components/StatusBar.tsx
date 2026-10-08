import type { Editor } from '../editor/Editor'
import { TOOL_META } from '../toolMeta'
import { useCursor, useEditorState } from '../hooks'

export function StatusBar({ ed }: { ed: Editor }) {
  useEditorState(ed)
  useCursor(ed)
  const c = ed.cursor
  const layer = ed.activeLayer()

  return (
    <footer className="statusbar">
      <span>{TOOL_META[ed.tool].label}</span>
      <span className="sep" />
      <span>
        {c.inside ? `${Math.round(c.x)}, ${Math.round(c.y)}` : '—, —'}
      </span>
      <span className="sep" />
      <span>
        {ed.width} × {ed.height}px
      </span>
      <span className="sep" />
      <span>Layer: {layer?.name ?? '—'}</span>
      <span className="spacer" />
      {ed.options.symmetryX && <span className="badge">MIRROR X</span>}
      {ed.options.symmetryY && <span className="badge">MIRROR Y</span>}
      <span className="badge">{Math.round(ed.view.zoom * 100)}%</span>
      <span className="hint-text">Space+drag to pan · Wheel to zoom · Shift snaps angles</span>
    </footer>
  )
}
