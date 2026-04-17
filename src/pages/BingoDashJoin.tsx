import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import type { BingoTask, BingoScan, BingoSection, BingoSettings, BingoTeam, BingoMember } from '../types/database'

/* ── helpers ─────────────────────────────────────────────────────────────────── */

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const GRID_SIZE = 25
const BINGO_WORD = 'BINGO'
const BINGO_LINES = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
]

const MEMBER_ID_KEY = (sectionSlug: string) => `bingo-join-member-${sectionSlug}`
const MEMBER_DATA_KEY = (sectionSlug: string) => `bingo-join-member-data-${sectionSlug}`
const TEAM_ID_KEY = (sectionSlug: string) => `bingo-join-team-${sectionSlug}`
const TEAM_DATA_KEY = (sectionSlug: string) => `bingo-join-data-${sectionSlug}`

type TileStatus = 'locked' | 'scanned' | 'completed'

/* ── Join Screen (2-step funnel) ──────────────────────────────────────────────── */

function JoinScreen({
  sectionName,
  sectionId,
  groups,
  onJoinGroup,
}: {
  sectionName: string
  sectionId: string
  groups: BingoTeam[]
  onJoinGroup: (memberName: string, password: string, teamId: string) => Promise<void>
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: check if returning member
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { data: existing } = await supabase
        .from('bingo_members')
        .select('*')
        .eq('section_id', sectionId)
        .ilike('name', name.trim())
        .maybeSingle()

      if (existing) {
        if (existing.password !== password.trim()) {
          setError('Wrong password for this name.')
          setSubmitting(false)
          return
        }
        await onJoinGroup(name.trim(), password.trim(), existing.team_id)
        return
      }
      setSubmitting(false)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  // Step 2: pick a group
  const handlePickGroup = async (teamId: string) => {
    setSubmitting(true)
    setError('')
    try {
      await onJoinGroup(name.trim(), password.trim(), teamId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group')
      setSubmitting(false)
    }
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <ParticleBackground />

      <div className="relative z-10 text-center mb-10 animate-slide-up">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-5xl font-black text-white tracking-tight">BINGO DASH</h1>
        <p className="text-purple-400 mt-2 text-base font-bold">{sectionName}</p>
        <p className="text-gray-400 mt-1 text-sm">Complete challenges &middot; Scan tiles &middot; Win</p>
      </div>

      {step === 1 && (
        <div
          className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-bounce-in"
          style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}
        >
          <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Join Game</h2>
          <p className="text-gray-400 text-center text-sm mb-6">Enter your name and password</p>

          <form onSubmit={handleNext} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Your name..."
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
              {submitting ? 'Checking...' : 'Next →'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-5">
            Use the same name + password to re-join your group.
          </p>
        </div>
      )}

      {step === 2 && (
        <div
          className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-bounce-in"
          style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}
        >
          <button
            onClick={() => { setStep(1); setError('') }}
            className="text-sm text-purple-500 font-bold mb-4 hover:text-purple-700 transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Join a Group</h2>
          <p className="text-gray-400 text-center text-sm mb-4">
            Hi <span className="text-purple-500 font-bold">{name}</span>! Pick your group.
          </p>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full px-4 py-3 rounded-2xl border-2 text-base font-medium focus:outline-none transition-colors text-center mb-3"
            style={{ borderColor: search ? '#a855f7' : '#e5e7eb' }}
            autoFocus
          />

          {error && (
            <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
              <span>🚫</span>
              <p className="text-red-600 font-bold text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">
                {search ? 'No groups match your search.' : 'No groups available yet.'}
              </p>
            ) : (
              filteredGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handlePickGroup(group.id)}
                  disabled={submitting}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200 text-left font-bold text-gray-800 text-lg hover:border-purple-400 hover:bg-purple-50 transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                >
                  {group.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Bingo Tile ──────────────────────────────────────────────────────────────── */

function BingoTile({
  task, status, isInBingoLine, onClick,
}: {
  task: BingoTask; status: TileStatus; isInBingoLine: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-lg overflow-hidden flex items-center justify-center aspect-square transition-all duration-200 active:scale-95 focus:outline-none"
      style={{
        backgroundColor: task.hex_code,
        boxShadow: status === 'completed'
          ? isInBingoLine
            ? `0 0 0 2px #fde68a, 0 0 0 3px ${task.hex_code}`
            : `0 0 0 2px white, 0 0 0 3px ${task.hex_code}`
          : 'none',
        opacity: status === 'locked' ? 0.65 : 1,
      }}
    >
      {isInBingoLine && status === 'completed' && (
        <div className="absolute inset-0 bg-yellow-300/10 z-0 pointer-events-none" />
      )}
      {status === 'completed' && (
        <div className="absolute inset-0 bg-black/25 flex items-center justify-center z-10">
          <div
            className="bg-white/90 rounded-full w-5 h-5 flex items-center justify-center"
            style={isInBingoLine ? { boxShadow: '0 0 6px #fbbf24' } : {}}
          >
            <span className="text-[10px] font-black text-green-600">✓</span>
          </div>
        </div>
      )}
      {status === 'scanned' && (
        <div className="absolute top-1 right-1 z-10 w-2 h-2 rounded-full border-2 border-white/80" />
      )}
      <div className="relative z-0 px-1 py-1 text-center">
        <h3 className="text-white font-black text-[9px] leading-tight line-clamp-3">{task.title}</h3>
      </div>
    </button>
  )
}

function EmptyTile() {
  return <div className="rounded-lg aspect-square bg-white/5 border border-white/10" />
}

/* ── Bingo Popup ─────────────────────────────────────────────────────────────── */

function BingoPopup({ letters, onDismiss }: { letters: string; onDismiss: () => void }) {
  const isFull = letters === 'BINGO'
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: 'radial-gradient(ellipse at center, #1e0a3c 0%, rgba(0,0,0,0.92) 70%)' }}
      onClick={onDismiss}
    >
      <div className="text-center animate-bounce-in">
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
            You got BINGO!
          </p>
        ) : (
          <p className="text-purple-300 font-bold text-base mt-3 tracking-wide">Bingo line complete!</p>
        )}
        <p className="text-white/30 text-sm mt-8">Tap to continue</p>
      </div>
    </div>
  )
}

/* ── Timer ────────────────────────────────────────────────────────────────────── */

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
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black tabular-nums transition-colors ${
      isLow ? 'bg-red-500/20 text-red-300' : isRunning ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
    }`}>
      <span className={`text-xs ${isRunning ? (isLow ? 'text-red-400' : 'text-green-400') : 'text-gray-600'}`}>
        {isRunning ? '●' : '■'}
      </span>
      {display}
    </div>
  )
}

/* ── Board Screen ────────────────────────────────────────────────────────────── */

function BoardScreen({
  team,
  sectionName,
  sectionSlug: _sectionSlug,
  gridTasks,
  scans,
  settings,
  onLeave,
}: {
  team: { id: string; name: string }
  sectionName: string
  sectionSlug: string
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

  const completedLineIndices = BINGO_LINES.reduce((acc, line, i) => {
    const allDone = line.every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
    if (allDone) acc.add(i)
    return acc
  }, new Set<number>())

  const completedBingoCount = completedLineIndices.size
  const bingoSlots = new Set<number>()
  completedLineIndices.forEach(lineIdx => {
    BINGO_LINES[lineIdx].forEach(slotIdx => bingoSlots.add(slotIdx))
  })
  const lettersEarned = BINGO_WORD.slice(0, Math.min(completedBingoCount, 5))

  const rowCompleted = [0, 1, 2, 3, 4].map(rowIdx =>
    BINGO_LINES[rowIdx].every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
  )

  useEffect(() => {
    if (lastBingoCountRef.current === null) { lastBingoCountRef.current = completedBingoCount; return }
    if (completedBingoCount > lastBingoCountRef.current) {
      lastBingoCountRef.current = completedBingoCount
      setPopupLetters(BINGO_WORD.slice(0, Math.min(completedBingoCount, 5)))
    }
  }, [completedBingoCount])

  useEffect(() => {
    if (!popupLetters) return
    const t = setTimeout(() => setPopupLetters(null), 4000)
    return () => clearTimeout(t)
  }, [popupLetters])

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-x-hidden">
      <ParticleBackground />

      {popupLetters && <BingoPopup letters={popupLetters} onDismiss={() => setPopupLetters(null)} />}

      <header className="relative z-10 px-4 pt-5 pb-3">
        <div className="max-w-md mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest">Bingo Dash &middot; {sectionName}</p>
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

      <main className="relative z-10 px-3 pb-8">
        <div className="max-w-md mx-auto">
          {gridTasks.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-bold">No grid set up yet</p>
              <p className="text-sm mt-1">Ask your facilitator to configure the grid</p>
            </div>
          ) : (
            <div className="flex gap-1.5 items-start">
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {BINGO_WORD.split('').map((letter, rowIdx) => {
                  const earned = rowCompleted[rowIdx]
                  return (
                    <div
                      key={letter}
                      className="flex items-center justify-center rounded aspect-square transition-all duration-500"
                      style={{
                        width: 18,
                        backgroundColor: earned ? '#a855f7' : 'rgba(255,255,255,0.05)',
                        color: earned ? '#fff' : 'rgba(255,255,255,0.2)',
                        fontWeight: 900, fontSize: 10, letterSpacing: '0.05em',
                        boxShadow: earned ? '0 0 8px #a855f7aa' : 'none',
                      }}
                    >
                      {letter}
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-5 gap-1.5 flex-1">
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

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export function BingoDashJoin() {
  const { sectionSlug } = useParams<{ sectionSlug: string }>()
  const [section, setSection] = useState<BingoSection | null>(null)
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null)
  const [groups, setGroups] = useState<BingoTeam[]>([])
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [settings, setSettings] = useState<BingoSettings | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'not-found' | 'join' | 'board'>('loading')

  // Resolve section by slug
  useEffect(() => {
    if (!sectionSlug) { setPageState('not-found'); return }
    supabase
      .from('bingo_sections')
      .select('*')
      .eq('slug', sectionSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setPageState('not-found'); return }
        setSection(data)

        // Check for cached member in this section
        const cachedMemberId = localStorage.getItem(MEMBER_ID_KEY(sectionSlug))
        const cachedTeamId = localStorage.getItem(TEAM_ID_KEY(sectionSlug))
        const cachedTeamData = localStorage.getItem(TEAM_DATA_KEY(sectionSlug))
        if (cachedMemberId && cachedTeamId && cachedTeamData) {
          try {
            const parsed = JSON.parse(cachedTeamData)
            setTeam(parsed)
            setPageState('board')
            // Validate team still exists in background
            supabase.from('bingo_teams').select('*').eq('id', cachedTeamId).single().then(({ data: t }) => {
              if (t) { setTeam(t); localStorage.setItem(TEAM_DATA_KEY(sectionSlug), JSON.stringify(t)) }
              else {
                localStorage.removeItem(MEMBER_ID_KEY(sectionSlug)); localStorage.removeItem(MEMBER_DATA_KEY(sectionSlug))
                localStorage.removeItem(TEAM_ID_KEY(sectionSlug)); localStorage.removeItem(TEAM_DATA_KEY(sectionSlug))
                setTeam(null); setPageState('join')
              }
            })
          } catch { setPageState('join') }
        } else {
          setPageState('join')
        }

        // Load groups (teams) for this section
        supabase
          .from('bingo_teams')
          .select('*')
          .eq('section_id', data.id)
          .order('name')
          .then(({ data: g }) => { if (g) setGroups(g) })

        // Load grid tasks for this section
        supabase
          .from('bingo_tasks')
          .select('*')
          .eq('section_id', data.id)
          .eq('in_grid', true)
          .order('sort_order')
          .limit(GRID_SIZE)
          .then(({ data: tasks }) => { if (tasks) setGridTasks(tasks) })

        // Load settings
        supabase.from('bingo_settings').select('*').eq('id', 'main').single()
          .then(({ data: s }) => { if (s) setSettings(s) })
      })
  }, [sectionSlug])

  // Load scans when team is set
  useEffect(() => {
    if (!team) { setScans([]); return }
    supabase.from('bingo_scans').select('*').eq('team_id', team.id)
      .then(({ data }) => { if (data) setScans(data) })
  }, [team])

  // Live scan updates
  useEffect(() => {
    if (!team) return
    const channel = supabase
      .channel(`bingo-join-scans-${team.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_scans', filter: `team_id=eq.${team.id}` }, () => {
        supabase.from('bingo_scans').select('*').eq('team_id', team.id).then(({ data }) => { if (data) setScans(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [team])

  // Live settings updates
  useEffect(() => {
    const channel = supabase
      .channel('bingo-join-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_settings' }, () => {
        supabase.from('bingo_settings').select('*').eq('id', 'main').single().then(({ data }) => { if (data) setSettings(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Join a group: create or find the member record, then enter the board
  const joinGroup = async (memberName: string, password: string, teamId: string) => {
    if (!section || !sectionSlug) throw new Error('Section not found')

    // Check if member already exists for this section
    const { data: existing } = await supabase
      .from('bingo_members')
      .select('*')
      .eq('section_id', section.id)
      .ilike('name', memberName)
      .maybeSingle()

    let member: BingoMember
    if (existing) {
      // Update team_id if they're switching groups
      if (existing.team_id !== teamId) {
        await supabase.from('bingo_members').update({ team_id: teamId }).eq('id', existing.id)
      }
      member = { ...existing, team_id: teamId }
    } else {
      const { data: created, error } = await supabase
        .from('bingo_members')
        .insert({ name: memberName, password, team_id: teamId, section_id: section.id })
        .select()
        .single()
      if (error) throw error
      member = created
    }

    // Fetch the team data
    const { data: teamData } = await supabase.from('bingo_teams').select('*').eq('id', teamId).single()
    if (!teamData) throw new Error('Group not found')

    localStorage.setItem(MEMBER_ID_KEY(sectionSlug), member.id)
    localStorage.setItem(MEMBER_DATA_KEY(sectionSlug), JSON.stringify(member))
    localStorage.setItem(TEAM_ID_KEY(sectionSlug), teamData.id)
    localStorage.setItem(TEAM_DATA_KEY(sectionSlug), JSON.stringify(teamData))
    setTeam(teamData)
    setPageState('board')
  }

  const leaveTeam = () => {
    if (sectionSlug) {
      localStorage.removeItem(MEMBER_ID_KEY(sectionSlug))
      localStorage.removeItem(MEMBER_DATA_KEY(sectionSlug))
      localStorage.removeItem(TEAM_ID_KEY(sectionSlug))
      localStorage.removeItem(TEAM_DATA_KEY(sectionSlug))
    }
    setTeam(null)
    setPageState('join')
  }

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (pageState === 'not-found') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
        <ParticleBackground />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">😵</div>
          <h1 className="text-3xl font-black text-white mb-2">Game Not Found</h1>
          <p className="text-gray-400">
            The link <span className="text-purple-400 font-mono">/play/{sectionSlug}</span> doesn't match any active game.
          </p>
          <p className="text-gray-500 text-sm mt-2">Check the QR code or ask your facilitator for the correct link.</p>
        </div>
      </div>
    )
  }

  if (pageState === 'join' && section) {
    return <JoinScreen sectionName={section.name} sectionId={section.id} groups={groups} onJoinGroup={joinGroup} />
  }

  if (pageState === 'board' && team && section) {
    return (
      <BoardScreen
        team={team}
        sectionName={section.name}
        sectionSlug={sectionSlug!}
        gridTasks={gridTasks}
        scans={scans}
        settings={settings}
        onLeave={leaveTeam}
      />
    )
  }

  return null
}
