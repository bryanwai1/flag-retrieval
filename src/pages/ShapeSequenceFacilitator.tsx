import { useState, useEffect } from 'react'
import { useShapeSequence } from '../hooks/useShapeSequence'
import { formatTime } from './ShapeSequenceProjector'

// ── Flag Retrieval answer data ────────────────────────────────────────────────
const ORANGE_ANSWERS = [
  { qty: 4,    item: 'Visa card' },
  { qty: 3,    item: 'Waist belt' },
  { qty: 5,    item: 'Grey hair' },
  { qty: 1,    item: 'Lipstick' },
  { qty: 1,    item: 'Physical photo of a loved one' },
  { qty: null, item: 'Malaysia bank note with at least one "8" in the number' },
  { qty: null, item: "Tie a coconut hair to one member's hair" },
]
const GREEN_ANSWERS = [
  'Red shoe', 'Battery', 'Ball', 'Belt', 'Umbrella',
  'White cap', 'Yellow shirt', 'Wet tissue', 'Water bottle', 'Toy',
]

function FlagRetrievalAnswers({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'orange' | 'green'>('orange')
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col px-4 pt-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="text-white/30 hover:text-white text-sm transition-colors">← Back</button>
        <h1 className="text-white font-black text-base tracking-tight">🚩 Flag Retrieval — Faci</h1>
        <div className="w-12" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('orange')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-wider transition-all ${
            tab === 'orange' ? 'bg-orange-500 text-white' : 'bg-white/8 text-white/40 hover:text-white'
          }`}
        >
          🟠 Orange Card
        </button>
        <button
          onClick={() => setTab('green')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-wider transition-all ${
            tab === 'green' ? 'bg-green-500 text-white' : 'bg-white/8 text-white/40 hover:text-white'
          }`}
        >
          🟢 Green Flag
        </button>
      </div>

      {tab === 'orange' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-1">Acceptance checklist — verify all before marking done</p>
          {ORANGE_ANSWERS.map((a, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3.5 border border-orange-500/15">
              <span className="font-black text-orange-500/50 w-5 text-right shrink-0 text-sm">{i + 1}</span>
              <span className="text-white font-bold flex-1 text-sm">{a.item}</span>
              {a.qty !== null && (
                <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-black">×{a.qty}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'green' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-1">Items to collect — 10 total</p>
          {GREEN_ANSWERS.map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3.5 border border-green-500/15">
              <span className="font-black text-green-500/50 w-5 text-right shrink-0 text-sm">{i + 1}</span>
              <span className="text-white font-bold flex-1 text-sm">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const FAC_NUM_KEY    = 'ss_facilitator_num'
const FAC_GROUPS_KEY = 'ss_facilitator_groups' // per-faci: key + '_' + facNum

function loadGroups(facNum: number): string[] {
  try { return JSON.parse(localStorage.getItem(`${FAC_GROUPS_KEY}_${facNum}`) ?? '[]') } catch { return [] }
}

export function ShapeSequenceFacilitator() {
  const { rounds, results, facilitators, addFacilitator, addResult } = useShapeSequence()

  // ── Game selection ────────────────────────────────────────────────────────
  const [game, setGame] = useState<'select' | 'flag' | 'shape'>('select')

  if (game === 'flag') return <FlagRetrievalAnswers onBack={() => setGame('select')} />

  // ── Facilitator identity ──────────────────────────────────────────────────
  const [facNum, setFacNum] = useState<number | null>(() => {
    const s = localStorage.getItem(FAC_NUM_KEY)
    return s ? parseInt(s) : null
  })
  const [shownCount, setShownCount] = useState(6)

  // ── Groups this facilitator manages ──────────────────────────────────────
  const [myGroups, setMyGroups] = useState<string[]>(() => {
    const s = localStorage.getItem(FAC_NUM_KEY)
    return s ? loadGroups(parseInt(s)) : []
  })
  const [showPicker, setShowPicker]     = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroup, setAddingGroup]   = useState(false)

  // ── Per-group time submission state ───────────────────────────────────────
  const [timeInputs,   setTimeInputs]   = useState<Record<string, string>>({})
  const [submitting,   setSubmitting]   = useState<Record<string, boolean>>({})
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({})

  const activeRound     = rounds.find(r => r.is_active)
  const collectingRound = rounds.find(r => r.accepting_submissions)
  const currentRound    = collectingRound ?? activeRound

  // Reset time inputs when round changes
  useEffect(() => {
    setTimeInputs({})
    setSubmitErrors({})
  }, [currentRound?.id])

  // Persist group list to per-faci localStorage key
  useEffect(() => {
    if (facNum !== null) {
      localStorage.setItem(`${FAC_GROUPS_KEY}_${facNum}`, JSON.stringify(myGroups))
    }
  }, [myGroups, facNum])

  // ── Sign in / out ─────────────────────────────────────────────────────────
  const signIn = (n: number) => {
    localStorage.setItem(FAC_NUM_KEY, String(n))
    setFacNum(n)
    setMyGroups(loadGroups(n))
  }
  const signOut = () => {
    localStorage.removeItem(FAC_NUM_KEY)
    setFacNum(null)
    setMyGroups([])
  }

  // ── Group management ──────────────────────────────────────────────────────
  const addGroup = async (name: string) => {
    if (myGroups.includes(name)) { setShowPicker(false); return }
    // Insert to DB if this group isn't already owned by this faci
    const ownedByMe = facilitators.some(
      f => f.group_name.toLowerCase() === name.toLowerCase() && f.facilitator_num === facNum
    )
    if (!ownedByMe) {
      setAddingGroup(true)
      try { await addFacilitator(name, facNum ?? undefined) } catch { /* name collision — already exists */ } finally { setAddingGroup(false) }
    }
    setMyGroups(prev => [...prev, name])
    setShowPicker(false)
    setNewGroupName('')
  }

  // Re-sync myGroups to DB whenever facilitators list loads (handles DB resets)
  useEffect(() => {
    if (facNum === null || myGroups.length === 0 || facilitators.length === 0) return
    myGroups.forEach(name => {
      const ownedByMe = facilitators.some(
        f => f.group_name.toLowerCase() === name.toLowerCase() && f.facilitator_num === facNum
      )
      if (!ownedByMe) {
        // Check if name exists at all — if not, insert
        const existsAnywhere = facilitators.some(f => f.group_name.toLowerCase() === name.toLowerCase())
        if (!existsAnywhere) {
          addFacilitator(name, facNum).catch(() => {/* ignore */})
        }
      }
    })
  }, [facilitators]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeGroup = (name: string) => setMyGroups(prev => prev.filter(g => g !== name))

  // ── Time submission ───────────────────────────────────────────────────────
  const setGroupTime = (group: string, val: string) => {
    setTimeInputs(p => ({ ...p, [group]: val }))
    setSubmitErrors(p => ({ ...p, [group]: '' }))
  }

  const submitTime = async (group: string) => {
    if (!currentRound) return
    const secs = parseFloat(timeInputs[group] ?? '')
    if (isNaN(secs) || secs <= 0) {
      setSubmitErrors(p => ({ ...p, [group]: 'Enter a valid time in seconds (e.g. 83.4)' }))
      return
    }
    setSubmitting(p => ({ ...p, [group]: true }))
    try {
      await addResult(currentRound.id, group, secs)
    } catch {
      setSubmitErrors(p => ({ ...p, [group]: 'Failed to submit. Try again.' }))
    } finally {
      setSubmitting(p => ({ ...p, [group]: false }))
    }
  }

  // ── GAME SELECT SCREEN ───────────────────────────────────────────────────
  if (game === 'select') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          <div className="text-center">
            <div className="text-5xl mb-4">🎮</div>
            <h1 className="text-3xl font-black text-white tracking-tight">FACILITATOR</h1>
            <p className="text-white/40 mt-2 text-xs font-bold uppercase tracking-widest">Which game are you running?</p>
          </div>
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setGame('flag')}
              className="w-full py-5 rounded-2xl font-black text-white text-lg tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}
            >
              <span className="text-2xl">🚩</span> Flag Retrieval
            </button>
            <button
              onClick={() => setGame('shape')}
              className="w-full py-5 rounded-2xl font-black text-white text-lg tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}
            >
              <span className="text-2xl">🔷</span> Shape Sequence
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (facNum === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">

          <div className="text-center">
            <div className="text-5xl mb-4">🔷</div>
            <h1 className="text-3xl font-black text-white tracking-tight">SHAPE SEQUENCE</h1>
            <p className="text-white/40 mt-2 text-xs font-bold uppercase tracking-widest">Who are you?</p>
          </div>

          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-4">
              Select your facilitator number:
            </p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {Array.from({ length: shownCount }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => signIn(n)}
                  className="flex flex-col items-center justify-center gap-1 py-5 rounded-2xl font-black text-white transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{
                    background: 'rgba(59,130,246,0.1)',
                    border: '2px solid rgba(59,130,246,0.2)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#3b82f6'
                    e.currentTarget.style.border = '2px solid #3b82f6'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.1)'
                    e.currentTarget.style.border = '2px solid rgba(59,130,246,0.2)'
                  }}
                >
                  <span className="text-3xl font-black leading-none">{n}</span>
                  <span className="text-xs text-white/50 font-semibold">Facilitator</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShownCount(c => c + 3)}
              className="w-full py-3 rounded-xl text-white/25 hover:text-white/50 text-xs font-bold border-2 border-dashed border-white/8 hover:border-white/20 transition-colors"
            >
              + Show more facilitators
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ── MAIN SCREEN ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 px-4 pt-6 pb-10">
      <div className="max-w-sm mx-auto flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">🔷 SHAPE SEQUENCE</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/30 uppercase tracking-wider font-bold">Signed in as</span>
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
              >
                Facilitator {facNum}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-white/20 hover:text-white/50 text-xs transition-colors mt-1"
          >
            Change
          </button>
        </div>

        {/* Round status banner */}
        {activeRound && !collectingRound && <RoundRunning roundNumber={activeRound.round_number} />}
        {collectingRound && (
          <div
            className="w-full rounded-xl px-4 py-2.5 text-center text-sm font-black uppercase tracking-wider"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
          >
            ⏱ Round {collectingRound.round_number} — Enter times below
          </div>
        )}
        {!activeRound && !collectingRound && <Standby />}

        {/* My Groups */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider">My Groups</span>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
            >
              {myGroups.length}
            </span>
          </div>

          {myGroups.length === 0 && (
            <p className="text-white/25 text-sm text-center py-4">
              No groups added yet — tap below.
            </p>
          )}

          {myGroups.map(group => {
            const submitted = currentRound
              ? results.some(r => r.round_id === currentRound.id && r.team_name === group)
              : false
            const myResult = currentRound
              ? results.find(r => r.round_id === currentRound.id && r.team_name === group)
              : null

            return (
              <div
                key={group}
                className="rounded-xl p-3 flex flex-col gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {/* Group header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 text-xs">🔷</span>
                    <span className="text-white font-black text-sm">{group}</span>
                  </div>
                  {!submitted && (
                    <button
                      onClick={() => removeGroup(group)}
                      className="text-white/20 hover:text-red-400 text-xl leading-none transition-colors w-6 h-6 flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Time input when round is active or collecting */}
                {currentRound && !submitted && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Time in seconds (e.g. 83.4)"
                      value={timeInputs[group] ?? ''}
                      onChange={e => setGroupTime(group, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitTime(group)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-yellow-400/25 text-white text-lg font-black text-center focus:outline-none focus:border-yellow-400 transition-colors placeholder-white/15"
                    />
                    {submitErrors[group] && (
                      <p className="text-red-400 text-xs text-center">{submitErrors[group]}</p>
                    )}
                    <button
                      onClick={() => submitTime(group)}
                      disabled={submitting[group] || !timeInputs[group]?.trim()}
                      className="w-full py-2.5 rounded-xl font-black text-gray-900 text-sm transition-all active:scale-95 disabled:opacity-40"
                      style={{
                        background: submitting[group]
                          ? '#9ca3af'
                          : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      }}
                    >
                      {submitting[group] ? 'Submitting…' : `✓ Submit for ${group}`}
                    </button>
                  </div>
                )}

                {/* Already submitted */}
                {currentRound && submitted && myResult && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}
                  >
                    <span>✓ Submitted:</span>
                    <span className="font-black tabular-nums">{formatTime(myResult.completion_time)}</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add Group button */}
          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-3 rounded-xl text-sm font-bold transition-colors"
            style={{
              color: '#60a5fa',
              border: '2px dashed rgba(59,130,246,0.25)',
              background: 'rgba(59,130,246,0.05)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
              e.currentTarget.style.background = 'rgba(59,130,246,0.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'
              e.currentTarget.style.background = 'rgba(59,130,246,0.05)'
            }}
          >
            + Add Group
          </button>
        </div>

      </div>

      {/* ── Group Picker Modal ── */}
      {showPicker && (
        <div
          className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowPicker(false) }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '70vh' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-white font-black text-base">Select Group</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="text-white/30 hover:text-white text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-2 p-4 overflow-y-auto">
              {/* Existing groups not yet added, belonging to this facilitator */}
              {facilitators
                .filter(f => f.facilitator_num === facNum && !myGroups.includes(f.group_name))
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => addGroup(f.group_name)}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-white font-bold text-sm transition-all active:scale-98"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  >
                    <span>🔷</span>
                    <span>{f.group_name}</span>
                  </button>
                ))}

              {facilitators.filter(f => f.facilitator_num === facNum && !myGroups.includes(f.group_name)).length === 0 && (
                <p className="text-white/25 text-xs text-center py-2">No existing groups — create one below.</p>
              )}

              {/* New group */}
              <div className="flex gap-2 pt-1 border-t border-white/8 mt-1">
                <input
                  type="text"
                  placeholder="New group name…"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGroup(newGroupName.trim())}
                  className="flex-1 px-3 py-2.5 rounded-xl text-white text-sm font-bold placeholder-white/20 focus:outline-none focus:border-blue-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  autoFocus
                />
                <button
                  onClick={() => addGroup(newGroupName.trim())}
                  disabled={addingGroup || !newGroupName.trim()}
                  className="px-4 py-2.5 rounded-xl font-black text-white text-sm disabled:opacity-40 transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                >
                  {addingGroup ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Standby() {
  return (
    <div
      className="w-full rounded-2xl p-8 text-center flex flex-col items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-4xl animate-pulse">⏳</div>
      <p className="text-white/50 font-bold">Waiting for round to start…</p>
      <p className="text-white/25 text-sm">The admin will activate a round soon.</p>
    </div>
  )
}

function RoundRunning({ roundNumber }: { roundNumber: number }) {
  return (
    <div
      className="w-full rounded-2xl p-6 text-center flex flex-col items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))',
        border: '2px solid rgba(59,130,246,0.25)',
      }}
    >
      <div className="text-4xl">🏃</div>
      <div>
        <p className="text-blue-300 font-black text-lg uppercase tracking-wider">Round {roundNumber} In Progress…</p>
        <p className="text-white/35 text-sm mt-1">Time your groups — enter and submit times below anytime.</p>
      </div>
      <div className="flex gap-1 mt-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
