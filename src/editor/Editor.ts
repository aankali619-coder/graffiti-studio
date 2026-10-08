import type { BlendMode, Layer, ToolId, ToolOptions, WallTexture } from '../types'
import { DEFAULT_OPTIONS } from '../types'
import { uid, loadImage } from './utils'
import { makeTexture } from './textures'

export type HistoryEntry =
  | { type: 'pixels'; layerId: string; before: string; after: string }
  | { type: 'structure'; before: string; after: string }

export interface SerializedLayer {
  id: string
  name: string
  visible: boolean
  opacity: number
  blend: BlendMode
  data: string
}

export interface ProjectFile {
  version: 1
  width: number
  height: number
  bg: string
  texture: WallTexture
  activeId: string
  layers: SerializedLayer[]
}

export const MAX_HISTORY = 25

export function createLayer(name: string, w: number, h: number): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { id: uid(), name, visible: true, opacity: 1, blend: 'source-over', canvas, ctx }
}

export class Editor {
  width = 1600
  height = 1000
  bg = '#ffffff'
  texture: WallTexture = 'concrete'
  textureCanvas: HTMLCanvasElement | null = null

  layers: Layer[] = []
  activeId = ''

  tool: ToolId = 'spray'
  options: ToolOptions = { ...DEFAULT_OPTIONS }

  view = { zoom: 1, x: 0, y: 0 }
  space = false

  /** scratch buffers sized to the document */
  strokeCanvas: HTMLCanvasElement
  strokeCtx: CanvasRenderingContext2D
  overlayCanvas: HTMLCanvasElement
  overlayCtx: CanvasRenderingContext2D

  private uiListeners = new Set<() => void>()
  private drawListeners = new Set<() => void>()
  private cursorListeners = new Set<() => void>()
  private version = 0
  private cursorVersion = 0
  private raf = 0

  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private pendingBefore: string | null = null

  cursor = { x: 0, y: 0, inside: false }

  constructor() {
    this.strokeCanvas = document.createElement('canvas')
    this.strokeCtx = this.strokeCanvas.getContext('2d')!
    this.overlayCanvas = document.createElement('canvas')
    this.overlayCtx = this.overlayCanvas.getContext('2d')!
    this.newProject(1600, 1000, '#ffffff', 'concrete')
  }

  // ---------- reactivity ----------
  subscribe = (fn: () => void) => {
    this.uiListeners.add(fn)
    return () => this.uiListeners.delete(fn)
  }
  getVersion = () => this.version
  emit() {
    this.version++
    this.uiListeners.forEach((fn) => fn())
  }

