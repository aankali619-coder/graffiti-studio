import type { ToolId } from './types'

export type OptionKey =
  | 'size' | 'opacity' | 'hardness' | 'flow' | 'spread'
  | 'fillMode' | 'strokeWidth' | 'sides' | 'points' | 'innerRatio'
  | 'tolerance' | 'font' | 'text' | 'gradientType'

export interface ToolMeta {
  id: ToolId
  label: string
  hint: string
  shortcut: string
  options: OptionKey[]
}

export const TOOL_ORDER: ToolMeta[] = [
  { id: 'spray', label: 'Spray Can', hint: 'Aerosol paint with overspray', shortcut: 'S', options: ['size', 'flow', 'spread', 'opacity'] },
  { id: 'marker', label: 'Tag Marker', hint: 'Fat marker with speed taper', shortcut: 'M', options: ['size', 'opacity'] },
  { id: 'chisel', label: 'Chisel Tip', hint: 'Angled calligraphy nib', shortcut: 'C', options: ['size', 'opacity'] },
  { id: 'brush', label: 'Paint Brush', hint: 'Round brush, soft or hard edge', shortcut: 'B', options: ['size', 'hardness', 'opacity'] },
  { id: 'splatter', label: 'Splatter', hint: 'Flicked paint blobs', shortcut: 'P', options: ['size', 'spread', 'opacity'] },
  { id: 'drip', label: 'Drip', hint: 'Running paint drip — drag downward', shortcut: 'D', options: ['size', 'opacity'] },
  { id: 'eraser', label: 'Eraser', hint: 'Wipe paint away', shortcut: 'E', options: ['size', 'hardness', 'opacity'] },
  { id: 'line', label: 'Line', hint: 'Straight line (hold Shift to snap)', shortcut: 'L', options: ['strokeWidth', 'opacity'] },
  { id: 'arrow', label: 'Arrow', hint: 'Arrow with head', shortcut: 'A', options: ['strokeWidth', 'opacity'] },
  { id: 'rect', label: 'Rectangle', hint: 'Rect / square stencil', shortcut: 'R', options: ['fillMode', 'strokeWidth', 'opacity'] },
  { id: 'ellipse', label: 'Ellipse', hint: 'Ellipse / circle stencil', shortcut: 'O', options: ['fillMode', 'strokeWidth', 'opacity'] },
  { id: 'polygon', label: 'Polygon', hint: 'N-sided stencil', shortcut: 'G', options: ['sides', 'fillMode', 'strokeWidth', 'opacity'] },
  { id: 'star', label: 'Star', hint: 'Star stencil', shortcut: 'T', options: ['points', 'innerRatio', 'fillMode', 'strokeWidth', 'opacity'] },
  { id: 'stamp', label: 'Stamps', hint: 'Alphabet & icon stamps — click or drag to size', shortcut: 'K', options: ['fillMode', 'strokeWidth', 'opacity'] },
  { id: 'text', label: 'Graffiti Text', hint: 'Click the canvas and type', shortcut: 'W', options: ['text', 'font', 'opacity'] },
  { id: 'fill', label: 'Fill', hint: 'Flood fill an area', shortcut: 'F', options: ['tolerance', 'opacity'] },
  { id: 'gradient', label: 'Spray Fade', hint: 'Drag a gradient fade', shortcut: 'V', options: ['gradientType', 'opacity'] },
  { id: 'eyedropper', label: 'Picker', hint: 'Pick a colour off the canvas', shortcut: 'I', options: [] },
  { id: 'blur', label: 'Smudge', hint: 'Blur / smudge paint', shortcut: 'U', options: ['size'] },
  { id: 'hand', label: 'Pan', hint: 'Move the view (or hold Space)', shortcut: 'H', options: [] },
]

export const TOOL_META: Record<ToolId, ToolMeta> = Object.fromEntries(
  TOOL_ORDER.map((t) => [t.id, t]),
) as Record<ToolId, ToolMeta>

/** Graffiti palette: chroma, neons, flats, and metals. */
export const SWATCHES = [
  '#ff2d95', '#ff003c', '#ff6b00', '#ffe600',
  '#39ff14', '#00ff85', '#00f0ff', '#4d9fff',
  '#4d4dff', '#b14bff', '#ff7bd5', '#ffffff',
  '#d9d9d9', '#8a8a8a', '#3d3d44', '#0a0a0c',
  '#7a4b2a', '#c9a66b', '#5c3317', '#1f6b3a',
]
