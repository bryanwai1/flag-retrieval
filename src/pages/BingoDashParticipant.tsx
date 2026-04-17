import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useBingoDashTeam } from '../hooks/useBingoDashTeam'
import { useBingoTaskPages } from '../hooks/useBingoTaskPages'
import { useBingoTaskPhotos } from '../hooks/useBingoTaskPhotos'
import { useBingoScans } from '../hooks/useBingoScans'
import { BingoDashRegistration } from '../components/BingoDashRegistration'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoTask } from '../types/database'

export function BingoDashParticipant() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const backPath = searchParams.get('from') === 'snake-ladder' ? '/snake-ladder' : '/bingo-dash'
  const { team, loading: teamLoading, isRegistered, registerTeam, leaveTeam } = useBingoDashTeam()
  const { pages, loading: pagesLoading } = useBingoTaskPages(taskId)
  const { photos, loading: photosLoading } = useBingoTaskPhotos(taskId)
  const { recordScan, toggleComplete } = useBingoScans()

  const [task, setTask] = useState<BingoTask | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [scanRecord, setScanRecord] = useState<{ id: string; completed: boolean } | null>(null)
  const [scanRecorded, setScanRecorded] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Marshal password state
  const [marshalPassword, setMarshalPassword] = useState('')
  const [marshalInput, setMarshalInput] = useState('')
  const [marshalError, setMarshalError] = useState('')
  // Answer-input state: one string per answer row
  const [answerInputs, setAnswerInputs] = useState<string[]>([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const letterRefs = useRef<(HTMLInputElement | null)[][]>([])

  const focusLetter = useCallback((rowIdx: number, charIdx: number) => {
    letterRefs.current[rowIdx]?.[charIdx]?.focus()
  }, [])

  useEffect(() => {
    if (!taskId) return
    supabase.from('bingo_tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) {
        setTask(data)
        if (data.task_type === 'answer' && data.answer_text) {
          const rows = data.answer_text.split('\n')
          // Restore saved answers from localStorage
          const saved = localStorage.getItem(`bingo-answers-${taskId}`)
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as string[]
              setAnswerInputs(rows.map((_r: string, i: number) => parsed[i] ?? ''))
            } catch { setAnswerInputs(rows.map(() => '')) }
          } else {
            setAnswerInputs(rows.map(() => ''))
          }
        }
      }
    })
  }, [taskId])

  // Load marshal password from settings
  useEffect(() => {
    supabase.from('bingo_settings').select('marshal_password').eq('id', 'main').single()
      .then(({ data }) => { if (data?.marshal_password) setMarshalPassword(data.marshal_password) })
  }, [])

  // Persist answer inputs to localStorage
  useEffect(() => {
    if (taskId && answerInputs.length > 0) {
      localStorage.setItem(`bingo-answers-${taskId}`, JSON.stringify(answerInputs))
    }
  }, [taskId, answerInputs])

  // Derived: the answer rows expected by the task
  const answerRows = task?.task_type === 'answer' && task.answer_text
    ? task.answer_text.split('\n').map(r => r.trim())
    : []

  const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase()

  // True when every row is fully and correctly filled (case-insensitive)
  const answerMatches = answerRows.length > 0 && answerRows.every(
    (row, i) => normalize(answerInputs[i] ?? '') === normalize(row)
  )

  useEffect(() => {
    if (team && taskId && !scanRecorded) {
      recordScan(team.id, taskId).then((scan) => {
        setScanRecorded(true)
        if (scan) setScanRecord({ id: scan.id, completed: scan.completed })
      })
    }
  }, [team, taskId, scanRecorded, recordScan])

  // Auto-complete when answer-input card answer is correct
  useEffect(() => {
    if (!answerMatches || !scanRecord || scanRecord.completed || completing) return
    setCompleting(true)
    toggleComplete(scanRecord.id, true).then(() => {
      setScanRecord(prev => prev ? { ...prev, completed: true } : prev)
      setCompleting(false)
    })
  }, [answerMatches]) // eslint-disable-line react-hooks/exhaustive-deps

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
              onClick={() => navigate(backPath)}
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
        {/* Photo carousel */}
        {photos.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-6 shadow-xl animate-slide-up">
            <div className="relative">
              <img
                src={photos[carouselIdx]?.photo_url}
                alt={`${task.title} ${carouselIdx + 1}`}
                className="w-full max-h-72 object-cover"
                style={{ objectPosition: `${photos[carouselIdx]?.position_x ?? 50}% ${photos[carouselIdx]?.position_y ?? 50}%` }}
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCarouselIdx(i => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold backdrop-blur-sm active:scale-90 transition-transform"
                  >‹</button>
                  <button
                    onClick={() => setCarouselIdx(i => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold backdrop-blur-sm active:scale-90 transition-transform"
                  >›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCarouselIdx(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === carouselIdx ? 'bg-white scale-125' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {photos[carouselIdx]?.caption && (
              <div className="px-4 py-2 text-xs text-white/70 font-medium" style={{ backgroundColor: `${task.hex_code}cc` }}>
                {photos[carouselIdx].caption}
              </div>
            )}
          </div>
        )}

        {/* Instruction pointers */}
        {pages.length > 0 ? (
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
                    if (task.task_type === 'answer') {
                      setAnswerInputs(answerRows.map(() => ''))
                    }
                  } finally { setCompleting(false) }
                }}
                disabled={completing}
                className="mt-3 px-4 py-2 text-sm text-white/40 hover:text-red-400 transition-colors"
              >
                Undo completion
              </button>
            </div>
          ) : task.task_type === 'answer' ? (
            /* ── Answer-input card (letter boxes) ─────────────── */
            <div
              className="rounded-3xl p-5 border-2"
              style={{
                borderColor: `${task.hex_code}99`,
                backgroundColor: `${task.hex_code}18`,
                boxShadow: `0 0 24px ${task.hex_code}44, inset 0 0 24px ${task.hex_code}11`,
              }}
            >
              {task.answer_question && (
                <p className="text-white font-black text-lg mb-4 text-center leading-snug">
                  {task.answer_question}
                </p>
              )}
              <div className="flex flex-col gap-5">
                {answerRows.map((row, rowIdx) => {
                  const letters = row.replace(/\s/g, '').split('')
                  const typed = answerInputs[rowIdx] ?? ''
                  const rowCorrect = normalize(typed) === normalize(row.replace(/\s/g, ''))
                  if (!letterRefs.current[rowIdx]) letterRefs.current[rowIdx] = []
                  return (
                    <div key={rowIdx} className="flex flex-col items-center gap-2">
                      {answerRows.length > 1 && (
                        <label className="text-white/50 text-xs font-bold uppercase tracking-wider">
                          Word {rowIdx + 1}
                        </label>
                      )}
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        {letters.map((_, charIdx) => {
                          const typedChar = typed[charIdx] ?? ''
                          const expectedChar = letters[charIdx]
                          const charCorrect = typedChar.length > 0 && typedChar.toLowerCase() === expectedChar.toLowerCase()
                          const charWrong = typedChar.length > 0 && !charCorrect
                          return (
                            <input
                              key={charIdx}
                              ref={el => { letterRefs.current[rowIdx][charIdx] = el }}
                              type="text"
                              inputMode="text"
                              autoCapitalize="characters"
                              autoComplete="off"
                              maxLength={1}
                              value={typedChar.toUpperCase()}
                              onChange={e => {
                                const ch = e.target.value.slice(-1).replace(/[^a-zA-Z0-9]/g, '')
                                if (!ch) return
                                setAnswerInputs(prev => {
                                  const next = [...prev]
                                  const arr = (next[rowIdx] ?? '').split('')
                                  while (arr.length <= charIdx) arr.push('')
                                  arr[charIdx] = ch
                                  next[rowIdx] = arr.join('')
                                  return next
                                })
                                if (charIdx < letters.length - 1) focusLetter(rowIdx, charIdx + 1)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Backspace') {
                                  e.preventDefault()
                                  const current = typed[charIdx] ?? ''
                                  if (current) {
                                    setAnswerInputs(prev => {
                                      const next = [...prev]
                                      const arr = (next[rowIdx] ?? '').split('')
                                      arr[charIdx] = ''
                                      next[rowIdx] = arr.join('')
                                      return next
                                    })
                                  } else if (charIdx > 0) {
                                    setAnswerInputs(prev => {
                                      const next = [...prev]
                                      const arr = (next[rowIdx] ?? '').split('')
                                      arr[charIdx - 1] = ''
                                      next[rowIdx] = arr.join('')
                                      return next
                                    })
                                    focusLetter(rowIdx, charIdx - 1)
                                  }
                                } else if (e.key === 'ArrowLeft' && charIdx > 0) {
                                  focusLetter(rowIdx, charIdx - 1)
                                } else if (e.key === 'ArrowRight' && charIdx < letters.length - 1) {
                                  focusLetter(rowIdx, charIdx + 1)
                                }
                              }}
                              onFocus={e => e.target.select()}
                              className={`w-10 h-12 text-center text-xl font-black rounded-lg border-2 outline-none transition-all ${
                                rowCorrect
                                  ? 'border-green-400 bg-green-400/20 text-green-300'
                                  : charCorrect
                                  ? 'border-green-400/60 bg-green-400/10 text-green-300'
                                  : charWrong
                                  ? 'border-red-400/60 bg-red-400/10 text-red-300'
                                  : 'border-white/30 bg-black/30 text-white'
                              }`}
                              style={{ caretColor: 'transparent' }}
                            />
                          )
                        })}
                      </div>
                      {rowCorrect && (
                        <span className="text-green-400 text-xs font-bold mt-0.5">✓ Correct!</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {!answerMatches && (
                <p className="text-white/40 text-xs text-center mt-4">Fill in the letters above</p>
              )}
            </div>
          ) : (
            /* ── Standard card ─────────────────────────────────── */
            <div
              className="rounded-3xl p-5 border-2 animate-pulse-border"
              style={{
                borderColor: `${task.hex_code}99`,
                backgroundColor: `${task.hex_code}18`,
                boxShadow: `0 0 24px ${task.hex_code}44, inset 0 0 24px ${task.hex_code}11`,
              }}
            >
              {task.require_marshal && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-yellow-400/20 border border-yellow-400/50 animate-attention">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <span className="text-2xl">👮</span>
                    <span className="text-xs text-yellow-300 font-black uppercase tracking-tight leading-none">Marshal</span>
                  </div>
                  <p className="text-yellow-200 text-sm font-black uppercase tracking-wide leading-snug">
                    {task.completion_warning || 'Enter the Marshal password to complete this challenge.'}
                  </p>
                  <span className="text-2xl flex-shrink-0">🛑</span>
                </div>
              )}

              {task.require_marshal && (
                <div className="mb-4">
                  <input
                    type="password"
                    value={marshalInput}
                    onChange={e => { setMarshalInput(e.target.value); setMarshalError('') }}
                    placeholder="Marshal password..."
                    className="w-full px-4 py-3 rounded-2xl border-2 text-center text-lg font-bold focus:outline-none transition-colors bg-white/10 text-white placeholder-white/30"
                    style={{ borderColor: marshalError ? '#ef4444' : marshalInput ? task.hex_code : 'rgba(255,255,255,0.2)' }}
                  />
                  {marshalError && (
                    <p className="text-red-400 text-xs font-bold text-center mt-2">{marshalError}</p>
                  )}
                </div>
              )}

              <button
                onClick={async () => {
                  if (!scanRecord) return
                  if (task.require_marshal) {
                    if (marshalInput.trim() !== marshalPassword) {
                      setMarshalError('Wrong marshal password.')
                      return
                    }
                  }
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
            onClick={() => navigate(backPath)}
            className="w-full py-3.5 rounded-2xl text-white/70 font-bold text-sm uppercase tracking-wider border border-white/20 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            ← Return to Board
          </button>
        </div>
      </main>
    </div>
  )
}
