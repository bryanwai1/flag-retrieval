import { useTasks } from '../hooks/useTasks'
import { ParticleBackground } from '../components/ParticleBackground'
import type { Task } from '../types/database'

export function ProjectorView() {
  const { tasks, loading } = useTasks()

  const hasPoints = tasks.some(t => t.points > 0)
  const sortedTasks: Task[] = hasPoints
    ? [...tasks].sort((a, b) => b.points - a.points)
    : tasks

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-3xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Admin link */}
      <a
        href="/admin"
        className="absolute top-5 left-6 z-20 px-4 py-2 bg-white/10 text-white/50 rounded-xl hover:bg-white/20 hover:text-white text-sm font-medium transition-all backdrop-blur-sm"
      >
        ← Admin
      </a>

      <ParticleBackground />

      {/* Title */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="text-7xl font-black text-white mb-3 tracking-tight animate-slide-up">
          FLAG RETRIEVAL
        </h1>
        <p className="text-gray-400 text-2xl font-medium animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Collect a flag &bull; Scan the code &bull; Complete the challenge!
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500 text-xl relative z-10">No tasks yet. Add tasks from the admin panel.</p>
      ) : (
        <div className="relative z-10 w-full max-w-[1800px] flex flex-col">
          {/* Difficulty meter */}
          <div className="mb-5 animate-slide-up px-2" style={{ animationDelay: '0.1s' }}>
            <div
              className="h-4 rounded-full w-full"
              style={{
                background: 'linear-gradient(90deg, #ef4444 0%, #f97316 30%, #eab308 55%, #84cc16 75%, #22c55e 100%)',
                boxShadow: '0 0 24px rgba(239,68,68,0.3), 0 0 24px rgba(34,197,94,0.3)',
              }}
            />
            <div className="flex justify-between mt-2 px-1">
              <span className="text-red-400 text-sm font-black uppercase tracking-widest">⬤ Challenging</span>
              <span className="text-green-400 text-sm font-black uppercase tracking-widest">Simple ⬤</span>
            </div>
          </div>

          {/* Single-row cards */}
          <div className="flex flex-row gap-3 w-full">
            {sortedTasks.map((task, i) => (
              <div
                key={task.id}
                className="flex-1 min-w-0 animate-bounce-in"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <ProjectorCard task={task} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectorCard({ task }: { task: Task }) {
  return (
    <div
      className="relative rounded-3xl text-white flex flex-col justify-center items-center text-center p-4 animate-pulse-glow"
      style={{
        backgroundColor: task.hex_code,
        textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        boxShadow: `0 8px 32px ${task.hex_code}66`,
        aspectRatio: '3 / 4',
      }}
    >
      <div className="font-black text-base xl:text-lg leading-tight tracking-tight">
        {task.title}
      </div>
      <div className="mt-2 font-bold uppercase tracking-[0.15em] text-xs opacity-80">
        {task.color} FLAG
      </div>
    </div>
  )
}
