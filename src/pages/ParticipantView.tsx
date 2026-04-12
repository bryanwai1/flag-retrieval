import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCurrentTeam } from '../hooks/useCurrentTeam'
import { useTaskPages } from '../hooks/useTaskPages'
import { useTeamScans } from '../hooks/useTeamScans'
import { TeamRegistration } from '../components/TeamRegistration'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import type { Task } from '../types/database'

export function ParticipantView() {
  const { taskId } = useParams<{ taskId: string }>()
  const { team, loading: teamLoading, isRegistered, register } = useCurrentTeam()
  const { pages, loading: pagesLoading } = useTaskPages(taskId)
  const { recordScan } = useTeamScans()
  const [task, setTask] = useState<Task | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [scanRecorded, setScanRecorded] = useState(false)

  useEffect(() => {
    if (!taskId) return
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) setTask(data)
    })
  }, [taskId])

  useEffect(() => {
    if (team && taskId && !scanRecorded) {
      recordScan(team.id, taskId).then(() => setScanRecorded(true))
    }
  }, [team, taskId, scanRecorded, recordScan])

  if (teamLoading || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <TeamRegistration
        onRegister={async (name) => { await register(name) }}
        hexCode={task.hex_code}
        taskTitle={task.title}
      />
    )
  }

  if (pagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading instructions...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="px-6 py-5 text-white relative overflow-hidden"
        style={{ backgroundColor: task.hex_code }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="max-w-lg mx-auto relative z-10">
          <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Team: {team?.name}</p>
          <h1 className="text-3xl font-black tracking-tight">{task.title}</h1>
          <div className="text-sm opacity-70 mt-1 uppercase tracking-wider">{task.color} Flag Challenge</div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        {pages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No instructions available for this task yet.
          </div>
        ) : (
          <>
            <InstructionPage page={pages[currentPage]} hexCode={task.hex_code} />
            <PageNavigator
              current={currentPage}
              total={pages.length}
              onPrev={() => setCurrentPage((p) => Math.max(0, p - 1))}
              onNext={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              hexCode={task.hex_code}
            />
            {currentPage === pages.length - 1 && (
              <div className="mt-8 text-center p-6 rounded-2xl border-2 animate-slide-up" style={{ backgroundColor: `${task.hex_code}11`, borderColor: `${task.hex_code}33` }}>
                <p className="text-2xl font-black mb-2" style={{ color: task.hex_code }}>
                  You're done!
                </p>
                <p className="text-gray-600 font-medium">
                  Go back to the marshal with your completion card to finish this challenge!
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
