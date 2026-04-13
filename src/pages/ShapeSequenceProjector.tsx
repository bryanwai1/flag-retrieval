import { useShapeSequence, type Shape, type ShapeRound, type ShapeResult } from '../hooks/useShapeSequence'
import { ParticleBackground } from '../components/ParticleBackground'

export function ShapeSequenceProjector() {
  const { rounds, results } = useShapeSequence()

  const activeRound = rounds.find(r => r.is_active) ?? null
  const showScoreboard = rounds.some(r => r.results_visible) && results.length > 0

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-6 py-6">
      <ParticleBackground />

      {/* Nav */}
      <a
        href="/"
        className="absolute top-4 left-5 z-20 text-white/30 hover:text-white/60 text-sm font-medium transition-colors"
      >
        ← Home
      </a>
      <a
        href="/shape-sequence/admin"
        className="absolute top-4 right-5 z-20 px-3 py-1.5 rounded-lg bg-white/10 text-white/50 hover:text-white text-sm font-bold transition-all"
      >
        ⚙ Admin
      </a>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="text-5xl font-black text-white tracking-tight animate-slide-up">
          SHAPE SEQUENCE
        </h1>
        {activeRound && (
          <div className="mt-2 text-blue-400 font-bold text-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
            ROUND {activeRound.round_number} &bull; {activeRound.circle_count} CIRCLES
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-[1700px] flex flex-col items-center gap-6">
        {!activeRound ? (
          <>
            <WaitingState />
            {showScoreboard && <FullScoreboard rounds={rounds} results={results} />}
          </>
        ) : (
          <>
            <ShapeGrid round={activeRound} />
            {showScoreboard && <FullScoreboard rounds={rounds} results={results} />}
          </>
        )}
      </div>
    </div>
  )
}

function WaitingState() {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-6 animate-float">⏳</div>
      <p className="text-white/40 text-2xl font-bold">Waiting for facilitator to start a round…</p>
    </div>
  )
}

function ShapeGrid({ round }: { round: ShapeRound }) {
  const cols = round.circle_count === 20 ? 10 : 15
  const cellSize = round.circle_count === 20 ? 88 : 68
  const shapes = padShapes(round.shapes, round.circle_count)

  return (
    <div
      className="animate-bounce-in rounded-3xl p-5"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 60px rgba(96,165,250,0.1)',
      }}
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
      >
        {shapes.map((shape, i) => (
          <div
            key={i}
            className="animate-bounce-in rounded-full flex items-center justify-center"
            style={{
              width: cellSize,
              height: cellSize,
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(255,255,255,0.15)',
              animationDelay: `${i * 0.02}s`,
              animationFillMode: 'backwards',
            }}
          >
            <ShapeIcon shape={shape} size={Math.round(cellSize * 0.52)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FullScoreboard({ rounds, results }: { rounds: ShapeRound[]; results: ShapeResult[] }) {
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)

  // Collect all unique teams across all results
  const allTeams = Array.from(new Set(results.map(r => r.team_name)))

  // Build per-team data
  type TeamRow = { name: string; times: (number | null)[]; total: number }
  const rows: TeamRow[] = allTeams.map(team => {
    const times = sortedRounds.map(round => {
      const r = results.find(res => res.round_id === round.id && res.team_name === team)
      return r ? r.completion_time : null
    })
    const total = times.reduce<number>((sum, t) => sum + (t ?? 0), 0)
    return { name: team, times, total }
  })

  // Sort: teams with all rounds filled first, then by total ascending
  rows.sort((a, b) => {
    const aNulls = a.times.filter(t => t === null).length
    const bNulls = b.times.filter(t => t === null).length
    if (aNulls !== bNulls) return aNulls - bNulls
    return a.total - b.total
  })

  // Best time per round (index matches sortedRounds)
  const bestPerRound = sortedRounds.map((_, ri) => {
    const times = rows.map(r => r.times[ri]).filter((t): t is number => t !== null)
    return times.length > 0 ? Math.min(...times) : null
  })

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div
      className="w-full animate-slide-up rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(0,0,0,0.75)',
        border: '2px solid rgba(96,165,250,0.4)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(96,165,250,0.2)',
      }}
    >
      <h2 className="text-center text-3xl font-black text-white py-4 tracking-widest uppercase border-b border-white/10">
        Scoreboard
      </h2>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
            <th className="text-left px-6 py-3 text-blue-400/70 text-sm font-bold uppercase tracking-widest w-24">Round</th>
            {rows.map((row, i) => (
              <th
                key={row.name}
                className="text-center px-4 py-3 text-sm font-bold uppercase tracking-widest"
                style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#e5e7eb' : i === 2 ? '#f59e0b' : '#d1d5db' }}
              >
                {medals[i] ?? <span className="text-white/30">#{i + 1}</span>} {row.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRounds.map((round, ri) => (
            <tr
              key={round.id}
              className="animate-pop-in border-t border-white/5"
              style={{
                animationDelay: `${ri * 0.06}s`,
                animationFillMode: 'backwards',
                background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}
            >
              <td className="px-6 py-4 text-blue-400 text-lg font-bold">R{round.round_number}</td>
              {rows.map((row, i) => {
                const t = row.times[ri]
                const isRoundWinner = t !== null && t === bestPerRound[ri]
                return (
                  <td
                    key={row.name}
                    className="px-4 py-4 text-center text-lg font-bold tabular-nums"
                    style={{
                      color: isRoundWinner ? '#34d399' : t ? '#93c5fd' : '#ffffff20',
                      textShadow: isRoundWinner ? '0 0 12px rgba(52,211,153,0.9), 0 0 24px rgba(52,211,153,0.5)' : undefined,
                    }}
                  >
                    {t !== null ? formatTime(t) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Total row */}
          <tr className="border-t-2 border-white/20" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <td className="px-6 py-4 text-yellow-400/80 text-sm font-bold uppercase tracking-widest">Total</td>
            {rows.map((row, i) => (
              <td
                key={row.name}
                className="px-4 py-4 text-center text-xl font-black tabular-nums"
                style={{ color: i === 0 ? '#fbbf24' : '#e5e7eb' }}
              >
                {formatTime(row.total)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

export const SHAPE_COLORS: Record<Shape, string> = {
  circle: '#60a5fa',
  square: '#f87171',
  star: '#fbbf24',
  x: '#a78bfa',
}

export function ShapeIcon({ shape, size = 32 }: { shape: Shape; size?: number }) {
  const color = SHAPE_COLORS[shape]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {shape === 'circle' && (
        <circle cx="12" cy="12" r="9" fill={color} />
      )}
      {shape === 'square' && (
        <rect x="3" y="3" width="18" height="18" rx="3" fill={color} />
      )}
      {shape === 'star' && (
        <path
          d="M12 2l2.75 8.47H23l-7.08 5.14 2.75 8.47L12 19.14l-6.67 4.94 2.75-8.47L1 10.47h8.25z"
          fill={color}
        />
      )}
      {shape === 'x' && (
        <path
          d="M5 5l14 14M19 5L5 19"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

export const SHAPE_CYCLE: Shape[] = ['circle', 'square', 'star', 'x']

export function padShapes(shapes: Shape[], count: number): Shape[] {
  const base = shapes.slice(0, count)
  while (base.length < count) base.push('circle')
  return base
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1).padStart(4, '0')
  return m > 0 ? `${m}:${s}` : `${(seconds).toFixed(1)}s`
}
