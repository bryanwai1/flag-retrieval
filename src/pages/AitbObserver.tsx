import { useCallback, useEffect, useMemo, useState } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'
import { AitbRaceStage } from '../components/AitbRaceStage'
import { useAitbReactions, AITB_REACTIONS } from '../hooks/useAitbReactions'
import { useAitbRealtime } from '../hooks/useAitbRealtime'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  AITB_ACTIVITIES, aitbProgressPoints, aitbActivity, aitbMaxPoints, aitbSpeedBonus,
} from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import type { AitbTeam, AitbProgress } from '../types/database'

// The team this phone is following. Seeded from the home board's pick so a player
// who already chose their team lands straight on their own progress, but written
// to its own key — switching who you watch must never hijack the playing board.
const WATCH_KEY = 'aitb_cheer_team'
const HOME_TEAM_KEY = 'aitb_my_team'
const OBSERVER_SUBS = [{ table: 'aitb_progress' }, { table: 'aitb_teams' }]
const TOTAL = AITB_ACTIVITIES.length

function initialTeam(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(WATCH_KEY) || localStorage.getItem(HOME_TEAM_KEY)
}

// mm:ss, rolling into h:mm:ss — a mission left checked in from an earlier session
// otherwise reads as a nonsense four-digit minute count.
function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60) % 60
  const h = Math.floor(s / 3600)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * Observer / spectator screen (/aitb/watch). Opens on MY TEAM'S PROGRESS — the
 * mission-by-mission board: what's running now (with live timer, ticked steps and
 * the speed bonus still on the table), what's banked, what's left. The all-teams
 * race is a second tab for anyone who wants the standings. Both views carry the
 * reaction bar: emoji fire off this team's rocket on every screen.
 */
