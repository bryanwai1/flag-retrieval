/**
 * AITB — interactive mission-page modules. Rendered on the mission page once a
 * team has checked in; each writes its result into aitb_progress.words (positions
 * match AITB_MODULE_SLOTS) so the admin sees it live via realtime.
 *
 *   · cups     (Nerf)             → tap the word on each cup you collected
 *   · roulette (Jingle/Dance)     → spin two wheels: genre, then topic
 *   · cards    (Random Cinematic) → deal 4 cards at once, no re-draws
 *   · animals  (Found Object)     → draw 2 surprise animals, no re-draws
 *
 * When every slot of a module has generated art (AITB_REEL_POOLS) the reveal
 * upgrades from a text flash to an image slot-machine that spins through the
 * pictures and lands on the chosen one; otherwise it falls back to text.
 */
import { useEffect, useRef, useState } from 'react'
import {
  AITB_POOLS, AITB_MODULE_SLOTS, AITB_MODULE_MODE, aitbReelImage, aitbModuleHasImages,
  type AitbActivity, type AitbModuleSlot, type AitbPoolKey,
} from '../lib/aitbActivities'

type ModuleProps = {
  activity: AitbActivity
  savedWords: string[]
  disabled: boolean
  onSave: (words: string[]) => void
  /** aitb_progress row id. Namespaces the spin counter so an admin reset (which
   *  deletes the row) hands the next attempt a clean 2 spins, and so switching
   *  teams on one phone never inherits the other team's burnt spins. */
  progressId: string
}

type SubProps = {
  color: string
  slots: AitbModuleSlot[]
  savedWords: string[]
  disabled: boolean
  onSave: (words: string[]) => void
  /** localStorage namespace for this activity — used to remember spins used. */
  storeKey: string
}

/* Each roulette wheel may be spun at most twice: the first spin plus one
   re-spin. After that the wheel locks, so a team can't keep re-rolling for a
   genre/topic they like.

   The count is per-device (localStorage), keyed by the progress row so an admin
   reset starts everyone fresh. Because a second phone can't know how many spins
   the first one used, a wheel whose value this device did NOT spin is treated as
   fully used — erring strict, so a team can't farm extra re-rolls by passing the
   mission around their phones. The spinning phone keeps its own count either way. */
const MAX_SPINS = 2

function readSpins(key: string, n: number): number[] {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || 'null')
    if (Array.isArray(arr)) return Array.from({ length: n }, (_, i) => Number(arr[i]) || 0)
  } catch { /* corrupt or unavailable — start fresh */ }
  return Array.from({ length: n }, () => 0)
}

function writeSpins(key: string, arr: number[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)) } catch { /* private mode — cap is best-effort */ }
}

export function AitbMissionModule({ activity, savedWords, disabled, onSave, progressId }: ModuleProps) {
  const mod = activity.module
  if (!mod) return null
  const slots = AITB_MODULE_SLOTS[mod]
  const mode = AITB_MODULE_MODE[mod]
  const sub: SubProps = {
    color: activity.color, slots, savedWords, disabled, onSave,
    storeKey: `aitb_spins_${activity.id}_${progressId}`,
  }
  if (mode === 'pick') return <CupsPicker {...sub} />
  if (mode === 'spin') return aitbModuleHasImages(mod) ? <ImageSpinModule {...sub} /> : <SpinModule {...sub} />
  return aitbModuleHasImages(mod) ? <ImageDealModule {...sub} /> : <TextDealModule {...sub} />
}

