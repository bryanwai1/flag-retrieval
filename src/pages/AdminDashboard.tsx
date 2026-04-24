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
  const { scans, toggleComplete, resetTeamScans, resetAllScans } = useTeamScans()
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
  const [marshalPassword, setMarshalPassword] = useSetting('marshal_password', '1234')
  const [marshalDraft, setMarshalDraft] = useState('')
  const [marshalSaved, setMarshalSaved] = useState(false)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const [copiedFaciLink, setCopiedFaciLink] = useState(false)

  function copyTaskLink(e: React.MouseEvent, taskId: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/task/${taskId}`)
    setCopiedTaskId(taskId)
    setTimeout(() => setCopiedTaskId(null), 1500)
  }

  const liveTasks = tasks.filter(t => t.is_live)
  const libraryTasks = tasks.filter(t => !t.is_live)
  const liveTaskIds = new Set(liveTasks.map(t => t.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Flag Retrieval — Admin</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (!confirm('Reset ALL team scores? This deletes every scan/completion for every team. Teams and cards are kept.')) return
                try { await resetAllScans() } catch (e) { alert(`Reset failed: ${(e as Error).message}`) }
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              title="Delete all team scans"
            >
              Reset All Scores
            </button>
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
        {/* Live Scoreboard */}
        <section className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Live Scoreboard
            </h2>
            <span className="text-xs opacity-80">{liveTasks.length} live cards</span>
          </div>
          {teams.length === 0 ? (
            <p className="text-white/70 text-sm">No teams yet. Teams will appear here after they join.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(() => {
                const rows = teams.map(team => {
                  const teamScans = scans.filter(s => s.team_id === team.id && s.completed && liveTaskIds.has(s.task_id))
                  const pts = teamScans.reduce((sum, s) => sum + (tasks.find(t => t.id === s.task_id)?.points || 0), 0)
                  const last = teamScans.reduce<string | null>((acc, s) => (s.completed_at && (!acc || s.completed_at > acc)) ? s.completed_at : acc, null)
                  return { id: team.id, name: team.name, completed: teamScans.length, pts, last }
                }).sort((a, b) => (pointsEnabled ? b.pts - a.pts : 0) || b.completed - a.completed || a.name.localeCompare(b.name))
                return rows.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-xs font-black w-5 text-center opacity-80">{i + 1}</span>
                    <span className="flex-1 font-bold text-sm truncate">{row.name}</span>
                    <span className="text-xs font-mono bg-white/15 px-1.5 py-0.5 rounded">
                      {row.completed}/{liveTasks.length}
                    </span>
                    {pointsEnabled && (
                      <span className="text-xs font-bold text-amber-200">{row.pts} pts</span>
                    )}
                  </div>
                ))
              })()}
            </div>
          )}
        </section>

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
                const completed = teamScans.filter(s => s.completed && liveTaskIds.has(s.task_id)).length
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
                      <span className="text-xs text-gray-400">{completed}/{liveTasks.length} flags</span>
                      {pointsEnabled && (() => {
                        const totalPts = teamScans.filter(s => s.completed && liveTaskIds.has(s.task_id)).reduce((sum, s) => sum + (tasks.find(t => t.id === s.task_id)?.points || 0), 0)
                        return totalPts > 0 ? <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{totalPts} pts</span> : null
                      })()}
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name) }} className="text-xs text-gray-400 hover:text-blue-500 transition-colors" title="Rename team">✏️ Rename</button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Reset "${team.name}" scores? All scans for this team will be deleted.`)) return
                            try { await resetTeamScans(team.id) } catch (e) { alert(`Reset failed: ${(e as Error).message}`) }
                          }}
                          className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
                          title="Reset this team's scores"
                        >↺ Reset</button>
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

        {/* Marshal Password */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Marshal Password</h2>
            <span className="text-xs font-mono bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
              Current: {marshalPassword}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Participants must enter this 4-digit password to complete a task. Share it only with marshals on the floor.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={marshalDraft}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                setMarshalDraft(digits)
                setMarshalSaved(false)
              }}
              placeholder="New 4-digit password"
              className="flex-1 max-w-xs px-4 py-2 rounded-lg border border-gray-300 text-center text-lg font-mono font-bold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={async () => {
                if (marshalDraft.length !== 4) return
                await setMarshalPassword(marshalDraft)
                setMarshalDraft('')
                setMarshalSaved(true)
                setTimeout(() => setMarshalSaved(false), 2000)
              }}
              disabled={marshalDraft.length !== 4}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Update Password
            </button>
            {marshalSaved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
          </div>
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

        {/* Task Cards — split into Live slot + Library */}
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
                onSave={async (data) => { await createTask({ ...data, is_live: false }); setShowForm(false) }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {(() => {
            const renderCard = (task: Task, variant: 'live' | 'library') => (
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
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTask(task.id, { is_live: variant !== 'live' }) }}
                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                      variant === 'live'
                        ? 'bg-white/25 hover:bg-white/40'
                        : 'bg-emerald-500/80 hover:bg-emerald-500'
                    }`}
                    title={variant === 'live' ? 'Remove from Live slot' : 'Add to Live slot'}
                  >
                    {variant === 'live' ? '↓ Unlive' : '↑ Go Live'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setQrTask(task) }}
                    className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                  >
                    QR
                  </button>
                  <button
                    onClick={(e) => copyTaskLink(e, task.id)}
                    className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                  >
                    {copiedTaskId === task.id ? '✓' : 'Link'}
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
            )

            if (tasks.length === 0) {
              return <p className="text-gray-400 text-center py-8">No tasks yet. Click "Add Task" or import a template.</p>
            }

            return (
              <div className="flex flex-col gap-6">
                {/* Live slot */}
                <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">
                        Live Cards
                        <span className="ml-2 text-xs font-medium text-emerald-600/70">({liveTasks.length})</span>
                      </h3>
                      <p className="text-xs text-emerald-700/70 mt-0.5">These cards show on the Projector and accept scans.</p>
                    </div>
                  </div>
                  {liveTasks.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-emerald-700/70 text-sm font-medium">No live cards yet.</p>
                      <p className="text-emerald-700/50 text-xs mt-1">Click <span className="font-bold">↑ Go Live</span> on any library card below to put it here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {liveTasks.map(t => renderCard(t, 'live'))}
                    </div>
                  )}
                </div>

                {/* Library */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
                    Library
                    <span className="ml-2 text-xs font-medium text-gray-400">({libraryTasks.length} unused)</span>
                  </h3>
                  {libraryTasks.length === 0 ? (
                    <p className="text-gray-400 text-center py-6 text-sm">All cards are currently live.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {libraryTasks.map(t => renderCard(t, 'library'))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
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
