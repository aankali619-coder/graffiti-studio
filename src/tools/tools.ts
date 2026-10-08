import type { Editor } from '../editor/Editor'
import type { ToolId, ToolOptions } from '../types'
import { clamp, hexToRgb, hexToRgba, shade } from '../editor/utils'
import { floodFill, blurRegion } from '../editor/floodFill'
import { drawShape, type Pt } from '../editor/shapes'

export interface PointerInfo {
  x: number
  y: number
  shift: boolean
  alt: boolean
}

export interface ToolHandlers {
  down(p: PointerInfo): void
  move(p: PointerInfo): void
  up(p: PointerInfo): void
}

// module-level editor reference (set once by createTools)
let editorRef: Editor | null = null

// ---------- helpers ----------

/** Iterates points along a path with fixed spacing; calls fn for each step. */
function walk(from: Pt | null, to: Pt, spacing: number, fn: (p: Pt, prev: Pt | null) => void) {
  if (!from) {
    fn(to, null)
    return
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const steps = Math.max(1, Math.ceil(dist / spacing))
  for (let i = 1; i <= steps; i++) {
    fn({ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps }, from)
  }
}

/** Symmetry mirror points for a document point. */
function targets(p: Pt): Pt[] {
  const ed = editorRef!
  const o = ed.options
  const pts: Pt[] = [p]
  if (o.symmetryX) pts.push({ x: ed.width - p.x, y: p.y })
  if (o.symmetryY) pts.push({ x: p.x, y: ed.height - p.y })
  if (o.symmetryX && o.symmetryY) pts.push({ x: ed.width - p.x, y: ed.height - p.y })
  return pts
}

function brushStamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, hardness: number) {
  if (hardness >= 0.98 || r <= 1) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.7, r), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const inner = Math.max(0.001, r * hardness)
  const g = ctx.createRadialGradient(x, y, inner, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, hexToRgba(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function snap45(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const len = Math.hypot(dx, dy)
  return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len }
}

// ---------- graffiti stampers ----------

function sprayStamp(ctx: CanvasRenderingContext2D, p: Pt, o: ToolOptions) {
  const radius = Math.max(1, o.size / 2)
  const dotAlpha = clamp(o.flow * 0.32, 0.02, 1)
  const count = Math.max(10, Math.round(radius * 1.1))
  ctx.fillStyle = hexToRgba(o.color, dotAlpha)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    // dense core with sparse overspray tail
    const g = (Math.random() + Math.random() + Math.random()) / 3
    const r = g * radius * (1 + o.spread * 0.9)
    const s = Math.random() < 0.15 ? 2 : 1
    ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, s, s)
  }
}

function splatterStamp(ctx: CanvasRenderingContext2D, p: Pt, o: ToolOptions) {
  const base = Math.max(1, o.size / 2)
  ctx.fillStyle = o.color
  const blobs = 3 + Math.floor(Math.random() * 6)
  for (let i = 0; i < blobs; i++) {
    const a = Math.random() * Math.PI * 2
    const d = Math.pow(Math.random(), 1.6) * base * (1 + o.spread)
    const r = Math.max(0.5, base * (0.08 + Math.random() * 0.42))
    ctx.beginPath()
    ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, 0, Math.PI * 2)
    ctx.fill()
  }
  if (Math.random() < 0.12) {
    const a = Math.random() * Math.PI * 2
    const len = base * (1 + Math.random() * 2.5)
    ctx.strokeStyle = o.color
    ctx.lineWidth = Math.max(1, base * 0.12)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len)
    ctx.stroke()
  }
}

