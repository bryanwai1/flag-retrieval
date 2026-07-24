import { useCallback, useEffect, useMemo, useState } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AITB_ACTIVITIES, aitbProgressPoints, aitbActivity } from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import type { AitbTeam, AitbProgress } from '../types/database'

export function AitbProjector() {
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [now, setNow] = useState(Date.now())
  const [view, setView] = useState<number | null>(null) // null = scoreboard, 1-10 = game briefing slide
  const { endsAt: gameEndsAt, remainingMs: gameRemainingMs, timeUp } = useAitbGameTimer()

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

  // Game briefing slide — full details on the big screen
  if (view !== null) {
    const a = aitbActivity(view)!
    return (
      <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={a.hero} alt="" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto p-12 min-h-screen flex flex-col">
          {/* Compact game countdown so the host sees it even on briefing slides */}
          {gameEndsAt && (
            <div className="fixed top-4 right-4 z-20 px-5 py-2.5 rounded-2xl font-black text-2xl tabular-nums backdrop-blur"
              style={timeUp
                ? { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '2px solid #f87171' }
                : { background: 'rgba(17,24,39,0.75)', color: gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24', border: '2px solid rgba(255,255,255,0.15)' }}>
              {timeUp ? "⏰ TIME'S UP!" : `⏳ ${fmtCountdown(gameRemainingMs!)}`}
            </div>
          )}
          <GameNav view={view} setView={setView} />
          <div className="flex-1 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-xl font-black tracking-widest uppercase mb-2" style={{ color: a.color }}>
                Activity {a.act} · ⏱ {a.mins} min · 🎁 {a.outType}
              </div>
              <h1 className="text-6xl font-black leading-tight mb-5">{a.emoji} {a.name}</h1>
              <p className="text-3xl font-bold leading-snug mb-5" style={{ color: a.color }}>{a.tagline}</p>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">{a.desc}</p>
              <div className="flex flex-wrap gap-3 mb-8">
                {a.apps.map(x => (
                  <span key={x} className="px-5 py-2 rounded-full text-xl font-bold"
                    style={{ background: `${a.color}22`, color: a.color, border: `2px solid ${a.color}66` }}>
                    {x}
                  </span>
                ))}
              </div>
              {/* Opens the interactive game screen (cup board, roulette wheels,
                  card draw, arcade...) from the embedded Game System app */}
              <a href={`/gamesystem/index.html#/game/${a.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-block px-8 py-4 rounded-2xl font-black text-2xl transition-all hover:scale-105"
                style={{ background: a.color, color: '#000' }}>
                🎮 SHOW THE GAME
              </a>
            </div>
            <div className="flex flex-col gap-4">
              {a.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-5 rounded-3xl px-7 py-5"
                  style={{ background: 'rgba(255,255,255,0.06)', border: `2px solid ${a.color}44` }}>
                  <span className="text-5xl">{a.stepEmojis[i]}</span>
                  <span className="text-2xl font-bold">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden p-10">
      <ParticleBackground />

      <div className="relative z-10 max-w-7xl mx-auto">
        <GameNav view={view} setView={setView} />
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black tracking-tight animate-slide-up">🤖 AI TEAM BUILDING</h1>
          <p className="text-gray-400 text-2xl mt-2 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            scan 📱 · play 🎮 · score 🏆
          </p>
          {/* Whole-game countdown, big for the back of the room */}
          {gameEndsAt && !timeUp && (
            <div className="inline-block mt-6 px-12 py-4 rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `3px solid ${gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24'}66`,
              }}>
              <span className="font-black text-8xl tabular-nums"
                style={{ color: gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24' }}>
                ⏳ {fmtCountdown(gameRemainingMs!)}
              </span>
            </div>
          )}
          {timeUp && (
            <div className="inline-block mt-6 px-14 py-5 rounded-3xl animate-pulse"
              style={{ background: 'rgba(248,113,113,0.12)', border: '3px solid #f87171' }}>
              <span className="font-black text-8xl text-red-400">⏰ TIME'S UP!</span>
            </div>
          )}
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
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/* Top nav: 🏆 scoreboard + one button per game, so the host can flash any
   game's full briefing on the projector, then flip back to live scores. */
function GameNav({ view, setView }: { view: number | null; setView: (v: number | null) => void }) {
  return (
    <div className="flex gap-2 justify-center flex-wrap mb-8">
      <a href="/aitb/admin"
        className="px-4 py-2 rounded-xl font-black text-lg transition-all hover:scale-105"
        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.2)' }}>
        ← Admin
      </a>
      <button onClick={() => setView(null)}
        className="px-4 py-2 rounded-xl font-black text-lg transition-all hover:scale-105"
        style={view === null
          ? { background: '#2dd4bf', color: '#000' }
          : { background: 'rgba(255,255,255,0.06)', color: '#2dd4bf', border: '1.5px solid #2dd4bf55' }}>
        🏆 Scores
      </button>
      {AITB_ACTIVITIES.map(a => (
        <button key={a.id} onClick={() => setView(a.id)}
          className="px-4 py-2 rounded-xl font-black text-lg transition-all hover:scale-105"
          style={view === a.id
            ? { background: a.color, color: '#000' }
            : { background: 'rgba(255,255,255,0.06)', color: a.color, border: `1.5px solid ${a.color}55` }}>
          {a.emoji} {a.act}
        </button>
      ))}
    </div>
  )
}
