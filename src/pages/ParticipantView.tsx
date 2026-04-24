import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCurrentTeam } from '../hooks/useCurrentTeam'
import { useTaskPages } from '../hooks/useTaskPages'
import { useTaskPhotos } from '../hooks/useTaskPhotos'
import { useTaskLinks } from '../hooks/useTaskLinks'
import { useTeamScans } from '../hooks/useTeamScans'
import { useSetting } from '../hooks/useSettings'
import { TeamRegistration } from '../components/TeamRegistration'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import { PhotoGalleryView } from '../components/PhotoGalleryView'
import { TaskLinkButtons } from '../components/TaskLinkButtons'
import { ParticleBackground } from '../components/ParticleBackground'
import { LanguageToggle } from '../components/LanguageToggle'
import { T, useT } from '../components/T'
import type { Task } from '../types/database'

export function ParticipantView() {
  const { taskId } = useParams<{ taskId: string }>()
  const { team, memberName, loading: teamLoading, isRegistered, createTribe, joinTribe, searchTribes, leaveTribe } = useCurrentTeam()
  const { pages, loading: pagesLoading } = useTaskPages(taskId)
  const { photos, loading: photosLoading } = useTaskPhotos(taskId)
  const { links } = useTaskLinks(taskId)
  const { recordScan, toggleComplete } = useTeamScans()
  const [marshalPassword] = useSetting('marshal_password', '1234')
  const [marshalInput, setMarshalInput] = useState('')
  const [marshalError, setMarshalError] = useState('')
  const [task, setTask] = useState<Task | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [scanRecorded, setScanRecorded] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [scanRecord, setScanRecord] = useState<{ id: string; completed: boolean } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const wrongMarshalMsg = useT('Wrong marshal password.')
  const completingLabel = useT('Completing...')
  const completeLabel = useT('Complete Activity ✅')

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await leaveTribe()
      setScanRecorded(false)
      setScanRecord(null)
      setShowLeaveConfirm(false)
    } finally {
      setLeaving(false)
    }
  }

  useEffect(() => {
    if (!taskId) return
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) setTask(data)
    })
  }, [taskId])

  useEffect(() => {
    if (team && taskId && !scanRecorded && task?.is_live) {
      recordScan(team.id, taskId).then((scan) => {
        setScanRecorded(true)
        if (scan) setScanRecord({ id: scan.id, completed: scan.completed })
      })
    }
  }, [team, taskId, scanRecorded, recordScan, task])

  if (teamLoading || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-xl font-bold animate-pulse"><T>Loading...</T></div>
      </div>
    )
  }

  if (!task.is_live) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-sm text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-black text-gray-800 mb-2"><T>Card Not Available</T></h1>
          <p className="text-sm text-gray-500"><T>This card isn't live right now. Please check back later or ask a facilitator.</T></p>
          <div className="mt-4 flex justify-center"><LanguageToggle variant="light" /></div>
        </div>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <TeamRegistration
        onCreateTribe={createTribe}
        onJoinTribe={joinTribe}
        onSearchTribes={searchTribes}
        hexCode={task.hex_code}
        taskTitle={task.title}
      />
    )
  }

  if (pagesLoading || photosLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-xl font-bold animate-pulse"><T>Loading instructions...</T></div>
      </div>
    )
  }

  // Full-screen splash on first load
  if (showSplash) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{ backgroundColor: task.hex_code }}
        onClick={() => setShowSplash(false)}
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        {/* Language toggle */}
        <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
          <LanguageToggle />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-8 animate-bounce-in">
          <div className="text-6xl mb-6">🚩</div>
          <p className="text-sm font-bold opacity-70 uppercase tracking-[0.2em] mb-2">
            <T>{`${task.color} Flag`}</T>
          </p>
          <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight">
            <T>{task.title}</T>
          </h1>
          <div className="w-16 h-1 bg-white/40 rounded-full mx-auto mb-6" />
          <p className="text-lg opacity-80 font-medium mb-2">
            {memberName} · {team?.name}
          </p>
        </div>

        {/* Start button */}
        <button
          className="relative z-10 mt-8 px-10 py-4 bg-white/20 backdrop-blur-sm rounded-2xl text-xl font-black uppercase tracking-wider border-2 border-white/30 hover:bg-white/30 active:scale-95 transition-all animate-slide-up"
          style={{ animationDelay: '0.4s' }}
          onClick={(e) => { e.stopPropagation(); setShowSplash(false) }}
        >
          <T>Start Challenge</T>
        </button>

        <p className="relative z-10 mt-4 text-sm opacity-50 animate-pulse">
          <T>Tap anywhere to begin</T>
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: `color-mix(in srgb, ${task.hex_code} 50%, #0a0a0a)` }}>
      <ParticleBackground hexCode={task.hex_code} />

      {/* Header */}
      <header className="px-6 py-5 text-white relative z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: task.hex_code, opacity: 0.35 }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="max-w-lg mx-auto relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold opacity-80 uppercase tracking-wider">{memberName} · {team?.name}</p>
            <h1 className="text-3xl font-black tracking-tight"><T>{task.title}</T></h1>
            <div className="text-sm opacity-70 mt-1 uppercase tracking-wider"><T>{`${task.color} Flag Challenge`}</T></div>
          </div>
          <div className="flex-shrink-0 mt-1 flex items-center gap-2">
            <LanguageToggle />
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <T>Leave</T>
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <p className="text-xs text-white/60"><T>Leave tribe?</T></p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    <T>Cancel</T>
                  </button>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors disabled:opacity-50"
                  >
                    {leaving ? '...' : <T>Yes, leave</T>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 relative z-10">
        {pages.length === 0 && photos.length === 0 && links.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <T>No instructions available for this task yet.</T>
          </div>
        ) : (
          <>
            {pages.length > 0 && (
              <>
                <InstructionPage page={pages[currentPage]} hexCode={task.hex_code} />
                <PageNavigator
                  current={currentPage}
                  total={pages.length}
                  onPrev={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  onNext={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                  hexCode={task.hex_code}
                />
              </>
            )}

            {/* Photo clue gallery */}
            {photos.length > 0 && (
              <div className={pages.length > 0 ? 'mt-8' : ''}>
                <PhotoGalleryView
                  photos={photos}
                  hexCode={task.hex_code}
                />
              </div>
            )}

            {/* External link buttons */}
            {links.length > 0 && (
              <div className={pages.length > 0 || photos.length > 0 ? 'mt-8' : ''}>
                <TaskLinkButtons links={links} hexCode={task.hex_code} />
              </div>
            )}

            {/* Complete Activity Section */}
            <div className="mt-8 animate-slide-up">
              {scanRecord?.completed ? (
                <div className="text-center">
                  <div
                    className="p-6 rounded-2xl border-2"
                    style={{ backgroundColor: `${task.hex_code}25`, borderColor: `${task.hex_code}66` }}
                  >
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-2xl font-black mb-1 text-white">
                      <T>Activity Complete!</T>
                    </p>
                    <p className="text-white/60 text-sm font-medium">
                      <T>Great job,</T> {team?.name} 🎉
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!scanRecord) return
                      setCompleting(true)
                      try {
                        await toggleComplete(scanRecord.id, false)
                        setScanRecord({ ...scanRecord, completed: false })
                      } finally { setCompleting(false) }
                    }}
                    disabled={completing}
                    className="mt-3 px-4 py-2 text-sm text-white/40 hover:text-red-400 transition-colors"
                  >
                    <T>Undo completion</T>
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-3xl p-5 border-2 animate-pulse-border"
                  style={{
                    borderColor: `${task.hex_code}99`,
                    backgroundColor: `${task.hex_code}18`,
                    boxShadow: `0 0 24px ${task.hex_code}44, inset 0 0 24px ${task.hex_code}11`,
                  }}
                >
                  {/* Animated warning */}
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-yellow-400/20 border border-yellow-400/50 animate-attention">
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span className="text-2xl">👮</span>
                      <span className="text-xs text-yellow-300 font-black uppercase tracking-tight leading-none"><T>Marshal</T></span>
                    </div>
                    <p className="text-yellow-200 text-sm font-black uppercase tracking-wide leading-snug">
                      <T>Enter the Marshal password to complete this challenge.</T>
                    </p>
                    <span className="text-2xl flex-shrink-0">🛑</span>
                  </div>

                  {/* Marshal 4-digit password input */}
                  <div className="mb-4">
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={marshalInput}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                        setMarshalInput(digits)
                        setMarshalError('')
                      }}
                      placeholder="• • • •"
                      className="w-full px-4 py-3 rounded-2xl border-2 text-center text-2xl font-black tracking-[0.6em] focus:outline-none transition-colors bg-white/10 text-white placeholder-white/30"
                      style={{ borderColor: marshalError ? '#ef4444' : marshalInput ? task.hex_code : 'rgba(255,255,255,0.2)' }}
                    />
                    {marshalError && (
                      <p className="text-red-400 text-xs font-bold text-center mt-2">{marshalError}</p>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      if (!scanRecord) return
                      if (marshalInput.trim() !== marshalPassword) {
                        setMarshalError(wrongMarshalMsg)
                        return
                      }
                      setCompleting(true)
                      try {
                        await toggleComplete(scanRecord.id, true)
                        setScanRecord({ ...scanRecord, completed: true })
                        setMarshalInput('')
                      } finally { setCompleting(false) }
                    }}
                    disabled={completing || !scanRecord}
                    className="w-full py-4 rounded-2xl text-white text-xl font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      backgroundColor: task.hex_code,
                      boxShadow: `0 6px 0 ${task.hex_code}88, 0 8px 20px ${task.hex_code}44`,
                    }}
                  >
                    {completing ? completingLabel : completeLabel}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
