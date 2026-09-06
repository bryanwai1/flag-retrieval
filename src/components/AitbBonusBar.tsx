/**
 * AITB — team mission timer + speed-bonus milestone bar.
 *
 * Counts UP from check-in; the fill grows rightward through the game's OWN
 * bonusTiers milestones (e.g. finish ≤2:30 → +1000, ≤5:00 → +800 …) and past
 * the last milestone the bonus is 0. The tip glows and throws sparks.
 *
 * Shared by the AITB mission page and the AI-infused Bingo demo, which plays the
 * same missions on a Bingo tile — `scale` lets that board show the same ladder
 * in its own (much smaller) point economy without the two drifting apart.
 */
import { AITB_BONUS_MULT, aitbSpeedBonus, fmtElapsed, type AitbActivity } from '../lib/aitbActivities'

function fmtMin(mins: number): string {
  const s = Math.round(mins * 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AitbBonusBar({ elapsedMs, activity, completed, bankedBonus, scale = 1 }: {
  elapsedMs: number
  activity: AitbActivity
  completed: boolean
  bankedBonus: number
  /** Multiplier on every points figure shown AND on the live "finish now for"
   *  number, so a host board can run this ladder at its own scale. */
  scale?: number
}) {
  const tiers = activity.bonusTiers
  const endMin = tiers[tiers.length - 1].uptoMin // bar span: 0 → last milestone
  const frac = Math.min(1, elapsedMs / (endMin * 60_000))
  const liveBonus = Math.round(aitbSpeedBonus(elapsedMs, activity) * scale)
  const shown = completed ? bankedBonus : liveBonus
  // Awarded bonus is difficulty-multiplied (aitbSpeedBonus), so the milestone
  // ladder must show the SAME multiplied points — otherwise Normal/Hard missions
  // display raw tier numbers that never match the "finish now for +X" figure.
  const mult = AITB_BONUS_MULT[activity.difficulty] ?? 1
  const tierPts = (i: number) => Math.round(tiers[i].pts * mult * scale)
  const maxPts = tierPts(0)
  const ratio = maxPts ? shown / maxPts : 0
  const barColor = ratio >= 0.9 ? '#34d399' : ratio >= 0.7 ? '#2dd4bf' : ratio >= 0.5 ? '#fbbf24' : ratio > 0.2 ? '#fb923c' : '#f87171'
  // spark particles fly off the tip in fixed directions with staggered delays
  const sparks = [
    { dx: 10, dy: -14, dur: 0.8, delay: 0 }, { dx: -8, dy: -16, dur: 1.0, delay: 0.15 },
    { dx: 14, dy: -6, dur: 0.7, delay: 0.3 }, { dx: -12, dy: 8, dur: 0.9, delay: 0.45 },
    { dx: 8, dy: 14, dur: 0.85, delay: 0.6 }, { dx: -4, dy: 16, dur: 1.1, delay: 0.75 },
  ]
  const segWidth = (i: number) => {
    const from = i === 0 ? 0 : tiers[i - 1].uptoMin
    return ((tiers[i].uptoMin - from) / endMin) * 100
  }
  return (
    <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{completed ? 'Finished in' : '⏱ Your team timer'}</div>
          <div className="font-black text-3xl tabular-nums">{fmtElapsed(elapsedMs)}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{completed ? 'Bonus banked' : 'Finish NOW for'}</div>
          <div className="font-black text-2xl transition-colors duration-700" style={{ color: completed ? '#34d399' : barColor }}>
            +{shown}{!completed && ' pts'}
          </div>
        </div>
      </div>
      {/* milestone track */}
      <div className="relative h-5 rounded-full overflow-visible" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {tiers.slice(0, -1).map(t => (
          <div key={t.uptoMin} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${(t.uptoMin / endMin) * 100}%` }} />
        ))}
        {/* fill */}
        <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${frac * 100}%`, background: `linear-gradient(90deg, ${barColor}55, ${barColor})`, minWidth: 10 }} />
        {/* glowing tip + sparks */}
        {!completed && (
          <div className="absolute top-1/2" style={{ left: `${frac * 100}%`, color: barColor }}>
            <div className="aitb-tip absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 14, height: 14, background: `radial-gradient(circle, #fff 15%, ${barColor} 60%)` }} />
            {sparks.map((s, i) => (
              <span key={i} className="aitb-spark"
                style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--dur': `${s.dur}s`, '--delay': `${s.delay}s` } as React.CSSProperties} />
            ))}
          </div>
        )}
      </div>
      {/* milestone labels: points + the time each milestone ends */}
      <div className="flex text-[10px] font-black mt-1 text-gray-400">
        {tiers.map((t, i) => (
          <span key={t.uptoMin} style={{ width: `${segWidth(i)}%`, color: !completed && shown === tierPts(i) ? barColor : undefined }}>
            +{tierPts(i)}
            <span className="block font-bold text-gray-600">≤{fmtMin(t.uptoMin)}</span>
          </span>
        ))}
        <span style={{ color: !completed && shown === 0 ? '#f87171' : undefined }}>0</span>
      </div>
      {!completed && (
        <div className="text-gray-500 text-xs font-bold mt-1">
          ⚡ Every milestone you pass, the bonus drops — finish before the bar hits the end!
        </div>
      )}
    </div>
  )
}