export function AitbObserver() {
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [teamId, setTeamId] = useState<string | null>(initialTeam)
  const [view, setView] = useState<'team' | 'race'>('team')
  const [now, setNow] = useState(Date.now())
  const { reactions, sendReaction } = useAitbReactions()
  const { remainingMs: gameRemainingMs, endsAt: gameEndsAt, timeUp } = useAitbGameTimer()

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const [t, p] = await Promise.all([
      supabase.from('aitb_teams').select('*').order('sort_order').order('created_at'),
      supabase.from('aitb_progress').select('*'),
    ])
    setTeams(t.data ?? [])
    setProgress(p.data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  useAitbRealtime('aitb-observer', OBSERVER_SUBS, load)

  // Live clock for the in-progress elapsed timers and the decaying speed bonus.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const ranked = useMemo(() =>
    teams.map(t => {
      const rows = progress.filter(p => p.team_id === t.id)
      return {
        team: t, rows,
        total: rows.reduce((a, p) => a + aitbProgressPoints(p, aitbActivity(p.activity_id)), 0) + (t.adjust || 0),
        completed: rows.filter(p => p.completed_at).length,
      }
    }).sort((a, b) => b.total - a.total || b.completed - a.completed),
    [teams, progress])

  // Teams with a mission checked in but not yet signed off = on a station now.
  const nowPlaying = useMemo(() =>
    ranked
      .map(({ team, rows }) => ({
        team,
        missions: rows
          .filter(p => p.scanned_at && !p.completed_at)
          .map(p => aitbActivity(p.activity_id))
          .filter((a): a is NonNullable<typeof a> => !!a),
      }))
      .filter(x => x.missions.length > 0),
    [ranked])

  const team = teams.find(t => t.id === teamId) || null
  const pickTeam = (id: string) => { setTeamId(id); try { localStorage.setItem(WATCH_KEY, id) } catch { /* ignore */ } }
  const fire = (emoji: string) => { if (team) sendReaction(team.id, emoji) }

  // ── This team's board: every mission, in play / banked / still to draw ──────
  const mine = useMemo(() => {
    const i = ranked.findIndex(r => r.team.id === teamId)
    const entry = i < 0 ? null : ranked[i]
    const rows = entry?.rows ?? []
    const missions = AITB_ACTIVITIES.map(act => {
      const row = rows.find(r => r.activity_id === act.id)
      const status: 'done' | 'active' | 'todo' =
        row?.completed_at ? 'done' : (row?.scanned_at ? 'active' : 'todo')
      return { act, row: row ?? null, status, pts: row ? aitbProgressPoints(row, act) : 0 }
    })
    return {
      rank: i < 0 ? null : i + 1,
      total: entry?.total ?? 0,
      completed: entry?.completed ?? 0,
      active: missions.filter(m => m.status === 'active'),
      // Newest completion first — the team's most recent win reads at the top.
      done: missions.filter(m => m.status === 'done')
        .sort((a, b) => (b.row?.completed_at || '').localeCompare(a.row?.completed_at || '')),
      todo: missions.filter(m => m.status === 'todo'),
    }
  }, [ranked, teamId])

  const countdownChip = gameEndsAt && (
    <span className="px-3 py-1 rounded-full font-black tabular-nums text-sm"
      style={timeUp
        ? { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1.5px solid #f87171' }
        : { background: 'rgba(255,255,255,0.06)', color: gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24', border: '1.5px solid rgba(255,255,255,0.15)' }}>
      {timeUp ? "⏰ TIME'S UP!" : `⏳ ${fmtCountdown(gameRemainingMs!)}`}
    </span>
  )

  // No team followed yet → pick one, then land on its progress.
  if (!team) {
    return (
      <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden flex flex-col">
        <ParticleBackground />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="text-5xl">🚀</div>
          <h1 className="text-2xl font-black tracking-tight">Which team are you following?</h1>
          <p className="text-gray-400 text-sm font-bold">See their missions live — and cheer them on.</p>
          {teams.length === 0
            ? <p className="text-gray-500 text-sm mt-2">No teams yet — ask the game master to add teams.</p>
            : <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm mt-2">
                {teams.map(t => (
                  <button key={t.id} onClick={() => pickTeam(t.id)}
                    className="flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.06)', color: t.color, border: `2px solid ${t.color}55` }}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />{t.name}
                  </button>
                ))}
              </div>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden flex flex-col">
      <ParticleBackground />

      <div className="relative z-10 flex flex-col flex-1 px-4 pt-4 pb-2">
        {/* Header — whose board this is, and how they're doing */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-black tracking-[0.22em] text-gray-400">FOLLOWING</div>
            <h1 className="text-2xl font-black tracking-tight truncate" style={{ color: team.color }}>
              ● {team.name}
            </h1>
          </div>
          <button onClick={() => { setTeamId(null); try { localStorage.removeItem(WATCH_KEY) } catch { /* ignore */ } }}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-300"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.14)' }}>
            Switch
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {mine.rank && teams.length > 1 && (() => {
            const emoji = ['🥇', '🥈', '🥉'][mine.rank - 1] ?? '🏆'
            const c = mine.rank === 1 ? '#fbbf24' : mine.rank === 2 ? '#cbd5e1' : mine.rank === 3 ? '#f59e0b' : '#a48bff'
            return (
              <span className="px-3 py-1 rounded-full font-black text-sm"
                style={{ color: c, background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${c}66` }}>
                {emoji} #{mine.rank} <span className="opacity-60 font-bold">of {teams.length}</span>
              </span>
            )
          })()}
          <span className="px-3 py-1 rounded-full font-black text-sm tabular-nums"
            style={{ color: '#fde68a', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(253,230,138,0.4)' }}>
            {mine.total.toLocaleString()} pts
          </span>
          {countdownChip}
        </div>

        {/* View switch — the team's own board first, standings on demand */}
        <div className="flex gap-1 mt-3 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {([['team', '🚀 Our Missions'], ['race', '🛰️ Race']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="flex-1 py-2 rounded-xl text-sm font-black transition-colors"
              style={view === v
                ? { background: 'rgba(255,255,255,0.14)', color: '#fff' }
                : { color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {view === 'team' ? (
          <div className="mt-3 flex flex-col gap-3">
            {/* Mission progress bar */}
            <div className="relative h-8 rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="absolute inset-y-0 left-0 rounded-xl transition-[width] duration-1000"
                style={{ width: `${Math.round((mine.completed / TOTAL) * 100)}%`, background: `linear-gradient(90deg, ${team.color}, #38bdf8)` }} />
              <div className="absolute inset-0 flex items-center justify-between px-3 text-[11.5px] font-bold"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                <span>{mine.completed >= TOTAL ? 'All missions complete! 🎉' : `${mine.completed} / ${TOTAL} missions done`}</span>
                <span>{TOTAL - mine.completed} to go</span>
              </div>
            </div>

            {/* Playing right now — live timer, ticked steps, bonus still on the clock */}
            <div>
              <div className="text-[11px] font-black tracking-widest uppercase text-gray-400 mb-1.5">
                🎯 Playing right now
              </div>
              {mine.active.length === 0
                ? <div className="rounded-2xl px-3 py-4 text-center text-sm font-bold text-gray-500"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.14)' }}>
                    No mission running — draw one on the team board.
                  </div>
                : <div className="flex flex-col gap-2">
                    {mine.active.map(({ act, row, pts }) => {
                      const started = row?.scanned_at ? new Date(row.scanned_at).getTime() : null
                      const stepsDone = row?.steps_done?.length ?? 0
                      const liveBonus = started ? aitbSpeedBonus(now - started, act) : 0
                      return (
                        <div key={act.id} className="rounded-2xl px-3 py-2.5"
                          style={{ background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${act.color}66` }}>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{act.emoji}</span>
                            <span className="font-black text-sm flex-1 min-w-0" style={{ color: act.color }}>{act.name}</span>
                            {started && (
                              <span className="text-xs font-black tabular-nums text-gray-300">⏱ {fmtElapsed(now - started)}</span>
                            )}
                          </div>
                          {/* One pip per step, filled as the team ticks them off */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {act.steps.map((_, i) => (
                              <span key={i} className="h-1.5 flex-1 rounded-full"
                                style={{ background: i < stepsDone ? act.color : 'rgba(255,255,255,0.14)' }} />
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[11px] font-bold">
                            <span className="text-gray-400">{stepsDone} / {act.steps.length} steps · {pts.toLocaleString()} pts banked</span>
                            {liveBonus > 0 && <span style={{ color: '#fde68a' }}>⚡ {liveBonus.toLocaleString()} bonus if done now</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>}
            </div>

            {/* Banked missions */}
            {mine.done.length > 0 && (
              <div>
                <div className="text-[11px] font-black tracking-widest uppercase text-gray-400 mb-1.5">
                  ✅ Completed ({mine.done.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {mine.done.map(({ act, row, pts }) => {
                    const took = row?.scanned_at && row?.completed_at
                      ? new Date(row.completed_at).getTime() - new Date(row.scanned_at).getTime()
                      : null
                    return (
                      <div key={act.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${act.color}33` }}>
                        <span className="text-lg">{act.emoji}</span>
                        <span className="font-bold text-sm flex-1 min-w-0 truncate">{act.name}</span>
                        {took !== null && <span className="text-[11px] font-bold text-gray-500 tabular-nums">⏱ {fmtElapsed(took)}</span>}
                        <span className="text-xs font-black tabular-nums" style={{ color: '#6ee7b7' }}>+{pts.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Still on the table */}
            {mine.todo.length > 0 && (
              <div>
                <div className="text-[11px] font-black tracking-widest uppercase text-gray-400 mb-1.5">
                  ⬜ Not started ({mine.todo.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mine.todo.map(({ act }) => (
                    <span key={act.id} className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {act.emoji} {act.name} <span className="opacity-60">· up to {aitbMaxPoints(act).toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <AitbRaceStage ranked={ranked} reactions={reactions} />

            {/* Now playing — which mission each team is on right now */}
            {nowPlaying.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-black tracking-widest uppercase text-gray-400 mb-1.5 text-center">
                  🎯 Playing right now
                </div>
                <div className="flex flex-col gap-1.5">
                  {nowPlaying.map(({ team: t, missions }) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${t.color}44` }}>
                      <span className="font-black text-sm whitespace-nowrap" style={{ color: t.color }}>● {t.name}</span>
                      <span className="flex flex-wrap gap-1.5 justify-end flex-1">
                        {missions.map(m => (
                          <span key={m.id} className="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }}>
                            {m.emoji} {m.name}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reaction dock — cheers always fire off the team you're following */}
      <div className="relative z-10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 mt-2"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(8,6,20,0.9) 22%)' }}>
        <div className="text-center text-xs font-bold text-gray-400 mb-2">
          Cheer <span style={{ color: team.color }}>● {team.name}</span> — reactions pop on the big screen 🎉
        </div>
        <div className="flex justify-center gap-2">
          {AITB_REACTIONS.map(e => (
            <button key={e} onClick={() => fire(e)}
              aria-label={`React ${e}`}
              className="text-3xl w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.14)' }}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
