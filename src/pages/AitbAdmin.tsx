import {
  useCallback, useEffect, useState,
  type CSSProperties, type Dispatch, type PointerEvent, type ReactNode, type SetStateAction,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  AITB_ACTIVITIES, AITB_APPS, AITB_DEFAULTS, aitbProgressPoints, aitbActivity, aitbSpeedBonus,
  aitbAllGames, aitbGameEdit, aitbNewGame, aitbNumbered, setAitbGames, type AitbActivity, type AitbGameEdit,
} from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import { useAitbRealtime } from '../hooks/useAitbRealtime'
import { AitbAppLinks } from '../components/AitbAppLinks'
import { AitbSubmissions } from '../components/AitbSubmissions'
import { AitbLogoUpload } from '../components/AitbLogoUpload'
import type { AitbTeam, AitbProgress, AitbSettings } from '../types/database'

const TEAM_COLORS = ['#fb7185', '#22d3ee', '#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#60a5fa', '#f59e0b']
const ADMIN_SUBS = [{ table: 'aitb_progress' }, { table: 'aitb_teams' }]
const CARD = { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }
const FIELD = 'w-full bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-teal-400/60'
const FIELD_STYLE = { border: '1.5px solid rgba(255,255,255,0.1)' }
// The page reads top to bottom in the order an event runs.
const SECTIONS = [
  { id: 'teams', label: 'Teams', title: '👥 Teams', sub: 'Add who is playing, then show them the QR code to join.' },
  { id: 'live', label: 'Live', title: '🔴 Live', sub: 'Start the timer, then follow scores and what teams submit.' },
  { id: 'games', label: 'Games', title: '🎮 Games', sub: '' },
  { id: 'settings', label: 'Settings', title: '⚙️ Settings & rules', sub: 'Marshal password, client logo, station props and resets.' },
]
type PreviewState = 'start' | 'playing' | 'done'
// A game row mid-drag. Row positions are measured once at pick-up (page
// coordinates), so the rows sliding aside never feed back into the hit test.
type Drag = { from: number; to: number; dy: number; startY: number; tops: number[]; heights: number[]; settling: boolean }
const SETTLE_MS = 200
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

