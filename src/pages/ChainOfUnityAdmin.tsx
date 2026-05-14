import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { ChainSession, ChainGroup, ChainScan } from '../types/database'

const ACCENT = '#fb923c' // chain / rope orange

function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export function ChainOfUnityAdmin() {
  const [sessions, setSessions] = useState<ChainSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [groups, setGroups] = useState<ChainGroup[]>([])
  const [scans, setScans] = useState<ChainScan[]>([])
  const [loading, setLoading] = useState(true)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionDate, setNewSessionDate] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [qrGroup, setQrGroup] = useState<ChainGroup | null>(null)

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const loadSessions = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const { data } = await supabase
      .from('chain_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setSessions(data)
      if (!activeSessionId && data[0]) setActiveSessionId(data[0].id)
    }
    setLoading(false)
  }, [activeSessionId])

  const loadSessionData = useCallback(async (sessionId: string) => {
    const groupsRes = await supabase
      .from('chain_groups')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    const sessionGroups = (groupsRes.data ?? []) as ChainGroup[]
    setGroups(sessionGroups)

    if (sessionGroups.length === 0) {
      setScans([])
      return
    }
    const scansRes = await supabase
      .from('chain_scans')
      .select('*')
      .in('group_id', sessionGroups.map(g => g.id))
    if (scansRes.data) setScans(scansRes.data as ChainScan[])
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    if (!activeSessionId || !isSupabaseConfigured) return
    loadSessionData(activeSessionId)
    const channel = supabase
      .channel(`chain-admin-${activeSessionId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chain_scans' },
          () => loadSessionData(activeSessionId))
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chain_groups', filter: `session_id=eq.${activeSessionId}` },
          () => loadSessionData(activeSessionId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSessionId, loadSessionData])

  const createSession = async () => {
    const title = newSessionTitle.trim() || 'Chain of Unity'
    const { data, error } = await supabase
      .from('chain_sessions')
      .insert({ title, event_date: newSessionDate || null })
      .select()
      .single()
    if (error || !data) { alert(error?.message ?? 'Failed to create session'); return }
    setNewSessionTitle('')
    setNewSessionDate('')
    setActiveSessionId(data.id)
    await loadSessions()
  }

  const updateSession = async (patch: Partial<ChainSession>) => {
    if (!activeSessionId) return
    const { error } = await supabase.from('chain_sessions').update(patch).eq('id', activeSessionId)
    if (error) { alert(error.message); return }
    await loadSessions()
  }

  const deleteSession = async () => {
    if (!activeSessionId) return
    if (!confirm('Delete this session, all its groups, and every scan? This cannot be undone.')) return
    await supabase.from('chain_sessions').delete().eq('id', activeSessionId)
    setActiveSessionId(null)
    setGroups([])
    setScans([])
    await loadSessions()
  }

  const createGroup = async () => {
    const name = newGroupName.trim()
    if (!name || !activeSessionId) return

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode(6)
      const { error } = await supabase.from('chain_groups').insert({
        session_id: activeSessionId, name, code,
      })
      if (!error) {
        setNewGroupName('')
        await loadSessionData(activeSessionId)
        return
      }
      if (error.code !== '23505') {
        alert(error.message)
        return
      }
    }
    alert('Could not generate a unique group code. Try again.')
  }

  const renameGroup = async (g: ChainGroup) => {
    const next = prompt('Rename group:', g.name)
    if (!next || next.trim() === g.name) return
    const { error } = await supabase.from('chain_groups').update({ name: next.trim() }).eq('id', g.id)
    if (error) { alert(error.message); return }
    if (activeSessionId) await loadSessionData(activeSessionId)
  }

  const resetGroupScans = async (g: ChainGroup) => {
    if (!confirm(`Reset scan count for "${g.name}"? This deletes all scan records for that group.`)) return
    await supabase.from('chain_scans').delete().eq('group_id', g.id)
    if (activeSessionId) await loadSessionData(activeSessionId)
  }

  const deleteGroup = async (g: ChainGroup) => {
    if (!confirm(`Delete group "${g.name}" and all its scans?`)) return
    await supabase.from('chain_groups').delete().eq('id', g.id)
    if (activeSessionId) await loadSessionData(activeSessionId)
  }

  const scanCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scans) m.set(s.group_id, (m.get(s.group_id) ?? 0) + 1)
    return m
  }, [scans])

  const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black mb-2">Supabase not configured</h1>
          <p className="text-gray-400">
            Set <code className="text-violet-300">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-violet-300">VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>,
            then run <code className="text-violet-300">supabase/migrations/20260514_chain_of_unity.sql</code>.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <Link to="/" className="text-sm text-gray-400 hover:text-white">&larr; Game Hub</Link>
            <h1 className="text-3xl font-black mt-2">Chain of Unity · Admin</h1>
            <p className="text-gray-400 text-sm mt-1">Pre-create groups → show each group's QR → participants scan to join and read the rules.</p>
          </div>
        </div>

        <section className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
          <h2 className="text-lg font-bold mb-3">Sessions</h2>
          {sessions.length === 0 && <p className="text-gray-400 text-sm mb-3">No sessions yet — create one below.</p>}
          {sessions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                    s.id === activeSessionId
                      ? 'bg-orange-500 text-black'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  <span className="mr-1.5">⛓️</span>
                  {s.title}
                  {s.event_date && <span className="ml-2 text-xs opacity-70">{s.event_date}</span>}
                  {s.is_active && <span className="ml-2 text-xs text-emerald-300">● live</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-stretch">
            <input
              type="text"
              value={newSessionTitle}
              onChange={e => setNewSessionTitle(e.target.value)}
              placeholder="Session title (e.g. Acme Annual Retreat)"
              className="flex-1 min-w-[200px] px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="date"
              value={newSessionDate}
              onChange={e => setNewSessionDate(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
            />
            <button onClick={createSession} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold text-sm">+ Create session</button>
          </div>
        </section>

        {activeSession && (
          <>
            <section className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
              <div className="grid sm:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Title</label>
                  <input
                    type="text"
                    value={activeSession.title}
                    onChange={e => setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, title: e.target.value } : s))}
                    onBlur={e => updateSession({ title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Notes</label>
                  <input
                    type="text"
                    value={activeSession.notes ?? ''}
                    onChange={e => setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, notes: e.target.value } : s))}
                    onBlur={e => updateSession({ notes: e.target.value || null })}
                    placeholder="e.g. Day 1, beach venue"
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => updateSession({ is_active: !activeSession.is_active })}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                    activeSession.is_active
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {activeSession.is_active ? '⏸ Close session' : '▶ Re-open session'}
                </button>
                <button onClick={deleteSession} className="ml-auto px-4 py-2 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 rounded-lg font-bold text-sm">Delete session</button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <Stat label="Groups" value={groups.length} />
                <Stat label="Total scans" value={scans.length} />
                <Stat label="Avg per group" value={groups.length ? (scans.length / groups.length).toFixed(1) : '0'} />
              </div>
            </section>

            <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold">Groups &amp; QR codes</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Each group gets its own QR. Show it to participants — scans appear live below.</p>
                </div>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createGroup() }}
                    placeholder="Group name (e.g. Group A — Black Pearl)"
                    className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[260px]"
                  />
                  <button onClick={createGroup} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold text-sm">+ Add group</button>
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="border-2 border-dashed border-white/15 rounded-xl py-14 flex flex-col items-center gap-3 text-center">
                  <div className="text-5xl">⛓️</div>
                  <p className="text-gray-300 font-medium">No groups yet</p>
                  <p className="text-xs text-gray-500">Add the first group — each one gets its own QR.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groups.map(g => {
                    const count = scanCounts.get(g.id) ?? 0
                    return (
                      <div key={g.id} className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-black text-white text-lg leading-tight">{g.name}</h3>
                          <div className="text-right">
                            <div className="text-3xl font-black" style={{ color: ACCENT }}>{count}</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">scans</div>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-gray-400 break-all">{g.code}</div>
                        <div className="flex flex-wrap gap-2 mt-auto">
                          <button
                            onClick={() => setQrGroup(g)}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold text-xs"
                          >
                            📱 QR / Link
                          </button>
                          <button
                            onClick={() => renameGroup(g)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => resetGroupScans(g)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => deleteGroup(g)}
                            className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 rounded-lg font-bold text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {qrGroup && (() => {
        const joinUrl = `${baseUrl}/chain-of-unity/join/${qrGroup.code}`
        return (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer p-6"
            onClick={() => setQrGroup(null)}
          >
            <button
              onClick={() => setQrGroup(null)}
              className="absolute top-6 right-8 text-white/60 hover:text-white text-5xl font-light"
            >
              &times;
            </button>
            <div
              className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 max-w-lg mx-4 cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-black text-gray-900">{qrGroup.name}</h2>
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Scan to join the chain</p>
              <div className="bg-white p-3 rounded-2xl border-2 border-gray-100">
                <QRCodeSVG value={joinUrl} size={380} level="H" />
              </div>
              <p className="text-xs text-gray-400 break-all text-center">{joinUrl}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(joinUrl)
                }}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700"
              >
                Copy link
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}
