/**
 * AITB — admin "what did each team get?" panel.
 *
 * One button per game that records a result (the interactive modules — Nerf cup
 * picks, roulette spins, card deals, animal draws — plus the typed word games).
 * Picking a game shows every team's submission side by side, with the reel
 * artwork where a pool has it, so the host can read the room at a glance and
 * call out results on the mic. Updates live via the admin's realtime refresh.
 */
import { useState } from 'react'
import {
  AITB_ACTIVITIES, AITB_MODULE_SLOTS, AITB_REEL_POOLS, aitbReelImage, aitbResultLabels,
  type AitbActivity,
} from '../lib/aitbActivities'
import type { AitbTeam, AitbProgress } from '../types/database'

/** Games that record something a team can "obtain" or submit. */
const RESULT_GAMES = AITB_ACTIVITIES.filter(a => a.module || a.wordsInput)

export function AitbSubmissions({ teams, progress }: { teams: AitbTeam[]; progress: AitbProgress[] }) {
  const [gameId, setGameId] = useState<number>(RESULT_GAMES[0]?.id ?? 0)
  const game = RESULT_GAMES.find(a => a.id === gameId) ?? RESULT_GAMES[0]

  if (!game) return null

  // Only a FULL result counts as submitted. The roulette saves after each wheel,
  // so a half-spun team has words like ['K-Pop', ''] — that must not read as done.
  const submittedCount = (a: AitbActivity) => {
    const expected = (aitbResultLabels(a) ?? []).length
    return teams.filter(t => {
      const words = progress.find(p => p.team_id === t.id && p.activity_id === a.id)?.words ?? []
      return expected > 0 && words.filter(Boolean).length >= expected
    }).length
  }

  return (
    <div className="rounded-3xl mb-8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
      <div className="px-6 pt-5 pb-3">
        <h2 className="font-black text-lg">🎲 What each team got</h2>
        <p className="text-gray-400 text-sm">
          Pick a game to see every team&apos;s roulette spin, card draw, animal draw or word submission — live.
        </p>
      </div>

      {/* Game switcher */}
      <div className="px-6 pb-4 flex flex-wrap gap-2">
        {RESULT_GAMES.map(a => {
          const n = submittedCount(a)
          const on = a.id === game.id
          return (
            <button key={a.id} onClick={() => setGameId(a.id)}
              className="px-3.5 py-2 rounded-xl font-black text-sm transition-all hover:scale-[1.03] flex items-center gap-2"
              style={on
                ? { background: a.color, color: '#000' }
                : { background: `${a.color}18`, color: a.color, border: `1.5px solid ${a.color}55` }}>
              <span>{a.emoji} {a.act}</span>
              <span className="rounded-full px-1.5 text-[11px] font-black"
                style={on
                  ? { background: 'rgba(0,0,0,0.22)' }
                  : { background: 'rgba(255,255,255,0.1)', color: n === teams.length && n > 0 ? '#34d399' : undefined }}>
                {n}/{teams.length}
              </span>
            </button>
          )
        })}
      </div>

      <GamePanel game={game} teams={teams} progress={progress} />
    </div>
  )
}

function GamePanel({ game, teams, progress }: { game: AitbActivity; teams: AitbTeam[]; progress: AitbProgress[] }) {
  const labels = aitbResultLabels(game) ?? []
  const slots = game.module ? AITB_MODULE_SLOTS[game.module] : null

  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: `${game.color}12`, border: `1.5px solid ${game.color}44` }}>
        <div className="font-black" style={{ color: game.color }}>{game.emoji} {game.act} — {game.name}</div>
        <div className="text-gray-400 text-sm">{game.tagline}</div>
      </div>

      {teams.length === 0 && <div className="text-gray-500 text-sm">No teams yet — add teams above.</div>}

      <div className="grid lg:grid-cols-2 gap-3">
        {teams.map(t => {
          const p = progress.find(x => x.team_id === t.id && x.activity_id === game.id)
          const words = p?.words ?? []
          const has = words.filter(Boolean).length > 0
          const status = p?.completed_at ? '✅ done' : p?.scanned_at ? '🕐 playing' : '⚪ not started'
          return (
            <div key={t.id} className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${has ? `${t.color}88` : 'rgba(255,255,255,0.1)'}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-black" style={{ color: t.color }}>● {t.name}</span>
                <span className="flex-1" />
                <span className="text-gray-400 text-xs font-bold">{status}</span>
              </div>

              {!has ? (
                <div className="text-gray-600 text-sm font-bold py-2">— nothing submitted yet</div>
              ) : slots ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {words.map((w, i) => {
                      const slot = slots[i]
                      // Skip slots not filled yet (roulette saves one wheel at a
                      // time) — an empty word has no reel image to show.
                      if (!w) return null
                      const art = slot && AITB_REEL_POOLS.includes(slot.pool)
                      return (
                        <div key={i} className="rounded-xl overflow-hidden"
                          style={{ background: 'rgba(0,0,0,0.3)', border: `1.5px solid ${game.color}55`, width: art ? 104 : undefined }}>
                          {art && (
                            <img src={aitbReelImage(slot.pool, w)} alt="" loading="lazy"
                              style={{ width: 104, height: 78, objectFit: 'cover', display: 'block' }} />
                          )}
                          <div className="px-2 py-1.5">
                            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: game.color }}>
                              {labels[i] ?? `#${i + 1}`}
                            </div>
                            <div className="text-xs font-bold text-white leading-tight">{w}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Roulette → the exact song brief the team is working from */}
                  {game.module === 'roulette' && words[0] && words[1] && (
                    <div className="mt-2 text-sm font-bold" style={{ color: game.color }}>
                      🎤 “Create a song about {words[1]} in a {words[0]} Style”
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {words.map((w, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${game.color}22`, color: game.color, border: `1px solid ${game.color}55` }}>
                      {labels[i] ? `${labels[i]}: ${w}` : w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
