import { useState, useEffect, useCallback } from 'react'

interface Point {
  icon: string
  text: string
  sub: string
}

interface Slide {
  id: string
  gradientFrom: string
  gradientVia: string
  gradientTo: string
  accent: string
  glowColor: string
  icon: string
  stepLabel: string
  stepColor: string
  title: string
  titleColor: string
  points: Point[]
  qrNote?: boolean
}

const slides: Slide[] = [
  {
    id: 'register',
    gradientFrom: '#1e0a3c',
    gradientVia: '#0f1b4d',
    gradientTo: '#071e3d',
    accent: '#a78bfa',
    glowColor: 'rgba(167,139,250,0.35)',
    icon: '📱',
    stepLabel: '⚡ BEFORE YOU START',
    stepColor: '#a78bfa',
    title: 'SCAN & REGISTER',
    titleColor: '#e9d5ff',
    points: [
      { icon: '👑', text: 'TEAM LEADERS go first!', sub: 'Scan the main QR code on screen' },
      { icon: '✍️', text: 'Enter TRIBE NAME + PASSWORD', sub: 'Share the password with your whole team' },
      { icon: '👥', text: 'Teammates scan & JOIN the tribe', sub: 'Maximum 3 teammates per tribe' },
    ],
    qrNote: true,
  },
  {
    id: 'step1',
    gradientFrom: '#3b0a0a',
    gradientVia: '#431407',
    gradientTo: '#1c1002',
    accent: '#fb923c',
    glowColor: 'rgba(251,146,60,0.35)',
    icon: '🚩',
    stepLabel: 'STEP 1',
    stepColor: '#fb923c',
    title: 'FIND THE FLAG!',
    titleColor: '#fed7aa',
    points: [
      { icon: '👀', text: 'Search the ROOM / VENUE', sub: 'Flags are hidden all around you!' },
      { icon: '🏃', text: 'GRAB the physical flag', sub: 'Each color = a different challenge' },
    ],
  },
  {
    id: 'step2',
    gradientFrom: '#03162b',
    gradientVia: '#061e2f',
    gradientTo: '#01171f',
    accent: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.35)',
    icon: '📲',
    stepLabel: 'STEP 2',
    stepColor: '#22d3ee',
    title: 'GET THE QR CODE',
    titleColor: '#a5f3fc',
    points: [
      { icon: '🧑‍⚖️', text: 'Go to the MARSHAL', sub: 'They are wearing official vests' },
      { icon: '📱', text: 'SCAN the QR code they show you', sub: 'Use your phone camera — it\'s easy!' },
    ],
  },
  {
    id: 'step3',
    gradientFrom: '#021a0e',
    gradientVia: '#031e10',
    gradientTo: '#01171a',
    accent: '#34d399',
    glowColor: 'rgba(52,211,153,0.35)',
    icon: '📋',
    stepLabel: 'STEP 3',
    stepColor: '#34d399',
    title: 'DO THE CHALLENGE!',
    titleColor: '#a7f3d0',
    points: [
      { icon: '📖', text: 'READ the instructions carefully', sub: 'Think before you move!' },
      { icon: '🧰', text: 'Need PROPS? Grab from marshal table', sub: 'Some challenges need equipment' },
      { icon: '🎯', text: 'No props? Start ANYWHERE — GO!', sub: 'Just follow what\'s on screen' },
    ],
  },
  {
    id: 'step4',
    gradientFrom: '#1c1000',
    gradientVia: '#1e0f00',
    gradientTo: '#1a0900',
    accent: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.35)',
    icon: '✅',
    stepLabel: 'STEP 4',
    stepColor: '#fbbf24',
    title: 'VERIFY WITH MARSHAL',
    titleColor: '#fde68a',
    points: [
      { icon: '🏁', text: 'Challenge DONE?', sub: 'Don\'t run off just yet...' },
      { icon: '🧑‍⚖️', text: 'Show the ONSITE MARSHAL', sub: 'They will check your work' },
      { icon: '👍', text: 'Wait for VERIFICATION', sub: 'Marshal confirms you did it right!' },
    ],
  },
  {
    id: 'step5',
    gradientFrom: '#2d0018',
    gradientVia: '#1e000f',
    gradientTo: '#1a0005',
    accent: '#f472b6',
    glowColor: 'rgba(244,114,182,0.35)',
    icon: '🃏',
    stepLabel: 'STEP 5',
    stepColor: '#f472b6',
    title: 'COLLECT YOUR CARD!',
    titleColor: '#fbcfe8',
    points: [
      { icon: '🎉', text: 'VERIFIED — Amazing work!', sub: 'The marshal is proud of you' },
      { icon: '🃏', text: 'Get your COMPLETION CARD', sub: 'Physical card — handed by marshal' },
      { icon: '💎', text: 'KEEP IT SAFE — it\'s your proof!', sub: 'Don\'t lose this card!' },
    ],
  },
  {
    id: 'step6',
    gradientFrom: '#1a003d',
    gradientVia: '#1e0035',
    gradientTo: '#2a0040',
    accent: '#c084fc',
    glowColor: 'rgba(192,132,252,0.35)',
    icon: '🌈',
    stepLabel: 'STEP 6',
    stepColor: '#c084fc',
    title: 'NEXT FLAG — GO AGAIN!',
    titleColor: '#e9d5ff',
    points: [
      { icon: '🔄', text: 'Repeat STEPS 1 to 5', sub: 'For every new flag color' },
      { icon: '🏆', text: 'Most CARDS / POINTS wins!', sub: 'Collect as many completion cards as you can!' },
      { icon: '⏱️', text: 'TIME matters too!', sub: 'Fastest tribe wins in a tie — so hustle!' },
    ],
  },
]

