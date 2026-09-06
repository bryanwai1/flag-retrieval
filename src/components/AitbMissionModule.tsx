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
 * The roulette spins real segmented wheels (as in the Game System player build)
 * and reveals the artwork for what they landed on underneath. For the deal
 * modules, a module whose every slot pool has generated art (AITB_REEL_POOLS)
 * upgrades from a text flash to an image slot-machine; otherwise text.
 */
import { useEffect, useRef, useState } from 'react'
import {
  AITB_POOLS, AITB_MODULE_SLOTS, AITB_MODULE_MODE, AITB_REEL_POOLS, aitbReelImage, aitbModuleHasImages,
  type AitbActivity, type AitbModuleSlot, type AitbPoolKey,
} from '../lib/aitbActivities'
import { aitbWheelArt } from '../lib/aitbWheels'

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
  if (mode === 'spin') return <WheelSpinModule {...sub} />
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
    const next = [...sel]
    next[i] = next[i] === val ? '' : val   // tap again to deselect
    setSel(next)
    // onSave outside the updater — see the note in WheelSpinModule.
    if (next.every(Boolean)) onSave(next)
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

// ── Roulette wheel ───────────────────────────────────────────────────────────
// Painted artwork with the options printed on it, spun under a fixed pointer.
// Where each slice sits is measured data (lib/aitbWheels), so the wheel always
// stops with the pointer on the word the spin actually chose.

const WHEEL_SPIN_MS = 4600

function RouletteWheel({ pool, final, spinKey }: {
  pool: AitbPoolKey
  final: string | null
  /** Bumped by the parent on every spin; 0 = never spun. */
  spinKey: number
}) {
  const art = aitbWheelArt(pool)
  const items: readonly string[] = AITB_POOLS[pool]
  const [rot, setRot] = useState(0)
  const rotRef = useRef(0)

  useEffect(() => {
    if (!spinKey || !final || !art) return
    const idx = items.indexOf(final)
    if (idx < 0) return
    // Turn the slice's own centre angle up to the pointer, plus five whole
    // turns. Measured from the CURRENT angle so a re-spin is as accurate as the
    // first one.
    const wanted = (360 - art.mids[idx]) % 360
    const current = ((rotRef.current % 360) + 360) % 360
    rotRef.current += 360 * 5 + (((wanted - current) % 360) + 360) % 360
    setRot(rotRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey])

  if (!art) return null

  return (
    <div className="relative w-full aspect-square">
      {/* pointer — fixed at the top, the wheel turns beneath it */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{
          top: '-2%',
          borderLeft: '11px solid transparent',
          borderRight: '11px solid transparent',
          borderTop: '22px solid #f8fafc',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
        }}
      />
      <img
        src={art.src}
        alt=""
        draggable={false}
        className="w-full h-full select-none"
        style={{
          transform: `rotate(${rot}deg)`,
          transition: `transform ${WHEEL_SPIN_MS}ms cubic-bezier(.12,.72,.05,1)`,
        }}
      />
    </div>
  )
}

// ── Roulette: two real wheels, then the art + song brief underneath ──────────
function WheelSpinModule({ color, slots, savedWords, disabled, onSave, storeKey }: SubProps) {
  const [spins, setSpins] = useState<number[]>(() => readSpins(storeKey, slots.length))
  const [vals, setVals] = useState<string[]>(() => slots.map((_, i) => savedWords[i] ?? ''))
  // Latest vals, readable from the spin callback without a state updater.
  const valsRef = useRef<string[]>(vals)
  valsRef.current = vals
  // What each wheel is currently rotating towards, and a per-wheel spin counter
  // the wheel watches to know a new spin started.
  const [targets, setTargets] = useState<string[]>(() => slots.map((_, i) => savedWords[i] ?? ''))
  const [spinKeys, setSpinKeys] = useState<number[]>(() => slots.map(() => 0))
  const [spinning, setSpinning] = useState<number | null>(null)

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

  // Re-seed from realtime unless this device has already spun.
  useEffect(() => {
    setVals(prev => (prev.some(Boolean) ? prev : slots.map((_, i) => savedWords[i] ?? '')))
    setTargets(prev => (prev.some(Boolean) ? prev : slots.map((_, i) => savedWords[i] ?? '')))
  }, [savedWords, slots])

  const spin = (i: number) => {
    if (disabled || spinning !== null || (spins[i] || 0) >= MAX_SPINS) return
    const pool = AITB_POOLS[slots[i].pool]
    const final = pool[Math.floor(Math.random() * pool.length)]
    setSpinning(i)
    setTargets(prev => { const n = [...prev]; n[i] = final; return n })
    setSpinKeys(prev => { const n = [...prev]; n[i] = n[i] + 1; return n })
    // Commit only once the wheel has actually stopped, so an interrupted spin
    // (tab backgrounded to open Suno, phone locked) costs the team nothing.
    setTimeout(() => {
      setSpins(prev => {
        const n = [...prev]
        n[i] = (n[i] || 0) + 1
        writeSpins(storeKey, n)
        return n
      })
      // onSave must run OUTSIDE a state updater: an updater is replayed during
      // render, so a consumer that sets state synchronously would be updated
      // mid-render.
      const next = [...valsRef.current]
      next[i] = final
      setVals(next)
      onSave(next)
      setSpinning(null)
    }, WHEEL_SPIN_MS)
  }

  const settled = vals.every(Boolean) && spinning === null
  const hasArt = slots.every(s => AITB_REEL_POOLS.includes(s.pool))

  return (
    <div className="mb-6">
      <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">
        🎡 Spin both wheels — {MAX_SPINS} spins each, then it locks!
      </div>

      <div className="grid grid-cols-2 gap-3">
        {slots.map((s, i) => {
          const left = MAX_SPINS - (spins[i] || 0)
          const isSpin = spinning === i
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{s.emoji} {s.label}</div>
              <RouletteWheel pool={s.pool} final={targets[i] || null} spinKey={spinKeys[i]} />
              <div className="font-black text-base text-center leading-tight min-h-[2.6em] flex items-center justify-center"
                style={{ color: vals[i] ? '#fff' : '#6b7280' }}>
                {isSpin ? '…' : vals[i] || '—'}
              </div>
              <button onClick={() => spin(i)} disabled={disabled || spinning !== null || left <= 0}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: color, color: '#000' }}>
                {isSpin ? 'Spinning…' : left <= 0 ? '🔒 Locked' : vals[i] ? `🔄 Last spin (${left})` : `🎲 Spin ${s.label}`}
              </button>
              <div className="text-[10px] font-bold" style={{ color: left > 0 ? '#94a3b8' : '#f87171' }}>
                {left > 0 ? `${left} spin${left > 1 ? 's' : ''} left` : 'No spins left'}
              </div>
            </div>
          )
        })}
      </div>

      {/* What the wheels landed on, in pictures. */}
      {settled && hasArt && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {slots.map((s, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.35)', border: `2px solid ${color}` }}>
              <img src={aitbReelImage(s.pool, vals[i])} alt={vals[i]} draggable={false}
                className="w-full block" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
              <div className="text-[10px] font-black uppercase tracking-widest px-2 pt-1.5 text-center" style={{ color }}>
                {s.emoji} {s.label}
              </div>
              <div className="text-white text-sm font-black px-2 pb-2 pt-0.5 text-center leading-tight">{vals[i]}</div>
            </div>
          ))}
        </div>
      )}

      {settled && (
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
