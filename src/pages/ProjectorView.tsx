import { useState, useEffect, useRef } from 'react'
import { useTasks } from '../hooks/useTasks'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useTeams } from '../hooks/useTeams'
import { useSetting } from '../hooks/useSettings'
import { ParticleBackground } from '../components/ParticleBackground'
import { CardParticleCanvas } from '../components/CardParticleCanvas'
import type { Task } from '../types/database'

const MEDALS = ['🥇', '🥈', '🥉']
const STORAGE_KEY = 'flag-retrieval-start-time'

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ProjectorView() {
  const { tasks, loading: tasksLoading } = useTasks()
  const { byPoints, loading: lbLoading } = useLeaderboard()
  const { teams, loading: teamsLoading } = useTeams()
  const [manualOrder, setManualOrder] = useSetting('flag-retrieval-ranking-order', '')
  const [editRank, setEditRank] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [startTime, setStartTime] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [now, setNow] = useState(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (startTime) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startTime])

  const handleStart = () => {
    const t = Date.now()
    localStorage.setItem(STORAGE_KEY, String(t))
    setStartTime(t)
    setNow(t)
  }

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setStartTime(null)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const liveTasks = tasks.filter(t => t.is_live)
  const hasPoints = liveTasks.some(t => t.points > 0)
  const totalPoints = liveTasks.reduce((sum, t) => sum + (t.points || 0), 0)
  const sortedTasks: Task[] = hasPoints
    ? [...liveTasks].sort((a, b) => b.points - a.points)
    : liveTasks

  if (tasksLoading || lbLoading || teamsLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-3xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  // Merge all registered teams with leaderboard data (so teams with 0 show too)
  const lbMap = new Map(byPoints.map(e => [e.teamId, e]))
  const autoRows = teams
    .map(t => lbMap.get(t.id) ?? { teamId: t.id, teamName: t.name, flagsCompleted: 0, pointsGathered: 0, lastCompletedAt: null })
    .sort((a, b) => b.pointsGathered - a.pointsGathered || b.flagsCompleted - a.flagsCompleted || a.teamName.localeCompare(b.teamName))

  // Apply manual ranking override if present
  let manualIds: string[] = []
  try { manualIds = manualOrder ? JSON.parse(manualOrder) : [] } catch { manualIds = [] }
  const rowById = new Map(autoRows.map(r => [r.teamId, r]))
  const orderedFromManual = manualIds.map(id => rowById.get(id)).filter((r): r is NonNullable<typeof r> => !!r)
  const orderedIds = new Set(orderedFromManual.map(r => r.teamId))
  const allTeamRows = [...orderedFromManual, ...autoRows.filter(r => !orderedIds.has(r.teamId))]

  const moveRank = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= allTeamRows.length) return
    const newIds = allTeamRows.map(r => r.teamId)
    ;[newIds[index], newIds[target]] = [newIds[target], newIds[index]]
    setManualOrder(JSON.stringify(newIds))
  }

  const resetRank = () => { setManualOrder('') }

  const handleSelect = (task: Task) => {
    setSelectedTask(prev => (prev?.id === task.id ? null : task))
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-between px-4 md:px-8 py-4 relative overflow-hidden">
      {/* Admin link */}
      <a
        href="/admin"
        className="absolute top-5 left-6 z-20 px-4 py-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20 hover:text-white text-sm font-medium transition-all backdrop-blur-sm"
      >
        ← Admin
      </a>

      {/* Edit ranking toggle */}
      <div className="absolute top-5 left-28 z-20 flex items-center gap-2">
        <button
          onClick={() => setEditRank(v => !v)}
          className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all backdrop-blur-sm ${
            editRank
              ? 'bg-yellow-400/25 border border-yellow-400/60 text-yellow-200'
              : 'bg-white/10 border border-white/20 text-white/50 hover:text-white hover:bg-white/20'
          }`}
          title="Manually reorder teams"
        >
          {editRank ? '✓ Done' : '↕ Edit Rank'}
        </button>
        {editRank && manualOrder && (
          <button
            onClick={resetRank}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all backdrop-blur-sm"
            title="Clear manual order, return to auto-sort"
          >
            Reset
          </button>
        )}
      </div>

      {/* Timer controls */}
      <div className="absolute top-5 right-6 z-20 flex items-center gap-3">
        {startTime ? (
          <>
            <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-xl text-green-300 font-black text-lg tracking-widest tabular-nums">
              {formatElapsed(now - startTime)}
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30 transition-all"
            >
              Reset
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            className="px-5 py-2 bg-green-500/20 border border-green-500/40 text-green-300 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-green-500/30 transition-all"
          >
            ▶ Start Timer
          </button>
        )}
      </div>

      <ParticleBackground />

      {/* Title */}
      <div className="relative z-10 text-center pt-2">
        <h1 className="text-2xl md:text-5xl font-black text-white tracking-tight animate-slide-up">
          FLAG RETRIEVAL
        </h1>
        <p className="text-gray-400 text-xs md:text-base font-medium animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Collect a flag &bull; Scan the code &bull; Complete the challenge!
        </p>
        {hasPoints && totalPoints > 0 && (
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/15 border border-yellow-400/30 animate-slide-up" style={{ animationDelay: '0.35s' }}>
            <span className="text-yellow-300 text-sm md:text-lg">⭐</span>
            <span className="text-yellow-200 font-black text-sm md:text-xl tracking-wide">{totalPoints.toLocaleString()} pts available</span>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500 text-xl relative z-10">No tasks yet. Add tasks from the admin panel.</p>
      ) : (
        <div className="relative z-10 w-full max-w-[1800px] flex flex-col gap-2 flex-1 justify-center">
          {/* Difficulty meter */}
          <div className="animate-slide-up px-1" style={{ animationDelay: '0.1s' }}>
            <div
              className="h-2 md:h-3 rounded-full w-full"
              style={{
                background: 'linear-gradient(90deg, #ef4444 0%, #f97316 30%, #eab308 55%, #84cc16 75%, #22c55e 100%)',
                boxShadow: '0 0 24px rgba(239,68,68,0.3), 0 0 24px rgba(34,197,94,0.3)',
              }}
            />
            <div className="flex justify-between mt-1 px-1">
              <span className="text-red-400 text-[10px] md:text-xs font-black uppercase tracking-widest">⬤ Challenging</span>
              <span className="text-green-400 text-[10px] md:text-xs font-black uppercase tracking-widest">Simple ⬤</span>
            </div>
          </div>

          {/* Flag cards — single row */}
          <div className="flex flex-row gap-1.5 md:gap-3 w-full">
            {sortedTasks.map((task, i) => (
              <div
                key={task.id}
                className="flex-1 min-w-0 animate-bounce-in flex flex-col items-center gap-1"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div
                  onClick={() => handleSelect(task)}
                  className={`relative w-full aspect-square rounded-xl md:rounded-2xl cursor-pointer transition-all duration-200 animate-pulse-glow overflow-hidden ${
                    selectedTask?.id === task.id ? 'ring-4 ring-white/60 scale-95' : 'hover:scale-95 active:scale-90'
                  }`}
                  style={{
                    backgroundColor: task.hex_code,
                    boxShadow: `0 4px 20px ${task.hex_code}66`,
                  }}
                >
                  <CardParticleCanvas hexCode={task.hex_code} />
                </div>
                {hasPoints && task.points > 0 && (
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-white font-black" style={{ fontSize: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
                      {task.points}
                    </span>
                    <span className="text-yellow-300 font-black uppercase tracking-widest" style={{ fontSize: 'clamp(0.45rem, 1vw, 0.75rem)' }}>
                      pts
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Name panel — appears on click */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              selectedTask ? 'opacity-100 max-h-24' : 'opacity-0 max-h-0'
            }`}
          >
            {selectedTask && (
              <div
                className="rounded-2xl px-6 py-3 text-white flex items-center gap-4"
                style={{
                  backgroundColor: `${selectedTask.hex_code}33`,
                  borderLeft: `4px solid ${selectedTask.hex_code}`,
                }}
              >
                <div
                  className="w-8 h-8 md:w-12 md:h-12 rounded-xl flex-shrink-0"
                  style={{ backgroundColor: selectedTask.hex_code }}
                />
                <div>
                  <p className="text-xs md:text-sm font-bold uppercase tracking-widest opacity-70">
                    {selectedTask.color} Flag
                  </p>
                  <h2 className="text-lg md:text-3xl font-black tracking-tight leading-tight">
                    {selectedTask.title}
                  </h2>
                </div>
                {hasPoints && selectedTask.points > 0 && (
                  <span className="ml-auto text-xl md:text-3xl font-black text-yellow-300">{selectedTask.points} pts</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoreboard table */}
      <div className="relative z-10 w-full max-w-[1800px] pb-2">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-2 text-white/50 font-black uppercase tracking-widest text-xs w-10">#</th>
                <th className="text-left px-4 py-2 text-white/50 font-black uppercase tracking-widest text-xs">Team</th>
                <th className="text-center px-4 py-2 text-white/50 font-black uppercase tracking-widest text-xs">🚩 Flags</th>
                {hasPoints && <th className="text-center px-4 py-2 text-yellow-400/70 font-black uppercase tracking-widest text-xs">⭐ Points</th>}
                <th className="text-center px-4 py-2 text-green-400/70 font-black uppercase tracking-widest text-xs">⏱ Finished</th>
              </tr>
            </thead>
            <tbody>
              {allTeamRows.length === 0 ? (
                <tr>
                  <td colSpan={hasPoints ? 5 : 4} className="text-center py-4 text-white/30 text-sm">
                    No teams yet...
                  </td>
                </tr>
              ) : (
                allTeamRows.map((entry, i) => {
                  const completedAll = entry.flagsCompleted >= tasks.length && tasks.length > 0
                  const finishTime = completedAll && entry.lastCompletedAt && startTime
                    ? formatElapsed(new Date(entry.lastCompletedAt).getTime() - startTime)
                    : null
                  return (
                    <tr
                      key={entry.teamId}
                      className="border-b border-white/5 last:border-0"
                      style={{
                        backgroundColor: i === 0 ? 'rgba(234,179,8,0.12)' : i === 1 ? 'rgba(148,163,184,0.08)' : i === 2 ? 'rgba(180,83,9,0.08)' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-2 text-center w-10">
                        {editRank ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => moveRank(i, -1)}
                              disabled={i === 0}
                              className="px-1.5 py-0 leading-none rounded bg-white/10 text-white text-xs hover:bg-yellow-400/30 disabled:opacity-20 transition"
                              title="Move up"
                            >▲</button>
                            <span className="text-white/40 text-[10px] font-bold leading-none">{i + 1}</span>
                            <button
                              onClick={() => moveRank(i, 1)}
                              disabled={i === allTeamRows.length - 1}
                              className="px-1.5 py-0 leading-none rounded bg-white/10 text-white text-xs hover:bg-yellow-400/30 disabled:opacity-20 transition"
                              title="Move down"
                            >▼</button>
                          </div>
                        ) : i < 3 ? (
                          <span className="text-base">{MEDALS[i]}</span>
                        ) : (
                          <span className="text-white/40 font-bold">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-white font-bold truncate max-w-[200px]">{entry.teamName}</td>
                      <td className="px-4 py-2 text-center text-white font-black">{entry.flagsCompleted}</td>
                      {hasPoints && (
                        <td className="px-4 py-2 text-center font-black" style={{ color: i === 0 ? '#eab308' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'rgba(255,255,255,0.7)' }}>
                          {entry.pointsGathered}
                        </td>
                      )}
                      <td className="px-4 py-2 text-center font-black text-green-400">
                        {finishTime ?? <span className="text-white/20 font-normal">—</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
