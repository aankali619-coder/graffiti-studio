import type { ToolOptions } from '../types'

export interface Pt {
  x: number
  y: number
}

export interface StampDef {
  id: string
  label: string
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

export const ICON_STAMPS: StampDef[] = [
  { id: 'crown', label: 'Crown' },
  { id: 'heart', label: 'Heart' },
  { id: 'bolt', label: 'Bolt' },
  { id: 'peace', label: 'Peace' },
  { id: 'smiley', label: 'Smiley' },
  { id: 'splat', label: 'Splat' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'arrow', label: 'Arrow' },
]

/** Builds the path of an icon inside a 100×100 unit box. Returns detail style if the icon has interior line art. */
function iconPath(ctx: CanvasRenderingContext2D, id: string): 'none' | 'detail' {
  ctx.beginPath()
  switch (id) {
    case 'crown':
      ctx.moveTo(6, 90)
      ctx.lineTo(6, 26)
      ctx.lineTo(28, 52)
      ctx.lineTo(50, 14)
      ctx.lineTo(72, 52)
      ctx.lineTo(94, 26)
      ctx.lineTo(94, 90)
      ctx.closePath()
      ctx.rect(4, 76, 92, 16)
      return 'none'
    case 'heart':
      ctx.moveTo(50, 90)
      ctx.bezierCurveTo(18, 66, 4, 48, 4, 31)
      ctx.bezierCurveTo(4, 13, 24, 5, 38, 14)
      ctx.bezierCurveTo(46, 19, 50, 29, 50, 36)
      ctx.bezierCurveTo(50, 29, 54, 19, 62, 14)
      ctx.bezierCurveTo(76, 5, 96, 13, 96, 31)
      ctx.bezierCurveTo(96, 48, 82, 66, 50, 90)
      ctx.closePath()
      return 'none'
    case 'bolt':
      ctx.moveTo(58, 2)
      ctx.lineTo(22, 54)
      ctx.lineTo(44, 54)
      ctx.lineTo(36, 98)
      ctx.lineTo(78, 42)
      ctx.lineTo(54, 42)
      ctx.closePath()
      return 'none'
    case 'peace':
      ctx.arc(50, 50, 46, 0, Math.PI * 2)
      ctx.closePath()
      return 'detail'
    case 'smiley':
      ctx.arc(50, 50, 46, 0, Math.PI * 2)
      ctx.closePath()
      return 'detail'
    case 'splat': {
      const rs = [46, 30, 45, 31, 47, 29, 43, 35]
      const pts = rs.map((r, i) => {
        const a = (i * Math.PI * 2) / rs.length
        return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r }
      })
      // smooth closed curve through the points
      ctx.moveTo((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2)
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i]
        const next = pts[(i + 1) % pts.length]
        ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2)
      }
      ctx.closePath()
      // flying droplets
      ctx.moveTo(88, 14)
      ctx.arc(88, 14, 6, 0, Math.PI * 2)
      ctx.moveTo(12, 84)
      ctx.arc(12, 84, 5, 0, Math.PI * 2)
      ctx.moveTo(92, 74)
      ctx.arc(92, 74, 4, 0, Math.PI * 2)
      return 'none'
    }
    case 'diamond':
      ctx.moveTo(50, 4)
      ctx.lineTo(94, 50)
      ctx.lineTo(50, 96)
      ctx.lineTo(6, 50)
      ctx.closePath()
      return 'none'
    case 'arrow':
      ctx.moveTo(6, 38)
      ctx.lineTo(54, 38)
      ctx.lineTo(54, 10)
      ctx.lineTo(96, 50)
      ctx.lineTo(54, 90)
      ctx.lineTo(54, 62)
      ctx.lineTo(6, 62)
      ctx.closePath()
      return 'none'
    default:
      return 'none'
  }
}

