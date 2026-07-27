import { useEffect, useMemo, useRef, useState } from 'react'
import type { AitbTeam, AitbProgress } from '../types/database'
import type { AitbReaction } from '../hooks/useAitbReactions'

export type Ranked = { team: AitbTeam; rows: AitbProgress[]; total: number; completed: number }

const INNER = 21 // closest an in-flight rocket gets to the planet
const OUTER = 43 // rim, for a team still at 0/10 (kept off the screen edge)
const DOCK = 16  // landed teams ring the planet by bearing, not stacked at centre

// Small deterministic horizontal jitter for a reaction bubble, from its id, so
// repeated reactions on one rocket fan out instead of stacking dead-centre.
function jitterOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return (h % 44) - 22
}

/**
 * The animated race scene: planet at the centre, every team's rocket flying in
 * from its own bearing (distance = completed/10). Rockets have live exhaust, a
 * lazy idle bob, and a flame boost the moment a team advances. Audience
 * reactions float off the matching team's rocket as chat bubbles.
 */
export function AitbRaceStage({ ranked, reactions }: { ranked: Ranked[]; reactions: AitbReaction[] }) {
  const N = Math.max(1, ranked.length)

  // Each team keeps its OWN lane (bearing) for the whole event. `ranked` is
  // sorted by score, so using its index would re-bearing every rocket the moment
  // anyone scored — teams visibly swapped places around the planet. Lanes come
  // from the team's stable sort_order instead, so scoring only ever moves a
  // rocket *inward* along its own line.
  const laneOf = useMemo(() => {
    const stable = [...ranked].sort((a, b) =>
      (a.team.sort_order ?? 0) - (b.team.sort_order ?? 0) || a.team.id.localeCompare(b.team.id))
    const m: Record<string, number> = {}
    stable.forEach((r, idx) => { m[r.team.id] = idx })
    return m
  }, [ranked])

  // Flame boost when a team's completed count goes up (i.e. the rocket moves).
  const prevCompleted = useRef<Record<string, number>>({})
  const [boosting, setBoosting] = useState<Set<string>>(new Set())
  useEffect(() => {
    const moved: string[] = []
    for (const r of ranked) {
      const prev = prevCompleted.current[r.team.id]
      if (prev != null && r.completed > prev) moved.push(r.team.id)
      prevCompleted.current[r.team.id] = r.completed
    }
    if (!moved.length) return
    setBoosting(s => { const n = new Set(s); moved.forEach(id => n.add(id)); return n })
    // Keep the flame lit just past the 1.4s move transition, then let it fade.
    const timers = moved.map(id => setTimeout(() =>
      setBoosting(s => { const n = new Set(s); n.delete(id); return n }), 1500))
    return () => timers.forEach(clearTimeout)
  }, [ranked])

  return (
    <div className="relative mx-auto mt-4" style={{ width: 'min(90vw, 72vh)', aspectRatio: '1 / 1' }}>
      <style>{RACE_CSS}</style>

      {[1, 0.72, 0.44].map((r, i) => (
        <div key={i} className="absolute rounded-full" style={{ inset: `${(1 - r) / 2 * 100}%`, border: '1px solid rgba(255,255,255,0.08)' }} />
      ))}

      {/* central planet — slow spin + float + pulsing glow */}
      <div className="absolute rd-race-planet" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '26%', aspectRatio: '1/1' }}>
        <div className="absolute rounded-full rd-race-planetglow" style={{ inset: '-30%', background: 'radial-gradient(circle, rgba(140,120,255,.4), transparent 62%)' }} />
        <img src="/rocket-dash/planet.png" alt="planet" className="w-full h-full object-contain relative rd-race-spin" style={{ filter: 'drop-shadow(0 0 40px rgba(120,220,255,.4))' }} />
      </div>

      {ranked.map(({ team, total, completed }) => {
        const landed = completed >= 10
        const frac = Math.min(1, completed / 10)
        const dist = landed ? DOCK : OUTER - frac * (OUTER - INNER)
        // Bearing is fixed per team (never the score-sorted index) — see laneOf.
        const angle = ((laneOf[team.id] ?? 0) / N) * 2 * Math.PI - Math.PI / 2
        const ox = Math.cos(angle), oy = Math.sin(angle)
        const x = 50 + dist * ox
        const y = 50 + dist * oy
        const rot = angle * 180 / Math.PI - 90
        const horizontal = Math.abs(ox) >= Math.abs(oy)
        const P = '3.6vh'
        const labelTf = horizontal
          ? (ox < 0 ? `translate(-100%,-50%) translateX(-${P})` : `translate(0,-50%) translateX(${P})`)
          : (oy < 0 ? `translate(-50%,-100%) translateY(-${P})` : `translate(-50%,0) translateY(${P})`)
        const labelAlign = horizontal ? (ox < 0 ? 'right' : 'left') : 'center'
        const teamReactions = reactions.filter(r => r.teamId === team.id)
        return (
          <div key={team.id} className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', transition: 'left 1.4s cubic-bezier(.22,1,.36,1), top 1.4s cubic-bezier(.22,1,.36,1)', zIndex: landed ? 8 : 10 }}>

            {/* rocket: idle bob + rotation + live exhaust flame (hidden once landed) */}
            <div className="rd-race-bob">
              <div className="relative" style={{ width: landed ? '5.5vh' : '6.5vh', transform: `rotate(${rot}deg)` }}>
                <div className="absolute rounded-full" style={{ inset: '-30%', background: `radial-gradient(circle, ${team.color}66, transparent 65%)` }} />
                <img src="/rocket-dash/rocket.png" alt="" className="w-full relative" style={{ filter: `drop-shadow(0 0 10px ${team.color})` }} />
                {/* Exhaust only fires while the team is moving (just advanced); idle = no flame. */}
                {!landed && <div className={`rd-race-flame ${boosting.has(team.id) ? 'active' : ''}`} />}
              </div>
            </div>

            {/* team label, anchored on the planet-far side so it never crosses the planet */}
            <div className="absolute whitespace-nowrap" style={{ left: '50%', top: '50%', transform: labelTf, textAlign: labelAlign, lineHeight: 1.12 }}>
              <div className="font-black" style={{ color: team.color, fontSize: '1.9vh', textShadow: '0 2px 6px #000' }}>
                {landed ? '🏁 ' : ''}{team.name}
              </div>
              <div className="font-bold tabular-nums" style={{ fontSize: '1.6vh', color: '#fff', opacity: .92, textShadow: '0 1px 4px #000' }}>
                {total.toLocaleString()} · {completed}/10
              </div>
            </div>

            {/* audience reaction chat-bubbles floating up off the rocket */}
            {teamReactions.map(r => (
              <div key={r.id} className="rd-react-bubble" style={{ left: `calc(50% + ${jitterOf(r.id)}px)` }}>
                <span className="rd-react-emoji">{r.emoji}</span>
              </div>
            ))}
          </div>
        )
      })}

      {ranked.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-2xl">No teams yet</div>
      )}
    </div>
  )
}

