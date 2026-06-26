import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchBoardTasks } from '../lib/boardCards'
import { useBingoTaskPages } from '../hooks/useBingoTaskPages'
import { useBingoTaskPhotos } from '../hooks/useBingoTaskPhotos'
import { useTaskLinks } from '../hooks/useTaskLinks'
import { TaskLinkButtons } from '../components/TaskLinkButtons'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import { SwipeablePages } from '../components/SwipeablePages'
import { ParticleBackground } from '../components/ParticleBackground'
import { normalizeUrl } from '../lib/normalizeUrl'
import type { BingoSection, BingoTask } from '../types/database'

// ════════════════════════════════════════════════════════════════════════════
// SAMPLE BINGO — a self-contained, sandboxed Participant View for demos/pitches.
//
// • Reads REAL boards/tasks created in the admin (so it always reflects live
//   content), but every action — joining, scanning, marshal password, photo,
//   answers, BINGO — runs purely in local React state. Nothing is written to
//   Supabase, so it can never pollute a live event. "Reset demo" wipes it.
// • A board switcher lets the presenter jump between any admin-created board.
// • The participant "login" (group + password) is pre-filled with a sample
//   password so people can see how the join flow looks without real creds.
// ════════════════════════════════════════════════════════════════════════════

const SAMPLE_TEAM_PASSWORD = '1234'   // demo "login" password (pre-filled on the join screen)
const DEMO_MARSHAL_PASSWORD = '4321'  // fixed demo marshal password — deliberately NOT the real
                                      // per-board marshal_password, so this public page never
                                      // leaks live-event secrets that could be used to cheat.
const DEMO_GROUPS = ['Sample Team Alpha', 'Sample Team Bravo', 'Sample Team Charlie', 'Sample Team Delta']

const GRID_SIZE = 25 // 5×5
const BINGO_WORD = 'BINGO'

// All 12 possible bingo lines: 5 rows + 5 cols + 2 diagonals
const BINGO_LINES = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
]

type TileStatus = 'locked' | 'scanned' | 'completed'
type ScanStatus = 'scanned' | 'completed'
type ScanState = Record<string, ScanStatus>

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Build a sparse 25-slot array: each task lands at slot = sort_order (0-24).
// Overflowing/colliding rows drop into the first empty slot (mirrors the board).
function buildSlots(gridTasks: BingoTask[]): (BingoTask | null)[] {
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
}

// ── Demo top bar (board switcher + cheat sheet + reset) ──────────────────────

