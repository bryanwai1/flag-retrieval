import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import { TaskCard } from '../components/TaskCard'
import { QRCodeModal } from '../components/QRCodeModal'
import type { Task } from '../types/database'

export function ProjectorDisplay() {
  const { tasks, loading } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-3xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center mb-12">
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
        <div className="flex gap-6 flex-wrap justify-center relative z-10 max-w-[1400px]">
          {tasks.map((task, i) => (
            <div key={task.id} className="animate-bounce-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <TaskCard
                task={task}
                size="large"
                onClick={() => setSelectedTask(task)}
              />
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <QRCodeModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
