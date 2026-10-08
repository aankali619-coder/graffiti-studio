import {
  SprayCan, PenLine, Highlighter, Brush, Droplets, Droplet, Eraser,
  Minus, ArrowUpRight, Square, Circle, Hexagon, Star, Type,
  PaintBucket, Blend, Pipette, Waves, Hand,
} from 'lucide-react'
import type { Editor } from '../editor/Editor'
import type { ToolId } from '../types'
import { TOOL_ORDER } from '../toolMeta'
import { useEditorState } from '../hooks'

const ICONS: Record<ToolId, typeof Brush> = {
  spray: SprayCan,
  marker: PenLine,
  chisel: Highlighter,
  brush: Brush,
  splatter: Droplets,
  drip: Droplet,
  eraser: Eraser,
  line: Minus,
  arrow: ArrowUpRight,
  rect: Square,
  ellipse: Circle,
  polygon: Hexagon,
  star: Star,
  text: Type,
  fill: PaintBucket,
  gradient: Blend,
  eyedropper: Pipette,
  blur: Waves,
  hand: Hand,
}

export function Toolbar({ ed }: { ed: Editor }) {
  useEditorState(ed)
  return (
    <nav className="toolbar" aria-label="Tools">
      {TOOL_ORDER.map((meta) => {
        const Icon = ICONS[meta.id]
        const active = ed.tool === meta.id
        return (
          <button
            key={meta.id}
            className={`tool-btn${active ? ' active' : ''}`}
            title={`${meta.label} — ${meta.hint} (${meta.shortcut})`}
            onClick={() => ed.setTool(meta.id)}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span className="tool-key">{meta.shortcut}</span>
          </button>
        )
      })}
    </nav>
  )
}