// ── Nerf: tap the word printed on each cup you collected ─────────────────────
function CupsPicker({ color, slots, savedWords, disabled, onSave }: SubProps) {
  const [sel, setSel] = useState<string[]>(() => slots.map((_, i) => savedWords[i] ?? ''))

  // Re-seed from realtime (another phone picked first) unless we've picked here.
  useEffect(() => {
    setSel(prev => (prev.some(Boolean) ? prev : slots.map((_, i) => savedWords[i] ?? '')))
  }, [savedWords, slots])

  const choose = (i: number, val: string) => {
    if (disabled) return
    setSel(prev => {
      const next = [...prev]
      next[i] = next[i] === val ? '' : val   // tap again to deselect
      if (next.every(Boolean)) onSave(next)
      return next
    })
  }

  const allPicked = sel.every(Boolean)
  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">🎯 Tap the word on each cup you collected</div>
      <div className="flex flex-col gap-3">
        {slots.map((s, i) => (
          <div key={i} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${sel[i] ? color : 'rgba(255,255,255,0.1)'}` }}>
            <div className="font-black text-sm mb-2" style={{ color }}>{s.emoji} {s.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {AITB_POOLS[s.pool].map(w => {
                const on = sel[i] === w
                return (
                  <button key={w} onClick={() => choose(i, w)} disabled={disabled}
                    className="px-2.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={on
                      ? { background: color, color: '#000', border: `1.5px solid ${color}` }
                      : { background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                    {w}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {allPicked && (
        <div className="rounded-2xl px-4 py-3 mt-3 text-center" style={{ background: `${color}18`, border: `2px solid ${color}` }}>
          <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">✨ Your prompt</div>
          <div className="font-black" style={{ color }}>{sel.join(' ')}</div>
          <div className="text-emerald-400 text-xs font-bold mt-1">✅ Saved — your host can see it live!</div>
        </div>
      )}
    </div>
  )
}

/* The ready-to-use song brief, built from the two wheels. Slot order is
   [Genre, Topic] (AITB_MODULE_SLOTS.roulette), so the sentence reads
   "Create a song about The Office Coffee in a Nursery Rhyme Style". */
function SongPrompt({ genre, topic, color }: { genre: string; topic: string; color: string }) {
  const sentence = `Create a song about ${topic} in a ${genre} Style`
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(sentence)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
      .catch(() => { /* clipboard blocked — the text is on screen to type */ })
  }
  return (
    <div className="rounded-2xl px-4 py-3 mt-3" style={{ background: `${color}18`, border: `2px solid ${color}` }}>
      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">🎤 Your song brief</div>
      <div className="font-black text-base leading-snug" style={{ color }}>“{sentence}”</div>
      <button onClick={copy}
        className="w-full mt-2.5 py-2 rounded-xl font-black text-sm transition-all active:scale-95"
        style={{ background: color, color: '#000' }}>
        {copied ? '✅ Copied!' : '📋 Copy this prompt'}
      </button>
      <div className="text-gray-400 text-xs font-bold mt-2">
        Paste it into Suno to make your song — then invent the dance! 💃
      </div>
    </div>
  )
}

// ── Roulette: spin each wheel one at a time ──────────────────────────────────
function SpinModule({ color, slots, savedWords, disabled, onSave, storeKey }: SubProps) {
  const [spins, setSpins] = useState<number[]>(() => readSpins(storeKey, slots.length))

  // A wheel already spun elsewhere (teammate's phone) is locked here — this
  // device can't know how many of the team's 2 spins are left, so it assumes none.
  useEffect(() => {
    setSpins(prev => {
      const next = prev.map((c, i) => (savedWords[i] && c === 0 ? MAX_SPINS : c))
      if (next.every((c, i) => c === prev[i])) return prev
      writeSpins(storeKey, next)
      return next
    })
  }, [savedWords, storeKey])

  const bumpSpin = (i: number) => setSpins(prev => {
    const next = [...prev]
    next[i] = (next[i] || 0) + 1
    writeSpins(storeKey, next)
    return next
  })

  const [vals, setVals] = useState<string[]>(() => slots.map((_, i) => savedWords[i] ?? ''))
  const [flash, setFlash] = useState<Record<number, string>>({})
  const [spinning, setSpinning] = useState<number | null>(null)

  useEffect(() => {
    setVals(prev => (prev.some(Boolean) ? prev : slots.map((_, i) => savedWords[i] ?? '')))
  }, [savedWords, slots])

  const spin = (i: number) => {
    if (disabled || spinning !== null || (spins[i] || 0) >= MAX_SPINS) return
    setSpinning(i)
    const pool = AITB_POOLS[slots[i].pool]
    let ticks = 0
    const iv = setInterval(() => {
      setFlash(f => ({ ...f, [i]: pool[Math.floor(Math.random() * pool.length)] }))
      if (++ticks > 18) {
        clearInterval(iv)
        const final = pool[Math.floor(Math.random() * pool.length)]
        setFlash(f => { const n = { ...f }; delete n[i]; return n })
        // Charge the spin only once a result actually lands, so a reel that gets
        // interrupted (tab backgrounded to open Suno, phone locked) costs nothing.
        bumpSpin(i)
        setVals(prev => { const next = [...prev]; next[i] = final; onSave(next); return next })
        setSpinning(null)
      }
    }, 65)
  }

  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
        🎡 Spin both wheels — {MAX_SPINS} spins each, then it locks!
      </div>
      <div className="grid grid-cols-2 gap-3">
        {slots.map((s, i) => {
          const shown = flash[i] ?? vals[i]
          const isSpin = spinning === i
          const left = MAX_SPINS - (spins[i] || 0)
          return (
            <div key={i} className="rounded-2xl p-4 flex flex-col items-center text-center gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${vals[i] ? color : 'rgba(255,255,255,0.1)'}` }}>
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{s.emoji} {s.label}</div>
              <div className="font-black text-lg min-h-[3.5rem] flex items-center justify-center leading-tight"
                style={{ color: shown ? '#fff' : '#6b7280', filter: isSpin ? 'blur(0.5px)' : 'none' }}>
                {shown || '—'}
              </div>
              <button onClick={() => spin(i)} disabled={disabled || spinning !== null || left <= 0}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: color, color: '#000' }}>
                {isSpin ? 'Spinning…' : left <= 0 ? '🔒 Locked' : vals[i] ? `🔄 Last spin (${left})` : `🎡 Spin ${i + 1}`}
              </button>
              <div className="text-[10px] font-bold" style={{ color: left > 0 ? '#94a3b8' : '#f87171' }}>
                {left > 0 ? `${left} spin${left > 1 ? 's' : ''} left` : 'No spins left'}
              </div>
            </div>
          )
        })}
      </div>
      {vals.every(Boolean) && spinning === null && (
        <>
          <SongPrompt genre={vals[0]} topic={vals[1]} color={color} />
          <div className="text-emerald-400 text-xs font-bold mt-2 text-center">✅ Genre + topic locked in — your host can see it live!</div>
        </>
      )}
    </div>
  )
}

