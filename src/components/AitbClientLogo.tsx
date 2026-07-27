/**
 * AITB — client logo for the opening / closing slides.
 *
 * The logo is whatever the client sends, so it can be any colour: a pure-black
 * wordmark would vanish on the dark slide, a white one would vanish on a white
 * plate. So we look at the artwork itself — sample its pixels, work out whether
 * it reads dark or light, and put it on the backing that keeps it visible:
 *
 *   dark artwork  → white rounded plate
 *   light artwork → sits bare on the dark slide
 *
 * `plate` overrides that guess, because a two-tone logo (dark text, light icon)
 * can average out to something the detector calls wrong, and nobody wants to be
 * debugging that in front of a room.
 *
 * Stored in localStorage rather than the database: adding a column needs a
 * migration run by hand, and the projector laptop is the machine that both
 * uploads and displays, so per-device storage is the whole job anyway.
 */
import { useEffect, useState } from 'react'

export const AITB_LOGO_KEY = 'aitb_client_logo'

/** 'auto' = decide from the artwork; the rest force a backing. */
export type AitbLogoPlate = 'auto' | 'light' | 'dark' | 'none'

/** `src` may be empty when only the subline has been set — the slides then just
 *  render their headline with no logo above it. */
export type AitbLogo = { src: string; plate: AitbLogoPlate; subline?: string }

/** What `auto` can resolve to — a white plate, or nothing behind the logo. */
export type AitbResolvedPlate = 'light' | 'dark' | 'none'

export function readAitbLogo(): AitbLogo | null {
  try {
    const raw = localStorage.getItem(AITB_LOGO_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    const src = typeof v?.src === 'string' ? v.src : ''
    const subline = typeof v?.subline === 'string' ? v.subline : ''
    if (src || subline) {
      return { src, plate: (v.plate as AitbLogoPlate) ?? 'auto', subline }
    }
  } catch { /* corrupt or unavailable — behave as if no logo is set */ }
  return null
}

export function writeAitbLogo(v: AitbLogo | null) {
  try {
    if (v) localStorage.setItem(AITB_LOGO_KEY, JSON.stringify(v))
    else localStorage.removeItem(AITB_LOGO_KEY)
    // Same-tab listeners: the browser only fires `storage` in *other* tabs.
    window.dispatchEvent(new Event('aitb-logo-change'))
  } catch { /* private mode / quota — caller surfaces the failure */ }
}

/** Subscribe to logo changes from this tab or any other. */
export function useAitbLogo(): AitbLogo | null {
  const [logo, setLogo] = useState<AitbLogo | null>(() => readAitbLogo())
  useEffect(() => {
    const sync = () => setLogo(readAitbLogo())
    window.addEventListener('aitb-logo-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('aitb-logo-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return logo
}

/**
 * Decide what a logo needs behind it by reading its pixels.
 *
 * Downsamples to 48×48 (enough to judge overall tone, fast enough to run on
 * mount) and averages the perceived luminance of everything that isn't
 * transparent. Fully transparent pixels are ignored, so a black wordmark on a
 * transparent background reads as dark even though most of the file is empty.
 */
export function analyzeLogoPlate(src: string): Promise<AitbResolvedPlate> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const N = 48
        const c = document.createElement('canvas')
        c.width = N; c.height = N
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve('light')
        ctx.drawImage(img, 0, 0, N, N)
        const d = ctx.getImageData(0, 0, N, N).data

        let lumSum = 0, opaque = 0
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]
          if (a < 32) continue                       // transparent — not artwork
          // Rec. 709 luma, the usual stand-in for perceived brightness.
          lumSum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
          opaque++
        }
        if (!opaque) return resolve('light')         // empty image — plate is harmless

        // A logo whose corners are opaque ships its own background rectangle.
        // Framing that in a white plate just draws a box around a box, so let a
        // dark-backed logo sit bare and give a light-backed one the plate it
        // already visually has.
        const corner = (x: number, y: number) => d[(y * N + x) * 4 + 3]
        const baked = corner(0, 0) > 250 && corner(N - 1, 0) > 250
          && corner(0, N - 1) > 250 && corner(N - 1, N - 1) > 250

        const lum = lumSum / opaque
        if (baked) return resolve(lum < 0.5 ? 'none' : 'light')
        resolve(lum < 0.5 ? 'light' : 'none')
      } catch {
        resolve('light')                             // readback blocked — safest default
      }
    }
    img.onerror = () => resolve('light')
    img.src = src
  })
}

/** Shrink an uploaded file and return a PNG data URL (transparency preserved). */
export function fileToLogoDataUrl(file: File, maxEdge = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const src = String(reader.result ?? '')
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not an image the browser can open'))
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unavailable'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/png'))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Render the client logo with whatever backing keeps it readable.
 * Renders nothing at all when no logo is set, so the slides stay clean.
 */
export function AitbClientLogo({ logo, height = 132, className }: {
  logo: AitbLogo | null
  /** Rendered height of the artwork in px. */
  height?: number
  className?: string
}) {
  const [auto, setAuto] = useState<AitbResolvedPlate>('light')

  useEffect(() => {
    if (!logo?.src) return
    let live = true
    analyzeLogoPlate(logo.src).then(p => { if (live) setAuto(p) })
    return () => { live = false }
  }, [logo?.src])

  if (!logo?.src) return null

  const plate: AitbResolvedPlate = logo.plate === 'auto' ? auto : logo.plate
  const pad = Math.round(height * 0.22)

  const plateStyle: React.CSSProperties =
    plate === 'light' ? {
      background: '#fff',
      boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
    } : plate === 'dark' ? {
      background: '#0b0714',
      border: '1.5px solid rgba(255,255,255,0.16)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
    } : {}

  return (
    <div className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: plate === 'none' ? 0 : Math.round(height * 0.2),
        padding: plate === 'none' ? 0 : `${pad}px ${Math.round(pad * 1.5)}px`,
        ...plateStyle,
      }}>
      <img src={logo.src} alt="Client logo"
        style={{ height, width: 'auto', maxWidth: '46vw', objectFit: 'contain', display: 'block' }} />
    </div>
  )
}
