import { useShapeSequence, type Shape, type ShapeRound, type ShapeResult } from '../hooks/useShapeSequence'
import { ParticleBackground } from '../components/ParticleBackground'

export function ShapeSequenceProjector() {
  const { rounds, results } = useShapeSequence()

  const activeRound = rounds.find(r => r.is_active) ?? null
  const roundResults = activeRound
    ? [...results.filter(r => r.round_id === activeRound.id)].sort(
        (a, b) => a.completion_time - b.completion_time
      )
    : []

  return (
    <div className="h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-6">
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
      <div className="relative z-10 text-center mb-8">
        <h1 className="text-6xl font-black text-white tracking-tight animate-slide-up">
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
          <WaitingState />
        ) : (
          <>
            <ShapeGrid round={activeRound} />
            {activeRound.results_visible && roundResults.length > 0 && (
              <ResultsBoard results={roundResults} roundNumber={activeRound.round_number} />
            )}
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

function ResultsBoard({ results, roundNumber }: { results: ShapeResult[]; roundNumber: number }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div
      className="w-full max-w-3xl animate-slide-up rounded-3xl p-6"
      style={{
        background: 'rgba(0,0,0,0.7)',
        border: '2px solid rgba(96,165,250,0.4)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(96,165,250,0.2)',
      }}
    >
      <h2 className="text-center text-2xl font-black text-white mb-5 tracking-wide">
        ROUND {roundNumber} RESULTS
      </h2>
      <div className="flex flex-col gap-3">
        {results.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-4 px-5 py-3 rounded-2xl animate-pop-in"
            style={{
              animationDelay: `${i * 0.08}s`,
              animationFillMode: 'backwards',
              background: i === 0
                ? 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.1))'
                : 'rgba(255,255,255,0.05)',
              border: i === 0
                ? '1.5px solid rgba(251,191,36,0.5)'
                : '1.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="text-3xl w-10 text-center">{medals[i] ?? `#${i + 1}`}</span>
            <span
              className="flex-1 text-xl font-black"
              style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#e5e7eb' : i === 2 ? '#d97706' : '#9ca3af' }}
            >
              {r.team_name}
            </span>
            <span
              className="text-2xl font-black tabular-nums"
              style={{ color: i === 0 ? '#fbbf24' : '#d1d5db' }}
            >
              {formatTime(r.completion_time)}
            </span>
          </div>
        ))}
      </div>
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
