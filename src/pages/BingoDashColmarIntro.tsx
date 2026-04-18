import { useMemo } from 'react'
import { useFullscreen } from '../hooks/useFullscreen'

/**
 * COLMAR BINGO HUNT — Event intro slide.
 * Parchment backdrop + staged SVG map animation.
 * Route: /bingo-dash/colmar-intro
 */
export function BingoDashColmarIntro() {
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  // 60 drifting gold motes, each with its own stagger/drift/duration
  const motes = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 120,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 10,
      size: 2 + Math.random() * 3,
      opacity: 0.35 + Math.random() * 0.45,
    })),
    []
  )

  return (
    <div className="h-screen w-screen relative overflow-hidden select-none colmar-parchment colmar-grain colmar-vignette"
         style={{ fontFamily: `'Cinzel', 'Trajan Pro', 'Palatino Linotype', Georgia, serif` }}>

      {/* Floating gold dust */}
      <div className="absolute inset-0 pointer-events-none z-[2]">
        {motes.map(m => (
          <span
            key={m.id}
            className="absolute rounded-full"
            style={{
              left: `${m.left}%`,
              bottom: 0,
              width: `${m.size}px`,
              height: `${m.size}px`,
              background: 'radial-gradient(circle, #fff1b8 0%, #e6b84a 60%, transparent 100%)',
              boxShadow: '0 0 6px #e6b84a',
              opacity: m.opacity,
              animation: `gold-dust ${m.duration}s linear ${m.delay}s infinite`,
              ['--dx' as string]: `${m.dx}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Decorative frame (parchment scroll border) */}
      <div className="absolute inset-3 sm:inset-6 rounded-[32px] pointer-events-none z-[3]"
           style={{
             border: '2px solid #6b3e15',
             boxShadow: 'inset 0 0 0 1px rgba(255,230,170,0.4), inset 0 0 40px rgba(60,30,10,0.35), 0 0 80px rgba(60,30,10,0.55)',
           }} />
      <div className="absolute inset-6 sm:inset-10 rounded-[24px] pointer-events-none z-[3]"
           style={{
             border: '1px dashed rgba(107,62,21,0.55)',
           }} />

      {/* Stage ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 h-full w-full flex flex-col items-center px-8 py-4 sm:py-6 overflow-hidden">

        {/* Subtitle ribbon */}
        <div
          className="origin-center"
          style={{ animation: 'banner-unfurl 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both' }}
        >
          <p className="text-[0.7rem] sm:text-sm md:text-base tracking-[0.55em] uppercase font-semibold"
             style={{ color: '#5c3a1f', textShadow: '0 1px 0 rgba(255,240,200,0.5)' }}>
            ⚜ &nbsp; Building a Winning Team V<span style={{ color: '#8b2e1f' }}>2</span> &nbsp; ⚜
          </p>
        </div>

        {/* Main title */}
        <h1
          className="mt-3 sm:mt-4 text-center font-black leading-none whitespace-nowrap animate-gold-title"
          style={{
            fontSize: 'clamp(1.8rem, 7vw, 6.5rem)',
            letterSpacing: '0.05em',
            animation: 'title-slam 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1.1s both, gold-sweep 6s linear 1.1s infinite',
          }}
        >
          COLMAR BINGO HUNT
        </h1>

        {/* Flourish divider */}
        <div
          className="flex items-center gap-3 mt-2 mb-2 sm:mb-4"
          style={{ animation: 'slide-up 0.8s ease-out 1.6s both' }}
        >
          <span className="h-[2px] w-16 sm:w-24" style={{ background: 'linear-gradient(to right, transparent, #8b5a17)' }} />
          <span className="text-[#8b5a17] text-sm sm:text-base">❧</span>
          <span className="h-[2px] w-16 sm:w-24" style={{ background: 'linear-gradient(to left, transparent, #8b5a17)' }} />
        </div>

        {/* ── Map stage ──────────────────────────────────────────── */}
        <div
          className="relative flex-1 w-full max-w-5xl flex items-center justify-center"
          style={{ animation: 'map-rise 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both' }}
        >
          <TopDownRoadMap />
        </div>

        {/* Date banner */}
        <div
          className="relative mt-1 sm:mt-3"
          style={{ animation: 'banner-unfurl 1s cubic-bezier(0.22, 1, 0.36, 1) 2.6s both' }}
        >
          <div
            className="relative px-10 sm:px-16 py-2 sm:py-3 text-center"
            style={{
              background: 'linear-gradient(180deg, #9b2e1f 0%, #7a2314 100%)',
              boxShadow: '0 6px 0 rgba(60,18,10,0.45), inset 0 1px 0 rgba(255,200,140,0.35), inset 0 -2px 6px rgba(0,0,0,0.25)',
              clipPath: 'polygon(0% 0%, 100% 0%, 96% 50%, 100% 100%, 0% 100%, 4% 50%)',
            }}
          >
            <p className="text-[#fce8b8] font-bold tracking-[0.3em] text-sm sm:text-lg md:text-xl"
               style={{ fontFamily: `'Cinzel', Georgia, serif`, textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
              18<span className="text-xs align-super">TH</span> – 19<span className="text-xs align-super">TH</span> &nbsp; APRIL &nbsp; 2026
            </p>
          </div>
          {/* Ribbon tails */}
          <div className="absolute left-0 -bottom-2 w-4 h-3" style={{
            background: '#5c1a0e',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }} />
          <div className="absolute right-0 -bottom-2 w-4 h-3" style={{
            background: '#5c1a0e',
            clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
          }} />
        </div>
      </div>

      {/* Hub link + fullscreen */}
      <a href="/bingo-dash/admin" className="absolute top-6 left-6 z-20 text-xs text-[#4a2c11]/60 hover:text-[#4a2c11] transition-colors uppercase tracking-widest font-semibold">
        ← Admin
      </a>
      <button
        onClick={toggleFullscreen}
        className="absolute top-6 right-6 z-20 w-9 h-9 flex items-center justify-center rounded-xl bg-[#4a2c11]/10 hover:bg-[#4a2c11]/25 text-[#4a2c11]/60 hover:text-[#4a2c11] transition-all"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ── Top-down medieval town map ────────────────────────────────────────
function TopDownRoadMap() {
  // Medieval buildings scattered as a town cluster (top-down view).
  // x,y is top-left corner of the building footprint on 1000×500 viewBox.
  const BUILDINGS = [
    { x: 220, y: 105, w:  80, h: 62, roof: 'hip',   accent: '#8b5a17', delay: 0.6 },
    { x: 400, y:  78, w: 145, h: 98, roof: 'gable', accent: '#8b2e1f', delay: 0.75 }, // church/hall (red roof)
    { x: 620, y: 110, w:  88, h: 70, roof: 'hip',   accent: '#8b5a17', delay: 0.9 },
    { x: 270, y: 232, w: 112, h: 86, roof: 'gable', accent: '#8b5a17', delay: 1.05 },
    { x: 475, y: 212, w: 140, h: 108, roof: 'gable', accent: '#6b3e15', delay: 1.2 },  // market hall
    { x: 830, y: 240, w: 112, h: 82, roof: 'hip',   accent: '#8b5a17', delay: 1.35 },
    { x: 140, y: 320, w:  76, h: 60, roof: 'hip',   accent: '#8b5a17', delay: 1.5 },
    { x: 330, y: 358, w:  72, h: 55, roof: 'hip',   accent: '#8b5a17', delay: 1.65 },
    { x: 455, y: 358, w:  95, h: 65, roof: 'gable', accent: '#8b5a17', delay: 1.8 },
    { x: 680, y: 350, w:  95, h: 65, roof: 'gable', accent: '#8b2e1f', delay: 1.95 }, // tavern (red roof)
  ] as const

  // Teams wander the medieval streets, weaving between buildings with many turns.
  // Each path stays in the corridors between buildings.
  //   vert streets  : x ≈ 255 / 360 / 430 / 580 / 655 / 780 / 955
  //   horiz streets : y ≈ 200 / 345 / 430
  const TEAMS = [
    { color: '#c8a018', label: '1', start: [360, -40], end: [655, 225],
      d: 'M 360 -40 L 360 200 L 430 200 L 430 345 L 655 345 L 655 225', delay: 2.2 },
    { color: '#2a7fb3', label: '2', start: [780, -40], end: [285, 460],
      d: 'M 780 -40 L 780 200 L 655 200 L 655 345 L 285 345 L 285 460', delay: 2.5 },
    { color: '#d27224', label: '3', start: [-40, 205], end: [580, 60],
      d: 'M -40 205 L 255 205 L 255 345 L 430 345 L 430 200 L 580 200 L 580 60', delay: 2.8 },
    { color: '#c0392b', label: '4', start: [580, 540], end: [780, 60],
      d: 'M 580 540 L 580 430 L 955 430 L 955 200 L 780 200 L 780 60', delay: 3.1 },
    { color: '#2f8f52', label: '5', start: [955, 540], end: [1050, 200],
      d: 'M 955 540 L 955 430 L 655 430 L 655 345 L 780 345 L 780 200 L 1050 200', delay: 3.4 },
  ] as const

  return (
    <svg
      viewBox="0 0 1200 500"
      className="w-full h-full max-h-[48vh] drop-shadow-[0_10px_30px_rgba(60,30,10,0.45)]"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="flashGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0"   stopColor="#fff8d8" stopOpacity="1" />
          <stop offset="0.4" stopColor="#ffe79a" stopOpacity="0.7" />
          <stop offset="1"   stopColor="#ffd45a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Faint parchment grid — like a surveyor's map */}
      <g opacity="0.14" stroke="#6b3e15" strokeWidth="0.4">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="500" strokeDasharray="2 4" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 100} x2="1200" y2={i * 100} strokeDasharray="2 4" />
        ))}
      </g>

      {/* Buildings */}
      {BUILDINGS.map((b, i) => <MedievalBuilding key={i} {...b} />)}

      {/* Team paths (dashed, flowing) */}
      {TEAMS.map((t, i) => <TeamPath key={i} {...t} />)}

      {/* Compass rose */}
      <g transform="translate(1120 70)">
        <g style={{ animation: 'compass-spin-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both' }}>
          <circle cx="0" cy="0" r="40" fill="rgba(244,228,193,0.5)" stroke="#5c3a1f" strokeWidth="1.4" />
          <circle cx="0" cy="0" r="33" fill="none" stroke="#5c3a1f" strokeWidth="0.7" strokeDasharray="2 3" />
          <path d="M 0 -34 L 4 0 L 0 34 L -4 0 Z" fill="#8b2e1f" stroke="#3a2817" strokeWidth="0.7" />
          <path d="M -34 0 L 0 -4 L 34 0 L 0 4 Z" fill="#c9a45c" stroke="#3a2817" strokeWidth="0.7" />
          <text x="0" y="-40" textAnchor="middle" fill="#3a2817" fontSize="9" fontWeight="700" fontFamily="Cinzel, serif">N</text>
        </g>
      </g>

      {/* Wax seal bottom-right */}
      <g transform="translate(1120 450)">
        <g style={{ animation: 'bounce-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 4.8s both, seal-pulse 3.5s ease-in-out 5.6s infinite' }}>
          <circle cx="0" cy="0" r="20" fill="#7a2314" stroke="#4a0f08" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="14" fill="none" stroke="#d68c28" strokeWidth="1" strokeDasharray="2 2" />
          <text x="0" y="4" textAnchor="middle" fill="#fce8b8" fontSize="10" fontWeight="900" fontFamily="Cinzel, serif">CBH</text>
        </g>
      </g>
    </svg>
  )
}

// ── Medieval building (top-down view) ─────────────────────────────
function MedievalBuilding({ x, y, w, h, roof, accent, delay }: {
  x: number; y: number; w: number; h: number;
  roof: 'hip' | 'gable'; accent: string; delay: number
}) {
  const cx = w / 2, cy = h / 2
  const horizontal = w >= h
  // Gable roof ridge endpoints (along the long axis)
  const inset = Math.min(w, h) / 2
  const ridge = horizontal
    ? { x1: inset,     y1: cy,        x2: w - inset, y2: cy }
    : { x1: cx,        y1: inset,     x2: cx,        y2: h - inset }
  return (
    <g transform={`translate(${x} ${y})`}>
    <g style={{
      opacity: 0,
      animation: `slide-up 0.6s ease-out ${delay}s forwards`,
    }}>
      {/* Ground shadow */}
      <rect x="3" y="4" width={w} height={h} fill="rgba(60,30,10,0.25)" rx="1" />
      {/* Wall footprint */}
      <rect x="0" y="0" width={w} height={h} fill="#e8d4a5" stroke="#3a2817" strokeWidth="1.6" rx="0.5" />
      {/* Roof */}
      {roof === 'hip' ? (
        <g stroke={accent} strokeWidth="1.3" strokeLinejoin="round" fill="none">
          <line x1="0"  y1="0" x2={cx} y2={cy} />
          <line x1={w}  y1="0" x2={cx} y2={cy} />
          <line x1="0"  y1={h} x2={cx} y2={cy} />
          <line x1={w}  y1={h} x2={cx} y2={cy} />
          <circle cx={cx} cy={cy} r="1.4" fill={accent} />
        </g>
      ) : (
        <g strokeLinejoin="round">
          {/* Roof facets (4 diagonals meeting the ridge ends) */}
          <line x1="0"  y1="0" x2={ridge.x1} y2={ridge.y1} stroke={accent} strokeWidth="1" opacity="0.7" />
          <line x1={w}  y1="0" x2={ridge.x2} y2={ridge.y2} stroke={accent} strokeWidth="1" opacity="0.7" />
          <line x1="0"  y1={h} x2={ridge.x1} y2={ridge.y1} stroke={accent} strokeWidth="1" opacity="0.7" />
          <line x1={w}  y1={h} x2={ridge.x2} y2={ridge.y2} stroke={accent} strokeWidth="1" opacity="0.7" />
          {/* Ridge line */}
          <line x1={ridge.x1} y1={ridge.y1} x2={ridge.x2} y2={ridge.y2} stroke={accent} strokeWidth="2" />
        </g>
      )}
      {/* Chimney detail */}
      <rect x={w - 9} y="2" width="3" height="4" fill="#5c3a1f" stroke="#3a2817" strokeWidth="0.5" />
    </g>
    </g>
  )
}

// ── Team path — winds through streets; walker ping-pongs along path ──
function TeamPath({ color, label, end, d, delay }: {
  color: string; label: string; start: readonly [number, number];
  end: readonly [number, number]; d: string; delay: number
}) {
  const revealDur = 1.6 // seconds — time to draw A→B
  const drawEnd   = delay + revealDur
  const flashAt   = drawEnd + 0.05
  const walkDur   = 9    // seconds for one full ping-pong (A→B→A)

  return (
    <g>
      {/* Soft glow underlay (fades in with reveal) */}
      <path d={d} stroke={color} strokeWidth="9" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: 0, animation: `route-glow ${revealDur}s ease-out ${delay}s forwards` }}
      />

      {/* Phase 1: solid line drawing from A to B (stroke-dashoffset reveal) */}
      <path d={d} stroke={color} strokeWidth="3.2" fill="none"
        pathLength={100}
        strokeDasharray="100 100" strokeLinecap="round" strokeLinejoin="round"
        style={{
          strokeDashoffset: 100,
          animation: `route-reveal ${revealDur}s ease-out ${delay}s forwards, fade-out 0.35s linear ${drawEnd + 0.05}s forwards`,
        }}
      />

      {/* Phase 2: footstep trail — tiny round dots, static */}
      <path d={d} stroke={color} strokeWidth="4" fill="none"
        strokeDasharray="0.1 13" strokeLinecap="round" strokeLinejoin="round"
        opacity="0.85"
        style={{
          opacity: 0,
          animation: `fade-in-dashed 0.35s ease-out ${drawEnd}s forwards`,
        }}
      />

      {/* Walker — numbered pip travels the path, ping-ponging A→B→A forever */}
      <g style={{ opacity: 0, animation: `fade-in-dashed 0.35s ease-out ${drawEnd}s forwards` }}>
        <g>
          <animateMotion
            dur={`${walkDur}s`}
            repeatCount="indefinite"
            keyPoints="0;1;0"
            keyTimes="0;0.5;1"
            calcMode="linear"
            path={d}
            begin={`${drawEnd}s`}
          />
          <circle r="13" fill={color} stroke="#fce8b8" strokeWidth="2" />
          <text y="4" textAnchor="middle" fill="#fce8b8" fontSize="12"
                fontWeight="900" fontFamily="Cinzel, serif">
            {label}
          </text>
        </g>
      </g>

      {/* Terminal — camera flash + shutter ring + target dot at point B */}
      <circle cx={end[0]} cy={end[1]} r="22" fill="url(#flashGrad)"
        style={{ transformOrigin: `${end[0]}px ${end[1]}px`, opacity: 0,
                 animation: `camera-flash 0.9s ease-out ${flashAt}s both` }}
      />
      <circle cx={end[0]} cy={end[1]} r="10" fill="none" stroke="#fce8b8" strokeWidth="2"
        style={{ transformOrigin: `${end[0]}px ${end[1]}px`, opacity: 0,
                 animation: `shutter-ring 0.8s ease-out ${flashAt}s both` }}
      />
      <circle cx={end[0]} cy={end[1]} r="10" fill="none" stroke={color} strokeWidth="1.5"
        style={{ transformOrigin: `${end[0]}px ${end[1]}px`, opacity: 0,
                 animation: `shutter-ring 1s ease-out ${flashAt + 0.15}s both` }}
      />
      <circle cx={end[0]} cy={end[1]} r="5" fill={color} stroke="#fce8b8" strokeWidth="1.6"
        style={{ opacity: 0,
                 animation: `slide-up 0.4s ease-out ${flashAt + 0.1}s forwards, pulse-glow 2.4s ease-in-out ${flashAt + 0.5}s infinite` }}
      />
    </g>
  )
}

