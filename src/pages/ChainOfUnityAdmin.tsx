import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { STATION_TEMPLATES } from '../lib/chainStationsTemplate'
import type { ChainSession, ChainGroup, ChainScan, ChainStation } from '../types/database'

interface StationDraft {
  position: number
  title: string
  objective: string
  materials: string
  marshal_role: string
  time_limit_min: number
  pointers: string[] // length 6
  icons: string[]    // length 6
  image_url: string | null
}

const EMPTY_DRAFT: StationDraft = {
  position: 1,
  title: '',
  objective: '',
  materials: '',
  marshal_role: '',
  time_limit_min: 7,
  pointers: ['', '', '', '', '', ''],
  icons: ['', '', '', '', '', ''],
  image_url: null,
}

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

  const [stations, setStations] = useState<ChainStation[]>([])
  const [showStationModal, setShowStationModal] = useState(false)
  const [editingStation, setEditingStation] = useState<ChainStation | null>(null)
  const [stationDraft, setStationDraft] = useState<StationDraft>(EMPTY_DRAFT)
  const [stationImageFile, setStationImageFile] = useState<File | null>(null)
  const [stationImagePreviewUrl, setStationImagePreviewUrl] = useState<string | null>(null)
  const [stationSaving, setStationSaving] = useState(false)
  const [stationError, setStationError] = useState<string | null>(null)
  const [qrStation, setQrStation] = useState<ChainStation | null>(null)
  const [facilitatorMode, setFacilitatorMode] = useState(false)

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

  // ── Stations ──────────────────────────────────────────────────

  const loadStations = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('chain_stations')
      .select('*')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })
    setStations((data ?? []) as ChainStation[])
  }, [])

  useEffect(() => {
    if (!activeSessionId || !isSupabaseConfigured) { setStations([]); return }
    loadStations(activeSessionId)
    const channel = supabase
      .channel(`chain-stations-${activeSessionId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chain_stations', filter: `session_id=eq.${activeSessionId}` },
          () => loadStations(activeSessionId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSessionId, loadStations])

  const openStationModal = (station: ChainStation | null) => {
    setEditingStation(station)
    setStationError(null)
    setStationImageFile(null)
    setStationImagePreviewUrl(null)
    if (station) {
      setStationDraft({
        position: station.position,
        title: station.title,
        objective: station.objective ?? '',
        materials: station.materials ?? '',
        marshal_role: station.marshal_role ?? '',
        time_limit_min: station.time_limit_min ?? 7,
        pointers: [
          station.pointer_1 ?? '',
          station.pointer_2 ?? '',
          station.pointer_3 ?? '',
          station.pointer_4 ?? '',
          station.pointer_5 ?? '',
          station.pointer_6 ?? '',
        ],
        icons: [
          station.icon_1 ?? '',
          station.icon_2 ?? '',
          station.icon_3 ?? '',
          station.icon_4 ?? '',
          station.icon_5 ?? '',
          station.icon_6 ?? '',
        ],
        image_url: station.image_url,
      })
    } else {
      const nextPos = stations.length
        ? Math.max(...stations.map(s => s.position || 0)) + 1
        : 1
      setStationDraft({ ...EMPTY_DRAFT, position: nextPos })
    }
    setShowStationModal(true)
  }

  const closeStationModal = () => {
    setShowStationModal(false)
    setEditingStation(null)
    setStationImageFile(null)
    setStationImagePreviewUrl(null)
    setStationError(null)
  }

  const onStationImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStationImageFile(file)
    setStationDraft(d => ({ ...d, image_url: d.image_url })) // keep existing url until upload
    const reader = new FileReader()
    reader.onload = () => setStationImagePreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearStationImage = () => {
    setStationImageFile(null)
    setStationImagePreviewUrl(null)
    setStationDraft(d => ({ ...d, image_url: null }))
  }

  const uploadStationImage = async (stationId: string, file: File): Promise<string> => {
    const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg'
    const path = `${stationId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('chain-station-images')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('chain-station-images').getPublicUrl(path)
    return data.publicUrl
  }

  const saveStation = async () => {
    if (!activeSessionId) return
    const { position, title, objective, materials, marshal_role, time_limit_min, pointers, icons } = stationDraft
    if (!title.trim() || !Number.isFinite(position)) {
      setStationError('Title and position are required.')
      return
    }
    const trim = (s: string) => (s.trim() ? s.trim() : null)
    const pointerCols = {
      pointer_1: trim(pointers[0]), pointer_2: trim(pointers[1]), pointer_3: trim(pointers[2]),
      pointer_4: trim(pointers[3]), pointer_5: trim(pointers[4]), pointer_6: trim(pointers[5]),
      icon_1: trim(icons[0]), icon_2: trim(icons[1]), icon_3: trim(icons[2]),
      icon_4: trim(icons[3]), icon_5: trim(icons[4]), icon_6: trim(icons[5]),
    }
    const commonFields = {
      position,
      title: title.trim(),
      objective: trim(objective),
      materials: trim(materials),
      marshal_role: trim(marshal_role),
      time_limit_min: Number.isFinite(time_limit_min) ? time_limit_min : 7,
      ...pointerCols,
    }
    setStationError(null)
    setStationSaving(true)
    try {
      let stationId = editingStation?.id ?? null
      let finalImageUrl: string | null = stationDraft.image_url

      if (!stationId) {
        let inserted: ChainStation | null = null
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const code = randomCode(6)
          const { data, error } = await supabase.from('chain_stations').insert({
            session_id: activeSessionId,
            code,
            ...commonFields,
          }).select().single()
          if (!error) { inserted = data as ChainStation; break }
          if (error.code !== '23505') throw error
        }
        if (!inserted) throw new Error('Could not generate a unique station code. Try again.')
        stationId = inserted.id
        if (stationImageFile) {
          finalImageUrl = await uploadStationImage(stationId, stationImageFile)
          await supabase.from('chain_stations').update({ image_url: finalImageUrl }).eq('id', stationId)
        }
      } else {
        if (stationImageFile) {
          finalImageUrl = await uploadStationImage(stationId, stationImageFile)
        }
        const { error } = await supabase.from('chain_stations').update({
          ...commonFields,
          image_url: finalImageUrl,
        }).eq('id', stationId)
        if (error) throw error
      }
      closeStationModal()
      if (activeSessionId) await loadStations(activeSessionId)
    } catch (err) {
      setStationError(err instanceof Error ? err.message : String(err))
    } finally {
      setStationSaving(false)
    }
  }

  const seedStationsFromTemplate = async () => {
    if (!activeSessionId) return
    if (!confirm(`Create ${STATION_TEMPLATES.length} stations from the template (Transfer Balance, Egg Toss, …)? They'll be added to this session — existing stations stay.`)) return
    setStationSaving(true)
    try {
      for (const t of STATION_TEMPLATES) {
        let inserted = false
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const code = randomCode(6)
          const { error } = await supabase.from('chain_stations').insert({
            session_id: activeSessionId,
            code,
            position: t.position,
            title: t.title,
            objective: t.objective,
            materials: t.materials,
            marshal_role: t.marshal_role,
            time_limit_min: t.time_limit_min,
            pointer_1: t.pointers[0] ?? null,
            pointer_2: t.pointers[1] ?? null,
            pointer_3: t.pointers[2] ?? null,
            pointer_4: t.pointers[3] ?? null,
            pointer_5: t.pointers[4] ?? null,
            pointer_6: t.pointers[5] ?? null,
          })
          if (!error) { inserted = true; break }
          if (error.code !== '23505') throw error
        }
        if (!inserted) throw new Error(`Could not seed "${t.title}" — code collision.`)
      }
      await loadStations(activeSessionId)
      setFacilitatorMode(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setStationSaving(false)
    }
  }

  const deleteStation = async (st: ChainStation) => {
    if (!confirm(`Delete station "${st.title}"? Scans recorded against it will be removed too.`)) return
    await supabase.from('chain_stations').delete().eq('id', st.id)
    if (activeSessionId) await loadStations(activeSessionId)
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
            <p className="text-gray-400 text-sm mt-1">Build stations, then open <strong className="text-orange-300">Projector view</strong> to throw the QR grid on a screen — participants scan to join their tribe and read each station's rules.</p>
          </div>
          {activeSessionId && stations.length > 0 && (
            <button
              onClick={() => setFacilitatorMode(true)}
              className="px-5 py-3 bg-orange-500 hover:bg-orange-400 text-black rounded-xl font-black text-base shadow-lg shadow-orange-500/30"
            >
              📺 Projector view
            </button>
          )}
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
                <button
                  onClick={() => setFacilitatorMode(true)}
                  disabled={stations.length === 0}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-white/10 disabled:text-gray-500 text-black rounded-lg font-bold text-sm"
                  title={stations.length === 0 ? 'Add at least one station first' : 'Open the projector QR grid'}
                >
                  📺 Projector view
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

            <section className="bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold">Stations &amp; instructions</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Each station is an activity participants scan into. Title, objective, up to 6 rules — each gets its own QR.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stations.length === 0 && (
                    <button
                      onClick={seedStationsFromTemplate}
                      disabled={stationSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm"
                      title="Pre-fill the 8 stations from the original briefing deck"
                    >
                      ✨ Seed 8 stations
                    </button>
                  )}
                  <button
                    onClick={() => openStationModal(null)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold text-sm"
                  >
                    + Add station
                  </button>
                </div>
              </div>

              {stations.length === 0 ? (
                <div className="border-2 border-dashed border-white/15 rounded-xl py-14 flex flex-col items-center gap-3 text-center">
                  <div className="text-5xl">🗺️</div>
                  <p className="text-gray-300 font-medium">No stations yet</p>
                  <p className="text-xs text-gray-500">Add the first station — typically you'll create 8.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {stations.map(st => (
                    <div key={st.id} className="grid grid-cols-[44px_88px_1fr_auto] gap-4 items-center rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-2xl font-black text-center" style={{ color: ACCENT }}>{st.position}</div>
                      {st.image_url ? (
                        <img src={st.image_url} alt="" className="w-22 h-22 object-cover rounded-lg border border-white/10" style={{ width: 88, height: 88 }} />
                      ) : (
                        <div className="rounded-lg border border-dashed border-white/15 bg-white/5 flex items-center justify-center text-gray-500 text-2xl" style={{ width: 88, height: 88 }}>🖼️</div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-black text-white text-base truncate">{st.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {st.objective || st.body || <span className="italic">No objective yet.</span>}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {[st.pointer_1, st.pointer_2, st.pointer_3, st.pointer_4, st.pointer_5, st.pointer_6].filter(Boolean).length} rules · {st.time_limit_min ?? 7} min
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => setQrStation(st)}
                          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold text-xs"
                        >
                          📱 QR
                        </button>
                        <button
                          onClick={() => openStationModal(st)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteStation(st)}
                          className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 rounded-lg font-bold text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
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

      {qrStation && (() => {
        const scanUrl = `${baseUrl}/chain-of-unity/station/${qrStation.code}`
        return (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer p-6"
            onClick={() => setQrStation(null)}
          >
            <button
              onClick={() => setQrStation(null)}
              className="absolute top-6 right-8 text-white/60 hover:text-white text-5xl font-light"
            >
              &times;
            </button>
            <div
              className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 max-w-lg mx-4 cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-orange-600 text-xs font-bold uppercase tracking-wider">Station {qrStation.position}</p>
              <h2 className="text-2xl font-black text-gray-900 text-center -mt-3">{qrStation.title}</h2>
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Scan for instructions</p>
              <div className="bg-white p-3 rounded-2xl border-2 border-gray-100">
                <QRCodeSVG value={scanUrl} size={380} level="H" />
              </div>
              <p className="text-xs text-gray-400 break-all text-center">{scanUrl}</p>
              <button
                onClick={() => navigator.clipboard.writeText(scanUrl)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700"
              >
                Copy link
              </button>
            </div>
          </div>
        )
      })()}

      {showStationModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-6 overflow-y-auto"
          onClick={closeStationModal}
        >
          <div
            className="bg-gray-900 rounded-2xl border border-white/10 p-6 w-full max-w-2xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">{editingStation ? 'Edit station' : 'New station'}</h2>
              <button onClick={closeStationModal} className="text-white/60 hover:text-white text-3xl font-light">&times;</button>
            </div>

            <div className="grid sm:grid-cols-[80px_1fr_100px] gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Position</label>
                <input
                  type="number"
                  min={1}
                  value={stationDraft.position}
                  onChange={e => setStationDraft(d => ({ ...d, position: parseInt(e.target.value, 10) || 1 }))}
                  className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Title</label>
                <input
                  type="text"
                  value={stationDraft.title}
                  onChange={e => setStationDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. TRANSFER BALANCE"
                  className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Min</label>
                <input
                  type="number"
                  min={1}
                  value={stationDraft.time_limit_min}
                  onChange={e => setStationDraft(d => ({ ...d, time_limit_min: parseInt(e.target.value, 10) || 7 }))}
                  className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Objective <span className="font-normal text-gray-500 normal-case">— one-line goal shown to participants</span></label>
              <textarea
                rows={2}
                value={stationDraft.objective}
                onChange={e => setStationDraft(d => ({ ...d, objective: e.target.value }))}
                placeholder="e.g. Move the water bottle from Point A to Point B on a shared canvas — without dropping it."
                className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Rules <span className="font-normal text-gray-500 normal-case">— up to 6 pointers (blank slots are hidden)</span></label>
              <div className="mt-1 space-y-2">
                {stationDraft.pointers.map((p, i) => (
                  <div key={i} className="grid grid-cols-[36px_60px_1fr] gap-2 items-start">
                    <div className="h-9 rounded-lg bg-orange-500/15 border border-orange-400/30 flex items-center justify-center text-orange-300 font-black text-sm">
                      {i + 1}
                    </div>
                    <input
                      type="text"
                      value={stationDraft.icons[i]}
                      onChange={e => {
                        const v = e.target.value
                        setStationDraft(d => {
                          const icons = [...d.icons]; icons[i] = v
                          return { ...d, icons }
                        })
                      }}
                      placeholder="icon"
                      className="h-9 px-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm text-center"
                    />
                    <textarea
                      rows={1}
                      value={p}
                      onChange={e => {
                        const v = e.target.value
                        setStationDraft(d => {
                          const pointers = [...d.pointers]; pointers[i] = v
                          return { ...d, pointers }
                        })
                      }}
                      placeholder={`Rule ${i + 1}…`}
                      className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm resize-y min-h-[36px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <details className="mb-3 rounded-lg border border-white/10 bg-white/5">
              <summary className="cursor-pointer px-3 py-2 text-xs text-gray-300 uppercase tracking-wider font-bold">
                Marshal-only notes (not shown to participants)
              </summary>
              <div className="p-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Materials</label>
                  <textarea
                    rows={3}
                    value={stationDraft.materials}
                    onChange={e => setStationDraft(d => ({ ...d, materials: e.target.value }))}
                    placeholder="One item per line"
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Your role (marshal)</label>
                  <textarea
                    rows={4}
                    value={stationDraft.marshal_role}
                    onChange={e => setStationDraft(d => ({ ...d, marshal_role: e.target.value }))}
                    placeholder="What the marshal needs to do at this station"
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm"
                  />
                </div>
              </div>
            </details>

            <div className="mb-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Image <span className="font-normal text-gray-500 normal-case">— optional</span></label>
              <div className="mt-1 p-4 border-2 border-dashed border-white/15 rounded-xl text-center">
                {(stationImagePreviewUrl || stationDraft.image_url) ? (
                  <img
                    src={stationImagePreviewUrl ?? stationDraft.image_url ?? ''}
                    alt=""
                    className="max-h-52 mx-auto rounded-lg mb-3"
                  />
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No image yet.</p>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  <label className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs cursor-pointer">
                    Choose image
                    <input type="file" accept="image/*" className="hidden" onChange={onStationImageChange} />
                  </label>
                  {(stationImagePreviewUrl || stationDraft.image_url) && (
                    <button type="button" onClick={clearStationImage} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs">
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </div>

            {stationError && <p className="text-rose-300 text-sm mb-3">{stationError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={closeStationModal}
                disabled={stationSaving}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveStation}
                disabled={stationSaving}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold text-sm disabled:opacity-50"
              >
                {stationSaving ? 'Saving…' : 'Save station'}
              </button>
            </div>
          </div>
        </div>
      )}

      {facilitatorMode && (
        <div className="fixed inset-0 bg-gray-950 z-40 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-xs text-orange-300 uppercase tracking-wider font-bold">Projector view</p>
                <h1 className="text-2xl font-black">{activeSession?.title}</h1>
                <p className="text-gray-400 text-sm mt-0.5">Tap a station to show its QR fullscreen.</p>
              </div>
              <button
                onClick={() => setFacilitatorMode(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm"
              >
                ← Back to admin
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stations.map(st => (
                <button
                  key={st.id}
                  onClick={() => setQrStation(st)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:border-orange-400/60 hover:bg-white/10 transition overflow-hidden flex flex-col text-left"
                >
                  {st.image_url ? (
                    <img src={st.image_url} alt="" className="w-full aspect-[16/10] object-cover" />
                  ) : (
                    <div className="w-full aspect-[16/10] bg-gradient-to-br from-orange-500/30 to-rose-500/20" />
                  )}
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wider font-bold" style={{ color: ACCENT }}>Station {st.position}</p>
                    <h3 className="text-base font-black mt-1">{st.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">Tap for QR →</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