// ── Image slot-machine reel: spins through pool art, lands on `final` ─────────
const CELL = 132          // px height of one image cell (reel window height)
const REEL_PAD = 20       // random frames that scroll past before the result

function ImageReel({ pool, color, label, emoji, final, spinning, durationMs }: {
  pool: AitbPoolKey
  color: string
  label: string
  emoji: string
  final: string | null
  spinning: boolean
  durationMs: number
}) {
  const [strip, setStrip] = useState<string[]>([])
  const [animate, setAnimate] = useState(false)

  // Build a fresh reel strip (random padding + the result last) and, on the next
  // frame, flip on the CSS transition so it scrolls to and stops on the result.
  useEffect(() => {
    if (!spinning || !final) return
    const items = AITB_POOLS[pool]
    const pad = Array.from({ length: REEL_PAD }, () => items[Math.floor(Math.random() * items.length)])
    setStrip([...pad, final])
    setAnimate(false)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setAnimate(true)) })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [spinning, final, pool])

  const cells = spinning && strip.length ? strip : (final ? [final] : [])
  const translate = spinning && animate ? -(strip.length - 1) * CELL : 0
  const settled = !spinning && !!final

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'rgba(0,0,0,0.35)', border: `2px solid ${settled ? color : 'rgba(255,255,255,0.12)'}`, transition: 'border-color .3s' }}>
      <div className="text-[10px] font-black uppercase tracking-widest px-2 pt-2 text-center" style={{ color }}>{emoji} {label}</div>
      <div className="mx-2 mt-1.5 rounded-xl relative" style={{ height: CELL, overflow: 'hidden' }}>
        {cells.length === 0
          ? <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: 'rgba(255,255,255,0.05)' }}>❔</div>
          : (
            <div style={{ transform: `translateY(${translate}px)`, transition: spinning && animate ? `transform ${durationMs}ms cubic-bezier(.16,.72,.14,1)` : 'none' }}>
              {cells.map((item, i) => (
                <div key={i} style={{ height: CELL }}>
                  <img src={aitbReelImage(pool, item)} alt="" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        {/* slot-window shading top & bottom */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(rgba(0,0,0,0.4), transparent 20%, transparent 80%, rgba(0,0,0,0.4))' }} />
      </div>
      <div className="text-xs font-black px-2 pb-2 pt-1.5 text-center leading-tight flex items-center justify-center"
        style={{ color: settled ? '#fff' : '#94a3b8', minHeight: '2.4em' }}>
        {settled ? final : spinning ? '🎰' : '—'}
      </div>
    </div>
  )
}

const SPIN_BASE = 2000    // ms the first reel spins
const SPIN_STAGGER = 280  // extra ms per reel so they stop left-to-right

// ── Random Cinematic (image slot-machine): deal every reel at once ───────────
function ImageDealModule({ color, slots, savedWords, disabled, onSave }: SubProps) {
  const dealtSaved = savedWords.length >= slots.length && savedWords.slice(0, slots.length).every(Boolean)
  const [vals, setVals] = useState<string[]>(() => (dealtSaved ? savedWords.slice(0, slots.length) : []))
  const [finals, setFinals] = useState<string[]>(() => (dealtSaved ? savedWords.slice(0, slots.length) : []))
  const [dealing, setDealing] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (dealtSaved) { const w = savedWords.slice(0, slots.length); setVals(w); setFinals(w) }
  }, [savedWords, dealtSaved, slots])

  // Preload every reel image so the spin is smooth on the first play.
  useEffect(() => {
    slots.forEach(s => AITB_POOLS[s.pool].forEach(item => { const im = new Image(); im.src = aitbReelImage(s.pool, item) }))
  }, [slots])

  const deal = () => {
    if (disabled || busy.current || vals.length) return
    busy.current = true
    // Final draw — keep values distinct within any shared pool (e.g. 2 animals).
    const taken: Record<string, Set<string>> = {}
    const result = slots.map(s => {
      const pool = AITB_POOLS[s.pool]
      const t = taken[s.pool] ?? (taken[s.pool] = new Set<string>())
      const avail = pool.filter(v => !t.has(v))
      const pick = avail[Math.floor(Math.random() * avail.length)]
      t.add(pick)
      return pick
    })
    setFinals(result)
    setDealing(true)
    const maxMs = SPIN_BASE + (slots.length - 1) * SPIN_STAGGER + 200
    setTimeout(() => {
      setVals(result)
      setDealing(false)
      busy.current = false
      onSave(result)
    }, maxMs)
  }

  const done = vals.length > 0
  const isAnimals = slots.length === 2
  const cols = slots.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
        🎰 {done ? 'Your draw — no re-draws!' : isAnimals ? 'Tap to draw your 2 animals' : 'Tap to deal your 4 cards'}
      </div>
      <div className={`grid ${cols} gap-2`}>
        {slots.map((s, i) => (
          <ImageReel key={i} pool={s.pool} color={color} label={s.label} emoji={s.emoji}
            final={finals[i] ?? null} spinning={dealing} durationMs={SPIN_BASE + i * SPIN_STAGGER} />
        ))}
      </div>
      {!done && (
        <button onClick={deal} disabled={disabled || dealing}
          className="w-full mt-3 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50"
          style={{ background: color, color: '#000' }}>
          {dealing ? 'Dealing…' : isAnimals ? '🎲 DRAW MY 2 ANIMALS' : '🎴 DEAL MY 4 CARDS'}
        </button>
      )}
      {done && <div className="text-emerald-400 text-xs font-bold mt-2 text-center">✅ Locked in — your host can see it live!</div>}
    </div>
  )
}

