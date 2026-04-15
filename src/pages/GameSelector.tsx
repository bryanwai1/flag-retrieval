import { ParticleBackground } from '../components/ParticleBackground'

export function GameSelector() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-x-hidden py-12">
      <ParticleBackground />

      <div className="relative z-10 text-center mb-14">
        <h1 className="text-6xl font-black text-white tracking-tight animate-slide-up">
          GAME HUB
        </h1>
        <p
          className="text-gray-400 text-xl mt-3 animate-slide-up"
          style={{ animationDelay: '0.15s' }}
        >
          Choose your game to begin
        </p>
      </div>

      <div className="relative z-10 flex flex-row gap-10 justify-center px-8 flex-wrap">
        <EventCard delay="0.2s" />
        <GameCard
          href="/projector"
          adminHref="/admin"
          faciHref="/flag-retrieval/facilitator"
          icon="🚩"
          title="FLAG RETRIEVAL"
          description="Hunt flags · Scan QR codes · Complete challenges"
          accent="#f59e0b"
          delay="0.3s"
        />
        <GameCard
          href="/shape-sequence"
          adminHref="/shape-sequence/admin"
          icon="🔷"
          title="SHAPE SEQUENCE"
          description="Match the pattern · Race against the clock · 3 rounds"
          accent="#60a5fa"
          delay="0.4s"
        />
        <GameCard
          href="/bingo-dash"
          adminHref="/bingo-dash/admin"
          icon="🎯"
          title="BINGO DASH"
          description="Scan challenges · Complete tasks · Track your team"
          accent="#a855f7"
          delay="0.5s"
          primaryLabel="PLAYER BOARD"
        />
      </div>
    </div>
  )
}

function EventCard({ delay }: { delay: string }) {
  return (
    <div
      className="animate-bounce-in flex flex-col items-center gap-5 px-12 py-10 rounded-3xl w-80"
      style={{
        animationDelay: delay,
        opacity: 0,
        animationFillMode: 'forwards',
        background: 'rgba(255,255,255,0.04)',
        border: '2px solid rgba(167,139,250,0.2)',
      }}
    >
      <div className="text-7xl animate-float">🎪</div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-white tracking-tight">EVENT SLIDES</h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">Welcome slide · Team groupings · Client branding</p>
      </div>
      <div className="flex flex-col gap-2 w-full mt-2">
        <a
          href="/event"
          className="w-full py-3 rounded-xl font-black text-center text-sm tracking-wider transition-all hover:scale-105"
          style={{ background: '#a78bfa', color: '#000' }}
        >
          ▶ EVENT SLIDE
        </a>
        <a
          href="/event/grouping"
          className="w-full py-2.5 rounded-xl font-bold text-center text-sm transition-all hover:bg-white/10"
          style={{ color: '#a78bfa', border: '1.5px solid rgba(167,139,250,0.27)' }}
        >
          👥 Team Groupings
        </a>
      </div>
    </div>
  )
}

function GameCard({
  href,
  adminHref,
  faciHref,
  icon,
  title,
  description,
  accent,
  delay,
  primaryLabel,
}: {
  href: string
  adminHref: string
  faciHref?: string
  icon: string
  title: string
  description: string
  accent: string
  delay: string
  primaryLabel?: string
}) {
  return (
    <div
      className="animate-bounce-in flex flex-col items-center gap-5 px-12 py-10 rounded-3xl w-80"
      style={{
        animationDelay: delay,
        opacity: 0,
        animationFillMode: 'forwards',
        background: 'rgba(255,255,255,0.04)',
        border: `2px solid ${accent}33`,
      }}
    >
      <div className="text-7xl animate-float">{icon}</div>

      <div className="text-center">
        <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{description}</p>
      </div>

      <div className="flex flex-col gap-2 w-full mt-2">
        <a
          href={href}
          className="w-full py-3 rounded-xl font-black text-center text-sm tracking-wider transition-all hover:scale-105"
          style={{ background: accent, color: '#000' }}
        >
          ▶ {primaryLabel ?? 'PROJECTOR VIEW'}
        </a>
        {faciHref && (
          <a
            href={faciHref}
            className="w-full py-2.5 rounded-xl font-bold text-center text-sm transition-all hover:bg-white/10"
            style={{ color: accent, border: `1.5px solid ${accent}44` }}
          >
            📋 Facilitator View
          </a>
        )}
        {adminHref !== href && (
          <a
            href={adminHref}
            className="w-full py-2.5 rounded-xl font-bold text-center text-sm transition-all hover:bg-white/10"
            style={{ color: accent, border: `1.5px solid ${accent}44` }}
          >
            ⚙ Admin Panel
          </a>
        )}
      </div>
    </div>
  )
}