export function InstructionsSlide() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [visiblePoints, setVisiblePoints] = useState(0)
  const [direction, setDirection] = useState<'right' | 'left'>('right')
  const [slideKey, setSlideKey] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const slide = slides[currentSlide]
  const isLastSlide = currentSlide === slides.length - 1

  const advance = useCallback(() => {
    if (isTransitioning) return
    if (visiblePoints < slide.points.length) {
      setVisiblePoints(v => v + 1)
    } else if (!isLastSlide) {
      setIsTransitioning(true)
      setDirection('right')
      setTimeout(() => {
        setCurrentSlide(s => s + 1)
        setVisiblePoints(0)
        setSlideKey(k => k + 1)
        setIsTransitioning(false)
      }, 80)
    }
  }, [isTransitioning, visiblePoints, slide.points.length, isLastSlide])

  const goBack = useCallback(() => {
    if (isTransitioning) return
    if (visiblePoints > 0) {
      setVisiblePoints(v => v - 1)
    } else if (currentSlide > 0) {
      setIsTransitioning(true)
      setDirection('left')
      setTimeout(() => {
        setCurrentSlide(s => s - 1)
        setVisiblePoints(slides[currentSlide - 1].points.length)
        setSlideKey(k => k + 1)
        setIsTransitioning(false)
      }, 80)
    }
  }, [isTransitioning, visiblePoints, currentSlide])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
        e.preventDefault()
        advance()
      }
      if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, goBack])

  const allPointsVisible = visiblePoints >= slide.points.length
  const progressPct = ((currentSlide + (allPointsVisible ? 1 : visiblePoints / slide.points.length)) / slides.length) * 100

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none cursor-pointer relative flex flex-col"
      style={{
        background: `linear-gradient(135deg, ${slide.gradientFrom}, ${slide.gradientVia}, ${slide.gradientTo})`,
        transition: 'background 0.5s ease',
      }}
      onClick={advance}
    >
      {/* Glow orb background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${slide.glowColor}, transparent)`,
          transition: 'background 0.6s ease',
        }}
      />

      {/* Admin link */}
      <a
        href="/"
        className="absolute top-4 left-5 z-30 px-3 py-1.5 rounded-lg text-white/30 hover:text-white/70 text-sm font-medium transition-all"
        onClick={e => e.stopPropagation()}
      >
        ← Home
      </a>

      {/* Slide counter top-right */}
      <div className="absolute top-4 right-5 z-30 flex items-center gap-2">
        {slides.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === currentSlide ? 24 : 8,
              height: 8,
              background: i === currentSlide ? slide.accent : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        key={slideKey}
        className="relative z-10 flex flex-col items-center justify-center flex-1 px-8 pb-24"
        style={{
          animation: `${direction === 'right' ? 'slide-in-right' : 'slide-in-left'} 0.4s ease-out forwards`,
        }}
      >
        {/* Step label */}
        <div
          className="text-sm font-black tracking-[0.25em] uppercase mb-3 px-4 py-1.5 rounded-full"
          style={{
            color: slide.stepColor,
            background: `${slide.accent}22`,
            border: `1.5px solid ${slide.accent}55`,
          }}
        >
          {slide.stepLabel}
        </div>

        {/* Big icon */}
        <div
          className="text-8xl mb-4 animate-icon-entrance"
          style={{ filter: `drop-shadow(0 0 24px ${slide.glowColor})` }}
        >
          {slide.icon}
        </div>

        {/* Title */}
        <h1
          className="text-5xl md:text-7xl font-black text-center mb-8 animate-title-slam leading-none"
          style={{
            color: slide.titleColor,
            textShadow: `0 0 40px ${slide.glowColor}, 0 2px 0 rgba(0,0,0,0.5)`,
          }}
        >
          {slide.title}
        </h1>

        {/* QR note banner */}
        {slide.qrNote && (
          <div
            className="mb-6 px-6 py-3 rounded-2xl text-center animate-pulse-glow"
            style={{
              background: 'rgba(167,139,250,0.15)',
              border: '2px solid rgba(167,139,250,0.5)',
              color: '#e9d5ff',
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            📌 Scan the QR code displayed on this screen to get started
          </div>
        )}

        {/* Points */}
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {slide.points.map((point, i) => (
            <div
              key={`${slideKey}-${i}`}
              className="animate-pop-in"
              style={{
                animationDelay: `0s`,
                animationFillMode: 'both',
                opacity: i < visiblePoints ? 1 : 0,
                pointerEvents: 'none',
                display: i < visiblePoints ? 'block' : 'none',
              }}
            >
              <PointCard point={point} accent={slide.accent} glowColor={slide.glowColor} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-5 gap-3">
        {/* Clicker hint */}
        <div className="flex items-center gap-2 text-white/40 text-sm font-medium">
          {allPointsVisible && !isLastSlide ? (
            <>
              <span className="animate-shimmer font-bold" style={{ color: slide.accent }}>
                Click or press SPACE to continue →
              </span>
            </>
          ) : isLastSlide && allPointsVisible ? (
            <span className="font-bold animate-shimmer" style={{ color: slide.accent }}>
              🎉 That's everything! Good luck out there!
            </span>
          ) : (
            <>
              <ClickIcon color={slide.accent} />
              <span>Click to reveal next step</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-2xl h-1.5 bg-white/10 rounded-full overflow-hidden mx-8">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${slide.accent}, ${slide.accent}88)`,
              boxShadow: `0 0 8px ${slide.accent}`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function PointCard({ point, accent, glowColor }: { point: Point; accent: string; glowColor: string }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${accent}44`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Icon bubble */}
      <div
        className="text-3xl flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl"
        style={{
          background: `${accent}22`,
          border: `1.5px solid ${accent}44`,
          boxShadow: `0 0 12px ${glowColor}`,
        }}
      >
        {point.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-black text-xl leading-tight">{point.text}</div>
        {point.sub && (
          <div className="text-white/50 text-sm font-medium mt-0.5 leading-snug">{point.sub}</div>
        )}
      </div>

      {/* Accent dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
      />
    </div>
  )
}

function ClickIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 2C9 2 9 12 9 14C9 14 7 12 5.5 11.5C4 11 3 12 3.5 13C4 14 9 20 12 20C15 20 19 17 19 12V8L16 6V14M16 6L13 4M16 6V2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
