import type { WallTexture } from '../types'
import { stamp, hexToRgb, rgbToHex } from './utils'

/** Procedurally generated wall surfaces so the art sits on something believable. */
export function makeTexture(kind: WallTexture, w: number, h: number): HTMLCanvasElement | null {
  if (kind === 'plain') return null
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  const rnd = stamp(kind === 'brick' ? 7717 : 4241)

  if (kind === 'concrete') {
    // base wash
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#b9b6b0')
    g.addColorStop(1, '#a5a29c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // blotches
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w
      const y = rnd() * h
      const r = 30 + rnd() * 160
      const dark = rnd() > 0.5
      const alpha = 0.02 + rnd() * 0.05
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, dark ? `rgba(60,58,54,${alpha})` : `rgba(255,255,255,${alpha})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // grain
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 22
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
  }

  if (kind === 'brick') {
    ctx.fillStyle = '#8d8578' // mortar
    ctx.fillRect(0, 0, w, h)
    const bw = 120
    const bh = 52
    const gap = 8
    for (let row = 0, y = 0; y < h; row++, y += bh + gap) {
      const offset = row % 2 === 0 ? 0 : (bw + gap) / 2
      for (let x = -offset; x < w; x += bw + gap) {
        const base: [number, number, number] = [148 + rnd() * 40, 62 + rnd() * 26, 48 + rnd() * 20]
        ctx.fillStyle = rgbToHex(base[0], base[1], base[2])
        ctx.fillRect(x, y, bw, bh)
        // weathering on the brick face
        const rg = ctx.createLinearGradient(x, y, x, y + bh)
        rg.addColorStop(0, 'rgba(255,255,255,0.10)')
        rg.addColorStop(1, 'rgba(0,0,0,0.18)')
        ctx.fillStyle = rg
        ctx.fillRect(x, y, bw, bh)
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`
          ctx.fillRect(x + rnd() * bw, y + rnd() * bh, 4 + rnd() * 18, 2 + rnd() * 6)
        }
      }
    }
    // grime pass
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 14
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    // dark wash toward the bottom (street grime)
    const wash = ctx.createLinearGradient(0, h * 0.5, 0, h)
    wash.addColorStop(0, 'rgba(0,0,0,0)')
    wash.addColorStop(1, 'rgba(20,18,16,0.25)')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
  }

  return cv
}