function DemoBar({
  sections,
  selectedId,
  onSelect,
  marshalPassword,
  onReset,
  onQuickWin,
  showQuickWin,
}: {
  sections: BingoSection[]
  selectedId: string | null
  onSelect: (id: string) => void
  marshalPassword: string
  onReset: () => void
  onQuickWin: () => void
  showQuickWin: boolean
}) {
  return (
    <div className="sticky top-0 z-40 w-full bg-gray-950/95 backdrop-blur border-b border-purple-500/30">
      <div className="max-w-5xl mx-auto px-2.5 py-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        {/* Row 1: badge + board picker (picker fills the row on mobile) */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 px-2 py-1 rounded-lg bg-purple-500 text-black text-[11px] font-black tracking-wider whitespace-nowrap">
            🎬 SAMPLE
          </span>
          <select
            value={selectedId ?? ''}
            onChange={e => onSelect(e.target.value)}
            aria-label="Choose board"
            className="flex-1 min-w-0 sm:flex-none sm:max-w-[12rem] bg-white/10 text-white text-xs font-bold rounded-lg px-2.5 py-2 border border-white/15 focus:outline-none focus:border-purple-400"
          >
            {sections.length === 0 && <option value="">No boards found</option>}
            {sections.map(s => (
              <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
            ))}
          </select>
        </div>

        {/* Row 2: password cheat-sheet pills + actions (icon-only on phones) */}
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <span className="flex-shrink-0 px-2 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10 text-[11px] font-bold whitespace-nowrap">
            🔑 <span className="text-purple-300">{SAMPLE_TEAM_PASSWORD}</span>
          </span>
          <span className="flex-shrink-0 px-2 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10 text-[11px] font-bold whitespace-nowrap">
            👮 <span className="text-yellow-300">{marshalPassword}</span>
          </span>
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {showQuickWin && (
              <button
                onClick={onQuickWin}
                title="Quick BINGO — instantly complete one line"
                className="flex-shrink-0 px-2.5 py-2 rounded-lg bg-yellow-400/20 text-yellow-200 border border-yellow-400/40 text-xs font-black hover:bg-yellow-400/30 transition-colors whitespace-nowrap"
              >
                ⚡<span className="hidden sm:inline"> BINGO</span>
              </button>
            )}
            <button
              onClick={onReset}
              title="Reset demo"
              className="flex-shrink-0 px-2.5 py-2 rounded-lg bg-white/10 text-gray-200 border border-white/15 text-xs font-bold hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              ↺<span className="hidden sm:inline"> Reset</span>
            </button>
            <Link
              to="/"
              title="Back to Game Hub"
              className="flex-shrink-0 px-2.5 py-2 rounded-lg bg-white/10 text-gray-200 border border-white/15 text-xs font-bold hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              ←<span className="hidden sm:inline"> Hub</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Join Screen (sandbox: demo groups + pre-filled sample password) ───────────

function JoinScreen({ onJoin }: { onJoin: (groupName: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const groups = DEMO_GROUPS
    .filter(g => g.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const pick = (name: string) => {
    setSelected(name)
    setPassword(SAMPLE_TEAM_PASSWORD) // pre-fill the sample password for the demo
    setError('')
    setStep(2)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    if (password !== SAMPLE_TEAM_PASSWORD) { setError('Wrong password (demo password is 1234).'); return }
    onJoin(selected)
  }

  return (
    <div className="min-h-[80vh] bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">
      <ParticleBackground />

      <div className="relative z-10 text-center mb-8 animate-slide-up">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-5xl font-black text-white tracking-tight">BINGO DASH</h1>
        <p className="text-gray-400 mt-3 text-lg">Complete challenges · Scan tiles · Win</p>
      </div>

      {step === 1 && (
        <div
          className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-bounce-in"
          style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}
        >
          <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Join Game</h2>
          <p className="text-gray-400 text-center text-sm mb-5">Search and select your group</p>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full px-4 py-3 rounded-2xl border-2 text-base font-medium focus:outline-none transition-colors text-center mb-3"
            style={{ borderColor: search ? '#a855f7' : '#e5e7eb' }}
          />

          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto overscroll-contain pr-1">
            {groups.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No groups match your search.</p>
            ) : (
              groups.map(group => (
                <button
                  key={group}
                  onClick={() => pick(group)}
                  className="w-full px-5 py-4 rounded-2xl border-2 text-left font-bold text-lg transition-all duration-150 border-gray-200 text-gray-800 hover:border-purple-400 hover:bg-purple-50 active:scale-[0.98]"
                >
                  {group}
                </button>
              ))
            )}
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-4">
            🧪 This is a sample. Pick any group to continue.
          </p>
        </div>
      )}

      {step === 2 && selected && (
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
          <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Enter Password</h2>
          <p className="text-gray-400 text-center text-sm mb-1">
            Group: <span className="text-purple-500 font-bold">{selected}</span>
          </p>
          <p className="text-gray-400 text-center text-xs mb-5">
            Enter the 4-digit password given to your group.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={password}
              onChange={e => { setPassword(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
              placeholder="• • • •"
              className="w-full px-5 py-4 rounded-2xl border-2 text-4xl font-black focus:outline-none transition-colors text-center tracking-[0.6em]"
              style={{ borderColor: password.length === 4 ? '#a855f7' : '#e5e7eb' }}
              maxLength={4}
            />

            <div className="rounded-xl bg-purple-50 border border-purple-200 px-3 py-2 text-center">
              <p className="text-[11px] text-purple-500 font-bold">
                🧪 Sample password <span className="font-black">{SAMPLE_TEAM_PASSWORD}</span> is pre-filled for this demo.
              </p>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span>🚫</span>
                <p className="text-red-600 font-bold text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={password.length !== 4}
              className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95 mt-1"
              style={{ backgroundColor: '#a855f7', boxShadow: '0 8px 24px #a855f744' }}
            >
              Join Group →
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ── Category icons ────────────────────────────────────────────────────────────
// Generated single-colour vector icons. They render white via `currentColor`, so
// they sit cleanly on ANY tile background colour (which AI raster icons can't
// guarantee) and stay razor-sharp at tiny sizes. resolveIconKey() maps each
// admin-defined category to the best-fitting icon via keyword rules, with a
// stable hash fallback so even brand-new categories always get a consistent icon.

const ICONS: Record<string, ReactNode> = {
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  cpu: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </>
  ),
  trophy: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.7 10.2 18 9 18 8a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </>
  ),
  sparkles: <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3Z" />,
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
}

const ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\ba\.?i\b|artificial|robot|cyber|android|machine|\btech\b|digital/, 'cpu'],
  [/physical|fitness|exercise|workout|cardio|sport|\brun\b|athlet|agilit/, 'activity'],
  [/strength|power|\blift\b|\bgym\b|muscle|endurance/, 'activity'],
  [/team|group|squad|crew|together|collab|unity|partner/, 'users'],
  [/compet|versus|battle|tournament|champion|\brace\b|rival|relay/, 'trophy'],
  [/hunt|search|scavenger|\bfind\b|seek|\bspot\b|locate|detect/, 'search'],
  [/puzzle|brain|logic|riddle|solve|mystery|enigma|sequence/, 'lightbulb'],
  [/quiz|trivia|knowledge|learn|study|memory|\bmind\b|\bword/, 'book'],
  [/creativ|\bart\b|craft|design|draw|paint|imagin|sculpt/, 'sparkles'],
  [/music|sound|rhythm|dance|\bsing\b|\bsong\b|\bbeat\b|audio/, 'music'],
  [/photo|picture|\bsnap\b|camera|selfie|\bimage\b|video|film/, 'camera'],
  [/talk|communicat|speak|language|debate|present|story|express|tongue/, 'message'],
  [/\bmap\b|location|\bplace\b|travel|navigat|route|explore|adventure|journey|world/, 'compass'],
  [/energy|speed|\bfast\b|quick|electric|spark|flash|reflex/, 'zap'],
  [/challenge|mission|\btask\b|\bgame\b|\bplay\b|activit|round|stage|tower|cube|shape|stack/, 'target'],
]

function resolveIconKey(category: string): string {
  const c = (category || '').toLowerCase()
  for (const [re, key] of ICON_RULES) if (re.test(c)) return key
  // Stable hash fallback — any unmatched category still maps to a consistent icon.
  let h = 0
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0
  const generics = ['star', 'target', 'flag', 'zap', 'compass', 'sparkles']
  return generics[h % generics.length] || 'star'
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[resolveIconKey(category)]}
    </svg>
  )
}

// ── Bingo Tile ────────────────────────────────────────────────────────────────

function BingoTile({
  task, status, isInBingoLine, onClick,
}: {
  task: BingoTask
  status: TileStatus
  isInBingoLine: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={task.title}
      aria-label={task.title}
      className="relative rounded-xl overflow-hidden flex items-center justify-center aspect-square transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
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
      {isInBingoLine && status === 'completed' && (
        <div className="absolute inset-0 bg-yellow-300/10 z-0 pointer-events-none" />
      )}

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

      {status === 'scanned' && (
        <div className="absolute top-1.5 right-1.5 z-10 w-2.5 h-2.5 rounded-full border-2 border-white/80" />
      )}

      {/* Centered category icon (generated vector — crisp white on any tile colour) */}
      <div
        className="relative z-0 flex items-center justify-center w-full h-full text-white"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }}
      >
        <CategoryIcon category={task.color} className="w-[52%] h-[52%]" />
      </div>

      {/* Points chip — top-left corner, clear of the title and the top-right scanned ring */}
      {(task.points ?? 0) > 0 && (
        <div className="absolute top-1 left-1 z-10 bg-black/45 text-white/90 text-[8px] font-black rounded px-1 leading-tight">
          {task.points}
        </div>
      )}
    </button>
  )
}

function EmptyTile() {
  return <div className="rounded-xl aspect-square bg-white/5 border border-white/10" />
}

// ── Bingo Popup ───────────────────────────────────────────────────────────────

function BingoPopup({ letters, onDismiss }: { letters: string; onDismiss: () => void }) {
  const isFull = letters === 'BINGO'
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer select-none"
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
          <p className="text-yellow-400 font-black text-xl mt-4 tracking-widest uppercase animate-pulse">🎉 You got BINGO! 🎉</p>
        ) : (
          <p className="text-purple-300 font-bold text-base mt-3 tracking-wide">Bingo line complete!</p>
        )}

        <p className="text-white/30 text-sm mt-8">Tap to continue</p>
      </div>
    </div>
  )
}

