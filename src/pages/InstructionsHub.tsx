import { ParticleBackground } from '../components/ParticleBackground'
import { decks } from '../lib/instructionDecks'

export function InstructionsHub() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-x-hidden py-12 px-6">
      <ParticleBackground />

      <a
        href="/"
        className="absolute top-6 left-6 z-20 text-xs text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest"
      >
        ← Hub
      </a>

      <div className="relative z-10 text-center mb-12">
        <p className="text-white/30 text-xs font-bold uppercase tracking-[0.35em] mb-2">Event Slides</p>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight animate-slide-up">
          INSTRUCTION SLIDES
        </h1>
        <p
          className="text-gray-400 text-lg mt-3 animate-slide-up"
          style={{ animationDelay: '0.15s' }}
        >
          Pick an activity to walk the tribes through
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
        {decks.map((deck, idx) => (
          <a
            key={deck.id}
            href={`/instructions/${deck.id}`}
            className="animate-bounce-in group flex flex-col items-center gap-4 px-6 py-8 rounded-3xl transition-all hover:scale-[1.03]"
            style={{
              animationDelay: `${0.2 + idx * 0.08}s`,
              opacity: 0,
              animationFillMode: 'forwards',
              background: 'rgba(255,255,255,0.04)',
              border: `2px solid ${deck.accent}33`,
              boxShadow: `0 4px 32px ${deck.accent}10`,
            }}
          >
            <div
              className="text-6xl animate-float"
              style={{ filter: `drop-shadow(0 0 24px ${deck.accent}55)` }}
            >
              {deck.icon}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-white tracking-tight">{deck.label.toUpperCase()}</h2>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">{deck.tagline}</p>
              <p className="text-white/25 text-[10px] mt-2 font-bold tracking-widest uppercase">
                {deck.slides.length} slides
              </p>
            </div>
            <div
              className="w-full py-2.5 rounded-xl font-black text-center text-sm tracking-wider transition-all group-hover:brightness-110"
              style={{ background: deck.accent, color: '#000' }}
            >
              ▶ OPEN DECK
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