const RACE_CSS = `
@keyframes rd-race-spin { to { transform: rotate(360deg); } }
.rd-race-spin { animation: rd-race-spin 90s linear infinite; }
@keyframes rd-race-planet-float { 0%,100% { transform: translate(-50%,-50%); } 50% { transform: translate(-50%,calc(-50% - 8px)); } }
.rd-race-planet { animation: rd-race-planet-float 7s ease-in-out infinite; }
@keyframes rd-race-glow { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
.rd-race-planetglow { animation: rd-race-glow 4s ease-in-out infinite; }
@keyframes rd-race-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.rd-race-bob { animation: rd-race-bob 3.2s ease-in-out infinite; }
/* Flame is invisible at rest and only ignites (with a soft fade) while .active. */
.rd-race-flame {
  position: absolute; left: 50%; bottom: -16%; transform: translateX(-50%) scaleY(.25);
  width: 40%; height: 66%; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: radial-gradient(circle at 50% 25%, rgba(255,244,170,.98), rgba(255,150,50,.82) 45%, transparent 72%);
  filter: blur(2px); z-index: -1; transform-origin: 50% 0%;
  opacity: 0; transition: opacity .35s ease, transform .35s ease;
}
.rd-race-flame.active { opacity: 1; animation: rd-race-thrust .12s ease-in-out infinite alternate; }
@keyframes rd-race-thrust {
  from { transform: translateX(-50%) scaleY(.95) scaleX(.94); filter: blur(1.5px) brightness(1); }
  to   { transform: translateX(-50%) scaleY(1.35) scaleX(1.08); filter: blur(2.6px) brightness(1.3); }
}
.rd-react-bubble {
  position: absolute; top: -6%; transform: translateX(-50%); z-index: 30;
  display: flex; align-items: center; justify-content: center;
  min-width: 3.4vh; height: 3.4vh; padding: 0 .5vh; border-radius: 1.7vh 1.7vh 1.7vh .4vh;
  background: rgba(20,14,40,.92); border: 1px solid rgba(255,255,255,.22);
  box-shadow: 0 4px 16px rgba(0,0,0,.5); pointer-events: none;
  animation: rd-react-float 3.1s cubic-bezier(.25,.6,.3,1) forwards;
}
.rd-react-emoji { font-size: 2.2vh; line-height: 1; animation: rd-react-wiggle .6s ease-in-out infinite; }
@keyframes rd-react-wiggle { 0%,100% { transform: rotate(-9deg) scale(1); } 50% { transform: rotate(9deg) scale(1.14); } }
@keyframes rd-react-float {
  0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(.4); }
  14% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.08); }
  30% { transform: translateX(-50%) translateY(-1.2vh) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-11vh) scale(.9); }
}
`