// ── Roulette (image slot-machine): spin each wheel one at a time ─────────────
function ImageSpinModule({ color, slots, savedWords, disabled, onSave, storeKey }: SubProps) {
  const seed = () => slots.map((_, i) => savedWords[i] ?? '')
  const [vals, setVals] = useState<string[]>(seed)
  const [finals, setFinals] = useState<string[]>(seed)
  const [spinning, setSpinning] = useState<number | null>(null)
  const [spins, setSpins] = useState<number[]>(() => readSpins(storeKey, slots.length))

  // Re-seed from realtime unless we've already spun on this device.
  useEffect(() => {
    setVals(prev => (prev.some(Boolean) ? prev : seed()))
    setFinals(prev => (prev.some(Boolean) ? prev : seed()))
  }, [savedWords, slots])

  // A wheel already spun elsewhere is locked here — see MAX_SPINS note.
  useEffect(() => {
    setSpins(prev => {
      const next = prev.map((c, i) => (savedWords[i] && c === 0 ? MAX_SPINS : c))
      if (next.every((c, i) => c === prev[i])) return prev
      writeSpins(storeKey, next)
      return next
    })
  }, [savedWords, storeKey])

  useEffect(() => {
    slots.forEach(s => AITB_POOLS[s.pool].forEach(item => { const im = new Image(); im.src = aitbReelImage(s.pool, item) }))
  }, [slots])

  const spin = (i: number) => {
    if (disabled || spinning !== null || (spins[i] || 0) >= MAX_SPINS) return
    const pool = AITB_POOLS[slots[i].pool]
    const final = pool[Math.floor(Math.random() * pool.length)]
    setFinals(prev => { const n = [...prev]; n[i] = final; return n })
    setSpinning(i)
    setTimeout(() => {
      // Charge the spin only when the reel lands — an interrupted spin is free.
      setSpins(prev => {
        const next = [...prev]
        next[i] = (next[i] || 0) + 1
        writeSpins(storeKey, next)
        return next
      })
      setVals(prev => { const n = [...prev]; n[i] = final; onSave(n); return n })
      setSpinning(null)
    }, SPIN_BASE + 200)
  }

  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
        🎰 Spin both wheels — {MAX_SPINS} spins each, then it locks!
      </div>
      <div className="grid grid-cols-2 gap-3">
        {slots.map((s, i) => {
          const left = MAX_SPINS - (spins[i] || 0)
          return (
            <div key={i} className="flex flex-col gap-2">
              <ImageReel pool={s.pool} color={color} label={s.label} emoji={s.emoji}
                final={finals[i] || null} spinning={spinning === i} durationMs={SPIN_BASE} />
              <button onClick={() => spin(i)} disabled={disabled || spinning !== null || left <= 0}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: color, color: '#000' }}>
                {spinning === i ? 'Spinning…' : left <= 0 ? '🔒 Locked' : vals[i] ? `🔄 Last spin (${left})` : `🎡 Spin ${i + 1}`}
              </button>
              <div className="text-[10px] font-bold text-center" style={{ color: left > 0 ? '#94a3b8' : '#f87171' }}>
                {left > 0 ? `${left} spin${left > 1 ? 's' : ''} left` : 'No spins left'}
              </div>
            </div>
          )
        })}
      </div>
      {vals.every(Boolean) && spinning === null && (
        <>
          <SongPrompt genre={vals[0]} topic={vals[1]} color={color} />
          <div className="text-emerald-400 text-xs font-bold mt-2 text-center">✅ Genre + topic locked in — your host can see it live!</div>
        </>
      )}
    </div>
  )
}