function iconDetail(ctx: CanvasRenderingContext2D, id: string, o: ToolOptions, unit: number) {
  const detail = o.secondary
  ctx.strokeStyle = detail
  ctx.fillStyle = detail
  if (id === 'peace') {
    ctx.lineWidth = 8 * unit
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(50, 6)
    ctx.lineTo(50, 94)
    ctx.moveTo(50, 52)
    ctx.lineTo(16, 84)
    ctx.moveTo(50, 52)
    ctx.lineTo(84, 84)
    ctx.stroke()
  }
  if (id === 'smiley') {
    ctx.beginPath()
    ctx.arc(35, 38, 7, 0, Math.PI * 2)
    ctx.arc(65, 38, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 8 * unit
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(50, 52, 26, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()
  }
}

/** Applies fill/outline styling to the current path inside a unit box of size `unit` (scale factor). */
function styleCurrentPath(ctx: CanvasRenderingContext2D, o: ToolOptions, unit: number, bbox: { x: number; y: number; w: number; h: number }) {
  ctx.lineJoin = 'round'
  if (o.fillMode === 'none') {
    ctx.strokeStyle = o.color
    ctx.lineWidth = Math.max(1, o.strokeWidth) / unit
    ctx.stroke()
    return
  }
  if (o.fillMode === 'gradient') {
    ctx.fillStyle = gradientAcross(ctx, o, bbox)
  } else {
    ctx.fillStyle = o.color
  }
  ctx.fill()
  if (o.strokeWidth > 0) {
    ctx.strokeStyle = o.secondary
    ctx.lineWidth = o.strokeWidth / unit
    ctx.stroke()
  }
}

function gradientAcross(ctx: CanvasRenderingContext2D, o: ToolOptions, b: { x: number; y: number; w: number; h: number }) {
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
  g.addColorStop(0, o.color)
  g.addColorStop(1, o.secondary)
  return g
}

/** Drips hanging from stamped text (shared with the text tool). */
export function addTextDrips(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, o: ToolOptions) {
  let cx = x
  for (const ch of Array.from(line)) {
    const w = ctx.measureText(ch).width
    if (ch.trim() && Math.random() < 0.28) {
      const len = o.fontSize * (0.25 + Math.random() * 0.9)
      const rx = cx + w * (0.25 + Math.random() * 0.5)
      const base = Math.max(1.5, o.fontSize * 0.035)
      const steps = Math.max(4, Math.round(len / 3))
      const top = y + o.fontSize * 0.86
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        ctx.beginPath()
        ctx.arc(rx, top + len * t, Math.max(0.6, base * (1 - t * 0.55)), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(rx, top + len, base * 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
    cx += w
  }
}

/**
 * Draws the active stamp (letter or icon) anchored at `a`.
 * `b` defines the square size (drag); a plain click uses the default size.
 */
export function drawStamp(ctx: CanvasRenderingContext2D, o: ToolOptions, a: Pt, b: Pt): void {
  const dragged = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  const defaultSize = o.stampKind === 'letter' ? o.fontSize : Math.max(o.size * 3, 90)
  const s = dragged > 6 ? dragged : defaultSize
  const cx = a.x + s / 2
  const cy = a.y + s / 2

  ctx.save()
  ctx.globalAlpha = o.opacity
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (o.stampKind === 'letter' || /^[A-Za-z0-9]$/.test(o.stampValue)) {
    // glyph stamp
    const ch = o.stampValue.toUpperCase()
    const size = s * 0.86 // padding inside the stamp box
    ctx.font = `${o.fontWeight} ${size}px ${o.fontFamily}`
    const w = ctx.measureText(ch).width
    const bbox = { x: cx - w / 2, y: cy - size / 2, w, h: size }
    if (o.fillMode === 'none') {
      ctx.strokeStyle = o.color
      ctx.lineWidth = Math.max(1, o.strokeWidth)
      ctx.lineJoin = 'round'
      ctx.strokeText(ch, cx, cy)
    } else {
      ctx.fillStyle = o.fillMode === 'gradient' ? gradientAcross(ctx, o, bbox) : o.color
      ctx.fillText(ch, cx, cy)
      if (o.strokeWidth > 0) {
        ctx.strokeStyle = o.secondary
        ctx.lineWidth = o.strokeWidth
        ctx.lineJoin = 'round'
        ctx.strokeText(ch, cx, cy)
      }
    }
    if (o.drips) addTextDrips(ctx, ch, bbox.x, bbox.y, o)
    ctx.restore()
    return
  }

  // icon stamp — draw in a 100-unit box, scaled to s
  const unit = s / 100
  ctx.translate(cx - s / 2, cy - s / 2)
  ctx.scale(unit, unit)
  const kind = iconPath(ctx, o.stampValue)
  styleCurrentPath(ctx, o, unit, { x: 0, y: 0, w: 100, h: 100 })
  if (kind === 'detail') iconDetail(ctx, o.stampValue, o, 1)
  ctx.restore()
}

/** Small canvas preview used by the stamp picker buttons. */
export function renderStampPreview(canvas: HTMLCanvasElement, value: string, kind: 'letter' | 'icon'): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssSize = canvas.clientWidth || 34
  canvas.width = cssSize * dpr
  canvas.height = cssSize * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssSize, cssSize)
  const previewOptions: ToolOptions = {
    color: kind === 'letter' ? '#c8ff2e' : '#ff2d95',
    secondary: '#ffffff',
    fillMode: 'solid',
    strokeWidth: 2,
    opacity: 1,
    fontSize: cssSize,
    size: cssSize,
    fontWeight: 700,
    fontFamily: "'Permanent Marker', cursive",
    stampKind: kind,
    stampValue: value,
    drips: false,
  } as ToolOptions
  drawStamp(ctx, previewOptions, { x: 0, y: 0 }, { x: cssSize, y: 0 })
}
