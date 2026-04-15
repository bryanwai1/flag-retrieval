import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEFAULT_SNAKES, DEFAULT_LADDERS } from '../lib/snakeLadder'
import type { BingoSection, BingoTask, SnakeGame, SnakeTeam, SnakeTile } from '../types/database'

const PIECE_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#22C55E', '#6366F1',
]
const PIECE_EMOJIS = ['♟', '♜', '♞', '♛', '🦁', '🐯', '🐸', '🦊', '🐻', '🐼', '🐵', '🐧']

export function SnakeLadderAdmin() {
  const navigate = useNavigate()
  const [games, setGames] = useState<SnakeGame[]>([])
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const [tiles, setTiles] = useState<SnakeTile[]>([])
  const [teams, setTeams] = useState<SnakeTeam[]>([])
  const [tasks, setTasks] = useState<BingoTask[]>([])
  const [sections, setSections] = useState<BingoSection[]>([])
  const [loading, setLoading] = useState(true)

  const [tileEditing, setTileEditing] = useState<number | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const [librarySection, setLibrarySection] = useState<'all' | 'snake-ladder' | string>('snake-ladder')

  // Create-card inline form (in tile editor)
  const [createTitle, setCreateTitle] = useState('')
  const [createHex, setCreateHex] = useState('#60a5fa')
  const [createCategory, setCreateCategory] = useState('')
  const [createPoints, setCreatePoints] = useState(0)
  const [saving, setSaving] = useState(false)

  // New game modal
  const [newGameName, setNewGameName] = useState('')
  const [showNewGame, setShowNewGame] = useState(false)

  // New team
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState(PIECE_COLORS[0])
  const [newTeamEmoji, setNewTeamEmoji] = useState('♟')

  const loadAll = useCallback(async () => {
    const [gamesRes, settingsRes, tasksRes, sectionsRes] = await Promise.all([
      supabase.from('snake_games').select('*').order('created_at'),
      supabase.from('snake_settings').select('active_game_id').eq('id', 'main').maybeSingle(),
      supabase.from('bingo_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('bingo_sections').select('*').order('sort_order'),
    ])
    if (gamesRes.data) setGames(gamesRes.data)
    if (tasksRes.data) setTasks(tasksRes.data)
    if (sectionsRes.data) setSections(sectionsRes.data)
    const active = settingsRes.data?.active_game_id ?? gamesRes.data?.[0]?.id ?? null
    setActiveGameId(active)
    if (active) {
      const [tilesRes, teamsRes] = await Promise.all([
        supabase.from('snake_tiles').select('*').eq('game_id', active),
        supabase.from('snake_teams').select('*').eq('game_id', active).order('sort_order'),
      ])
      if (tilesRes.data) setTiles(tilesRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const activeGame = useMemo(() => games.find(g => g.id === activeGameId) ?? null, [games, activeGameId])
  const tileByNumber = useMemo(() => {
    const m = new Map<number, SnakeTile>()
    for (const t of tiles) m.set(t.tile_number, t)
    return m
  }, [tiles])
  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])

  // Resolve the snake-ladder library section id.
  const snakeSection = sections.find(s => s.slug === 'snake-ladder') ?? null

  // ── Game CRUD ─────────────────────────────────────────────────
  const createGame = async () => {
    const name = newGameName.trim()
    if (!name) return
    const { data, error } = await supabase.from('snake_games').insert({ name }).select().single()
    if (error || !data) return
    await supabase.from('snake_settings').upsert({ id: 'main', active_game_id: data.id })
    setNewGameName(''); setShowNewGame(false)
    await loadAll()
  }
  const activateGame = async (id: string) => {
    await supabase.from('snake_settings').upsert({ id: 'main', active_game_id: id })
    setActiveGameId(id)
    const [tilesRes, teamsRes] = await Promise.all([
      supabase.from('snake_tiles').select('*').eq('game_id', id),
      supabase.from('snake_teams').select('*').eq('game_id', id).order('sort_order'),
    ])
    if (tilesRes.data) setTiles(tilesRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
  }
  const deleteGame = async (id: string) => {
    if (!confirm('Delete this game and its tile assignments and teams?')) return
    await supabase.from('snake_games').delete().eq('id', id)
    await loadAll()
  }

  // ── Tile assignment ──────────────────────────────────────────
  const assignTile = async (tileNumber: number, taskId: string | null) => {
    if (!activeGameId) return
    const existing = tileByNumber.get(tileNumber)
    if (existing) {
      const { data } = await supabase.from('snake_tiles').update({ task_id: taskId }).eq('id', existing.id).select().single()
      if (data) setTiles(prev => prev.map(t => t.id === data.id ? data : t))
    } else {
      const { data } = await supabase.from('snake_tiles').insert({
        game_id: activeGameId, tile_number: tileNumber, task_id: taskId,
      }).select().single()
      if (data) setTiles(prev => [...prev, data])
    }
  }

  const createCardAndAssign = async (tileNumber: number) => {
    if (!snakeSection || !createTitle.trim()) return
    setSaving(true)
    try {
      const { data: created } = await supabase.from('bingo_tasks').insert({
        section_id: snakeSection.id,
        title: createTitle.trim(),
        color: '',
        hex_code: createHex,
        category: createCategory.trim(),
        points: createPoints,
        in_grid: false,
        sort_order: 0,
        task_type: 'standard',
      }).select().single()
      if (created) {
        setTasks(prev => [created, ...prev])
        await assignTile(tileNumber, created.id)
        setCreateTitle(''); setCreateCategory(''); setCreatePoints(0)
      }
    } finally { setSaving(false) }
  }

  // ── Teams CRUD ───────────────────────────────────────────────
  const addTeam = async () => {
    if (!activeGameId || !newTeamName.trim()) return
    const { data } = await supabase.from('snake_teams').insert({
      game_id: activeGameId,
      name: newTeamName.trim(),
      hex_code: newTeamColor,
      emoji: newTeamEmoji,
      sort_order: teams.length,
    }).select().single()
    if (data) setTeams(prev => [...prev, data])
    setNewTeamName('')
  }
  const updateTeam = async (id: string, patch: Partial<SnakeTeam>) => {
    const { data } = await supabase.from('snake_teams').update(patch).eq('id', id).select().single()
    if (data) setTeams(prev => prev.map(t => t.id === id ? data : t))
  }
  const deleteTeam = async (id: string) => {
    if (!confirm('Remove this team?')) return
    await supabase.from('snake_teams').delete().eq('id', id)
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  // ── Snakes/Ladders config ────────────────────────────────────
  const updateBoardConfig = async (snakes: Record<string, number>, ladders: Record<string, number>) => {
    if (!activeGame) return
    const { data } = await supabase.from('snake_games').update({ snakes, ladders }).eq('id', activeGame.id).select().single()
    if (data) setGames(prev => prev.map(g => g.id === data.id ? data : g))
  }

  // ── Library filter ───────────────────────────────────────────
  const filteredLibrary = useMemo(() => {
    const search = librarySearch.trim().toLowerCase()
    let list = tasks
    if (librarySection !== 'all') {
      const secId = sections.find(s => s.slug === librarySection)?.id ?? librarySection
      list = list.filter(t => t.section_id === secId)
    }
    if (search) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(search) ||
        (t.category ?? '').toLowerCase().includes(search)
      )
    }
    return list.slice(0, 100)
  }, [tasks, librarySearch, librarySection, sections])

  // ── Library manager: quick-add card to snake-ladder section ──
  const [libNewTitle, setLibNewTitle] = useState('')
  const [libNewHex, setLibNewHex] = useState('#60a5fa')
  const [libNewCategory, setLibNewCategory] = useState('')
  const addLibraryCard = async () => {
    if (!snakeSection || !libNewTitle.trim()) return
    const { data } = await supabase.from('bingo_tasks').insert({
      section_id: snakeSection.id,
      title: libNewTitle.trim(),
      color: '',
      hex_code: libNewHex,
      category: libNewCategory.trim(),
      points: 0,
      in_grid: false,
      sort_order: 0,
      task_type: 'standard',
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setLibNewTitle(''); setLibNewCategory('')
  }

  const [tab, setTab] = useState<'board' | 'library' | 'teams' | 'jumps'>('board')

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-xs text-white/60 hover:text-white">← Hub</button>
          <h1 className="text-xl font-black">🐍🪜 Snake and Ladder — Admin</h1>
        </div>
        <button
          onClick={() => navigate('/snake-ladder')}
          className="text-xs font-bold bg-amber-400 text-black px-3 py-1.5 rounded-lg"
        >
          ▶ Play view
        </button>
      </header>

      {/* Game selector */}
      <section className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Active game:</span>
        {games.map(g => (
          <div key={g.id} className="flex items-center gap-1">
            <button
              onClick={() => activateGame(g.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                g.id === activeGameId ? 'bg-amber-400 text-black' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {g.name}
            </button>
            <button onClick={() => deleteGame(g.id)} className="text-gray-300 hover:text-red-500 text-xs px-1" title="Delete">✕</button>
          </div>
        ))}
        {!showNewGame ? (
          <button
            onClick={() => setShowNewGame(true)}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
          >
            + New Game
          </button>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); createGame() }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus value={newGameName} onChange={e => setNewGameName(e.target.value)}
              placeholder="Game name…"
              className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-sm font-bold">Create</button>
            <button type="button" onClick={() => { setShowNewGame(false); setNewGameName('') }} className="text-xs text-gray-400">cancel</button>
          </form>
        )}
      </section>

      {!activeGame ? (
        <div className="p-12 text-center text-gray-500">No active game. Create one above.</div>
      ) : (
        <>
          {/* Tabs */}
          <nav className="bg-white border-b border-gray-200 px-6 flex gap-1">
            {(['board', 'library', 'teams', 'jumps'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-black uppercase tracking-widest border-b-2 ${
                  tab === t ? 'border-amber-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'board' ? '🎯 Board' : t === 'library' ? '📚 Library' : t === 'teams' ? '👥 Teams' : '🐍 Snakes/Ladders'}
              </button>
            ))}
          </nav>

          <main className="p-6 max-w-6xl mx-auto">
            {tab === 'board' && (
              <BoardTab
                activeGame={activeGame}
                tileByNumber={tileByNumber}
                taskById={taskById}
                onEdit={setTileEditing}
              />
            )}
            {tab === 'library' && (
              <LibraryTab
                tasks={tasks}
                sections={sections}
                snakeSection={snakeSection}
                libNewTitle={libNewTitle} setLibNewTitle={setLibNewTitle}
                libNewHex={libNewHex} setLibNewHex={setLibNewHex}
                libNewCategory={libNewCategory} setLibNewCategory={setLibNewCategory}
                addLibraryCard={addLibraryCard}
                navigate={navigate}
                onRefresh={loadAll}
              />
            )}
            {tab === 'teams' && (
              <TeamsTab
                teams={teams}
                newTeamName={newTeamName} setNewTeamName={setNewTeamName}
                newTeamColor={newTeamColor} setNewTeamColor={setNewTeamColor}
                newTeamEmoji={newTeamEmoji} setNewTeamEmoji={setNewTeamEmoji}
                addTeam={addTeam}
                updateTeam={updateTeam}
                deleteTeam={deleteTeam}
              />
            )}
            {tab === 'jumps' && (
              <JumpsTab
                game={activeGame}
                onUpdate={updateBoardConfig}
              />
            )}
          </main>
        </>
      )}

      {/* Tile editor modal */}
      {tileEditing != null && activeGame && (
        <TileEditorModal
          tileNumber={tileEditing}
          currentTask={(() => {
            const t = tileByNumber.get(tileEditing)
            return t?.task_id ? taskById.get(t.task_id) ?? null : null
          })()}
          libraryTasks={filteredLibrary}
          librarySearch={librarySearch} setLibrarySearch={setLibrarySearch}
          librarySection={librarySection} setLibrarySection={setLibrarySection}
          sections={sections}
          createTitle={createTitle} setCreateTitle={setCreateTitle}
          createHex={createHex} setCreateHex={setCreateHex}
          createCategory={createCategory} setCreateCategory={setCreateCategory}
          createPoints={createPoints} setCreatePoints={setCreatePoints}
          saving={saving}
          onPick={id => assignTile(tileEditing, id)}
          onUnassign={() => assignTile(tileEditing, null)}
          onCreate={() => createCardAndAssign(tileEditing)}
          onClose={() => setTileEditing(null)}
          onEditCard={(id) => navigate(`/bingo-dash/admin/task/${id}`)}
        />
      )}
    </div>
  )
}

// ── Board overview tab (10x10 quick editor) ───────────────
function BoardTab({
  activeGame, tileByNumber, taskById, onEdit,
}: {
  activeGame: SnakeGame
  tileByNumber: Map<number, SnakeTile>
  taskById: Map<string, BingoTask>
  onEdit: (n: number) => void
}) {
  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Click any tile to assign an activity. Tiles follow the standard boustrophedon path: 1 is bottom-left, 10 bottom-right, 11 above 10, 20 above 1, and so on.
      </p>
      <div className="grid gap-0.5 max-w-3xl mx-auto" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
        {/* Render in visual boustrophedon order: top row is 100..91, then 81..90, etc. */}
        {(() => {
          const order: number[] = []
          for (let row = 9; row >= 0; row--) {
            const rowStart = row * 10 + 1
            const rowNums = Array.from({ length: 10 }, (_, i) => rowStart + i)
            if (row % 2 === 1) rowNums.reverse()
            order.push(...rowNums)
          }
          return order
        })().map((n) => {
          const tile = tileByNumber.get(n)
          const task = tile?.task_id ? taskById.get(tile.task_id) ?? null : null
          const snake = activeGame.snakes[n] ?? activeGame.snakes[String(n)]
          const ladder = activeGame.ladders[n] ?? activeGame.ladders[String(n)]
          return (
            <button
              key={n}
              onClick={() => onEdit(n)}
              className="aspect-square rounded flex items-center justify-center text-[10px] font-black relative hover:ring-2 hover:ring-amber-500 transition"
              style={{
                backgroundColor: task?.hex_code ?? '#f3f4f6',
                color: task ? '#fff' : '#374151',
              }}
              title={task ? task.title : '(empty)'}
            >
              <span className="absolute top-0.5 left-1 text-[9px] opacity-80">{n}</span>
              {task && <span className="px-1 pt-3 text-center leading-tight line-clamp-2 break-words">{task.title}</span>}
              {snake != null && <span className="absolute bottom-0.5 right-1">🐍</span>}
              {ladder != null && <span className="absolute bottom-0.5 right-1">🪜</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Library tab ───────────────────────────────────────────
function LibraryTab({
  tasks, sections, snakeSection,
  libNewTitle, setLibNewTitle,
  libNewHex, setLibNewHex,
  libNewCategory, setLibNewCategory,
  addLibraryCard,
  navigate,
  onRefresh,
}: {
  tasks: BingoTask[]
  sections: BingoSection[]
  snakeSection: BingoSection | null
  libNewTitle: string; setLibNewTitle: (v: string) => void
  libNewHex: string; setLibNewHex: (v: string) => void
  libNewCategory: string; setLibNewCategory: (v: string) => void
  addLibraryCard: () => void
  navigate: (p: string) => void
  onRefresh: () => void
}) {
  const [filter, setFilter] = useState<'all' | string>('all')
  const grouped = useMemo(() => {
    const list = filter === 'all' ? tasks : tasks.filter(t => t.section_id === filter)
    const bySection = new Map<string, BingoTask[]>()
    for (const t of list) {
      if (!bySection.has(t.section_id)) bySection.set(t.section_id, [])
      bySection.get(t.section_id)!.push(t)
    }
    return sections
      .map(s => ({ section: s, cards: bySection.get(s.id) ?? [] }))
      .filter(g => g.cards.length > 0)
  }, [tasks, sections, filter])

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      {/* Quick add to Snake and Ladder section */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 h-fit">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Add to Snake & Ladder library</h3>
        {!snakeSection ? (
          <p className="text-xs text-red-500">No snake-ladder section — run the migration first.</p>
        ) : (
          <form onSubmit={e => { e.preventDefault(); addLibraryCard() }} className="flex flex-col gap-2">
            <input
              value={libNewTitle} onChange={e => setLibNewTitle(e.target.value)}
              placeholder="Card title…" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            <input
              value={libNewCategory} onChange={e => setLibNewCategory(e.target.value)}
              placeholder="Category (optional)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Color</label>
              <input type="color" value={libNewHex} onChange={e => setLibNewHex(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              <input value={libNewHex} onChange={e => setLibNewHex(e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs font-mono" />
            </div>
            <button
              type="submit"
              disabled={!libNewTitle.trim()}
              className="py-2 rounded-lg bg-amber-400 text-black text-sm font-black disabled:opacity-40"
            >
              + Add card
            </button>
          </form>
        )}
        <hr className="my-4" />
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Filter</h3>
        <select
          value={filter} onChange={e => setFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          <option value="all">All sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="text-[11px] text-gray-400 mt-3 leading-snug">
          Library is shared across all games — Bingo Dash and Snake & Ladder. Editing a card here changes it everywhere it's used.
        </p>
      </div>

      {/* All library cards grouped by section */}
      <div className="flex flex-col gap-6">
        {grouped.length === 0 && (
          <p className="text-sm text-gray-500">No cards yet. Add your first card on the left.</p>
        )}
        {grouped.map(({ section, cards }) => (
          <div key={section.id}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-600">{section.name}</h3>
              <span className="text-xs text-gray-400">{cards.length}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {cards.map(card => (
                <div key={card.id} className="rounded-xl overflow-hidden text-white"
                  style={{ backgroundColor: card.hex_code }}>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-widest opacity-70">{card.category || '—'}</p>
                    <h4 className="text-sm font-black leading-tight line-clamp-2">{card.title}</h4>
                  </div>
                  <div className="px-3 pb-3 flex gap-1.5">
                    <button
                      onClick={() => navigate(`/bingo-dash/admin/task/${card.id}`)}
                      className="flex-1 py-1.5 rounded bg-white/25 text-[11px] font-bold hover:bg-white/35"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${card.title}"? This removes it from every game it's used in.`)) return
                        await supabase.from('bingo_tasks').delete().eq('id', card.id)
                        onRefresh()
                      }}
                      className="py-1.5 px-2 rounded bg-red-500/40 text-[11px] font-bold hover:bg-red-500/60"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamsTab({
  teams, newTeamName, setNewTeamName, newTeamColor, setNewTeamColor,
  newTeamEmoji, setNewTeamEmoji, addTeam, updateTeam, deleteTeam,
}: {
  teams: SnakeTeam[]
  newTeamName: string; setNewTeamName: (v: string) => void
  newTeamColor: string; setNewTeamColor: (v: string) => void
  newTeamEmoji: string; setNewTeamEmoji: (v: string) => void
  addTeam: () => void
  updateTeam: (id: string, patch: Partial<SnakeTeam>) => void
  deleteTeam: (id: string) => void
}) {
  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-6">
      <div className="bg-white rounded-2xl p-4 border border-gray-200 h-fit">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">Add team</h3>
        <form onSubmit={e => { e.preventDefault(); addTeam() }} className="flex flex-col gap-2">
          <input
            value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
            placeholder="Team name…" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1">Piece color</label>
            <div className="flex flex-wrap gap-1.5">
              {PIECE_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setNewTeamColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${newTeamColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Piece icon</label>
            <div className="flex flex-wrap gap-1">
              {PIECE_EMOJIS.map(e => (
                <button
                  key={e} type="button" onClick={() => setNewTeamEmoji(e)}
                  className={`w-8 h-8 rounded border text-lg ${newTeamEmoji === e ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={!newTeamName.trim()} className="py-2 rounded-lg bg-amber-400 text-black text-sm font-black disabled:opacity-40">
            + Add team
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-200">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">Teams ({teams.length})</h3>
        {teams.length === 0 && <p className="text-sm text-gray-500">No teams yet.</p>}
        <div className="flex flex-col gap-2">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <div
                className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-lg font-black"
                style={{ backgroundColor: team.hex_code, color: '#fff', boxShadow: '0 0 0 1px #e5e7eb' }}
              >
                {team.emoji || team.name.slice(0, 2).toUpperCase()}
              </div>
              <input
                value={team.name}
                onChange={e => updateTeam(team.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-amber-500 text-sm font-bold focus:outline-none"
              />
              <input
                type="color" value={team.hex_code}
                onChange={e => updateTeam(team.id, { hex_code: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                value={team.emoji ?? ''}
                onChange={e => updateTeam(team.id, { emoji: e.target.value.slice(0, 2) })}
                className="w-12 px-2 py-1 rounded border border-gray-200 text-center text-lg"
              />
              <span className="text-xs text-gray-400">Tile {team.position}</span>
              <button onClick={() => deleteTeam(team.id)} className="text-red-500 hover:text-red-700 text-sm font-black px-2">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function JumpsTab({
  game, onUpdate,
}: {
  game: SnakeGame
  onUpdate: (s: Record<string, number>, l: Record<string, number>) => void
}) {
  const [snakes, setSnakes] = useState<Record<string, number>>(game.snakes)
  const [ladders, setLadders] = useState<Record<string, number>>(game.ladders)
  useEffect(() => { setSnakes(game.snakes); setLadders(game.ladders) }, [game.id, game.snakes, game.ladders])

  const [snakeHead, setSnakeHead] = useState(''); const [snakeTail, setSnakeTail] = useState('')
  const [ladderBottom, setLadderBottom] = useState(''); const [ladderTop, setLadderTop] = useState('')

  const save = async (s: Record<string, number>, l: Record<string, number>) => {
    setSnakes(s); setLadders(l); onUpdate(s, l)
  }

  const addSnake = () => {
    const h = parseInt(snakeHead), t = parseInt(snakeTail)
    if (!h || !t || h <= t || h > 100 || t < 1) return
    save({ ...snakes, [h]: t }, ladders); setSnakeHead(''); setSnakeTail('')
  }
  const addLadder = () => {
    const b = parseInt(ladderBottom), t = parseInt(ladderTop)
    if (!b || !t || b >= t || t > 100 || b < 1) return
    save(snakes, { ...ladders, [b]: t }); setLadderBottom(''); setLadderTop('')
  }
  const removeSnake = (h: string) => {
    const next = { ...snakes }; delete next[h]; save(next, ladders)
  }
  const removeLadder = (b: string) => {
    const next = { ...ladders }; delete next[b]; save(snakes, next)
  }
  const reset = () => save(Object.fromEntries(Object.entries(DEFAULT_SNAKES).map(([k, v]) => [String(k), v])),
    Object.fromEntries(Object.entries(DEFAULT_LADDERS).map(([k, v]) => [String(k), v])))

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">🐍 Snakes ({Object.keys(snakes).length})</h3>
          <button onClick={reset} className="text-[10px] text-gray-400 hover:text-gray-600">Reset to defaults</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); addSnake() }} className="flex items-center gap-2 mb-3">
          <input type="number" min={2} max={100} placeholder="Head" value={snakeHead} onChange={e => setSnakeHead(e.target.value)}
            className="w-20 px-2 py-1.5 rounded border border-gray-200 text-sm" />
          <span className="text-xs text-gray-400">→</span>
          <input type="number" min={1} max={99} placeholder="Tail" value={snakeTail} onChange={e => setSnakeTail(e.target.value)}
            className="w-20 px-2 py-1.5 rounded border border-gray-200 text-sm" />
          <button type="submit" className="px-3 py-1.5 rounded bg-amber-400 text-black text-xs font-black">Add</button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(snakes).sort(([a], [b]) => Number(b) - Number(a)).map(([h, t]) => (
            <button key={h} onClick={() => removeSnake(h)}
              className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold hover:bg-red-100 hover:text-red-800">
              {h} → {t} ✕
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-200">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">🪜 Ladders ({Object.keys(ladders).length})</h3>
        <form onSubmit={e => { e.preventDefault(); addLadder() }} className="flex items-center gap-2 mb-3">
          <input type="number" min={1} max={99} placeholder="Bottom" value={ladderBottom} onChange={e => setLadderBottom(e.target.value)}
            className="w-20 px-2 py-1.5 rounded border border-gray-200 text-sm" />
          <span className="text-xs text-gray-400">→</span>
          <input type="number" min={2} max={100} placeholder="Top" value={ladderTop} onChange={e => setLadderTop(e.target.value)}
            className="w-20 px-2 py-1.5 rounded border border-gray-200 text-sm" />
          <button type="submit" className="px-3 py-1.5 rounded bg-amber-400 text-black text-xs font-black">Add</button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ladders).sort(([a], [b]) => Number(a) - Number(b)).map(([b, t]) => (
            <button key={b} onClick={() => removeLadder(b)}
              className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold hover:bg-red-100 hover:text-red-800">
              {b} → {t} ✕
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TileEditorModal({
  tileNumber, currentTask, libraryTasks,
  librarySearch, setLibrarySearch, librarySection, setLibrarySection, sections,
  createTitle, setCreateTitle, createHex, setCreateHex, createCategory, setCreateCategory, createPoints, setCreatePoints,
  saving, onPick, onUnassign, onCreate, onClose, onEditCard,
}: {
  tileNumber: number
  currentTask: BingoTask | null
  libraryTasks: BingoTask[]
  librarySearch: string; setLibrarySearch: (v: string) => void
  librarySection: 'all' | 'snake-ladder' | string; setLibrarySection: (v: string) => void
  sections: BingoSection[]
  createTitle: string; setCreateTitle: (v: string) => void
  createHex: string; setCreateHex: (v: string) => void
  createCategory: string; setCreateCategory: (v: string) => void
  createPoints: number; setCreatePoints: (v: number) => void
  saving: boolean
  onPick: (id: string) => void
  onUnassign: () => void
  onCreate: () => void
  onClose: () => void
  onEditCard: (id: string) => void
}) {
  const [mode, setMode] = useState<'library' | 'new'>('library')
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black">Tile {tileNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {/* Current assignment */}
        {currentTask ? (
          <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ backgroundColor: currentTask.hex_code }}>
            <div className="flex-1 text-white">
              <p className="text-[10px] uppercase tracking-widest opacity-75">{currentTask.category || '—'}</p>
              <h3 className="font-black">{currentTask.title}</h3>
            </div>
            <button onClick={() => onEditCard(currentTask.id)} className="text-xs font-bold bg-white/25 rounded px-2 py-1 text-white">Edit</button>
            <button onClick={onUnassign} className="text-xs font-bold bg-white/25 rounded px-2 py-1 text-white">Unassign</button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No activity assigned yet.</p>
        )}

        {/* Mode tabs */}
        <div className="flex gap-2 mb-3 border-b border-gray-200">
          {(['library', 'new'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-2 text-sm font-black border-b-2 ${mode === m ? 'border-amber-500 text-gray-900' : 'border-transparent text-gray-400'}`}
            >
              {m === 'library' ? '📚 Pick from Library' : '＋ Create new'}
            </button>
          ))}
        </div>

        {mode === 'library' ? (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                value={librarySearch} onChange={e => setLibrarySearch(e.target.value)}
                placeholder="Search cards…"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              <select value={librarySection} onChange={e => setLibrarySection(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <option value="all">All sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
              {libraryTasks.map(t => (
                <button
                  key={t.id} onClick={() => onPick(t.id)}
                  className="text-left rounded-lg p-2.5 text-white hover:ring-2 hover:ring-amber-400 transition"
                  style={{ backgroundColor: t.hex_code }}
                >
                  <p className="text-[9px] uppercase tracking-widest opacity-70">{t.category || '—'}</p>
                  <p className="text-sm font-black line-clamp-2 leading-tight">{t.title}</p>
                </button>
              ))}
              {libraryTasks.length === 0 && <p className="col-span-full text-sm text-gray-500 p-4 text-center">No cards match.</p>}
            </div>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); onCreate() }} className="flex flex-col gap-2">
            <input
              value={createTitle} onChange={e => setCreateTitle(e.target.value)}
              placeholder="Card title" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" autoFocus
            />
            <input
              value={createCategory} onChange={e => setCreateCategory(e.target.value)}
              placeholder="Category (optional)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Color</label>
              <input type="color" value={createHex} onChange={e => setCreateHex(e.target.value)} className="w-9 h-9 rounded cursor-pointer" />
              <input value={createHex} onChange={e => setCreateHex(e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs font-mono" />
              <label className="text-xs text-gray-500">Points</label>
              <input type="number" min={0} value={createPoints} onChange={e => setCreatePoints(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1 rounded border border-gray-200 text-sm" />
            </div>
            <button type="submit" disabled={!createTitle.trim() || saving}
              className="py-2 rounded-lg bg-amber-400 text-black text-sm font-black disabled:opacity-40">
              {saving ? 'Creating…' : '+ Create & assign to tile'}
            </button>
            <p className="text-[11px] text-gray-400">New cards land in the Snake &amp; Ladder library section and can be edited in the library tab.</p>
          </form>
        )}
      </div>
    </div>
  )
}
