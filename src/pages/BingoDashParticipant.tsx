import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useBingoDashTeam } from '../hooks/useBingoDashTeam'
import { useBingoTaskPages } from '../hooks/useBingoTaskPages'
import { useBingoTaskPhotos } from '../hooks/useBingoTaskPhotos'
import { useBingoScans } from '../hooks/useBingoScans'
import { BingoDashRegistration } from '../components/BingoDashRegistration'
import { InstructionPage } from '../components/InstructionPage'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoTask } from '../types/database'

export function BingoDashParticipant() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { team, loading: teamLoading, isRegistered, registerTeam, leaveTeam } = useBingoDashTeam()
  const { pages, loading: pagesLoading } = useBingoTaskPages(taskId)
  const { photos, loading: photosLoading } = useBingoTaskPhotos(taskId)
  const { recordScan, toggleComplete } = useBingoScans()

  const [task, setTask] = useState<BingoTask | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [scanRecord, setScanRecord] = useState<{ id: string; completed: boolean } | null>(null)
  const [scanRecorded, setScanRecorded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!taskId) return
    supabase.from('bingo_tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) setTask(data)
    })
  }, [taskId])

  useEffect(() => {
    if (team && taskId && !scanRecorded) {
      recordScan(team.id, taskId).then((scan) => {
        setScanRecorded(true)
        if (scan) setScanRecord({ id: scan.id, completed: scan.completed })
      })
    }
  }, [team, taskId, scanRecorded, recordScan])

  const handleLeave = async () => {
    setLeaving(true)
    leaveTeam()
    setScanRecorded(false)
    setScanRecord(null)
    setShowLeaveConfirm(false)
    setLeaving(false)
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (teamLoading || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  // ── Registration ─────────────────────────────────────────────────────
  if (!isRegistered) {
    return (
      <BingoDashRegistration
        onRegister={(name, pwd) => registerTeam(name, pwd)}
        hexCode={task.hex_code}
        taskTitle={task.title}
      />
    )
  }

  if (pagesLoading || photosLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading challenge...</div>
      </div>
    )
  }

  const heroPhoto = photos[0] ?? null

  // ── Splash ───────────────────────────────────────────────────────────
  if (showSplash) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{ backgroundColor: task.hex_code }}
        onClick={() => setShowSplash(false)}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 text-center px-8 animate-bounce-in">
          <div className="text-6xl mb-6">🎯</div>
          <p className="text-sm font-bold opacity-70 uppercase tracking-[0.2em] mb-2">
            {task.color} Challenge
          </p>
          <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight">
            {task.title}
          </h1>
          <div className="w-16 h-1 bg-white/40 rounded-full mx-auto mb-6" />
          <p className="text-lg opacity-80 font-medium mb-2">
            Team: {team?.name}
          </p>
        </div>

        <button
          className="relative z-10 mt-8 px-10 py-4 bg-white/20 backdrop-blur-sm rounded-2xl text-xl font-black uppercase tracking-wider border-2 border-white/30 hover:bg-white/30 active:scale-95 transition-all animate-slide-up"
          style={{ animationDelay: '0.4s' }}
          onClick={(e) => { e.stopPropagation(); setShowSplash(false) }}
        >
          Start Challenge
        </button>
        <p className="relative z-10 mt-4 text-sm opacity-50 animate-pulse">Tap anywhere to begin</p>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ backgroundColor: `color-mix(in srgb, ${task.hex_code} 50%, #0a0a0a)` }}
    >
      <ParticleBackground hexCode={task.hex_code} />

      {/* Header */}
      <header className="px-6 py-5 text-white relative z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: task.hex_code, opacity: 0.35 }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="max-w-lg mx-auto relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/bingo-dash')}
              className="mt-1 flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white/80 hover:text-white text-xs font-bold transition-colors"
            >
              ← Board
            </button>
            <div>
              <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Team: {team?.name}</p>
              <h1 className="text-3xl font-black tracking-tight">{task.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm opacity-70 uppercase tracking-wider">{task.color} Challenge</span>
                {(task.points ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20 text-white">
                    {task.points} pts
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 mt-1">
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Leave
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <p className="text-xs text-white/60">Leave team?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLeaveConfirm(false)} className="text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors disabled:opacity-50"
                  >
                    {leaving ? '...' : 'Yes, leave'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 relative z-10">
        {/* Hero photo */}
        {heroPhoto && (
          <div className="rounded-2xl overflow-hidden mb-6 shadow-xl animate-slide-up">
            <img
              src={heroPhoto.photo_url}
              alt={task.title}
              className="w-full max-h-72 object-cover"
              style={{ objectPosition: `${heroPhoto.position_x ?? 50}% ${heroPhoto.position_y ?? 50}%` }}
            />
            {heroPhoto.caption && (
              <div className="px-4 py-2 text-xs text-white/70 font-medium" style={{ backgroundColor: `${task.hex_code}cc` }}>
                {heroPhoto.caption}
              </div>
            )}
          </div>
        )}

        {/* Instruction pointers */}
        {pages.length > 0 ? (
          <InstructionPage page={pages[0]} hexCode={task.hex_code} />
        ) : (
          <div className="text-center py-12 text-gray-400">
            No instructions available for this challenge yet.
          </div>
        )}

        {/* Complete Activity */}
        <div className="mt-8 animate-slide-up">
          {scanRecord?.completed ? (
            <div className="text-center">
              <div
                className="p-6 rounded-2xl border-2"
                style={{ backgroundColor: `${task.hex_code}25`, borderColor: `${task.hex_code}66` }}
              >
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-2xl font-black mb-1 text-white">Challenge Complete!</p>
                <p className="text-white/60 text-sm font-medium">Great job, {team?.name}!</p>
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
                Undo completion
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
              <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-yellow-400/20 border border-yellow-400/50 animate-attention">
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <span className="text-2xl">👮</span>
                  <span className="text-xs text-yellow-300 font-black uppercase tracking-tight leading-none">Marshal</span>
                </div>
                <p className="text-yellow-200 text-sm font-black uppercase tracking-wide leading-snug">
                  Only tap Complete <span className="text-yellow-300 underline underline-offset-2">after</span> receiving your Completion Card from the Marshal!
                </p>
                <span className="text-2xl flex-shrink-0">🛑</span>
              </div>
              <button
                onClick={async () => {
                  if (!scanRecord) return
                  setCompleting(true)
                  try {
                    await toggleComplete(scanRecord.id, true)
                    setScanRecord({ ...scanRecord, completed: true })
                  } finally { setCompleting(false) }
                }}
                disabled={completing || !scanRecord}
                className="w-full py-4 rounded-2xl text-white text-xl font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: task.hex_code,
                  boxShadow: `0 6px 0 ${task.hex_code}88, 0 8px 20px ${task.hex_code}44`,
                }}
              >
                {completing ? 'Completing...' : 'Complete Challenge ✅'}
              </button>
            </div>
          )}
        </div>
        {/* Return to board */}
        <div className="mt-6 animate-slide-up">
          <button
            onClick={() => navigate('/bingo-dash')}
            className="w-full py-3.5 rounded-2xl text-white/70 font-bold text-sm uppercase tracking-wider border border-white/20 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            ← Return to Board
          </button>
        </div>
      </main>
    </div>
  )
}
