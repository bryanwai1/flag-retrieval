import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useShapeSequence, type Shape, type ShapeRound } from '../hooks/useShapeSequence'
import {
  ShapeIcon,
  SHAPE_CYCLE,
  SHAPE_COLORS,
  padShapes,
  formatTime,
} from './ShapeSequenceProjector'

const ROUND_COUNT = 3

export function ShapeSequenceAdmin() {
  const {
    rounds, results, facilitators,
    upsertRound, setActiveRound, endRound,
    setAllResultsVisible,
    addResult, deleteResult, clearRoundResults,
    addFacilitator, renameFacilitator, deleteFacilitator,
  } = useShapeSequence()

  const [selectedRound, setSelectedRound] = useState(1)
  const [localShapes, setLocalShapes] = useState<Shape[]>(Array(20).fill('circle'))
  const [localCircleCount, setLocalCircleCount] = useState<20 | 30>(20)
  const [teamName, setTeamName] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Facilitator management state
  const [showFacilitatorPanel, setShowFacilitatorPanel] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingFacilitator, setAddingFacilitator] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const facilitatorUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/shape-sequence/facilitator`

  const round: ShapeRound | undefined = rounds.find(r => r.round_number === selectedRound)

  // Sync local state when selected round loads/changes
  useEffect(() => {
    if (round) {
      const count = (round.circle_count === 30 ? 30 : 20) as 20 | 30
      setLocalCircleCount(count)
      setLocalShapes(padShapes(round.shapes, count))
    } else {
      setLocalCircleCount(20)
      setLocalShapes(Array(20).fill('circle'))
    }
  }, [round?.id, selectedRound]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCircleCountChange = (count: 20 | 30) => {
    setLocalCircleCount(count)
    setLocalShapes(prev => padShapes(prev, count))
  }

  const cycleShape = (index: number) => {
    setLocalShapes(prev => {
      const next = [...prev]
      const cur = SHAPE_CYCLE.indexOf(next[index])
      next[index] = SHAPE_CYCLE[(cur + 1) % SHAPE_CYCLE.length]
      return next
    })
  }

  const fillAll = (shape: Shape) => setLocalShapes(Array(localCircleCount).fill(shape))

  const randomize = () => {
    setLocalShapes(
      Array.from({ length: localCircleCount }, () =>
        SHAPE_CYCLE[Math.floor(Math.random() * SHAPE_CYCLE.length)]
      )
    )
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    await upsertRound(selectedRound, { circle_count: localCircleCount, shapes: localShapes })
    setSaving(false)
  }

  const handleActivate = async () => {
    await handleSaveConfig()
    await setActiveRound(selectedRound)
  }

  const handleEndRound = async () => {
    if (!round) return
    await endRound(round.id)
  }

  const handleAddResult = async () => {
    if (!round || !teamName.trim() || !timeInput.trim()) return
    const secs = parseFloat(timeInput)
    if (isNaN(secs) || secs <= 0) { alert('Enter a valid time in seconds (e.g. 83.4)'); return }
    await addResult(round.id, teamName.trim(), secs)
    setTeamName('')
    setTimeInput('')
  }

  const handleAddFacilitator = async () => {
    const name = newGroupName.trim()
    if (!name) return
    setAddingFacilitator(true)
    try {
      await addFacilitator(name)
      setNewGroupName('')
    } catch {
      alert('That group name already exists.')
    } finally {
      setAddingFacilitator(false)
    }
  }

  const handleRename = async (id: string) => {
    const name = editingName.trim()
    if (!name) return
    try {
      await renameFacilitator(id, name)
      setEditingId(null)
    } catch {
      alert('Could not rename. Name may already be taken.')
    }
  }

  const roundResults = round
    ? [...results.filter(r => r.round_id === round.id)].sort((a, b) => a.completion_time - b.completion_time)
    : []

  const cols = localCircleCount === 20 ? 10 : 15
  const isActive = round?.is_active ?? false
  const isCollecting = round?.accepting_submissions ?? false
  const anyResultsVisible = rounds.some(r => r.results_visible)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Home</a>
          <h1 className="text-xl font-black tracking-tight">SHAPE SEQUENCE — Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQR(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors"
          >
            📱 Facilitator QR
          </button>
          <button
            onClick={() => setShowFacilitatorPanel(!showFacilitatorPanel)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
          >
            👥 Groups ({facilitators.length})
          </button>
          <a
            href="/shape-sequence"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-bold transition-colors"
          >
            ↗ Projector
          </a>
        </div>
      </header>

      {/* QR Modal */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-3xl mb-1">📱</div>
              <h2 className="text-2xl font-black text-gray-900">Facilitator Check-In</h2>
              <p className="text-gray-400 text-sm mt-1">Facilitators scan to register their group</p>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-gray-100">
              <QRCodeSVG value={facilitatorUrl} size={280} level="H" />
            </div>
            <p className="text-gray-400 text-xs text-center break-all">{facilitatorUrl}</p>
            <button
              onClick={() => setShowQR(false)}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Facilitator panel */}
      {showFacilitatorPanel && (
        <div className="bg-indigo-950 border-b border-indigo-800 px-6 py-5">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4">Facilitator Groups</h2>

            {facilitators.length === 0 && (
              <p className="text-indigo-300/50 text-sm mb-4">No groups registered yet. Share the QR code above.</p>
            )}

            {/* Group by facilitator_num */}
            {(() => {
              const facNums = Array.from(new Set(facilitators.map(f => f.facilitator_num))).sort((a, b) => {
                if (a === null) return 1
                if (b === null) return -1
                return a - b
              })
              return facNums.map(num => {
                const groups = facilitators.filter(f => f.facilitator_num === num)
                return (
                  <div key={String(num)} className="mb-4">
                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                      {num !== null ? `Facilitator ${num}` : 'Unassigned'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {groups.map(f => (
                        <div key={f.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                          {editingId === f.id ? (
                            <>
                              <input
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') setEditingId(null) }}
                                className="px-2 py-0.5 rounded bg-white/20 text-white text-sm font-bold focus:outline-none w-32"
                                autoFocus
                              />
                              <button onClick={() => handleRename(f.id)} className="text-green-400 text-xs font-bold">✓</button>
                              <button onClick={() => setEditingId(null)} className="text-white/40 text-xs">✕</button>
                            </>
                          ) : (
                            <>
                              <span className="text-white font-bold text-sm">{f.group_name}</span>
                              <button
                                onClick={() => { setEditingId(f.id); setEditingName(f.group_name) }}
                                className="text-white/30 hover:text-white/70 text-xs transition-colors"
                                title="Rename"
                              >✏️</button>
                              <button
                                onClick={() => { if (confirm(`Remove "${f.group_name}"?`)) deleteFacilitator(f.id) }}
                                className="text-white/30 hover:text-red-400 text-xs transition-colors"
                                title="Remove"
                              >✕</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add group manually…"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddFacilitator()}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
              <button
                onClick={handleAddFacilitator}
                disabled={addingFacilitator || !newGroupName.trim()}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white text-sm font-bold disabled:opacity-40 transition-colors"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Round Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: ROUND_COUNT }, (_, i) => i + 1).map(n => {
            const r = rounds.find(r => r.round_number === n)
            const active = r?.is_active
            const collecting = r?.accepting_submissions
            return (
              <button
                key={n}
                onClick={() => setSelectedRound(n)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: selectedRound === n ? '#1e3a8a' : '#fff',
                  color: selectedRound === n ? '#fff' : '#374151',
                  border: selectedRound === n ? '2px solid #1e3a8a' : '2px solid #e5e7eb',
                }}
              >
                Round {n}
                {active && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Active" />}
                {collecting && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Collecting" />}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6 items-start">

          {/* Left: Shape grid editor */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <span className="font-bold text-gray-700 text-sm">Circles:</span>
              {([20, 30] as const).map(n => (
                <button
                  key={n}
                  onClick={() => handleCircleCountChange(n)}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: localCircleCount === n ? '#3b82f6' : '#f3f4f6',
                    color: localCircleCount === n ? '#fff' : '#374151',
                  }}
                >
                  {n} circles ({n === 20 ? '10' : '15'} per row)
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Fill all:</span>
              {SHAPE_CYCLE.map(shape => (
                <button
                  key={shape}
                  onClick={() => fillAll(shape)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:bg-gray-50"
                  style={{ borderColor: `${SHAPE_COLORS[shape]}66`, color: SHAPE_COLORS[shape] }}
                >
                  <ShapeIcon shape={shape} size={14} />
                  {shape.charAt(0).toUpperCase() + shape.slice(1)}
                </button>
              ))}
              <button
                onClick={randomize}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                🎲 Random
              </button>
            </div>

            <div className="rounded-xl p-4 bg-gray-900 overflow-x-auto">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 48px)` }}>
                {localShapes.map((shape, i) => (
                  <button
                    key={i}
                    onClick={() => cycleShape(i)}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: `2px solid ${SHAPE_COLORS[shape]}66`,
                    }}
                    title={`Circle ${i + 1}: ${shape} — click to change`}
                  >
                    <ShapeIcon shape={shape} size={22} />
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400">Click any circle to cycle: ● → ■ → ★ → ✕ → ●</p>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="self-start px-6 py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-700 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving…' : '💾 Save Configuration'}
            </button>
          </div>

          {/* Right: Live controls + results */}
          <div className="flex flex-col gap-4">

            {/* Live controls */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Live Controls</h3>

              <button
                onClick={handleActivate}
                disabled={isActive}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-60"
                style={{
                  background: isActive ? '#16a34a' : '#1d4ed8',
                  color: '#fff',
                  boxShadow: isActive ? '0 0 20px rgba(22,163,74,0.4)' : '0 0 20px rgba(29,78,216,0.3)',
                }}
              >
                {isActive ? '✅ Round Active' : '▶ Start Round'}
              </button>

              <button
                onClick={handleEndRound}
                disabled={!isActive || !round}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                🛑 End Round — Collect Times
              </button>

              <button
                onClick={() => setAllResultsVisible(!anyResultsVisible)}
                disabled={rounds.length === 0}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
                style={{ background: '#7c3aed', color: '#fff' }}
              >
                {anyResultsVisible ? '🙈 Hide Scoreboard' : '👁 Show Scoreboard'}
              </button>

              <button
                onClick={() => {
                  if (!round || roundResults.length === 0) return
                  if (confirm(`Delete all ${roundResults.length} result(s) for Round ${selectedRound}?`)) {
                    clearRoundResults(round.id)
                  }
                }}
                disabled={!round || roundResults.length === 0}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
                style={{ background: '#9f1239', color: '#fff' }}
              >
                🗑 Reset Round {selectedRound} Results
              </button>

              {isCollecting && (
                <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center font-medium">
                  ⏳ Waiting for facilitators to submit times…
                </div>
              )}
            </div>

            {/* Add result manually */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Add Result Manually</h3>
              <input
                type="text"
                placeholder="Team name…"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && document.getElementById('time-input')?.focus()}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  id="time-input"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Seconds (e.g. 83.4)"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddResult()}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAddResult}
                disabled={!round || !teamName.trim() || !timeInput.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-all"
              >
                + Add Result
              </button>
            </div>

            {/* Results list */}
            {roundResults.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-2">
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-1">
                  Round {selectedRound} Results
                </h3>
                {roundResults.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-base w-6 text-center">{['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
                    <span className="flex-1 text-sm font-bold text-gray-800 truncate">{r.team_name}</span>
                    <span className="text-sm font-black text-blue-600 tabular-nums">{formatTime(r.completion_time)}</span>
                    <button
                      onClick={() => deleteResult(r.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-bold ml-1"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full cross-round scoreboard */}
        <FullScoreboardAdmin rounds={rounds} results={results} onDelete={deleteResult} />

      </main>
    </div>
  )
}

function FullScoreboardAdmin({
  rounds,
  results,
  onDelete,
}: {
  rounds: import('../hooks/useShapeSequence').ShapeRound[]
  results: import('../hooks/useShapeSequence').ShapeResult[]
  onDelete: (id: string) => void
}) {
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number)
  const allTeams = Array.from(new Set(results.map(r => r.team_name))).sort()

  if (allTeams.length === 0) return null

  type Cell = { resultId: string; time: number } | null
  type TeamRow = { name: string; cells: Cell[]; total: number }

  const rows: TeamRow[] = allTeams.map(team => {
    const cells = sortedRounds.map(round => {
      const r = results.find(res => res.round_id === round.id && res.team_name === team)
      return r ? { resultId: r.id, time: r.completion_time } : null
    })
    const total = cells.reduce<number>((sum, c) => sum + (c?.time ?? 0), 0)
    return { name: team, cells, total }
  })

  rows.sort((a, b) => {
    const aNulls = a.cells.filter(c => c === null).length
    const bNulls = b.cells.filter(c => c === null).length
    if (aNulls !== bNulls) return aNulls - bNulls
    return a.total - b.total
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-black text-gray-900 text-sm uppercase tracking-wider">All Teams — Full Scoreboard</h2>
        <span className="text-xs text-gray-400">{allTeams.length} teams</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-6 py-3 text-gray-400 font-bold uppercase tracking-wider text-xs w-8">#</th>
              <th className="text-left px-4 py-3 text-gray-400 font-bold uppercase tracking-wider text-xs">Team</th>
              {sortedRounds.map(r => (
                <th key={r.id} className="text-center px-4 py-3 text-blue-500 font-bold uppercase tracking-wider text-xs">
                  Round {r.round_number}
                </th>
              ))}
              <th className="text-center px-4 py-3 text-yellow-600 font-bold uppercase tracking-wider text-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.name} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 text-gray-400 font-bold text-center">{i + 1}</td>
                <td className="px-4 py-3 font-bold text-gray-800">{row.name}</td>
                {row.cells.map((cell, ri) => (
                  <td key={ri} className="px-4 py-3 text-center tabular-nums">
                    {cell ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-blue-600 font-black">{formatTime(cell.time)}</span>
                        <button
                          onClick={() => { if (confirm(`Delete ${row.name}'s Round ${ri + 1} time?`)) onDelete(cell.resultId) }}
                          className="text-red-300 hover:text-red-500 text-xs transition-colors"
                          title="Delete"
                        >✕</button>
                      </span>
                    ) : (
                      <span className="text-gray-200 font-bold">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-black tabular-nums" style={{ color: i === 0 ? '#d97706' : '#374151' }}>
                  {row.total > 0 ? formatTime(row.total) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
