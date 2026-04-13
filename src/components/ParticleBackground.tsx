import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null
}

interface ParticleBackgroundProps {
  hexCode?: string
}

export function ParticleBackground({ hexCode }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Derive particle color from hexCode (lightened) or white
    let pr = 255, pg = 255, pb = 255
    if (hexCode) {
      const rgb = hexToRgb(hexCode)
      if (rgb) {
        pr = Math.round(rgb.r + (255 - rgb.r) * 0.6)
        pg = Math.round(rgb.g + (255 - rgb.g) * 0.6)
        pb = Math.round(rgb.b + (255 - rgb.b) * 0.6)
      }
    }

    let animationId: number
    const particles: Particle[] = []
    const PARTICLE_COUNT = 80
    const CONNECTION_DISTANCE = 150
    const MOUSE = { x: -1000, y: -1000 }

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }

    function handleMouseMove(e: MouseEvent) {
      MOUSE.x = e.clientX
      MOUSE.y = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove)

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        // Bounce off edges
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${p.opacity})`
        ctx!.fill()
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DISTANCE) {
            const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.15
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, ${opacity})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }

        // Mouse interaction — connect nearby particles to cursor
        const dx = particles[i].x - MOUSE.x
        const dy = particles[i].y - MOUSE.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 200) {
          const opacity = (1 - dist / 200) * 0.3
          ctx!.beginPath()
          ctx!.moveTo(particles[i].x, particles[i].y)
          ctx!.lineTo(MOUSE.x, MOUSE.y)
          ctx!.strokeStyle = `rgba(120, 200, 255, ${opacity})`
          ctx!.lineWidth = 0.8
          ctx!.stroke()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ background: 'transparent' }}
    />
  )
}
