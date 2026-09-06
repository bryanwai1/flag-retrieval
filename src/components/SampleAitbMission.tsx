/**
 * An AI Team Building mission, played on a Bingo tile.
 *
 * Same flow as the real AITB mission page — check in, spin/deal the module, tick
 * the steps, finish before the bonus decays — but every action is local React
 * state handed up to the sample board, which banks the points into the team's
 * Bingo score. Nothing is written to Supabase.
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { AitbMissionModule } from './AitbMissionModule'
import { AitbAppLinks } from './AitbAppLinks'
import { AitbBonusBar } from './AitbBonusBar'
import { ParticleBackground } from './ParticleBackground'
import {
  AITB_BONUS_SCALE, AITB_TILE_STEP, aitbTileBreakdown, aitbTilePoints, aitbTileSpeedBonus,
  type AitbTileRun,
} from '../lib/bingoAitb'
import { fmtElapsed, type AitbActivity } from '../lib/aitbActivities'
import type { DetailStep } from '../hooks/useSampleRemote'
import type { SampleTaskDetailHandle } from '../pages/BingoDashSample'

export const SampleAitbMission = forwardRef<SampleTaskDetailHandle, {
  activity: AitbActivity
  teamName: string
  marshalPassword: string
  run: AitbTileRun | null
  onCheckIn: () => void
  onToggleStep: (index: number) => void
  onSaveWords: (words: string[]) => void
  onComplete: (bonus: number) => void
  onClose: () => void
  onStep?: (s: DetailStep) => void
}>(function SampleAitbMission({
  activity, teamName, marshalPassword, run,
  onCheckIn, onToggleStep, onSaveWords, onComplete, onClose, onStep,
}, ref) {
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  // Ticked by the interval below; starts at 0 so the first render is pure and
  // simply reads as 0:00, which is what a mission that just started shows.
  const [now, setNow] = useState(0)

  const completed = !!run?.completedAt

  // Tick the mission timer while the team is still running.
  useEffect(() => {
    if (!run || completed) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [run, completed])

  const elapsedMs = run ? (run.completedAt ?? Math.max(now, run.startedAt)) - run.startedAt : 0

  const doComplete = () => {
    if (!run || completed) return
    if (pw.trim() !== marshalPassword) { setPwError('Wrong password — ask the marshal!'); return }
    onComplete(aitbTileSpeedBonus(Date.now() - run.startedAt, activity))
    setPwError('')
    setCelebrate(true)
  }

  // The phone remote drives the same flow: Start → (steps) → password → Complete.
  useImperativeHandle(ref, () => ({
    start: () => { if (!run) onCheckIn() },
    nextPage: () => {
      const next = activity.steps.findIndex((_, i) => !run?.steps.includes(i))
      if (next !== -1) onToggleStep(next)
    },
    prevPage: () => {
      const last = [...(run?.steps ?? [])].sort((a, b) => b - a)[0]
      if (last !== undefined) onToggleStep(last)
    },
    fillMarshal: () => { setPw(marshalPassword); setPwError('') },
    submitComplete: () => doComplete(),
  }))

  // Report the flow position up so the controller renders the right buttons.
  useEffect(() => {
    onStep?.({
      phase: run ? 'main' : 'splash',
      pageIndex: run?.steps.length ?? 0,
      pageCount: activity.steps.length,
      isMarshalTask: true,
      marshalFilled: pw.trim() === marshalPassword,
    })
  }, [onStep, run, activity.steps.length, pw, marshalPassword])

  // ── Splash: check in and start the clock ──
  if (!run) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{ backgroundColor: activity.color }}
        onClick={onCheckIn}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 text-center px-8 animate-bounce-in">
          <div className="text-6xl mb-6">{activity.emoji}</div>
          <p className="text-sm font-bold opacity-70 uppercase tracking-[0.2em] mb-2">AI Team Building · Activity {activity.act}</p>
          <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight">{activity.name}</h1>
          <div className="w-16 h-1 bg-white/40 rounded-full mx-auto mb-4" />
          <p className="text-lg opacity-90 font-bold mb-2">{activity.tagline}</p>
          <p className="text-sm opacity-70 font-medium">Team: {teamName}</p>
        </div>

        <button
          className="relative z-10 mt-8 px-10 py-4 bg-white/20 backdrop-blur-sm rounded-2xl text-xl font-black uppercase tracking-wider border-2 border-white/30 hover:bg-white/30 active:scale-95 transition-all animate-slide-up"
          style={{ animationDelay: '0.4s' }}
          onClick={(e) => { e.stopPropagation(); onCheckIn() }}
        >
          Start Mission
        </button>
        <p className="relative z-10 mt-4 text-sm opacity-70 font-bold animate-pulse">
          ⏱ The timer starts now — finish fast for the biggest bonus
        </p>
      </div>
    )
  }

  const livePoints = aitbTilePoints(run, activity)
  const breakdown = aitbTileBreakdown(run, activity)

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: `color-mix(in srgb, ${activity.color} 50%, #0a0a0a)` }}
    >
      <ParticleBackground hexCode={activity.color} />

      <header className="px-6 py-5 text-white relative z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: activity.color, opacity: 0.35 }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="max-w-lg mx-auto relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              className="mt-1 flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white/80 hover:text-white text-xs font-bold transition-colors"
            >
              ← Board
            </button>
            <div>
              <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Team: {teamName}</p>
              <h1 className="text-3xl font-black tracking-tight">{activity.emoji} {activity.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm opacity-70 uppercase tracking-wider">AI Team Building</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20 text-white">{activity.difficulty}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-400 text-emerald-950">{livePoints} pts banked</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-6 relative z-10 text-white">
        <AitbBonusBar
          elapsedMs={elapsedMs}
          activity={activity}
          completed={completed}
          bankedBonus={run.bonus}
          scale={AITB_BONUS_SCALE}
        />

        <div className="rounded-2xl bg-black/25 border border-white/10 p-4 mb-4">
          <p className="text-lg font-black leading-snug">{activity.tagline}</p>
          <p className="text-white/70 text-sm font-medium mt-2">{activity.desc}</p>
          <p className="text-white/50 text-xs font-bold mt-2 uppercase tracking-wider">🎯 {activity.learning}</p>
        </div>

        {/* The mission's own interactive system — spin, deal or draw. */}
        <AitbMissionModule
          activity={activity}
          savedWords={run.words}
          disabled={completed}
          onSave={onSaveWords}
          progressId={String(run.startedAt)}
        />

        {/* Steps — each tick banks points immediately, exactly like AITB. */}
        <div className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-2">
            Your mission · +{AITB_TILE_STEP} pts per step
          </h2>
          <div className="flex flex-col gap-2">
            {activity.steps.map((step, i) => {
              const done = run.steps.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => !completed && onToggleStep(i)}
                  disabled={completed}
                  className="flex items-center gap-3 text-left rounded-2xl px-3 py-3 transition-all active:scale-[0.99] disabled:opacity-80"
                  style={{
                    background: done ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${done ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  }}
                >
                  <span className="text-3xl flex-shrink-0">{activity.stepEmojis[i]}</span>
                  <span className="flex-1 font-bold leading-snug">{step}</span>
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black"
                    style={{
                      background: done ? '#34d399' : 'rgba(255,255,255,0.12)',
                      color: done ? '#052e1b' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {activity.apps.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-2">AI tools for this mission</h2>
            <AitbAppLinks apps={activity.apps} color={activity.color} />
          </div>
        )}

        {activity.props.length > 0 && (
          <div className="mt-5 rounded-2xl bg-black/25 border border-white/10 p-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-2">Collect from the marshal</h2>
            <ul className="flex flex-col gap-1">
              {activity.props.map(p => (
                <li key={p} className="text-sm font-bold text-white/80">📦 {p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Completion — marshal password, same gate as a real AITB mission. */}
        <div className="mt-6 mb-10">
          {completed ? (
            <div className="rounded-2xl bg-emerald-400/15 border-2 border-emerald-400/50 p-5 text-center">
              <div className="text-4xl mb-1">🏆</div>
              <p className="text-emerald-300 font-black text-xl">Mission complete!</p>
              <p className="text-white/70 text-sm font-bold mt-1">
                Finished in {fmtElapsed(elapsedMs)} · {livePoints} pts into the team score
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-3 rounded-2xl bg-white text-gray-900 font-black uppercase tracking-wider active:scale-95 transition-transform"
              >
                Back to board
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-2">Marshal password to finish</h2>
              <div className="flex gap-2">
                <input
                  value={pw}
                  onChange={e => { setPw(e.target.value); setPwError('') }}
                  placeholder="Enter password"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border-2 border-white/15 text-white font-bold placeholder-white/30 focus:outline-none focus:border-white/40"
                />
                <button
                  onClick={doComplete}
                  className="px-5 py-3 rounded-xl font-black uppercase tracking-wider text-gray-900 bg-white active:scale-95 transition-transform"
                >
                  Finish
                </button>
              </div>
              {pwError && <p className="text-red-300 text-sm font-bold mt-2">{pwError}</p>}
              <p className="text-white/40 text-xs font-bold mt-2">⚡ Every second costs bonus points — finish as soon as you're done.</p>
            </div>
          )}
        </div>
      </main>

      {/* Itemised points popup — what the team just banked, line by line. */}
      {celebrate && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setCelebrate(false)}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 text-center animate-bounce-in"
            style={{ background: `linear-gradient(160deg, ${activity.color}, #0a0a0a)` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-6xl mb-2">🎉</div>
            <h2 className="text-white text-2xl font-black">Mission complete!</h2>
            <p className="text-white/70 text-sm font-bold mb-4">{activity.name} · {fmtElapsed(elapsedMs)}</p>

            <div className="flex flex-col gap-1.5 text-left mb-4">
              {breakdown.map(line => (
                <div key={line.label} className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2">
                  <span className="text-white/80 text-sm font-bold">{line.label}</span>
                  <span className="text-white font-black tabular-nums">+{line.points}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/15 px-3 py-2.5 mt-1">
                <span className="text-white text-sm font-black uppercase tracking-wider">Added to team score</span>
                <span className="text-emerald-300 text-2xl font-black tabular-nums">+{livePoints}</span>
              </div>
            </div>

            <button
              onClick={() => { setCelebrate(false); onClose() }}
              className="w-full py-3 rounded-2xl bg-white text-gray-900 font-black uppercase tracking-wider active:scale-95 transition-transform"
            >
              Back to board
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
