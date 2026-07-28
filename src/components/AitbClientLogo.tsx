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

/** What one pass over the artwork tells us: how to back it, and its shape. */
export type AitbLogoInfo = {
  plate: AitbResolvedPlate
  /** width ÷ height of the stored artwork. Drives the plate's proportions. */
  aspect: number
}

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
export function analyzeLogo(src: string): Promise<AitbLogoInfo> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const aspect = img.height > 0 ? img.width / img.height : 1
      const resolve_ = (plate: AitbResolvedPlate) => resolve({ plate, aspect })
      try {
        const N = 48
        const c = document.createElement('canvas')
        c.width = N; c.height = N
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve_('light')
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
        if (!opaque) return resolve_('light')        // empty image — plate is harmless

        // A logo whose corners are opaque ships its own background rectangle.
        // Framing that in a white plate just draws a box around a box, so let a
        // dark-backed logo sit bare and give a light-backed one the plate it
        // already visually has.
        const corner = (x: number, y: number) => d[(y * N + x) * 4 + 3]
        const baked = corner(0, 0) > 250 && corner(N - 1, 0) > 250
          && corner(0, N - 1) > 250 && corner(N - 1, N - 1) > 250

        const lum = lumSum / opaque
        if (baked) return resolve_(lum < 0.5 ? 'none' : 'light')
        resolve_(lum < 0.5 ? 'light' : 'none')
      } catch {
        resolve_('light')                            // readback blocked — safest default
      }
    }
    img.onerror = () => resolve({ plate: 'light', aspect: 1 })
    img.src = src
  })
}

/** Just the backing, for callers that don't care about the shape. */
export function analyzeLogoPlate(src: string): Promise<AitbResolvedPlate> {
  return analyzeLogo(src).then(i => i.plate)
}

/**
 * Find the artwork inside a logo file, ignoring the blank margin around it.
 *
 * Client logos routinely ship with a wide transparent or white border baked in
 * — an export at a fixed canvas size, artwork centred in the middle. Rendering
 * that at a set height sizes the *margin*, so the mark comes out small and the
 * plate behind it wraps a lot of nothing. Measuring the ink fixes both.
 *
 * Returns the bounds as fractions of the source so the caller can apply them at
 * full resolution, or null when there is nothing safe to trim (a photographic
 * or gradient background, where "the margin" isn't a well-defined thing).
 */
function findArtworkBox(img: HTMLImageElement): { x: number; y: number; w: number; h: number } | null {
  try {
    // Judge at a bounded size: a 4000px logo would be 64MB of pixels, and the
    // margin is a coarse feature that survives downsampling fine.
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
    const W = Math.max(1, Math.round(img.width * scale))
    const H = Math.max(1, Math.round(img.height * scale))
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const at = (x: number, y: number) => (y * W + x) * 4

    // The four corners tell us what the background is.
    const corners = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)]
    const allClear = corners.every(i => d[i + 3] < 32)
    const allOpaque = corners.every(i => d[i + 3] > 250)
    // A baked background only counts as one if every corner agrees on its colour;
    // a photo or gradient behind the mark has no margin to trim.
    const sameColour = allOpaque && [0, 1, 2].every(ch =>
      corners.every(i => Math.abs(d[i + ch] - d[corners[0] + ch]) <= 12))
    if (!allClear && !sameColour) return null

    const bg = [d[corners[0]], d[corners[0] + 1], d[corners[0] + 2]]
    const isInk = (i: number) => {
      if (d[i + 3] < 32) return false                 // transparent is never ink
      if (allClear) return true                       // ...and on a clear bg, that's the whole test
      return Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 40
    }

    let x0 = W, y0 = H, x1 = -1, y1 = -1
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isInk(at(x, y))) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (x1 < x0 || y1 < y0) return null               // uniform image — nothing to find

    // Leave a hair of margin so antialiased edges aren't shaved off.
    const bleed = Math.ceil(Math.max(x1 - x0, y1 - y0) * 0.015)
    x0 = Math.max(0, x0 - bleed); y0 = Math.max(0, y0 - bleed)
    x1 = Math.min(W - 1, x1 + bleed); y1 = Math.min(H - 1, y1 + bleed)

    const w = (x1 - x0 + 1) / W
    const h = (y1 - y0 + 1) / H
    if (w > 0.97 && h > 0.97) return null             // already tight — don't re-encode for nothing
    return { x: x0 / W, y: y0 / H, w, h }
  } catch {
    return null                                       // readback blocked — keep the original
  }
}

