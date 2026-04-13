import { useState, useEffect } from 'react'
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
    rounds, results,
    upsertRound, setActiveRound,
    toggleResultsVisible, addResult, deleteResult,
  } = useShapeSequence()

  const [selectedRound, setSelectedRound] = useState(1)
  const [localShapes, setLocalShapes] = useState<Shape[]>(Array(20).fill('circle'))
  const [localCircleCount, setLocalCircleCount] = useState<20 | 30>(20)
  const [teamName, setTeamName] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [saving, setSaving] = useState(false)

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

  // When circle count changes locally, resize shapes array
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

  const fillAll = (shape: Shape) => {
    setLocalShapes(Array(localCircleCount).fill(shape))
  }

  const randomize = () => {
    setLocalShapes(
      Array.from({ length: localCircleCount }, () =>
        SHAPE_CYCLE[Math.floor(Math.random() * SHAPE_CYCLE.length)]
      )
    )
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    await upsertRound(selectedRound, {
      circle_count: localCircleCount,
      shapes: localShapes,
    })
    setSaving(false)
  }

  const handleActivate = async () => {
    await handleSaveConfig()
    await setActiveRound(selectedRound)
  }

  const handleAddResult = async () => {
    if (!round || !teamName.trim() || !timeInput.trim()) return
    const secs = parseFloat(timeInput)
    if (isNaN(secs) || secs <= 0) { alert('Enter a valid time in seconds (e.g. 83.4)'); return }
    await addResult(round.id, teamName.trim(), secs)
    setTeamName('')
    setTimeInput('')
  }

  const roundResults = round
    ? [...results.filter(r => r.round_id === round.id)].sort((a, b) => a.completion_time - b.completion_time)
    : []

  const cols = localCircleCount === 20 ? 10 : 15
  const isActive = round?.is_active ?? false
  const resultsVisible = round?.results_visible ?? false

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Home</a>
          <h1 className="text-xl font-black tracking-tight">SHAPE SEQUENCE — Admin</h1>
        </div>
        <a
          href="/shape-sequence"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-bold transition-colors"
        >
          ↗ Open Projector
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Round Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: ROUND_COUNT }, (_, i) => i + 1).map(n => {
            const r = rounds.find(r => r.round_number === n)
            const active = r?.is_active
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
                {active && (
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Active on projector" />
                )}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6 items-start">

          {/* Left: Shape grid editor */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
            {/* Circle count */}
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

            {/* Quick fill buttons */}
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

            {/* Shape grid */}
            <div
              className="rounded-xl p-4 bg-gray-900 overflow-x-auto"
            >
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${cols}, 48px)` }}
              >
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
                className="w-full py-3 rounded-xl font-black text-sm transition-all"
                style={{
                  background: isActive ? '#16a34a' : '#1d4ed8',
                  color: '#fff',
                  boxShadow: isActive ? '0 0 20px rgba(22,163,74,0.4)' : '0 0 20px rgba(29,78,216,0.3)',
                }}
              >
                {isActive ? '✅ Active on Projector' : '▶ Activate on Projector'}
              </button>

              <button
                onClick={() => round && toggleResultsVisible(round.id, !resultsVisible)}
                disabled={!round}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
                style={{
                  background: resultsVisible ? '#dc2626' : '#7c3aed',
                  color: '#fff',
                }}
              >
                {resultsVisible ? '🙈 Hide Results' : '👁 Show Results'}
              </button>
            </div>

            {/* Add result */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">Add Team Result</h3>

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
      </main>
    </div>
  )
}
