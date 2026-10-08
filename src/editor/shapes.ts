import type { ToolId, ToolOptions } from '../types'

export interface Pt {
  x: number
  y: number
}

/** Normalise start/end into a rect, honouring shift (square/circle) and alt (from centre). */
function normRect(a: Pt, b: Pt, shift: boolean, alt: boolean, square: boolean) {
  let ex = b.x
  let ey = b.y
  if (shift && square) {
    const dx = ex - a.x
    const dy = ey - a.y
    const m = Math.max(Math.abs(dx), Math.abs(dy))
    ex = a.x + Math.sign(dx || 1) * m
    ey = a.y + Math.sign(dy || 1) * m
  }
  if (alt) {
    return { cx: a.x, cy: a.y, w: (ex - a.x) * 2, h: (ey - a.y) * 2 }
  }
  return { cx: (a.x + ex) / 2, cy: (a.y + ey) / 2, w: ex - a.x, h: ey - a.y }
}

function snap45(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ang = Math.atan2(dy, dx)
  const step = Math.PI / 4
  const snapped = Math.round(ang / step) * step
  const len = Math.hypot(dx, dy)
  return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len }
}

function shapeGradient(ctx: CanvasRenderingContext2D, o: ToolOptions, r: { cx: number; cy: number; w: number; h: number }) {
  const x0 = r.cx - r.w / 2
  const y0 = r.cy - r.h / 2
  if (o.gradientType === 'radial') {
    const g = ctx.createRadialGradient(r.cx, r.cy, 0, r.cx, r.cy, Math.max(Math.abs(r.w), Math.abs(r.h)) / 2 || 1)
    g.addColorStop(0, o.color)
    g.addColorStop(1, o.secondary)
    return g
  }
  const g = ctx.createLinearGradient(x0, y0, x0 + r.w, y0 + r.h)
  g.addColorStop(0, o.color)
  g.addColorStop(1, o.secondary)
  return g
}

function polygonPath(ctx: CanvasRenderingContext2D, r: { cx: number; cy: number; w: number; h: number }, sides: number) {
  const rx = Math.abs(r.w) / 2
  const ry = Math.abs(r.h) / 2
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / sides
    const x = r.cx + Math.cos(a) * rx
    const y = r.cy + Math.sin(a) * ry
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function starPath(ctx: CanvasRenderingContext2D, r: { cx: number; cy: number; w: number; h: number }, points: number, inner: number) {
  const rx = Math.abs(r.w) / 2
  const ry = Math.abs(r.h) / 2
  const n = points * 2
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const k = i % 2 === 0 ? 1 : inner
    const x = r.cx + Math.cos(a) * rx * k
    const y = r.cy + Math.sin(a) * ry * k
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export function arrowHead(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, width: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  const head = Math.max(width * 3, 12)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - Math.cos(ang - 0.42) * head, to.y - Math.sin(ang - 0.42) * head)
  ctx.lineTo(to.x - Math.cos(ang + 0.42) * head, to.y - Math.sin(ang + 0.42) * head)
  ctx.closePath()
  ctx.fill()
}

/** Draws any shape-tool primitive into ctx. Used for both live preview and final commit. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: ToolId,
  a: Pt,
  b: Pt,
  o: ToolOptions,
  shift: boolean,
  alt: boolean,
): void {
  const rectTool = tool === 'rect' || tool === 'polygon' || tool === 'star'
  const r = normRect(a, b, shift, alt, rectTool || tool === 'ellipse')
  const from = shift && (tool === 'line' || tool === 'arrow') ? snap45(a, b) : b

  ctx.save()
  ctx.globalAlpha = o.opacity
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (tool === 'line' || tool === 'arrow') {
    ctx.strokeStyle = o.color
    ctx.lineWidth = Math.max(1, o.strokeWidth)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(from.x, from.y)
    ctx.stroke()
    if (tool === 'arrow') {
      ctx.fillStyle = o.color
      arrowHead(ctx, a, from, o.strokeWidth)
    }
    ctx.restore()
    return
  }

  ctx.beginPath()
  if (tool === 'rect') {
    ctx.rect(r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h)
  } else if (tool === 'ellipse') {
    ctx.ellipse(r.cx, r.cy, Math.abs(r.w) / 2, Math.abs(r.h) / 2, 0, 0, Math.PI * 2)
  } else if (tool === 'polygon') {
    polygonPath(ctx, r, o.sides)
  } else if (tool === 'star') {
    starPath(ctx, r, o.points, o.innerRatio)
  }
  ctx.closePath()

  if (o.fillMode === 'solid') {
    ctx.fillStyle = o.color
    ctx.fill()
  } else if (o.fillMode === 'gradient') {
    ctx.fillStyle = shapeGradient(ctx, o, r)
    ctx.fill()
  }

  const strokeW = o.fillMode === 'none' ? Math.max(1, o.strokeWidth) : o.strokeWidth
  if (strokeW > 0) {
    ctx.strokeStyle = o.fillMode === 'none' ? o.color : o.secondary
    ctx.lineWidth = strokeW
    ctx.stroke()
  }
  ctx.restore()
}
