import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { AITB_ACTIVITIES, aitbProgressPoints, aitbActivity, aitbSpeedBonus } from '../lib/aitbActivities'
import { useAitbGameTimer, fmtCountdown } from '../hooks/useAitbGameTimer'
import type { AitbTeam, AitbProgress, AitbSettings } from '../types/database'

const UNLOCK_KEY = 'aitb_admin_unlocked'
const TEAM_COLORS = ['#fb7185', '#22d3ee', '#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#60a5fa', '#f59e0b']

export function AitbAdmin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [settings, setSettings] = useState<AitbSettings | null>(null)
  const [teams, setTeams] = useState<AitbTeam[]>([])
  const [progress, setProgress] = useState<AitbProgress[]>([])
  const [newTeam, setNewTeam] = useState('')
  const [newPw, setNewPw] = useState('')
  const [qrActivity, setQrActivity] = useState<number | null>(null)
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

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('aitb-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_progress' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aitb_teams' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const tryUnlock = async () => {
    const { data } = await supabase.from('aitb_settings').select('admin_password').eq('id', 1).maybeSingle()
    if (data && pwInput === data.admin_password) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
    } else setPwError('Wrong password')
  }

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

  const renameTeam = async (id: string, name: string) => {
    await supabase.from('aitb_teams').update({ name }).eq('id', id)
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
        scanned_at: nowIso, steps_done: [0, 1, 2, 3, 4], completed_at: nowIso, bonus: 0,
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
    say(`Game timer started — ${m} min ⏳`)
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
    await supabase.from('aitb_progress').delete().gte('activity_id', 0)
    say('All progress reset 🧽')
  }

  const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  if (!isSupabaseConfigured) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Supabase is not configured.</div>
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-3">🔒</div>
          <h1 className="text-2xl font-black mb-4">AI Team Building — Admin</h1>
          <input type="password" autoFocus value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError('') }}
            onKeyDown={e => { if (e.key === 'Enter') tryUnlock() }}
            placeholder="Admin password"
            className="w-full bg-gray-800 rounded-xl px-4 py-3 font-bold text-center outline-none mb-2"
            style={{ border: pwError ? '2px solid #f87171' : '2px solid rgba(255,255,255,0.15)' }} />
          {pwError && <div className="text-red-400 text-sm font-bold mb-2">{pwError}</div>}
          <button onClick={tryUnlock} className="w-full py-3 rounded-xl font-black" style={{ background: '#2dd4bf', color: '#000' }}>
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <a href="/" className="px-4 py-2 rounded-xl font-bold text-sm text-gray-400" style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
            ← Hub
          </a>
          <h1 className="text-3xl font-black">🤖 AI Team Building — Admin</h1>
          <div className="flex-1" />
          <a href="/aitb" className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: '#2dd4bf22', color: '#2dd4bf', border: '1.5px solid #2dd4bf55' }}>
            📺 Projector
          </a>
          <button onClick={resetAll} className="px-4 py-2 rounded-xl font-bold text-sm text-red-400" style={{ border: '1.5px solid rgba(248,113,113,0.4)' }}>
            🧽 Reset all
          </button>
        </div>

        {/* Whole-game timer — mission pages lock when it hits zero */}
        <div className="rounded-3xl p-6 mb-6 flex items-center gap-6 flex-wrap"
          style={{
            background: timeUp ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)',
            border: timeUp ? '2px solid rgba(248,113,113,0.5)' : '2px solid rgba(255,255,255,0.08)',
          }}>
          <div>
            <h2 className="font-black text-lg">⏳ Game timer</h2>
            <p className="text-gray-400 text-sm">Phones lock when it reaches zero.</p>
          </div>
          <div className="font-black text-5xl tabular-nums"
            style={{ color: !endsAt ? '#4b5563' : timeUp ? '#f87171' : remainingMs! < 5 * 60_000 ? '#fbbf24' : '#2dd4bf' }}>
            {!endsAt ? '--:--' : timeUp ? "TIME'S UP" : fmtCountdown(remainingMs!)}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            <input value={timerMins} onChange={e => setTimerMins(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" placeholder="min"
              className="w-20 bg-gray-800/60 rounded-lg px-3 py-2 font-bold text-center outline-none"
              style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
            <button onClick={startTimer} className="px-4 py-2 rounded-lg font-black" style={{ background: '#2dd4bf', color: '#000' }}>
              ▶ Start
            </button>
            {endsAt && (
              <>
                <button onClick={extendTimer} className="px-4 py-2 rounded-lg font-black"
                  style={{ background: '#fbbf2422', color: '#fbbf24', border: '1.5px solid #fbbf2455' }}>
                  +5 min
                </button>
                <button onClick={clearTimer} className="px-4 py-2 rounded-lg font-bold text-gray-400"
                  style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}>
                  ✕ Clear
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Teams */}
          <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-black text-lg mb-4">👥 Teams</h2>
            {teams.map(t => (
              <div key={t.id} className="flex items-center gap-2 mb-2">
                <button onClick={() => cycleColor(t)} title="change colour" className="text-2xl" style={{ color: t.color }}>●</button>
                <input defaultValue={t.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== t.name) renameTeam(t.id, e.target.value.trim()) }}
                  className="flex-1 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
                <span className="font-black tabular-nums w-24 text-right" style={{ color: t.color }}>
                  {progress.filter(p => p.team_id === t.id).reduce((a, p) => a + aitbProgressPoints(p), 0)} pts
                </span>
                <button onClick={() => deleteTeam(t)} className="text-gray-500 hover:text-red-400 px-1">✕</button>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <input value={newTeam} onChange={e => setNewTeam(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTeam() }} placeholder="New team name"
                className="flex-1 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
              <button onClick={addTeam} className="px-4 rounded-lg font-black" style={{ background: '#2dd4bf', color: '#000' }}>+ Add</button>
            </div>
          </div>

          {/* Password + QR */}
          <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
            <h2 className="font-black text-lg mb-3">🔑 Marshal password</h2>
            <p className="text-gray-400 text-sm mb-3">Marshals type this to mark missions complete. Current: <b className="text-white">{settings?.admin_password}</b></p>
            <div className="flex gap-2 mb-6">
              <input value={newPw} onChange={e => setNewPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePassword() }} placeholder="New password"
                className="flex-1 bg-gray-800/60 rounded-lg px-3 py-2 font-bold outline-none" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }} />
              <button onClick={savePassword} className="px-4 rounded-lg font-black" style={{ background: '#fbbf24', color: '#000' }}>Save</button>
            </div>
            <h2 className="font-black text-lg mb-3">📱 Mission QR codes</h2>
            <div className="grid grid-cols-5 gap-2">
              {AITB_ACTIVITIES.map(a => (
                <button key={a.id} onClick={() => setQrActivity(a.id)}
                  className="rounded-xl py-2 font-black text-sm transition-all hover:scale-105"
                  style={{ background: `${a.color}22`, color: a.color, border: `1.5px solid ${a.color}55` }}>
                  {a.emoji}<br />{a.act}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team word submissions — Nerf (3) + Ping Pong (7), live via realtime */}
        <div className="rounded-3xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-black text-lg mb-1">📝 Team words</h2>
          <p className="text-gray-400 text-sm mb-4">Words each team typed on their phone — updates live.</p>
          <div className="grid lg:grid-cols-2 gap-4">
            {AITB_ACTIVITIES.filter(a => a.wordsInput).map(a => (
              <div key={a.id} className="rounded-2xl px-4 py-3" style={{ background: `${a.color}0d`, border: `1.5px solid ${a.color}44` }}>
                <div className="font-black mb-2" style={{ color: a.color }}>{a.emoji} {a.act} — {a.name} ({a.wordsInput!.count} words)</div>
                {teams.map(t => {
                  const p = progress.find(x => x.team_id === t.id && x.activity_id === a.id)
                  const words = p?.words ?? []
                  return (
                    <div key={t.id} className="flex items-start gap-2 mb-1.5">
                      <span className="font-bold text-sm whitespace-nowrap" style={{ color: t.color }}>● {t.name}</span>
                      {words.length === 0
                        ? <span className="text-gray-600 text-sm">— not submitted</span>
                        : <span className="flex flex-wrap gap-1">
                            {words.map((w, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}55` }}>
                                {w}
                              </span>
                            ))}
                          </span>}
                    </div>
                  )
                })}
                {teams.length === 0 && <div className="text-gray-600 text-sm">No teams yet.</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Station props — what the marshal hands each team */}
        <div className="rounded-3xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-black text-lg mb-1">🎒 Station props</h2>
          <p className="text-gray-400 text-sm mb-4">Hand these to the team at each station.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {AITB_ACTIVITIES.filter(a => a.props.length > 0).map(a => (
              <div key={a.id} className="rounded-2xl px-4 py-3" style={{ background: `${a.color}0d`, border: `1.5px solid ${a.color}44` }}>
                <div className="font-black mb-1" style={{ color: a.color }}>{a.emoji} {a.act} — {a.name}</div>
                <ul className="text-sm text-gray-300">
                  {a.props.map(p => <li key={p} className="mb-0.5">▪ {p}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-3">
            📱 No props needed (phones only):{' '}
            {AITB_ACTIVITIES.filter(a => a.props.length === 0).map(a => `${a.emoji} ${a.act}`).join(' · ')}
          </p>
        </div>

        {/* Game details */}
        <div className="rounded-3xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-black text-lg mb-1">📖 Game details</h2>
          <p className="text-gray-400 text-sm mb-4">Tap a game to expand.</p>
          {AITB_ACTIVITIES.map(a => (
            <details key={a.id} className="mb-2 rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${a.color}33` }}>
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none font-black"
                style={{ background: `${a.color}11` }}>
                <span className="text-2xl">{a.emoji}</span>
                <span style={{ color: a.color }}>Activity {a.act} — {a.name}</span>
                <span className="text-gray-500 font-bold text-sm">· {a.mins} min · {a.outType}</span>
                <span className="flex-1" />
                <a href={`/gamesystem/index.html#/game/${a.id}`} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="px-3 py-1 rounded-lg font-bold text-xs"
                  style={{ background: `${a.color}22`, color: a.color, border: `1.5px solid ${a.color}55` }}>
                  🎮 Demo
                </a>
                <button onClick={e => { e.preventDefault(); setQrActivity(a.id) }}
                  className="px-3 py-1 rounded-lg font-bold text-xs"
                  style={{ background: `${a.color}22`, color: a.color, border: `1.5px solid ${a.color}55` }}>
                  📱 QR
                </button>
              </summary>
              <div className="p-4 grid md:grid-cols-[200px_1fr] gap-4">
                <img src={a.hero} alt="" className="rounded-xl w-full object-cover aspect-video" />
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-2">{a.desc}</p>
                  <p className="text-gray-500 text-sm mb-3">🧠 {a.learning}</p>
                  <ol className="text-sm text-gray-300 mb-3">
                    {a.steps.map((s, i) => (
                      <li key={i} className="mb-1">{a.stepEmojis[i]} <b>{i + 1}.</b> {s}</li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    {a.apps.map(x => (
                      <span key={x} className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}55` }}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>

        {/* Progress matrix */}
        <div className="rounded-3xl p-6 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-black text-lg mb-1">📊 Live progress</h2>
          <p className="text-gray-400 text-sm mb-4">⚪ waiting · 🕐 playing · ✅ done — click = complete / click ✅ = undo · right-click = full reset</p>
          <table className="w-full text-center">
            <thead>
              <tr>
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider pb-2">Team</th>
                {AITB_ACTIVITIES.map(a => (
                  <th key={a.id} className="pb-2 text-lg" title={a.name}>{a.emoji}</th>
                ))}
                <th className="text-right text-gray-400 text-xs uppercase tracking-wider pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(t => {
                const rows = progress.filter(p => p.team_id === t.id)
                const total = rows.reduce((a, p) => a + aitbProgressPoints(p), 0)
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <td className="text-left font-black py-2" style={{ color: t.color }}>● {t.name}</td>
                    {AITB_ACTIVITIES.map(a => {
                      const p = rows.find(x => x.activity_id === a.id)
                      const label = p?.completed_at ? '✅' : p?.scanned_at ? `🕐${p.steps_done.length}` : '⚪'
                      const pts = p ? aitbProgressPoints(p) : 0
                      return (
                        <td key={a.id} className="py-2">
                          <button
                            onClick={() => completeCell(t.id, a.id)}
                            onContextMenu={e => { e.preventDefault(); resetCell(t.id, a.id) }}
                            title={`${a.name} — ${pts} pts. Click = ${p?.completed_at ? 'undo complete' : 'complete'}, right-click = full reset`}
                            className="rounded-lg px-1.5 py-1 text-sm font-bold hover:bg-white/10">
                            {label}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-right font-black tabular-nums" style={{ color: t.color }}>{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR modal */}
      {qrActivity !== null && (() => {
        const a = aitbActivity(qrActivity)!
        const url = `${baseUrl}/aitb/m/${a.id}`
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setQrActivity(null)}>
            <div className="text-center" onClick={e => e.stopPropagation()}>
              <div className="text-2xl font-black mb-1" style={{ color: a.color }}>{a.emoji} {a.name}</div>
              <div className="text-gray-400 text-sm mb-4">Scan to open the mission on your phone</div>
              <div className="bg-white p-6 rounded-3xl inline-block">
                <QRCodeSVG value={url} size={min(560, window.innerWidth - 120, window.innerHeight - 260)} />
              </div>
              <div className="text-gray-500 text-xs mt-3">{url}</div>
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={() => setQrActivity(qrActivity > 1 ? qrActivity - 1 : 10)} className="px-4 py-2 rounded-xl font-bold" style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}>← Prev</button>
                <button onClick={() => setQrActivity(null)} className="px-4 py-2 rounded-xl font-bold" style={{ background: '#fff', color: '#000' }}>Close</button>
                <button onClick={() => setQrActivity(qrActivity < 10 ? qrActivity + 1 : 1)} className="px-4 py-2 rounded-xl font-bold" style={{ border: '1.5px solid rgba(255,255,255,0.2)' }}>Next →</button>
              </div>
            </div>
          </div>
        )
      })()}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 px-5 py-3 rounded-2xl font-bold shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function min(...xs: number[]): number { return Math.min(...xs) }