  subscribeDraw = (fn: () => void) => {
    this.drawListeners.add(fn)
    return () => this.drawListeners.delete(fn)
  }
  emitDraw() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.drawListeners.forEach((fn) => fn())
    })
  }

  subscribeCursor = (fn: () => void) => {
    this.cursorListeners.add(fn)
    return () => this.cursorListeners.delete(fn)
  }
  getCursorVersion = () => this.cursorVersion
  setCursor(x: number, y: number, inside: boolean) {
    const changed = x !== this.cursor.x || y !== this.cursor.y || inside !== this.cursor.inside
    this.cursor = { x, y, inside }
    if (changed) {
      this.cursorVersion++
      this.cursorListeners.forEach((fn) => fn())
    }
  }

  // ---------- project ----------
  newProject(w: number, h: number, bg: string, texture: WallTexture) {
    this.width = w
    this.height = h
    this.bg = bg
    this.texture = texture
    this.textureCanvas = makeTexture(texture, w, h)
    this.strokeCanvas.width = this.overlayCanvas.width = w
    this.strokeCanvas.height = this.overlayCanvas.height = h
    const base = createLayer('Background', w, h)
    const paint = createLayer('Layer 1', w, h)
    this.layers = [base, paint]
    this.activeId = paint.id
    this.undoStack = []
    this.redoStack = []
    this.pendingBefore = null
    this.fit()
    this.emit()
    this.emitDraw()
  }

  serialize(): ProjectFile {
    return {
      version: 1,
      width: this.width,
      height: this.height,
      bg: this.bg,
      texture: this.texture,
      activeId: this.activeId,
      layers: this.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blend: l.blend,
        data: l.canvas.toDataURL('image/png'),
      })),
    }
  }

  snapshot(): string {
    return JSON.stringify(this.serialize())
  }

  async load(json: string) {
    const p = JSON.parse(json) as ProjectFile
    if (!p || p.version !== 1) throw new Error('Not a Graffiti Studio project file')
    this.width = p.width
    this.height = p.height
    this.bg = p.bg
    this.texture = p.texture
    this.textureCanvas = makeTexture(p.texture, p.width, p.height)
    this.strokeCanvas.width = this.overlayCanvas.width = p.width
    this.strokeCanvas.height = this.overlayCanvas.height = p.height
    const layers: Layer[] = []
    for (const sl of p.layers) {
      const layer = createLayer(sl.name, p.width, p.height)
      layer.id = sl.id
      layer.visible = sl.visible
      layer.opacity = sl.opacity
      layer.blend = sl.blend
      try {
        const img = await loadImage(sl.data)
        layer.ctx.drawImage(img, 0, 0)
      } catch {
        /* empty layer */
      }
      layers.push(layer)
    }
    this.layers = layers.length ? layers : [createLayer('Layer 1', p.width, p.height)]
    this.activeId = this.layers.some((l) => l.id === p.activeId)
      ? p.activeId
      : this.layers[this.layers.length - 1].id
    this.undoStack = []
    this.redoStack = []
    this.fit()
    this.emit()
    this.emitDraw()
  }

  // ---------- layers ----------
  activeLayer(): Layer | undefined {
    return this.layers.find((l) => l.id === this.activeId)
  }

  private structureOp(fn: () => void) {
    const before = this.snapshot()
    fn()
    const after = this.snapshot()
    this.pushHistory({ type: 'structure', before, after })
  }

  addLayer() {
    this.structureOp(() => {
      const layer = createLayer(`Layer ${this.layers.length + 1}`, this.width, this.height)
      const idx = this.layers.findIndex((l) => l.id === this.activeId)
      this.layers.splice(idx + 1, 0, layer)
      this.activeId = layer.id
    })
    this.emit()
    this.emitDraw()
  }

  deleteLayer(id: string) {
    if (this.layers.length <= 1) return
    this.structureOp(() => {
      const idx = this.layers.findIndex((l) => l.id === id)
      if (idx === -1) return
      this.layers.splice(idx, 1)
      if (this.activeId === id) {
        const next = this.layers[Math.max(0, idx - 1)]
        this.activeId = next.id
      }
    })
    this.emit()
    this.emitDraw()
  }

  duplicateLayer(id: string) {
    const src = this.layers.find((l) => l.id === id)
    if (!src) return
    this.structureOp(() => {
      const copy = createLayer(`${src.name} copy`, this.width, this.height)
      copy.ctx.drawImage(src.canvas, 0, 0)
      copy.opacity = src.opacity
      copy.blend = src.blend
      const idx = this.layers.indexOf(src)
      this.layers.splice(idx + 1, 0, copy)
      this.activeId = copy.id
    })
    this.emit()
    this.emitDraw()
  }

  moveLayer(id: string, dir: -1 | 1) {
    const idx = this.layers.findIndex((l) => l.id === id)
    const to = idx + dir
    if (idx === -1 || to < 0 || to >= this.layers.length) return
    this.structureOp(() => {
      const [l] = this.layers.splice(idx, 1)
      this.layers.splice(to, 0, l)
    })
    this.emit()
    this.emitDraw()
  }

  mergeDown(id: string) {
    const idx = this.layers.findIndex((l) => l.id === id)
    if (idx <= 0) return
    const upper = this.layers[idx]
    const lower = this.layers[idx - 1]
    this.structureOp(() => {
      lower.ctx.save()
      lower.ctx.globalAlpha = upper.opacity
      lower.ctx.globalCompositeOperation = upper.blend as GlobalCompositeOperation
      lower.ctx.drawImage(upper.canvas, 0, 0)
      lower.ctx.restore()
      this.layers.splice(idx, 1)
      this.activeId = lower.id
    })
    this.emit()
    this.emitDraw()
  }

  clearLayer(id: string) {
    const layer = this.layers.find((l) => l.id === id)
    if (!layer) return
    this.beginPixels(layer)
    layer.ctx.clearRect(0, 0, this.width, this.height)
    this.endPixels()
    this.emit()
    this.emitDraw()
  }

  setLayer(id: string, patch: Partial<Pick<Layer, 'name' | 'visible' | 'opacity' | 'blend'>>) {
    const layer = this.layers.find((l) => l.id === id)
    if (!layer) return
    Object.assign(layer, patch)
    this.emit()
    this.emitDraw()
  }

  setActive(id: string) {
    this.activeId = id
    this.emit()
  }

  // ---------- history ----------
  private pushHistory(entry: HistoryEntry) {
    this.undoStack.push(entry)
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
    this.redoStack = []
  }

  /** Call before mutating pixels of a layer. */
  beginPixels(layer?: Layer) {
    const l = layer ?? this.activeLayer()
    if (!l) return
    this.pendingBefore = l.canvas.toDataURL('image/png')
  }

  /** Call after mutating pixels; records undo entry if anything changed. */
  endPixels() {
    const l = this.activeLayer()
    if (!l || !this.pendingBefore) return
    const after = l.canvas.toDataURL('image/png')
    if (after !== this.pendingBefore) {
      this.pushHistory({ type: 'pixels', layerId: l.id, before: this.pendingBefore, after })
    }
    this.pendingBefore = null
  }

  async undo() {
    const e = this.undoStack.pop()
    if (!e) return
    this.redoStack.push(e)
    if (e.type === 'pixels') {
      const layer = this.layers.find((l) => l.id === e.layerId)
      if (layer) {
        const img = await loadImage(e.before)
        layer.ctx.clearRect(0, 0, this.width, this.height)
        layer.ctx.drawImage(img, 0, 0)
      }
    } else {
      await this.applySnapshot(e.before)
    }
    this.emit()
    this.emitDraw()
  }

  async redo() {
    const e = this.redoStack.pop()
    if (!e) return
    this.undoStack.push(e)
    if (e.type === 'pixels') {
      const layer = this.layers.find((l) => l.id === e.layerId)
      if (layer) {
        const img = await loadImage(e.after)
        layer.ctx.clearRect(0, 0, this.width, this.height)
        layer.ctx.drawImage(img, 0, 0)
      }
    } else {
      await this.applySnapshot(e.after)
    }
    this.emit()
    this.emitDraw()
  }

  private async applySnapshot(json: string) {
    const p = JSON.parse(json) as ProjectFile
    const layers: Layer[] = []
    for (const sl of p.layers) {
      const layer = createLayer(sl.name, p.width, p.height)
      layer.id = sl.id
      layer.visible = sl.visible
      layer.opacity = sl.opacity
      layer.blend = sl.blend
      try {
        const img = await loadImage(sl.data)
        layer.ctx.drawImage(img, 0, 0)
      } catch {
        /* empty */
      }
      layers.push(layer)
    }
    this.layers = layers
    this.activeId = layers.some((l) => l.id === p.activeId) ? p.activeId : layers[layers.length - 1].id
  }

  // ---------- view ----------
  screenToDoc(sx: number, sy: number) {
    return { x: (sx - this.view.x) / this.view.zoom, y: (sy - this.view.y) / this.view.zoom }
  }
  docToScreen(dx: number, dy: number) {
    return { x: dx * this.view.zoom + this.view.x, y: dy * this.view.zoom + this.view.y }
  }

  zoomAt(factor: number, sx: number, sy: number) {
    const z0 = this.view.zoom
    const z1 = Math.min(16, Math.max(0.05, z0 * factor))
    if (z1 === z0) return
    const doc = this.screenToDoc(sx, sy)
    this.view.zoom = z1
    this.view.x = sx - doc.x * z1
    this.view.y = sy - doc.y * z1
    this.emit()
    this.emitDraw()
  }

  fit(vw = 800, vh = 600) {
    const pad = 48
    const z = Math.min((vw - pad) / this.width, (vh - pad) / this.height, 1)
    this.view.zoom = Math.max(0.05, z)
    this.view.x = (vw - this.width * this.view.zoom) / 2
    this.view.y = (vh - this.height * this.view.zoom) / 2
    this.emit()
    this.emitDraw()
  }

  panBy(dx: number, dy: number) {
    this.view.x += dx
    this.view.y += dy
    this.emitDraw()
  }

  // ---------- composite / export ----------
  composite(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = this.width
    cv.height = this.height
    const ctx = cv.getContext('2d')!
    if (this.bg !== 'transparent') {
      ctx.fillStyle = this.bg
      ctx.fillRect(0, 0, this.width, this.height)
      if (this.textureCanvas) ctx.drawImage(this.textureCanvas, 0, 0)
    }
    for (const l of this.layers) {
      if (!l.visible) continue
      ctx.globalAlpha = l.opacity
      ctx.globalCompositeOperation = l.blend as GlobalCompositeOperation
      ctx.drawImage(l.canvas, 0, 0)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return cv
  }

  setTexture(t: WallTexture) {
    this.texture = t
    this.textureCanvas = makeTexture(t, this.width, this.height)
    this.emit()
    this.emitDraw()
  }

  setTool(tool: ToolId) {
    this.tool = tool
    this.emit()
  }

  setOptions(patch: Partial<ToolOptions>) {
    Object.assign(this.options, patch)
    this.emit()
  }
}
