import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import type { BingoTask, BingoTeam, BingoScan, BingoSettings, BingoSection, BingoCategory, BingoChallengeSection, BingoMember, BingoPhotoSubmission } from '../types/database'
import { BINGO_LINES, buildBingoSlots, completedBingoLines } from '../lib/bingoLines'

const PRESET_COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Fuchsia', hex: '#D946EF' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Rose', hex: '#F43F5E' },
]

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── Import helpers ─────────────────────────────────────────────────────────────
interface ImportRow {
  title: string
  color: string
  hex_code: string
  clues: string[]
}

function parseImport(raw: string): ImportRow[] {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects')
  return parsed.map((item: unknown, i: number) => {
    if (typeof item !== 'object' || item === null) throw new Error(`Item ${i + 1} is not an object`)
    const obj = item as Record<string, unknown>
    if (!obj.title || typeof obj.title !== 'string') throw new Error(`Item ${i + 1} missing "title"`)
    if (!obj.color || typeof obj.color !== 'string') throw new Error(`Item ${i + 1} missing "color"`)
    if (!obj.hex_code || typeof obj.hex_code !== 'string') throw new Error(`Item ${i + 1} missing "hex_code"`)
    const clues: string[] = []
    if (typeof obj.clue === 'string' && obj.clue.trim()) clues.push(obj.clue.trim())
    if (Array.isArray(obj.clues)) {
      for (const c of obj.clues) {
        if (typeof c === 'string' && c.trim()) clues.push(c.trim())
      }
    }
    return { title: obj.title.trim(), color: obj.color.trim(), hex_code: obj.hex_code.trim(), clues }
  })
}