// ── Text fallback deal (used until a module's reel art exists) ───────────────
function TextDealModule({ color, slots, savedWords, disabled, onSave }: SubProps) {
  const dealtSaved = savedWords.length >= slots.length && savedWords.slice(0, slots.length).every(Boolean)
  const [vals, setVals] = useState<string[]>(() => (dealtSaved ? savedWords.slice(0, slots.length) : []))
  const [flash, setFlash] = useState<string[]>([])
  const [dealing, setDealing] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (dealtSaved) setVals(savedWords.slice(0, slots.length))
  }, [savedWords, dealtSaved, slots])

  const deal = () => {
    if (disabled || busy.current || vals.length) return
    busy.current = true
    setDealing(true)
    let ticks = 0
    const iv = setInterval(() => {
      setFlash(slots.map(s => { const p = AITB_POOLS[s.pool]; return p[Math.floor(Math.random() * p.length)] }))
      if (++ticks > 16) {
        clearInterval(iv)
        // Final draw — keep values distinct within any shared pool (e.g. 2 animals).
        const taken: Record<string, Set<string>> = {}
        const result = slots.map(s => {
          const pool = AITB_POOLS[s.pool]
          const t = taken[s.pool] ?? (taken[s.pool] = new Set<string>())
          const avail = pool.filter(v => !t.has(v))
          const pick = avail[Math.floor(Math.random() * avail.length)]
          t.add(pick)
          return pick
        })
        setFlash([])
        setVals(result)
        setDealing(false)
        busy.current = false
        onSave(result)
      }
    }, 70)
  }

  const showVals = flash.length ? flash : vals
  const done = vals.length > 0
  const isAnimals = slots.length === 2
  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
        🎴 {done ? 'Your draw — no re-draws!' : isAnimals ? 'Tap to draw your 2 animals' : 'Tap to deal your 4 cards'}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((s, i) => (
          <div key={i} className="rounded-2xl p-3 flex flex-col items-center text-center gap-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${done ? color : 'rgba(255,255,255,0.1)'}`, transition: 'border-color .3s' }}>
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{s.emoji} {s.label}</div>
            <div className="font-black text-base min-h-[2.5rem] flex items-center justify-center leading-tight"
              style={{ color: showVals[i] ? '#fff' : '#6b7280', filter: dealing ? 'blur(0.5px)' : 'none' }}>
              {showVals[i] || '❔'}
            </div>
          </div>
        ))}
      </div>
      {!done && (
        <button onClick={deal} disabled={disabled || dealing}
          className="w-full mt-3 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50"
          style={{ background: color, color: '#000' }}>
          {dealing ? 'Dealing…' : isAnimals ? '🎲 DRAW MY 2 ANIMALS' : '🎴 DEAL MY 4 CARDS'}
        </button>
      )}
      {done && <div className="text-emerald-400 text-xs font-bold mt-2 text-center">✅ Locked in — your host can see it live!</div>}
    </div>
  )
}
