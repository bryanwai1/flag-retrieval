import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useFullscreen } from '../hooks/useFullscreen'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoSection } from '../types/database'

/**
 * BINGO DASH — Participant briefing deck.
 * HSBC-branded opener + dark holding slide + content slides + Observer QR closer.
 * Route: /bingo-dash/slides/briefing                       (section picker)
 *        /bingo-dash/slides/briefing/:sectionSlug          (deck for that section)
 */
export function BingoDashBriefingSlides() {
  const { sectionSlug } = useParams<{ sectionSlug?: string }>()
  if (!sectionSlug) return <SectionPicker />
  return <BriefingShow key={sectionSlug} sectionSlug={sectionSlug} />
}

// ── Section picker ───────────────────────────────────────────────────────
function SectionPicker() {
  const [sections, setSections] = useState<BingoSection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('bingo_sections').select('*').order('sort_order').then(({ data }) => {
      if (data) setSections(data)
    })
    supabase.from('bingo_settings').select('active_section_id').limit(1).maybeSingle()
      .then(({ data }) => { if (data) setActiveId(data.active_section_id) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-x-hidden py-12 px-6">
      <ParticleBackground />

      <a href="/bingo-dash/slides" className="absolute top-6 left-6 z-20 text-xs text-gray-400 hover:text-white transition-colors uppercase tracking-widest font-semibold">
        ← Event Slides
      </a>

      <div className="relative z-10 text-center mb-12">
        <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight animate-slide-up">
          📣 BRIEFING SLIDES
        </h1>
        <p className="text-gray-400 text-lg sm:text-xl mt-3 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          Pick a compartment — Observer QR is section-specific
        </p>
      </div>

      <div className="relative z-10 flex flex-row flex-wrap gap-6 justify-center max-w-5xl">
        {sections.length === 0 ? (
          <p className="text-gray-500 text-sm">No compartments yet. Create one in the Bingo Dash admin first.</p>
        ) : sections.map((s, i) => {
          const isActive = s.id === activeId
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/bingo-dash/slides/briefing/${s.slug}`)}
              className="animate-bounce-in flex flex-col items-center gap-4 px-10 py-10 rounded-3xl w-72 hover:scale-105 transition-transform"
              style={{
                animationDelay: `${0.25 + i * 0.08}s`,
                opacity: 0,
                animationFillMode: 'forwards',
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${isActive ? '#DB0011' : '#a855f733'}`,
                boxShadow: isActive ? '0 0 32px rgba(219,0,17,0.25)' : 'none',
              }}
            >
              <div className="text-6xl animate-float" style={{ filter: isActive ? 'drop-shadow(0 0 20px #DB0011aa)' : 'none' }}>
                📣
              </div>
              <div className="text-center w-full">
                <h2 className="text-xl font-black text-white tracking-tight">{s.name}</h2>
                {isActive && (
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ff5b66' }}>
                    ● Active now
                  </span>
                )}
              </div>
              <div className="w-full py-3 rounded-xl text-center text-sm font-black tracking-wider" style={{ background: '#DB0011', color: '#fff' }}>
                ▶ RUN BRIEFING
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide deck ───────────────────────────────────────────────────────────
type SlideKind =
  | 'main'
  | 'holding'
  | 'how-to-play'
  | 'read-card'
  | 'roles'
  | 'submissions'
  | 'how-to-submit'
  | 'safety'
  | 'qr-wish'

const SLIDES: SlideKind[] = [
  'main',
  'holding',
  'how-to-play',
  'read-card',
  'roles',
  'submissions',
  'how-to-submit',
  'safety',
  'qr-wish',
]

function BriefingShow({ sectionSlug }: { sectionSlug: string }) {
  const navigate = useNavigate()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const [section, setSection] = useState<BingoSection | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)

  useEffect(() => {
    supabase.from('bingo_sections').select('*').eq('slug', sectionSlug).maybeSingle()
      .then(({ data }) => { setSection(data ?? null); setLoaded(true) })
  }, [sectionSlug])

  const totalSlides = SLIDES.length
  const safeIdx = Math.min(slideIdx, totalSlides - 1)
  const kind = SLIDES[safeIdx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setSlideIdx(i => Math.min(totalSlides - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault()
        setSlideIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Escape') {
        navigate('/bingo-dash/slides/briefing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, totalSlides])

  if (!loaded) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading…</div>
  if (!section) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4 p-8 text-center">
        <p className="text-2xl font-black">Compartment not found.</p>
        <a href="/bingo-dash/slides/briefing" className="text-red-400 hover:text-red-300 underline">Pick another</a>
      </div>
    )
  }

  const isHsbcSlide = kind === 'main' || kind === 'qr-wish'
  const slideStyle = isHsbcSlide
    ? {
        background: 'linear-gradient(135deg, #DB0011 0%, #8B0009 100%)',
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`,
      }
    : {
        background: 'radial-gradient(ellipse at 50% 35%, #3b1f66 0%, #180a33 55%, #06020f 100%)',
        fontFamily: `'Cinzel', 'Trajan Pro', 'Palatino Linotype', Georgia, serif`,
      }

  return (
    <div
      className="h-screen w-screen overflow-hidden relative cursor-pointer select-none"
      onClick={() => setSlideIdx(i => Math.min(totalSlides - 1, i + 1))}
      style={slideStyle}
    >
      <SlideRenderer key={safeIdx} kind={kind} slideIdx={safeIdx} sectionSlug={sectionSlug} sectionName={section.name} />

      {/* Top nav */}
      <div className="absolute top-5 left-6 right-6 flex items-center justify-between text-[11px] text-white/60 font-semibold uppercase tracking-[0.25em] z-40">
        <a
          href="/bingo-dash/slides/briefing"
          onClick={e => e.stopPropagation()}
          className="hover:text-white transition-colors"
        >
          ← Briefing Home
        </a>
        <span className="hidden sm:inline">{section.name} · Slide {safeIdx + 1} / {totalSlides}</span>
        <button
          onClick={e => { e.stopPropagation(); toggleFullscreen() }}
          className="hover:text-white transition-colors"
        >
          {isFullscreen ? 'Exit ⛶' : 'Fullscreen ⛶'}
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute top-14 left-0 right-0 flex items-center justify-center gap-2 z-40">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              background: i <= safeIdx ? (isHsbcSlide ? '#fff' : '#fbbf24') : 'rgba(255,255,255,0.18)',
              boxShadow: i === safeIdx ? `0 0 10px ${isHsbcSlide ? '#fff' : '#fbbf24'}` : 'none',
              transform: i === safeIdx ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Back button */}
      {safeIdx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setSlideIdx(i => Math.max(0, i - 1)) }}
          className="absolute bottom-10 left-8 z-40 text-white/40 hover:text-white transition-colors text-xs uppercase tracking-[0.3em] font-bold"
        >
          ← Back
        </button>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-white/40 uppercase tracking-[0.35em] z-40 font-semibold pointer-events-none">
        {safeIdx < totalSlides - 1 ? '▶ Click / Space / → to continue' : '✦ End of Briefing · Esc to exit'}
      </div>
    </div>
  )
}

// ── Slide router ─────────────────────────────────────────────────────────
function SlideRenderer({ kind, slideIdx, sectionSlug, sectionName }: {
  kind: SlideKind; slideIdx: number; sectionSlug: string; sectionName: string
}) {
  switch (kind) {
    case 'main':           return <MainSlide slideIdx={slideIdx} />
    case 'holding':        return <HoldingSlide slideIdx={slideIdx} />
    case 'how-to-play':    return <HowToPlaySlide slideIdx={slideIdx} />
    case 'read-card':      return <ReadCardSlide slideIdx={slideIdx} />
    case 'roles':          return <RolesSlide slideIdx={slideIdx} />
    case 'submissions':    return <SubmissionTypesSlide slideIdx={slideIdx} />
    case 'how-to-submit':  return <HowToSubmitSlide slideIdx={slideIdx} />
    case 'safety':         return <SafetySlide slideIdx={slideIdx} />
    case 'qr-wish':        return <QrWishSlide slideIdx={slideIdx} sectionSlug={sectionSlug} sectionName={sectionName} />
  }
}

// ── 1. Main slide (HSBC red opener) ──────────────────────────────────────
function MainSlide({ slideIdx }: { slideIdx: number }) {
  return (
    <div key={slideIdx} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 award-slide-enter">
      {/* Soft animated blobs */}
      <div className="absolute pointer-events-none z-0" style={{
        top: '-10%', left: '-15%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)', animation: 'medal-pulse 6s ease-in-out infinite',
      }} />
      <div className="absolute pointer-events-none z-0" style={{
        bottom: '-15%', right: '-10%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(255,184,28,0.16) 0%, transparent 70%)',
        filter: 'blur(48px)', animation: 'medal-pulse 8s ease-in-out 1s infinite',
      }} />

      <div className="relative z-10 mb-6" style={{ animation: 'pop-bounce-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both' }}>
        <HsbcHexagon size={110} />
      </div>

      <h1 className="relative z-10 font-black leading-[0.95] text-white" style={{
        fontSize: 'clamp(3rem, 11vw, 9rem)',
        letterSpacing: '0.04em',
        textShadow: '0 4px 30px rgba(0,0,0,0.45)',
        animation: 'title-slam 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both',
      }}>
        BINGO DASH
      </h1>

      <p className="relative z-10 mt-5 text-white/95 font-light" style={{
        fontSize: 'clamp(1.1rem, 2.4vw, 1.8rem)',
        letterSpacing: '0.02em',
        animation: 'slide-up-fade 0.7s ease-out 0.85s both',
      }}>
        HSBC KL Explorace 2026
      </p>

      <div className="relative z-10 mt-6 mx-auto" style={{
        width: 60, height: 2, background: 'rgba(255,255,255,0.65)',
        animation: 'slide-up-fade 0.6s ease-out 1.05s both',
      }} />

      <p className="relative z-10 mt-6 text-white/85 font-bold uppercase" style={{
        fontSize: 'clamp(0.85rem, 1.4vw, 1.05rem)',
        letterSpacing: '0.4em',
        animation: 'slide-up-fade 0.7s ease-out 1.25s both',
      }}>
        Participant Briefing
      </p>
    </div>
  )
}

// ── 2. Holding slide (gold animated) ─────────────────────────────────────
function HoldingSlide({ slideIdx }: { slideIdx: number }) {
  return (
    <div key={slideIdx} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 award-slide-enter">
      <div className="absolute top-1/2 left-1/2 pointer-events-none z-0" style={{
        width: '160vmax', height: '160vmax',
        background: `conic-gradient(from 0deg, transparent 0deg, #fcd34d22 18deg, transparent 40deg, transparent 170deg, #fcd34d22 200deg, transparent 230deg, transparent 360deg)`,
        animation: 'award-spotlight 26s linear infinite',
        opacity: 0.55,
      }} />

      <p className="relative z-10 text-[11px] sm:text-xs font-bold uppercase tracking-[0.5em] text-amber-200/80"
         style={{ animation: 'slide-down-fade 0.55s ease-out 0.15s both' }}>
        Welcome, Explorers
      </p>

      <h1 className="relative z-10 mt-3 font-black leading-none animate-gold-title" style={{
        fontSize: 'clamp(3rem, 11vw, 9rem)',
        letterSpacing: '0.05em',
        animation: 'title-slam 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both, gold-sweep 6s linear 0.3s infinite',
      }}>
        Briefing
      </h1>

      <p className="relative z-10 mt-10 text-white/40 text-xs uppercase tracking-[0.4em]"
         style={{ animation: 'slide-up-fade 0.6s ease-out 1.0s both' }}>
        ▶ Continue for the rules
      </p>
    </div>
  )
}

// ── 3. How to Play ───────────────────────────────────────────────────────
function HowToPlaySlide({ slideIdx }: { slideIdx: number }) {
  const items = [
    { icon: '🗺', title: 'Roam the route', body: 'Explore the locations marked on your team map. Tasks are scattered around the area.' },
    { icon: '🔲', title: 'Fill a 5 × 5 card', body: 'Each task you complete unlocks a tile on your team\'s bingo card.' },
    { icon: '🎯', title: 'Form Bingo lines', body: 'Any complete row, column, or diagonal scores extra points for your team.' },
    { icon: '⏱', title: 'Beat the clock', body: 'You\'re competing against time and other teams. More tasks done = more points.' },
  ]
  return (
    <ContentShell slideIdx={slideIdx} pretitle="How It Works" title="How to Play" beam="#fcd34d">
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-5xl w-full mx-auto">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-white/15 bg-white/5"
               style={{ animation: `pop-bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) ${0.55 + i * 0.1}s both` }}>
            <div className="text-4xl leading-none flex-shrink-0">{it.icon}</div>
            <div className="text-left">
              <p className="text-amber-200 font-black text-lg leading-tight">{it.title}</p>
              <p className="text-white/80 text-sm sm:text-base mt-1.5 leading-snug" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {it.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ContentShell>
  )
}

// ── 4. Read the Card ─────────────────────────────────────────────────────
function ReadCardSlide({ slideIdx }: { slideIdx: number }) {
  const tiles: Array<'locked' | 'scanned' | 'done' | 'bingo'> = [
    'done',   'bingo',  'done',   'locked', 'scanned',
    'locked', 'bingo',  'scanned','done',   'locked',
    'done',   'bingo',  'done',   'locked', 'scanned',
    'scanned','bingo',  'locked', 'done',   'locked',
    'locked', 'bingo',  'done',   'scanned','done',
  ]
  const legend = [
    { kind: 'locked',  label: 'Locked',    desc: 'Not visited yet' },
    { kind: 'scanned', label: 'Scanned',   desc: 'You scanned it — finish to lock the tile' },
    { kind: 'done',    label: 'Done',      desc: 'Task completed' },
    { kind: 'bingo',   label: 'Bingo Line',desc: 'Five-in-a-row! Bonus points' },
  ] as const

  return (
    <ContentShell slideIdx={slideIdx} pretitle="Reading the Card" title="Your Bingo Card" beam="#a5f3fc">
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-10 max-w-6xl w-full mx-auto">
        {/* 5x5 grid */}
        <div className="grid grid-cols-5 gap-2 p-4 rounded-2xl bg-black/30 border border-white/10"
             style={{ animation: 'pop-bounce-in 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }}>
          {tiles.map((t, i) => <DemoTile key={i} kind={t} />)}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 max-w-md w-full">
          {legend.map((l, i) => (
            <div key={l.kind} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10"
                 style={{ animation: `slide-up-fade 0.5s ease-out ${0.65 + i * 0.1}s both` }}>
              <DemoTile kind={l.kind} small />
              <div className="text-left">
                <p className="text-white font-black text-base leading-tight">{l.label}</p>
                <p className="text-white/60 text-xs mt-0.5" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {l.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ContentShell>
  )
}

function DemoTile({ kind, small = false }: { kind: 'locked' | 'scanned' | 'done' | 'bingo'; small?: boolean }) {
  const size = small ? 38 : 64
  const palette = {
    locked:  { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', icon: '', glow: '' },
    scanned: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.55)', icon: '•',  glow: '' },
    done:    { bg: 'rgba(255,255,255,0.92)', border: 'rgba(255,255,255,0.92)', icon: '✓',  glow: '' },
    bingo:   { bg: '#fbbf24',                 border: '#fde68a',               icon: '✓',  glow: '0 0 12px rgba(251,191,36,0.7)' },
  }[kind]
  const iconColor = kind === 'done' ? '#0a0a0a' : kind === 'bingo' ? '#1a0f00' : '#fff'
  return (
    <div
      className="rounded-md flex items-center justify-center font-black"
      style={{
        width: size, height: size,
        background: palette.bg, border: `2px solid ${palette.border}`,
        boxShadow: palette.glow, color: iconColor,
        fontSize: small ? 16 : 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {palette.icon}
    </div>
  )
}

// ── 5. Player vs Observer ────────────────────────────────────────────────
function RolesSlide({ slideIdx }: { slideIdx: number }) {
  const cards = [
    {
      icon: '🎯',
      title: 'Player',
      colour: '#DB0011',
      ringColour: '#fca5a5',
      body: [
        'Joins a team of up to 4',
        'Enters the team\'s 4-digit password',
        'Scans, submits, and completes tasks',
        'Earns points & forms Bingo lines',
      ],
    },
    {
      icon: '👁',
      title: 'Observer',
      colour: '#2563eb',
      ringColour: '#93c5fd',
      body: [
        'Scans the Observer QR — no password',
        'Browses the live board read-only',
        'Cannot submit, scan, or complete',
        'Great for HSBC guests & sponsors',
      ],
    },
  ]
  return (
    <ContentShell slideIdx={slideIdx} pretitle="Two Roles" title="Player vs Observer" beam="#a5f3fc">
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full mx-auto">
        {cards.map((c, i) => (
          <div key={c.title}
               className="p-7 rounded-3xl border-2 flex flex-col gap-4"
               style={{
                 borderColor: `${c.ringColour}55`,
                 background: `linear-gradient(160deg, ${c.colour}22 0%, rgba(0,0,0,0.4) 100%)`,
                 boxShadow: `0 0 40px ${c.colour}22`,
                 animation: `pop-bounce-in 0.6s cubic-bezier(0.34,1.56,0.64,1) ${0.5 + i * 0.15}s both`,
               }}>
            <div className="flex items-center gap-4">
              <div className="text-5xl" style={{ filter: `drop-shadow(0 0 12px ${c.colour}99)` }}>{c.icon}</div>
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.4em]"
                   style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Role</p>
                <h3 className="text-white font-black text-3xl tracking-tight leading-none">{c.title}</h3>
              </div>
            </div>
            <ul className="flex flex-col gap-2 text-left mt-2"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {c.body.map((b, j) => (
                <li key={j} className="flex items-start gap-2.5 text-white/85 text-sm sm:text-base">
                  <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: c.ringColour }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ContentShell>
  )
}

// ── 6. Submission Types ──────────────────────────────────────────────────
function SubmissionTypesSlide({ slideIdx }: { slideIdx: number }) {
  const types = [
    {
      icon: '✋',
      title: 'Standard',
      tint: '#22c55e',
      body: 'Show up at the location. A marshal verifies and unlocks the tile for you.',
    },
    {
      icon: '📸',
      title: 'Photo',
      tint: '#f59e0b',
      body: 'Snap a photo that meets the brief. Upload it — a marshal approves before the tile turns Done.',
    },
    {
      icon: '⌨',
      title: 'Answer',
      tint: '#a855f7',
      body: 'Type the correct word or code. The tile unlocks the moment your answer matches.',
    },
  ]
  return (
    <ContentShell slideIdx={slideIdx} pretitle="What You’ll Do" title="Submission Types" beam="#fcd34d">
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl w-full mx-auto">
        {types.map((t, i) => (
          <div key={t.title}
               className="p-6 rounded-3xl border-2 flex flex-col gap-3"
               style={{
                 borderColor: `${t.tint}55`,
                 background: `linear-gradient(160deg, ${t.tint}22 0%, rgba(0,0,0,0.35) 100%)`,
                 animation: `pop-bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) ${0.5 + i * 0.12}s both`,
               }}>
            <div className="text-5xl leading-none" style={{ filter: `drop-shadow(0 0 12px ${t.tint}aa)` }}>{t.icon}</div>
            <h3 className="text-white font-black text-2xl leading-tight">{t.title}</h3>
            <p className="text-white/80 text-sm sm:text-base leading-snug"
               style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {t.body}
            </p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-8 max-w-4xl mx-auto px-5 py-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 text-amber-100 text-sm sm:text-base"
           style={{ fontFamily: 'system-ui, -apple-system, sans-serif',
                    animation: 'slide-up-fade 0.6s ease-out 0.95s both' }}>
        <span className="font-black mr-2">👮 Marshal-required tasks:</span>
        some tiles need a Marshal password before completion — look for the marshal badge in-app.
      </div>
    </ContentShell>
  )
}

// ── 7. How to Submit ─────────────────────────────────────────────────────
function HowToSubmitSlide({ slideIdx }: { slideIdx: number }) {
  const steps = [
    { n: '1', title: 'Tap a tile', body: 'Open any visible tile on your bingo card.' },
    { n: '2', title: 'Read the brief', body: 'Check what the task asks for and the points on offer.' },
    { n: '3', title: 'Do the task', body: 'Find the spot, do the activity, capture the photo, or solve the answer.' },
    { n: '4', title: 'Submit in-app', body: 'Upload the photo, type the answer, or call the marshal over.' },
    { n: '5', title: 'Watch it turn Done', body: 'Once approved, the tile flips to ✓ and the score updates live.' },
  ]
  return (
    <ContentShell slideIdx={slideIdx} pretitle="Step by Step" title="How to Submit" beam="#fcd34d">
      <div className="relative z-10 flex flex-col gap-3 max-w-4xl w-full mx-auto">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/10"
               style={{ animation: `slide-up-fade 0.5s ease-out ${0.45 + i * 0.1}s both` }}>
            <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl"
                 style={{
                   background: 'linear-gradient(160deg, #fbbf24 0%, #d97706 100%)',
                   color: '#1a0a00',
                   boxShadow: '0 0 18px rgba(251,191,36,0.45)',
                 }}>
              {s.n}
            </div>
            <div className="text-left">
              <p className="text-amber-200 font-black text-lg sm:text-xl leading-tight">{s.title}</p>
              <p className="text-white/80 text-sm sm:text-base mt-0.5"
                 style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ContentShell>
  )
}

// ── 8. Safety ────────────────────────────────────────────────────────────
function SafetySlide({ slideIdx }: { slideIdx: number }) {
  const rules = [
    { icon: '🚦', text: 'Cross roads only at marked crossings — pavements over speed.' },
    { icon: '👫', text: 'Stay together as a team. No teammate left behind.' },
    { icon: '💧', text: 'Hydrate often — Colmar in April can still be cold AND tiring.' },
    { icon: '🚫', text: 'Respect locals, signage, and private property — no climbing, no trespass.' },
    { icon: '📱', text: 'Keep your phone charged — it\'s your bingo card and your lifeline.' },
  ]
  const contacts = [
    { name: 'Bryan Ng',  phone: '012-661 1043', role: 'Facilitator' },
    { name: 'Susan Yap', phone: '012-370 3732', role: 'InStep' },
    { name: 'Ariel Lai', phone: '016-939 1957', role: 'HSBC' },
  ]
  return (
    <ContentShell slideIdx={slideIdx} pretitle="Stay Safe Out There" title="Safety First" beam="#fca5a5">
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full mx-auto items-stretch">
        {/* Rules */}
        <div className="flex flex-col gap-2.5">
          {rules.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                 style={{ animation: `slide-up-fade 0.45s ease-out ${0.4 + i * 0.08}s both` }}>
              <div className="text-2xl flex-shrink-0">{r.icon}</div>
              <p className="text-white/85 text-sm sm:text-base leading-snug text-left"
                 style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {r.text}
              </p>
            </div>
          ))}
        </div>

        {/* Emergency contacts */}
        <div className="rounded-2xl border-2 border-red-400/40 bg-red-950/40 overflow-hidden"
             style={{ animation: `pop-bounce-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.55s both` }}>
          <div className="px-5 py-3 flex items-center gap-2 border-b border-red-400/30 bg-red-900/40">
            <span className="text-xl">🆘</span>
            <span className="text-red-200 text-xs font-black uppercase tracking-[0.3em]"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Emergency Contacts
            </span>
          </div>
          <div className="divide-y divide-red-400/20">
            {contacts.map(c => (
              <div key={c.phone} className="flex items-center justify-between px-5 py-3.5 gap-3 text-left">
                <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  <div className="text-white text-base font-black leading-tight">{c.name}</div>
                  <div className="text-red-300/80 text-xs font-semibold mt-0.5">{c.role}</div>
                </div>
                <div className="text-red-200 text-base sm:text-lg font-black tracking-wide tabular-nums"
                     style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {c.phone}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ContentShell>
  )
}

// ── 9. QR + safety wish (HSBC red closer) ────────────────────────────────
function QrWishSlide({ slideIdx, sectionSlug, sectionName }: {
  slideIdx: number; sectionSlug: string; sectionName: string
}) {
  const observerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/bingo-dash/play/${sectionSlug}?mode=observer`
    : ''

  return (
    <div key={slideIdx} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 award-slide-enter">
      {/* Soft animated blobs */}
      <div className="absolute pointer-events-none z-0" style={{
        top: '-12%', left: '-12%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)', animation: 'medal-pulse 6s ease-in-out infinite',
      }} />
      <div className="absolute pointer-events-none z-0" style={{
        bottom: '-12%', right: '-10%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(255,184,28,0.18) 0%, transparent 70%)',
        filter: 'blur(48px)', animation: 'medal-pulse 8s ease-in-out 1s infinite',
      }} />

      <p className="relative z-10 text-white/85 text-[11px] sm:text-xs font-bold uppercase tracking-[0.5em]"
         style={{ animation: 'slide-down-fade 0.55s ease-out 0.1s both' }}>
        Observers · {sectionName}
      </p>

      <h1 className="relative z-10 mt-3 font-black text-white leading-[0.95]" style={{
        fontSize: 'clamp(2rem, 6vw, 4.5rem)',
        letterSpacing: '0.03em',
        textShadow: '0 4px 30px rgba(0,0,0,0.45)',
        animation: 'title-slam 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
      }}>
        Scan to Watch the Board
      </h1>

      <div className="relative z-10 mt-7 bg-white p-5 rounded-3xl shadow-2xl"
           style={{
             animation: 'pop-bounce-in 0.75s cubic-bezier(0.34,1.56,0.64,1) 0.55s both',
             boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(255,184,28,0.25)',
           }}>
        {observerUrl && <QRCodeSVG value={observerUrl} size={260} level="H" />}
      </div>

      <p className="relative z-10 mt-5 text-white/80 text-xs sm:text-sm font-mono break-all max-w-md"
         style={{ animation: 'slide-up-fade 0.6s ease-out 0.95s both' }}>
        {observerUrl}
      </p>

      <div className="relative z-10 mt-7 flex items-center gap-3 max-w-xl"
           style={{ animation: 'slide-up-fade 0.7s ease-out 1.15s both' }}>
        <span className="h-px flex-1 bg-white/40" />
        <p className="text-white font-black text-lg sm:text-2xl uppercase tracking-[0.25em] whitespace-nowrap"
           style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
          🍀 Stay safe · Have fun
        </p>
        <span className="h-px flex-1 bg-white/40" />
      </div>

      <p className="relative z-10 mt-3 text-white/85 text-sm sm:text-base font-light italic max-w-2xl"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                  animation: 'slide-up-fade 0.7s ease-out 1.35s both' }}>
        From all of us at HSBC — wishing you a memorable, safe, and winning Explorace.
      </p>
    </div>
  )
}

// ── Shared content shell (dark purple style) ─────────────────────────────
function ContentShell({ slideIdx, pretitle, title, beam, children }: {
  slideIdx: number
  pretitle: string
  title: string
  beam: string
  children: React.ReactNode
}) {
  return (
    <div key={slideIdx} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 sm:px-10 py-20 award-slide-enter overflow-hidden">
      <div className="absolute top-1/2 left-1/2 pointer-events-none z-0" style={{
        width: '160vmax', height: '160vmax',
        background: `conic-gradient(from 0deg, transparent 0deg, ${beam}33 18deg, transparent 40deg, transparent 170deg, ${beam}22 200deg, transparent 230deg, transparent 360deg)`,
        animation: 'award-spotlight 24s linear infinite',
        opacity: 0.6,
      }} />

      <p className="relative z-10 text-[11px] sm:text-xs font-bold uppercase tracking-[0.5em] text-amber-200/80"
         style={{ animation: 'slide-down-fade 0.55s ease-out 0.1s both' }}>
        {pretitle}
      </p>

      <h1 className="relative z-10 mt-3 mb-8 font-black leading-none animate-gold-title" style={{
        fontSize: 'clamp(2rem, 6vw, 4.5rem)',
        letterSpacing: '0.05em',
        animation: 'title-slam 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both, gold-sweep 6s linear 0.25s infinite',
      }}>
        {title}
      </h1>

      {children}
    </div>
  )
}

// ── HSBC hexagon mark ────────────────────────────────────────────────────
function HsbcHexagon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 140"
      style={{ width: size, height: 'auto', filter: 'drop-shadow(0 6px 22px rgba(0,0,0,0.55))' }}
    >
      <polygon points="0,70 65,0 65,140" fill="#fff" />
      <polygon points="260,70 195,0 195,140" fill="#fff" />
      <polygon points="65,0 130,70 195,0" fill="#fff" />
      <polygon points="65,140 130,70 195,140" fill="#fff" />
      <polygon points="65,0 130,70 65,140" fill="rgba(200,0,12,.7)" />
      <polygon points="195,0 130,70 195,140" fill="rgba(200,0,12,.7)" />
    </svg>
  )
}
