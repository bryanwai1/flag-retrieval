import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetting } from '../hooks/useSettings'
import { useTasks } from '../hooks/useTasks'
import { useTeams } from '../hooks/useTeams'
import { useTeamMembers } from '../hooks/useTeamMembers'
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
  const { tasks, createTask, updateTask, deleteTask, refetch } = useTasks()
  const { teams, renameTeam, deleteTeam } = useTeams()
  const { members, renameMember, removeMember, moveMember } = useTeamMembers()
  const { scans, toggleComplete } = useTeamScans()
  const [showForm, setShowForm] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editingMemberName, setEditingMemberName] = useState('')
  const [movingMemberId, setMovingMemberId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showConverter, setShowConverter] = useState(false)
  const [qrTask, setQrTask] = useState<Task | null>(null)
  const [pointsSetting, setPointsSetting] = useSetting('points_enabled', 'false')
  const pointsEnabled = pointsSetting === 'true'
  const setPointsEnabled = (val: boolean) => setPointsSetting(String(val))
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const [copiedFaciLink, setCopiedFaciLink] = useState(false)

  function copyTaskLink(e: React.MouseEvent, taskId: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/task/${taskId}`)
    setCopiedTaskId(taskId)
    setTimeout(() => setCopiedTaskId(null), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Flag Retrieval — Admin</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPointsEnabled(!pointsEnabled)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pointsEnabled ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
            >
              Points {pointsEnabled ? 'ON' : 'OFF'}
            </button>
            <div className="flex items-center rounded-lg overflow-hidden border border-gray-700">
              <a href="/flag-retrieval" target="_blank" className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-700 text-sm transition-colors">
                Facilitator View
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/flag-retrieval`)
                  setCopiedFaciLink(true)
                  setTimeout(() => setCopiedFaciLink(false), 1500)
                }}
                className="px-3 py-2 bg-gray-800 text-gray-300 hover:bg-gray-600 text-sm transition-colors border-l border-gray-700"
                title="Copy facilitator link"
              >
                {copiedFaciLink ? '✓' : '🔗'}
              </button>
            </div>
            <a href="/projector" target="_blank" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors">
              Projector View
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-10">
        {/* Teams & Members */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Teams & Members</h2>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {teams.length} {teams.length === 1 ? 'team' : 'teams'} · {members.length} members
            </span>
          </div>
          {teams.length === 0 ? (
            <p className="text-gray-400 text-sm">No teams registered yet. Teams join by scanning a QR code.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {teams.map((team) => {
                const teamScans = scans.filter(s => s.team_id === team.id)
                const completed = teamScans.filter(s => s.completed).length
                const teamMembers = members.filter(m => m.team_id === team.id)
                return (
                  <div key={team.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Team header */}
                    <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                      {editingTeamId === team.id ? (
                        <input
                          autoFocus
                          value={editingTeamName}
                          onChange={e => setEditingTeamName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { renameTeam(team.id, editingTeamName); setEditingTeamId(null) }
                            if (e.key === 'Escape') setEditingTeamId(null)
                          }}
                          onBlur={() => { renameTeam(team.id, editingTeamName); setEditingTeamId(null) }}
                          className="font-bold text-gray-800 text-sm border-b border-blue-400 outline-none bg-transparent"
                        />
                      ) : (
                        <span className="font-bold text-gray-800 text-sm">{team.name}</span>
                      )}
                      <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" title="Passcode">{team.password}</span>
                      <span className="text-xs text-gray-400">{completed}/{tasks.length} flags</span>
                      {pointsEnabled && (() => {
                        const totalPts = teamScans.filter(s => s.completed).reduce((sum, s) => sum + (tasks.find(t => t.id === s.task_id)?.points || 0), 0)
                        return totalPts > 0 ? <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{totalPts} pts</span> : null
                      })()}
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name) }} className="text-xs text-gray-400 hover:text-blue-500 transition-colors" title="Rename team">✏️ Rename</button>
                        <button onClick={() => { if (confirm(`Delete "${team.name}" and all its data?`)) deleteTeam(team.id) }} className="text-xs text-gray-400 hover:text-red-500 transition-colors" title="Delete team">🗑 Delete</button>
                      </div>
                    </div>

                    {/* Members list */}
                    <div className="divide-y divide-gray-100">
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-gray-400 px-4 py-2">No members</p>
                      ) : (
                        teamMembers.map(member => (
                          <div key={member.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                            <span className="text-gray-400 text-xs w-4">{member.is_creator ? '👑' : '👤'}</span>
                            {editingMemberId === member.id ? (
                              <input
                                autoFocus
                                value={editingMemberName}
                                onChange={e => setEditingMemberName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { renameMember(member.id, editingMemberName); setEditingMemberId(null) }
                                  if (e.key === 'Escape') setEditingMemberId(null)
                                }}
                                onBlur={() => { renameMember(member.id, editingMemberName); setEditingMemberId(null) }}
                                className="font-medium text-gray-800 border-b border-blue-400 outline-none bg-transparent flex-1"
                              />
                            ) : (
                              <span className="text-gray-700 font-medium flex-1">{member.name}</span>
                            )}

                            {/* Move dropdown */}
                            {movingMemberId === member.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  autoFocus
                                  defaultValue=""
                                  onChange={e => { if (e.target.value) { moveMember(member.id, e.target.value); setMovingMemberId(null) } }}
                                  onBlur={() => setMovingMemberId(null)}
                                  className="text-xs border border-gray-300 rounded px-1 py-0.5 text-gray-700"
                                >
                                  <option value="" disabled>Move to...</option>
                                  {teams.filter(t => t.id !== team.id).map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                <button onClick={() => setMovingMemberId(null)} className="text-xs text-gray-400">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setEditingMemberId(member.id); setEditingMemberName(member.name) }} className="text-xs text-gray-400 hover:text-blue-500 transition-colors">✏️</button>
                                <button onClick={() => setMovingMemberId(member.id)} className="text-xs text-gray-400 hover:text-indigo-500 transition-colors" title="Move to another team">↗ Move</button>
                                <button onClick={() => { if (confirm(`Remove "${member.name}" from "${team.name}"?`)) removeMember(member.id) }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

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
                  {pointsEnabled && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={task.points}
                        onChange={(e) => updateTask(task.id, { points: Number(e.target.value) })}
                        className="w-16 px-2 py-1 rounded bg-white/20 text-white text-sm text-center border border-white/30 focus:outline-none focus:ring-1 focus:ring-white/50"
                        min={0}
                      />
                      <span className="text-xs opacity-70">pts</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrTask(task) }}
                      className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                    >
                      QR Code
                    </button>
                    <button
                      onClick={(e) => copyTaskLink(e, task.id)}
                      className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                    >
                      {copiedTaskId === task.id ? '✓ Copied' : 'Copy Link'}
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
            <TeamProgressTable teams={teams} tasks={tasks} scans={scans} onToggleComplete={toggleComplete} pointsEnabled={pointsEnabled} />
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
