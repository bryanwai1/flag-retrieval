import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import { buildBingoSlots, completedBingoLines } from '../lib/bingoLines'
import type { BingoTask, BingoTeam, BingoScan, BingoSettings, BingoSection } from '../types/database'

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

type Row = {
  team: BingoTeam
  points: number
  bingos: number
  tasksDone: number
}

export function BingoDashProjector() {
  const [tasks, setTasks] = useState<BingoTask[]>([])
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [settings, setSettings] = useState<BingoSettings | null>(null)
  const [sections, setSections] = useState<BingoSection[]>([])
  const [timerDisplay, setTimerDisplay] = useState('00:00')
  const [timerRunning, setTimerRunning] = useState(false)

  // Initial load
  useEffect(() => {
    const load = async () => {
      const [tasksRes, teamsRes, scansRes, sectionsRes, settingsRes] = await Promise.all([
        supabase.from('bingo_tasks').select('*'),
        supabase.from('bingo_teams').select('*').order('created_at'),
        supabase.from('bingo_scans').select('*'),
        supabase.from('bingo_sections').select('*').order('sort_order'),
        supabase.from('bingo_settings').select('*').eq('id', 'main').single(),
      ])
      if (tasksRes.data) setTasks(tasksRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
      if (scansRes.data) setScans(scansRes.data)
      if (sectionsRes.data) setSections(sectionsRes.data)
      if (settingsRes.data) setSettings(settingsRes.data)
    }
    load()
  }, [])

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel('bingo-projector')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_scans' }, async () => {
        const { data } = await supabase.from('bingo_scans').select('*')
        if (data) setScans(data)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_teams' }, async () => {
        const { data } = await supabase.from('bingo_teams').select('*').order('created_at')
        if (data) setTeams(data)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_tasks' }, async () => {
        const { data } = await supabase.from('bingo_tasks').select('*')
        if (data) setTasks(data)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_settings' }, async () => {
        const { data } = await supabase.from('bingo_settings').select('*').eq('id', 'main').single()
        if (data) setSettings(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Timer tick
  useEffect(() => {
    const id = setInterval(() => {
      if (!settings) { setTimerDisplay('00:00'); setTimerRunning(false); return }
      if (settings.timer_end_at) {
        const remaining = (new Date(settings.timer_end_at).getTime() - Date.now()) / 1000
        setTimerDisplay(formatTime(remaining))
        setTimerRunning(remaining > 0)
      } else {
        setTimerDisplay(formatTime(settings.timer_seconds))
        setTimerRunning(false)
      }
    }, 250)
    return () => clearInterval(id)
  }, [settings])

  const activeSectionId = settings?.active_section_id ?? null
  const activeSection = sections.find(s => s.id === activeSectionId) ?? null

  const sectionTeams = activeSectionId ? teams.filter(t => t.section_id === activeSectionId) : teams
  const sectionTasks = activeSectionId ? tasks.filter(t => t.section_id === activeSectionId) : tasks
  const gridTasks = sectionTasks.filter(t => t.in_grid).sort((a, b) => a.sort_order - b.sort_order)
  const slots = buildBingoSlots(gridTasks)

  const rows: Row[] = sectionTeams.map(team => {
    const teamScans = scans.filter(s => s.team_id === team.id)
    const completedIds = new Set(teamScans.filter(s => s.completed).map(s => s.task_id))
    const points = sectionTasks.reduce(
      (sum, t) => completedIds.has(t.id) ? sum + (t.points ?? 0) : sum, 0,
    )
    const bingos = completedBingoLines(slots, completedIds).length
    const tasksDone = teamScans.filter(s => s.completed).length
    return { team, points, bingos, tasksDone }
  })

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.bingos !== a.bingos) return b.bingos - a.bingos
    return b.tasksDone - a.tasksDone
  })

  const rankColors = ['#fbbf24', '#cbd5e1', '#d97706']

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 px-10 pt-10 pb-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6">
          <div>
            <p className="text-purple-400 text-sm font-black uppercase tracking-[0.3em]">Bingo Dash</p>
            <h1 className="text-white text-6xl font-black tracking-tight mt-1">Scoreboard</h1>
            {activeSection && (
              <p className="text-gray-400 text-xl font-bold mt-2">{activeSection.name}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {settings && (settings.timer_end_at || settings.timer_seconds > 0) && (
              <div
                className={`px-6 py-3 rounded-2xl font-black text-4xl tabular-nums transition-colors ${
                  timerRunning ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
                }`}
              >
                <span className={`mr-3 text-2xl ${timerRunning ? 'text-green-400' : 'text-gray-600'}`}>
                  {timerRunning ? '●' : '■'}
                </span>
                {timerDisplay}
              </div>
            )}
            <p className="text-gray-500 text-sm font-bold">{sectionTeams.length} teams competing</p>
          </div>
        </div>
      </header>

      {/* Scoreboard */}
      <main className="relative z-10 px-10 pb-10">
        <div className="max-w-[1600px] mx-auto">
          {rows.length === 0 ? (
            <div className="text-center py-32 text-gray-500">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-2xl font-bold">No teams registered yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Column headers */}
              <div className="grid grid-cols-[80px_1fr_200px_200px_200px] gap-4 px-6 py-2 text-gray-500 text-xs font-black uppercase tracking-widest">
                <div>Rank</div>
                <div>Team</div>
                <div className="text-center">Points</div>
                <div className="text-center">Bingo Lines</div>
                <div className="text-center">Tasks Done</div>
              </div>

              {rows.map((row, i) => {
                const rank = i + 1
                const isTop3 = rank <= 3
                const rankColor = isTop3 ? rankColors[rank - 1] : '#4b5563'
                return (
                  <div
                    key={row.team.id}
                    className="grid grid-cols-[80px_1fr_200px_200px_200px] gap-4 items-center px-6 py-5 rounded-2xl transition-all duration-500"
                    style={{
                      background: isTop3
                        ? `linear-gradient(90deg, ${rankColor}22 0%, rgba(255,255,255,0.03) 100%)`
                        : 'rgba(255,255,255,0.04)',
                      border: isTop3 ? `1px solid ${rankColor}55` : '1px solid rgba(255,255,255,0.05)',
                      boxShadow: isTop3 ? `0 0 30px ${rankColor}22` : 'none',
                    }}
                  >
                    <div
                      className="text-4xl font-black tabular-nums"
                      style={{ color: rankColor }}
                    >
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>
                    <div>
                      <p className="text-white text-3xl font-black tracking-tight">{row.team.name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-5xl font-black tabular-nums">{row.points}</p>
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">pts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-amber-400 text-5xl font-black tabular-nums">
                        {row.bingos}<span className="text-2xl text-gray-600">/12</span>
                      </p>
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">lines</p>
                    </div>
                    <div className="text-center">
                      <p className="text-green-400 text-5xl font-black tabular-nums">
                        {row.tasksDone}
                      </p>
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">completed</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
