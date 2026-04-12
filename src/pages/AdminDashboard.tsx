import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '../hooks/useTasks'
import { useTeams } from '../hooks/useTeams'
import { useTeamScans } from '../hooks/useTeamScans'
import { TaskCard } from '../components/TaskCard'
import { QRCodeModal } from '../components/QRCodeModal'
import { TaskForm } from '../components/TaskForm'
import { TeamProgressTable } from '../components/TeamProgressTable'
import { TemplateUpload } from '../components/TemplateUpload'
import { ActivityConverter } from '../components/ActivityConverter'
import type { Task } from '../types/database'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { tasks, createTask, deleteTask, refetch } = useTasks()
  const { teams } = useTeams()
  const { scans, toggleComplete } = useTeamScans()
  const [showForm, setShowForm] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showConverter, setShowConverter] = useState(false)
  const [qrTask, setQrTask] = useState<Task | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Flag Retrieval — Admin</h1>
          <a href="/" target="_blank" className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors">
            Open Projector Display
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-10">
        {/* Tools */}
        <section>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setShowConverter(!showConverter); setShowUpload(false) }}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 text-sm font-bold transition-all"
            >
              {showConverter ? 'Hide Converter' : 'Activity Converter'}
            </button>
            <button
              onClick={() => { setShowUpload(!showUpload); setShowConverter(false) }}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium transition-colors"
            >
              {showUpload ? 'Hide' : 'Import JSON'}
            </button>
          </div>
          {showConverter && <ActivityConverter onComplete={() => { refetch(); setShowConverter(false) }} existingTaskCount={tasks.length} />}
          {showUpload && <TemplateUpload onComplete={() => { refetch(); setShowUpload(false) }} />}
        </section>

        {/* Task Cards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Task Cards</h2>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors">
              + Add Task
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <TaskForm
                onSave={async (data) => { await createTask(data); setShowForm(false) }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {tasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tasks yet. Click "Add Task" or import a template.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} size="small" onClick={() => navigate(`/admin/task/${task.id}`)}>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrTask(task) }}
                      className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                    >
                      QR Code
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id)
                      }}
                      className="px-3 py-1 bg-red-500/30 rounded-lg text-sm hover:bg-red-500/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </TaskCard>
              ))}
            </div>
          )}
        </section>

        {/* Team Progress */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Team Progress
            <span className="ml-2 text-sm font-normal text-gray-400">({teams.length} teams registered)</span>
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <TeamProgressTable teams={teams} tasks={tasks} scans={scans} onToggleComplete={toggleComplete} />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            ◎ = Scanned &nbsp; ✓ = Completed &nbsp; Click to toggle completion
          </p>
        </section>
      </main>

      {qrTask && <QRCodeModal task={qrTask} onClose={() => setQrTask(null)} />}
    </div>
  )
}