/**
 * Crop an uploaded logo to its artwork, shrink it, and return a PNG data URL
 * (transparency preserved). The crop is what makes the slide size the *mark*
 * rather than whatever canvas the client exported it on.
 */
export function fileToLogoDataUrl(file: File, maxEdge = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const src = String(reader.result ?? '')
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not an image the browser can open'))
      img.onload = () => {
        const box = findArtworkBox(img)
        const sx = box ? box.x * img.width : 0
        const sy = box ? box.y * img.height : 0
        const sw = box ? box.w * img.width : img.width
        const sh = box ? box.h * img.height : img.height

        const scale = Math.min(1, maxEdge / Math.max(sw, sh))
        const w = Math.max(1, Math.round(sw * scale))
        const h = Math.max(1, Math.round(sh * scale))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return reject(new Error('Canvas unavailable'))
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
        resolve(c.toDataURL('image/png'))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Re-crop a logo that was stored before trimming existed, so a device that
 * already has one doesn't keep showing the old boxed-in version. Resolves null
 * when there is nothing to trim, which is the common case after the first run.
 */
export function retrimLogoDataUrl(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onerror = () => resolve(null)
    img.onload = () => {
      const box = findArtworkBox(img)
      if (!box) return resolve(null)
      try {
        const w = Math.max(1, Math.round(box.w * img.width))
        const h = Math.max(1, Math.round(box.h * img.height))
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, box.x * img.width, box.y * img.height, w, h, 0, 0, w, h)
        resolve(c.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.src = src
  })
}

/**
 * Render the client logo with whatever backing keeps it readable.
 * Renders nothing at all when no logo is set, so the slides stay clean.
 */
export function AitbClientLogo({ logo, height = 'clamp(64px, 11vh, 136px)', maxAspect = 3.6, className }: {
  logo: AitbLogo | null
  /**
   * Tallest the artwork may render, as a CSS length. Viewport-relative by
   * default so the logo grows with the slide's headline instead of shrinking
   * into a corner of a 1920px projector.
   */
  height?: string
  /** Widest the logo may get, as a multiple of `height`. Keeps a long wordmark
   *  from spanning the slide — past this it scales down instead of stretching. */
  maxAspect?: number
  className?: string
}) {
  const [info, setInfo] = useState<AitbLogoInfo>({ plate: 'light', aspect: 1 })

  useEffect(() => {
    if (!logo?.src) return
    let live = true
    analyzeLogo(logo.src).then(i => { if (live) setInfo(i) })
    return () => { live = false }
  }, [logo?.src])

  if (!logo?.src) return null

  const plate: AitbResolvedPlate = logo.plate === 'auto' ? info.plate : logo.plate

  // The plate has to hug whichever limit the artwork actually hits: a tall mark
  // is capped by height, a wide wordmark by width. Working that out in CSS keeps
  // it exact at every projector size without measuring on resize.
  const aspect = Math.max(0.05, info.aspect)
  const vars = {
    ['--aitb-logo-h' as string]: height,
    ['--aitb-logo-w' as string]: `min(46vw, calc(${height} * ${maxAspect}))`,
    // Effective rendered height — what the padding and corner radius scale from.
    ['--aitb-logo-e' as string]: `min(var(--aitb-logo-h), calc(var(--aitb-logo-w) / ${aspect}))`,
  }

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
        ...vars,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: plate === 'none' ? 0 : 'calc(var(--aitb-logo-e) * 0.22)',
        padding: plate === 'none' ? 0
          : 'calc(var(--aitb-logo-e) * 0.26) calc(var(--aitb-logo-e) * 0.38)',
        ...plateStyle,
      }}>
      {/* max-height + max-width with auto sizing: the box shrinks to the scaled
          artwork, so the plate never wraps empty space. */}
      <img src={logo.src} alt="Client logo"
        style={{
          maxHeight: 'var(--aitb-logo-h)', maxWidth: 'var(--aitb-logo-w)',
          width: 'auto', height: 'auto', display: 'block',
        }} />
    </div>
  )
}
