import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useBingoAuth } from '../hooks/useBingoAuth'
import type { BingoAccount, BingoSection, BingoFacilitatorSession } from '../types/database'

const STATUS_STYLES: Record<BingoAccount['status'], string> = {
  pending:  'bg-amber-400/15 text-amber-300 border-amber-400/40',
  approved: 'bg-green-400/15 text-green-300 border-green-400/40',
  rejected: 'bg-red-400/15 text-red-300 border-red-400/40',
}

const FACILITATOR_DURATIONS = [
  { label: '4 hours',  hours: 4 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
  { label: '7 days',   hours: 168 },
]

const fmtExpiry = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

/** How long a crew pass stays open. Most events fit inside a working day. */
const SESSION_DURATIONS = [
  { label: '4 hours',  hours: 4 },
  { label: '8 hours',  hours: 8 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '2 days',   hours: 48 },
]

const crewUrl = (code: string) => `${window.location.origin}/bingo-dash/join-crew/${code}`

/** One paste into the crew's WhatsApp group — link and PIN travel together. */
const shareText = (s: BingoFacilitatorSession) =>
  `${s.label} — facilitator access\n${crewUrl(s.code)}\nPIN: ${s.pin}\n\nOpen the link, enter your name and the PIN. Access ends ${fmtExpiry(s.expires_at)}.`

function CopyButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={className || 'px-3 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-colors flex-shrink-0'}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function GameToggle({ label, on, busy, onToggle }: {
  label: string; on: boolean; busy: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle} disabled={busy}
      className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors disabled:opacity-50 ${
        on
          ? 'bg-green-400/15 text-green-300 border-green-400/40 hover:bg-green-400/25'
          : 'bg-white/5 text-gray-500 border-white/15 hover:bg-white/10'
      }`}>
      {label} {on ? 'ON' : 'OFF'}
    </button>
  )
}

export function BingoDashAccounts() {
  const navigate = useNavigate()
  const { account: me } = useBingoAuth()
  const [accounts, setAccounts] = useState<BingoAccount[]>([])
  const [boards, setBoards] = useState<BingoSection[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)
  // "Make facilitator" inline form: which row it's open on + its inputs
  const [facForId, setFacForId] = useState<string | null>(null)
  const [facHost, setFacHost] = useState('')
  const [facHours, setFacHours] = useState(24)
  const inviteUrl = `${window.location.origin}/bingo-dash/login`
  // Crew passes: one shareable link + PIN per event
  const [sessions, setSessions] = useState<BingoFacilitatorSession[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newHost, setNewHost] = useState('')
  const [newHours, setNewHours] = useState(12)
  const [newSeats, setNewSeats] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const [accountsRes, boardsRes, settingsRes, sessionsRes] = await Promise.all([
      supabase.from('bingo_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('bingo_sections').select('*').is('owner_id', null).order('sort_order'),
      supabase.from('bingo_settings').select('template_section_id').eq('id', 'main').maybeSingle(),
      supabase.from('bingo_facilitator_sessions').select('*').order('created_at', { ascending: false }),
    ])
    if (accountsRes.data) setAccounts(accountsRes.data as BingoAccount[])
    if (boardsRes.data) setBoards(boardsRes.data as BingoSection[])
    if (settingsRes.data) setTemplateId(settingsRes.data.template_section_id ?? null)
    if (sessionsRes.data) setSessions(sessionsRes.data as BingoFacilitatorSession[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('bingo-accounts-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_accounts' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const setStatus = async (id: string, status: BingoAccount['status']) => {
    if (status === 'approved' && !templateId) {
      setNotice('Heads up: no template board is set — this account will start without a default board. Pick a template below, then use "Give default board".')
    }
    setBusyId(id)
    try {
      await supabase.from('bingo_accounts').update({ status }).eq('id', id)
      await load()
    } finally { setBusyId(null) }
  }

  const toggleGame = async (a: BingoAccount, field: 'can_bingo' | 'can_flag') => {
    setBusyId(a.id)
    try {
      await supabase.from('bingo_accounts').update({ [field]: !a[field] }).eq('id', a.id)
      await load()
    } finally { setBusyId(null) }
  }

  const saveTemplate = async (sectionId: string) => {
    const value = sectionId || null
    setTemplateId(value)
    await supabase.from('bingo_settings').update({ template_section_id: value }).eq('id', 'main')
  }

  const provision = async (a: BingoAccount) => {
    if (!templateId) {
      setNotice('Pick a template board first.')
      return
    }
    setBusyId(a.id)
    setNotice('')
    try {
      const { error } = await supabase.rpc('admin_clone_template_for', { p_target: a.id })
      if (error) throw error
      setNotice(`Gave ${a.email ?? 'account'} a fresh copy of the template board.`)
    } catch (err) {
      setNotice(err instanceof Error ? `Could not clone board: ${err.message}` : 'Could not clone board')
    } finally { setBusyId(null) }
  }

  const makeFacilitator = async (a: BingoAccount) => {
    if (!facHost) { setNotice('Pick whose event this facilitator is helping with.'); return }
    setBusyId(a.id)
    setNotice('')
    try {
      const expires = new Date(Date.now() + facHours * 3600_000).toISOString()
      const { error } = await supabase.from('bingo_accounts').update({
        facilitator_host: facHost,
        access_expires_at: expires,
        status: 'approved',
        can_bingo: true,
        can_flag: true,
      }).eq('id', a.id)
      if (error) throw error
      setFacForId(null)
      setNotice(`${a.email ?? 'Account'} is now a facilitator until ${fmtExpiry(expires)}.`)
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? `Could not grant facilitator access: ${err.message}` : 'Could not grant facilitator access')
    } finally { setBusyId(null) }
  }

  const endFacilitatorAccess = async (a: BingoAccount) => {
    setBusyId(a.id)
    try {
      await supabase.from('bingo_accounts').update({ access_expires_at: new Date().toISOString() }).eq('id', a.id)
      await load()
    } finally { setBusyId(null) }
  }

  const createSession = async () => {
    setCreating(true)
    setNotice('')
    try {
      const seats = Number(newSeats)
      const { error } = await supabase.rpc('create_facilitator_session', {
        p_label: newLabel.trim() || 'Event session',
        p_host: newHost || me?.id,
        p_hours: newHours,
        p_max_uses: Number.isFinite(seats) && seats > 0 ? seats : null,
      })
      if (error) throw error
      setNewLabel(''); setNewSeats('')
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? `Could not create session: ${err.message}` : 'Could not create session')
    } finally { setCreating(false) }
  }

  const endSession = async (s: BingoFacilitatorSession) => {
    setBusyId(s.id)
    setNotice('')
    try {
      const { error } = await supabase.rpc('end_facilitator_session', { p_id: s.id })
      if (error) throw error
      setNotice(`"${s.label}" closed — every facilitator on that pass has been signed out of your boards.`)
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? `Could not end session: ${err.message}` : 'Could not end session')
    } finally { setBusyId(null) }
  }

  const deleteSession = async (s: BingoFacilitatorSession) => {
    setBusyId(s.id)
    try {
      await supabase.from('bingo_facilitator_sessions').delete().eq('id', s.id)
      await load()
    } finally { setBusyId(null) }
  }

  const removeFacilitator = async (a: BingoAccount) => {
    setBusyId(a.id)
    try {
      await supabase.from('bingo_accounts').update({ facilitator_host: null, access_expires_at: null }).eq('id', a.id)
      await load()
    } finally { setBusyId(null) }
  }

  // Crew who joined through a pass are listed as chips under their session,
  // so keep them out of the account lists — a busy event would otherwise bury
  // real client accounts under a dozen anonymous logins.
  const standalone = accounts.filter(a => !a.facilitator_session_id)
  const pending = standalone.filter(a => a.status === 'pending')
  const others = standalone.filter(a => a.status !== 'pending')
  // Accounts a facilitator can assist: you (the owner) or any approved,
  // non-facilitator sub (renters running their own events).
  const hostOptions = accounts.filter(a =>
    a.role === 'owner' || (a.status === 'approved' && !a.facilitator_host))

  const Row = ({ a }: { a: BingoAccount }) => {
    const isFac = !!a.facilitator_host
    const facExpired = !!a.access_expires_at && new Date(a.access_expires_at).getTime() <= Date.now()
    const hostEmail = accounts.find(x => x.id === a.facilitator_host)?.email ?? 'unknown host'
    return (
    <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">{a.display_name ?? a.email ?? a.id}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>
              {a.status}
            </span>
            {a.role === 'owner' && (
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-purple-400/15 text-purple-300 border-purple-400/40">
                owner
              </span>
            )}
            {isFac && (
              <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                facExpired
                  ? 'bg-red-400/15 text-red-300 border-red-400/40'
                  : 'bg-sky-400/15 text-sky-300 border-sky-400/40'
              }`}>
                facilitator
              </span>
            )}
            {a.id === me?.id && <span className="text-[11px] text-gray-500">you</span>}
          </div>
        </div>
        {a.role !== 'owner' && (
          <div className="flex gap-2 flex-shrink-0">
            {!isFac && a.status !== 'approved' && (
              <button onClick={() => { setFacForId(facForId === a.id ? null : a.id); setFacHost(me?.id ?? ''); setFacHours(24) }}
                title="Grant temporary helper access instead of a full account (no board clone)"
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-300 border border-sky-400/40 hover:bg-sky-400/10 transition-colors">
                Make facilitator
              </button>
            )}
            {a.status !== 'approved' && (
              <button onClick={() => setStatus(a.id, 'approved')} disabled={busyId === a.id}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50">
                Approve
              </button>
            )}
            {a.status !== 'rejected' && (
              <button onClick={() => setStatus(a.id, 'rejected')} disabled={busyId === a.id}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-white/10 hover:bg-red-500/80 text-white transition-colors disabled:opacity-50">
                {a.status === 'approved' ? 'Revoke' : 'Reject'}
              </button>
            )}
          </div>
        )}
      </div>
      {isFac && (
        <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
          <span className="text-xs text-gray-400 min-w-0 truncate">
            Assisting <span className="text-white font-bold">{hostEmail}</span>
            {a.access_expires_at && (
              <span className={facExpired ? 'text-red-300' : ''}>
                {' '}· {facExpired ? 'expired' : 'expires'} {fmtExpiry(a.access_expires_at)}
              </span>
            )}
          </span>
          <div className="flex gap-2 ml-auto flex-shrink-0">
            {!facExpired && (
              <button onClick={() => endFacilitatorAccess(a)} disabled={busyId === a.id}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-white/10 hover:bg-red-500/80 text-white transition-colors disabled:opacity-50">
                End access now
              </button>
            )}
            <button onClick={() => removeFacilitator(a)} disabled={busyId === a.id}
              title="Turn this back into a normal account (no host, no expiry)"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50">
              Remove facilitator
            </button>
          </div>
        </div>
      )}
      {!isFac && a.role !== 'owner' && a.status === 'approved' && (
        <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
          <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mr-1">Games:</span>
          <GameToggle label="Bingo Dash" on={a.can_bingo} busy={busyId === a.id} onToggle={() => toggleGame(a, 'can_bingo')} />
          <GameToggle label="Flag Retrieval" on={a.can_flag} busy={busyId === a.id} onToggle={() => toggleGame(a, 'can_flag')} />
          <div className="flex gap-2 ml-auto">
            <button onClick={() => { setFacForId(facForId === a.id ? null : a.id); setFacHost(me?.id ?? ''); setFacHours(24) }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-300 border border-sky-400/40 hover:bg-sky-400/10 transition-colors">
              Make facilitator
            </button>
            <button onClick={() => provision(a)} disabled={busyId === a.id || !templateId}
              title={templateId ? 'Clone the template board into this account' : 'Pick a template board first'}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-40">
              Give default board
            </button>
          </div>
        </div>
      )}
      {!isFac && a.role !== 'owner' && facForId === a.id && (
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
            Temporary event helper — edits the host's boards, auto-expires
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={facHost} onChange={e => setFacHost(e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm focus:border-sky-500 outline-none transition-colors">
              {hostOptions.filter(h => h.id !== a.id).map(h => (
                <option key={h.id} value={h.id}>
                  {h.role === 'owner' ? `You (${h.email ?? 'main account'})` : h.email ?? h.id}
                </option>
              ))}
            </select>
            <select value={facHours} onChange={e => setFacHours(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm focus:border-sky-500 outline-none transition-colors">
              {FACILITATOR_DURATIONS.map(d => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            </select>
            <button onClick={() => makeFacilitator(a)} disabled={busyId === a.id || !facHost}
              className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50">
              Grant access
            </button>
            <button onClick={() => setFacForId(null)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white/60 hover:bg-white/10 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-purple-400 text-xs font-black uppercase tracking-[0.3em]">Bingo Dash</p>
            <h1 className="text-white text-4xl font-black tracking-tight mt-1">Accounts</h1>
          </div>
          <button onClick={() => navigate('/bingo-dash/admin')}
            className="px-4 py-2 rounded-2xl text-white/80 font-bold text-sm border border-white/20 hover:bg-white/10 transition-colors">
            ← Admin
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 animate-pulse">Loading…</p>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="px-4 py-4 rounded-2xl bg-sky-400/5 border border-sky-400/20">
              <h2 className="text-white text-sm font-black uppercase tracking-widest mb-2">
                🎪 Facilitator sessions
              </h2>
              <p className="text-gray-400 text-xs mb-4">
                For <b className="text-gray-300">your own crew</b>. Create a pass, send the link + PIN to the group,
                and everyone lands on <b className="text-gray-300">your</b> boards — same teams, same scoreboard.
                No sign-up, no approval, and access dies on its own when the pass expires.
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <input
                  value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="Event name (e.g. Nestlé KL — 15 Aug)"
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm placeholder-white/25 focus:border-sky-500 outline-none transition-colors"
                />
                <select value={newHours} onChange={e => setNewHours(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm focus:border-sky-500 outline-none transition-colors">
                  {SESSION_DURATIONS.map(d => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                </select>
                <input
                  value={newSeats} onChange={e => setNewSeats(e.target.value.replace(/\D/g, ''))}
                  placeholder="Seats" inputMode="numeric"
                  title="Maximum facilitators — leave blank for unlimited"
                  className="w-20 px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm placeholder-white/25 focus:border-sky-500 outline-none transition-colors"
                />
                {hostOptions.length > 1 && (
                  <select value={newHost || me?.id || ''} onChange={e => setNewHost(e.target.value)}
                    title="Whose boards this crew works on"
                    className="px-3 py-2 rounded-xl bg-black/30 border-2 border-white/15 text-white text-sm focus:border-sky-500 outline-none transition-colors">
                    {hostOptions.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.role === 'owner' ? 'My boards' : h.email ?? h.id}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={createSession} disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : '+ New session'}
                </button>
              </div>

              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">No sessions yet — create one before your next event.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sessions.map(s => {
                    const crew = accounts.filter(a => a.facilitator_session_id === s.id)
                    const dead = s.revoked || new Date(s.expires_at).getTime() <= Date.now()
                    const hostName = accounts.find(a => a.id === s.host_id)
                    return (
                      <div key={s.id} className={`px-4 py-3 rounded-2xl border ${
                        dead ? 'bg-white/[0.02] border-white/10 opacity-60' : 'bg-black/20 border-sky-400/25'
                      }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm">{s.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {dead
                                ? <span className="text-red-300">{s.revoked ? 'Closed' : 'Expired'} · {fmtExpiry(s.expires_at)}</span>
                                : <>Ends {fmtExpiry(s.expires_at)}</>}
                              {' · '}{s.uses}{s.max_uses ? `/${s.max_uses}` : ''} joined
                              {hostOptions.length > 1 && hostName?.role !== 'owner' && <> · for {hostName?.email}</>}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {!dead && (
                              <>
                                <CopyButton text={shareText(s)} label="Copy invite" />
                                <button onClick={() => endSession(s)} disabled={busyId === s.id}
                                  title="Close the pass and immediately sign out everyone who joined it"
                                  className="px-3 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-red-500/80 text-white transition-colors disabled:opacity-50">
                                  End session
                                </button>
                              </>
                            )}
                            {dead && (
                              <button onClick={() => deleteSession(s)} disabled={busyId === s.id}
                                className="px-3 py-2 rounded-xl text-xs font-bold text-white/60 border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50">
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {!dead && (
                          <div className="flex items-center gap-2 mt-3">
                            <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-gray-300 text-xs">
                              {crewUrl(s.code)}
                            </code>
                            <div className="px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 flex-shrink-0">
                              <span className="text-[10px] text-amber-200/70 font-black uppercase tracking-wider">PIN </span>
                              <span className="text-amber-200 font-black tracking-[0.2em] text-sm">{s.pin}</span>
                            </div>
                          </div>
                        )}

                        {crew.length > 0 && (
                          <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/10">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mr-1">Crew:</span>
                            {crew.map(c => (
                              <span key={c.id} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-gray-300 border border-white/10">
                                {c.display_name || c.email || 'guest'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="px-4 py-4 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-white text-sm font-black uppercase tracking-widest mb-2">Client sign-up link</h2>
              <p className="text-gray-500 text-xs mb-3">
                For a <b className="text-gray-400">client renting the app</b>, not your crew — this gives them their own
                separate boards. They sign up with email or Google, then appear under Pending for your approval.
                Approving here does <b className="text-gray-400">not</b> let them see your event.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate px-4 py-3 rounded-2xl bg-black/30 border-2 border-white/15 text-gray-300 text-sm">
                  {inviteUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl)
                    setCopiedInvite(true)
                    setTimeout(() => setCopiedInvite(false), 1500)
                  }}
                  className="px-4 py-3 rounded-2xl text-sm font-black bg-purple-600 hover:bg-purple-500 text-white transition-colors flex-shrink-0">
                  {copiedInvite ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </section>

            <section className="px-4 py-4 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-white text-sm font-black uppercase tracking-widest mb-2">Default board template</h2>
              <p className="text-gray-500 text-xs mb-3">
                New accounts get an independent copy of this board (cards, instructions, photos and links included) the moment you approve them.
              </p>
              <select
                value={templateId ?? ''}
                onChange={e => saveTemplate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-black/30 border-2 border-white/15 text-white focus:border-purple-500 outline-none transition-colors">
                <option value="">— No template (accounts start empty) —</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </section>

            {notice && <p className="text-amber-300 text-sm font-medium">{notice}</p>}

            <section>
              <h2 className="text-white text-sm font-black uppercase tracking-widest mb-3">
                Pending {pending.length > 0 && <span className="text-amber-400">({pending.length})</span>}
              </h2>
              {pending.length === 0
                ? <p className="text-gray-500 text-sm">No one is waiting for approval.</p>
                : <div className="flex flex-col gap-2">{pending.map(a => <Row key={a.id} a={a} />)}</div>}
            </section>
            <section>
              <h2 className="text-white text-sm font-black uppercase tracking-widest mb-3">All accounts</h2>
              <div className="flex flex-col gap-2">{others.map(a => <Row key={a.id} a={a} />)}</div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
