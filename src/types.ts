export type ToolId =
  | 'spray' | 'marker' | 'chisel' | 'brush' | 'splatter' | 'drip' | 'eraser'
  | 'line' | 'arrow' | 'rect' | 'ellipse' | 'polygon' | 'star'
  | 'stamp' | 'text' | 'fill' | 'gradient' | 'eyedropper' | 'blur' | 'hand'

export type FillMode = 'none' | 'solid' | 'gradient'

export type BlendMode =
  | 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'

export const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'color-dodge', label: 'Color Dodge' },
  { id: 'color-burn', label: 'Color Burn' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'difference', label: 'Difference' },
  { id: 'exclusion', label: 'Exclusion' },
]

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  blend: BlendMode
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export interface ToolOptions {
  color: string
  secondary: string
  size: number
  opacity: number
  hardness: number
  flow: number
  spread: number
  fillMode: FillMode
  strokeWidth: number
  tolerance: number
  sides: number
  points: number
  innerRatio: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  outlineWidth: number
  shadowOffset: number
  glow: boolean
  drips: boolean
  gradientType: 'linear' | 'radial'
  symmetryX: boolean
  symmetryY: boolean
  textValue: string
  stampKind: 'letter' | 'icon'
  stampValue: string
}

export const DEFAULT_OPTIONS: ToolOptions = {
  color: '#ff2d95',
  secondary: '#00f0ff',
  size: 28,
  opacity: 1,
  hardness: 0.8,
  flow: 0.6,
  spread: 0.7,
  fillMode: 'none',
  strokeWidth: 6,
  tolerance: 60,
  sides: 6,
  points: 5,
  innerRatio: 0.45,
  fontFamily: 'Permanent Marker',
  fontSize: 160,
  fontWeight: 700,
  outlineWidth: 8,
  shadowOffset: 10,
  glow: false,
  drips: false,
  gradientType: 'linear',
  symmetryX: false,
  symmetryY: false,
  textValue: 'GRAFFITI',
  stampKind: 'letter',
  stampValue: 'A',
}

export const WALL_TEXTURES = ['plain', 'concrete', 'brick'] as const
export type WallTexture = (typeof WALL_TEXTURES)[number]

export interface FontDef {
  css: string
  label: string
}

/** Graffiti-flavoured fonts (loaded from Google Fonts; fall back gracefully offline). */
export const FONTS: FontDef[] = [
  { css: "'Permanent Marker', cursive", label: 'Permanent Marker' },
  { css: "'Rubik Spray Paint', cursive", label: 'Spray Paint' },
  { css: "'Sedgwick Ave', cursive", label: 'Tag Script' },
  { css: "'Bungee', sans-serif", label: 'Bungee' },
  { css: "'Bangers', cursive", label: 'Bangers' },
  { css: "'Rock Salt', cursive", label: 'Rock Salt' },
  { css: "'Archivo Black', sans-serif", label: 'Archivo Black' },
  { css: 'Impact, sans-serif', label: 'Impact' },
]
