/**
 * AITB — client logo panel for the admin page.
 *
 * Uploads the client's logo for the opening / closing slides and previews it on
 * the real slide background, so what you approve here is what the room sees.
 *
 * The contrast problem this solves: a client logo can be any colour, and a pure
 * black wordmark on the dark slide is invisible. `analyzeLogoPlate` reads the
 * artwork and picks a backing automatically, and the toggle below overrides it
 * for the logos that fool a simple average (dark text beside a bright icon).
 *
 * Stored per-device in localStorage, so upload it on the laptop that drives the
 * projector.
 */
import { useEffect, useRef, useState } from 'react'
import {
  AitbClientLogo, analyzeLogoPlate, fileToLogoDataUrl, readAitbLogo, retrimLogoDataUrl,
  writeAitbLogo,
  type AitbLogo, type AitbLogoPlate, type AitbResolvedPlate,
} from './AitbClientLogo'

const PLATE_TABS: { v: AitbLogoPlate; label: string; hint: string }[] = [
  { v: 'auto', label: '✨ Auto', hint: 'Reads the logo and picks for you' },
  { v: 'light', label: '⬜ White plate', hint: 'For dark or black logos' },
  { v: 'dark', label: '⬛ Dark plate', hint: 'For white or very light logos' },
  { v: 'none', label: '🚫 No plate', hint: 'Logo sits straight on the slide' },
]

export function AitbLogoUpload() {
  const [logo, setLogo] = useState<AitbLogo | null>(() => readAitbLogo())
  const [detected, setDetected] = useState<AitbResolvedPlate | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Show which way `auto` is leaning, so the choice isn't a black box.
  useEffect(() => {
    if (!logo?.src) { setDetected(null); return }
    let live = true
    analyzeLogoPlate(logo.src).then(p => { if (live) setDetected(p) })
    return () => { live = false }
  }, [logo?.src])

  const persist = (next: AitbLogo | null) => {
    setLogo(next)
    try {
      writeAitbLogo(next)
      // localStorage silently keeps the OLD value when the quota is blown, so
      // read back rather than trusting the write.
      if (next?.src && readAitbLogo()?.src !== next.src) {
        setError('That logo is too large to save on this device. Try a smaller file.')
        return
      }
      setError('')
    } catch {
      setError('Could not save the logo on this device.')
    }
  }

  // Logos saved before the upload started cropping still carry their export
  // margins, which the slides would render as a big empty plate. Tighten them
  // once, here, rather than making anyone notice and re-upload. `retrim` returns
  // null when there's nothing left to cut, so this settles after one pass.
  useEffect(() => {
    if (!logo?.src) return
    let live = true
    retrimLogoDataUrl(logo.src).then(next => {
      if (live && next) persist({ ...logo, src: next })
    })
    return () => { live = false }
  }, [logo?.src])   // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const src = await fileToLogoDataUrl(file)
      persist({ src, plate: logo?.plate ?? 'auto', subline: logo?.subline ?? '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''   // re-picking the same file still fires
    }
  }

  const plate = logo?.plate ?? 'auto'

  return (
    <div>
      <h2 className="font-black text-lg mb-3 mt-6">🏷️ Client logo — opening &amp; closing slides</h2>
      <p className="text-gray-400 text-sm mb-3">
        Shown big on the 👋 Opening and 🎬 Closing slides. Saved on <b>this device</b>, so
        upload it on the laptop that runs the projector.
      </p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => onPick(e.target.files?.[0])} />

      {/* Preview on the real slide background — the only honest way to judge contrast */}
      <div className="rounded-2xl mb-3 flex items-center justify-center overflow-hidden"
        style={{
          minHeight: 190, padding: 20, background: '#07050f',
          backgroundImage:
            'radial-gradient(60% 45% at 22% 18%,rgba(168,85,247,.30),transparent 62%),'
            + 'radial-gradient(55% 45% at 80% 28%,rgba(34,211,238,.22),transparent 60%)',
          border: '2px dashed rgba(255,255,255,0.16)',
        }}>
        {logo?.src
          ? <AitbClientLogo logo={logo} height="92px" />
          : <div className="text-center text-gray-500 font-bold text-sm">
              No logo yet<br /><span className="text-xs">the slides just show the headline</span>
            </div>}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="flex-1 rounded-2xl py-3 font-black transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{ background: '#38bdf822', color: '#38bdf8', border: '2px solid #38bdf855' }}>
          {busy ? '⏳ Reading…' : logo?.src ? '🔄 Replace logo' : '＋ Upload client logo'}
        </button>
        {logo?.src && (
          <button onClick={() => persist({ src: '', plate, subline: logo.subline ?? '' })}
            className="px-4 py-3 rounded-2xl font-bold text-red-400"
            style={{ border: '1.5px solid rgba(248,113,113,0.4)' }}>
            🗑️ Remove
          </button>
        )}
      </div>

      {error && <div className="text-red-400 text-sm font-bold mb-3">⚠️ {error}</div>}

      {logo?.src && (
        <>
          <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
            Background behind the logo
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {PLATE_TABS.map(t => (
              <button key={t.v} onClick={() => persist({ ...logo, plate: t.v })}
                title={t.hint}
                className="rounded-xl px-3 py-2.5 font-bold text-sm text-left transition-all"
                style={plate === t.v
                  ? { background: '#38bdf8', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                <div>{t.label}</div>
                <div className="text-[11px] font-bold opacity-70 leading-tight mt-0.5">{t.hint}</div>
              </button>
            ))}
          </div>
          <div className="text-gray-500 text-xs font-bold mb-4">
            {detected === null ? 'Reading the logo…'
              : detected === 'light'
                ? '🔍 This logo reads DARK — Auto puts it on a white plate so it can’t vanish.'
                : '🔍 This logo reads LIGHT — Auto lets it sit straight on the dark slide.'}
            {plate !== 'auto' && ' (You’ve overridden Auto.)'}
          </div>
        </>
      )}

      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
        Line under the headline
      </div>
      <input
        value={logo?.subline ?? ''}
        onChange={e => persist({ src: logo?.src ?? '', plate, subline: e.target.value })}
        placeholder="AI Team Building"
        className="w-full bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none"
        style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
      <p className="text-gray-500 text-xs mt-2">
        Appears under “Welcome” and “Thank you” — e.g. the client or event name.
      </p>
    </div>
  )
}
