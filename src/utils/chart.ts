export interface ChartPoint {
  label: string
  /** null = no data for this point; the line breaks around it. */
  value: number | null
}

/** Draw a minimal line chart on a canvas using only the 2D API. */
export function drawLineChart(
  canvas: HTMLCanvasElement,
  points: ChartPoint[],
  color: string,
): void {
  const context = canvas.getContext('2d')
  if (!context) return
  const ctx: CanvasRenderingContext2D = context

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const w = rect.width || 320
  const h = rect.height || 180
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const padX = 28
  const padY = 16
  const plotW = w - padX * 2
  const plotH = h - padY * 2

  const getX = (i: number) =>
    points.length === 1 ? padX + plotW / 2 : padX + (i / (points.length - 1)) * plotW

  const drawXLabels = () => {
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    // With few points (e.g. 7 days) label every point; otherwise only the ends.
    const labelAll = points.length <= 10
    points.forEach((p, i) => {
      if (labelAll || i === 0 || i === points.length - 1) {
        ctx.fillText(p.label, getX(i), padY + plotH + 14)
      }
    })
  }

  if (!points.length) {
    ctx.fillStyle = '#9ca3af'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('暂无记录', w / 2, h / 2)
    return
  }

  const values = points.map((p) => p.value).filter((v): v is number => v !== null)

  if (!values.length) {
    ctx.fillStyle = '#9ca3af'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('近 7 天暂无记录', w / 2, h / 2)
    drawXLabels()
    return
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const getY = (v: number) => padY + plotH - ((v - min) / range) * plotH

  // Horizontal grid lines
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  for (let g = 0; g <= 3; g++) {
    const gy = padY + (g / 3) * plotH
    ctx.beginPath()
    ctx.moveTo(padX, gy)
    ctx.lineTo(padX + plotW, gy)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Dashed baseline at 0 when the scale includes it
  if (min < 0 && max > 0) {
    ctx.strokeStyle = '#d1d5db'
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(padX, getY(0))
    ctx.lineTo(padX + plotW, getY(0))
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Line (broken across null points)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let penDown = false
  points.forEach((p, i) => {
    if (p.value === null) {
      penDown = false
      return
    }
    const px = getX(i)
    const py = getY(p.value)
    if (!penDown) {
      ctx.moveTo(px, py)
      penDown = true
    } else {
      ctx.lineTo(px, py)
    }
  })
  ctx.stroke()

  // Dots for real values; hollow markers for missing days
  points.forEach((p, i) => {
    const px = getX(i)
    if (p.value === null) {
      ctx.fillStyle = '#e5e7eb'
      ctx.beginPath()
      ctx.arc(px, padY + plotH, 2.5, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px, getY(p.value), 3, 0, Math.PI * 2)
    ctx.fill()
  })

  drawXLabels()
}