// ── Color picker sub-form ──────────────────────────────────────────────────────
function ColorPicker({
  hex,
  colorName,
  onHexChange,
  onNameChange,
}: {
  hex: string
  colorName: string
  onHexChange: (h: string) => void
  onNameChange: (n: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Color Name</label>
        <input
          type="text"
          value={colorName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Blue"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.hex}
              type="button"
              onClick={() => { onHexChange(c.hex); if (!colorName) onNameChange(c.name) }}
              className={`w-7 h-7 rounded-full border-2 transition-all ${hex === c.hex ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={hex} onChange={e => onHexChange(e.target.value)} className="w-9 h-9 rounded cursor-pointer" />
          <input type="text" value={hex} onChange={e => onHexChange(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm w-28" />
        </div>
      </div>
    </div>
  )
}

// ── Board tile (interactive editor with drag support) ──────────────────────────
function BoardTile({
  task,
  index,
  total,
  isDragOver,
  isBeingDragged,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
}: {
  task: BingoTask
  index: number
  total: number
  isDragOver: boolean
  isBeingDragged: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onRemove: () => void
  onEdit: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragLeave: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={`relative group aspect-square rounded-lg overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isBeingDragged ? 'opacity-40 scale-95' : ''
      } ${isDragOver ? 'ring-2 ring-white scale-105' : ''}`}
      style={{ backgroundColor: task.hex_code }}
    >
      {/* Drag-over highlight */}
      {isDragOver && (
        <div className="absolute inset-0 bg-white/30 z-30 rounded-lg pointer-events-none" />
      )}

      {/* Category badge */}
      {task.category && (
        <div className="absolute top-0.5 left-0.5 right-0.5 z-10 pointer-events-none">
          <span className="block text-[7px] bg-black/40 text-white/90 rounded px-1 py-px truncate leading-tight font-bold">
            {task.category}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="absolute inset-0 flex items-center justify-center p-1.5 pt-4">
        <p className="text-white font-black text-[9px] text-center leading-tight line-clamp-3 break-words">
          {task.title}
        </p>
      </div>

      {/* Hover controls */}
      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col z-20">
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-base hover:scale-125 transition-transform"
            title="Edit tile"
          >
            ✏️
          </button>
        </div>
        <div className="flex items-center justify-between px-1.5 pb-1.5">
          <button
            onClick={e => { e.stopPropagation(); onMoveLeft() }}
            disabled={index === 0}
            className="text-white/80 hover:text-white disabled:opacity-20 font-bold text-xs leading-none px-0.5"
            title="Move left"
          >
            ◀
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="text-red-300 hover:text-red-100 font-bold text-xs leading-none"
            title="Remove from grid"
          >
            ✕
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMoveRight() }}
            disabled={index === total - 1}
            className="text-white/80 hover:text-white disabled:opacity-20 font-bold text-xs leading-none px-0.5"
            title="Move right"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Category group block (used in Board tab gallery) ──────────────────────────
function CategoryGroupBlock({
  group,
  editingCategoryId, setEditingCategoryId,
  categories, scans, copiedId,
  navigate,
  saveCategoryInline, setBulkCategoryColor, setBulkCategoryPoints,
  setQrTask, copyLink, duplicateTask, openTileEdit, deleteTask,
}: {
  group: { label: string; key: string; tasks: BingoTask[] }
  editingCategoryId: string | null
  setEditingCategoryId: (id: string | null) => void
  categories: BingoCategory[]
  scans: BingoScan[]
  copiedId: string | null
  navigate: (path: string) => void
  saveCategoryInline: (taskId: string, cat: string) => void
  setBulkCategoryColor: (key: string, hex: string) => void
  setBulkCategoryPoints: (key: string, pts: number) => void
  setQrTask: (t: BingoTask) => void
  copyLink: (id: string) => void
  duplicateTask: (t: BingoTask) => void
  openTileEdit: (t: BingoTask) => void
  deleteTask: (id: string, title: string) => void
}) {
  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{group.label}</h3>
        <span className="text-xs text-gray-500 font-medium">{group.tasks.length}</span>
        <div className="flex-1 h-px bg-white/10" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-500">color for all:</span>
          <input
            type="color"
            defaultValue={group.tasks[0]?.hex_code ?? '#3B82F6'}
            key={group.key + '-color'}
            className="w-7 h-7 rounded cursor-pointer border border-white/20"
            onChange={e => setBulkCategoryColor(group.key, e.target.value)}
            title={`Set color for all ${group.label} tasks`}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-500">pts for all:</span>
          <input
            type="number" min={0}
            defaultValue={group.tasks[0]?.points ?? 0}
            key={group.key + '-pts'}
            className="w-14 px-1.5 py-0.5 text-xs border border-white/20 bg-gray-800 text-white rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-violet-500"
            onBlur={e => setBulkCategoryPoints(group.key, Math.max(0, parseInt(e.target.value) || 0))}
            onKeyDown={e => {
              if (e.key === 'Enter') setBulkCategoryPoints(group.key, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0))
            }}
            title={`Set points for all ${group.label} tasks`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {group.tasks.map(task => (
          <div key={task.id} className="rounded-2xl overflow-hidden flex flex-col shadow-sm"
            style={{ backgroundColor: task.hex_code }}>
            <div className="px-4 pt-4 pb-3 flex-1">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{task.color}</p>
              <h3 className="text-white font-black text-lg leading-tight">{task.title}</h3>
              {editingCategoryId === task.id ? (
                <select
                  autoFocus
                  defaultValue={task.category || ''}
                  onChange={e => saveCategoryInline(task.id, e.target.value)}
                  onBlur={() => setEditingCategoryId(null)}
                  className="w-full bg-black/20 text-white text-xs px-2 py-1 rounded border border-white/30 focus:outline-none focus:border-white/60 mt-2"
                >
                  <option value="">— Uncategorized —</option>
                  {categories.filter(c => c.section_id === task.section_id).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__new__">+ New category…</option>
                </select>
              ) : (
                <button
                  onClick={() => setEditingCategoryId(task.id)}
                  className="mt-1.5 text-white/50 text-xs hover:text-white/80 transition-colors text-left block"
                >
                  {task.category ? `📂 ${task.category}` : '+ category'}
                </button>
              )}
              <div className="flex items-center gap-2 mt-2">
                <p className="text-white/50 text-xs">
                  {scans.filter(s => s.task_id === task.id && s.completed).length} completed ·{' '}
                  {scans.filter(s => s.task_id === task.id).length} scanned
                </p>
                {(task.points ?? 0) > 0 && (
                  <span className="bg-black/50 text-white text-[10px] font-black rounded px-1.5 py-0.5 shadow shadow-black/30 ring-1 ring-white/20">
                    {task.points} pts
                  </span>
                )}
              </div>
              <p className="text-white/40 text-xs mt-0.5">{task.in_grid ? '✓ In grid' : 'Off grid'}</p>
            </div>
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              <button onClick={() => navigate(`/bingo-dash/admin/task/${task.id}`)}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">
                Edit
              </button>
              <button onClick={() => setQrTask(task)}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">
                QR
              </button>
              <button onClick={() => copyLink(task.id)}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">
                {copiedId === task.id ? '✓' : '🔗'}
              </button>
              <button onClick={() => duplicateTask(task)}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors"
                title="Duplicate this card in this section">
                ⎘ Copy
              </button>
              <button onClick={() => openTileEdit(task)}
                className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors"
                title="Move to another section or category">
                Move
              </button>
              <button onClick={() => deleteTask(task.id, task.title)}
                className="px-3 py-1.5 bg-red-500/30 rounded-lg text-white text-xs font-bold hover:bg-red-500/50 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function BingoDashAdmin() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<BingoTask[]>([])
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [sections, setSections] = useState<BingoSection[]>([])
  const [categories, setCategories] = useState<BingoCategory[]>([])
  const [challengeSections, setChallengeSections] = useState<BingoChallengeSection[]>([])
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null)
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [showInlineBoardCreate, setShowInlineBoardCreate] = useState(false)
  const [inlineBoardName, setInlineBoardName] = useState('')
  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState<string | null>(null) // section id or null
  const [newCategoryName, setNewCategoryName] = useState('')
  // Challenge section management (grouping above categories in the Board tab)
  const [showChallengeSectionManager, setShowChallengeSectionManager] = useState(false)
  const [newChallengeSectionName, setNewChallengeSectionName] = useState('')
  const [renamingCSId, setRenamingCSId] = useState<string | null>(null)
  const [renamingCSName, setRenamingCSName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [qrTask, setQrTask] = useState<BingoTask | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showJoinLink, setShowJoinLink] = useState(false)
  const [joinLinkCopied, setJoinLinkCopied] = useState(false)
  const [joinLinkTab, setJoinLinkTab] = useState<'player' | 'observer'>('player')

  // Add challenge form
  const [formTitle, setFormTitle] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formHex, setFormHex] = useState('#3B82F6')
  const [formCategory, setFormCategory] = useState('')
  const [formPoints, setFormPoints] = useState(0)
  const [formTaskType, setFormTaskType] = useState<'standard' | 'answer' | 'photo'>('standard')
  const [formAnswerQuestion, setFormAnswerQuestion] = useState('')
  const [formAnswerText, setFormAnswerText] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null)
  const [importing, setImporting] = useState(false)

  // Timer
  const [settings, setSettings] = useState<BingoSettings | null>(null)
  const [timerDisplay, setTimerDisplay] = useState('00:00')
  const [timerMinutesInput, setTimerMinutesInput] = useState('')
  const [timerSaving, setTimerSaving] = useState(false)

  // Tile editor modal
  const [editingTile, setEditingTile] = useState<BingoTask | null>(null)
  const [tileTitle, setTileTitle] = useState('')
  const [tileColor, setTileColor] = useState('')
  const [tileHex, setTileHex] = useState('#3B82F6')
  const [tileCategory, setTileCategory] = useState('')
  const [tilePoints, setTilePoints] = useState(0)
  const [tileSectionId, setTileSectionId] = useState<string>('')
  const [tileTaskType, setTileTaskType] = useState<'standard' | 'answer' | 'photo'>('standard')
  const [tileAnswerQuestion, setTileAnswerQuestion] = useState('')
  const [tileAnswerText, setTileAnswerText] = useState('')
  const [tileSaving, setTileSaving] = useState(false)

  // Inline category picker on gallery cards (shows a <select> dropdown)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  // Category filter for challenges gallery
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Category filter for off-grid list
  const [offGridCategoryFilter, setOffGridCategoryFilter] = useState('all')

  // Cross-section card library filters (Add to Grid panel)
  // 'current' = only this section's off-grid cards; 'all' = every section.
  const [addListSectionFilter, setAddListSectionFilter] = useState<'current' | 'all' | string>('current')
  const [addListSearch, setAddListSearch] = useState('')

  // Drag state
  const [dragState, setDragState] = useState<{ id: string; type: 'grid' | 'list' } | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  // Slot picker: which empty grid slot is being filled via click
  const [slotPickerIndex, setSlotPickerIndex] = useState<number | null>(null)
  const [slotPickerFilter, setSlotPickerFilter] = useState('all')

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'board' | 'library' | 'teams'>('board')

  // Team grid viewer modal
  const [viewingTeam, setViewingTeam] = useState<BingoTeam | null>(null)
  const [members, setMembers] = useState<BingoMember[]>([])
  const [photoSubmissions, setPhotoSubmissions] = useState<BingoPhotoSubmission[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupPassword, setNewGroupPassword] = useState('')
  const [uploadingTeamPhoto, setUploadingTeamPhoto] = useState<string | null>(null)

  // Library: compartment filter
  const [libraryCompartmentFilter, setLibraryCompartmentFilter] = useState<'all' | string>('all')

  // ── Derived ────────────────────────────────────────────────────────────────
  const scopedTasks = currentSectionId ? tasks.filter(t => t.section_id === currentSectionId) : []
  const scopedTeams = currentSectionId ? teams.filter(t => t.section_id === currentSectionId) : []
  const gridTasks = scopedTasks.filter(t => t.in_grid).sort((a, b) => a.sort_order - b.sort_order)

  // Sparse 25-slot layout: each in-grid task sits at slot = sort_order (0-24).
  // Any legacy task whose sort_order is out of range or colliding is placed in
  // the next available slot so existing data migrates gracefully.
  const gridSlots: (BingoTask | null)[] = (() => {
    const slots: (BingoTask | null)[] = Array(25).fill(null)
    const overflow: BingoTask[] = []
    for (const t of gridTasks) {
      const s = t.sort_order
      if (Number.isInteger(s) && s >= 0 && s < 25 && slots[s] === null) slots[s] = t
      else overflow.push(t)
    }
    for (const t of overflow) {
      const i = slots.findIndex(x => x === null)
      if (i !== -1) slots[i] = t
    }
    return slots
  })()
  const allCategories = [...new Set(scopedTasks.map(t => t.category).filter(Boolean))].sort() as string[]
  const isTimerRunning = !!settings?.timer_end_at && new Date(settings.timer_end_at) > new Date()

  // Library view: candidates for "Add to Grid" across sections.
  // A card is a candidate when it is NOT already on the current section's grid.
  // Cross-section cards get duplicated into the current section on add.
  const addListTasks = (() => {
    const search = addListSearch.trim().toLowerCase()
    let list = tasks.filter(t => !(t.section_id === currentSectionId && t.in_grid))
    if (addListSectionFilter === 'current') list = list.filter(t => t.section_id === currentSectionId)
    else if (addListSectionFilter !== 'all') list = list.filter(t => t.section_id === addListSectionFilter)
    if (offGridCategoryFilter !== 'all') list = list.filter(t => t.category === offGridCategoryFilter)
    if (search) list = list.filter(t =>
      t.title.toLowerCase().includes(search) ||
      (t.category ?? '').toLowerCase().includes(search) ||
      (t.color ?? '').toLowerCase().includes(search)
    )
    return list.sort((a, b) => a.title.localeCompare(b.title))
  })()

  const addListCategories = (() => {
    let base = tasks.filter(t => !(t.section_id === currentSectionId && t.in_grid))
    if (addListSectionFilter === 'current') base = base.filter(t => t.section_id === currentSectionId)
    else if (addListSectionFilter !== 'all') base = base.filter(t => t.section_id === addListSectionFilter)
    return [...new Set(base.map(t => t.category).filter(Boolean))].sort() as string[]
  })()

  const filteredTasks = categoryFilter === 'all'
    ? scopedTasks
    : categoryFilter === '__none__'
      ? scopedTasks.filter(t => !t.category)
      : scopedTasks.filter(t => t.category === categoryFilter)

  // Group filtered tasks by category for the gallery
  const groupedTasks = (() => {
    if (categoryFilter !== 'all') {
      const label = categoryFilter === '__none__' ? 'Uncategorized' : categoryFilter
      return [{ label, key: categoryFilter, tasks: filteredTasks }]
    }
    const byCategory = new Map<string, BingoTask[]>()
    const uncategorized: BingoTask[] = []
    for (const task of scopedTasks) {
      if (!task.category) { uncategorized.push(task); continue }
      if (!byCategory.has(task.category)) byCategory.set(task.category, [])
      byCategory.get(task.category)!.push(task)
    }
    const groups = [...byCategory.keys()].sort().map(cat => ({ label: cat, key: cat, tasks: byCategory.get(cat)! }))
    if (uncategorized.length > 0) groups.push({ label: 'Uncategorized', key: '__none__', tasks: uncategorized })
    return groups
  })()

  // Group tasks by challenge section → category (for the Board tab gallery)
  const groupedByChallengeSections = (() => {
    const scopedCS = challengeSections
      .filter(cs => cs.game_section_id === currentSectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
    const scopedCats = categories.filter(c => c.section_id === currentSectionId)

    const catTaskGroups = (catName: string) => scopedTasks.filter(t => t.category === catName)

    type CatGroup = { label: string; key: string; tasks: BingoTask[] }
    type CSGroup = { cs: BingoChallengeSection | null; groups: CatGroup[] }
    const result: CSGroup[] = []

    for (const cs of scopedCS) {
      const csCats = scopedCats.filter(c => c.challenge_section_id === cs.id)
      const groups = csCats
        .map(cat => ({ label: cat.name, key: cat.name, tasks: catTaskGroups(cat.name) }))
        .sort((a, b) => a.label.localeCompare(b.label))
      result.push({ cs, groups })
    }

    // Unassigned: categories not linked to any challenge section + tasks with no category
    const unassignedCats = scopedCats.filter(c => !c.challenge_section_id)
    const unassignedGroups: CatGroup[] = unassignedCats
      .map(cat => ({ label: cat.name, key: cat.name, tasks: catTaskGroups(cat.name) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const noCategory = scopedTasks.filter(t => !t.category)
    if (noCategory.length > 0) unassignedGroups.push({ label: 'Uncategorized', key: '__none__', tasks: noCategory })
    if (unassignedGroups.length > 0 || scopedCS.length === 0) {
      result.push({ cs: null, groups: unassignedGroups })
    }

    return result
  })()

  // Library: Compartment > Category > Cards (all sections)
  const groupedLibrary = (() => {
    const sectionList = libraryCompartmentFilter === 'all'
      ? sections
      : sections.filter(s => s.id === libraryCompartmentFilter)
    return sectionList.map(section => {
      const sectionTasks = tasks.filter(t => t.section_id === section.id)
      const byCategory = new Map<string, BingoTask[]>()
      const uncategorized: BingoTask[] = []
      for (const task of sectionTasks) {
        if (!task.category) { uncategorized.push(task); continue }
        if (!byCategory.has(task.category)) byCategory.set(task.category, [])
        byCategory.get(task.category)!.push(task)
      }
      const categories = [...byCategory.keys()].sort().map(cat => ({
        label: cat, key: cat, tasks: byCategory.get(cat)!.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      if (uncategorized.length > 0) categories.push({ label: 'Uncategorized', key: '__none__', tasks: uncategorized })
      return { section, categories, totalTasks: sectionTasks.length }
    })
  })()

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [tasksRes, teamsRes, scansRes, sectionsRes, categoriesRes, challengeSectionsRes, membersRes, subsRes] = await Promise.all([
      supabase.from('bingo_tasks').select('*').order('sort_order'),
      supabase.from('bingo_teams').select('*').order('created_at'),
      supabase.from('bingo_scans').select('*'),
      supabase.from('bingo_sections').select('*').order('sort_order'),
      supabase.from('bingo_categories').select('*').order('sort_order'),
      supabase.from('bingo_challenge_sections').select('*').order('sort_order'),
      supabase.from('bingo_members').select('*').order('created_at'),
      supabase.from('bingo_photo_submissions').select('*').order('created_at', { ascending: false }),
    ])
    if (tasksRes.data) setTasks(tasksRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
    if (scansRes.data) setScans(scansRes.data)
    if (sectionsRes.data) {
      setSections(sectionsRes.data)
      setCurrentSectionId(prev => prev ?? sectionsRes.data[0]?.id ?? null)
    }
    if (categoriesRes.data) setCategories(categoriesRes.data)
    if (challengeSectionsRes.data) setChallengeSections(challengeSectionsRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (subsRes.data) setPhotoSubmissions(subsRes.data)
    setLoading(false)
  }, [])

  // ── Section CRUD ──────────────────────────────────────────────────────────
  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const createSection = async (overrideName?: string) => {
    const name = (overrideName ?? newSectionName).trim()
    if (!name) return
    const baseSlug = slugify(name) || `section-${Date.now()}`
    let slug = baseSlug
    let i = 2
    while (sections.some(s => s.slug === slug)) { slug = `${baseSlug}-${i++}` }
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order), -1)
    const { data, error } = await supabase.from('bingo_sections')
      .insert({ name, slug, sort_order: maxOrder + 1 })
      .select().single()
    if (error || !data) { alert('Failed to create section'); return }
    setSections(prev => [...prev, data])
    setCurrentSectionId(data.id)
    if (overrideName) setInlineBoardName('')
    else setNewSectionName('')
  }

  const renameSection = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSections(prev => prev.map(s => s.id === id ? { ...s, name: trimmed } : s))
    await supabase.from('bingo_sections').update({ name: trimmed }).eq('id', id)
  }

  const deleteSection = async (id: string) => {
    const section = sections.find(s => s.id === id)
    if (!section) return
    if (sections.length <= 1) { alert('Cannot delete the last section.'); return }
    const taskCount = tasks.filter(t => t.section_id === id).length
    const teamCount = teams.filter(t => t.section_id === id).length
    if (!confirm(`Delete "${section.name}"? This will remove ${taskCount} challenges and ${teamCount} teams.`)) return
    await supabase.from('bingo_sections').delete().eq('id', id)
    const remaining = sections.filter(s => s.id !== id)
    setSections(remaining)
    if (currentSectionId === id) setCurrentSectionId(remaining[0]?.id ?? null)
    await fetchAll()
  }

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const createCategoryByName = async (sectionId: string, rawName: string): Promise<BingoCategory | null> => {
    const name = rawName.trim()
    if (!name || !sectionId) return null
    const existing = categories.find(c => c.section_id === sectionId && c.name === name)
    if (existing) return existing
    const maxOrder = categories.filter(c => c.section_id === sectionId)
      .reduce((m, c) => Math.max(m, c.sort_order), -1)
    const { data, error } = await supabase.from('bingo_categories')
      .insert({ section_id: sectionId, name, sort_order: maxOrder + 1 })
      .select().single()
    if (error || !data) { alert('Failed to create category'); return null }
    setCategories(prev => [...prev, data])
    return data
  }

  const createCategory = async (sectionId: string) => {
    const created = await createCategoryByName(sectionId, newCategoryName)
    if (created) setNewCategoryName('')
  }

  // Handle the "+ New category…" sentinel from category <select>s.
  // Returns the chosen category name, or null if the user cancelled.
  const promptAndCreateCategory = async (sectionId: string): Promise<string | null> => {
    const raw = window.prompt('New category name:')
    if (!raw || !raw.trim()) return null
    const cat = await createCategoryByName(sectionId, raw)
    return cat?.name ?? null
  }

  const renameCategory = async (id: string, sectionId: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const old = categories.find(c => c.id === id)
    if (!old || old.name === trimmed) return
    if (categories.some(c => c.section_id === sectionId && c.name === trimmed && c.id !== id)) {
      alert(`Category "${trimmed}" already exists.`)
      return
    }
    // Update category name and cascade to all tasks in this section that reference it
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: trimmed } : c))
    setTasks(prev => prev.map(t =>
      t.section_id === sectionId && t.category === old.name ? { ...t, category: trimmed } : t
    ))
    await supabase.from('bingo_categories').update({ name: trimmed }).eq('id', id)
    await supabase.from('bingo_tasks')
      .update({ category: trimmed })
      .eq('section_id', sectionId)
      .eq('category', old.name)
  }

  const deleteCategory = async (id: string, sectionId: string) => {
    const cat = categories.find(c => c.id === id)
    if (!cat) return
    const affected = tasks.filter(t => t.section_id === sectionId && t.category === cat.name).length
    if (!confirm(`Delete category "${cat.name}"? ${affected > 0 ? `${affected} card${affected !== 1 ? 's' : ''} will become uncategorized.` : ''}`)) return
    setCategories(prev => prev.filter(c => c.id !== id))
    setTasks(prev => prev.map(t =>
      t.section_id === sectionId && t.category === cat.name ? { ...t, category: '' } : t
    ))
    await supabase.from('bingo_categories').delete().eq('id', id)
    if (affected > 0) {
      await supabase.from('bingo_tasks')
        .update({ category: '' })
        .eq('section_id', sectionId)
        .eq('category', cat.name)
    }
  }

  // ── Challenge section CRUD (groupings above categories in Board tab) ──────────
  const createChallengeSection = async () => {
    const name = newChallengeSectionName.trim()
    if (!name || !currentSectionId) return
    const maxOrder = challengeSections.filter(cs => cs.game_section_id === currentSectionId)
      .reduce((m, cs) => Math.max(m, cs.sort_order), -1)
    const { data, error } = await supabase.from('bingo_challenge_sections')
      .insert({ game_section_id: currentSectionId, name, sort_order: maxOrder + 1 })
      .select().single()
    if (error || !data) { alert('Failed to create section'); return }
    setChallengeSections(prev => [...prev, data])
    setNewChallengeSectionName('')
  }

  const renameChallengeSection = async (id: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setChallengeSections(prev => prev.map(cs => cs.id === id ? { ...cs, name: trimmed } : cs))
    await supabase.from('bingo_challenge_sections').update({ name: trimmed }).eq('id', id)
    setRenamingCSId(null)
  }

  const deleteChallengeSection = async (id: string) => {
    const cs = challengeSections.find(s => s.id === id)
    if (!cs) return
    const catCount = categories.filter(c => c.challenge_section_id === id).length
    if (!confirm(`Delete section "${cs.name}"?${catCount > 0 ? ` ${catCount} categor${catCount !== 1 ? 'ies' : 'y'} will become unassigned.` : ''}`)) return
    setChallengeSections(prev => prev.filter(s => s.id !== id))
    setCategories(prev => prev.map(c => c.challenge_section_id === id ? { ...c, challenge_section_id: null } : c))
    await supabase.from('bingo_challenge_sections').delete().eq('id', id)
  }

  const assignCategoryToSection = async (catId: string, challengeSectionId: string | null) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, challenge_section_id: challengeSectionId } : c))
    await supabase.from('bingo_categories').update({ challenge_section_id: challengeSectionId }).eq('id', catId)
  }

  const setActiveSection = async (id: string) => {
    setSettings(prev => prev ? { ...prev, active_section_id: id } : prev)
    await supabase.from('bingo_settings').update({ active_section_id: id }).eq('id', 'main')
  }

  const toggleSectionGameStarted = async (sectionId: string, started: boolean) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, game_started: started } : s))
    await supabase.from('bingo_sections').update({ game_started: started }).eq('id', sectionId)
  }

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('bingo_settings').select('*').eq('id', 'main').single()
    if (data) setSettings(data)
  }, [])

  useEffect(() => { fetchAll(); fetchSettings() }, [fetchAll, fetchSettings])

  // Real-time timer sync
  useEffect(() => {
    const channel = supabase
      .channel('bingo-settings-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_settings' }, fetchSettings)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchSettings])

  // Real-time section game_started sync
  useEffect(() => {
    const channel = supabase
      .channel('bingo-sections-admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_sections' }, ({ new: updated }) => {
        setSections(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } as typeof s : s))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      if (!settings) { setTimerDisplay('00:00'); return }
      if (settings.timer_end_at) {
        setTimerDisplay(formatTime((new Date(settings.timer_end_at).getTime() - Date.now()) / 1000))
      } else {
        setTimerDisplay(formatTime(settings.timer_seconds))
      }
    }, 250)
    return () => clearInterval(id)
  }, [settings])

  // ── Timer actions ──────────────────────────────────────────────────────────
  const updateSettings = async (patch: Partial<Omit<BingoSettings, 'id' | 'created_at'>>) => {
    setTimerSaving(true)
    try {
      const { data } = await supabase.from('bingo_settings').update(patch).eq('id', 'main').select().single()
      if (data) setSettings(data)
    } finally { setTimerSaving(false) }
  }

  const adjustTimer = (deltaMinutes: number) => {
    if (!settings) return
    const delta = deltaMinutes * 60
    if (isTimerRunning && settings.timer_end_at) {
      updateSettings({ timer_end_at: new Date(new Date(settings.timer_end_at).getTime() + delta * 1000).toISOString() })
    } else {
      updateSettings({ timer_seconds: Math.max(0, settings.timer_seconds + delta) })
    }
  }

  const setTimerFromInput = () => {
    const mins = parseFloat(timerMinutesInput)
    if (isNaN(mins) || mins < 0) return
    const seconds = Math.round(mins * 60)
    if (isTimerRunning) {
      updateSettings({ timer_end_at: new Date(Date.now() + seconds * 1000).toISOString(), timer_seconds: seconds })
    } else {
      updateSettings({ timer_seconds: seconds })
    }
    setTimerMinutesInput('')
  }

  const startTimer = () => {
    if (!settings?.timer_seconds) return
    updateSettings({ timer_end_at: new Date(Date.now() + settings.timer_seconds * 1000).toISOString() })
  }

  const pauseTimer = () => {
    if (!settings?.timer_end_at) return
    const remaining = Math.max(0, Math.round((new Date(settings.timer_end_at).getTime() - Date.now()) / 1000))
    updateSettings({ timer_seconds: remaining, timer_end_at: null })
  }

  const resetTimer = () => updateSettings({ timer_end_at: null })

  // ── Board grid actions ─────────────────────────────────────────────────────

  // Persist a 25-slot layout. Each in-grid task is stored with sort_order = slot index.
  const applySlots = async (
    slots: (BingoTask | null)[],
    extraUpdates?: Array<{ id: string; in_grid: boolean }>,
  ) => {
    const sortUpdates: { id: string; sort_order: number }[] = []
    slots.forEach((t, i) => { if (t) sortUpdates.push({ id: t.id, sort_order: i }) })
    setTasks(prev => prev.map(t => {
      const sortU = sortUpdates.find(u => u.id === t.id)
      const inGridU = extraUpdates?.find(u => u.id === t.id)
      return { ...t, ...(sortU ? { sort_order: sortU.sort_order } : {}), ...(inGridU ? { in_grid: inGridU.in_grid } : {}) }
    }))
    await Promise.all([
      ...sortUpdates.map(u => supabase.from('bingo_tasks').update({ sort_order: u.sort_order }).eq('id', u.id)),
      ...(extraUpdates ?? []).map(u => supabase.from('bingo_tasks').update({ in_grid: u.in_grid }).eq('id', u.id)),
    ])
  }

  // Swap (or move-to-empty) between two slot indices. Leaves all other tiles untouched.
  const reorderGrid = async (fromSlot: number, toSlot: number) => {
    if (fromSlot === toSlot || fromSlot < 0 || toSlot < 0 || fromSlot > 24 || toSlot > 24) return
    const slots = [...gridSlots]
    ;[slots[fromSlot], slots[toSlot]] = [slots[toSlot], slots[fromSlot]]
    await applySlots(slots)
  }

  // Place an off-grid task at the exact slot the user chose. If that slot is
  // taken, fall back to the first empty slot so we never silently overwrite.
  const insertIntoGrid = async (taskId: string, atIndex: number) => {
    const taskToAdd = tasks.find(t => t.id === taskId)
    if (!taskToAdd || taskToAdd.in_grid) return
    const slots = [...gridSlots]
    let target = atIndex
    if (target < 0 || target >= 25 || slots[target] !== null) {
      target = slots.findIndex(s => s === null)
      if (target === -1) return
    }
    slots[target] = { ...taskToAdd, in_grid: true }
    await applySlots(slots, [{ id: taskId, in_grid: true }])
  }

  const removeTile = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, in_grid: false } : t))
    await supabase.from('bingo_tasks').update({ in_grid: false }).eq('id', taskId)
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onGridDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
    setDragState({ id: taskId, type: 'grid' })
  }

  const onListDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', taskId)
    setDragState({ id: taskId, type: 'list' })
  }

  const onSlotDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragState?.type === 'grid' ? 'move' : 'copy'
    setDragOverSlot(slotIndex)
  }

  const onSlotDrop = async (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    setDragOverSlot(null)
    if (!dragState) return
    if (dragState.type === 'grid') {
      const fromSlot = gridSlots.findIndex(t => t?.id === dragState.id)
      if (fromSlot === -1) { setDragState(null); return }
      await reorderGrid(fromSlot, slotIndex)
    } else {
      await insertIntoGrid(dragState.id, slotIndex)
    }
    setDragState(null)
  }

  const onDragEnd = () => { setDragState(null); setDragOverSlot(null) }

  // ── Tile editor ────────────────────────────────────────────────────────────
  const openTileEdit = (task: BingoTask) => {
    setEditingTile(task)
    setTileTitle(task.title)
    setTileColor(task.color)
    setTileHex(task.hex_code)
    setTileCategory(task.category || '')
    setTilePoints(task.points ?? 0)
    setTileSectionId(task.section_id)
    setTileTaskType(task.task_type ?? 'standard')
    setTileAnswerQuestion(task.answer_question ?? '')
    setTileAnswerText(task.answer_text ?? '')
  }

  const saveTile = async () => {
    if (!editingTile || !tileTitle.trim() || !tileColor.trim()) return
    setTileSaving(true)
    try {
      const updates: Partial<BingoTask> = {
        title: tileTitle.trim(), color: tileColor.trim(), hex_code: tileHex,
        category: tileCategory.trim(), points: tilePoints,
        task_type: tileTaskType,
        answer_question: tileTaskType === 'answer' ? tileAnswerQuestion.trim() || null : null,
        answer_text: tileTaskType === 'answer'
          ? tileAnswerText.split('\n').map(l => l.trim()).filter(Boolean).join('\n') || null
          : null,
      }
      // Moving a tile to another section: drop it off the grid in the source
      // section so we don't leave a dangling slot reference behind.
      if (tileSectionId !== editingTile.section_id) {
        updates.section_id = tileSectionId
        updates.in_grid = false
        updates.sort_order = 100
      }
      await supabase.from('bingo_tasks').update(updates).eq('id', editingTile.id)
      setTasks(prev => prev.map(t => t.id === editingTile.id ? { ...t, ...updates } : t))
      setEditingTile(null)
    } catch (err) {
      alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally { setTileSaving(false) }
  }

  // Clone a task (pages + photos) into the current section as a new off-grid card.
  // Used when placing a card that is already on the grid, or adding a cross-section card.
  const cloneTask = async (task: BingoTask): Promise<BingoTask | null> => {
    const [{ data: pages }, { data: photos }] = await Promise.all([
      supabase.from('bingo_task_pages').select('*').eq('task_id', task.id).order('page_order'),
      supabase.from('bingo_task_photos').select('*').eq('task_id', task.id).order('photo_order'),
    ])
    const { data: created, error } = await supabase.from('bingo_tasks').insert({
      section_id: currentSectionId,
      title: task.title, color: task.color, hex_code: task.hex_code,
      category: task.category, points: task.points,
      in_grid: false,
      sort_order: Math.max(25, scopedTasks.length + 25),
    }).select().single()
    if (error || !created) { alert('Failed to add card'); return null }
    if (pages && pages.length > 0) {
      const copies = pages.map(p => {
        const { id, task_id, created_at, ...rest } = p
        void id; void task_id; void created_at
        return { ...rest, task_id: created.id }
      })
      await supabase.from('bingo_task_pages').insert(copies)
    }
    if (photos && photos.length > 0) {
      const copies = photos.map(p => {
        const { id, task_id, created_at, ...rest } = p
        void id; void task_id; void created_at
        return { ...rest, task_id: created.id }
      })
      await supabase.from('bingo_task_photos').insert(copies)
    }
    setTasks(prev => [...prev, created])
    return created
  }

  // Add a card from any section onto the current section's grid.
  // Same-section + off-grid: place directly. Otherwise (cross-section OR already
  // in-grid): clone the task row first so the original is untouched.
  const addCardFromLibrary = async (task: BingoTask) => {
    if (!currentSectionId || gridTasks.length >= 25) return
    const firstEmpty = gridSlots.findIndex(s => s === null)
    if (firstEmpty === -1) return
    if (task.section_id === currentSectionId && !task.in_grid) {
      await insertIntoGrid(task.id, firstEmpty)
      return
    }
    const created = await cloneTask(task)
    if (created) await insertIntoGrid(created.id, firstEmpty)
  }

  const duplicateTask = async (task: BingoTask) => {
    const { data: taskPages } = await supabase
      .from('bingo_task_pages').select('*').eq('task_id', task.id).order('page_order')
    const { data: created, error } = await supabase.from('bingo_tasks').insert({
      section_id: task.section_id,
      title: `${task.title} (copy)`,
      color: task.color, hex_code: task.hex_code, category: task.category,
      points: task.points,
      in_grid: false,
      sort_order: Math.max(25, tasks.filter(t => t.section_id === task.section_id).length + 25),
    }).select().single()
    if (error || !created) { alert('Failed to duplicate'); return }
    if (taskPages && taskPages.length > 0) {
      const copies = taskPages.map(p => {
        const { id, task_id, created_at, ...rest } = p
        void id; void task_id; void created_at
        return { ...rest, task_id: created.id }
      })
      await supabase.from('bingo_task_pages').insert(copies)
    }
    setTasks(prev => [...prev, created])
  }

  const saveCategoryInline = async (taskId: string, categoryName: string) => {
    setEditingCategoryId(null)
    let finalName = categoryName
    if (categoryName === '__new__') {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const created = await promptAndCreateCategory(task.section_id)
      if (!created) return
      finalName = created
    }
    await supabase.from('bingo_tasks').update({ category: finalName }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, category: finalName } : t))
  }

  const matchesBulkCategory = (t: BingoTask, categoryKey: string) => {
    if (t.section_id !== currentSectionId) return false
    return categoryKey === '__none__' ? !t.category : t.category === categoryKey
  }

  const setBulkCategoryPoints = async (categoryKey: string, points: number) => {
    const affected = tasks.filter(t => matchesBulkCategory(t, categoryKey))
    await Promise.all(affected.map(t => supabase.from('bingo_tasks').update({ points }).eq('id', t.id)))
    setTasks(prev => prev.map(t => matchesBulkCategory(t, categoryKey) ? { ...t, points } : t))
  }

  const setBulkCategoryColor = async (categoryKey: string, hex: string) => {
    const affected = tasks.filter(t => matchesBulkCategory(t, categoryKey))
    setTasks(prev => prev.map(t => matchesBulkCategory(t, categoryKey) ? { ...t, hex_code: hex } : t))
    await Promise.all(affected.map(t => supabase.from('bingo_tasks').update({ hex_code: hex }).eq('id', t.id)))
  }

  // ── Challenge actions ──────────────────────────────────────────────────────
  const createTask = async () => {
    if (!formTitle.trim() || !formColor.trim() || !currentSectionId) return
    setFormSaving(true)
    try {
      // sort_order is kept high so new off-grid tasks don't collide with slot indices (0-24).
      const nextOrder = Math.max(25, scopedTasks.length + 25)
      await supabase.from('bingo_tasks').insert({
        section_id: currentSectionId,
        title: formTitle.trim(), color: formColor.trim(), hex_code: formHex,
        category: formCategory.trim(), sort_order: nextOrder, points: formPoints,
        task_type: formTaskType,
        answer_question: formTaskType === 'answer' ? formAnswerQuestion.trim() || null : null,
        answer_text: formTaskType === 'answer'
          ? formAnswerText.split('\n').map(l => l.trim()).filter(Boolean).join('\n') || null
          : null,
      })
      setFormTitle(''); setFormColor(''); setFormHex('#3B82F6'); setFormCategory(''); setFormPoints(0)
      setFormTaskType('standard'); setFormAnswerQuestion(''); setFormAnswerText('')
      setShowForm(false)
      await fetchAll()
    } catch (err) {
      alert('Failed to create: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally { setFormSaving(false) }
  }

  const deleteTask = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? All scans for this challenge will also be removed.`)) return
    await supabase.from('bingo_tasks').delete().eq('id', id)
    await fetchAll()
  }

  const deleteTeam = async (id: string, name: string) => {
    if (!confirm(`Delete team "${name}" and all their scan records?`)) return
    await supabase.from('bingo_teams').delete().eq('id', id)
    await fetchAll()
  }

  const removeMember = async (memberId: string, memberName: string, teamName: string) => {
    if (!confirm(`Remove "${memberName}" from ${teamName}?`)) return
    setMembers(prev => prev.filter(m => m.id !== memberId))
    const { error } = await supabase.from('bingo_members').delete().eq('id', memberId)
    if (error) { alert('Failed to remove member'); await fetchAll() }
  }

  const moveMember = async (memberId: string, newTeamId: string) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, team_id: newTeamId } : m))
    await supabase.from('bingo_members').update({ team_id: newTeamId }).eq('id', memberId)
  }

  const approvePhotoSubmission = async (sub: BingoPhotoSubmission) => {
    setPhotoSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s))
    await supabase.from('bingo_photo_submissions').update({ status: 'approved' }).eq('id', sub.id)
    if (sub.scan_id) {
      await supabase.from('bingo_scans').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', sub.scan_id)
      setScans(prev => prev.map(s => s.id === sub.scan_id ? { ...s, completed: true } : s))
    }
  }

  const rejectPhotoSubmission = async (subId: string) => {
    setPhotoSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
    await supabase.from('bingo_photo_submissions').update({ status: 'rejected' }).eq('id', subId)
  }

  const updateTeam = async (id: string, updates: Partial<BingoTeam>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await supabase.from('bingo_teams').update(updates).eq('id', id)
  }

  const uploadTeamPhoto = async (teamId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert(`${file.name} too large (max 5 MB).`); return }
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return }
    setUploadingTeamPhoto(teamId)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${teamId}-${Date.now()}.${ext}`
      const path = `bingo-media/team-photos/${fileName}`
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
      if (error) { alert(`Upload failed: ${error.message}`); return }
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      await updateTeam(teamId, { photo_url: urlData.publicUrl })
    } finally {
      setUploadingTeamPhoto(null)
    }
  }

  const removeTeamPhoto = async (teamId: string) => {
    if (!confirm('Remove this group\u2019s photo?')) return
    await updateTeam(teamId, { photo_url: null })
  }

  const moveTeamToSection = async (id: string, newSectionId: string) => {
    const team = teams.find(t => t.id === id)
    if (!team || team.section_id === newSectionId) return
    const newName = sections.find(s => s.id === newSectionId)?.name ?? 'the new section'
    // Team scans reference tasks in the old section, so progress will read as 0
    // in the new section until they scan those tasks. Make that explicit.
    if (!confirm(`Move "${team.name}" to ${newName}? Their existing scan progress will no longer apply.`)) return
    await updateTeam(id, { section_id: newSectionId })
  }

  const createGroup = async (sectionId: string) => {
    const name = newGroupName.trim()
    const pwd = newGroupPassword.replace(/\D/g, '').slice(0, 4)
    if (!name) return
    if (!/^\d{4}$/.test(pwd)) { alert('Password must be exactly 4 digits.'); return }
    if (teams.some(t => t.section_id === sectionId && t.name.toLowerCase() === name.toLowerCase())) {
      alert(`Group "${name}" already exists in this compartment.`)
      return
    }
    const { data, error } = await supabase
      .from('bingo_teams')
      .insert({ name, password: pwd, section_id: sectionId })
      .select()
      .single()
    if (error || !data) { alert('Failed to create group'); return }
    setTeams(prev => [...prev, data])
    setNewGroupName('')
    setNewGroupPassword('')
  }

  const bulkCreateGroups = async (sectionId: string, count: number) => {
    const existing = teams.filter(t => t.section_id === sectionId)
    const rows = Array.from({ length: count }, (_, i) => {
      const num = existing.length + i + 1
      const name = `Group ${num}`
      const password = String(1000 + Math.floor(Math.random() * 9000)).padStart(4, '0')
      return { name, password, section_id: sectionId }
    }).filter(r => !teams.some(t => t.section_id === sectionId && t.name.toLowerCase() === r.name.toLowerCase()))
    if (rows.length === 0) { alert('All group names already exist.'); return }
    const { data, error } = await supabase.from('bingo_teams').insert(rows).select()
    if (error || !data) { alert('Failed to bulk create groups'); return }
    setTeams(prev => [...prev, ...data])
  }

  const copyLink = (taskId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/bingo-dash/task/${taskId}`)
    setCopiedId(taskId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImportPreview = () => {
    setImportError(''); setImportPreview(null)
    try {
      const rows = parseImport(importText)
      if (rows.length === 0) throw new Error('No items found')
      setImportPreview(rows)
    } catch (err) { setImportError(err instanceof Error ? err.message : 'Invalid JSON') }
  }

  const handleImportConfirm = async () => {
    if (!importPreview) return
    setImporting(true)
    try {
      if (!currentSectionId) throw new Error('No section selected')
      const startOrder = Math.max(25, scopedTasks.length + 25)
      for (let i = 0; i < importPreview.length; i++) {
        const row = importPreview[i]
        const { data: task, error: taskErr } = await supabase
          .from('bingo_tasks')
          .insert({ section_id: currentSectionId, title: row.title, color: row.color, hex_code: row.hex_code, category: '', sort_order: startOrder + i * 10 })
          .select().single()
        if (taskErr) throw taskErr
        if (row.clues.length > 0) {
          await supabase.from('bingo_task_pages').insert({
            task_id: task.id, page_order: 0, media_url: null, media_type: null,
            pointer_1: row.clues[0] ?? null, pointer_2: row.clues[1] ?? null,
            pointer_3: row.clues[2] ?? null, pointer_4: row.clues[3] ?? null,
            pointer_5: row.clues[4] ?? null, pointer_6: row.clues[5] ?? null,
            example_1: null, example_2: null, example_3: null, example_4: null, example_5: null, example_6: null,
            icon_1: null, icon_2: null, icon_3: null, icon_4: null, icon_5: null, icon_6: null,
          })
        }
      }
      setShowImport(false); setImportText(''); setImportPreview(null)
      await fetchAll()
    } catch (err) { setImportError(err instanceof Error ? err.message : 'Import failed') }
    finally { setImporting(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950" onDragEnd={onDragEnd}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10" style={{ background: 'linear-gradient(135deg, #1a1130 0%, #0f0c1a 60%, #111827 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-300 transition-colors">←</button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Bingo Dash <span className="text-violet-400">Admin</span></h1>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold hidden sm:block">Control Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 mr-1">
              <span className="text-xs font-black text-violet-400">{scopedTasks.length}</span>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">challenges</span>
              <span className="w-px h-3 bg-white/10" />
              <span className="text-xs font-black text-emerald-400">{scopedTeams.length}</span>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">teams</span>
            </div>
            <button
              onClick={() => { setShowJoinLink(true); setJoinLinkCopied(false); setJoinLinkTab('player') }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-400 border border-emerald-800 hover:bg-emerald-950/60 transition-colors"
            >
              Join Link / QR
            </button>
            <a href="/bingo-dash" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-violet-400 border border-violet-800 hover:bg-violet-950/60 transition-colors">
              Player View ↗
            </a>
            <a href="/bingo-dash/projector" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-amber-400 border border-amber-800 hover:bg-amber-950/60 transition-colors">
              Scoreboard ↗
            </a>
            <a href="/bingo-dash/colmar-intro" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-rose-400 border border-rose-800 hover:bg-rose-950/60 transition-colors">
              Intro Slide ↗
            </a>
            <button
              onClick={() => setActiveTab('teams')}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 border border-gray-700 hover:bg-white/5 transition-colors"
            >
              View Teams
            </button>
            <button
              onClick={() => { setShowImport(true); setImportText(''); setImportPreview(null); setImportError('') }}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 text-sm font-bold transition-colors shadow-lg shadow-violet-900/40"
            >
              Import
            </button>
          </div>
        </div>

        {/* ── Board tab bar ─────────────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto border-t border-white/5">
          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mr-2 flex-shrink-0">Boards</span>
          {sections.map(s => {
            const isActive = currentSectionId === s.id
            const isLive = settings?.active_section_id === s.id || s.game_started
            return (
              <button
                key={s.id}
                onClick={() => setCurrentSectionId(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {s.name}
                {isLive && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-300' : 'bg-green-500'}`} />
                )}
              </button>
            )
          })}
          {showInlineBoardCreate ? (
            <input
              autoFocus
              value={inlineBoardName}
              onChange={e => setInlineBoardName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { createSection(inlineBoardName); setShowInlineBoardCreate(false) }
                if (e.key === 'Escape') { setShowInlineBoardCreate(false); setInlineBoardName('') }
              }}
              onBlur={() => { if (!inlineBoardName.trim()) setShowInlineBoardCreate(false) }}
              placeholder="Board name…"
              className="px-2.5 py-1.5 text-sm border border-violet-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 w-40 flex-shrink-0 bg-gray-900 text-white placeholder-gray-600"
            />
          ) : (
            <button
              onClick={() => setShowInlineBoardCreate(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors flex-shrink-0 border border-dashed border-white/10"
            >
              + New Board
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {currentSectionId && settings?.active_section_id === currentSectionId ? (
              <span className="text-xs font-bold text-green-400 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-950/50 border border-green-800 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" /> Live
              </span>
            ) : (
              <button
                onClick={() => currentSectionId && setActiveSection(currentSectionId)}
                disabled={!currentSectionId}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-green-400 border border-green-800 hover:bg-green-950/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Make this board the one players see at /bingo-dash"
              >
                Set live
              </button>
            )}
            <button
              onClick={() => setShowSectionManager(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
              title="Rename or delete boards"
            >
              Manage
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-10">

        {/* ── Tab navigation ───────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b border-white/10 -mt-4">
          {([
            { key: 'board', label: 'Board' },
            { key: 'library', label: 'Card Library' },
            { key: 'teams', label: `Teams${teams.length > 0 ? ` (${teams.length})` : ''}` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-gray-600 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'board' && <>

        {/* ── Game Access (per-section) ─────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-2">Game Access</h2>
          <p className="text-xs text-gray-500 mb-3">
            Control which games are live. Each section is independent — you can run multiple games simultaneously.
          </p>
          {(() => {
            const currentSection = sections.find(s => s.id === currentSectionId)
            const isStarted = currentSection?.game_started ?? false
            return (
              <div className={`flex items-center justify-between gap-4 rounded-2xl px-6 py-5 ${isStarted ? 'bg-green-950/40 border border-green-800' : 'bg-gray-800/60 border border-white/10'}`}>
                <div>
                  <p className={`text-lg font-black ${isStarted ? 'text-green-400' : 'text-gray-300'}`}>
                    {isStarted ? '● Game is LIVE' : '■ Game is Locked'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isStarted
                      ? `Participants in "${currentSection?.name}" can access the board and complete challenges.`
                      : `Participants in "${currentSection?.name}" see a waiting screen.`}
                  </p>
                </div>
                <button
                  onClick={() => currentSectionId && toggleSectionGameStarted(currentSectionId, !isStarted)}
                  disabled={!currentSectionId}
                  className={`px-6 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex-shrink-0 ${
                    isStarted
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {isStarted ? 'Lock Game' : 'Start Game'}
                </button>
              </div>
            )
          })()}
        </section>

        {/* ── Timer ────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Timer</h2>
          <div className="bg-gray-900 rounded-2xl p-6">
            <div className="text-center mb-5">
              <div
                className="font-mono font-black tracking-wider tabular-nums leading-none"
                style={{
                  fontSize: 'clamp(3.5rem, 10vw, 6rem)',
                  color: isTimerRunning
                    ? (settings?.timer_end_at && (new Date(settings.timer_end_at).getTime() - Date.now()) < 120_000 ? '#f87171' : '#4ade80')
                    : '#ffffff',
                }}
              >
                {timerDisplay}
              </div>
              <div className={`text-sm font-bold mt-2 tracking-wider uppercase ${isTimerRunning ? 'text-green-400' : 'text-gray-500'}`}>
                {isTimerRunning ? '● Running' : (settings?.timer_seconds ?? 0) > 0 ? '■ Paused / Stopped' : '■ Not set'}
              </div>
            </div>

            <div className="flex gap-2 justify-center mb-5">
              {!isTimerRunning ? (
                <button onClick={startTimer} disabled={!settings?.timer_seconds || timerSaving}
                  className="px-7 py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-400 disabled:opacity-40 transition-colors">
                  ▶ Start
                </button>
              ) : (
                <button onClick={pauseTimer} disabled={timerSaving}
                  className="px-7 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-400 transition-colors">
                  ❚❚ Pause
                </button>
              )}
              <button onClick={resetTimer} disabled={timerSaving}
                className="px-7 py-2.5 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">
                ↺ Reset
              </button>
            </div>

            <div className="flex items-center gap-2 justify-center flex-wrap">
              {([-10, -5, -1] as const).map(d => (
                <button key={d} onClick={() => adjustTimer(d)} disabled={timerSaving}
                  className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-bold hover:bg-white/20 transition-colors disabled:opacity-40 tabular-nums">
                  {d}m
                </button>
              ))}
              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1.5 mx-1">
                <input
                  type="number"
                  value={timerMinutesInput}
                  onChange={e => setTimerMinutesInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setTimerFromInput()}
                  placeholder="min"
                  className="w-14 bg-transparent text-white text-sm font-bold text-center focus:outline-none placeholder-white/30 tabular-nums"
                  min={0}
                />
                <button onClick={setTimerFromInput} disabled={!timerMinutesInput.trim() || timerSaving}
                  className="text-white/60 hover:text-white text-xs font-bold transition-colors disabled:opacity-30 pl-1 border-l border-white/20">
                  Set
                </button>
              </div>
              {([1, 5, 10] as const).map(d => (
                <button key={d} onClick={() => adjustTimer(d)} disabled={timerSaving}
                  className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-bold hover:bg-white/20 transition-colors disabled:opacity-40 tabular-nums">
                  +{d}m
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Marshal Password ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-2">Marshal Password</h2>
          <p className="text-xs text-gray-500 mb-3">Participants must enter this password to complete challenges that have "Require Marshal" enabled.</p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={settings?.marshal_password ?? ''}
              onChange={e => setSettings(prev => prev ? { ...prev, marshal_password: e.target.value } : prev)}
              placeholder="Marshal password..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/15 bg-gray-900 text-white placeholder-gray-600 text-sm font-mono font-bold focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={() => {
                if (!settings) return
                updateSettings({ marshal_password: settings.marshal_password })
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-violet-500 hover:bg-violet-600 transition-colors"
            >
              Save
            </button>
          </div>
        </section>

        {/* ── Board Editor ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                Board Editor
                <span className="ml-2 text-sm font-normal text-gray-500">({gridTasks.length}/25)</span>
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Drag tiles to reorder · Drag from list to place · Hover to move ◀▶ or remove ✕
              </p>
            </div>
            <a href="/bingo-dash" target="_blank" rel="noopener noreferrer"
              className="text-xs text-violet-500 hover:text-violet-700 transition-colors">
              Preview ↗
            </a>
          </div>

          <div className="flex gap-6 flex-col lg:flex-row items-start">
            {/* Interactive 5×5 grid */}
            <div className="flex-shrink-0">
              <div className="bg-gray-900 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Grid — drag to reorder
                </p>
                <div
                  className="grid grid-cols-5 gap-1.5"
                  style={{ width: 'min(380px, calc(100vw - 80px))' }}
                >
                  {Array.from({ length: 25 }, (_, slotIndex) => {
                    const task = gridSlots[slotIndex]
                    const isDragOver = dragOverSlot === slotIndex

                    return task ? (
                      <BoardTile
                        key={task.id}
                        task={task}
                        index={slotIndex}
                        total={gridTasks.length}
                        isDragOver={isDragOver}
                        isBeingDragged={dragState?.id === task.id && dragState.type === 'grid'}
                        onMoveLeft={() => reorderGrid(slotIndex, slotIndex - 1)}
                        onMoveRight={() => reorderGrid(slotIndex, slotIndex + 1)}
                        onRemove={() => removeTile(task.id)}
                        onEdit={() => openTileEdit(task)}
                        onDragStart={e => onGridDragStart(e, task.id)}
                        onDragOver={e => onSlotDragOver(e, slotIndex)}
                        onDrop={e => onSlotDrop(e, slotIndex)}
                        onDragEnd={onDragEnd}
                        onDragLeave={() => setDragOverSlot(null)}
                      />
                    ) : (
                      <div
                        key={`empty-${slotIndex}`}
                        onDragOver={e => onSlotDragOver(e, slotIndex)}
                        onDrop={e => onSlotDrop(e, slotIndex)}
                        onDragLeave={() => setDragOverSlot(null)}
                        onClick={() => {
                          if (!dragState && scopedTasks.length > 0 && gridTasks.length < 25) {
                            setSlotPickerIndex(slotIndex)
                            setSlotPickerFilter('all')
                          }
                        }}
                        className={`aspect-square rounded-lg border-2 border-dashed transition-all duration-150 flex items-center justify-center ${
                          isDragOver && dragState
                            ? 'border-violet-400 bg-violet-400/20 scale-105'
                            : scopedTasks.length > 0 && gridTasks.length < 25
                              ? 'bg-white/5 border-white/20 hover:border-violet-400 hover:bg-violet-400/10 cursor-pointer'
                              : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {scopedTasks.length > 0 && gridTasks.length < 25 && !dragState && (
                          <span className="text-white/20 text-lg font-black leading-none select-none">+</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Card library — pick any card from any section, filter & search */}
            <div className="flex-1 min-w-0 w-full lg:w-auto">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Add to Grid
                {gridTasks.length >= 25 && <span className="ml-2 text-red-400 normal-case font-normal">Grid full</span>}
              </p>
              {/* Section + search row */}
              <div className="flex gap-2 mb-2">
                <select
                  value={addListSectionFilter}
                  onChange={e => setAddListSectionFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs font-medium bg-gray-900 text-white flex-shrink-0"
                  title="Filter by section"
                >
                  <option value="current">This section</option>
                  <option value="all">All sections</option>
                  {sections.filter(s => s.id !== currentSectionId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input
                  type="search"
                  value={addListSearch}
                  onChange={e => setAddListSearch(e.target.value)}
                  placeholder="Search cards by title, category, color…"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-white/15 bg-gray-900 text-white placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-0"
                />
              </div>
              {/* Category chips */}
              {addListCategories.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  <button
                    onClick={() => setOffGridCategoryFilter('all')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${offGridCategoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white'}`}
                  >
                    All
                  </button>
                  {addListCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setOffGridCategoryFilter(cat)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${offGridCategoryFilter === cat ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {addListTasks.length === 0 ? (
                <div className="bg-gray-900 rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-gray-500">
                  No cards match these filters.
                </div>
              ) : (
                <div className="bg-gray-900 rounded-xl border border-white/10 divide-y divide-white/5 max-h-96 overflow-y-auto">
                  {addListTasks.map(task => {
                    const isSameSection = task.section_id === currentSectionId
                    const sectionName = sections.find(s => s.id === task.section_id)?.name ?? ''
                    return (
                      <div
                        key={task.id}
                        draggable={isSameSection}
                        onDragStart={isSameSection ? (e => onListDragStart(e, task.id)) : undefined}
                        onDragEnd={isSameSection ? onDragEnd : undefined}
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors select-none ${
                          isSameSection ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${dragState?.id === task.id ? 'opacity-40' : ''}`}
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.hex_code }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                            {task.category && <span>{task.category}</span>}
                            {!isSameSection && (
                              <span className="text-[10px] font-bold bg-amber-900/40 text-amber-400 border border-amber-800 rounded px-1.5 py-0.5">
                                {sectionName} · copy
                              </span>
                            )}
                            {isSameSection && task.in_grid && (
                              <span className="text-[10px] font-bold bg-white/10 text-gray-400 rounded px-1.5 py-0.5">on grid</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => addCardFromLibrary(task)}
                          disabled={gridTasks.length >= 25 || (isSameSection && task.in_grid)}
                          className="px-3 py-1 bg-violet-900/50 text-violet-400 border border-violet-700 rounded-lg text-xs font-bold hover:bg-violet-800/50 disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        </> /* end board tab */}

        {/* ── Library tab: Compartment > Category > Cards ───────────────────── */}
        {activeTab === 'library' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Card Library</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors">
              + Add Challenge
            </button>
          </div>

          {/* Compartment filter chips */}
          <div className="flex gap-2 flex-wrap mb-5">
            <button
              onClick={() => setLibraryCompartmentFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${libraryCompartmentFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              All Compartments ({tasks.length})
            </button>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setLibraryCompartmentFilter(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${libraryCompartmentFilter === s.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {s.name} ({tasks.filter(t => t.section_id === s.id).length})
                {settings?.active_section_id === s.id && <span className="ml-1 text-green-400">●</span>}
              </button>
            ))}
          </div>

          {/* New challenge form (scoped to current section) */}
          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-1">New Challenge</h3>
              {currentSectionId && (
                <p className="text-xs text-gray-400 mb-4">
                  Adding to: <span className="font-bold text-gray-600">{sections.find(s => s.id === currentSectionId)?.name}</span>
                  {' '}— change compartment via the section switcher in the header
                </p>
              )}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Water Challenge"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" autoFocus />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={formCategory} onChange={async e => {
                      if (e.target.value === '__new__') {
                        if (!currentSectionId) return
                        const name = await promptAndCreateCategory(currentSectionId)
                        if (name) setFormCategory(name)
                        return
                      }
                      setFormCategory(e.target.value)
                    }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      <option value="">— Uncategorized —</option>
                      {categories.filter(c => c.section_id === currentSectionId).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="__new__">+ New category…</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input type="number" value={formPoints} min={0}
                      onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold" />
                  </div>
                </div>
                <ColorPicker hex={formHex} colorName={formColor} onHexChange={setFormHex} onNameChange={setFormColor} />
                {/* Type toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Card Type</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300">
                    <button type="button" onClick={() => setFormTaskType('standard')}
                      className={`flex-1 py-2 text-sm font-bold transition-colors ${formTaskType === 'standard' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      Standard
                    </button>
                    <button type="button" onClick={() => setFormTaskType('answer')}
                      className={`flex-1 py-2 text-sm font-bold transition-colors ${formTaskType === 'answer' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      Answer Input
                    </button>
                  </div>
                </div>
                {formTaskType === 'answer' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question / Prompt</label>
                      <input type="text" value={formAnswerQuestion} onChange={e => setFormAnswerQuestion(e.target.value)}
                        placeholder="e.g. What is the name of this landmark?"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Answer Template</label>
                      <p className="text-xs text-gray-400 mb-1">One answer per line. Each line becomes a row of letter boxes.</p>
                      <textarea value={formAnswerText} onChange={e => setFormAnswerText(e.target.value)}
                        placeholder={"e.g.\nPETRONAS\nTWIN TOWERS"}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm resize-none" />
                    </div>
                  </>
                )}
                <div className="flex gap-3">
                  <button onClick={createTask} disabled={formSaving || !formTitle.trim() || !formColor.trim()}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm transition-colors">
                    {formSaving ? 'Creating...' : 'Create Challenge'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compartment > Category > Cards hierarchy */}
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
              No challenges yet. Click "Add Challenge" to create one.
            </p>
          ) : (
            <div className="flex flex-col gap-10">
              {groupedLibrary.map(({ section, categories: categoryGroups, totalTasks }) => (
                <div key={section.id}>
                  {/* Compartment header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-white uppercase tracking-wider">{section.name}</h2>
                      {settings?.active_section_id === section.id && (
                        <span className="text-[10px] font-black text-green-400 bg-green-950/60 border border-green-800 px-1.5 py-0.5 rounded uppercase">Live</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{totalTasks} cards</span>
                    <div className="flex-1 h-px bg-white/10" />
                    <button
                      onClick={() => setShowCategoryManager(showCategoryManager === section.id ? null : section.id)}
                      className={`text-xs font-bold transition-colors flex-shrink-0 px-2 py-0.5 rounded ${
                        showCategoryManager === section.id
                          ? 'bg-violet-900/50 text-violet-400'
                          : 'text-gray-500 hover:text-violet-400'
                      }`}
                    >
                      Categories ({categories.filter(c => c.section_id === section.id).length})
                    </button>
                    <button
                      onClick={() => { setCurrentSectionId(section.id); setActiveTab('board') }}
                      className="text-xs text-violet-600 hover:text-violet-800 font-bold transition-colors flex-shrink-0"
                    >
                      Open Board →
                    </button>
                  </div>

                  {/* Category manager panel */}
                  {showCategoryManager === section.id && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Manage Categories</p>
                      <div className="flex flex-col gap-1.5 mb-3">
                        {categories.filter(c => c.section_id === section.id).length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No categories yet — add one below.</p>
                        ) : (
                          categories.filter(c => c.section_id === section.id).map(cat => {
                            const cardCount = tasks.filter(t => t.section_id === section.id && t.category === cat.name).length
                            return (
                              <div key={cat.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                <input
                                  type="text"
                                  defaultValue={cat.name}
                                  key={`${cat.id}-${cat.name}`}
                                  onBlur={e => renameCategory(cat.id, section.id, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                  className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-violet-400 rounded px-1"
                                />
                                <span className="text-xs text-gray-400 flex-shrink-0">{cardCount} card{cardCount !== 1 ? 's' : ''}</span>
                                <button
                                  onClick={() => deleteCategory(cat.id, section.id)}
                                  className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0 px-1"
                                >
                                  Delete
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') createCategory(section.id) }}
                          placeholder="New category name…"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <button
                          onClick={() => createCategory(section.id)}
                          disabled={!newCategoryName.trim()}
                          className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Categories within this compartment */}
                  <div className="flex flex-col gap-8">
                    {categoryGroups.length === 0 ? (
                      <p className="text-gray-300 text-sm pl-4">No cards in this compartment.</p>
                    ) : (
                      categoryGroups.map(group => (
                        <div key={group.key}>
                          {/* Category subheader */}
                          <div className="flex items-center gap-3 mb-3 pl-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{group.label}</h3>
                            <span className="text-xs text-gray-300 font-medium">{group.tasks.length}</span>
                            <div className="flex-1 h-px bg-gray-100" />
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-gray-400">color for all:</span>
                              <input type="color" defaultValue={group.tasks[0]?.hex_code ?? '#3B82F6'}
                                key={section.id + group.key + '-color'}
                                className="w-7 h-7 rounded cursor-pointer border border-gray-200"
                                onChange={e => setBulkCategoryColor(group.key, e.target.value)}
                                title={`Set color for all ${group.label} tasks`} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-gray-400">pts for all:</span>
                              <input type="number" min={0} defaultValue={group.tasks[0]?.points ?? 0}
                                key={section.id + group.key + '-pts'}
                                className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-violet-400"
                                onBlur={e => setBulkCategoryPoints(group.key, Math.max(0, parseInt(e.target.value) || 0))}
                                onKeyDown={e => { if (e.key === 'Enter') setBulkCategoryPoints(group.key, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0)) }}
                                title={`Set points for all ${group.label} tasks`} />
                            </div>
                          </div>

                          {/* Cards grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-4">
                            {group.tasks.map(task => (
                              <div key={task.id} className="rounded-2xl overflow-hidden flex flex-col shadow-sm"
                                style={{ backgroundColor: task.hex_code }}>
                                <div className="px-4 pt-4 pb-3 flex-1">
                                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{task.color}</p>
                                  <h3 className="text-white font-black text-lg leading-tight">{task.title}</h3>
                                  {editingCategoryId === task.id ? (
                                    <select
                                      autoFocus
                                      defaultValue={task.category || ''}
                                      onChange={e => saveCategoryInline(task.id, e.target.value)}
                                      onBlur={() => setEditingCategoryId(null)}
                                      className="w-full bg-black/20 text-white text-xs px-2 py-1 rounded border border-white/30 focus:outline-none focus:border-white/60 mt-2"
                                    >
                                      <option value="">— Uncategorized —</option>
                                      {categories.filter(c => c.section_id === task.section_id).map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                      ))}
                                      <option value="__new__">+ New category…</option>
                                    </select>
                                  ) : (
                                    <button
                                      onClick={() => setEditingCategoryId(task.id)}
                                      className="mt-1.5 text-white/50 text-xs hover:text-white/80 transition-colors text-left block">
                                      {task.category ? `📂 ${task.category}` : '+ category'}
                                    </button>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <p className="text-white/50 text-xs">
                                      {scans.filter(s => s.task_id === task.id && s.completed).length} completed ·{' '}
                                      {scans.filter(s => s.task_id === task.id).length} scanned
                                    </p>
                                    {(task.points ?? 0) > 0 && (
                                      <span className="bg-black/30 text-white/80 text-[10px] font-black rounded px-1.5 py-0.5">{task.points} pts</span>
                                    )}
                                  </div>
                                  <p className="text-white/40 text-xs mt-0.5">{task.in_grid ? '✓ In grid' : 'Off grid'}</p>
                                  <button
                                    onClick={async () => {
                                      const newVal = !task.require_marshal
                                      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, require_marshal: newVal } : t))
                                      await supabase.from('bingo_tasks').update({ require_marshal: newVal }).eq('id', task.id)
                                    }}
                                    className={`mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                                      task.require_marshal
                                        ? 'bg-yellow-400/30 text-yellow-200 hover:bg-yellow-400/50'
                                        : 'bg-white/10 text-white/30 hover:bg-white/20'
                                    }`}
                                  >
                                    {task.require_marshal ? '🔒 Marshal ON' : '🔓 Marshal OFF'}
                                  </button>
                                </div>
                                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                                  <button onClick={() => navigate(`/bingo-dash/admin/task/${task.id}`)}
                                    className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">Edit</button>
                                  <button onClick={() => setQrTask(task)}
                                    className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">QR</button>
                                  <button onClick={() => copyLink(task.id)}
                                    className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors">
                                    {copiedId === task.id ? '✓' : '🔗'}
                                  </button>
                                  <button onClick={() => duplicateTask(task)}
                                    className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors"
                                    title="Duplicate this card">⎘ Copy</button>
                                  <button onClick={() => openTileEdit(task)}
                                    className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-colors"
                                    title="Move to another section">Move</button>
                                  <button onClick={() => deleteTask(task.id, task.title)}
                                    className="px-3 py-1.5 bg-red-500/30 rounded-lg text-white text-xs font-bold hover:bg-red-500/50 transition-colors">Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {/* ── Challenges gallery (Board tab, scoped to current section) ──────── */}
        {activeTab === 'board' && <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Challenges</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors">
              + Add Challenge
            </button>
          </div>

          {/* ── Section manager (challenge sections group categories) ── */}
          {(() => {
            const currentCS = challengeSections.filter(cs => cs.game_section_id === currentSectionId)
            const currentCats = categories.filter(c => c.section_id === currentSectionId)
            return (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setShowChallengeSectionManager(v => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      showChallengeSectionManager ? 'bg-violet-900/50 text-violet-300 border border-violet-700' : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    ▤ Sections ({currentCS.length})
                  </button>
                  {currentCS.map(cs => (
                    <span key={cs.id} className="px-2.5 py-1 bg-violet-900/40 border border-violet-700 text-violet-400 rounded-lg text-xs font-bold">
                      {cs.name}
                    </span>
                  ))}
                </div>

                {showChallengeSectionManager && (
                  <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-4">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Manage Sections</p>

                    {/* Existing sections */}
                    <div className="flex flex-col gap-2 mb-3">
                      {currentCS.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No sections yet — create one below to group your categories.</p>
                      ) : (
                        currentCS.map(cs => {
                          const assignedCats = currentCats.filter(c => c.challenge_section_id === cs.id)
                          return (
                            <div key={cs.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 mb-1.5">
                                {renamingCSId === cs.id ? (
                                  <input
                                    autoFocus
                                    value={renamingCSName}
                                    onChange={e => setRenamingCSName(e.target.value)}
                                    onBlur={() => renameChallengeSection(cs.id, renamingCSName)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') renameChallengeSection(cs.id, renamingCSName)
                                      if (e.key === 'Escape') setRenamingCSId(null)
                                    }}
                                    className="flex-1 text-sm font-bold text-gray-800 bg-transparent border-b border-violet-400 focus:outline-none px-1"
                                  />
                                ) : (
                                  <span className="flex-1 text-sm font-bold text-gray-800">{cs.name}</span>
                                )}
                                <button
                                  onClick={() => { setRenamingCSId(cs.id); setRenamingCSName(cs.name) }}
                                  className="text-xs text-gray-400 hover:text-violet-600 transition-colors px-1"
                                >Rename</button>
                                <button
                                  onClick={() => deleteChallengeSection(cs.id)}
                                  className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                                >Delete</button>
                              </div>
                              {/* Category assignment */}
                              <div className="flex flex-wrap gap-1.5">
                                {currentCats.length === 0 ? (
                                  <span className="text-xs text-gray-300 italic">No categories yet</span>
                                ) : (
                                  currentCats.map(cat => {
                                    const isAssigned = cat.challenge_section_id === cs.id
                                    return (
                                      <button
                                        key={cat.id}
                                        onClick={() => assignCategoryToSection(cat.id, isAssigned ? null : cs.id)}
                                        className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                                          isAssigned
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-gray-100 text-gray-500 hover:bg-violet-100 hover:text-violet-700'
                                        }`}
                                      >
                                        {cat.name}
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                              {assignedCats.length > 0 && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {assignedCats.length} categor{assignedCats.length !== 1 ? 'ies' : 'y'} assigned
                                </p>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Create new section */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newChallengeSectionName}
                        onChange={e => setNewChallengeSectionName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createChallengeSection() }}
                        placeholder="New section name…"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={createChallengeSection}
                        disabled={!newChallengeSectionName.trim()}
                        className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40"
                      >
                        + Add Section
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Category filter chips */}
          {allCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-5">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === 'all' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/60 ring-1 ring-violet-400/40' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                All ({scopedTasks.length})
              </button>
              {allCategories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/60 ring-1 ring-violet-400/40' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                  {cat} ({scopedTasks.filter(t => t.category === cat).length})
                </button>
              ))}
              {scopedTasks.some(t => !t.category) && (
                <button onClick={() => setCategoryFilter('__none__')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${categoryFilter === '__none__' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/60 ring-1 ring-violet-400/40' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                  Uncategorized ({scopedTasks.filter(t => !t.category).length})
                </button>
              )}
            </div>
          )}

          {/* New challenge form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-4">New Challenge</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Water Challenge"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" autoFocus />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={formCategory} onChange={async e => {
                      if (e.target.value === '__new__') {
                        if (!currentSectionId) return
                        const name = await promptAndCreateCategory(currentSectionId)
                        if (name) setFormCategory(name)
                        return
                      }
                      setFormCategory(e.target.value)
                    }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      <option value="">— Uncategorized —</option>
                      {categories.filter(c => c.section_id === currentSectionId).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="__new__">+ New category…</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input type="number" value={formPoints} min={0}
                      onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold" />
                  </div>
                </div>
                <ColorPicker hex={formHex} colorName={formColor} onHexChange={setFormHex} onNameChange={setFormColor} />
                {/* Type toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Card Type</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300">
                    <button type="button" onClick={() => setFormTaskType('standard')}
                      className={`flex-1 py-2 text-sm font-bold transition-colors ${formTaskType === 'standard' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      Standard
                    </button>
                    <button type="button" onClick={() => setFormTaskType('answer')}
                      className={`flex-1 py-2 text-sm font-bold transition-colors ${formTaskType === 'answer' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      Answer Input
                    </button>
                  </div>
                </div>
                {formTaskType === 'answer' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question / Prompt</label>
                      <input type="text" value={formAnswerQuestion} onChange={e => setFormAnswerQuestion(e.target.value)}
                        placeholder="e.g. What is the name of this landmark?"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Answer Template</label>
                      <p className="text-xs text-gray-400 mb-1">One answer per line. Each line becomes a row of letter boxes.</p>
                      <textarea value={formAnswerText} onChange={e => setFormAnswerText(e.target.value)}
                        placeholder={"e.g.\nPETRONAS\nTWIN TOWERS"}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm resize-none" />
                    </div>
                  </>
                )}
                <div className="flex gap-3">
                  <button onClick={createTask} disabled={formSaving || !formTitle.trim() || !formColor.trim()}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm transition-colors">
                    {formSaving ? 'Creating...' : 'Create Challenge'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grouped gallery — Section → Category → Cards */}
          {scopedTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
              No challenges yet. Click "Add Challenge" to create one.
            </p>
          ) : categoryFilter !== 'all' && groupedTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
              No challenges in this category.
            </p>
          ) : categoryFilter !== 'all' ? (
            /* Filtered view: flat category rendering */
            <div className="flex flex-col gap-8">
              {groupedTasks.map(group => (
                <CategoryGroupBlock
                  key={group.key}
                  group={group}
                  editingCategoryId={editingCategoryId}
                  setEditingCategoryId={setEditingCategoryId}
                  categories={categories}
                  scans={scans}
                  copiedId={copiedId}
                  navigate={navigate}
                  saveCategoryInline={saveCategoryInline}
                  setBulkCategoryColor={setBulkCategoryColor}
                  setBulkCategoryPoints={setBulkCategoryPoints}
                  setQrTask={setQrTask}
                  copyLink={copyLink}
                  duplicateTask={duplicateTask}
                  openTileEdit={openTileEdit}
                  deleteTask={deleteTask}
                />
              ))}
            </div>
          ) : (
            /* All: two-level Section → Category rendering */
            <div className="flex flex-col gap-10">
              {groupedByChallengeSections.map(({ cs, groups }) => {
                const hasSections = challengeSections.filter(s => s.game_section_id === currentSectionId).length > 0
                return (
                  <div key={cs?.id ?? '__unassigned__'}>
                    {/* Challenge section header — only shown when sections exist */}
                    {hasSections && (
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-sm font-black text-gray-300 uppercase tracking-wider">
                          {cs?.name ?? 'Uncategorized'}
                        </h2>
                        <span className="text-xs text-gray-500 font-medium">
                          {groups.reduce((n, g) => n + g.tasks.length, 0)} challenges
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    )}
                    {/* Categories within this challenge section */}
                    <div className={`flex flex-col gap-8${hasSections ? ' pl-4' : ''}`}>
                      {groups.length === 0 ? (
                        <p className="text-gray-300 text-sm italic">No challenges assigned to this section yet.</p>
                      ) : (
                        groups.map(group => (
                          <CategoryGroupBlock
                            key={group.key}
                            group={group}
                            editingCategoryId={editingCategoryId}
                            setEditingCategoryId={setEditingCategoryId}
                            categories={categories}
                            scans={scans}
                            copiedId={copiedId}
                            navigate={navigate}
                            saveCategoryInline={saveCategoryInline}
                            setBulkCategoryColor={setBulkCategoryColor}
                            setBulkCategoryPoints={setBulkCategoryPoints}
                            setQrTask={setQrTask}
                            copyLink={copyLink}
                            duplicateTask={duplicateTask}
                            openTileEdit={openTileEdit}
                            deleteTask={deleteTask}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>}

        {/* ── Teams tab ────────────────────────────────────────────────────── */}
        {activeTab === 'teams' && (
        <section>
          {/* ── Photo Submission Queue ─────────────────────────────────────── */}
          {(() => {
            const pending = photoSubmissions.filter(s => s.status === 'pending')
            if (pending.length === 0) return null
            return (
              <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider mb-3">
                  📸 Photo Submissions — {pending.length} Pending
                </h3>
                <div className="flex flex-col gap-3">
                  {pending.map(sub => {
                    const subTeam = teams.find(t => t.id === sub.team_id)
                    const subTask = tasks.find(t => t.id === sub.task_id)
                    return (
                      <div key={sub.id} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-amber-100">
                        <a href={sub.photo_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={sub.photo_url}
                            alt="submission"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0 hover:opacity-90 transition-opacity"
                          />
                        </a>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{subTeam?.name ?? 'Unknown team'}</p>
                          <p className="text-xs text-gray-500 truncate">{subTask?.title ?? 'Unknown task'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(sub.created_at).toLocaleString()}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => approvePhotoSubmission(sub)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => rejectPhotoSubmission(sub.id)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Teams for the current board */}
          {(() => {
            const section = sections.find(s => s.id === currentSectionId)
            if (!section) return null
            const sectionTeams = scopedTeams
            const sectionTasks = scopedTasks
            return (
              <div key={section.id} className="mb-10">
                {/* Board header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-black text-white uppercase tracking-wider">{section.name}</h2>
                  {settings?.active_section_id === section.id && (
                    <span className="text-[10px] font-black text-green-400 bg-green-950/60 border border-green-800 px-1.5 py-0.5 rounded uppercase">Live</span>
                  )}
                  <span className="text-xs text-gray-500 font-medium">{sectionTeams.length} group{sectionTeams.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Create group form */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createGroup(section.id) }}
                    placeholder="Group name..."
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-white/15 bg-gray-900 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newGroupPassword}
                    onChange={e => setNewGroupPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => { if (e.key === 'Enter') createGroup(section.id) }}
                    placeholder="4-digit password"
                    className="w-36 px-3 py-2 rounded-lg border border-white/15 bg-gray-900 text-white placeholder-gray-600 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={() => createGroup(section.id)}
                    disabled={!newGroupName.trim() || newGroupPassword.length !== 4}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors shadow-lg shadow-violet-900/30"
                  >
                    + Create Group
                  </button>
                  <button
                    onClick={() => {
                      const n = parseInt(prompt('How many groups to bulk create?', '16') ?? '', 10)
                      if (Number.isFinite(n) && n > 0) bulkCreateGroups(section.id, n)
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-gray-300 bg-white/10 hover:bg-white/15 transition-colors"
                  >
                    Bulk Create
                  </button>
                </div>
                {sectionTeams.length > 0 && (<div className="bg-gray-900 rounded-xl border border-white/10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Photo</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs min-w-[180px]">Group</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs min-w-[110px]">Password</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Members</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Compartment</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Progress</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Bingos</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs" title="Bonus points from other games — added to total for award ranking">Bonus</th>
                        <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Grid</th>
                        <th className="text-right px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sectionTeams.map(team => {
                        const teamScans = scans.filter(s => s.team_id === team.id)
                        const sectionGridTasks = sectionTasks.filter(t => t.in_grid).sort((a, b) => a.sort_order - b.sort_order)
                        const gridTaskIds = new Set(sectionGridTasks.map(t => t.id))
                        const completedCount = teamScans.filter(s => s.completed && gridTaskIds.has(s.task_id)).length
                        const completedIds = new Set(teamScans.filter(s => s.completed).map(s => s.task_id))
                        const pointsEarned = teamScans
                          .filter(s => s.completed && gridTaskIds.has(s.task_id))
                          .reduce((sum, s) => sum + (sectionGridTasks.find(t => t.id === s.task_id)?.points ?? 0), 0)
                        const pct = sectionGridTasks.length > 0 ? Math.round((completedCount / sectionGridTasks.length) * 100) : 0
                        const teamSlots = buildBingoSlots(sectionGridTasks)
                        const teamBingoLines = completedBingoLines(teamSlots, completedIds).length
                        return (
                          <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="relative group/photo">
                                <label
                                  className={`block w-12 h-12 rounded-full overflow-hidden border-2 ${team.photo_url ? 'border-violet-200' : 'border-dashed border-gray-300'} bg-gray-50 cursor-pointer hover:border-violet-400 transition-colors ${uploadingTeamPhoto === team.id ? 'opacity-60' : ''}`}
                                  title={team.photo_url ? 'Click to replace photo' : 'Click to upload photo'}
                                >
                                  {team.photo_url ? (
                                    <img src={team.photo_url} alt={`${team.name} photo`} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                                      {uploadingTeamPhoto === team.id ? '\u2026' : '+'}
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingTeamPhoto === team.id}
                                    onChange={e => {
                                      const f = e.target.files?.[0]
                                      e.target.value = ''
                                      if (f) uploadTeamPhoto(team.id, f)
                                    }}
                                  />
                                </label>
                                {team.photo_url && uploadingTeamPhoto !== team.id && (
                                  <button
                                    type="button"
                                    onClick={() => removeTeamPhoto(team.id)}
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity shadow"
                                    title="Remove photo"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                defaultValue={team.name}
                                key={`${team.id}-name-${team.name}`}
                                onBlur={e => {
                                  const v = e.target.value.trim()
                                  if (v && v !== team.name) updateTeam(team.id, { name: v })
                                  else e.target.value = team.name
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none font-medium text-gray-800 bg-transparent"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                defaultValue={team.password}
                                placeholder="—"
                                key={`${team.id}-pwd-${team.password}`}
                                onBlur={e => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                                  if (v !== team.password) updateTeam(team.id, { password: v })
                                  e.target.value = v
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className={`w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none font-mono tracking-widest text-center bg-transparent ${
                                  team.password ? 'text-gray-800' : 'text-gray-300'
                                }`}
                                title={team.password ? 'Team password (set by admin)' : 'Not set yet — set a 4-digit password for this group'}
                              />
                            </td>
                            <td className="px-4 py-3 min-w-[200px]">
                              {(() => {
                                const teamMembers = members.filter(m => m.team_id === team.id)
                                const isFull = teamMembers.length >= 4
                                return (
                                  <div>
                                    <span className={`text-sm font-bold ${isFull ? 'text-red-500' : 'text-gray-700'}`}>
                                      {teamMembers.length} / 4
                                    </span>
                                    {teamMembers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {teamMembers.map(m => (
                                          <span
                                            key={m.id}
                                            className="inline-flex items-center gap-1 bg-gray-100 rounded-full pl-2 pr-1 py-0.5 text-[11px] text-gray-700"
                                          >
                                            {m.name}
                                            <span className={`text-[9px] font-black uppercase px-1 rounded-full ${
                                              m.role === 'observer'
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-violet-100 text-violet-600'
                                            }`}>
                                              {m.role === 'observer' ? 'Observer' : 'Member'}
                                            </span>
                                            <select
                                              value=""
                                              onChange={e => { if (e.target.value) moveMember(m.id, e.target.value) }}
                                              className="text-[9px] bg-transparent text-gray-400 hover:text-gray-600 cursor-pointer outline-none border-none"
                                              title={`Move ${m.name} to another team`}
                                            >
                                              <option value="">Move…</option>
                                              {sectionTeams.filter(t => t.id !== team.id).map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              onClick={() => removeMember(m.id, m.name, team.name)}
                                              className="w-4 h-4 rounded-full bg-gray-300 hover:bg-red-500 hover:text-white text-gray-600 text-[10px] font-bold leading-none flex items-center justify-center transition-colors"
                                              title={`Remove ${m.name}`}
                                            >
                                              &times;
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={team.section_id}
                                onChange={e => moveTeamToSection(team.id, e.target.value)}
                                className="px-2 py-1 rounded border border-gray-200 text-xs bg-white"
                              >
                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                                  {completedCount}/{sectionGridTasks.length}
                                </span>
                              </div>
                              {pointsEarned > 0 && (
                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{pointsEarned} pts</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-black text-amber-600">{teamBingoLines}</span>
                              <span className="text-xs text-gray-400 ml-1">/ 12</span>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                step="1"
                                defaultValue={team.bonus_points ?? 0}
                                placeholder="0"
                                key={`${team.id}-bonus-${team.bonus_points ?? 0}`}
                                onBlur={e => {
                                  const n = parseInt(e.target.value, 10)
                                  const v = Number.isFinite(n) ? n : 0
                                  if (v !== (team.bonus_points ?? 0)) updateTeam(team.id, { bonus_points: v })
                                  e.target.value = String(v)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                className="w-20 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none font-mono text-center text-gray-800 bg-transparent"
                                title="Extra points from other games — factored into award ranking"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setViewingTeam(team)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                              >
                                View Grid
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => deleteTeam(team.id, team.name)}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-300 px-4 py-2">Tap <span className="font-bold text-violet-500">View Grid</span> to see a group's 5×5 board.</p>
                </div>)}
              </div>
            )
          })()}
          {scopedTeams.length === 0 && (
            <p className="text-gray-400 text-sm">No groups yet. Create groups above for participants to join.</p>
          )}
        </section>
        )}

      </main>

      {/* ── Slot Picker Modal ───────────────────────────────────────────────── */}
      {slotPickerIndex !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setSlotPickerIndex(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col animate-bounce-in"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Place a challenge</h3>
                <p className="text-xs text-gray-400 mt-0.5">Slot {slotPickerIndex + 1} of 25</p>
              </div>
              <button onClick={() => setSlotPickerIndex(null)} className="text-gray-300 hover:text-gray-600 text-2xl font-light">&times;</button>
            </div>
            {/* Category filter */}
            {allCategories.length > 0 && (
              <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                <button onClick={() => setSlotPickerFilter('all')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${slotPickerFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  All
                </button>
                {allCategories.map(cat => (
                  <button key={cat} onClick={() => setSlotPickerFilter(cat)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${slotPickerFilter === cat ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 py-2">
              {(slotPickerFilter === 'all' ? scopedTasks : scopedTasks.filter(t => t.category === slotPickerFilter)).map(task => (
                <button
                  key={task.id}
                  onClick={async () => {
                    if (task.in_grid) {
                      const created = await cloneTask(task)
                      if (created) await insertIntoGrid(created.id, slotPickerIndex)
                    } else {
                      await insertIntoGrid(task.id, slotPickerIndex)
                    }
                    setSlotPickerIndex(null)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: task.hex_code }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    {task.category && <p className="text-xs text-gray-400 truncate">{task.category}</p>}
                  </div>
                  {task.in_grid && (
                    <span className="text-xs font-bold text-amber-500 flex-shrink-0 bg-amber-50 px-1.5 py-0.5 rounded">Dup</span>
                  )}
                  {(task.points ?? 0) > 0 && (
                    <span className="text-xs font-bold text-violet-500 flex-shrink-0">{task.points} pts</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tile Edit Modal ──────────────────────────────────────────────────── */}
      {editingTile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => !tileSaving && setEditingTile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh] animate-bounce-in"
            onClick={e => e.stopPropagation()}>
            <div className="h-16 flex items-center px-6 gap-3" style={{ backgroundColor: tileHex }}>
              <div className="flex-1">
                {tileCategory && <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">{tileCategory}</p>}
                <p className="text-white font-black text-lg leading-tight truncate">{tileTitle || 'Tile Title'}</p>
              </div>
              <button onClick={() => setEditingTile(null)} className="text-white/60 hover:text-white text-2xl font-light">&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={tileTitle} onChange={e => setTileTitle(e.target.value)} autoFocus
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <select value={tileSectionId} onChange={e => setTileSectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {editingTile && tileSectionId !== editingTile.section_id && (
                  <p className="text-xs text-amber-600 mt-1">Moving to a different section will take this card off the board.</p>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={tileCategory} onChange={async e => {
                    if (e.target.value === '__new__') {
                      const name = await promptAndCreateCategory(tileSectionId)
                      if (name) setTileCategory(name)
                      return
                    }
                    setTileCategory(e.target.value)
                  }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                    <option value="">— Uncategorized —</option>
                    {categories.filter(c => c.section_id === tileSectionId).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="__new__">+ New category…</option>
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <input type="number" value={tilePoints} min={0}
                    onChange={e => setTilePoints(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold" />
                </div>
              </div>
              <ColorPicker hex={tileHex} colorName={tileColor} onHexChange={setTileHex} onNameChange={setTileColor} />
              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Type</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setTileTaskType('standard')}
                    className={`flex-1 py-2 text-sm font-bold transition-colors ${tileTaskType === 'standard' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setTileTaskType('answer')}
                    className={`flex-1 py-2 text-sm font-bold transition-colors ${tileTaskType === 'answer' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    Answer Input
                  </button>
                </div>
              </div>
              {tileTaskType === 'answer' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question / Prompt</label>
                    <input type="text" value={tileAnswerQuestion} onChange={e => setTileAnswerQuestion(e.target.value)}
                      placeholder="e.g. What is the name of this landmark?"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer Template</label>
                    <p className="text-xs text-gray-400 mb-1">One answer per line. Each line becomes a row of letter boxes.</p>
                    <textarea value={tileAnswerText} onChange={e => setTileAnswerText(e.target.value)}
                      placeholder={"e.g.\nPETRONAS\nTWIN TOWERS"}
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm resize-none" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={saveTile} disabled={tileSaving || !tileTitle.trim() || !tileColor.trim()}
                  className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  {tileSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingTile(null)} disabled={tileSaving}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Modal ────────────────────────────────────────────────────────── */}
      {qrTask && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50 cursor-pointer" onClick={() => setQrTask(null)}>
          <button onClick={() => setQrTask(null)} className="absolute top-6 right-8 text-white/60 hover:text-white text-5xl font-light z-10">&times;</button>
          <div className="absolute top-6 left-0 right-0 text-center text-white/40 text-lg">Tap anywhere to go back</div>
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center gap-6 max-w-lg mx-4 cursor-default animate-bounce-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: qrTask.hex_code }} />
              <h2 className="text-3xl font-black text-gray-900">{qrTask.title}</h2>
            </div>
            <p className="text-gray-400 font-medium uppercase tracking-wider text-sm">{qrTask.color} Challenge — Scan with phone camera</p>
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={`${window.location.origin}/bingo-dash/task/${qrTask.id}`} size={400} level="H" />
            </div>
            <p className="text-xs text-gray-300 font-mono break-all text-center">
              {window.location.origin}/bingo-dash/task/{qrTask.id}
            </p>
            <button onClick={() => setQrTask(null)} className="px-8 py-4 bg-gray-900 text-white rounded-2xl hover:bg-gray-700 transition-all text-lg font-bold hover:scale-105 active:scale-95">
              &larr; Back to Challenges
            </button>
          </div>
        </div>
      )}

      {/* ── Import Modal ─────────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => { if (!importing) setShowImport(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-bounce-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Challenges</h2>
                <p className="text-sm text-gray-400 mt-0.5">Bulk-create tiles from JSON</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-gray-300 hover:text-gray-600 text-2xl font-light">&times;</button>
            </div>
            <div className="px-6 py-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <details className="bg-gray-50 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100">JSON format reference ▾</summary>
                <pre className="px-4 pb-4 text-xs text-gray-500 leading-relaxed overflow-x-auto">{`[
  {
    "title": "Water Challenge",
    "color": "Blue",
    "hex_code": "#3B82F6",
    "clues": ["Find a water source", "Take a team photo"]
  }
]`}</pre>
              </details>
              <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportPreview(null); setImportError('') }}
                placeholder="Paste your JSON array here..."
                className="w-full h-40 px-4 py-3 rounded-xl border border-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                disabled={importing} />
              {importError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span>🚫</span><p className="text-red-600 font-bold text-sm">{importError}</p>
                </div>
              )}
              {importPreview && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Preview — {importPreview.length} challenge{importPreview.length !== 1 ? 's' : ''} to import:</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {importPreview.map((row, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: row.hex_code }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{row.title}</p>
                          <p className="text-xs text-gray-400">{row.color}{row.clues.length > 0 ? ` · ${row.clues.length} clue${row.clues.length !== 1 ? 's' : ''}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowImport(false)} disabled={importing}
                className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
              {!importPreview ? (
                <button onClick={handleImportPreview} disabled={!importText.trim()}
                  className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50">Preview Import</button>
              ) : (
                <button onClick={handleImportConfirm} disabled={importing}
                  className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${importPreview.length} Challenge${importPreview.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section Manager Modal ───────────────────────────────────────────── */}
      {showSectionManager && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setShowSectionManager(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh] animate-bounce-in"
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Sections</h3>
                <p className="text-xs text-gray-400 mt-0.5">Each section is an independent game at a different location.</p>
              </div>
              <button onClick={() => setShowSectionManager(false)} className="text-gray-400 hover:text-gray-700 text-2xl font-light">&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createSection() }}
                  placeholder="New section name (e.g. Klang Hunt)"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
                <button onClick={() => createSection()} disabled={!newSectionName.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {sections.map(s => {
                  const taskCount = tasks.filter(t => t.section_id === s.id).length
                  const teamCount = teams.filter(t => t.section_id === s.id).length
                  return (
                    <div key={s.id} className={`p-3 ${s.game_started ? 'bg-green-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={s.name}
                          key={`${s.id}-${s.name}`}
                          onBlur={e => { if (e.target.value.trim() !== s.name) renameSection(s.id, e.target.value) }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="flex-1 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none text-sm font-medium bg-transparent"
                        />
                        <span className="text-xs text-gray-400 flex-shrink-0">{taskCount} cards · {teamCount} teams</span>
                        <button onClick={() => deleteSection(s.id)}
                          className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1 flex-shrink-0 disabled:opacity-30"
                          disabled={sections.length <= 1}>
                          Delete
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => toggleSectionGameStarted(s.id, !s.game_started)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            s.game_started
                              ? 'bg-green-500 text-white hover:bg-red-500'
                              : 'bg-gray-200 text-gray-600 hover:bg-green-500 hover:text-white'
                          }`}
                        >
                          <span>{s.game_started ? '● LIVE' : '■ Locked'}</span>
                        </button>
                        <span className="text-[11px] text-gray-400">
                          {s.game_started ? 'Players can access the board' : 'Players see waiting screen'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Team Grid Viewer Modal ──────────────────────────────────────────── */}
      {viewingTeam && (() => {
        const team = viewingTeam
        const teamScans = scans.filter(s => s.team_id === team.id)
        const completedIds = new Set(teamScans.filter(s => s.completed).map(s => s.task_id))
        const scannedIds = new Set(teamScans.map(s => s.task_id))
        const sectionTasksForTeam = tasks.filter(t => t.section_id === team.section_id)
        const gridTasksForTeam = sectionTasksForTeam.filter(t => t.in_grid).sort((a, b) => a.sort_order - b.sort_order)
        const slots = buildBingoSlots(gridTasksForTeam)
        const completedLineIdx = completedBingoLines(slots, completedIds)
        const bingoSlotSet = new Set<number>()
        completedLineIdx.forEach(i => BINGO_LINES[i].forEach(idx => bingoSlotSet.add(idx)))
        const gridTaskIdSet = new Set(gridTasksForTeam.map(t => t.id))
        const tasksDone = teamScans.filter(s => s.completed && gridTaskIdSet.has(s.task_id)).length
        const points = gridTasksForTeam.reduce(
          (sum, t) => completedIds.has(t.id) ? sum + (t.points ?? 0) : sum, 0,
        )
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={() => setViewingTeam(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-bounce-in"
              onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Team Grid</p>
                  <h3 className="font-black text-gray-900 text-lg">{team.name}</h3>
                </div>
                <button onClick={() => setViewingTeam(null)} className="text-gray-300 hover:text-gray-600 text-2xl font-light">&times;</button>
              </div>

              {/* Stats */}
              <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Points</p>
                  <p className="text-2xl font-black text-gray-900">{points}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bingos</p>
                  <p className="text-2xl font-black text-amber-600">{completedLineIdx.length}<span className="text-sm text-gray-300">/12</span></p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Done</p>
                  <p className="text-2xl font-black text-green-600">{tasksDone}</p>
                </div>
              </div>

              {/* Grid */}
              <div className="p-5 overflow-y-auto">
                {gridTasksForTeam.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No grid configured for this section.</p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5">
                    {slots.map((t, i) => {
                      if (!t) {
                        return <div key={`e-${i}`} className="aspect-square rounded-lg bg-gray-50 border border-dashed border-gray-200" />
                      }
                      const isCompleted = completedIds.has(t.id)
                      const isScanned = !isCompleted && scannedIds.has(t.id)
                      const inLine = bingoSlotSet.has(i)
                      return (
                        <div
                          key={t.id}
                          title={t.title}
                          className="relative aspect-square rounded-lg flex items-center justify-center text-center px-1 overflow-hidden"
                          style={{
                            backgroundColor: t.hex_code,
                            opacity: isCompleted ? 1 : isScanned ? 0.55 : 0.22,
                            boxShadow: inLine ? '0 0 0 2px #fbbf24, 0 0 8px #fbbf24aa' : 'none',
                          }}
                        >
                          <span className="text-white text-[9px] font-black leading-tight line-clamp-3 drop-shadow">
                            {t.title}
                          </span>
                          {isCompleted && (
                            <div className="absolute top-0.5 right-0.5 bg-white/90 rounded-full w-4 h-4 flex items-center justify-center">
                              <span className="text-green-600 text-[10px] font-black">✓</span>
                            </div>
                          )}
                          {isScanned && (
                            <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white/90" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex justify-center gap-4 text-[11px] text-gray-400 mt-4">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" />Locked</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400" />Scanned</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Completed</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />Bingo</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Join Link / QR Modal ───────────────────────────────────────────── */}
      {showJoinLink && (() => {
        const currentSection = sections.find(s => s.id === currentSectionId)
        const baseUrl = currentSection
          ? `${window.location.origin}/bingo-dash/play/${currentSection.slug}`
          : ''
        const playerUrl = baseUrl
        const observerUrl = baseUrl ? `${baseUrl}?mode=observer` : ''

        const handleCopy = (url: string) => {
          navigator.clipboard.writeText(url).then(() => {
            setJoinLinkCopied(true)
            setTimeout(() => setJoinLinkCopied(false), 2000)
          })
        }

        const downloadQR = (svgId: string, filename: string) => {
          const svg = document.getElementById(svgId)
          if (!svg) return
          const svgData = new XMLSerializer().serializeToString(svg)
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = new Image()
          img.onload = () => {
            canvas.width = 1024
            canvas.height = 1024
            if (ctx) {
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, 1024, 1024)
              ctx.drawImage(img, 0, 0, 1024, 1024)
            }
            const a = document.createElement('a')
            a.download = filename
            a.href = canvas.toDataURL('image/png')
            a.click()
          }
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
        }

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={() => setShowJoinLink(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-bounce-in"
              onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Join Links</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    For <span className="font-bold text-gray-600">{currentSection?.name ?? 'this section'}</span>
                  </p>
                </div>
                <button onClick={() => setShowJoinLink(false)}
                  className="text-gray-400 hover:text-gray-700 text-2xl font-light">&times;</button>
              </div>

              {!currentSection ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">No section selected.</p>
                </div>
              ) : (
                <div className="p-6 flex flex-col gap-5">
                  {/* Tabs */}
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    <button
                      onClick={() => setJoinLinkTab('player')}
                      className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                        joinLinkTab === 'player' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      🎯 Players
                    </button>
                    <button
                      onClick={() => setJoinLinkTab('observer')}
                      className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                        joinLinkTab === 'observer' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      👁 Observers
                    </button>
                  </div>

                  {/* Player tab */}
                  {joinLinkTab === 'player' && (
                    <div className="flex flex-col items-center gap-5">
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <QRCodeSVG id="join-qr-svg" value={playerUrl} size={260} level="H" />
                      </div>
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 px-3 py-2.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 break-all select-all border border-gray-200">
                          {playerUrl}
                        </div>
                        <button onClick={() => handleCopy(playerUrl)}
                          className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                            joinLinkCopied ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-900 text-white hover:bg-gray-700'
                          }`}>
                          {joinLinkCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <button onClick={() => downloadQR('join-qr-svg', `bingo-dash-join-${currentSection.slug}.png`)}
                        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors hover:scale-[1.02] active:scale-95">
                        Download QR as PNG
                      </button>
                    </div>
                  )}

                  {/* Observer tab */}
                  {joinLinkTab === 'observer' && (
                    <div className="flex flex-col items-center gap-5">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 w-full">
                        <span>👁</span>
                        <p className="text-blue-700 text-xs font-bold">Observers can browse and click everything — but cannot submit answers or complete tasks.</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <QRCodeSVG id="join-qr-svg-observer" value={observerUrl} size={260} level="H" />
                      </div>
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 px-3 py-2.5 bg-blue-50 rounded-lg text-xs font-mono text-blue-700 break-all select-all border border-blue-200">
                          {observerUrl}
                        </div>
                        <button onClick={() => handleCopy(observerUrl)}
                          className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                            joinLinkCopied ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}>
                          {joinLinkCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <button onClick={() => downloadQR('join-qr-svg-observer', `bingo-dash-observer-${currentSection.slug}.png`)}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors hover:scale-[1.02] active:scale-95">
                        Download Observer QR as PNG
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-300 text-center">
                    Switch sections in the header to get a different join link.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