// The whole list is one JSON value on aitb_settings. Phones pick it up on their next load.
// `change` is applied to the latest saved list, not this tab's copy, so two
// admin tabs (or an old one left open) only overwrite each other's edits to the
// same game. ponytail: read-then-write, not atomic; fine for a few admins.
async function saveAitbGames(change: (games: AitbActivity[]) => AitbActivity[]): Promise<boolean> {
  const latest = await supabase.from('aitb_settings').select('activities').eq('id', 1).maybeSingle()
  if (latest.error) return false
  setAitbGames((latest.data?.activities as AitbGameEdit[] | null) ?? null)
  // Renumber before writing: the Demo reads the stored numbers as-is.
  const edits = aitbNumbered(change(aitbAllGames())).map(aitbGameEdit)
  const { error } = await supabase.from('aitb_settings')
    .update({ activities: edits, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return false
  setAitbGames(edits)
  return true
}
const SAVE_FAILED = 'Save failed. Run the AITB games SQL in Supabase first ⚠️'

export function AitbAdmin() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AitbSettings | null>(null)
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [games, setGames] = useState<AitbActivity[]>(() => aitbAllGames())
  const [openId, setOpenId] = useState<number | null>(null)
  const [overlay, setOverlay] = useState<{ kind: 'demo' | 'preview'; id: number } | null>(null)
  const [newTeam, setNewTeam] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [newPw, setNewPw] = useState('')
  const [qrActivity, setQrActivity] = useState<number | null>(null)
  const [showBoardQr, setShowBoardQr] = useState(false)
  const [showObserverQr, setShowObserverQr] = useState(false)
  const [toast, setToast] = useState('')
  const [timerMins, setTimerMins] = useState('90')
  const { endsAt, remainingMs, timeUp } = useAitbGameTimer()

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const [s, t, p] = await Promise.all([
      supabase.from('aitb_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('aitb_teams').select('*').order('sort_order').order('created_at'),
      supabase.from('aitb_progress').select('*'),
    ])
    setSettings(s.data ?? null)
    setTeams(t.data ?? [])
    setProgress(p.data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  useAitbRealtime('aitb-admin', ADMIN_SUBS, load)

  // Coming back from the edit page (/aitb/admin#game-5): reopen that game where you left it.
  useEffect(() => {
    const id = Number(window.location.hash.replace('#game-', ''))
    if (!id) return
    setOpenId(id)
    setTimeout(() => document.getElementById(`game-${id}`)?.scrollIntoView({ block: 'center' }), 0)
  }, [])

  // Demo / preview open over the admin; Esc works like their Back button.
  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOverlay(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Highlight the step on screen in the sticky bar.
  const [active, setActive] = useState(SECTIONS[0].id)
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
    }, { rootMargin: '-30% 0px -65% 0px' })
    for (const s of SECTIONS) { const el = document.getElementById(s.id); if (el) io.observe(el) }
    return () => io.disconnect()
  }, [])

  /* ---------- Games ---------- */

  // Tick = players can play it. Unticked games stay in the list (and keep any points earned).
  const toggleHidden = async (g: AitbActivity) => {
    const ok = await saveAitbGames(gs => gs.map(x => (x.id === g.id ? { ...x, hidden: !g.hidden } : x)))
    setGames(aitbAllGames())
    if (!ok) { say(SAVE_FAILED); return }
    say(g.hidden ? `${g.emoji} ${g.name} is on for players ✅` : `${g.emoji} ${g.name} is off for players`)
  }

  /* ---------- Drag to reorder ---------- */
  // ponytail: no auto-scroll at the screen edge; scroll with the wheel mid-drag if needed.
  const [drag, setDrag] = useState<Drag | null>(null)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const moveGame = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= games.length) return
    const move = <T,>(list: T[], f: number, t: number) => { const n = [...list]; n.splice(t, 0, ...n.splice(f, 1)); return n }
    const movedId = games[from].id, targetId = games[to].id
    setGames(move(games, from, to)) // show it now; the save renumbers
    // By id, against the latest list: "put this game where that one is".
    const ok = await saveAitbGames(gs => {
      const f = gs.findIndex(x => x.id === movedId), t = gs.findIndex(x => x.id === targetId)
      return f < 0 || t < 0 ? gs : move(gs, f, t)
    })
    if (!ok) say(SAVE_FAILED)
    setGames(aitbAllGames())
  }

  const startDrag = (e: PointerEvent<HTMLElement>, from: number) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rows = [...document.querySelectorAll<HTMLElement>('[data-game-row]')]
    setDrag({
      from, to: from, dy: 0, settling: false,
      startY: e.clientY + window.scrollY,
      tops: rows.map(r => r.getBoundingClientRect().top + window.scrollY),
      heights: rows.map(r => r.offsetHeight),
    })
  }

  const moveDrag = (e: PointerEvent<HTMLElement>) => {
    if (!drag || drag.settling) return
    const dy = e.clientY + window.scrollY - drag.startY
    const centre = drag.tops[drag.from] + drag.heights[drag.from] / 2 + dy
    let to = drag.from
    drag.tops.forEach((top, i) => {
      const mid = top + drag.heights[i] / 2
      if (i > drag.from && centre > mid) to = i                    // furthest row passed going down
      if (i < drag.from && centre < mid && to === drag.from) to = i // highest row passed going up
    })
    setDrag({ ...drag, dy, to })
  }

  const endDrag = () => {
    if (!drag || drag.settling) return
    const { from, to, tops, heights } = drag
    // Glide into the exact spot the gap opened up, then commit the new order.
    const dy = to > from ? tops[to] + heights[to] - tops[from] - heights[from] : tops[to] - tops[from]
    setDrag({ ...drag, dy, settling: true })
    setTimeout(() => { setDrag(null); moveGame(from, to) }, reduceMotion ? 0 : SETTLE_MS)
  }

  const rowStyle = (i: number): CSSProperties => {
    if (!drag) return {}
    if (i === drag.from) {
      return {
        position: 'relative', zIndex: 20,
        translate: `0 ${drag.dy}px`,
        scale: drag.settling || reduceMotion ? '1' : '1.03',
        boxShadow: drag.settling ? 'none' : '0 20px 45px rgba(0,0,0,0.55)',
        // Follows the pointer 1:1 while held; only the scale-up and the final settle animate.
        transition: reduceMotion ? 'none'
          : drag.settling ? `translate ${SETTLE_MS}ms ${EASE}, scale ${SETTLE_MS}ms ${EASE}, box-shadow ${SETTLE_MS}ms`
          : 'scale 150ms ease-out, box-shadow 150ms',
      }
    }
    const gap = drag.tops.length > 1 ? drag.tops[1] - drag.tops[0] - drag.heights[0] : 0
    const room = drag.heights[drag.from] + gap
    const shift = drag.from < drag.to && i > drag.from && i <= drag.to ? -room
      : drag.to < drag.from && i >= drag.to && i < drag.from ? room : 0
    return { translate: `0 ${shift}px`, transition: reduceMotion ? 'none' : `translate ${SETTLE_MS}ms ${EASE}` }
  }

  const addGame = async () => {
    let id = 0
    const ok = await saveAitbGames(gs => {
      id = Math.max(0, ...gs.map(g => g.id)) + 1
      return [...gs, aitbNewGame(id)]
    })
    if (!ok) { say(SAVE_FAILED); return }
    navigate(`/aitb/admin/game/${id}`)
  }

  /* ---------- Teams ---------- */

  const addTeam = async () => {
    const name = newTeam.trim()
    if (!name) return
    await supabase.from('aitb_teams').insert({
      name,
      color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
      sort_order: teams.length,
    })
    setNewTeam('')
  }

  // Split on newlines OR commas so a pasted list or a single line both work.
  const parseBulk = (raw: string) => raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean)

  const bulkAddTeams = async () => {
    const requested = parseBulk(bulkText)
    if (requested.length === 0) { say('Paste some team names first 🤔'); return }
    // Skip names that already exist (case-insensitive) and dups within the paste.
    const seen = new Set(teams.map(t => t.name.toLowerCase()))
    const names: string[] = []
    for (const n of requested) {
      const k = n.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      names.push(n)
    }
    if (names.length === 0) { say('Those teams already exist 🤔'); return }
    const rows = names.map((name, i) => ({
      name,
      color: TEAM_COLORS[(teams.length + i) % TEAM_COLORS.length],
      sort_order: teams.length + i,
    }))
    const { error } = await supabase.from('aitb_teams').insert(rows)
    if (error) { say('Bulk add failed ⚠️'); return }
    const skipped = requested.length - names.length
    setBulkText('')
    say(`Added ${names.length} team${names.length > 1 ? 's' : ''}${skipped ? ` · skipped ${skipped} dup` : ''} 🚀`)
    load()
  }

  const renameTeam = async (id: string, name: string) => {
    await supabase.from('aitb_teams').update({ name }).eq('id', id)
  }

  const saveAdjust = async (t: AitbTeam, raw: string) => {
    const v = parseInt(raw, 10)
    const adjust = Number.isFinite(v) ? v : 0
    if (adjust === (t.adjust || 0)) return
    await supabase.from('aitb_teams').update({ adjust }).eq('id', t.id)
    say(`${t.name}: ${adjust >= 0 ? '+' : ''}${adjust} pts adjustment 🎁`)
    load()
  }

  const cycleColor = async (t: AitbTeam) => {
    const next = TEAM_COLORS[(TEAM_COLORS.indexOf(t.color) + 1) % TEAM_COLORS.length]
    await supabase.from('aitb_teams').update({ color: next }).eq('id', t.id)
  }

  const deleteTeam = async (t: AitbTeam) => {
    if (!confirm(`Delete ${t.name}? All their progress is removed.`)) return
    await supabase.from('aitb_teams').delete().eq('id', t.id)
  }

  const savePassword = async () => {
    const v = newPw.trim()
    if (!v) return
    await supabase.from('aitb_settings').update({ admin_password: v, updated_at: new Date().toISOString() }).eq('id', 1)
    setNewPw('')
    say('Password updated 🔑')
    load()
  }

  /* ---------- Live ---------- */

  const resetCell = async (teamId: string, activityId: number) => {
    await supabase.from('aitb_progress').delete().eq('team_id', teamId).eq('activity_id', activityId)
  }

  const completeCell = async (teamId: string, activityId: number) => {
    const row = progress.find(p => p.team_id === teamId && p.activity_id === activityId)
    const activity = aitbActivity(activityId)!
    const nowIso = new Date().toISOString()
    if (!row) {
      // never scanned: force-complete with no speed bonus (no real timer ran)
      await supabase.from('aitb_progress').insert({
        team_id: teamId, activity_id: activityId,
        scanned_at: nowIso, steps_done: activity.steps.map((_, i) => i), completed_at: nowIso, bonus: 0,
      })
    } else if (row.completed_at) {
      // already done: clicking again undoes the completion (timer keeps running)
      await supabase.from('aitb_progress').update({ completed_at: null, bonus: 0 }).eq('id', row.id)
    } else {
      const bonus = row.scanned_at ? aitbSpeedBonus(Date.now() - new Date(row.scanned_at).getTime(), activity) : 0
      await supabase.from('aitb_progress').update({ completed_at: nowIso, bonus }).eq('id', row.id)
    }
  }

  const startTimer = async () => {
    const m = parseInt(timerMins, 10)
    if (!m || m <= 0) { say('Enter minutes first ⏳'); return }
    await supabase.from('aitb_settings')
      .update({ game_ends_at: new Date(Date.now() + m * 60_000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', 1)
    say(`Game timer started: ${m} min ⏳`)
  }

  const extendTimer = async () => {
    if (!endsAt) return
    // Extending after expiry re-opens the game for 5 minutes from now
    const base = Math.max(new Date(endsAt).getTime(), Date.now())
    await supabase.from('aitb_settings')
      .update({ game_ends_at: new Date(base + 5 * 60_000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', 1)
    say('+5 minutes added ⏳')
  }

  const clearTimer = async () => {
    await supabase.from('aitb_settings')
      .update({ game_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', 1)
    say('Game timer cleared 🧹')
  }

  const resetAll = async () => {
    if (!confirm('Reset ALL progress for ALL teams? Points go back to zero.')) return
    // "Zero" has to include the manual bonus/penalty box, or totals keep it.
    const [p, t] = await Promise.all([
      supabase.from('aitb_progress').delete().gte('activity_id', 0),
      supabase.from('aitb_teams').update({ adjust: 0 }).neq('adjust', 0),
    ])
    load() // don't wait on realtime to show the cleared board
    say(p.error || t.error ? 'Reset failed, try again ⚠️' : 'All progress reset 🧽')
  }

  // Delete every team (their progress cascades away via the FK): a full clean
  // slate before an event, to pair with the bulk-add roster button.
  const clearAllTeams = async () => {
    if (teams.length === 0) { say('No teams to clear 🤔'); return }
    if (!confirm(`Delete ALL ${teams.length} teams and every score? This cannot be undone.`)) return
    const { error } = await supabase.from('aitb_teams').delete().gte('sort_order', -2147483648)
    if (error) { say('Clear failed ⚠️'); return }
    say('All teams cleared 🧹')
    load()
  }

  const teamTotal = (t: AitbTeam) =>
    progress.filter(p => p.team_id === t.id).reduce((a, p) => a + aitbProgressPoints(p, aitbActivity(p.activity_id)), 0) + (t.adjust || 0)

  // Download the final standings as a CSV the facilitator can send the client:
  // rank, total, completion, manual adjust, and the points earned per activity.
  const exportResults = () => {
    const standings = teams
      .map(t => {
        const rows = progress.filter(p => p.team_id === t.id)
        return { t, rows, total: teamTotal(t), completed: rows.filter(p => p.completed_at).length }
      })
      .sort((a, b) => b.total - a.total || b.completed - a.completed)
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const header = ['Rank', 'Team', 'Total Points', 'Completed', 'Manual Adjust', ...games.map(a => `${a.act} ${a.name}`)]
    const lines = [header.map(esc).join(',')]
    standings.forEach((r, i) => {
      const perAct = games.map(a => {
        const p = r.rows.find(x => x.activity_id === a.id)
        return p ? aitbProgressPoints(p, a) : 0
      })
      lines.push([i + 1, r.t.name, r.total, `${r.completed}/${AITB_ACTIVITIES.length}`, r.t.adjust || 0, ...perAct].map(esc).join(','))
    })
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aitb-results-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    say('Results exported ⬇️')
  }

  const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const ranked = [...teams].sort((a, b) => teamTotal(b) - teamTotal(a))
  const visible = games.filter(g => !g.hidden)

  if (!isSupabaseConfigured) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Supabase is not configured.</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 sm:px-6 pb-16">
      {/* Sticky bar: jump between the four parts of the page */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-gray-950/90 backdrop-blur"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
          <a href="/" aria-label="Back to hub" className="px-3 py-2 rounded-xl font-bold text-sm text-gray-400" style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
            ←<span className="hidden sm:inline"> Hub</span>
          </a>
          <h1 className="hidden sm:block text-xl font-black mr-2">🤖 AI Team Building</h1>
          <nav className="flex gap-1.5 flex-wrap" aria-label="Steps">
            {SECTIONS.map((s, i) => {
              const on = active === s.id
              return (
                <button key={s.id} onClick={() => jump(s.id)} aria-current={on ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  className={`flex items-center gap-1.5 p-1 sm:pr-3 rounded-full font-bold text-sm transition active:scale-95 ${on ? 'text-white bg-teal-400/10' : 'text-gray-400 hover:bg-white/5'}`}
                  style={{ border: `1.5px solid ${on ? 'rgba(45,212,191,0.6)' : 'rgba(255,255,255,0.1)'}` }}>
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-black ${on ? 'bg-teal-400 text-black' : 'bg-white/10'}`}>{i + 1}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="flex-1" />
          <a href="/aitb" aria-label="Projector" className="px-3 py-2 rounded-xl font-bold text-sm" style={{ background: '#2dd4bf22', color: '#2dd4bf', border: '1.5px solid #2dd4bf55' }}>
            📺<span className="hidden sm:inline"> Projector</span>
          </a>
          <button onClick={exportResults} aria-label="Export results" className="px-3 py-2 rounded-xl font-bold text-sm" style={{ background: '#a3e63522', color: '#a3e635', border: '1.5px solid #a3e63555' }}>
            ⬇️<span className="hidden sm:inline"> Export</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* ============ TEAMS ============ */}
        <Section i={0} onJump={jump}>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl p-4 sm:p-6 min-w-0" style={CARD}>
              {teams.map(t => (
                <div key={t.id} className="flex items-center gap-2 mb-2">
                  <button onClick={() => cycleColor(t)} title="change colour" className="text-2xl" style={{ color: t.color }}>●</button>
                  <input defaultValue={t.name} aria-label="Team name"
                    onBlur={e => { if (e.target.value.trim() && e.target.value !== t.name) renameTeam(t.id, e.target.value.trim()) }}
                    className="flex-1 min-w-0 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={FIELD_STYLE} />
                  <input key={`adj-${t.id}-${t.adjust}`} defaultValue={t.adjust || 0} inputMode="numeric"
                    aria-label="Bonus or penalty points"
                    title="Bonus / penalty points, added to the team total (use minus for penalty)"
                    onBlur={e => saveAdjust(t, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-16 bg-gray-800/60 rounded-lg px-2 py-2 font-bold text-center outline-none"
                    style={{ border: '1.5px solid rgba(251,191,36,0.35)', color: '#fbbf24' }} />
                  <span className="font-black tabular-nums w-24 text-right" style={{ color: t.color }}>{teamTotal(t)} pts</span>
                  <button onClick={() => deleteTeam(t)} aria-label={`Delete ${t.name}`} className="text-gray-500 hover:text-red-400 px-1">✕</button>
                </div>
              ))}
              <p className="text-gray-500 text-xs mt-1 mb-2">🟡 Yellow box = bonus/penalty points you award manually (e.g. 200 or -100), counted in the total.</p>
              <div className="flex gap-2 mt-3">
                <input value={newTeam} onChange={e => setNewTeam(e.target.value)} aria-label="New team name"
                  onKeyDown={e => { if (e.key === 'Enter') addTeam() }} placeholder="New team name"
                  className="flex-1 min-w-0 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={FIELD_STYLE} />
                <button onClick={addTeam} className="px-4 rounded-lg font-black active:scale-95 transition" style={{ background: '#2dd4bf', color: '#000' }}>+ Add</button>
              </div>

              {/* Bulk add: paste a whole roster at once */}
              <details className="mt-3 rounded-xl overflow-hidden" style={{ border: '1.5px dashed rgba(45,212,191,0.4)' }}>
                <summary className="px-3 py-2 cursor-pointer list-none font-bold text-sm" style={{ color: '#2dd4bf' }}>
                  ⚡ Bulk add teams
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-gray-500 text-xs mb-2">One team per line (or comma-separated). Existing names &amp; duplicates are skipped.</p>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={5} aria-label="Team names"
                    placeholder={'Team Alpha\nTeam Bravo\nTeam Charlie'}
                    className="w-full bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none resize-y" style={FIELD_STYLE} />
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={bulkAddTeams} className="px-4 py-2 rounded-lg font-black" style={{ background: '#2dd4bf', color: '#000' }}>
                      ⚡ Add {parseBulk(bulkText).length || ''} teams
                    </button>
                    {bulkText.trim() && (
                      <button onClick={() => setBulkText('')} className="px-3 py-2 rounded-lg font-bold text-gray-400 text-sm"
                        style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>Clear</button>
                    )}
                  </div>
                </div>
              </details>
            </div>

            <div className="rounded-3xl p-4 sm:p-6 min-w-0 flex flex-col gap-6" style={CARD}>
              <div>
                <h3 className="font-black text-lg mb-2">🚀 Team board QR</h3>
                <p className="text-gray-400 text-sm mb-3">
                  One QR for the whole event. Teams scan once, pick their team, then draw their own missions.
                  Print it and post it at each station.
                </p>
                <button onClick={() => setShowBoardQr(true)}
                  className="w-full rounded-2xl py-4 font-black text-lg transition-all hover:scale-[1.02]"
                  style={{ background: '#fbbf2422', color: '#fbbf24', border: '2px solid #fbbf2455' }}>
                  🚀 Show Team Board QR
                </button>
              </div>
              <div>
                <h3 className="font-black text-lg mb-2">🛰️ Observer / cheer QR</h3>
                <p className="text-gray-400 text-sm mb-3">
                  For the audience &amp; benched teammates: watch the live race and fire emoji reactions on the projector.
                </p>
                <button onClick={() => setShowObserverQr(true)}
                  className="w-full rounded-2xl py-4 font-black text-lg transition-all hover:scale-[1.02]"
                  style={{ background: '#a855f722', color: '#c084fc', border: '2px solid #a855f755' }}>
                  🛰️ Show Observer QR
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ============ LIVE ============ */}
        <Section i={1} onJump={jump}>
          {/* Whole-game timer: mission pages lock when it hits zero */}
          <div className="rounded-3xl p-6 mb-6 flex items-center gap-6 flex-wrap"
            style={{
              background: timeUp ? 'rgba(248,113,113,0.08)' : CARD.background,
              border: timeUp ? '2px solid rgba(248,113,113,0.5)' : CARD.border,
            }}>
            <div>
              <h3 className="font-black text-lg">⏳ Game timer</h3>
              <p className="text-gray-400 text-sm">Phones lock when it reaches zero.</p>
            </div>
            <div className="font-black text-5xl tabular-nums"
              style={{ color: !endsAt ? '#4b5563' : timeUp ? '#f87171' : remainingMs! < 5 * 60_000 ? '#fbbf24' : '#2dd4bf' }}>
              {!endsAt ? '--:--' : timeUp ? "TIME'S UP" : fmtCountdown(remainingMs!)}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 flex-wrap">
              <input value={timerMins} onChange={e => setTimerMins(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric" aria-label="Minutes"
                className="w-20 bg-gray-800/60 rounded-lg px-3 py-2 font-bold text-center outline-none" style={FIELD_STYLE} />
              <button onClick={startTimer} className="px-4 py-2 rounded-lg font-black active:scale-95 transition" style={{ background: '#2dd4bf', color: '#000' }}>
                ▶ Start
              </button>
              {endsAt && (
                <>
                  <button onClick={extendTimer} className="px-4 py-2 rounded-lg font-black active:scale-95 transition"
                    style={{ background: '#fbbf2422', color: '#fbbf24', border: '1.5px solid #fbbf2455' }}>
                    +5 min
                  </button>
                  <button onClick={clearTimer} className="px-4 py-2 rounded-lg font-bold text-gray-400 active:scale-95 transition"
                    style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
                    ✕ Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live scoreboard: ranked, one cell per game */}
          <div className="rounded-3xl p-6 mb-6 overflow-x-auto" style={CARD}>
            <h3 className="font-black text-lg mb-1">🏆 Live scoreboard</h3>
            <p className="text-gray-400 text-sm mb-4">⚪ waiting · 🕐 playing · ✅ done. Click a cell to complete (click ✅ to undo), right-click for a full reset.</p>
            {teams.length === 0 ? (
              <p className="text-gray-500 text-sm">No teams yet. Add them in <button onClick={() => jump('teams')} className="underline text-teal-300">Teams</button>.</p>
            ) : (
              <table className="w-full text-center">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 text-xs uppercase tracking-wider pb-2 w-10">#</th>
                    <th className="text-left text-gray-400 text-xs uppercase tracking-wider pb-2">Team</th>
                    {games.map(a => (
                      <th key={a.id} className="pb-2 text-lg" title={a.name} style={{ opacity: a.hidden ? 0.35 : 1 }}>{a.emoji}</th>
                    ))}
                    <th className="text-right text-gray-400 text-xs uppercase tracking-wider pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((t, rank) => {
                    const rows = progress.filter(p => p.team_id === t.id)
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <td className="text-left font-black text-gray-500 tabular-nums">{rank + 1}</td>
                        <td className="text-left font-black py-2" style={{ color: t.color }}>● {t.name}</td>
                        {games.map(a => {
                          const p = rows.find(x => x.activity_id === a.id)
                          const label = p?.completed_at ? '✅' : p?.scanned_at ? `🕐${p.steps_done.length}` : '⚪'
                          const pts = p ? aitbProgressPoints(p, a) : 0
                          return (
                            <td key={a.id} className="py-2">
                              <button
                                onClick={() => completeCell(t.id, a.id)}
                                onContextMenu={e => { e.preventDefault(); resetCell(t.id, a.id) }}
                                title={`${a.name}: ${pts} pts. Click = ${p?.completed_at ? 'undo complete' : 'complete'}, right-click = full reset`}
                                className="rounded-lg px-1.5 py-1 text-sm font-bold hover:bg-white/10">
                                {label}
                              </button>
                            </td>
                          )
                        })}
                        <td className="text-right font-black tabular-nums" style={{ color: t.color }}>{teamTotal(t)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* What each team got: one button per game, updates live */}
          <AitbSubmissions teams={teams} progress={progress} />
        </Section>

        {/* ============ GAMES ============ */}
        <Section i={2} onJump={jump}
          sub={`Tick the games players can play (${visible.length} of ${games.length} ticked). Drag ⠿ to reorder; the order sets the game numbers.`}>
          <div className="flex flex-col gap-2">
            {games.map((a, i) => {
              const open = openId === a.id
              return (
                <div key={a.id} id={`game-${a.id}`} data-game-row className="rounded-2xl overflow-hidden scroll-mt-24 bg-gray-950"
                  style={{ border: `1.5px solid ${a.color}${open || drag?.from === i ? '66' : '33'}`, ...rowStyle(i) }}>
                  <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: a.hidden ? 'transparent' : `${a.color}11` }}>
                    <button
                      onPointerDown={e => startDrag(e, i)} onPointerMove={moveDrag}
                      onPointerUp={endDrag} onPointerCancel={endDrag}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); moveGame(i, i + (e.key === 'ArrowUp' ? -1 : 1)) }
                      }}
                      aria-label={`Move ${a.name}. Drag, or use the arrow keys`} title="Drag to reorder"
                      className={`touch-none select-none text-gray-500 hover:text-white text-xl leading-none px-1 -ml-2 ${drag?.from === i ? 'cursor-grabbing' : 'cursor-grab'}`}>
                      ⠿
                    </button>
                    <input type="checkbox" checked={!a.hidden} onChange={() => toggleHidden(a)}
                      aria-label={`Players can play ${a.name}`} title="Tick = players can play this game"
                      className="w-5 h-5 cursor-pointer accent-teal-400 shrink-0" />
                    <button onClick={() => setOpenId(open ? null : a.id)}
                      aria-expanded={open}
                      className="flex items-center gap-3 font-black text-left flex-1 min-w-[220px]"
                      style={{ opacity: a.hidden ? 0.5 : 1 }}>
                      <span className="text-2xl">{a.emoji}</span>
                      <span style={{ color: a.color }}>{a.act} · {a.name}</span>
                      <span className="text-gray-500 font-bold text-sm hidden md:inline">{a.mins} min · {a.outType}</span>
                      <span className="text-gray-500 text-sm ml-auto">{open ? '▴' : '▾'}</span>
                    </button>
                    <ChipButton color={a.color} onClick={() => setOverlay({ kind: 'preview', id: a.id })}>👁️ Preview</ChipButton>
                    {/* Demo and QR are for games players can actually open */}
                    {!a.hidden && <ChipButton color={a.color} onClick={() => setOverlay({ kind: 'demo', id: a.id })}>🎮 Demo</ChipButton>}
                    <ChipButton color={a.color} onClick={() => navigate(`/aitb/admin/game/${a.id}`)}>✏️ Edit</ChipButton>
                    {!a.hidden && <ChipButton color={a.color} onClick={() => setQrActivity(a.id)}>📱 QR</ChipButton>}
                  </div>

                  {open && (
                    <div className="p-4">
                      <div className="grid md:grid-cols-[200px_1fr] gap-4">
                        <img src={a.hero} alt="" className="rounded-xl w-full object-cover aspect-video" />
                        <div>
                          <p className="text-gray-300 text-sm leading-relaxed mb-2">{a.desc}</p>
                          <p className="text-gray-500 text-sm mb-3">🧠 {a.learning}</p>
                          <ol className="text-sm text-gray-300 mb-3">
                            {a.steps.map((s, i) => (
                              <li key={i} className="mb-1">{a.stepEmojis[i]} <b>{i + 1}.</b> {s}</li>
                            ))}
                          </ol>
                          <AitbAppLinks apps={a.apps} color={a.color} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addGame}
            className="mt-3 w-full rounded-2xl py-4 font-black transition-all hover:bg-white/5 active:scale-[0.99]"
            style={{ border: '2px dashed rgba(45,212,191,0.4)', color: '#2dd4bf' }}>
            ➕ Add game
          </button>
        </Section>

        {/* ============ SETTINGS & RULES ============ */}
        <Section i={3} onJump={jump}>
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-3xl p-4 sm:p-6 min-w-0" style={CARD}>
              <h3 className="font-black text-lg mb-2">🔑 Marshal password</h3>
              <p className="text-gray-400 text-sm mb-3">Marshals type this to mark missions complete. Current: <b className="text-white">{settings?.admin_password}</b></p>
              <div className="flex gap-2">
                <input value={newPw} onChange={e => setNewPw(e.target.value)} aria-label="New password"
                  onKeyDown={e => { if (e.key === 'Enter') savePassword() }} placeholder="New password"
                  className="flex-1 min-w-0 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={FIELD_STYLE} />
                <button onClick={savePassword} className="px-4 rounded-lg font-black" style={{ background: '#fbbf24', color: '#000' }}>Save</button>
              </div>
            </div>
            <div className="rounded-3xl p-4 sm:p-6 min-w-0" style={CARD}>
              <AitbLogoUpload />
            </div>
          </div>

          {/* Station props: collapsed to keep the page tidy */}
          <details className="rounded-3xl mb-6 overflow-hidden" style={CARD}>
            <summary className="flex items-center gap-3 px-6 py-5 cursor-pointer list-none">
              <h3 className="font-black text-lg">🎒 Station props</h3>
              <span className="text-gray-400 text-sm hidden sm:inline">Hand these to each team at their station</span>
              <span className="flex-1" />
              <span className="text-gray-500 font-bold text-sm whitespace-nowrap">Tap to show ▾</span>
            </summary>
            <div className="px-6 pb-6">
              <div className="grid md:grid-cols-2 gap-3">
                {visible.filter(a => a.props.length > 0).map(a => (
                  <div key={a.id} className="rounded-2xl px-4 py-3" style={{ background: `${a.color}0d`, border: `1.5px solid ${a.color}44` }}>
                    <div className="font-black mb-1" style={{ color: a.color }}>{a.emoji} {a.act} · {a.name}</div>
                    <ul className="text-sm text-gray-300">
                      {a.props.map(p => <li key={p} className="mb-0.5">▪ {p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-3">
                📱 No props needed (phones only):{' '}
                {visible.filter(a => a.props.length === 0).map(a => `${a.emoji} ${a.act}`).join(' · ')}
              </p>
            </div>
          </details>

          {/* Danger zone: last on the page so it is never hit by accident */}
          <div className="rounded-3xl p-6 flex items-center gap-3 flex-wrap"
            style={{ background: 'rgba(248,113,113,0.05)', border: '2px solid rgba(248,113,113,0.25)' }}>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-black text-lg text-red-300">Danger zone</h3>
              <p className="text-gray-400 text-sm">Wipe scores or teams between events. Cannot be undone.</p>
            </div>
            <button onClick={resetAll} className="px-4 py-2 rounded-xl font-bold text-sm text-red-400" style={{ border: '1.5px solid rgba(248,113,113,0.4)' }}>
              🧽 Reset all progress
            </button>
            <button onClick={clearAllTeams} className="px-4 py-2 rounded-xl font-bold text-sm text-red-400" style={{ border: '1.5px solid rgba(248,113,113,0.4)' }}>
              🗑️ Clear all teams
            </button>
          </div>
        </Section>
      </div>

      {/* Demo / player preview: open over the admin in this tab, Back returns to the same spot */}
      {overlay && (() => {
        const a = aitbActivity(overlay.id)!
        return (
          <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `2px solid ${a.color}55` }}>
              <button onClick={() => setOverlay(null)} autoFocus
                className="px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition"
                style={{ background: '#2dd4bf', color: '#000' }}>
                ← Back to admin
              </button>
              <span className="font-black truncate" style={{ color: a.color }}>
                {a.emoji} {a.name} · {overlay.kind === 'demo' ? 'Demo' : 'Player view'}
              </span>
            </div>
            {overlay.kind === 'demo'
              ? <iframe src={`/gamesystem/index.html#/game/${a.id}`} title={`${a.name} demo`} className="flex-1 w-full border-0" />
              : <div className="flex-1 overflow-auto py-6"><PhonePreview id={a.id} /></div>}
          </div>
        )
      })()}

      {/* Team board QR modal: the self-serve entry point teams scan once */}
      {showBoardQr && (
        <QrModal url={`${baseUrl}/aitb/home`} color="#fbbf24" title="🚀 Team Board"
          sub="Scan once → pick your team → draw your own missions" onClose={() => setShowBoardQr(false)} />
      )}

      {/* Observer QR modal: audience watch-and-cheer entry point */}
      {showObserverQr && (
        <QrModal url={`${baseUrl}/aitb/watch`} color="#c084fc" title="🛰️ Follow Your Team"
          sub="Scan to see your team's live mission progress, and cheer" onClose={() => setShowObserverQr(false)} />
      )}

      {/* Per-activity QR modal: Prev / Next walk the games players can see */}
      {qrActivity !== null && (() => {
        const a = aitbActivity(qrActivity)!
        const i = visible.findIndex(g => g.id === a.id)
        const step = (d: number) => setQrActivity(visible[(i + d + visible.length) % visible.length].id)
        return (
          <QrModal url={`${baseUrl}/aitb/m/${a.id}`} color={a.color} title={`${a.emoji} ${a.name}`}
            sub="Scan to open the mission on your phone" onClose={() => setQrActivity(null)}
            onPrev={() => step(-1)} onNext={() => step(1)} />
        )
      })()}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 px-5 py-3 rounded-2xl font-bold shadow-2xl z-[60]">
          {toast}
        </div>
      )}
    </div>
  )
}

/* One numbered step of the page flow. A line joins each number to the next,
   and "Next" scrolls on, so the admin reads as steps 1 to 4. */
function Section({ i, sub, onJump, children }: { i: number; sub?: string; onJump: (id: string) => void; children: ReactNode }) {
  const s = SECTIONS[i], next = SECTIONS[i + 1]
  return (
    <section id={s.id} className="relative grid grid-cols-[32px_1fr] sm:grid-cols-[40px_1fr] gap-3 sm:gap-5 pb-14 scroll-mt-20">
      {next && <span aria-hidden className="absolute left-[15px] sm:left-[19px] top-12 bottom-2 w-0.5 bg-white/10" />}
      <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full grid place-items-center font-black sm:text-lg text-teal-300"
        style={{ background: 'rgba(45,212,191,0.12)', border: '2px solid rgba(45,212,191,0.5)' }}>
        {i + 1}
      </div>
      <div className="min-w-0">
        <h2 className="text-2xl font-black leading-tight sm:leading-10">{s.title}</h2>
        <p className="text-gray-400 text-sm mb-4">{sub ?? s.sub}</p>
        {children}
        {next && (
          <button onClick={() => onJump(next.id)}
            className="mt-6 px-4 py-2 rounded-xl font-bold text-sm text-teal-300 hover:bg-teal-400/10 active:scale-95 transition"
            style={{ border: '1.5px solid rgba(45,212,191,0.45)' }}>
            Next: {next.label} ↓
          </button>
        )}
      </div>
    </section>
  )
}

function ChipButton({ color, onClick, children }: { color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-1 rounded-lg font-bold text-xs active:scale-95 transition"
      style={{ background: `${color}22`, color, border: `1.5px solid ${color}55` }}>
      {children}
    </button>
  )
}

/* The real mission page in a phone-sized frame, in preview mode (fake team, no
   writes). It loads the saved version of the game. */
function PhonePreview({ id }: { id: number }) {
  const [state, setState] = useState<PreviewState>('playing')
  const tabs: [PreviewState, string][] = [['start', 'Not started'], ['playing', 'Playing'], ['done', 'Completed']]
  return (
    <div className="w-fit mx-auto">
      <div className="flex gap-1 mb-2 justify-center" role="tablist" aria-label="Player screen">
        {tabs.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={state === v} onClick={() => setState(v)}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition ${state === v ? 'bg-teal-400 text-black' : 'text-gray-400 hover:bg-white/10'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-[2rem] overflow-hidden" style={{ width: 312, height: 640, border: '6px solid #1f2937', background: '#030712' }}>
        <iframe key={state} src={`/aitb/m/${id}?preview=${state}`} title="Player phone preview"
          style={{ width: 390, height: 800, transform: 'scale(0.8)', transformOrigin: '0 0', border: 0 }} />
      </div>
      <p className="text-gray-500 text-xs text-center mt-2">What players see. Nothing here is saved.</p>
    </div>
  )
}

/* /aitb/admin/game/:id: edit one game on its own page, then back to the admin. */
export function AitbGameEdit() {
  const navigate = useNavigate()
  const id = Number(useParams<{ id: string }>().id)
  const saved = aitbActivity(id)
  const [draft, setDraft] = useState<AitbActivity | undefined>(saved && { ...saved })
  const [toast, setToast] = useState('')
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }
  const back = () => navigate(`/aitb/admin#game-${id}`)
  useEffect(() => { window.scrollTo(0, 0) }, []) // the SPA keeps the admin's scroll otherwise

  if (!saved || !draft) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-black">Game not found</div>
        <button onClick={() => navigate('/aitb/admin')} className="px-4 py-2 rounded-xl font-black" style={{ background: '#2dd4bf', color: '#000' }}>← Back to admin</button>
      </div>
    )
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const leave = () => { if (!dirty || confirm('Leave without saving your changes?')) back() }
  const save = async () => {
    if (!draft.name.trim()) { say('Give the game a name first 🤔'); return }
    const clean = { ...draft, steps: draft.steps.filter(s => s.trim()), props: draft.props.filter(p => p.trim()) }
    // Keep the latest saved tick and position: this page only owns the content.
    if (!(await saveAitbGames(gs => gs.map(g => (g.id === id ? { ...clean, hidden: g.hidden } : g))))) { say(SAVE_FAILED); return }
    back()
  }
  const base = AITB_DEFAULTS.find(d => d.id === id)

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 sm:px-6 pb-16">
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-gray-950/90 backdrop-blur"
        style={{ borderBottom: `2px solid ${draft.color}55` }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={leave} className="px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition"
            style={{ background: '#2dd4bf', color: '#000' }}>
            ← Back to admin
          </button>
          <span className="font-black truncate" style={{ color: draft.color }}>✏️ {draft.emoji} {draft.name}</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto">
        <GameForm draft={draft} setDraft={setDraft as Dispatch<SetStateAction<AitbActivity>>} say={say}
          onSave={save} onCancel={leave}
          onReset={base ? () => setDraft({ ...base, hidden: draft.hidden }) : undefined} />
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 px-5 py-3 rounded-2xl font-bold shadow-2xl z-[60]">{toast}</div>
      )}
    </div>
  )
}

function GameForm({ draft, setDraft, say, onSave, onCancel, onReset }: {
  draft: AitbActivity
  setDraft: Dispatch<SetStateAction<AitbActivity>>
  say: (m: string) => void
  onSave: () => void
  onCancel: () => void
  onReset?: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof AitbActivity>(k: K, v: AitbActivity[K]) => setDraft(d => ({ ...d, [k]: v }))
  const setStep = (i: number, text: string, emoji: string) => setDraft(d => ({
    ...d,
    steps: d.steps.map((s, j) => (j === i ? text : s)),
    stepEmojis: d.steps.map((_, j) => (j === i ? emoji : d.stepEmojis[j] ?? '✅')),
  }))

  const uploadHero = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    const path = `aitb-media/heroes/${Date.now()}-${file.name.replace(/[^\w.]+/g, '-')}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    setUploading(false)
    if (error) { say('Upload failed ⚠️'); return }
    set('hero', supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[72px_1fr] sm:grid-cols-[72px_1fr_72px] gap-3">
        <Field label="Emoji"><input value={draft.emoji} onChange={e => set('emoji', e.target.value)} className={`${FIELD} text-center text-xl`} style={FIELD_STYLE} /></Field>
        <Field label="Name"><input value={draft.name} onChange={e => set('name', e.target.value)} className={FIELD} style={FIELD_STYLE} /></Field>
        <Field label="Colour">
          <input type="color" value={draft.color} onChange={e => set('color', e.target.value)}
            className="w-full h-[42px] rounded-lg bg-transparent cursor-pointer" style={FIELD_STYLE} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Minutes">
          <input type="number" min={1} value={draft.mins} onChange={e => set('mins', Math.max(1, Number(e.target.value) || 1))} className={FIELD} style={FIELD_STYLE} />
        </Field>
        <Field label="Difficulty">
          <select value={draft.difficulty} onChange={e => set('difficulty', e.target.value as AitbActivity['difficulty'])} className={FIELD} style={FIELD_STYLE}>
            <option>Easy</option><option>Normal</option><option>Hard</option>
          </select>
        </Field>
        <Field label="Output"><input value={draft.outType} onChange={e => set('outType', e.target.value)} className={FIELD} style={FIELD_STYLE} /></Field>
      </div>
      <Field label="Tagline (one line under the title)"><input value={draft.tagline} onChange={e => set('tagline', e.target.value)} className={FIELD} style={FIELD_STYLE} /></Field>
      <Field label="Description"><textarea rows={3} value={draft.desc} onChange={e => set('desc', e.target.value)} className={`${FIELD} resize-y`} style={FIELD_STYLE} /></Field>
      <Field label="What teams learn"><input value={draft.learning} onChange={e => set('learning', e.target.value)} className={FIELD} style={FIELD_STYLE} /></Field>

      <Field group label="Steps (emoji + instruction)">
        <div className="flex flex-col gap-2">
          {draft.steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input value={draft.stepEmojis[i] ?? ''} onChange={e => setStep(i, s, e.target.value)} aria-label={`Step ${i + 1} emoji`}
                className={`${FIELD} !w-14 text-center`} style={FIELD_STYLE} />
              <input value={s} onChange={e => setStep(i, e.target.value, draft.stepEmojis[i] ?? '✅')} aria-label={`Step ${i + 1}`}
                className={FIELD} style={FIELD_STYLE} />
              <button onClick={() => setDraft(d => ({ ...d, steps: d.steps.filter((_, j) => j !== i), stepEmojis: d.stepEmojis.filter((_, j) => j !== i) }))}
                aria-label={`Remove step ${i + 1}`} className="text-gray-500 hover:text-red-400 px-2">✕</button>
            </div>
          ))}
          <button onClick={() => setDraft(d => ({ ...d, steps: [...d.steps, ''], stepEmojis: [...d.stepEmojis, '✅'] }))}
            className="self-start text-sm font-bold text-teal-300 hover:underline">+ Add step</button>
        </div>
      </Field>

      <Field group label="AI apps players can open">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(AITB_APPS).map(name => {
            const on = draft.apps.includes(name)
            return (
              <button key={name} aria-pressed={on}
                onClick={() => set('apps', on ? draft.apps.filter(x => x !== name) : [...draft.apps, name])}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95"
                style={on
                  ? { background: draft.color, color: '#000' }
                  : { color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.15)' }}>
                {name}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Station props (one per line, empty = phones only)">
        <textarea rows={3} value={draft.props.join('\n')} onChange={e => set('props', e.target.value.split('\n'))} className={`${FIELD} resize-y`} style={FIELD_STYLE} />
      </Field>
      <Field label="Note for players (optional)">
        <input value={draft.note ?? ''} onChange={e => set('note', e.target.value || undefined)} className={FIELD} style={FIELD_STYLE} />
      </Field>

      <Field group label="Picture">
        <div className="flex items-center gap-3">
          <img src={draft.hero} alt="" className="w-32 aspect-video object-cover rounded-lg" />
          <label className="px-3 py-2 rounded-lg font-bold text-sm cursor-pointer text-gray-300 hover:bg-white/10" style={FIELD_STYLE}>
            {uploading ? 'Uploading…' : '⬆️ Upload picture'}
            <input type="file" accept="image/*" className="hidden" onChange={e => uploadHero(e.target.files?.[0])} />
          </label>
        </div>
      </Field>

      <div className="flex gap-2 flex-wrap sticky bottom-0 py-3 bg-gray-950/90 backdrop-blur">
        <button onClick={onSave} className="px-5 py-2 rounded-lg font-black active:scale-95 transition" style={{ background: '#2dd4bf', color: '#000' }}>
          💾 Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg font-bold text-gray-400" style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
          Cancel
        </button>
        {onReset && (
          <button onClick={onReset} className="px-4 py-2 rounded-lg font-bold text-gray-400 ml-auto" style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
            ↩️ Reset to default
          </button>
        )}
      </div>
    </div>
  )
}

// Label above the control. `group` = several controls, so a plain div: a <label>
// would forward stray clicks to its first button.
function Field({ label, group, children }: { label: string; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-bold text-gray-400">{label}</span>
      {children}
    </Tag>
  )
}

function QrModal({ url, color, title, sub, onClose, onPrev, onNext }: {
  url: string; color: string; title: string; sub: string
  onClose: () => void; onPrev?: () => void; onNext?: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={onClose}>
      <div className="text-center" onClick={e => e.stopPropagation()}>
        <div className="text-2xl font-black mb-1" style={{ color }}>{title}</div>
        <div className="text-gray-400 text-sm mb-4">{sub}</div>
        <div className="bg-white p-6 rounded-3xl inline-block">
          <QRCodeSVG value={url} size={Math.min(560, window.innerWidth - 120, window.innerHeight - 260)} />
        </div>
        <div className="text-gray-500 text-xs mt-3">{url}</div>
        <div className="flex gap-2 justify-center mt-4">
          {onPrev && <button onClick={onPrev} className="px-4 py-2 rounded-xl font-bold" style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}>← Prev</button>}
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold" style={{ background: '#fff', color: '#000' }}>Close</button>
          {onNext && <button onClick={onNext} className="px-4 py-2 rounded-xl font-bold" style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}>Next →</button>}
        </div>
      </div>
    </div>
  )
}
