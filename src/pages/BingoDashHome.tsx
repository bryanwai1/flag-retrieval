import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useBingoDashTeam } from '../hooks/useBingoDashTeam'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoTask, BingoScan, BingoSettings } from '../types/database'

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const GRID_SIZE = 25 // 5×5

// All 12 possible bingo lines: 5 rows + 5 cols + 2 diagonals
const BINGO_LINES = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]

const BINGO_WORD = 'BINGO'

// ── Join Screen ───────────────────────────────────────────────────────────────

function JoinScreen({ onRegister }: { onRegister: (name: string, password: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onRegister(name.trim(), password.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <ParticleBackground />

      <div className="relative z-10 text-center mb-10 animate-slide-up">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-5xl font-black text-white tracking-tight">BINGO DASH</h1>
        <p className="text-gray-400 mt-3 text-lg">Complete challenges · Scan tiles · Win</p>
      </div>

      <div
        className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-bounce-in"
        style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}
      >
        <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Join Game</h2>
        <p className="text-gray-400 text-center text-sm mb-6">Enter your team name and password</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="Team name..."
            className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
            style={{ borderColor: name ? '#a855f7' : '#e5e7eb' }}
            autoFocus
            maxLength={40}
            disabled={submitting}
          />

          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password..."
            className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
            style={{ borderColor: password ? '#a855f7' : '#e5e7eb' }}
            maxLength={40}
            disabled={submitting}
          />

          {error && (
            <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span>🚫</span>
              <p className="text-red-600 font-bold text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95 mt-1"
            style={{ backgroundColor: '#a855f7', boxShadow: '0 8px 24px #a855f744' }}
          >
            {submitting ? 'Joining...' : 'Join Game →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-5">
          Use the same name + password to re-join your team.
        </p>
      </div>
    </div>
  )
}

// ── Bingo Tile ────────────────────────────────────────────────────────────────

type TileStatus = 'locked' | 'scanned' | 'completed'

function BingoTile({
  task,
  status,
  isInBingoLine,
  onClick,
}: {
  task: BingoTask
  status: TileStatus
  isInBingoLine: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center aspect-square transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
      style={{
        backgroundColor: task.hex_code,
        boxShadow: status === 'completed'
          ? isInBingoLine
            ? `0 0 0 3px #fde68a, 0 0 0 5px ${task.hex_code}, 0 6px 24px ${task.hex_code}cc`
            : `0 0 0 3px white, 0 0 0 5px ${task.hex_code}, 0 6px 20px ${task.hex_code}88`
          : `0 3px 10px ${task.hex_code}55`,
        opacity: status === 'locked' ? 0.72 : 1,
      }}
    >
      {/* Bingo-line golden shimmer */}
      {isInBingoLine && status === 'completed' && (
        <div className="absolute inset-0 bg-yellow-300/10 z-0 pointer-events-none" />
      )}

      {/* Completed overlay */}
      {status === 'completed' && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
          <div
            className="bg-white/90 rounded-full w-7 h-7 flex items-center justify-center shadow"
            style={isInBingoLine ? { boxShadow: '0 0 8px #fbbf24' } : {}}
          >
            <span className="text-sm font-black text-green-600">✓</span>
          </div>
        </div>
      )}

      {/* Scanned ring */}
      {status === 'scanned' && (
        <div className="absolute top-1.5 right-1.5 z-10 w-2.5 h-2.5 rounded-full border-2 border-white/80" />
      )}

      <div className="relative z-0 px-2 py-2 text-center flex flex-col items-center gap-1">
        <p className="text-white/70 text-[9px] font-black uppercase tracking-widest leading-none">
          {task.color}
        </p>
        <h3 className="text-white font-black text-[11px] leading-tight line-clamp-3">
          {task.title}
        </h3>
      </div>

      {/* Points badge */}
      {(task.points ?? 0) > 0 && (
        <div className="absolute bottom-1 right-1 z-10 bg-black/40 text-white text-[8px] font-black rounded px-1 leading-tight">
          {task.points}
        </div>
      )}
    </button>
  )
}

function EmptyTile() {
  return (
    <div className="rounded-xl aspect-square bg-white/5 border border-white/10" />
  )
}

// ── Bingo Popup ───────────────────────────────────────────────────────────────

function BingoPopup({ letters, onDismiss }: { letters: string; onDismiss: () => void }) {
  const isFull = letters === 'BINGO'
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: 'radial-gradient(ellipse at center, #1e0a3c 0%, rgba(0,0,0,0.92) 70%)' }}
      onClick={onDismiss}
    >
      <div className="text-center animate-bounce-in">
        {/* Collected letters with individual letter boxes */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {BINGO_WORD.split('').map((letter, i) => {
            const earned = i < letters.length
            return (
              <div
                key={letter}
                className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl transition-all"
                style={{
                  backgroundColor: earned ? '#a855f7' : 'rgba(255,255,255,0.05)',
                  color: earned ? '#fff' : 'rgba(255,255,255,0.15)',
                  boxShadow: earned ? '0 0 20px #a855f7aa' : 'none',
                  transform: earned ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {letter}
              </div>
            )
          })}
        </div>

        {/* Announcement */}
        <div
          className="font-black tracking-widest leading-none text-white"
          style={{
            fontSize: 'clamp(4rem, 18vw, 7rem)',
            textShadow: isFull
              ? '0 0 30px #fbbf24, 0 0 60px #f59e0b, 0 0 90px #fbbf24'
              : '0 0 30px #a855f7, 0 0 60px #ec4899',
          }}
        >
          {letters}!
        </div>

        {isFull ? (
          <p className="text-yellow-400 font-black text-xl mt-4 tracking-widest uppercase animate-pulse">
            🎉 You got BINGO! 🎉
          </p>
        ) : (
          <p className="text-purple-300 font-bold text-base mt-3 tracking-wide">
            Bingo line complete!
          </p>
        )}

        <p className="text-white/30 text-sm mt-8">Tap to continue</p>
      </div>
    </div>
  )
}

// ── Timer display ─────────────────────────────────────────────────────────────

function TimerDisplay({ settings }: { settings: BingoSettings | null }) {
  const [display, setDisplay] = useState('00:00')
  const [isRunning, setIsRunning] = useState(false)
  const [isLow, setIsLow] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      if (!settings) { setDisplay('00:00'); setIsRunning(false); setIsLow(false); return }
      if (settings.timer_end_at) {
        const remaining = (new Date(settings.timer_end_at).getTime() - Date.now()) / 1000
        setDisplay(formatTime(remaining))
        setIsRunning(remaining > 0)
        setIsLow(remaining > 0 && remaining <= 120)
      } else {
        setDisplay(formatTime(settings.timer_seconds))
        setIsRunning(false)
        setIsLow(false)
      }
    }, 250)
    return () => clearInterval(id)
  }, [settings])

  if (!settings || (!settings.timer_end_at && settings.timer_seconds === 0)) return null

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black tabular-nums transition-colors ${
        isLow ? 'bg-red-500/20 text-red-300' : isRunning ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
      }`}
    >
      <span className={`text-xs ${isRunning ? (isLow ? 'text-red-400' : 'text-green-400') : 'text-gray-600'}`}>
        {isRunning ? '●' : '■'}
      </span>
      {display}
    </div>
  )
}

// ── Board Screen ──────────────────────────────────────────────────────────────

function BoardScreen({
  team,
  gridTasks,
  scans,
  settings,
  onLeave,
}: {
  team: { id: string; name: string }
  gridTasks: BingoTask[]
  scans: BingoScan[]
  settings: BingoSettings | null
  onLeave: () => void
}) {
  const navigate = useNavigate()
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [popupLetters, setPopupLetters] = useState<string | null>(null)
  const lastBingoCountRef = useRef<number | null>(null)

  const gridTaskIds = new Set(gridTasks.map(t => t.id))
  const completedCount = scans.filter(s => s.completed && gridTaskIds.has(s.task_id)).length

  const getStatus = (taskId: string): TileStatus => {
    const scan = scans.find(s => s.task_id === taskId)
    if (!scan) return 'locked'
    return scan.completed ? 'completed' : 'scanned'
  }

  // Build a sparse 25-slot array: each task lands at slot = sort_order (0-24).
  // Legacy rows whose sort_order is out of range or collides fall into the
  // first empty slot so the board stays consistent with the admin editor.
  const slots: (BingoTask | null)[] = (() => {
    const out: (BingoTask | null)[] = Array(GRID_SIZE).fill(null)
    const overflow: BingoTask[] = []
    for (const t of gridTasks) {
      const s = t.sort_order
      if (Number.isInteger(s) && s >= 0 && s < GRID_SIZE && out[s] === null) out[s] = t
      else overflow.push(t)
    }
    for (const t of overflow) {
      const i = out.findIndex(x => x === null)
      if (i !== -1) out[i] = t
    }
    return out
  })()

  // Determine which bingo lines are fully completed
  const completedLineIndices = BINGO_LINES.reduce((acc, line, i) => {
    const allDone = line.every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
    if (allDone) acc.add(i)
    return acc
  }, new Set<number>())

  const completedBingoCount = completedLineIndices.size

  // Which slots are part of at least one completed bingo line
  const bingoSlots = new Set<number>()
  completedLineIndices.forEach(lineIdx => {
    BINGO_LINES[lineIdx].forEach(slotIdx => bingoSlots.add(slotIdx))
  })

  // Letters earned: 1st bingo → B, 2nd → BI, etc. (capped at 5)
  const lettersEarned = BINGO_WORD.slice(0, Math.min(completedBingoCount, 5))

  // Row completions for the side BINGO letters (rows 0-4)
  const rowCompleted = [0, 1, 2, 3, 4].map(rowIdx =>
    BINGO_LINES[rowIdx].every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
  )

  // Detect new bingos and trigger popup
  useEffect(() => {
    if (lastBingoCountRef.current === null) {
      lastBingoCountRef.current = completedBingoCount
      return
    }
    if (completedBingoCount > lastBingoCountRef.current) {
      lastBingoCountRef.current = completedBingoCount
      setPopupLetters(BINGO_WORD.slice(0, Math.min(completedBingoCount, 5)))
    }
  }, [completedBingoCount])

  // Auto-dismiss popup
  useEffect(() => {
    if (!popupLetters) return
    const t = setTimeout(() => setPopupLetters(null), 4000)
    return () => clearTimeout(t)
  }, [popupLetters])

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-x-hidden">
      <ParticleBackground />

      {/* Bingo celebration popup */}
      {popupLetters && (
        <BingoPopup letters={popupLetters} onDismiss={() => setPopupLetters(null)} />
      )}

      {/* Header */}
      <header className="relative z-10 px-4 pt-5 pb-3">
        <div className="max-w-md mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest">Bingo Dash</p>
            <h1 className="text-white text-xl font-black tracking-tight leading-tight">{team.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-green-400 text-xs font-bold">{completedCount}/{gridTasks.length} completed</span>
              {lettersEarned && (
                <span className="text-purple-300 text-xs font-black tracking-widest">{lettersEarned}!</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-1">
            <TimerDisplay settings={settings} />
            {!showLeaveConfirm ? (
              <button onClick={() => setShowLeaveConfirm(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Switch Team
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <p className="text-xs text-gray-400">Switch?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLeaveConfirm(false)} className="text-xs text-gray-500">Cancel</button>
                  <button onClick={onLeave} className="text-xs text-red-400 font-bold">Yes</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-md mx-auto mt-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: gridTasks.length ? `${(completedCount / gridTasks.length) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #a855f7, #ec4899)',
              }}
            />
          </div>
        </div>
      </header>

      {/* 5×5 Grid with BINGO side letters */}
      <main className="relative z-10 px-3 pb-8">
        <div className="max-w-md mx-auto">
          {gridTasks.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-bold">No grid set up yet</p>
              <p className="text-sm mt-1">Ask your facilitator to configure the grid</p>
            </div>
          ) : (
            <div className="flex gap-2 items-start">
              {/* BINGO letters column — one per row */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                {BINGO_WORD.split('').map((letter, rowIdx) => {
                  const earned = rowCompleted[rowIdx]
                  return (
                    <div
                      key={letter}
                      className="flex items-center justify-center rounded-lg aspect-square transition-all duration-500"
                      style={{
                        width: 22,
                        backgroundColor: earned ? '#a855f7' : 'rgba(255,255,255,0.05)',
                        color: earned ? '#fff' : 'rgba(255,255,255,0.2)',
                        fontWeight: 900,
                        fontSize: 13,
                        letterSpacing: '0.05em',
                        boxShadow: earned ? '0 0 12px #a855f7aa' : 'none',
                      }}
                    >
                      {letter}
                    </div>
                  )
                })}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-5 gap-2 flex-1">
                {slots.map((task, i) =>
                  task ? (
                    <BingoTile
                      key={task.id}
                      task={task}
                      status={getStatus(task.id)}
                      isInBingoLine={bingoSlots.has(i)}
                      onClick={() => navigate(`/bingo-dash/task/${task.id}`)}
                    />
                  ) : (
                    <EmptyTile key={`empty-${i}`} />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Legend */}
      {gridTasks.length > 0 && (
        <div className="relative z-10 pb-6 flex justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-600 opacity-50" />Not visited</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400" />In progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white" />Done</span>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BingoDashHome() {
  const { team, loading: teamLoading, isRegistered, registerTeam, leaveTeam } = useBingoDashTeam()
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [settings, setSettings] = useState<BingoSettings | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  // Load grid tasks for the active section + timer settings
  useEffect(() => {
    supabase.from('bingo_settings').select('*').eq('id', 'main').single()
      .then(async ({ data: settingsData }) => {
        if (settingsData) setSettings(settingsData)
        const sectionId = settingsData?.active_section_id
        if (!sectionId) { setGridTasks([]); setDataLoading(false); return }
        const { data: taskData } = await supabase
          .from('bingo_tasks')
          .select('*')
          .eq('section_id', sectionId)
          .eq('in_grid', true)
          .order('sort_order')
          .limit(GRID_SIZE)
        if (taskData) setGridTasks(taskData)
        setDataLoading(false)
      })
  }, [])

  // Load this team's scans
  useEffect(() => {
    if (!team) { setScans([]); return }
    supabase
      .from('bingo_scans')
      .select('*')
      .eq('team_id', team.id)
      .then(({ data }) => { if (data) setScans(data) })
  }, [team])

  // Live: scan updates
  useEffect(() => {
    if (!team) return
    const channel = supabase
      .channel(`bingo-home-scans-${team.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bingo_scans', filter: `team_id=eq.${team.id}` },
        () => {
          supabase
            .from('bingo_scans')
            .select('*')
            .eq('team_id', team.id)
            .then(({ data }) => { if (data) setScans(data) })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [team])

  // Live: timer settings updates
  useEffect(() => {
    const channel = supabase
      .channel('bingo-home-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_settings' }, () => {
        supabase.from('bingo_settings').select('*').eq('id', 'main').single()
          .then(({ data }) => { if (data) setSettings(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (teamLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!isRegistered) {
    return <JoinScreen onRegister={async (name, pwd) => { await registerTeam(name, pwd) }} />
  }

  return (
    <BoardScreen
      team={team!}
      gridTasks={gridTasks}
      scans={scans}
      settings={settings}
      onLeave={leaveTeam}
    />
  )
}
