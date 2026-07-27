import { useCallback, useEffect, useMemo, useState } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'
import { AitbRaceStage } from '../components/AitbRaceStage'
import { useAitbReactions, AITB_REACTIONS } from '../hooks/useAitbReactions'
import { useAitbRealtime } from '../hooks/useAitbRealtime'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { aitbProgressPoints, aitbActivity } from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import type { AitbTeam, AitbProgress } from '../types/database'

const CHEER_KEY = 'aitb_cheer_team'
const OBSERVER_SUBS = [{ table: 'aitb_progress' }, { table: 'aitb_teams' }]

/**
 * Observer / spectator screen (/aitb/watch). Shows the same live race the
 * projector shows, read-only, plus a reaction bar: pick a team to cheer, then
 * fire emoji that float off that team's rocket on every screen.
 */
export function AitbObserver() {
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [cheerId, setCheerId] = useState<string | null>(() =>
    (typeof localStorage !== 'undefined' ? localStorage.getItem(CHEER_KEY) : null))
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

  const cheerTeam = teams.find(t => t.id === cheerId) || null
  const pickTeam = (id: string) => { setCheerId(id); try { localStorage.setItem(CHEER_KEY, id) } catch { /* ignore */ } }
  const fire = (emoji: string) => { if (cheerTeam) sendReaction(cheerTeam.id, emoji) }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden flex flex-col">
      <ParticleBackground />

      <div className="relative z-10 flex flex-col flex-1 px-4 pt-4 pb-2">
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight">🛰️ Race Watch</h1>
          <p className="text-gray-400 text-sm font-bold">cheer your team — reactions pop on the big screen 🎉</p>
          {gameEndsAt && (
            <div className="inline-block mt-2 px-4 py-1 rounded-full font-black tabular-nums"
              style={timeUp
                ? { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1.5px solid #f87171' }
                : { background: 'rgba(255,255,255,0.06)', color: gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24', border: '1.5px solid rgba(255,255,255,0.15)' }}>
              {timeUp ? "⏰ TIME'S UP!" : `⏳ ${fmtCountdown(gameRemainingMs!)}`}
            </div>
          )}
        </div>

        <AitbRaceStage ranked={ranked} reactions={reactions} />
      </div>

      {/* Reaction dock */}
      <div className="relative z-10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(8,6,20,0.9) 22%)' }}>
        <div className="text-center text-xs font-bold text-gray-400 mb-2">
          {cheerTeam
            ? <>Cheering <span style={{ color: cheerTeam.color }}>● {cheerTeam.name}</span> — tap to change:</>
            : <>👇 Pick a team to cheer for:</>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 justify-start sm:justify-center">
          {teams.map(t => (
            <button key={t.id} onClick={() => pickTeam(t.id)}
              className="shrink-0 px-3 py-1.5 rounded-full font-black text-sm transition-all active:scale-95"
              style={cheerId === t.id
                ? { background: t.color, color: '#000', border: `2px solid ${t.color}` }
                : { background: 'rgba(255,255,255,0.06)', color: t.color, border: `2px solid ${t.color}55` }}>
              {t.name}
            </button>
          ))}
          {teams.length === 0 && <span className="text-gray-500 text-sm py-1.5">No teams yet…</span>}
        </div>
        <div className="flex justify-center gap-2">
          {AITB_REACTIONS.map(e => (
            <button key={e} onClick={() => fire(e)} disabled={!cheerTeam}
              aria-label={`React ${e}`}
              className="text-3xl w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-35"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.14)' }}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
