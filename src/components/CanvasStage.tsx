import { useEffect, useRef, useState } from 'react'
import type { Editor } from '../editor/Editor'
import type { ToolId } from '../types'
import { createTools, commitText, type PointerInfo, type ToolHandlers } from '../tools/tools'

interface TextPos {
  x: number
  y: number
  sx: number
  sy: number
}

export function CanvasStage({ ed }: { ed: Editor }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const sizeRef = useRef({ w: 800, h: 600 })
  const toolsRef = useRef<Record<ToolId, ToolHandlers> | null>(null)
  const panning = useRef<{ x: number; y: number } | null>(null)
  const drawing = useRef(false)
  const textPosRef = useRef<TextPos | null>(null)
  const [textPos, setTextPosState] = useState<TextPos | null>(null)

  if (!toolsRef.current) toolsRef.current = createTools(ed)

  const setTextPos = (p: TextPos | null) => {
    textPosRef.current = p
    setTextPosState(p)
  }

  // ---------- rendering ----------
  const draw = () => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { w, h } = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    const pw = Math.max(1, Math.round(w * dpr))
    const ph = Math.max(1, Math.round(h * dpr))
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw
      cv.height = ph
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // studio backdrop
    ctx.fillStyle = '#131317'
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(ed.view.x, ed.view.y)
    ctx.scale(ed.view.zoom, ed.view.zoom)

    // drop shadow + document surface
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 28 / ed.view.zoom
    ctx.shadowOffsetY = 8 / ed.view.zoom
    ctx.fillStyle = ed.bg === 'transparent' ? '#26262c' : ed.bg
    ctx.fillRect(0, 0, ed.width, ed.height)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, ed.width, ed.height)
    ctx.clip()

    if (ed.textureCanvas) ctx.drawImage(ed.textureCanvas, 0, 0)
    for (const layer of ed.layers) {
      if (!layer.visible) continue
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = layer.blend
      ctx.drawImage(layer.canvas, 0, 0)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(ed.overlayCanvas, 0, 0)
    ctx.restore()

    // symmetry guides
    if (ed.options.symmetryX || ed.options.symmetryY) {
      ctx.strokeStyle = 'rgba(255,45,149,0.55)'
      ctx.lineWidth = 1 / ed.view.zoom
      ctx.setLineDash([8 / ed.view.zoom, 6 / ed.view.zoom])
      ctx.beginPath()
      if (ed.options.symmetryX) {
        ctx.moveTo(ed.width / 2, 0)
        ctx.lineTo(ed.width / 2, ed.height)
      }
      if (ed.options.symmetryY) {
        ctx.moveTo(0, ed.height / 2)
        ctx.lineTo(ed.width, ed.height / 2)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.restore()
  }

  // subscribe to canvas repaint requests
  useEffect(() => {
    const unsub = ed.subscribeDraw(draw)
    return () => {
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed])

  // observe size + initial fit
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let fitted = false
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
      if (!fitted && r.width > 0) {
        fitted = true
        ed.fit(r.width, r.height)
      }
      draw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed])

  // redraw whenever React re-renders (tool/options changes etc.)
  useEffect(draw)

  // wheel zoom / pan (non-passive so we can preventDefault)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (e.shiftKey) {
        ed.panBy(-e.deltaY, 0)
        ed.emit()
        return
      }
      ed.zoomAt(Math.exp(-e.deltaY * 0.0016), sx, sy)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    return () => wrap.removeEventListener('wheel', onWheel)
  }, [ed])

  // brush-size cursor follower
  useEffect(() => {
    const unsub = ed.subscribeCursor(() => {
      const el = cursorRef.current
      if (!el) return
      const c = ed.cursor
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect || !c.inside) {
        el.style.display = 'none'
        return
      }
      const { x, y } = ed.docToScreen(c.x, c.y)
      el.style.display = 'block'
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    })
    return () => {
      unsub()
    }
  }, [ed])

  // focus the text box when placed
  useEffect(() => {
    if (textPos && textAreaRef.current) textAreaRef.current.focus()
  }, [textPos])

  // ---------- pointer input ----------
  const infoFrom = (e: React.PointerEvent): PointerInfo => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const d = ed.screenToDoc(e.clientX - rect.left, e.clientY - rect.top)
    return { x: d.x, y: d.y, shift: e.shiftKey, alt: e.altKey }
  }

  const isPanGesture = (e: React.PointerEvent) => e.button === 1 || ed.space || ed.tool === 'hand'

  const onPointerDown = (e: React.PointerEvent) => {
    if (textPosRef.current) {
      // finish any pending text first
      commitText(ed, textPosRef.current.x, textPosRef.current.y)
      setTextPos(null)
    }
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic or already-released pointer */
    }
    const p = infoFrom(e)
    ed.setCursor(p.x, p.y, true)
    if (isPanGesture(e)) {
      panning.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (ed.tool === 'text') {
      const rect = canvasRef.current!.getBoundingClientRect()
      setTextPos({ x: p.x, y: p.y, sx: e.clientX - rect.left, sy: e.clientY - rect.top })
      return
    }
    drawing.current = true
    toolsRef.current![ed.tool].down(p)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = infoFrom(e)
    ed.setCursor(p.x, p.y, true)
    if (panning.current) {
      ed.panBy(e.clientX - panning.current.x, e.clientY - panning.current.y)
      panning.current = { x: e.clientX, y: e.clientY }
      ed.emit()
      return
    }
    if (drawing.current) toolsRef.current![ed.tool].move(p)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (panning.current) {
      panning.current = null
      return
    }
    if (drawing.current) {
      drawing.current = false
      toolsRef.current![ed.tool].up(infoFrom(e))
    }
  }

  const onPointerLeave = () => {
    ed.setCursor(ed.cursor.x, ed.cursor.y, false)
  }

  const commitTextNow = () => {
    const pos = textPosRef.current
    setTextPos(null)
    if (pos) commitText(ed, pos.x, pos.y)
  }

  const o = ed.options
  const cursorVisible = ed.tool !== 'hand' && ed.tool !== 'text' && ed.tool !== 'eyedropper'
  const cursorSize = Math.max(4, o.size * ed.view.zoom)

  return (
    <div className="stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={`stage-canvas tool-${cursorVisible ? 'paint' : ed.tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={cursorRef}
        className="paint-cursor"
        style={{ width: cursorSize, height: cursorSize, display: 'none' }}
      />
      {textPos && (
        <textarea
          ref={textAreaRef}
          className="text-overlay"
          value={o.textValue}
          spellCheck={false}
          onChange={(e) => ed.setOptions({ textValue: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitTextNow()
            } else if (e.key === 'Escape') {
              setTextPos(null)
            }
          }}
          onBlur={commitTextNow}
          style={{
            left: textPos.sx,
            top: textPos.sy,
            fontSize: o.fontSize * ed.view.zoom,
            fontFamily: o.fontFamily,
            fontWeight: o.fontWeight,
            lineHeight: 1.18,
            color: o.color,
          }}
        />
      )}
    </div>
  )
}
