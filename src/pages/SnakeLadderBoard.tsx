import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import {
  BOARD_SIZE, TOTAL_TILES, tileToGridRC, tileToRC,
} from '../lib/snakeLadder'
import type { BingoTask, SnakeGame, SnakeTeam, SnakeTile } from '../types/database'

type TileMap = Map<number, { tile: SnakeTile; task: BingoTask | null }>

export function SnakeLadderBoard() {
  const navigate = useNavigate()
  const [game, setGame] = useState<SnakeGame | null>(null)
  const [tiles, setTiles] = useState<SnakeTile[]>([])
  const [tasks, setTasks] = useState<BingoTask[]>([])
  const [teams, setTeams] = useState<SnakeTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [openTileNumber, setOpenTileNumber] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const toggleFullscreen = async () => {
    const next = !fullscreen
    setFullscreen(next)
    try {
      if (next && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch { /* browser fullscreen API may be unavailable — CSS mode still works */ }
  }

  useEffect(() => {
    const sync = () => {
      // User pressed ESC or exited browser fullscreen — drop CSS mode too.
      if (!document.fullscreenElement) setFullscreen(f => (f ? false : f))
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // ── Initial load: find the active game ─────────────────────────
  const loadAll = useCallback(async () => {
    const settingsRes = await supabase.from('snake_settings').select('active_game_id').eq('id', 'main').maybeSingle()
    const activeId = settingsRes.data?.active_game_id as string | null
    if (!activeId) { setLoading(false); return }
    const [gameRes, tilesRes, teamsRes, tasksRes] = await Promise.all([
      supabase.from('snake_games').select('*').eq('id', activeId).single(),
      supabase.from('snake_tiles').select('*').eq('game_id', activeId),
      supabase.from('snake_teams').select('*').eq('game_id', activeId).order('sort_order'),
      supabase.from('bingo_tasks').select('*'),
    ])
    if (gameRes.data) setGame(gameRes.data)
    if (tilesRes.data) setTiles(tilesRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
    if (tasksRes.data) setTasks(tasksRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime: keep board in sync across browsers
  useEffect(() => {
    if (!game) return
    const channel = supabase
      .channel(`snake-board-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snake_teams', filter: `game_id=eq.${game.id}` }, payload => {
        setTeams(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== (payload.old as SnakeTeam).id)
          const next = payload.new as SnakeTeam
          const idx = prev.findIndex(t => t.id === next.id)
          if (idx === -1) return [...prev, next].sort((a, b) => a.sort_order - b.sort_order)
          const copy = [...prev]; copy[idx] = next; return copy
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snake_tiles', filter: `game_id=eq.${game.id}` }, payload => {
        setTiles(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== (payload.old as SnakeTile).id)
          const next = payload.new as SnakeTile
          const idx = prev.findIndex(t => t.id === next.id)
          if (idx === -1) return [...prev, next]
          const copy = [...prev]; copy[idx] = next; return copy
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [game])

  // Build tile map: tile_number -> { tile, task }
  const tileMap: TileMap = useMemo(() => {
    const map: TileMap = new Map()
    const taskById = new Map(tasks.map(t => [t.id, t]))
    for (const tile of tiles) {
      map.set(tile.tile_number, { tile, task: tile.task_id ? taskById.get(tile.task_id) ?? null : null })
    }
    return map
  }, [tiles, tasks])

  const snakes = game?.snakes ?? {}
  const ladders = game?.ladders ?? {}

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Loading…</div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-4">
        <ParticleBackground />
        <div className="relative z-10 text-center">
          <div className="text-6xl mb-4">🐍🪜</div>
          <h1 className="text-4xl font-black mb-2">Snake and Ladder</h1>
          <p className="text-gray-400 mb-6">No active game yet. Head to admin to set one up.</p>
          <button
            onClick={() => navigate('/snake-ladder/admin')}
            className="px-6 py-3 rounded-xl font-black bg-amber-400 text-black hover:scale-105 transition"
          >
            Open Admin ⚙
          </button>
        </div>
      </div>
    )
  }

  // Map of tile_number -> teams on that tile
  const teamsByTile = new Map<number, SnakeTeam[]>()
  for (const team of teams) {
    const pos = Math.max(0, team.position)
    if (pos < 1) continue
    if (!teamsByTile.has(pos)) teamsByTile.set(pos, [])
    teamsByTile.get(pos)!.push(team)
  }

  const openData = openTileNumber != null ? tileMap.get(openTileNumber) : undefined

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-gray-950 text-white overflow-hidden' : 'min-h-screen bg-gray-950 text-white relative overflow-x-hidden'}>
      <ParticleBackground />

      {!fullscreen && (
        <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-xs text-white/50 hover:text-white">← Hub</button>
            <h1 className="text-2xl font-black tracking-tight">🐍🪜 {game.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-xs font-bold text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5"
            >
              ⛶ Fullscreen
            </button>
            <button
              onClick={() => navigate('/snake-ladder/admin')}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 border border-amber-300/40 rounded-lg px-3 py-1.5"
            >
              ⚙ Admin
            </button>
          </div>
        </header>
      )}

      {fullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-3 right-3 z-[60] text-xs font-bold text-white bg-black/60 hover:bg-black/80 border border-white/30 rounded-lg px-3 py-2 backdrop-blur-sm"
        >
          ✕ Exit Fullscreen
        </button>
      )}

      <main
        className={
          fullscreen
            ? 'relative z-10 w-screen h-screen flex items-center justify-center p-2'
            : 'relative z-10 max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6'
        }
      >
        {/* ── Board ────────────────────────────────── */}
        <div className="relative" style={fullscreen ? { height: 'min(100vw, 100vh)', width: 'min(100vw, 100vh)', maxHeight: '100vh', maxWidth: '100vh' } : undefined}>
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl h-full w-full"
            style={{
              aspectRatio: '1 / 1',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.02) 25%, transparent 25%)',
              backgroundSize: '40px 40px',
            }}
          >
            {/* Tile grid */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
              }}
            >
              {Array.from({ length: TOTAL_TILES }, (_, i) => {
                const n = i + 1
                const { gridRow, gridCol } = tileToGridRC(n)
                const data = tileMap.get(n)
                const task = data?.task
                // Vibrant classic snakes-and-ladders palette
                const palette = ['#ec4899', '#f97316', '#a855f7', '#14b8a6', '#fbbf24', '#60a5fa', '#f472b6', '#fde68a']
                const emptyBg = palette[(Math.floor((n - 1) / BOARD_SIZE) + ((n - 1) % BOARD_SIZE)) % palette.length]
                const bg = task?.hex_code ?? emptyBg
                return (
                  <button
                    key={n}
                    onClick={() => setOpenTileNumber(n)}
                    className="relative flex items-center justify-center text-[10px] md:text-xs font-black overflow-hidden hover:ring-2 hover:ring-white/70 hover:z-20 transition"
                    style={{
                      gridRow,
                      gridColumn: gridCol,
                      backgroundColor: bg,
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                      borderRight: gridCol < BOARD_SIZE ? '1px solid rgba(0,0,0,0.08)' : undefined,
                      borderBottom: gridRow < BOARD_SIZE ? '1px solid rgba(0,0,0,0.08)' : undefined,
                    }}
                    title={task ? `${n}. ${task.title}` : `${n}. (empty) — click to assign`}
                  >
                    {/* number — darker shade of tile color */}
                    <span
                      className="text-sm md:text-base font-black leading-none"
                      style={{ color: task ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)' }}
                    >
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Snake / ladder connecting lines overlay */}
            <SnakeLadderOverlay snakes={snakes} ladders={ladders} />

            {/* Team pieces overlay */}
            <TeamPiecesOverlay teamsByTile={teamsByTile} />
          </div>
        </div>

        {/* ── Teams panel ───────────────────────────── */}
        {!fullscreen && (
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-3">Teams</h2>
              {teams.length === 0 && (
                <p className="text-sm text-white/50">No teams yet. Add some in Admin.</p>
              )}
              <div className="flex flex-col gap-2">
                {teams.map(team => (
                  <TeamStatus key={team.id} team={team} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/60 leading-relaxed">
              <p className="font-bold text-white mb-1">How to play</p>
              <p>Tap any tile to open its activity card. Finish the task, then pick which team completed it — that team jumps to this tile (snakes and ladders apply automatically).</p>
            </div>
          </aside>
        )}
      </main>

      {/* Tile modal */}
      {openTileNumber != null && (
        <TileModal
          tileNumber={openTileNumber}
          task={openData?.task ?? null}
          teams={teamsByTile.get(openTileNumber) ?? []}
          onClose={() => setOpenTileNumber(null)}
          onOpenCard={id => navigate(`/bingo-dash/task/${id}?from=snake-ladder&tile=${openTileNumber}`)}
          onGoToAdmin={() => navigate('/snake-ladder/admin')}
        />
      )}
    </div>
  )
}

// ── Overlay for snakes and ladders (draws curves + lines) ─────────────
function SnakeLadderOverlay({ snakes, ladders }: { snakes: Record<string | number, number>; ladders: Record<string | number, number> }) {
  // Produce coordinates as percentages of the board.
  const centerOf = (n: number) => {
    const { row, col } = tileToRC(n)
    const x = ((col + 0.5) / BOARD_SIZE) * 100
    const y = ((BOARD_SIZE - 1 - row + 0.5) / BOARD_SIZE) * 100
    return { x, y }
  }
  const snakeEntries = Object.entries(snakes).map(([h, t]) => [Number(h), Number(t)] as const)
  const ladderEntries = Object.entries(ladders).map(([b, t]) => [Number(b), Number(t)] as const)

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 pointer-events-none z-10">
      {/* Ladders */}
      {ladderEntries.map(([bottom, top]) => {
        const b = centerOf(bottom)
        const t = centerOf(top)
        const dx = t.x - b.x
        const dy = t.y - b.y
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        const offset = 1.5
        const l1 = { x1: b.x + nx * offset, y1: b.y + ny * offset, x2: t.x + nx * offset, y2: t.y + ny * offset }
        const l2 = { x1: b.x - nx * offset, y1: b.y - ny * offset, x2: t.x - nx * offset, y2: t.y - ny * offset }
        // rungs
        const rungs = Math.max(3, Math.floor(len / 4))
        const rungLines = Array.from({ length: rungs }, (_, i) => {
          const f = (i + 1) / (rungs + 1)
          return {
            x1: l1.x1 + (l1.x2 - l1.x1) * f,
            y1: l1.y1 + (l1.y2 - l1.y1) * f,
            x2: l2.x1 + (l2.x2 - l2.x1) * f,
            y2: l2.y1 + (l2.y2 - l2.y1) * f,
          }
        })
        return (
          <g key={`L${bottom}-${top}`} opacity={0.9}>
            <line {...l1} stroke="#b45309" strokeWidth={0.6} strokeLinecap="round" />
            <line {...l2} stroke="#b45309" strokeWidth={0.6} strokeLinecap="round" />
            {rungLines.map((r, i) => (
              <line key={i} {...r} stroke="#b45309" strokeWidth={0.4} strokeLinecap="round" />
            ))}
          </g>
        )
      })}

      {/* Snakes */}
      {snakeEntries.map(([head, tail]) => {
        const h = centerOf(head)
        const t = centerOf(tail)
        const mx = (h.x + t.x) / 2 + (tail % 2 === 0 ? 6 : -6)
        const my = (h.y + t.y) / 2
        const path = `M ${h.x} ${h.y} Q ${mx} ${my}, ${t.x} ${t.y}`
        return (
          <g key={`S${head}-${tail}`} opacity={0.85}>
            <path d={path} stroke="#16a34a" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <circle cx={h.x} cy={h.y} r={1.4} fill="#16a34a" />
          </g>
        )
      })}
    </svg>
  )
}

function TeamPiecesOverlay({
  teamsByTile,
}: {
  teamsByTile: Map<number, import('../types/database').SnakeTeam[]>
}) {
  const nodes: React.ReactElement[] = []
  teamsByTile.forEach((list, tile) => {
    const { row, col } = tileToRC(tile)
    const baseX = ((col + 0.5) / BOARD_SIZE) * 100
    const baseY = ((BOARD_SIZE - 1 - row + 0.5) / BOARD_SIZE) * 100
    list.forEach((team, i) => {
      const angle = (i / Math.max(1, list.length)) * Math.PI * 2
      const offR = list.length > 1 ? 2.2 : 0
      const x = baseX + Math.cos(angle) * offR
      const y = baseY + Math.sin(angle) * offR
      nodes.push(
        <div
          key={team.id}
          className="absolute flex items-center justify-center rounded-full border-2 border-white shadow-lg text-[10px] md:text-xs font-black pointer-events-none transition-all duration-500"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: '5.5%',
            height: '5.5%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: team.hex_code,
            color: '#fff',
            zIndex: 30,
          }}
          title={`${team.name} — tile ${team.position}`}
        >
          <span>{team.sort_order + 1}</span>
        </div>
      )
    })
  })
  return <>{nodes}</>
}

function TeamStatus({ team }: { team: SnakeTeam }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 flex items-center gap-2">
      <div
        className="flex-shrink-0 rounded-full w-8 h-8 flex items-center justify-center font-black text-sm border-2 border-white/60"
        style={{ backgroundColor: team.hex_code }}
      >
        {team.sort_order + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm truncate">{team.name}</p>
        <p className="text-[10px] text-white/50">
          Tile {team.position || '—'} · {team.points ?? 0} pts
          {team.position >= TOTAL_TILES && ' · 🏁'}
        </p>
      </div>
    </div>
  )
}

function TileModal({
  tileNumber,
  task,
  teams,
  onClose,
  onOpenCard,
  onGoToAdmin,
}: {
  tileNumber: number
  task: BingoTask | null
  teams: SnakeTeam[]
  onClose: () => void
  onOpenCard: (taskId: string) => void
  onGoToAdmin: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-gray-900 border border-white/15 rounded-2xl p-6 max-w-md w-full text-white"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-3 text-white/60 hover:text-white text-xl">✕</button>
        <p className="text-xs uppercase tracking-widest text-white/50 font-black mb-1">Tile {tileNumber}</p>
        {task ? (
          <>
            <div className="rounded-xl p-4 mb-4 text-gray-900" style={{ backgroundColor: task.hex_code }}>
              <p className="text-xs uppercase tracking-widest font-black opacity-60">{task.color}</p>
              <h3 className="text-2xl font-black leading-tight">{task.title}</h3>
              {task.category && <p className="text-xs opacity-70 mt-1">📂 {task.category}</p>}
            </div>
            <button
              onClick={() => onOpenCard(task.id)}
              className="w-full py-3 rounded-xl font-black bg-amber-400 text-black hover:scale-[1.02] transition"
            >
              Open Activity Card →
            </button>
          </>
        ) : (
          <>
            <p className="text-white/70 mb-4">No activity assigned to this tile yet.</p>
            <button
              onClick={onGoToAdmin}
              className="w-full py-3 rounded-xl font-black bg-amber-400 text-black hover:scale-[1.02] transition"
            >
              Assign in Admin →
            </button>
          </>
        )}
        {teams.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Teams here</p>
            <div className="flex flex-wrap gap-2">
              {teams.map(t => (
                <span
                  key={t.id}
                  className="px-2.5 py-1 rounded-full text-xs font-black border-2 border-white/60"
                  style={{ backgroundColor: t.hex_code }}
                >
                  {t.sort_order + 1} · {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
