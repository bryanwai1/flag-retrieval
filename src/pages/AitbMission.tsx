import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { aitbActivity, AITB_POINTS, aitbSpeedBonus, aitbProgressPoints } from '../lib/aitbActivities'
import type { AitbTeam, AitbProgress } from '../types/database'

const TEAM_KEY = 'aitb_my_team'

export function AitbMission() {
  const { activityId } = useParams<{ activityId: string }>()
  const activity = aitbActivity(Number(activityId))
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [teamId, setTeamId] = useState<string | null>(() => localStorage.getItem(TEAM_KEY))
  const [progress, setProgress] = useState<AitbProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const busyRef = useRef(false)

  const team = teams.find(t => t.id === teamId) ?? null

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !activity) { setLoading(false); return }
    const { data: teamRows } = await supabase.from('aitb_teams').select('*').order('sort_order').order('created_at')
    setTeams(teamRows ?? [])
    const tid = localStorage.getItem(TEAM_KEY)
    if (tid) {
      const { data: prog } = await supabase
        .from('aitb_progress').select('*')
        .eq('team_id', tid).eq('activity_id', activity.id).maybeSingle()
      setProgress(prog ?? null)
    }
    setLoading(false)
  }, [activity])

  useEffect(() => { load() }, [load])

  // Live ticking timer once checked in
  useEffect(() => {
    if (!progress?.scanned_at || progress.completed_at) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [progress?.scanned_at, progress?.completed_at])

  // Realtime: another phone in the team ticks a step → update here too
  useEffect(() => {
    if (!isSupabaseConfigured || !teamId || !activity) return
    const channel = supabase
      .channel(`aitb-mission-${teamId}-${activity.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_progress', filter: `team_id=eq.${teamId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [teamId, activity, load])

  const pickTeam = (id: string) => {
    localStorage.setItem(TEAM_KEY, id)
    setTeamId(id)
    setProgress(null)
    load()
  }

  // Check-in: creates the progress row, starts the timer, +100 pts
  const checkIn = async () => {
    if (!teamId || !activity || busyRef.current) return
    busyRef.current = true
    const { data } = await supabase
      .from('aitb_progress')
      .upsert(
        { team_id: teamId, activity_id: activity.id, scanned_at: new Date().toISOString() },
        { onConflict: 'team_id,activity_id', ignoreDuplicates: true },
      )
      .select().maybeSingle()
    busyRef.current = false
    if (data) setProgress(data)
    else load() // row already existed (another phone checked in first)
  }

  const toggleStep = async (i: number) => {
    if (!progress || progress.completed_at || busyRef.current) return
    busyRef.current = true
    const done = progress.steps_done.includes(i)
      ? progress.steps_done.filter(x => x !== i)
      : [...progress.steps_done, i].sort((a, b) => a - b)
    const { data } = await supabase
      .from('aitb_progress').update({ steps_done: done })
      .eq('id', progress.id).select().maybeSingle()
    busyRef.current = false
    if (data) setProgress(data)
  }

  // Admin-password completion → +300 + speed bonus
  const tryComplete = async () => {
    if (!progress?.scanned_at || !activity) return
    const { data: settings } = await supabase.from('aitb_settings').select('admin_password').eq('id', 1).maybeSingle()
    if (!settings || pw !== settings.admin_password) {
      setPwError('Wrong password — ask the marshal!')
      return
    }
    const elapsed = Date.now() - new Date(progress.scanned_at).getTime()
    const bonus = aitbSpeedBonus(elapsed, activity.mins)
    const { data } = await supabase
      .from('aitb_progress')
      .update({ completed_at: new Date().toISOString(), bonus })
      .eq('id', progress.id).select().maybeSingle()
    if (data) {
      setProgress(data)
      setPwOpen(false)
      setPw('')
      setPwError('')
      setCelebrate(true)
    }
  }

  const elapsedMs = progress?.scanned_at
    ? (progress.completed_at ? new Date(progress.completed_at).getTime() : now) - new Date(progress.scanned_at).getTime()
    : 0
  const points = progress ? aitbProgressPoints(progress) : 0
  const liveBonus = useMemo(
    () => (progress?.scanned_at && !progress.completed_at && activity ? aitbSpeedBonus(elapsedMs, activity.mins) : null),
    [progress, elapsedMs, activity],
  )

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8 text-center">
        <div><div className="text-6xl mb-3">🤔</div><h1 className="text-2xl font-black">Activity not found</h1></div>
      </div>
    )
  }
  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Hero */}
      <div className="relative">
        <img src={activity.hero} alt="" className="w-full aspect-video object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-xs font-black tracking-widest uppercase" style={{ color: activity.color }}>
            Activity {activity.act} · {activity.mins} min · {activity.outType}
          </div>
          <h1 className="text-3xl font-black leading-tight">{activity.emoji} {activity.name}</h1>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        <p className="text-gray-300 text-base mb-4">{activity.tagline}</p>

        {/* Team picker */}
        {!team && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${activity.color}44` }}>
            <div className="font-black text-lg mb-2">👥 Which team are you?</div>
            {teams.length === 0 && (
              <p className="text-gray-400 text-sm">No teams yet — ask the game master to add teams in the Admin panel!</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {teams.map(t => (
                <button key={t.id} onClick={() => pickTeam(t.id)}
                  className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                  style={{ background: `${t.color}22`, border: `2px solid ${t.color}`, color: t.color }}>
                  ● {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {team && (
          <>
            {/* Team + points bar */}
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${team.color}44` }}>
              <span className="font-black" style={{ color: team.color }}>● {team.name}</span>
              <button onClick={() => { localStorage.removeItem(TEAM_KEY); setTeamId(null); setProgress(null) }}
                className="text-gray-500 text-xs underline">change</button>
              <div className="flex-1" />
              <span className="font-black text-xl" style={{ color: activity.color }}>{points} pts</span>
            </div>

            {/* Check-in / timer */}
            {!progress?.scanned_at ? (
              <button onClick={checkIn}
                className="w-full py-5 rounded-2xl font-black text-xl mb-4 transition-all active:scale-95 animate-pulse"
                style={{ background: activity.color, color: '#000' }}>
                🚀 START MISSION (+{AITB_POINTS.scan} pts)
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-4"
                style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{progress.completed_at ? 'Finished in' : '⏱ Timer running'}</div>
                  <div className="font-black text-3xl tabular-nums">{fmtElapsed(elapsedMs)}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Speed bonus</div>
                  <div className="font-black text-2xl" style={{ color: progress.completed_at ? '#34d399' : activity.color }}>
                    {progress.completed_at ? `+${progress.bonus}` : `+${liveBonus}`}
                  </div>
                </div>
              </div>
            )}

            {/* Steps — fun point form */}
            <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">
              ✅ Tick as you go — +{AITB_POINTS.step} each!
            </div>
            <div className="flex flex-col gap-2 mb-5">
              {activity.steps.map((s, i) => {
                const done = progress?.steps_done.includes(i) ?? false
                const locked = !progress?.scanned_at || !!progress?.completed_at
                return (
                  <button key={i} onClick={() => toggleStep(i)} disabled={locked}
                    className="flex items-center gap-3 text-left rounded-2xl px-4 py-3 transition-all active:scale-[0.98]"
                    style={{
                      background: done ? `${activity.color}1e` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${done ? activity.color : 'rgba(255,255,255,0.1)'}`,
                      opacity: locked && !done ? 0.6 : 1,
                    }}>
                    <span className="text-3xl">{activity.stepEmojis[i]}</span>
                    <span className={`flex-1 font-bold ${done ? 'line-through opacity-70' : ''}`}>{s}</span>
                    <span className="text-2xl">{done ? '✅' : '⬜'}</span>
                  </button>
                )
              })}
            </div>

            {/* Apps */}
            <div className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">🤖 Your AI tools</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {activity.apps.map(a => (
                <span key={a} className="px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: `${activity.color}22`, color: activity.color, border: `1.5px solid ${activity.color}55` }}>
                  {a}
                </span>
              ))}
            </div>

            {/* Full details — tucked away so the page stays fun */}
            <details className="rounded-2xl mb-6 overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.08)' }}>
              <summary className="px-4 py-3 cursor-pointer list-none font-black text-sm" style={{ background: 'rgba(255,255,255,0.04)', color: activity.color }}>
                📖 More info
              </summary>
              <div className="px-4 py-3">
                <p className="text-gray-300 text-sm leading-relaxed mb-2">{activity.desc}</p>
                <p className="text-gray-500 text-sm">🧠 {activity.learning}</p>
              </div>
            </details>

            {/* Complete */}
            {progress?.completed_at ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid #34d399' }}>
                <div className="text-5xl mb-1">🎉</div>
                <div className="font-black text-2xl text-emerald-400">MISSION COMPLETE!</div>
                <div className="text-gray-300 font-bold mt-1">{points} points earned{progress.bonus ? ` — incl. +${progress.bonus} speed bonus!` : ''}</div>
              </div>
            ) : progress?.scanned_at ? (
              <button onClick={() => { setPwOpen(true); setPwError('') }}
                className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95"
                style={{ background: 'rgba(52,211,153,0.15)', border: '2px solid #34d399', color: '#34d399' }}>
                🏁 DONE? CALL THE MARSHAL!
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Password modal */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPwOpen(false)}>
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm" style={{ border: '2px solid rgba(52,211,153,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center text-4xl mb-2">🔒</div>
            <div className="font-black text-xl text-center mb-1">Marshal check</div>
            <p className="text-gray-400 text-sm text-center mb-4">Hand your phone to the marshal! 🙌</p>
            <input
              type="password" inputMode="numeric" autoFocus value={pw}
              onChange={e => { setPw(e.target.value); setPwError('') }}
              onKeyDown={e => { if (e.key === 'Enter') tryComplete() }}
              placeholder="Marshal password"
              className="w-full bg-gray-800 rounded-xl px-4 py-3 font-bold text-center text-lg outline-none mb-2"
              style={{ border: pwError ? '2px solid #f87171' : '2px solid rgba(255,255,255,0.15)' }}
            />
            {pwError && <div className="text-red-400 text-sm font-bold text-center mb-2">{pwError}</div>}
            <button onClick={tryComplete}
              className="w-full py-3 rounded-xl font-black text-lg"
              style={{ background: '#34d399', color: '#000' }}>
              ✅ Confirm complete
            </button>
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {celebrate && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" onClick={() => setCelebrate(false)}>
          <div className="text-center animate-bounce-in">
            <div className="text-8xl mb-3">🏆</div>
            <div className="font-black text-4xl mb-2" style={{ color: activity.color }}>{points} POINTS!</div>
            <div className="text-gray-300 font-bold text-lg">{team?.name} smashed {activity.name}!</div>
            <div className="text-gray-500 text-sm mt-4">tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
