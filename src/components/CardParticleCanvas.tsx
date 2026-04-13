import { useEffect, useRef } from 'react'

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 255, g: 255, b: 255 }
}

export function CardParticleCanvas({ hexCode }: { hexCode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Lighten the card color for particles — mix with white at 65%
    const { r, g, b } = hexToRgb(hexCode)
    const pr = Math.round(r + (255 - r) * 0.65)
    const pg = Math.round(g + (255 - g) * 0.65)
    const pb = Math.round(b + (255 - b) * 0.65)

    let animId: number
    const COUNT = 8
    const CONNECT = 70

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 1.5 + 0.6,
      op: Math.random() * 0.45 + 0.25,
    }))

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      for (const p of pts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${pr},${pg},${pb},${p.op})`
        ctx!.fill()
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECT) {
            ctx!.beginPath()
            ctx!.moveTo(pts[i].x, pts[i].y)
            ctx!.lineTo(pts[j].x, pts[j].y)
            ctx!.strokeStyle = `rgba(${pr},${pg},${pb},${(1 - dist / CONNECT) * 0.25})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [hexCode])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl"
    />
  )
}
