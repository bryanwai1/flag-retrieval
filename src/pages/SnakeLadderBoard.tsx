import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import {
  BOARD_SIZE, TOTAL_TILES, tileToGridRC, tileToRC, resolveJump,
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
  const [moving, setMoving] = useState<{ teamId: string; from: number; to: number } | null>(null)

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

  // Move a team piece: applies snake/ladder jump automatically.
  const moveTeamTo = async (team: SnakeTeam, rawTarget: number) => {
    let target = Math.max(0, Math.min(TOTAL_TILES, rawTarget))
    const resolved = resolveJump(target, snakes, ladders)
    const final = resolved.final
    if (resolved.jump) {
      setMoving({ teamId: team.id, from: target, to: final })
      setTimeout(() => setMoving(null), 1600)
    }
    target = final
    // Optimistic update
    setTeams(prev => prev.map(t => t.id === team.id ? { ...t, position: target } : t))
    await supabase.from('snake_teams').update({ position: target }).eq('id', team.id)
  }

  const advanceTeam = (team: SnakeTeam, delta: number) => moveTeamTo(team, team.position + delta)

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
    <div className="min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
      <ParticleBackground />

      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-xs text-white/50 hover:text-white">← Hub</button>
          <h1 className="text-2xl font-black tracking-tight">🐍🪜 {game.name}</h1>
        </div>
        <button
          onClick={() => navigate('/snake-ladder/admin')}
          className="text-xs font-bold text-amber-300 hover:text-amber-200 border border-amber-300/40 rounded-lg px-3 py-1.5"
        >
          ⚙ Admin
        </button>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ── Board ────────────────────────────────── */}
        <div className="relative">
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
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
                const isSnakeHead = snakes[n] != null || snakes[String(n)] != null
                const isLadderBottom = ladders[n] != null || ladders[String(n)] != null
                // Alternating pastel palette for empty tiles (matches image style)
                const palette = ['#fde68a', '#fbcfe8', '#c7d2fe', '#bbf7d0', '#fed7aa', '#a5f3fc']
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
                      color: task ? '#fff' : '#1f2937',
                      borderRight: gridCol < BOARD_SIZE ? '1px solid rgba(0,0,0,0.08)' : undefined,
                      borderBottom: gridRow < BOARD_SIZE ? '1px solid rgba(0,0,0,0.08)' : undefined,
                    }}
                    title={task ? `${n}. ${task.title}` : `${n}. (empty) — click to assign`}
                  >
                    {/* number */}
                    <span className="absolute top-0.5 left-1 text-[9px] md:text-[11px] opacity-80 leading-none">{n}</span>
                    {/* title for assigned tile */}
                    {task && (
                      <span className="px-1 pt-3 text-center leading-tight line-clamp-3 break-words">{task.title}</span>
                    )}
                    {/* Snake / ladder markers */}
                    {isSnakeHead && (
                      <span className="absolute bottom-0.5 right-1 text-base md:text-lg" title={`Snake → ${snakes[n] ?? snakes[String(n)]}`}>🐍</span>
                    )}
                    {isLadderBottom && (
                      <span className="absolute bottom-0.5 right-1 text-base md:text-lg" title={`Ladder → ${ladders[n] ?? ladders[String(n)]}`}>🪜</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Snake / ladder connecting lines overlay */}
            <SnakeLadderOverlay snakes={snakes} ladders={ladders} />

            {/* Team pieces overlay */}
            <TeamPiecesOverlay teamsByTile={teamsByTile} moving={moving} />
          </div>
        </div>

        {/* ── Teams panel ───────────────────────────── */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-3">Teams</h2>
            {teams.length === 0 && (
              <p className="text-sm text-white/50">No teams yet. Add some in Admin.</p>
            )}
            <div className="flex flex-col gap-2">
              {teams.map(team => (
                <TeamControl
                  key={team.id}
                  team={team}
                  snakes={snakes}
                  ladders={ladders}
                  onAdvance={d => advanceTeam(team, d)}
                  onSet={p => moveTeamTo(team, p)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/60 leading-relaxed">
            <p className="font-bold text-white mb-1">How to play</p>
            <p>Throw a physical die, then press <b>+N</b> on the team that rolled. Landing on a 🐍 head slides down; a 🪜 bottom climbs up. Tap any tile to open its activity card.</p>
          </div>
        </aside>
      </main>

      {/* Tile modal */}
      {openTileNumber != null && (
        <TileModal
          tileNumber={openTileNumber}
          task={openData?.task ?? null}
          teams={teamsByTile.get(openTileNumber) ?? []}
          onClose={() => setOpenTileNumber(null)}
          onOpenCard={id => navigate(`/bingo-dash/task/${id}`)}
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
  moving,
}: {
  teamsByTile: Map<number, import('../types/database').SnakeTeam[]>
  moving: { teamId: string; from: number; to: number } | null
}) {
  void moving
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
          <span>{team.emoji || team.name.slice(0, 2).toUpperCase()}</span>
        </div>
      )
    })
  })
  return <>{nodes}</>
}

function TeamControl({
  team,
  snakes,
  ladders,
  onAdvance,
  onSet,
}: {
  team: SnakeTeam
  snakes: Record<string | number, number>
  ladders: Record<string | number, number>
  onAdvance: (delta: number) => void
  onSet: (pos: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(team.position))
  const nextLanding = (d: number) => {
    const target = Math.min(TOTAL_TILES, team.position + d)
    const res = resolveJump(target, snakes, ladders)
    return res
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 rounded-full w-8 h-8 flex items-center justify-center font-black text-sm border-2 border-white/60" style={{ backgroundColor: team.hex_code }}>
          {team.emoji || team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate">{team.name}</p>
          <p className="text-[10px] text-white/50">
            On tile {team.position || '—'}
            {team.position > 0 && team.position < TOTAL_TILES && (
              <> · next +1 → {nextLanding(1).final}{nextLanding(1).jump ? ` (${nextLanding(1).jump === 'snake' ? '🐍' : '🪜'})` : ''}</>
            )}
            {team.position >= TOTAL_TILES && ' · 🏁 Finished!'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1 text-xs font-black">
        {[1, 2, 3, 4, 5, 6].map(d => (
          <button key={d} onClick={() => onAdvance(d)}
            className="py-1 rounded bg-white/10 hover:bg-white/20 active:scale-95">
            +{d}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <button onClick={() => onAdvance(-1)} className="flex-1 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-bold">-1</button>
        <button onClick={() => onSet(0)} className="flex-1 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-bold">Reset</button>
        {!editing ? (
          <button onClick={() => { setEditing(true); setVal(String(team.position)) }} className="flex-1 py-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-bold">Set…</button>
        ) : (
          <form
            className="flex-[2] flex items-center gap-1"
            onSubmit={e => {
              e.preventDefault()
              const n = Math.max(0, Math.min(TOTAL_TILES, parseInt(val) || 0))
              onSet(n); setEditing(false)
            }}
          >
            <input
              autoFocus value={val} onChange={e => setVal(e.target.value)}
              className="w-full px-1 py-0.5 rounded bg-black/40 text-white border border-white/20 text-[11px]"
              type="number" min={0} max={TOTAL_TILES}
            />
            <button type="submit" className="px-1 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black">OK</button>
          </form>
        )}
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
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: task.hex_code }}>
              <p className="text-xs uppercase tracking-widest font-black opacity-70">{task.color}</p>
              <h3 className="text-2xl font-black leading-tight">{task.title}</h3>
              {task.category && <p className="text-xs opacity-80 mt-1">📂 {task.category}</p>}
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
                  {t.emoji || '♟'} {t.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