function chiselStamp(ctx: CanvasRenderingContext2D, p: Pt, o: ToolOptions) {
  const r = Math.max(1, o.size / 2)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(-Math.PI / 4)
  ctx.scale(1, 0.28)
  ctx.fillStyle = o.color
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function speedTaper(prev: Pt, p: Pt): number {
  const speed = Math.hypot(p.x - prev.x, p.y - prev.y)
  return clamp(1.25 - speed / 26, 0.35, 1)
}

function markerStamp(ctx: CanvasRenderingContext2D, p: Pt, prev: Pt | null, o: ToolOptions) {
  ctx.strokeStyle = o.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, o.size * (prev ? speedTaper(prev, p) : 1))
  ctx.beginPath()
  if (prev) ctx.moveTo(prev.x, prev.y)
  else ctx.moveTo(p.x - 0.01, p.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
}

function roundBrushStamp(ctx: CanvasRenderingContext2D, p: Pt, o: ToolOptions) {
  brushStamp(ctx, p.x, p.y, Math.max(0.75, o.size / 2), o.color, o.hardness)
}

function eraserStamp(ctx: CanvasRenderingContext2D, p: Pt, o: ToolOptions) {
  brushStamp(ctx, p.x, p.y, Math.max(0.75, o.size / 2), '#000000', o.hardness)
}

// ---------- generic stroke tool (scratch buffer + single composite) ----------

function strokeTool(cfg: {
  stamp: (ctx: CanvasRenderingContext2D, p: Pt, prev: Pt | null, o: ToolOptions) => void
  spacing?: (o: ToolOptions) => number
  hold?: boolean // keeps stamping while the pointer rests (spray can behaviour)
  erase?: boolean // composite the stroke buffer as destination-out instead of paint
}): ToolHandlers {
  let down = false
  let last: Pt | null = null
  let timer: number | null = null
  const ed = () => editorRef!

  const step = (prev: Pt | null, cur: Pt) => {
    const e = ed()
    const o = e.options
    const sp = cfg.spacing ? cfg.spacing(o) : Math.max(1, o.size * 0.18)
    walk(prev, cur, sp, (p, pv) => {
      for (const t of targets(p)) {
        // segment continuity is meaningless across mirrored points
        const pvUse = pv && t === p ? pv : null
        cfg.stamp(e.strokeCtx, t, pvUse, o)
      }
    })
  }

  return {
    down(p) {
      down = true
      last = p
      ed().beginPixels()
      step(null, p)
      if (cfg.hold) {
        timer = window.setInterval(() => {
          if (down && last) step(null, last)
          ed().emitDraw()
        }, 24)
      }
      ed().emitDraw()
    },
    move(p) {
      if (!down) return
      const target = p.shift && last ? snap45(last, p) : p
      step(last, target)
      last = p
      ed().emitDraw()
    },
    up() {
      if (!down) return
      down = false
      last = null
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      const e = ed()
      const layer = e.activeLayer()
      if (layer) {
        layer.ctx.save()
        layer.ctx.globalAlpha = e.options.opacity
        layer.ctx.globalCompositeOperation = cfg.erase ? 'destination-out' : 'source-over'
        layer.ctx.drawImage(e.strokeCanvas, 0, 0)
        layer.ctx.restore()
        e.endPixels()
      }
      e.strokeCtx.clearRect(0, 0, e.width, e.height)
      e.emit()
      e.emitDraw()
    },
  }
}

// ---------- drip tool ----------

function drawDrip(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, o: ToolOptions) {
  const w = Math.max(2, o.size)
  // drips run downward; horizontal drift follows the drag
  const end: Pt = { x: a.x + (b.x - a.x) * 0.35, y: Math.max(a.y + 6, b.y) }
  const len = end.y - a.y
  if (len < 4) return
  ctx.save()
  ctx.globalAlpha = o.opacity
  ctx.fillStyle = o.color
  const steps = Math.max(6, Math.round(len / 4))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = w * 0.5 * (0.42 - 0.2 * t)
    ctx.beginPath()
    ctx.arc(a.x + (end.x - a.x) * t, a.y + len * t, Math.max(0.6, r), 0, Math.PI * 2)
    ctx.fill()
  }
  // bulb at the falling tip
  ctx.beginPath()
  ctx.arc(end.x, end.y, w * 0.5 * 0.46, 0, Math.PI * 2)
  ctx.fill()
  // paint pool where the drip starts
  ctx.beginPath()
  ctx.arc(a.x, a.y, w * 0.5 * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function dripTool(): ToolHandlers {
  let down = false
  let start: Pt = { x: 0, y: 0 }
  return {
    down(p) {
      down = true
      start = p
      editorRef!.beginPixels()
    },
    move(p) {
      const ed = editorRef!
      if (!down) return
      ed.overlayCtx.clearRect(0, 0, ed.width, ed.height)
      drawDrip(ed.overlayCtx, start, p, ed.options)
      ed.emitDraw()
    },
    up(p) {
      const ed = editorRef!
      if (!down) return
      down = false
      ed.overlayCtx.clearRect(0, 0, ed.width, ed.height)
      const layer = ed.activeLayer()
      if (layer) {
        drawDrip(layer.ctx, start, p, ed.options)
        ed.endPixels()
      }
      ed.emit()
      ed.emitDraw()
    },
  }
}

// ---------- shape tools (live preview + commit) ----------

function shapeTool(id: ToolId): ToolHandlers {
  let down = false
  let start: Pt = { x: 0, y: 0 }
  return {
    down(p) {
      down = true
      start = p
      editorRef!.beginPixels()
    },
    move(p) {
      const ed = editorRef!
      if (!down) return
      ed.overlayCtx.clearRect(0, 0, ed.width, ed.height)
      drawShape(ed.overlayCtx, id, start, p, ed.options, p.shift, p.alt)
      ed.emitDraw()
    },
    up(p) {
      const ed = editorRef!
      if (!down) return
      down = false
      ed.overlayCtx.clearRect(0, 0, ed.width, ed.height)
      const layer = ed.activeLayer()
      if (layer) {
        drawShape(layer.ctx, id, start, p, ed.options, p.shift, p.alt)
        ed.endPixels()
      }
      ed.emit()
      ed.emitDraw()
    },
  }
}

// ---------- gradient ----------

function makeGradient(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, o: ToolOptions) {
  if (o.gradientType === 'radial') {
    const r = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r)
    g.addColorStop(0, o.color)
    g.addColorStop(1, o.secondary)
    return g
  }
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
  g.addColorStop(0, o.color)
  g.addColorStop(1, o.secondary)
  return g
}

function gradientTool(): ToolHandlers {
  let down = false
  let start: Pt = { x: 0, y: 0 }
  return {
    down(p) {
      down = true
      start = p
      editorRef!.beginPixels()
    },
    move(p) {
      const ed = editorRef!
      if (!down) return
      const ctx = ed.overlayCtx
      ctx.clearRect(0, 0, ed.width, ed.height)
      ctx.save()
      ctx.globalAlpha = ed.options.opacity * 0.85
      ctx.fillStyle = makeGradient(ctx, start, p, ed.options)
      ctx.fillRect(0, 0, ed.width, ed.height)
      ctx.restore()
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 2 / ed.view.zoom
      ctx.setLineDash([8 / ed.view.zoom, 6 / ed.view.zoom])
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.setLineDash([])
      ed.emitDraw()
    },
    up(p) {
      const ed = editorRef!
      if (!down) return
      down = false
      ed.overlayCtx.clearRect(0, 0, ed.width, ed.height)
      const layer = ed.activeLayer()
      if (layer) {
        layer.ctx.save()
        layer.ctx.globalAlpha = ed.options.opacity
        layer.ctx.fillStyle = makeGradient(layer.ctx, start, p, ed.options)
        layer.ctx.fillRect(0, 0, ed.width, ed.height)
        layer.ctx.restore()
        ed.endPixels()
      }
      ed.emit()
      ed.emitDraw()
    },
  }
}

// ---------- fill / eyedropper / blur / hand ----------

function fillTool(): ToolHandlers {
  const apply = (p: PointerInfo) => {
    const ed = editorRef!
    const layer = ed.activeLayer()
    if (!layer) return
    ed.beginPixels(layer)
    const alpha = Math.round(clamp(ed.options.opacity, 0, 1) * 255)
    const [r, g, b] = hexToRgb(ed.options.color)
    floodFill(layer.ctx, p.x, p.y, [r, g, b, alpha], ed.options.tolerance)
    ed.endPixels()
    ed.emit()
    ed.emitDraw()
  }
  return { down: apply, move() {}, up() {} }
}

function eyedropperTool(): ToolHandlers {
  const pick = (p: PointerInfo) => {
    const ed = editorRef!
    const cv = ed.composite()
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    const x = clamp(Math.floor(p.x), 0, ed.width - 1)
    const y = clamp(Math.floor(p.y), 0, ed.height - 1)
    const d = ctx.getImageData(x, y, 1, 1).data
    if (d[3] === 0) return
    const hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    ed.setOptions({ color: hex })
  }
  return { down: pick, move() {}, up() {} }
}

function blurTool(): ToolHandlers {
  let down = false
  const blurAt = (p: PointerInfo) => {
    const ed = editorRef!
    const layer = ed.activeLayer()
    if (!layer) return
    blurRegion(layer.ctx, p.x, p.y, Math.max(2, ed.options.size / 2))
    ed.emitDraw()
  }
  return {
    down(p) {
      down = true
      editorRef!.beginPixels()
      blurAt(p)
    },
    move(p) {
      if (down) blurAt(p)
    },
    up() {
      if (!down) return
      down = false
      editorRef!.endPixels()
      editorRef!.emit()
    },
  }
}

const noopTool: ToolHandlers = { down() {}, move() {}, up() {} }

// ---------- text commit (invoked by the DOM overlay in CanvasStage) ----------

export function commitText(ed: Editor, x: number, y: number) {
  const o = ed.options
  const layer = ed.activeLayer()
  const text = o.textValue
  if (!layer || !text.trim()) return
  ed.beginPixels(layer)
  const ctx = layer.ctx
  ctx.save()
  ctx.globalAlpha = o.opacity
  ctx.font = `${o.fontWeight} ${o.fontSize}px ${o.fontFamily}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  const lines = text.split('\n')
  const lineH = o.fontSize * 1.18
  lines.forEach((line, i) => {
    const ly = y + i * lineH
    if (o.glow) {
      ctx.shadowColor = o.color
      ctx.shadowBlur = o.fontSize * 0.45
      ctx.fillStyle = o.color
      ctx.fillText(line, x, ly)
      ctx.shadowBlur = 0
    }
    if (o.shadowOffset > 0) {
      ctx.fillStyle = shade(o.secondary, -0.35)
      ctx.fillText(line, x + o.shadowOffset, ly + o.shadowOffset)
    }
    if (o.outlineWidth > 0) {
      ctx.strokeStyle = o.secondary
      ctx.lineWidth = o.outlineWidth * 2
      ctx.strokeText(line, x, ly)
    }
    ctx.fillStyle = o.color
    ctx.fillText(line, x, ly)
    if (o.drips) addTextDrips(ctx, line, x, ly, o)
  })
  ctx.restore()
  ed.endPixels()
  ed.emit()
  ed.emitDraw()
}

function addTextDrips(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, o: ToolOptions) {
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

// ---------- registry ----------

export function createTools(ed: Editor): Record<ToolId, ToolHandlers> {
  editorRef = ed
  const sizeSpacing = (o: ToolOptions) => Math.max(1, o.size * 0.18)
  return {
    spray: strokeTool({ stamp: (ctx, p, _prev, o) => sprayStamp(ctx, p, o), spacing: () => 2, hold: true }),
    marker: strokeTool({ stamp: markerStamp, spacing: sizeSpacing }),
    chisel: strokeTool({ stamp: (ctx, p, _prev, o) => chiselStamp(ctx, p, o), spacing: (o) => Math.max(1, o.size * 0.1) }),
    brush: strokeTool({ stamp: (ctx, p, _prev, o) => roundBrushStamp(ctx, p, o), spacing: sizeSpacing }),
    splatter: strokeTool({ stamp: (ctx, p, _prev, o) => splatterStamp(ctx, p, o), spacing: (o) => Math.max(6, o.size * 0.7) }),
    drip: dripTool(),
    eraser: strokeTool({ stamp: (ctx, p, _prev, o) => eraserStamp(ctx, p, o), spacing: sizeSpacing, erase: true }),
    line: shapeTool('line'),
    arrow: shapeTool('arrow'),
    rect: shapeTool('rect'),
    ellipse: shapeTool('ellipse'),
    polygon: shapeTool('polygon'),
    star: shapeTool('star'),
    text: noopTool, // handled by the DOM overlay in CanvasStage
    fill: fillTool(),
    gradient: gradientTool(),
    eyedropper: eyedropperTool(),
    blur: blurTool(),
    hand: noopTool, // pan is handled directly by CanvasStage
  }
}
