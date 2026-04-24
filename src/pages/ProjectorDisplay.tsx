import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import { TaskCard } from '../components/TaskCard'
import { QRCodeModal } from '../components/QRCodeModal'
import { ParticleBackground } from '../components/ParticleBackground'
import type { Task } from '../types/database'

export function ProjectorDisplay() {
  const { tasks, loading } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const liveTasks = tasks.filter(t => t.is_live)
  // Check if any task has points — if so, sort by points desc (hardest left)
  const hasPoints = liveTasks.some(t => t.points > 0)
  const sortedTasks = hasPoints
    ? [...liveTasks].sort((a, b) => b.points - a.points)
    : liveTasks

  const maxPoints = Math.max(...liveTasks.map(t => t.points), 1)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-3xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Home link - top left */}
      <a
        href="/"
        className="absolute top-5 left-6 z-20 px-4 py-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20 hover:text-white text-sm font-medium transition-all backdrop-blur-sm"
      >
        ← Home
      </a>

      {/* Admin link */}
      <a
        href="/admin"
        className="absolute top-5 left-28 z-20 px-4 py-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20 hover:text-white text-sm font-medium transition-all backdrop-blur-sm"
      >
        ⚙ Admin
      </a>

      {/* Instructions link - top right */}
      <a
        href="/instructions/flag-retrieval"
        className="absolute top-5 right-6 z-20 px-4 py-2 bg-white/10 text-white/70 rounded-xl hover:bg-white/20 hover:text-white text-sm font-bold transition-all backdrop-blur-sm flex items-center gap-2"
      >
        📋 Instructions Slide
      </a>

      {/* Particle background */}
      <ParticleBackground />

      <div className="relative z-10 text-center mb-8">
        <h1 className="text-7xl font-black text-white mb-3 tracking-tight animate-slide-up">
          FLAG RETRIEVAL
        </h1>
        <p className="text-gray-400 text-2xl font-medium animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Collect a flag &bull; Scan the code &bull; Complete the challenge!
        </p>
      </div>

      {liveTasks.length === 0 ? (
        <p className="text-gray-500 text-xl relative z-10">No tasks yet. Add tasks from the admin panel.</p>
      ) : (
        <div className="relative z-10 w-full max-w-[1600px]">
          {/* Difficulty meter (only when points exist) */}
          {hasPoints && (
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 px-2">
                <span className="text-red-400">Hardest</span>
                <span className="text-green-400">Easiest</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)' }} />
            </div>
          )}

          {/* Cards — equal-size grid, wraps to 2 rows on smaller screens */}
          <div
            className="grid gap-3 pb-4 w-full"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(140px, 1fr))`,
            }}
          >
            {sortedTasks.map((task, i) => (
              <div key={task.id} className="animate-bounce-in flex flex-col items-stretch" style={{ animationDelay: `${i * 0.1}s` }}>
                <TaskCard
                  task={task}
                  size={sortedTasks.length > 8 ? 'small' : 'large'}
                  equal
                  onClick={() => setSelectedTask(task)}
                />
                {hasPoints && (
                  <div className="mt-3 flex flex-col items-center gap-1">
                    <span className="text-white font-black text-lg">{task.points} pts</span>
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(task.points / maxPoints) * 100}%`,
                          background: `linear-gradient(90deg, #ef4444, #f59e0b)`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTask && (
        <QRCodeModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
