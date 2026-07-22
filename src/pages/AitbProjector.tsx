import { useCallback, useEffect, useMemo, useState } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AITB_ACTIVITIES, aitbProgressPoints } from '../lib/aitbActivities'
import type { AitbTeam, AitbProgress } from '../types/database'

export function AitbProjector() {
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [now, setNow] = useState(Date.now())

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

  // Tick every second so running mission timers stay live on screen
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('aitb-projector')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_progress' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_teams' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const ranked = useMemo(() => {
    return teams
      .map(t => {
        const rows = progress.filter(p => p.team_id === t.id)
        return {
          team: t,
          rows,
          total: rows.reduce((a, p) => a + aitbProgressPoints(p), 0),
          completed: rows.filter(p => p.completed_at).length,
        }
      })
      .sort((a, b) => b.total - a.total || b.completed - a.completed)
  }, [teams, progress])

  const maxTotal = Math.max(1, ranked[0]?.total ?? 0)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden p-10">
      <ParticleBackground />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black tracking-tight animate-slide-up">🤖 AI TEAM BUILDING</h1>
          <p className="text-gray-400 text-2xl mt-2 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            Live scoreboard — scan · play · complete · score!
          </p>
        </div>

        {ranked.length === 0 && (
          <div className="text-center text-gray-500 text-2xl mt-20">
            No teams yet — add teams in the Admin panel to begin!
          </div>
        )}

        <div className="flex flex-col gap-5">
          {ranked.map(({ team, rows, total, completed }, i) => {
            const running = rows.filter(p => p.scanned_at && !p.completed_at)
            return (
              <div key={team.id}
                className="rounded-3xl px-8 py-5 transition-all duration-700"
                style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${team.color}${i === 0 ? '' : '44'}` }}>
                <div className="flex items-center gap-6">
                  <div className="text-5xl w-16 text-center">{medals[i] ?? `#${i + 1}`}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <span className="font-black text-4xl truncate" style={{ color: team.color }}>{team.name}</span>
                      <span className="text-gray-400 font-bold text-xl">{completed}/10 missions</span>
                      {running.map(p => {
                        const a = AITB_ACTIVITIES.find(x => x.id === p.activity_id)!
                        const el = now - new Date(p.scanned_at!).getTime()
                        return (
                          <span key={p.id} className="font-bold text-xl" style={{ color: a.color }}>
                            {a.emoji} {fmtElapsed(el)}
                          </span>
                        )
                      })}
                    </div>
                    {/* score bar */}
                    <div className="mt-3 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(total / maxTotal) * 100}%`, background: team.color }} />
                    </div>
                    {/* activity chips */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {AITB_ACTIVITIES.map(a => {
                        const p = rows.find(x => x.activity_id === a.id)
                        const state = p?.completed_at ? 'done' : p?.scanned_at ? 'run' : 'idle'
                        return (
                          <span key={a.id} title={a.name}
                            className="rounded-lg px-2 py-0.5 text-lg font-bold"
                            style={{
                              background: state === 'done' ? `${a.color}33` : 'rgba(255,255,255,0.05)',
                              border: `1.5px solid ${state === 'idle' ? 'rgba(255,255,255,0.1)' : a.color}`,
                              opacity: state === 'idle' ? 0.4 : 1,
                            }}>
                            {a.emoji}{state === 'done' ? '✓' : state === 'run' ? '…' : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="text-right w-48">
                    <div className="font-black text-6xl tabular-nums" style={{ color: team.color }}>{total}</div>
                    <div className="text-gray-400 font-bold tracking-widest uppercase text-sm">points</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