// ── Timer display ─────────────────────────────────────────────────────────────

function TimerDisplay({ settings }: { settings: BingoSection | null }) {
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

// ── Board Screen (sandbox) ────────────────────────────────────────────────────

function BoardScreen({
  teamName, gridTasks, scanState, section, onOpenTask, onSwitchTeam,
}: {
  teamName: string
  gridTasks: BingoTask[]
  scanState: ScanState
  section: BingoSection | null
  onOpenTask: (task: BingoTask) => void
  onSwitchTeam: () => void
}) {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [popupLetters, setPopupLetters] = useState<string | null>(null)
  const [popupQueue, setPopupQueue] = useState<string[]>([])
  const celebratedLinesRef = useRef<Set<number> | null>(null)

  const boardNote = section?.board_note ?? ''
  const boardNoteEvery = section?.board_note_every ?? 0

  const getStatus = (taskId: string): TileStatus => {
    const st = scanState[taskId]
    if (!st) return 'locked'
    return st === 'completed' ? 'completed' : 'scanned'
  }

  const completedCount = gridTasks.filter(t => scanState[t.id] === 'completed').length
  const slots = buildSlots(gridTasks)

  const completedLineIndices = BINGO_LINES.reduce((acc, line, i) => {
    const allDone = line.every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
    if (allDone) acc.add(i)
    return acc
  }, new Set<number>())

  const bingoSlots = new Set<number>()
  completedLineIndices.forEach(lineIdx => { BINGO_LINES[lineIdx].forEach(slotIdx => bingoSlots.add(slotIdx)) })

  const lettersEarned = BINGO_WORD.slice(0, Math.min(completedLineIndices.size, 5))

  const rowCompleted = [0, 1, 2, 3, 4].map(rowIdx =>
    BINGO_LINES[rowIdx].every(slotIdx => {
      const task = slots[slotIdx]
      return task && getStatus(task.id) === 'completed'
    })
  )

  const completedLinesKey = [...completedLineIndices].sort((a, b) => a - b).join(',')

  useEffect(() => {
    if (celebratedLinesRef.current === null) {
      celebratedLinesRef.current = new Set(completedLineIndices)
      return
    }
    const newLines: number[] = []
    completedLineIndices.forEach(idx => { if (!celebratedLinesRef.current!.has(idx)) newLines.push(idx) })
    if (newLines.length === 0) return
    const baseSize = celebratedLinesRef.current.size
    newLines.forEach(idx => celebratedLinesRef.current!.add(idx))
    const queued = newLines.map((_, i) => BINGO_WORD.slice(0, Math.min(baseSize + i + 1, 5)))
    setPopupQueue(prev => [...prev, ...queued])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedLinesKey])

  useEffect(() => {
    if (popupLetters || popupQueue.length === 0) return
    setPopupLetters(popupQueue[0])
    setPopupQueue(prev => prev.slice(1))
  }, [popupLetters, popupQueue])

  useEffect(() => {
    if (!popupLetters) return
    const t = setTimeout(() => setPopupLetters(null), 4000)
    return () => clearTimeout(t)
  }, [popupLetters])

  return (
    <div className="min-h-[80vh] bg-gray-950 relative overflow-x-hidden">
      <ParticleBackground />

      {popupLetters && <BingoPopup letters={popupLetters} onDismiss={() => setPopupLetters(null)} />}

      <header className="relative z-10 px-4 pt-5 pb-3">
        <div className="max-w-md mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest">Bingo Dash</p>
            <h1 className="text-white text-xl font-black tracking-tight leading-tight">{teamName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-green-400 text-xs font-bold">{completedCount}/{gridTasks.length} completed</span>
              {lettersEarned && (
                <span className="text-purple-300 text-xs font-black tracking-widest">{lettersEarned}!</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-1">
            <TimerDisplay settings={section} />
            {!showLeaveConfirm ? (
              <button onClick={() => setShowLeaveConfirm(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Switch Team
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <p className="text-xs text-gray-400">Switch?</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowLeaveConfirm(false)} className="text-xs text-gray-500">Cancel</button>
                  <button onClick={onSwitchTeam} className="text-xs text-red-400 font-bold">Yes</button>
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
              <p className="font-bold">No grid set up on this board yet</p>
              <p className="text-sm mt-1">Pick another board above, or add cards in the admin</p>
            </div>
          ) : (
            <div className="flex gap-2 items-start">
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
                        fontWeight: 900, fontSize: 13, letterSpacing: '0.05em',
                        boxShadow: earned ? '0 0 12px #a855f7aa' : 'none',
                      }}
                    >
                      {letter}
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-5 gap-2 flex-1">
                {slots.map((task, i) =>
                  task ? (
                    <BingoTile
                      key={task.id}
                      task={task}
                      status={getStatus(task.id)}
                      isInBingoLine={bingoSlots.has(i)}
                      onClick={() => onOpenTask(task)}
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

      {boardNote.trim() !== '' && gridTasks.length > 0 && (
        <div className="relative z-10 px-4 pb-8">
          <div className="max-w-md mx-auto">
            <div className="rounded-2xl overflow-hidden border border-emerald-800/40 bg-emerald-950/30">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-emerald-800/30">
                <span className="text-base">🌱</span>
                <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Note from Facilitator</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-white text-sm font-medium whitespace-pre-wrap leading-relaxed">{boardNote}</p>
                {boardNoteEvery > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-900/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-emerald-300 text-xs font-black uppercase tracking-wider">Items to collect</p>
                      <p className="text-emerald-500/70 text-[11px] font-semibold">1 item per {boardNoteEvery} completed boxes · {completedCount} done</p>
                    </div>
                    <div className="text-emerald-300 text-3xl font-black tabular-nums">
                      {Math.floor(completedCount / boardNoteEvery)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Task Detail (sandbox overlay) ─────────────────────────────────────────────

function SampleTaskDetail({
  task, teamName, marshalPassword, completed, onComplete, onUncomplete, onClose,
}: {
  task: BingoTask
  teamName: string
  marshalPassword: string
  completed: boolean
  onComplete: () => void
  onUncomplete: () => void
  onClose: () => void
}) {
  const { pages } = useBingoTaskPages(task.id)
  const { photos } = useBingoTaskPhotos(task.id)
  const { links } = useTaskLinks(task.id, 'bingo_task_links')

  const [showSplash, setShowSplash] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [marshalInput, setMarshalInput] = useState('')
  const [marshalError, setMarshalError] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSubmitted, setPhotoSubmitted] = useState(false)
  const [answerInputs, setAnswerInputs] = useState<string[]>([])
  const letterRefs = useRef<(HTMLInputElement | null)[][]>([])

  const answerRows = task.task_type === 'answer' && task.answer_text
    ? task.answer_text.split('\n').map(r => r.trim()).filter(Boolean)
    : []

  const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase()
  const answerMatches = answerRows.length > 0 && answerRows.every((row, i) => normalize(answerInputs[i] ?? '') === normalize(row))

  // Init answer inputs once per task
  useEffect(() => {
    if (task.task_type === 'answer' && task.answer_text) {
      const rows = task.answer_text.split('\n').map(r => r.trim()).filter(Boolean)
      setAnswerInputs(rows.map(() => ''))
    }
  }, [task.id, task.task_type, task.answer_text])

  // Auto-complete answer tasks when all rows match
  useEffect(() => {
    if (answerMatches && !completed) onComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerMatches])

  // Clean up the local object URL preview
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  const focusLetter = (rowIdx: number, charIdx: number) => letterRefs.current[rowIdx]?.[charIdx]?.focus()

  const handlePhotoSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
    setPhotoSubmitted(true)
  }

  // ── Splash ──
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
          <p className="text-sm font-bold opacity-70 uppercase tracking-[0.2em] mb-2">{task.color} Challenge</p>
          <h1 className="text-5xl font-black tracking-tight mb-4 leading-tight">{task.title}</h1>
          <div className="w-16 h-1 bg-white/40 rounded-full mx-auto mb-6" />
          <p className="text-lg opacity-80 font-medium mb-2">Team: {teamName}</p>
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

  // ── Main view ──
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: `color-mix(in srgb, ${task.hex_code} 50%, #0a0a0a)` }}
    >
      <ParticleBackground hexCode={task.hex_code} />

      <header className="px-6 py-5 text-white relative z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: task.hex_code, opacity: 0.35 }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="max-w-lg mx-auto relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              className="mt-1 flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white/80 hover:text-white text-xs font-bold transition-colors"
            >
              ← Board
            </button>
            <div>
              <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Team: {teamName}</p>
              <h1 className="text-3xl font-black tracking-tight">{task.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm opacity-70 uppercase tracking-wider">{task.color} Challenge</span>
                {(task.points ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20 text-white">{task.points} pts</span>
                )}
              </div>
            </div>
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
                  <button onClick={() => setCarouselIdx(i => (i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold backdrop-blur-sm active:scale-90 transition-transform">‹</button>
                  <button onClick={() => setCarouselIdx(i => (i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg font-bold backdrop-blur-sm active:scale-90 transition-transform">›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setCarouselIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === carouselIdx ? 'bg-white scale-125' : 'bg-white/50'}`} />
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

        {/* Maps button */}
        {task.maps_url && (
          <div className="mb-5 animate-slide-up">
            <a href={normalizeUrl(task.maps_url)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-black text-sm text-white border-2 border-white/30 bg-white/10 hover:bg-white/20 active:scale-95 transition-all">
              📍 {task.maps_label?.trim() || 'Open in Maps'}
            </a>
          </div>
        )}

        {/* Instruction pointers */}
        {pages.length > 0 ? (
          <SwipeablePages currentPage={currentPage} total={pages.length} onChange={setCurrentPage}>
            <InstructionPage page={pages[currentPage]} hexCode={task.hex_code} />
            <PageNavigator
              current={currentPage}
              total={pages.length}
              onPrev={() => setCurrentPage(p => Math.max(0, p - 1))}
              onNext={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
              hexCode={task.hex_code}
            />
          </SwipeablePages>
        ) : (
          <div className="text-center py-12 text-gray-400">No instructions available for this challenge yet.</div>
        )}

        {/* Helpful links */}
        {links.length > 0 && (
          <div className="mt-8 animate-slide-up">
            <TaskLinkButtons links={links} hexCode={task.hex_code} heading="Use these links to complete your tasks" />
          </div>
        )}

        {/* Complete Activity */}
        <div className="mt-8 animate-slide-up">
          {completed ? (
            <div className="text-center">
              <div className="p-6 rounded-2xl border-2" style={{ backgroundColor: `${task.hex_code}25`, borderColor: `${task.hex_code}66` }}>
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-2xl font-black mb-1 text-white">Challenge Complete!</p>
                <p className="text-white/60 text-sm font-medium">Great job, {teamName}!</p>
                <button
                  onClick={onClose}
                  className="mt-5 w-full py-3 rounded-2xl text-white font-black uppercase tracking-wider transition-all active:scale-95"
                  style={{ backgroundColor: task.hex_code, boxShadow: `0 4px 0 ${task.hex_code}88` }}
                >
                  ← Back to Board
                </button>
              </div>
              <button
                onClick={() => { onUncomplete(); if (task.task_type === 'answer') setAnswerInputs(answerRows.map(() => '')) }}
                className="mt-3 px-4 py-2 text-sm text-white/40 hover:text-red-400 transition-colors"
              >
                Undo completion
              </button>
            </div>
          ) : (
            <>
              <div
                className="rounded-3xl p-5 border-2 animate-pulse-border"
                style={{
                  borderColor: `${task.hex_code}99`,
                  backgroundColor: `${task.hex_code}18`,
                  boxShadow: `0 0 24px ${task.hex_code}44, inset 0 0 24px ${task.hex_code}11`,
                }}
              >
                {/* Standard: Marshal password + Complete */}
                {task.task_type === 'standard' && (
                  <>
                    {task.require_marshal && (
                      <>
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
                        <div className="mb-4">
                          <input
                            type="password"
                            value={marshalInput}
                            onChange={e => { setMarshalInput(e.target.value); setMarshalError('') }}
                            placeholder="Marshal password..."
                            className="w-full px-4 py-3 rounded-2xl border-2 text-center text-lg font-bold focus:outline-none transition-colors bg-white/10 text-white placeholder-white/30"
                            style={{ borderColor: marshalError ? '#ef4444' : marshalInput ? task.hex_code : 'rgba(255,255,255,0.2)' }}
                          />
                          {marshalError && <p className="text-red-400 text-xs font-bold text-center mt-2">{marshalError}</p>}
                          <p className="text-white/40 text-[11px] text-center mt-2">🧪 Demo marshal password: <span className="font-black text-yellow-300">{marshalPassword}</span></p>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (task.require_marshal && marshalInput.trim() !== marshalPassword) {
                          setMarshalError('Wrong marshal password.')
                          return
                        }
                        onComplete()
                      }}
                      className="w-full py-4 rounded-2xl text-white text-xl font-black uppercase tracking-wider transition-all active:scale-95"
                      style={{ backgroundColor: task.hex_code, boxShadow: `0 6px 0 ${task.hex_code}88, 0 8px 20px ${task.hex_code}44` }}
                    >
                      Complete Challenge ✅
                    </button>
                  </>
                )}

                {/* Photo: submit → marshal approve (demo) */}
                {task.task_type === 'photo' && (
                  <>
                    <p className="text-white font-black text-lg text-center mb-4">📸 Submit Your Photo</p>
                    <p className="text-white/50 text-sm text-center mb-5">A marshal will review and approve your submission.</p>
                    {photoSubmitted ? (
                      <div className="p-4 rounded-2xl bg-green-400/15 border border-green-400/40 text-center">
                        {photoPreview && <img src={photoPreview} alt="submission" className="w-full max-h-56 object-cover rounded-xl mb-3" />}
                        <div className="text-3xl mb-2">⏳</div>
                        <p className="text-green-300 font-black">Photo submitted!</p>
                        <p className="text-green-300/60 text-sm mt-1 mb-3">Waiting for marshal review</p>
                        <button
                          onClick={onComplete}
                          className="w-full py-3 rounded-2xl text-white font-black uppercase tracking-wider transition-all active:scale-95"
                          style={{ backgroundColor: task.hex_code, boxShadow: `0 4px 0 ${task.hex_code}88` }}
                        >
                          👮 Approve as marshal (demo)
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-3 w-full py-6 rounded-2xl border-2 border-dashed border-white/30 text-white/60 font-bold text-sm cursor-pointer hover:border-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
                        <span className="text-4xl">📷</span>
                        <span>Tap to take or upload a photo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handlePhotoSelect(f) }} />
                      </label>
                    )}
                  </>
                )}

                {/* Answer: letter boxes */}
                {task.task_type === 'answer' && (
                  <>
                    {task.answer_question && (
                      <p className="text-white font-black text-lg mb-4 text-center leading-snug">{task.answer_question}</p>
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
                              <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Word {rowIdx + 1}</label>
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
                                      rowCorrect ? 'border-green-400 bg-green-400/20 text-green-300'
                                        : charCorrect ? 'border-green-400/60 bg-green-400/10 text-green-300'
                                        : charWrong ? 'border-red-400/60 bg-red-400/10 text-red-300'
                                        : 'border-white/30 bg-black/30 text-white'
                                    }`}
                                    style={{ caretColor: 'transparent' }}
                                  />
                                )
                              })}
                            </div>
                            {rowCorrect && <span className="text-green-400 text-xs font-bold mt-0.5">✓ Correct!</span>}
                          </div>
                        )
                      })}
                    </div>
                    {!answerMatches && <p className="text-white/40 text-xs text-center mt-4">Fill in the letters above to complete</p>}
                  </>
                )}

                <button
                  onClick={onClose}
                  className="mt-5 w-full py-3 rounded-2xl text-white/70 font-bold text-sm uppercase tracking-wider border border-white/20 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                >
                  ← Back to Board
                </button>
              </div>

              {/* Optional evidence photo for non-photo tasks */}
              {task.task_type !== 'photo' && (
                <div className="mt-4 rounded-3xl p-5 border-2 border-white/15 bg-black/30">
                  <p className="text-white font-black text-base text-center mb-1">📸 Optional Photo</p>
                  <p className="text-white/50 text-xs text-center mb-4">Attach an image as evidence — your marshal will review it.</p>
                  {photoSubmitted ? (
                    <div className="p-4 rounded-2xl bg-green-400/15 border border-green-400/40 text-center">
                      {photoPreview && <img src={photoPreview} alt="submission" className="w-full max-h-56 object-cover rounded-xl mb-3" />}
                      <div className="text-3xl mb-2">⏳</div>
                      <p className="text-green-300 font-black">Photo submitted!</p>
                      <p className="text-green-300/60 text-sm mt-1">Waiting for marshal review</p>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 w-full py-5 rounded-2xl border-2 border-dashed border-white/25 text-white/55 font-bold text-sm cursor-pointer hover:border-white/45 hover:text-white/75 hover:bg-white/5 transition-all">
                      <span className="text-3xl">📷</span>
                      <span>Tap to take or upload a photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handlePhotoSelect(f) }} />
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BingoDashSample() {
  const [sections, setSections] = useState<BingoSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gridTasks, setGridTasks] = useState<BingoTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)

  const [teamName, setTeamName] = useState<string | null>(null)
  const [scanState, setScanState] = useState<ScanState>({})
  const [openTask, setOpenTask] = useState<BingoTask | null>(null)

  const selectedSection = sections.find(s => s.id === selectedId) ?? null
  const marshalPassword = DEMO_MARSHAL_PASSWORD

  // Load all boards once. Prefer the admin's active board as the initial pick.
  useEffect(() => {
    (async () => {
      const [{ data: secs }, { data: settings }] = await Promise.all([
        supabase.from('bingo_sections').select('*').order('sort_order'),
        supabase.from('bingo_settings').select('active_section_id').eq('id', 'main').single(),
      ])
      const list = (secs ?? []) as BingoSection[]
      setSections(list)
      const active = settings?.active_section_id
      const initial = list.find(s => s.id === active)?.id ?? list[0]?.id ?? null
      setSelectedId(initial)
      setLoading(false)
    })()
  }, [])

  // Load the grid whenever the selected board changes; reset the sandbox.
  useEffect(() => {
    if (!selectedId) { setGridTasks([]); return }
    let cancelled = false
    setTasksLoading(true)
    fetchBoardTasks(selectedId).then(tasks => {
      if (cancelled) return
      setGridTasks(tasks)
      setTasksLoading(false)
    })
    setScanState({})
    setOpenTask(null)
    return () => { cancelled = true }
  }, [selectedId])

  const handleSelectBoard = (id: string) => { setSelectedId(id) }

  const handleReset = () => {
    setScanState({})
    setOpenTask(null)
    setTeamName(null)
  }

  const handleOpenTask = (task: BingoTask) => {
    setScanState(prev => prev[task.id] ? prev : { ...prev, [task.id]: 'scanned' })
    setOpenTask(task)
  }

  const markComplete = (taskId: string) => setScanState(prev => ({ ...prev, [taskId]: 'completed' }))
  const markUncomplete = (taskId: string) => setScanState(prev => ({ ...prev, [taskId]: 'scanned' }))

  // Instantly complete the first fully-populated bingo line (demo helper).
  const handleQuickWin = () => {
    const slots = buildSlots(gridTasks)
    const line = BINGO_LINES.find(l => l.every(i => slots[i] !== null))
    const targets = line ? line.map(i => slots[i]!) : gridTasks
    setScanState(prev => {
      const next = { ...prev }
      for (const t of targets) next[t.id] = 'completed'
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-xl font-bold animate-pulse">Loading sample…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <DemoBar
        sections={sections}
        selectedId={selectedId}
        onSelect={handleSelectBoard}
        marshalPassword={marshalPassword}
        onReset={handleReset}
        onQuickWin={handleQuickWin}
        showQuickWin={!!teamName && gridTasks.length > 0}
      />

      {sections.length === 0 ? (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-white text-xl font-black mb-1">No boards found</p>
          <p className="text-gray-400 text-sm">Create a board in the Bingo admin first, then come back to the sample.</p>
        </div>
      ) : !teamName ? (
        <JoinScreen onJoin={name => setTeamName(name)} />
      ) : tasksLoading ? (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-gray-400 text-xl font-bold animate-pulse">Loading board…</div>
        </div>
      ) : (
        <BoardScreen
          key={selectedId ?? 'none'}
          teamName={teamName}
          gridTasks={gridTasks}
          scanState={scanState}
          section={selectedSection}
          onOpenTask={handleOpenTask}
          onSwitchTeam={() => { setTeamName(null); setOpenTask(null) }}
        />
      )}

      {openTask && (
        <SampleTaskDetail
          key={openTask.id}
          task={openTask}
          teamName={teamName ?? 'Sample Team'}
          marshalPassword={marshalPassword}
          completed={scanState[openTask.id] === 'completed'}
          onComplete={() => markComplete(openTask.id)}
          onUncomplete={() => markUncomplete(openTask.id)}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  )
}
