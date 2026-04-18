import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFullscreen } from '../hooks/useFullscreen'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoSection, BingoTeam, BingoScan, BingoTask } from '../types/database'

const SLIDE_COUNT = 6 // 3 consolation + bronze + silver + gold, played from last to first

const BINGO_LINES: number[][] = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
]

export function BingoDashAwardSlides() {
  const { sectionSlug } = useParams<{ sectionSlug?: string }>()
  if (!sectionSlug) return <SectionPicker />
  return <AwardShow key={sectionSlug} sectionSlug={sectionSlug} />
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
          🏆 AWARD SLIDES
        </h1>
        <p className="text-gray-400 text-lg sm:text-xl mt-3 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          Pick a compartment to run the awards ceremony
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
              onClick={() => navigate(`/bingo-dash/slides/awards/${s.slug}`)}
              className="animate-bounce-in flex flex-col items-center gap-4 px-10 py-10 rounded-3xl w-72 hover:scale-105 transition-transform text-left"
              style={{
                animationDelay: `${0.25 + i * 0.08}s`,
                opacity: 0,
                animationFillMode: 'forwards',
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${isActive ? '#fbbf24' : '#a855f733'}`,
                boxShadow: isActive ? '0 0 32px rgba(251,191,36,0.25)' : 'none',
              }}
            >
              <div className="text-6xl animate-float" style={{ filter: isActive ? 'drop-shadow(0 0 20px #fbbf24aa)' : 'none' }}>
                🎖
              </div>
              <div className="text-center w-full">
                <h2 className="text-xl font-black text-white tracking-tight">{s.name}</h2>
                {isActive && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    ● Active now
                  </span>
                )}
              </div>
              <span
                className="w-full py-3 rounded-xl text-center text-sm font-black tracking-wider"
                style={{ background: '#fbbf24', color: '#000' }}
              >
                ▶ RUN AWARDS
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide show ───────────────────────────────────────────────────────────
type RankedTeam = {
  team: BingoTeam
  basePoints: number
  bonusPoints: number
  total: number
  bingos: number
  tasksDone: number
}

function AwardShow({ sectionSlug }: { sectionSlug: string }) {
  const navigate = useNavigate()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const [section, setSection] = useState<BingoSection | null>(null)
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: sec } = await supabase.from('bingo_sections').select('*').eq('slug', sectionSlug).maybeSingle()
      if (!sec || cancelled) { setLoaded(true); return }
      setSection(sec)
      const [{ data: t }, { data: s }, { data: gt }] = await Promise.all([
        supabase.from('bingo_teams').select('*').eq('section_id', sec.id).order('name'),
        supabase.from('bingo_scans').select('*'),
        supabase.from('bingo_tasks').select('*').eq('section_id', sec.id).eq('in_grid', true).order('sort_order'),
      ])
      if (cancelled) return
      setTeams(t ?? [])
      setScans(s ?? [])
      setGridTasks(gt ?? [])
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [sectionSlug])

  const ranked: RankedTeam[] = useMemo(() => {
    if (!teams.length || !gridTasks.length) {
      // Even without grid tasks we can still rank by bonus only
      return teams
        .map<RankedTeam>(team => ({
          team,
          basePoints: 0,
          bonusPoints: team.bonus_points ?? 0,
          total: team.bonus_points ?? 0,
          bingos: 0,
          tasksDone: 0,
        }))
        .sort(rankCompare)
    }
    const slots: (BingoTask | null)[] = Array(25).fill(null)
    gridTasks.forEach(t => { if (t.sort_order >= 0 && t.sort_order < 25) slots[t.sort_order] = t })
    const gridTaskIds = new Set(gridTasks.map(t => t.id))
    const computed: RankedTeam[] = teams.map(team => {
      const teamScans = scans.filter(sc => sc.team_id === team.id && sc.completed && gridTaskIds.has(sc.task_id))
      const completedIds = new Set(teamScans.map(sc => sc.task_id))
      const basePoints = gridTasks.reduce((sum, t) => completedIds.has(t.id) ? sum + (t.points ?? 0) : sum, 0)
      const bonusPoints = team.bonus_points ?? 0
      const bingos = BINGO_LINES.filter(line => line.every(i => {
        const t = slots[i]
        return t && completedIds.has(t.id)
      })).length
      return {
        team,
        basePoints,
        bonusPoints,
        total: basePoints + bonusPoints,
        bingos,
        tasksDone: completedIds.size,
      }
    })
    computed.sort(rankCompare)
    return computed
  }, [teams, scans, gridTasks])

  // Pad to fixed 6 slots; null slots render as "no team".
  const top6: (RankedTeam | null)[] = useMemo(() => {
    return Array.from({ length: SLIDE_COUNT }, (_, i) => ranked[i] ?? null)
  }, [ranked])

  // Slides are played bottom-up: slide 0 = 6th place, slide 5 = 1st place.
  const currentRank = SLIDE_COUNT - slideIdx // 6,5,4,3,2,1
  const current: RankedTeam | null = top6[currentRank - 1] ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setSlideIdx(i => Math.min(SLIDE_COUNT - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault()
        setSlideIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Escape') {
        navigate('/bingo-dash/slides/awards')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (!loaded) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading…</div>
  }
  if (!section) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4 p-8 text-center">
        <p className="text-2xl font-black">Compartment not found.</p>
        <a href="/bingo-dash/slides/awards" className="text-amber-400 hover:text-amber-300 underline">Pick another</a>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden relative cursor-pointer select-none"
      onClick={() => setSlideIdx(i => Math.min(SLIDE_COUNT - 1, i + 1))}
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #3b1f66 0%, #180a33 55%, #06020f 100%)',
        fontFamily: `'Cinzel', 'Trajan Pro', 'Palatino Linotype', Georgia, serif`,
      }}
    >
      <AwardSlide key={slideIdx} slideIdx={slideIdx} rank={currentRank} ranked={current} />

      {/* Top nav */}
      <div className="absolute top-5 left-6 right-6 flex items-center justify-between text-[11px] text-white/50 font-semibold uppercase tracking-[0.25em] z-40">
        <a
          href="/bingo-dash/slides/awards"
          onClick={e => e.stopPropagation()}
          className="hover:text-white transition-colors"
        >
          ← Awards Home
        </a>
        <span className="hidden sm:inline">{section.name} · Slide {slideIdx + 1} / {SLIDE_COUNT}</span>
        <button
          onClick={e => { e.stopPropagation(); toggleFullscreen() }}
          className="hover:text-white transition-colors"
        >
          {isFullscreen ? 'Exit ⛶' : 'Fullscreen ⛶'}
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute top-14 left-0 right-0 flex items-center justify-center gap-2 z-40">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              background: i <= slideIdx ? '#fbbf24' : 'rgba(255,255,255,0.18)',
              boxShadow: i === slideIdx ? '0 0 10px #fbbf24' : 'none',
              transform: i === slideIdx ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Back button */}
      {slideIdx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setSlideIdx(i => Math.max(0, i - 1)) }}
          className="absolute bottom-10 left-8 z-40 text-white/40 hover:text-white transition-colors text-xs uppercase tracking-[0.3em] font-bold"
        >
          ← Back
        </button>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-white/30 uppercase tracking-[0.35em] z-40 font-semibold pointer-events-none">
        {slideIdx < SLIDE_COUNT - 1 ? '▶ Click / Space / → to continue' : '✦ End of Awards · Esc to exit'}
      </div>
    </div>
  )
}

// Sort: higher total first, then more bingos, then more tasks done, then name asc
function rankCompare(a: RankedTeam, b: RankedTeam): number {
  return (
    b.total - a.total ||
    b.bingos - a.bingos ||
    b.tasksDone - a.tasksDone ||
    a.team.name.localeCompare(b.team.name)
  )
}

// ── Single slide ─────────────────────────────────────────────────────────
type Tier = 'consolation' | 'bronze' | 'silver' | 'gold'
function tierForRank(rank: number): Tier {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'consolation'
}

const TIER = {
  consolation: {
    preLabel: 'Honorable Mention',
    medal: '🎖',
    medalSize: '3rem',
    labelColor: '#c4b5fd',
    beamColor: '#a855f7',
    ringBg: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #c084fc 70%, #7c3aed 100%)',
    ringGlow: 'rgba(168,85,247,0.6)',
    ringWidth: '6px',
    confetti: 34,
    photoSize: 220,
    useGoldSweep: false,
  },
  bronze: {
    preLabel: 'Second Runner-Up',
    medal: '🥉',
    medalSize: '4rem',
    labelColor: '#f59e0b',
    beamColor: '#b45309',
    ringBg: 'linear-gradient(135deg, #92400e 0%, #b45309 35%, #f59e0b 55%, #b45309 75%, #92400e 100%)',
    ringGlow: 'rgba(245,158,11,0.7)',
    ringWidth: '8px',
    confetti: 70,
    photoSize: 260,
    useGoldSweep: false,
  },
  silver: {
    preLabel: 'First Runner-Up',
    medal: '🥈',
    medalSize: '5rem',
    labelColor: '#e5e7eb',
    beamColor: '#9ca3af',
    ringBg: 'linear-gradient(135deg, #9ca3af 0%, #e5e7eb 30%, #ffffff 50%, #e5e7eb 70%, #9ca3af 100%)',
    ringGlow: 'rgba(229,231,235,0.8)',
    ringWidth: '10px',
    confetti: 110,
    photoSize: 300,
    useGoldSweep: false,
  },
  gold: {
    preLabel: 'Grand Champion',
    medal: '🥇',
    medalSize: '6rem',
    labelColor: '#fde047',
    beamColor: '#facc15',
    ringBg: 'linear-gradient(135deg, #c48c33 0%, #fde047 30%, #fff8d8 50%, #fde047 70%, #c48c33 100%)',
    ringGlow: 'rgba(253,224,71,0.9)',
    ringWidth: '14px',
    confetti: 180,
    photoSize: 340,
    useGoldSweep: true,
  },
} as const

function tierTitle(tier: Tier, rank: number): string {
  if (tier === 'gold') return '🏆 GRAND WINNER'
  if (tier === 'silver') return '🥈 FIRST RUNNER-UP'
  if (tier === 'bronze') return '🥉 SECOND RUNNER-UP'
  return `#${rank}  HONORABLE MENTION`
}

function AwardSlide({ slideIdx, rank, ranked }: { slideIdx: number; rank: number; ranked: RankedTeam | null }) {
  const tier = tierForRank(rank)
  const cfg = TIER[tier]
  const hasTeam = !!ranked

  return (
    <div key={slideIdx} className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 award-slide-enter">

      {/* Rotating spotlight conic gradient */}
      <div
        className="absolute top-1/2 left-1/2 pointer-events-none z-0"
        style={{
          width: '160vmax',
          height: '160vmax',
          background: `conic-gradient(from 0deg, transparent 0deg, ${cfg.beamColor}33 18deg, transparent 40deg, transparent 170deg, ${cfg.beamColor}22 200deg, transparent 230deg, transparent 360deg)`,
          animation: 'award-spotlight 22s linear infinite',
          opacity: 0.75,
        }}
      />

      {/* Confetti */}
      <Confetti count={cfg.confetti} slideKey={slideIdx} />

      {/* Pre-label (small) */}
      <p
        className="relative z-10 text-[11px] sm:text-xs font-bold uppercase tracking-[0.5em] opacity-70"
        style={{
          color: cfg.labelColor,
          animation: 'slide-down-fade 0.55s ease-out 0.15s both',
        }}
      >
        {cfg.preLabel}
      </p>

      {/* Big tier title */}
      <h1
        className={`relative z-10 mt-3 mb-8 font-black leading-none ${cfg.useGoldSweep ? 'animate-gold-title' : ''}`}
        style={{
          fontSize: tier === 'gold'
            ? 'clamp(2.6rem, 9vw, 7rem)'
            : tier === 'silver'
              ? 'clamp(2.4rem, 8vw, 6rem)'
              : tier === 'bronze'
                ? 'clamp(2.2rem, 7vw, 5.4rem)'
                : 'clamp(1.6rem, 5vw, 3.4rem)',
          letterSpacing: '0.05em',
          color: cfg.useGoldSweep ? undefined : cfg.labelColor,
          animation: `title-slam 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both${cfg.useGoldSweep ? ', gold-sweep 6s linear 0.3s infinite' : ''}`,
          textShadow: cfg.useGoldSweep ? undefined : `0 0 30px ${cfg.labelColor}88`,
        }}
      >
        {tierTitle(tier, rank)}
      </h1>

      {hasTeam ? (
        <>
          {/* Team photo with medal ring */}
          <div
            className="relative z-10"
            style={{ animation: 'pop-bounce-in 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both' }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: `${cfg.photoSize}px`,
                height: `${cfg.photoSize}px`,
                borderRadius: '50%',
                background: cfg.ringBg,
                padding: cfg.ringWidth,
                boxShadow: `0 0 70px ${cfg.ringGlow}, inset 0 0 22px rgba(0,0,0,0.3)`,
                animation: 'medal-pulse 2.8s ease-in-out 1.1s infinite',
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                {ranked.team.photo_url ? (
                  <img src={ranked.team.photo_url} alt={ranked.team.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-7xl text-white/40">👥</div>
                )}
              </div>
              {/* Medal badge */}
              <div
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 select-none"
                style={{
                  fontSize: cfg.medalSize,
                  filter: `drop-shadow(0 6px 14px ${cfg.ringGlow})`,
                  animation: 'medal-drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1s both',
                }}
              >
                {cfg.medal}
              </div>
            </div>
          </div>

          {/* Team name */}
          <h2
            className="relative z-10 font-black text-white mt-8 mb-1"
            style={{
              fontSize: tier === 'gold'
                ? 'clamp(2rem, 6vw, 5rem)'
                : tier === 'silver'
                  ? 'clamp(1.8rem, 5.5vw, 4.4rem)'
                  : tier === 'bronze'
                    ? 'clamp(1.6rem, 5vw, 4rem)'
                    : 'clamp(1.4rem, 4vw, 3.2rem)',
              letterSpacing: '0.03em',
              animation: 'slide-up-fade 0.6s ease-out 1.35s both',
              textShadow: `0 4px 34px ${cfg.ringGlow}`,
            }}
          >
            {ranked.team.name}
          </h2>

          {/* Stats row */}
          <div
            className="relative z-10 flex gap-8 mt-3 text-white/85"
            style={{ animation: 'slide-up-fade 0.6s ease-out 1.6s both' }}
          >
            <Stat label="Total" value={String(ranked.total)} accent={cfg.labelColor} />
            {ranked.bonusPoints > 0 && (
              <Stat label="Bonus" value={`+${ranked.bonusPoints}`} accent="#c4b5fd" />
            )}
            <Stat label="Bingos" value={`${ranked.bingos}`} accent="#ffffff" />
            <Stat label="Tasks" value={`${ranked.tasksDone}`} accent="#ffffff" />
          </div>
        </>
      ) : (
        <p
          className="relative z-10 text-white/60 text-xl mt-6"
          style={{ animation: 'slide-up-fade 0.6s ease-out 0.5s both' }}
        >
          No team for this position yet.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">{label}</p>
      <p className="text-2xl sm:text-3xl font-black" style={{ color: accent }}>{value}</p>
    </div>
  )
}

// ── Confetti ─────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#fde047', '#facc15', '#f59e0b',
  '#a855f7', '#c084fc', '#8b5cf6',
  '#ec4899', '#f472b6',
  '#22d3ee', '#34d399',
  '#ef4444', '#f97316',
  '#e5e7eb', '#ffffff',
]

function Confetti({ count, slideKey }: { count: number; slideKey: number }) {
  const pieces = useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      id: `${slideKey}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.6 + Math.random() * 2.8,
      size: 5 + Math.random() * 10,
      rotate: Math.random() * 360,
      spin: 360 + Math.random() * 1080,
      drift: (Math.random() - 0.5) * 320,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      circle: Math.random() > 0.65,
    }))
  ), [count, slideKey])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {pieces.map(p => (
        <span
          key={p.id}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size * (p.circle ? 1 : 0.4)}px`,
            background: p.color,
            borderRadius: p.circle ? '50%' : '1px',
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-drift ${p.duration}s ${p.delay}s linear forwards`,
            boxShadow: `0 0 4px ${p.color}`,
            opacity: 0,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
