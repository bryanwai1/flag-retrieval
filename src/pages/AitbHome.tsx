/**
 * AITB — self-serve team HOME board (rocket → planet), WIRED TO SUPABASE
 * ---------------------------------------------------------------------
 * Team scans the projector QR, picks a team once (localStorage['aitb_my_team']),
 * lands here instead of queuing at the marshal.
 *   • Rocket flies toward the planet as the team completes missions (all 10 = arrived).
 *   • "DRAW MISSION CARDS" flips up 3 random not-yet-started activities.
 *   • Start = real check-in (aitb_progress upsert, +100). Max 2 in progress at once.
 *   • "Open steps →" jumps to the full mission page (/aitb/m/:id) for step-ticking.
 *   • Complete = marshal password (aitb_settings.admin_password) → +300 + speed bonus.
 *   • Cancel = removes the in-progress row, freeing the slot.
 * All state lives in Supabase aitb_progress and syncs across the team's phones (realtime).
 *
 * NOTE on progress: real activities have no Easy/Normal/Hard — they score by time +
 * speed bonuses (up to 1900 each). So the rocket advances by COMPLETED COUNT (all 10 =
 * arrival) and the header shows the team's live POINTS score. Easy to switch to
 * points-weighted if preferred.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AITB_ACTIVITIES, aitbActivity, AITB_COMPLETE, aitbSpeedBonus, aitbProgressPoints, aitbMaxPoints, type AitbActivity } from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import { useAitbRealtime } from '../hooks/useAitbRealtime'
import type { AitbTeam, AitbProgress } from '../types/database'

const MAX_ACTIVE = 2
const TEAM_KEY = 'aitb_my_team'
const TOTAL = AITB_ACTIVITIES.length
// Watch every team's progress so the live rank chip updates when rivals score.
const HOME_SUBS = [{ table: 'aitb_progress' }, { table: 'aitb_teams' }]

function randInt(n: number) { return Math.floor(Math.random() * n) }
function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
// Colour for each hand-set difficulty tier; the label lives on the activity itself.
const DIFF_COLORS: Record<AitbActivity['difficulty'], string> = {
  Easy: '#34d399', Normal: '#38bdf8', Hard: '#e879f9',
}
function difficultyOf(a: AitbActivity): { label: string; color: string } {
  return { label: a.difficulty, color: DIFF_COLORS[a.difficulty] }
}

export function AitbHome() {
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [teamId, setTeamId] = useState<string | null>(() =>
    (typeof localStorage !== 'undefined' ? localStorage.getItem(TEAM_KEY) : null))
  const [rows, setRows] = useState<AitbProgress[]>([])
  const [allRows, setAllRows] = useState<AitbProgress[]>([])  // every team's progress → for the live rank chip
  const [loading, setLoading] = useState(true)

  const [draw, setDraw] = useState<number[] | null>(null)
  const [completing, setCompleting] = useState<number | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [gain, setGain] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)
  const [openOrb, setOpenOrb] = useState<number | null>(null)  // tapped trail orb → detail popover
  const busyRef = useRef(false)
  const congratsRef = useRef(false)
  // Rocket-lane geometry, measured live so the rocket's NOSE (not its bottom edge)
  // travels from the floor to just under the planet regardless of scene height.
  const sceneRef = useRef<HTMLElement>(null)
  const planetRef = useRef<HTMLDivElement>(null)
  const rocketRef = useRef<HTMLDivElement>(null)
  const [lane, setLane] = useState<{ noseStart: number; noseEnd: number; wrapH: number; planetBottom: number } | null>(null)

  // Whole-game countdown (aitb_settings.game_ends_at). When time's up, the board
  // locks like the mission page does — no drawing, starting or completing.
  const { endsAt: gameEndsAt, remainingMs: gameRemainingMs, timeUp } = useAitbGameTimer()

  const teamName = teams.find(t => t.id === teamId)?.name ?? 'Your Team'

  // ── Load teams + this team's progress ──────────────────────────────────────
  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const [teamRes, progRes] = await Promise.all([
      supabase.from('aitb_teams').select('*').order('sort_order').order('created_at'),
      supabase.from('aitb_progress').select('*'),
    ])
    setTeams(teamRes.data ?? [])
    const all = progRes.data ?? []
    setAllRows(all)
    const tid = localStorage.getItem(TEAM_KEY)
    setRows(tid ? all.filter(r => r.team_id === tid) : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Realtime (multi-device) + self-heal on reconnect / refocus / poll ───────
  useAitbRealtime('aitb-home', HOME_SUBS, load)

  // ── Live clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const rowFor = useCallback((aid: number) => rows.find(r => r.activity_id === aid), [rows])
  const activeRows = useMemo(() => rows.filter(r => r.scanned_at && !r.completed_at), [rows])
  const completedRows = useMemo(() => rows.filter(r => r.completed_at), [rows])
  // One orb per finished mission (in completion order) — the rocket's trail.
  // Carries enough to show what was completed when an orb is tapped.
  const completedMissions = useMemo(() =>
    [...completedRows]
      .sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''))
      .map(r => {
        const a = aitbActivity(r.activity_id)
        return { id: r.activity_id, color: a?.color || '#8b5cf6', emoji: a?.emoji || '⭐', name: a?.name || 'Mission', pts: aitbProgressPoints(r, a) }
      }),
    [completedRows])
  // This team's manual bonus/penalty — included so the board total matches the
  // projector (which always adds `adjust`).
  const myAdjust = useMemo(() => teams.find(t => t.id === teamId)?.adjust ?? 0, [teams, teamId])
  const points = useMemo(
    () => rows.reduce((s, r) => s + aitbProgressPoints(r, aitbActivity(r.activity_id)), 0) + myAdjust,
    [rows, myAdjust])
  // Live standings across all teams → this team's rank chip.
  const standings = useMemo(() =>
    teams.map(t => {
      const tr = allRows.filter(r => r.team_id === t.id)
      return {
        id: t.id,
        total: tr.reduce((s, r) => s + aitbProgressPoints(r, aitbActivity(r.activity_id)), 0) + (t.adjust || 0),
        completed: tr.filter(r => r.completed_at).length,
      }
    }).sort((a, b) => b.total - a.total || b.completed - a.completed),
    [teams, allRows])
  const myRank = useMemo(() => {
    const i = standings.findIndex(s => s.id === teamId)
    return i < 0 ? null : i + 1
  }, [standings, teamId])
  const completedCount = completedRows.length
  const progress = Math.min(1, completedCount / TOTAL)
  const arrived = completedCount >= TOTAL
  // Rocket nose position (px from scene bottom), then convert to the wrap's `bottom`.
  // Falls back to the old %-based value until the first measurement lands.
  const noseTarget = lane
    ? (arrived ? lane.noseEnd + 20 : lane.noseStart + progress * (lane.noseEnd - lane.noseStart))
    : null
  const rocketBottomStyle = lane && noseTarget != null
    ? `${noseTarget - lane.wrapH}px`
    : `${arrived ? 66 : 7 + progress * 57}%`
  const pct = Math.round(progress * 100)
  const canDraw = activeRows.length < MAX_ACTIVE && !draw && rows.length < TOTAL && !timeUp

  // Rocket exhaust trail: one orb per completed mission streaming down behind the
  // rocket (newest nearest, fading older). Positions shared by the orbs + popover.
  const TRAIL_FLOOR = 12
  const trailTop = lane && noseTarget != null
    ? Math.max(TRAIL_FLOOR + 10, noseTarget - lane.wrapH - 4)  // just below the flame
    : 0
  const trail = lane
    ? completedMissions.map((m, i) => {
        const n = completedMissions.length
        const f = n <= 1 ? 1 : i / (n - 1)          // 0 = oldest (near floor), 1 = newest (near rocket)
        return { ...m, bottomPx: TRAIL_FLOOR + f * (trailTop - TRAIL_FLOOR), opacity: 0.4 + 0.6 * f }
      })
    : []

  // Auto-pop the congrats screen the moment all missions are done.
  useEffect(() => {
    if (arrived && !congratsRef.current) { congratsRef.current = true; setShowCongrats(true) }
    if (!arrived) congratsRef.current = false
  }, [arrived])

  // Measure the rocket lane from real element sizes; re-measure whenever the scene
  // resizes (viewport change, or active cards pushing the scene shorter/taller).
  useLayoutEffect(() => {
    const measure = () => {
      const scene = sceneRef.current, planet = planetRef.current, rocket = rocketRef.current
      if (!scene || !planet || !rocket) return
      const H = scene.clientHeight
      const wrapH = rocket.offsetHeight
      const planetBottom = planet.offsetTop + planet.offsetHeight  // px from scene top
      const FLOOR = 8   // rocket rests this far above the scene floor at 0 progress
      const GAP = 12    // nose stops this far under the planet at full progress
      const noseStart = wrapH + FLOOR
      const noseEnd = Math.max(noseStart + 24, H - planetBottom - GAP)
      setLane(prev => (prev && prev.noseStart === noseStart && prev.noseEnd === noseEnd && prev.wrapH === wrapH && prev.planetBottom === planetBottom)
        ? prev : { noseStart, noseEnd, wrapH, planetBottom })
    }
    measure()
    const scene = sceneRef.current
    if (!scene || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(scene)
    return () => ro.disconnect()
    // Re-run once the board actually mounts (the loading / no-team early returns
    // mean `.rd-scene` — and the refs — don't exist on the first mount).
  }, [loading, teamId])

  // ── Decorative starfield ───────────────────────────────────────────────────
  const stars = useMemo(
    () => Array.from({ length: 42 }, () => ({
      left: Math.random() * 100, top: Math.random() * 100,
      size: 1 + Math.random() * 2.2, delay: Math.random() * 4, dur: 2.5 + Math.random() * 3,
    })), [])

  // ── Actions ────────────────────────────────────────────────────────────────
  const pickTeam = (id: string) => { localStorage.setItem(TEAM_KEY, id); setTeamId(id); setLoading(true); load() }

  const drawCards = useCallback(() => {
    if (activeRows.length >= MAX_ACTIVE || draw || timeUp) return
    const started = new Set(rows.map(r => r.activity_id))          // any activity with a row (active or done)
    const pool = AITB_ACTIVITIES.filter(a => !started.has(a.id)).map(a => a.id)
    for (let i = pool.length - 1; i > 0; i--) { const j = randInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]] }
    setDraw(pool.slice(0, 3))
  }, [activeRows, draw, rows, timeUp])

  const startMission = useCallback(async (aid: number) => {
    if (!teamId || busyRef.current || activeRows.length >= MAX_ACTIVE || timeUp) return
    busyRef.current = true; setBusy(true)
    // Re-check the slot cap against fresh DB state — another phone on this team
    // may have started a mission since our last sync (the 2-slot cap is otherwise
    // only enforced in local React state, so two phones could both slip past it).
    const { data: fresh } = await supabase.from('aitb_progress')
      .select('scanned_at,completed_at').eq('team_id', teamId)
    const activeNow = (fresh ?? []).filter(r => r.scanned_at && !r.completed_at).length
    if (activeNow >= MAX_ACTIVE) {
      busyRef.current = false; setBusy(false)
      setDraw(null)
      await load()
      return
    }
    await supabase.from('aitb_progress').upsert(
      { team_id: teamId, activity_id: aid, scanned_at: new Date().toISOString() },
      { onConflict: 'team_id,activity_id', ignoreDuplicates: true },
    )
    await load()
    busyRef.current = false; setBusy(false)
    setDraw(prev => {
      if (!prev) return prev
      const remaining = prev.filter(id => id !== aid)
      // close once both slots would be full
      return activeRows.length + 1 >= MAX_ACTIVE ? null : remaining
    })
  }, [teamId, activeRows, load, timeUp])

  const cancelMission = useCallback(async (aid: number) => {
    const row = rowFor(aid)
    if (!row || busyRef.current) return
    busyRef.current = true; setBusy(true)
    await supabase.from('aitb_progress').delete().eq('id', row.id)
    await load()
    busyRef.current = false; setBusy(false)
  }, [rowFor, load])

  const confirmComplete = useCallback(async () => {
    if (completing == null || busyRef.current || timeUp) return
    const row = rowFor(completing)
    const act = aitbActivity(completing)
    if (!row || !act) { setCompleting(null); return }
    busyRef.current = true; setBusy(true)
    const { data: settings } = await supabase.from('aitb_settings').select('admin_password').eq('id', 1).maybeSingle()
    if (!settings || pwd.trim() !== settings.admin_password) {
      setPwdErr('Wrong code — ask your marshal to confirm.')
      busyRef.current = false; setBusy(false)
      return
    }
    const elapsed = row.scanned_at ? Date.now() - new Date(row.scanned_at).getTime() : 0
    const bonus = aitbSpeedBonus(elapsed, act)
    await supabase.from('aitb_progress').update({ completed_at: new Date().toISOString(), bonus }).eq('id', row.id)
    await load()
    busyRef.current = false; setBusy(false)
    setCompleting(null); setPwd(''); setPwdErr('')
    setGain(AITB_COMPLETE[act.difficulty] + bonus)
    setCelebrate(true)
    setTimeout(() => setGain(null), 1600)
    setTimeout(() => setCelebrate(false), 2600)
  }, [completing, pwd, rowFor, load, timeUp])

  // ══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return <div className="rd-root"><style>{CSS}</style><div className="rd-bg" /><div className="rd-bg-tint" />
      <div className="rd-center">Loading mission control…</div></div>
  }

  // No team chosen yet → lightweight self-serve team picker.
  if (!teamId) {
    return (
      <div className="rd-root"><style>{CSS}</style><div className="rd-bg" /><div className="rd-bg-tint" />
        <div className="rd-frame rd-pick">
          <div className="rd-kicker">MISSION CONTROL</div>
          <h1 className="rd-team">Pick your team</h1>
          {teams.length === 0
            ? <p className="rd-muted">No teams yet — ask the game master to add teams in the Admin panel.</p>
            : <div className="rd-teamgrid">
                {teams.map(t => (
                  <button key={t.id} className="rd-teambtn" style={{ borderColor: t.color }} onClick={() => pickTeam(t.id)}>
                    <span className="rd-teamdot" style={{ background: t.color }} />{t.name}
                  </button>
                ))}
              </div>}
        </div>
      </div>
    )
  }

  return (
    <div className="rd-root">
      <style>{CSS}</style>
      <div className="rd-bg" />
      <div className="rd-bg-tint" />
      {stars.map((s, i) => (
        <span key={i} className="rd-star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
      ))}

      <div className="rd-frame">
        <header className="rd-head">
          <div>
            <div className="rd-kicker">MISSION CONTROL</div>
            <h1 className="rd-team">{teamName}</h1>
          </div>
          <button className="rd-menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">⋯</button>
          {menuOpen && (
            <div className="rd-menu">
              <button onClick={() => { localStorage.removeItem(TEAM_KEY); setTeamId(null); setMenuOpen(false) }}>Switch team</button>
              <button onClick={() => setMenuOpen(false)}>Close</button>
            </div>
          )}
        </header>

        {myRank && teams.length > 1 && (() => {
          const emoji = ['🥇', '🥈', '🥉'][myRank - 1] ?? '🏆'
          const c = myRank === 1 ? '#fbbf24' : myRank === 2 ? '#cbd5e1' : myRank === 3 ? '#f59e0b' : '#a48bff'
          return (
            <div style={{
              alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 999, fontWeight: 800, fontSize: 14, color: c,
              background: 'rgba(17,12,34,0.7)', border: `1.5px solid ${c}66`,
            }}>
              {emoji} Rank #{myRank} <span style={{ opacity: 0.55, fontWeight: 700 }}>of {teams.length}</span>
            </div>
          )
        })()}

        {gameEndsAt && !timeUp && (() => {
          const c = gameRemainingMs! < 5 * 60_000 ? '#f87171' : '#fbbf24'
          return (
            <div style={{
              alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 999, fontWeight: 800, fontSize: 14,
              fontVariantNumeric: 'tabular-nums', color: c,
              background: 'rgba(17,12,34,0.7)', border: `1.5px solid ${c}66`,
            }}>
              ⏳ {fmtCountdown(gameRemainingMs!)} left
            </div>
          )
        })()}

        <div className="rd-progress">
          <div className="rd-progress-fill" style={{ width: `${pct}%` }} />
          <div className="rd-progress-label">
            <span>{arrived ? 'Arrived! 🎉' : `${completedCount} / ${TOTAL} missions`}</span>
            <span>{points.toLocaleString()} pts</span>
          </div>
        </div>

        <section className="rd-scene" ref={sceneRef}>
          <div className="rd-planet-wrap" ref={planetRef}>
            <div className="rd-planet-glow" />
            <img src="/rocket-dash/planet.png" alt="Destination planet" className="rd-planet" />
            {arrived && <div className="rd-arrived">ARRIVED! 🎉</div>}
          </div>

          {/* Remaining path: a dashed line from the rocket up to the planet, shrinking
              as the team progresses. Falls back to a full-height rail before measuring. */}
          <div
            className="rd-track"
            style={lane && noseTarget != null
              ? { top: `${lane.planetBottom - 4}px`, bottom: `${noseTarget}px` }
              : undefined}
          />

          {/* Completed missions: a soft trail of card-coloured orbs streaming down
              behind the rocket, fading with age. Tap one to see which mission it was. */}
          {trail.map((m, i) => (
            <button
              key={i}
              type="button"
              className={`rd-orb ${openOrb === i ? 'open' : ''}`}
              onClick={e => { e.stopPropagation(); setOpenOrb(openOrb === i ? null : i) }}
              style={{ bottom: `${m.bottomPx}px`, background: m.color, opacity: m.opacity, boxShadow: `0 0 6px 1px ${m.color}88` }}
              aria-label={`Completed mission: ${m.name}`}
            />
          ))}

          {/* Tap-anywhere backdrop that dismisses the popover (only present while open). */}
          {openOrb != null && <div className="rd-orb-backdrop" onClick={() => setOpenOrb(null)} />}

          {/* Detail popover for a tapped trail orb — centred above it so it never
              runs off the scene edge. */}
          {openOrb != null && trail[openOrb] && (
            <div className="rd-orb-pop" style={{ bottom: `${trail[openOrb].bottomPx + 16}px` }} onClick={e => e.stopPropagation()}>
              <span className="rd-orb-pop-emoji">{trail[openOrb].emoji}</span>
              <span className="rd-orb-pop-body">
                <span className="rd-orb-pop-name">{trail[openOrb].name}</span>
                <span className="rd-orb-pop-pts">+{trail[openOrb].pts.toLocaleString()} pts</span>
              </span>
            </div>
          )}

          <div className={`rd-rocket-wrap ${arrived ? 'landed' : ''}`} ref={rocketRef} style={{ bottom: rocketBottomStyle }}>
            {!arrived && <div className="rd-flame" />}
            <img src="/rocket-dash/rocket.png" alt="Your rocket" className={`rd-rocket ${celebrate ? 'boost' : ''}`} />
            {gain !== null && <div className="rd-gain">+{gain}</div>}
          </div>

          {celebrate && (
            <div className="rd-confetti">
              {Array.from({ length: 18 }, (_, i) => (
                <span key={i} style={{ left: `${8 + (i * 5) % 84}%`, animationDelay: `${(i % 6) * 0.08}s`, background: ['#f0abfc', '#7dd3fc', '#6ee7b7', '#fde68a'][i % 4] }} />
              ))}
            </div>
          )}
        </section>

        <section className="rd-panel">
          <div className="rd-panel-title">
            <span>On-going Missions</span>
            <span className="rd-slots">{activeRows.length} / {MAX_ACTIVE}</span>
          </div>

          <div className="rd-slots-grid">
            {Array.from({ length: Math.max(MAX_ACTIVE, activeRows.length) }).map((_, i) => {
              const row = activeRows[i]
              if (!row) {
                return (
                  <button key={i} className="rd-slot rd-slot-empty" onClick={drawCards} disabled={!canDraw}>
                    <span className="rd-slot-plus">＋</span>
                    <span>Draw a mission</span>
                  </button>
                )
              }
              const act = aitbActivity(row.activity_id)!
              const nowPts = aitbProgressPoints(row, act)
              const liveBonus = row.scanned_at ? aitbSpeedBonus(now - new Date(row.scanned_at).getTime(), act) : 0
              return (
                <div key={row.id} className="rd-slot rd-slot-filled" style={{ borderColor: act.color }}>
                  <div className="rd-slot-top">
                    <span className="rd-slot-icon">{act.emoji}</span>
                    <button className="rd-x" onClick={() => cancelMission(row.activity_id)} aria-label="Cancel" disabled={busy}>✕</button>
                  </div>
                  <div className="rd-slot-name">{act.name}</div>
                  <div className="rd-slot-meta">⏱ {fmtElapsed(now - new Date(row.scanned_at!).getTime())} · {nowPts} pts{liveBonus ? ` · ⚡${liveBonus}` : ''}</div>
                  <div className="rd-slot-actions">
                    <a className="rd-btn rd-btn-open" href={`/aitb/m/${act.id}`}>Steps →</a>
                    <button className="rd-btn rd-btn-done" onClick={() => { setCompleting(act.id); setPwd(''); setPwdErr('') }} disabled={busy}>Complete</button>
                  </div>
                </div>
              )
            })}
          </div>

          <button className={`rd-draw-btn ${activeRows.length === 0 && !draw ? 'pulse' : ''}`} onClick={drawCards} disabled={!canDraw}>
            {activeRows.length >= MAX_ACTIVE ? 'Both slots full — cancel one to draw'
              : (rows.length >= TOTAL ? 'All missions started 🚀' : '🎴 DRAW MISSION CARDS')}
          </button>
        </section>
      </div>

      {/* Draw overlay */}
      {draw && (
        <div className="rd-overlay" onClick={() => setDraw(null)}>
          <div className="rd-sheet" onClick={e => e.stopPropagation()}>
            <div className="rd-sheet-head">
              <h2>Pick your mission{MAX_ACTIVE - activeRows.length > 1 ? 's' : ''}</h2>
              <p>You can hold {MAX_ACTIVE - activeRows.length} more. Don&apos;t like these? Discard and draw again.</p>
            </div>
            {draw.length === 0
              ? <p className="rd-muted" style={{ padding: '10px 2px 16px' }}>No fresh missions left to draw.</p>
              : <div className="rd-cards">
                  {draw.map((aid, i) => {
                    const act = aitbActivity(aid)!
                    const diff = difficultyOf(act)
                    return (
                      <div key={aid} className="rd-card" style={{ animationDelay: `${i * 0.09}s` }}>
                        <div className="rd-card-hero" style={{ backgroundImage: `url(${act.hero})` }}>
                          <span className="rd-card-diff" style={{ background: diff.color }}>{diff.label}</span>
                        </div>
                        <div className="rd-card-title">{act.emoji} {act.name}</div>
                        <div className="rd-card-pts">⏱ {act.mins}m · up to {aitbMaxPoints(act).toLocaleString()} pts</div>
                        <button className="rd-card-start" style={{ background: act.color }} onClick={() => startMission(aid)} disabled={busy || activeRows.length >= MAX_ACTIVE}>
                          Start Mission
                        </button>
                      </div>
                    )
                  })}
                </div>}
            <div className="rd-sheet-foot">
              <button className="rd-ghost" onClick={() => setDraw(null)}>Done</button>
              <button className="rd-ghost" onClick={() => { setDraw(null); setTimeout(drawCards, 60) }} disabled={activeRows.length >= MAX_ACTIVE}>↻ Discard &amp; redraw</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete (marshal password) */}
      {completing != null && (
        <div className="rd-overlay" onClick={() => setCompleting(null)}>
          <div className="rd-modal" onClick={e => e.stopPropagation()}>
            <div className="rd-modal-icon">{aitbActivity(completing)?.emoji}</div>
            <h2>Marshal confirmation</h2>
            <p>Show this to your marshal. They enter the code to lock in <b>{aitbActivity(completing)?.name}</b>.</p>
            <input
              className="rd-input" placeholder="Marshal code" value={pwd}
              onChange={e => { setPwd(e.target.value); setPwdErr('') }}
              onKeyDown={e => { if (e.key === 'Enter') confirmComplete() }}
              autoFocus
            />
            {pwdErr && <div className="rd-err">{pwdErr}</div>}
            <div className="rd-modal-actions">
              <button className="rd-ghost" onClick={() => setCompleting(null)}>Cancel</button>
              <button className="rd-btn rd-btn-done rd-wide" onClick={confirmComplete} disabled={busy}>Confirm complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Congrats — auto-pops when all missions are complete */}
      {showCongrats && (
        <div className="rd-overlay rd-congrats-ov" onClick={() => setShowCongrats(false)}>
          <div className="rd-congrats" onClick={e => e.stopPropagation()}>
            <video className="rd-congrats-vid" src="/rocket-dash/landing.mp4" poster="/rocket-dash/planet.png" autoPlay loop muted playsInline />
            <div className="rd-congrats-body">
              <div className="rd-congrats-kicker">MISSION COMPLETE</div>
              <h2>{teamName} has landed! 🎉</h2>
              <div className="rd-congrats-score">{points.toLocaleString()}<span> pts</span></div>
              <p>All {TOTAL} missions complete. Incredible flying, team.</p>
              <button className="rd-btn rd-btn-done rd-wide" onClick={() => setShowCongrats(false)}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Whole-game TIME'S UP lockout — covers the board, no more playing */}
      {timeUp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 70, padding: 24,
          background: 'rgba(10,7,20,0.95)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 78, marginBottom: 14 }} className="rd-timeup-emoji">⏰</div>
            <div style={{ fontWeight: 900, fontSize: 42, color: '#f87171', marginBottom: 10 }}>TIME&apos;S UP!</div>
            <div style={{ color: '#d6d0f5', fontWeight: 700, fontSize: 17, lineHeight: 1.5 }}>
              The game has ended.<br />Head back to the main hall! 🏁
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.rd-root{position:relative;min-height:100dvh;width:100%;overflow:hidden;color:#f4f2ff;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0a0714;-webkit-tap-highlight-color:transparent;}
.rd-center{position:relative;z-index:3;min-height:100dvh;display:flex;align-items:center;justify-content:center;color:#b9aef0;font-weight:600;}
.rd-bg{position:fixed;inset:0;background:url('/rocket-dash/space-bg.png') center/cover no-repeat;animation:rd-drift 40s ease-in-out infinite alternate;z-index:0;}
.rd-bg-tint{position:fixed;inset:0;z-index:0;background:
  radial-gradient(120% 60% at 50% 0%,rgba(120,60,200,.18),transparent 60%),
  linear-gradient(180deg,transparent 40%,rgba(6,4,14,.55) 100%);}
@keyframes rd-drift{from{transform:scale(1.06) translateY(0)}to{transform:scale(1.12) translateY(-14px)}}
.rd-star{position:fixed;border-radius:50%;background:#fff;z-index:1;box-shadow:0 0 6px #fff;animation:rd-tw 3s ease-in-out infinite;opacity:.5;}
@keyframes rd-tw{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
.rd-timeup-emoji{animation:rd-tu-bounce 1s ease-in-out infinite;}
@keyframes rd-tu-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}

.rd-frame{position:relative;z-index:3;max-width:480px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;padding:16px 16px 22px;gap:14px;}
.rd-pick{justify-content:center;gap:16px;text-align:center;}
.rd-muted{color:#b9aef0;font-size:14px;line-height:1.5;}
.rd-teamgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rd-teambtn{display:flex;align-items:center;gap:8px;justify-content:center;padding:14px 10px;border-radius:14px;border:1.5px solid;
  background:rgba(255,255,255,.06);color:#fff;font-weight:700;font-size:14px;cursor:pointer;}
.rd-teamdot{width:12px;height:12px;border-radius:50%;}

.rd-head{display:flex;align-items:flex-start;justify-content:space-between;position:relative;}
.rd-kicker{font-size:11px;letter-spacing:.22em;color:#a48bff;font-weight:700;}
.rd-team{font-size:26px;font-weight:800;line-height:1.1;margin-top:2px;text-shadow:0 2px 18px rgba(120,80,220,.5);}
.rd-menu-btn{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:20px;line-height:1;cursor:pointer;}
.rd-menu{position:absolute;right:0;top:44px;z-index:20;background:#171233;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:6px;display:flex;flex-direction:column;min-width:150px;box-shadow:0 12px 40px rgba(0,0,0,.5);}
.rd-menu button{background:none;border:none;color:#e9e6ff;text-align:left;padding:9px 10px;border-radius:8px;font-size:14px;cursor:pointer;}
.rd-menu button:hover{background:rgba(255,255,255,.08);}

.rd-progress{position:relative;height:34px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);overflow:hidden;}
.rd-progress-fill{position:absolute;inset:0 auto 0 0;border-radius:12px;background:linear-gradient(90deg,#7c3aed,#c026d3 55%,#38bdf8);transition:width 1.1s cubic-bezier(.22,1,.36,1);box-shadow:0 0 22px rgba(168,85,247,.6);}
.rd-progress-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:11.5px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.6);}

.rd-scene{position:relative;flex:1;min-height:360px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:radial-gradient(120% 80% at 50% 12%,rgba(80,40,150,.25),transparent 55%);}
.rd-planet-wrap{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:120px;height:120px;display:flex;align-items:center;justify-content:center;animation:rd-float 7s ease-in-out infinite;}
.rd-planet{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 26px rgba(120,220,255,.35));}
.rd-planet-glow{position:absolute;width:150%;height:150%;border-radius:50%;background:radial-gradient(circle,rgba(140,120,255,.35),transparent 62%);animation:rd-pulse 4s ease-in-out infinite;}
@keyframes rd-float{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(10px)}}
@keyframes rd-pulse{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:.85;transform:scale(1.08)}}
.rd-arrived{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-weight:800;font-size:13px;color:#fff;background:linear-gradient(135deg,#f0abfc,#7dd3fc);padding:4px 12px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.4);}

.rd-track{position:absolute;left:50%;transform:translateX(-50%);bottom:0;top:150px;width:3px;background:repeating-linear-gradient(180deg,rgba(255,255,255,.35) 0 6px,transparent 6px 16px);opacity:.5;}
.rd-orb{position:absolute;left:50%;transform:translateX(-50%);width:10px;height:10px;padding:0;border-radius:50%;border:none;cursor:pointer;z-index:1;
  -webkit-tap-highlight-color:transparent;transition:bottom 1.1s cubic-bezier(.22,1,.36,1),transform .18s ease,opacity .6s ease;animation:rd-orbpop .5s ease both;}
.rd-orb::after{content:"";position:absolute;inset:-3px;border-radius:50%;}/* modest tap target, avoids overlapping neighbours */
.rd-orb:hover{transform:translateX(-50%) scale(1.28);}
.rd-orb.open{transform:translateX(-50%) scale(1.5);opacity:1 !important;outline:1.5px solid rgba(255,255,255,.85);outline-offset:2px;}
@keyframes rd-orbpop{from{opacity:0;}to{}}
.rd-orb-backdrop{position:absolute;inset:0;z-index:4;background:transparent;cursor:default;}
.rd-orb-pop{position:absolute;left:50%;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:8px;
  padding:6px 11px 6px 8px;border-radius:12px;background:rgba(20,14,40,.96);border:1px solid rgba(255,255,255,.16);
  box-shadow:0 8px 24px rgba(0,0,0,.5);white-space:nowrap;animation:rd-orbpop .2s ease both;pointer-events:auto;}
.rd-orb-pop::before{content:"";position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(20,14,40,.96);}
.rd-orb-pop-emoji{font-size:19px;line-height:1;}
.rd-orb-pop-body{display:flex;flex-direction:column;gap:1px;}
.rd-orb-pop-name{font-size:12.5px;font-weight:700;color:#fff;}
.rd-orb-pop-pts{font-size:10.5px;font-weight:600;color:#a5f3c4;}

.rd-rocket-wrap{position:absolute;left:50%;transform:translateX(-50%);width:60px;height:90px;transition:bottom 1.1s cubic-bezier(.22,1,.36,1);z-index:2;animation:rd-bob 3.2s ease-in-out infinite;}
@keyframes rd-bob{0%,100%{margin-top:0}50%{margin-top:-9px}}
.rd-rocket{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5));}
.rd-rocket.boost{animation:rd-boost .6s ease-out;}
@keyframes rd-boost{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-10px) scale(1.06)}100%{transform:translateY(0) scale(1)}}
.rd-flame{position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);width:24px;height:38px;border-radius:50%;background:radial-gradient(circle at 50% 30%,rgba(255,240,150,.95),rgba(255,140,40,.6) 45%,transparent 70%);filter:blur(3px);animation:rd-flick .18s ease-in-out infinite alternate;z-index:1;}
@keyframes rd-flick{from{transform:translateX(-50%) scaleY(.85) scaleX(.9);opacity:.8}to{transform:translateX(-50%) scaleY(1.15) scaleX(1.05);opacity:1}}
.rd-gain{position:absolute;left:50%;top:-14px;transform:translateX(-50%);font-weight:900;font-size:22px;color:#fde68a;text-shadow:0 2px 10px rgba(0,0,0,.6);white-space:nowrap;pointer-events:none;animation:rd-gain 1.6s cubic-bezier(.22,1,.36,1) forwards;z-index:6;}
@keyframes rd-gain{0%{opacity:0;transform:translateX(-50%) translateY(6px) scale(.7)}25%{opacity:1;transform:translateX(-50%) translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateX(-50%) translateY(-46px) scale(1)}}
.rd-confetti{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden;}
.rd-confetti span{position:absolute;top:-8%;width:8px;height:12px;border-radius:2px;opacity:.9;animation:rd-fall 2.4s linear forwards;}
@keyframes rd-fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(360px) rotate(420deg);opacity:0}}

.rd-panel{background:rgba(18,14,38,.72);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:12px;}
.rd-panel-title{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:15px;}
.rd-slots{font-size:12px;color:#c9c0ff;background:rgba(255,255,255,.08);padding:2px 10px;border-radius:999px;}
.rd-slots-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rd-slot{min-height:120px;border-radius:16px;padding:11px;display:flex;flex-direction:column;text-align:left;}
.rd-slot-empty{align-items:center;justify-content:center;gap:6px;color:#b9aef0;cursor:pointer;border:1.5px dashed rgba(255,255,255,.25);background:rgba(255,255,255,.03);font-size:13px;font-weight:600;}
.rd-slot-empty:disabled{opacity:.4;cursor:not-allowed;}
.rd-slot-plus{font-size:26px;line-height:1;}
.rd-slot-filled{border:1.5px solid;background:rgba(255,255,255,.05);gap:5px;}
.rd-slot-top{display:flex;align-items:center;justify-content:space-between;}
.rd-slot-icon{font-size:24px;}
.rd-x{background:rgba(255,255,255,.1);border:none;color:#e9e6ff;width:22px;height:22px;border-radius:7px;font-size:12px;cursor:pointer;line-height:1;}
.rd-x:disabled{opacity:.4;}
.rd-slot-name{font-weight:700;font-size:13px;line-height:1.15;}
.rd-slot-meta{font-size:10.5px;color:#c9c0ff;margin-top:auto;}
.rd-slot-actions{display:flex;gap:6px;}
.rd-btn{flex:1;border:none;border-radius:9px;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;}
.rd-btn-open{background:rgba(255,255,255,.12);color:#e9e6ff;display:flex;align-items:center;justify-content:center;}
.rd-btn-done{background:linear-gradient(135deg,#34d399,#059669);color:#04120c;}
.rd-btn-done:disabled{opacity:.5;}
.rd-wide{flex:2;}

.rd-draw-btn{border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:800;letter-spacing:.02em;cursor:pointer;color:#fff;background:linear-gradient(135deg,#7c3aed,#c026d3 60%,#db2777);box-shadow:0 10px 30px rgba(168,85,247,.45);transition:transform .12s ease,filter .2s;}
.rd-draw-btn:active{transform:scale(.98);}
.rd-draw-btn:disabled{background:rgba(255,255,255,.1);color:#9b93c4;box-shadow:none;cursor:not-allowed;}
.rd-draw-btn.pulse{animation:rd-btnpulse 1.9s ease-in-out infinite;}
@keyframes rd-btnpulse{0%,100%{box-shadow:0 10px 30px rgba(168,85,247,.45)}50%{box-shadow:0 10px 42px rgba(219,39,119,.75),0 0 0 4px rgba(219,39,119,.18)}}

.rd-overlay{position:fixed;inset:0;z-index:40;background:rgba(6,4,14,.72);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:rd-fade .2s ease;}
@keyframes rd-fade{from{opacity:0}to{opacity:1}}
.rd-sheet{width:100%;max-width:480px;background:linear-gradient(180deg,#1a1440,#120c2a);border-top-left-radius:24px;border-top-right-radius:24px;border:1px solid rgba(255,255,255,.12);border-bottom:none;padding:18px 16px calc(18px + env(safe-area-inset-bottom));animation:rd-up .28s cubic-bezier(.22,1,.36,1);}
@keyframes rd-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
.rd-sheet-head h2{font-size:19px;font-weight:800;}
.rd-sheet-head p{font-size:12.5px;color:#b9aef0;margin-top:3px;}
.rd-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin:14px 0;}
.rd-card{position:relative;border-radius:15px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:5px;min-height:208px;overflow:hidden;transform-origin:top center;animation:rd-flip .5s cubic-bezier(.22,1,.36,1) both;}
@keyframes rd-flip{from{transform:rotateY(85deg);opacity:0}to{transform:rotateY(0);opacity:1}}
.rd-card-hero{position:relative;width:100%;height:84px;background-size:cover;background-position:center;background-color:#241a44;}
.rd-card-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,7,20,0) 45%,rgba(18,12,42,.9));}
.rd-card-diff{position:absolute;top:6px;left:6px;z-index:1;font-size:8.5px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:999px;color:#0a0714;text-transform:uppercase;}
.rd-card-title{font-size:11.5px;font-weight:800;line-height:1.15;padding:0 8px;margin-top:1px;}
.rd-card-pts{font-size:9.5px;font-weight:700;color:#fde68a;padding:0 8px;}
.rd-card-start{margin:auto 8px 8px;border:none;border-radius:10px;padding:8px 0;font-size:11px;font-weight:800;cursor:pointer;color:#0a0714;}
.rd-card-start:disabled{background:rgba(255,255,255,.14)!important;color:#9b93c4;cursor:not-allowed;}
.rd-sheet-foot{display:flex;gap:10px;}
.rd-ghost{flex:1;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#e9e6ff;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;}
.rd-ghost:disabled{opacity:.4;cursor:not-allowed;}

.rd-modal{width:100%;max-width:400px;margin:auto 12px;align-self:center;background:linear-gradient(180deg,#1a1440,#120c2a);border-radius:22px;border:1px solid rgba(255,255,255,.12);padding:22px 18px;text-align:center;animation:rd-pop .26s cubic-bezier(.22,1,.36,1);}
@keyframes rd-pop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
.rd-modal-icon{font-size:44px;}
.rd-modal h2{font-size:19px;font-weight:800;margin-top:6px;}
.rd-modal p{font-size:13px;color:#c4bbf0;margin-top:6px;line-height:1.4;}
.rd-input{width:100%;margin-top:14px;padding:14px;border-radius:12px;text-align:center;font-size:18px;letter-spacing:.12em;font-weight:700;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;}
.rd-input:focus{outline:none;border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,.3);}
.rd-err{color:#fca5a5;font-size:12.5px;margin-top:8px;font-weight:600;}
.rd-modal-actions{display:flex;gap:10px;margin-top:16px;}

.rd-rocket-wrap.landed{animation:none;transition:bottom 1.4s cubic-bezier(.34,1.56,.64,1);}
.rd-rocket-wrap.landed .rd-rocket{animation:rd-land 1s ease-out both;}
@keyframes rd-land{0%{transform:translateY(-20px) scale(.92) rotate(-4deg)}60%{transform:translateY(4px) scale(.8) rotate(1deg)}100%{transform:translateY(0) scale(.8) rotate(0)}}

.rd-congrats-ov{align-items:center;}
.rd-congrats{width:100%;max-width:420px;margin:0 12px;background:linear-gradient(180deg,#1a1440,#120c2a);border-radius:24px;border:1px solid rgba(255,255,255,.14);overflow:hidden;animation:rd-pop .3s cubic-bezier(.22,1,.36,1);box-shadow:0 20px 60px rgba(0,0,0,.6);}
.rd-congrats-vid{width:100%;display:block;background:#0a0714;aspect-ratio:9/16;object-fit:cover;max-height:44vh;}
.rd-congrats-body{padding:18px;text-align:center;}
.rd-congrats-kicker{font-size:11px;letter-spacing:.24em;color:#a48bff;font-weight:800;}
.rd-congrats-body h2{font-size:22px;font-weight:800;margin-top:4px;}
.rd-congrats-score{font-size:44px;font-weight:900;color:#fde68a;line-height:1.05;margin:8px 0 2px;text-shadow:0 2px 16px rgba(253,230,138,.4);}
.rd-congrats-score span{font-size:18px;color:#c4bbf0;font-weight:700;margin-left:4px;}
.rd-congrats-body p{font-size:13px;color:#c4bbf0;margin:6px 0 14px;line-height:1.4;}

@media (min-width:480px){.rd-overlay{align-items:center;}.rd-sheet{border-radius:24px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:0;}}
`
