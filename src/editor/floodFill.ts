import { clamp } from './utils'

/** Scanline flood fill inside a single layer's ImageData. */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rgba: [number, number, number, number],
  tolerance: number,
): boolean {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const px = clamp(Math.floor(x), 0, w - 1)
  const py = clamp(Math.floor(y), 0, h - 1)

  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const idx = (px: number, py: number) => (py * w + px) * 4

  const start = idx(px, py)
  const tr = data[start]
  const tg = data[start + 1]
  const tb = data[start + 2]
  const ta = data[start + 3]

  // already the target colour (within tolerance) and fully opaque match
  const tol = tolerance * tolerance * 3
  const diff0 =
    (tr - rgba[0]) ** 2 + (tg - rgba[1]) ** 2 + (tb - rgba[2]) ** 2 + (ta - rgba[3]) ** 2
  if (diff0 <= tol) return false

  const match = (i: number) => {
    const dr = data[i] - tr
    const dg = data[i + 1] - tg
    const db = data[i + 2] - tb
    const da = data[i + 3] - ta
    return dr * dr + dg * dg + db * db + da * da <= tol
  }

  const stack: number[] = [px, py]
  while (stack.length) {
    const cy = stack.pop()!
    const cx = stack.pop()!
    let x1 = cx
    let x2 = cx
    const row = cy * w
    while (x1 >= 0 && match((row + x1) * 4)) x1--
    while (x2 < w && match((row + x2) * 4)) x2++
    for (let i = x1 + 1; i < x2; i++) {
      const p = (row + i) * 4
      data[p] = rgba[0]
      data[p + 1] = rgba[1]
      data[p + 2] = rgba[2]
      data[p + 3] = rgba[3]
      if (cy > 0) {
        const up = ((cy - 1) * w + i) * 4
        if (match(up)) stack.push(i, cy - 1)
      }
      if (cy < h - 1) {
        const dn = ((cy + 1) * w + i) * 4
        if (match(dn)) stack.push(i, cy + 1)
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return true
}

/** Cheap 3x3 box blur of a small region — used by the smudge/blur brush. */
export function blurRegion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  const x = Math.max(0, Math.floor(cx - radius))
  const y = Math.max(0, Math.floor(cy - radius))
  const w = Math.min(ctx.canvas.width - x, Math.ceil(radius * 2))
  const h = Math.min(ctx.canvas.height - y, Math.ceil(radius * 2))
  if (w <= 1 || h <= 1) return
  const img = ctx.getImageData(x, y, w, h)
  const src = new Uint8ClampedArray(img.data)
  const d = img.data
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const p = (j * w + i) * 4
      for (let c = 0; c < 4; c++) {
        const sum =
          src[p + c] * 4 +
          src[p - 4 + c] + src[p + 4 + c] +
          src[p - w * 4 + c] + src[p + w * 4 + c] +
          src[p - w * 4 - 4 + c] + src[p - w * 4 + 4 + c] +
          src[p + w * 4 - 4 + c] + src[p + w * 4 + 4 + c]
        d[p + c] = sum / 12
      }
    }
  }
  ctx.putImageData(img, x, y)
}
