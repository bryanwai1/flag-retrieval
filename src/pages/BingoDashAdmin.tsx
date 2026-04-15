import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import type { BingoTask, BingoTeam, BingoScan, BingoSettings, BingoSection } from '../types/database'

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

// ── Main component ─────────────────────────────────────────────────────────────
export function BingoDashAdmin() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<BingoTask[]>([])
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [scans, setScans] = useState<BingoScan[]>([])
  const [sections, setSections] = useState<BingoSection[]>([])
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null)
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [qrTask, setQrTask] = useState<BingoTask | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Add challenge form
  const [formTitle, setFormTitle] = useState('')
  const [formColor, setFormColor] = useState('')
  const [formHex, setFormHex] = useState('#3B82F6')
  const [formCategory, setFormCategory] = useState('')
  const [formPoints, setFormPoints] = useState(0)
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
  const [tileSaving, setTileSaving] = useState(false)

  // Inline category edit on gallery cards
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryValue, setEditingCategoryValue] = useState('')

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

  // ── Derived ────────────────────────────────────────────────────────────────
  const scopedTasks = currentSectionId ? tasks.filter(t => t.section_id === currentSectionId) : []
  const scopedTeams = currentSectionId ? teams.filter(t => t.section_id === currentSectionId) : []
  const gridTasks = scopedTasks.filter(t => t.in_grid).sort((a, b) => a.sort_order - b.sort_order)
  const offGridTasks = scopedTasks.filter(t => !t.in_grid).sort((a, b) => a.sort_order - b.sort_order)

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
  const offGridCategories = [...new Set(offGridTasks.map(t => t.category).filter(Boolean))].sort() as string[]
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

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [tasksRes, teamsRes, scansRes, sectionsRes] = await Promise.all([
      supabase.from('bingo_tasks').select('*').order('sort_order'),
      supabase.from('bingo_teams').select('*').order('created_at'),
      supabase.from('bingo_scans').select('*'),
      supabase.from('bingo_sections').select('*').order('sort_order'),
    ])
    if (tasksRes.data) setTasks(tasksRes.data)
    if (teamsRes.data) setTeams(teamsRes.data)
    if (scansRes.data) setScans(scansRes.data)
    if (sectionsRes.data) {
      setSections(sectionsRes.data)
      setCurrentSectionId(prev => prev ?? sectionsRes.data[0]?.id ?? null)
    }
    setLoading(false)
  }, [])

  // ── Section CRUD ──────────────────────────────────────────────────────────
  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const createSection = async () => {
    const name = newSectionName.trim()
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
    setNewSectionName('')
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

  const setActiveSection = async (id: string) => {
    setSettings(prev => prev ? { ...prev, active_section_id: id } : prev)
    await supabase.from('bingo_settings').update({ active_section_id: id }).eq('id', 'main')
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
  }

  const saveTile = async () => {
    if (!editingTile || !tileTitle.trim() || !tileColor.trim()) return
    setTileSaving(true)
    try {
      const updates: Partial<BingoTask> = {
        title: tileTitle.trim(), color: tileColor.trim(), hex_code: tileHex,
        category: tileCategory.trim(), points: tilePoints,
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

  // Add a card from any section onto the current section's grid.
  // If the card lives in a different section, duplicate it into the current
  // section (with task pages) first so the source section is untouched.
  const addCardFromLibrary = async (task: BingoTask) => {
    if (!currentSectionId || gridTasks.length >= 25) return
    const firstEmpty = gridSlots.findIndex(s => s === null)
    if (firstEmpty === -1) return
    if (task.section_id === currentSectionId) {
      await insertIntoGrid(task.id, firstEmpty)
      return
    }
    const { data: pages } = await supabase
      .from('bingo_task_pages').select('*').eq('task_id', task.id).order('page_order')
    const { data: created, error } = await supabase.from('bingo_tasks').insert({
      section_id: currentSectionId,
      title: task.title, color: task.color, hex_code: task.hex_code,
      category: task.category, points: task.points,
      in_grid: false,
      sort_order: Math.max(25, scopedTasks.length + 25),
    }).select().single()
    if (error || !created) { alert('Failed to add card'); return }
    if (pages && pages.length > 0) {
      const copies = pages.map(p => {
        const { id, task_id, created_at, ...rest } = p
        void id; void task_id; void created_at
        return { ...rest, task_id: created.id }
      })
      await supabase.from('bingo_task_pages').insert(copies)
    }
    setTasks(prev => [...prev, created])
    await insertIntoGrid(created.id, firstEmpty)
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

  const saveCategoryInline = async (taskId: string) => {
    const val = editingCategoryValue.trim()
    setEditingCategoryId(null)
    await supabase.from('bingo_tasks').update({ category: val }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, category: val } : t))
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
      })
      setFormTitle(''); setFormColor(''); setFormHex('#3B82F6'); setFormCategory(''); setFormPoints(0)
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

  const updateTeam = async (id: string, updates: Partial<BingoTeam>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await supabase.from('bingo_teams').update(updates).eq('id', id)
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
    <div className="min-h-screen bg-gray-50" onDragEnd={onDragEnd}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">←</button>
            <h1 className="text-2xl font-bold text-gray-900">Bingo Dash — Admin</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Section switcher */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Section</label>
              <select
                value={currentSectionId ?? ''}
                onChange={e => setCurrentSectionId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm font-medium bg-white"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{settings?.active_section_id === s.id ? ' • LIVE' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => currentSectionId && setActiveSection(currentSectionId)}
                disabled={!currentSectionId || settings?.active_section_id === currentSectionId}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-green-700 border border-green-300 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Make this the section players see"
              >
                Set live
              </button>
              <button
                onClick={() => setShowSectionManager(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-600 border border-gray-300 hover:bg-gray-50"
              >
                Manage
              </button>
            </div>
            <span className="text-sm text-gray-400 hidden sm:block">
              {scopedTasks.length} challenges · {scopedTeams.length} teams
            </span>
            <a href="/bingo-dash" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-violet-600 border border-violet-200 hover:bg-violet-50 transition-colors">
              Player View ↗
            </a>
            <button
              onClick={() => { setShowImport(true); setImportText(''); setImportPreview(null); setImportError('') }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-10">

        {/* ── Timer ────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Timer</h2>
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

        {/* ── Board Editor ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Board Editor
                <span className="ml-2 text-sm font-normal text-gray-400">({gridTasks.length}/25)</span>
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
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
                          if (!dragState && offGridTasks.length > 0 && gridTasks.length < 25) {
                            setSlotPickerIndex(slotIndex)
                            setSlotPickerFilter('all')
                          }
                        }}
                        className={`aspect-square rounded-lg border-2 border-dashed transition-all duration-150 flex items-center justify-center ${
                          isDragOver && dragState
                            ? 'border-violet-400 bg-violet-400/20 scale-105'
                            : offGridTasks.length > 0 && gridTasks.length < 25
                              ? 'bg-white/5 border-white/20 hover:border-violet-400 hover:bg-violet-400/10 cursor-pointer'
                              : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {offGridTasks.length > 0 && gridTasks.length < 25 && !dragState && (
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
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Add to Grid
                {gridTasks.length >= 25 && <span className="ml-2 text-red-400 normal-case font-normal">Grid full</span>}
              </p>
              {/* Section + search row */}
              <div className="flex gap-2 mb-2">
                <select
                  value={addListSectionFilter}
                  onChange={e => setAddListSectionFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-medium bg-white flex-shrink-0"
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
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-0"
                />
              </div>
              {/* Category chips */}
              {addListCategories.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  <button
                    onClick={() => setOffGridCategoryFilter('all')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${offGridCategoryFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    All
                  </button>
                  {addListCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setOffGridCategoryFilter(cat)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${offGridCategoryFilter === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {addListTasks.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                  No cards match these filters.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {addListTasks.map(task => {
                    const isSameSection = task.section_id === currentSectionId
                    const sectionName = sections.find(s => s.id === task.section_id)?.name ?? ''
                    return (
                      <div
                        key={task.id}
                        draggable={isSameSection}
                        onDragStart={isSameSection ? (e => onListDragStart(e, task.id)) : undefined}
                        onDragEnd={isSameSection ? onDragEnd : undefined}
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors select-none ${
                          isSameSection ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${dragState?.id === task.id ? 'opacity-40' : ''}`}
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.hex_code }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 truncate">
                            {task.category && <span>{task.category}</span>}
                            {!isSameSection && (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">
                                {sectionName} · copy
                              </span>
                            )}
                            {isSameSection && task.in_grid && (
                              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">on grid</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => addCardFromLibrary(task)}
                          disabled={gridTasks.length >= 25 || (isSameSection && task.in_grid)}
                          className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 disabled:opacity-40 transition-colors flex-shrink-0"
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

        {/* ── Challenges gallery ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Challenges</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors">
              + Add Challenge
            </button>
          </div>

          {/* Category filter chips */}
          {allCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-5">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${categoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                All ({scopedTasks.length})
              </button>
              {allCategories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {cat} ({scopedTasks.filter(t => t.category === cat).length})
                </button>
              ))}
              {scopedTasks.some(t => !t.category) && (
                <button onClick={() => setCategoryFilter('__none__')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${categoryFilter === '__none__' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
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
                    <input type="text" list="cat-list-form" value={formCategory} onChange={e => setFormCategory(e.target.value)}
                      placeholder="e.g. Physical Activities"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <datalist id="cat-list-form">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input type="number" value={formPoints} min={0}
                      onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold" />
                  </div>
                </div>
                <ColorPicker hex={formHex} colorName={formColor} onHexChange={setFormHex} onNameChange={setFormColor} />
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

          {/* Grouped gallery */}
          {scopedTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
              No challenges yet. Click "Add Challenge" to create one.
            </p>
          ) : groupedTasks.length === 0 ? (
            <p className="text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
              No challenges in this category.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {groupedTasks.map(group => (
                <div key={group.key}>
                  {/* Category section header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      {group.label}
                    </h3>
                    <span className="text-xs text-gray-300 font-medium">{group.tasks.length}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                    {/* Bulk color setter for this category */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400">color for all:</span>
                      <input
                        type="color"
                        defaultValue={group.tasks[0]?.hex_code ?? '#3B82F6'}
                        key={group.key + '-color'}
                        className="w-7 h-7 rounded cursor-pointer border border-gray-200"
                        onChange={e => setBulkCategoryColor(group.key, e.target.value)}
                        title={`Set color for all ${group.label} tasks`}
                      />
                    </div>
                    {/* Bulk points setter for this category */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400">pts for all:</span>
                      <input
                        type="number"
                        min={0}
                        defaultValue={group.tasks[0]?.points ?? 0}
                        key={group.key + '-pts'}
                        className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded text-center font-bold focus:outline-none focus:ring-1 focus:ring-violet-400"
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
                          {/* Inline category edit */}
                          {editingCategoryId === task.id ? (
                            <div className="mt-2">
                              <input
                                autoFocus
                                type="text"
                                list="cat-list-gallery"
                                value={editingCategoryValue}
                                onChange={e => setEditingCategoryValue(e.target.value)}
                                onBlur={() => saveCategoryInline(task.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveCategoryInline(task.id)
                                  if (e.key === 'Escape') setEditingCategoryId(null)
                                }}
                                placeholder="Category..."
                                className="w-full bg-black/20 text-white text-xs px-2 py-1 rounded border border-white/30 focus:outline-none focus:border-white/60 placeholder-white/40"
                              />
                              <datalist id="cat-list-gallery">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingCategoryId(task.id); setEditingCategoryValue(task.category || '') }}
                              className="mt-1.5 text-white/50 text-xs hover:text-white/80 transition-colors text-left block"
                            >
                              {task.category ? `📂 ${task.category}` : '+ Add category'}
                            </button>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-white/50 text-xs">
                              {scans.filter(s => s.task_id === task.id && s.completed).length} completed ·{' '}
                              {scans.filter(s => s.task_id === task.id).length} scanned
                            </p>
                            {(task.points ?? 0) > 0 && (
                              <span className="bg-black/30 text-white/80 text-[10px] font-black rounded px-1.5 py-0.5">
                                {task.points} pts
                              </span>
                            )}
                          </div>
                          <p className="text-white/40 text-xs mt-0.5">
                            {task.in_grid ? '✓ In grid' : 'Off grid'}
                          </p>
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
              ))}
            </div>
          )}
        </section>

        {/* ── Teams ─────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Teams <span className="ml-2 text-sm font-normal text-gray-400">({scopedTeams.length} registered)</span>
          </h2>
          {scopedTeams.length === 0 ? (
            <p className="text-gray-400 text-sm">No teams yet. Teams register when they scan a QR code.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Team</th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Password</th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Section</th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Progress</th>
                    {scopedTasks.map(t => (
                      <th key={t.id} className="px-3 py-3 text-center" title={t.title}>
                        <div className="w-4 h-4 rounded-full mx-auto" style={{ backgroundColor: t.hex_code }} />
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scopedTeams.map(team => {
                    const teamScans = scans.filter(s => s.team_id === team.id)
                    const completedCount = teamScans.filter(s => s.completed).length
                    const pointsEarned = teamScans
                      .filter(s => s.completed)
                      .reduce((sum, s) => sum + (scopedTasks.find(t => t.id === s.task_id)?.points ?? 0), 0)
                    const pct = scopedTasks.length > 0 ? Math.round((completedCount / scopedTasks.length) * 100) : 0
                    return (
                      <tr key={team.id} className="hover:bg-gray-50 transition-colors">
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
                            defaultValue={team.password}
                            key={`${team.id}-pwd-${team.password}`}
                            onBlur={e => {
                              const v = e.target.value
                              if (v !== team.password) updateTeam(team.id, { password: v })
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-1 rounded select-all border border-transparent hover:border-gray-300 focus:border-violet-400 focus:outline-none w-28"
                          />
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
                              {completedCount}/{scopedTasks.length}
                            </span>
                          </div>
                          {pointsEarned > 0 && (
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{pointsEarned} pts</p>
                          )}
                        </td>
                        {scopedTasks.map(t => {
                          const scan = teamScans.find(s => s.task_id === t.id)
                          return (
                            <td key={t.id} className="px-3 py-3 text-center">
                              {scan?.completed ? <span className="text-green-600 font-black">✓</span>
                                : scan ? <span className="text-gray-300">◎</span>
                                : <span className="text-gray-100">·</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteTeam(team.id, team.name)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-300 px-4 py-2">◎ = Scanned &nbsp;·&nbsp; ✓ = Completed</p>
            </div>
          )}
        </section>
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
            {offGridCategories.length > 0 && (
              <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                <button onClick={() => setSlotPickerFilter('all')}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${slotPickerFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  All
                </button>
                {offGridCategories.map(cat => (
                  <button key={cat} onClick={() => setSlotPickerFilter(cat)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${slotPickerFilter === cat ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 py-2">
              {(slotPickerFilter === 'all' ? offGridTasks : offGridTasks.filter(t => t.category === slotPickerFilter)).map(task => (
                <button
                  key={task.id}
                  onClick={async () => {
                    await insertIntoGrid(task.id, slotPickerIndex)
                    setSlotPickerIndex(null)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: task.hex_code }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    {task.category && <p className="text-xs text-gray-400 truncate">{task.category}</p>}
                  </div>
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
                  <input type="text" list="cat-list-tile" value={tileCategory} onChange={e => setTileCategory(e.target.value)}
                    placeholder="e.g. Physical Activities"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <datalist id="cat-list-tile">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <input type="number" value={tilePoints} min={0}
                    onChange={e => setTilePoints(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center font-bold" />
                </div>
              </div>
              <ColorPicker hex={tileHex} colorName={tileColor} onHexChange={setTileHex} onNameChange={setTileColor} />
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
                <button onClick={createSection} disabled={!newSectionName.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {sections.map(s => {
                  const taskCount = tasks.filter(t => t.section_id === s.id).length
                  const teamCount = teams.filter(t => t.section_id === s.id).length
                  const isLive = settings?.active_section_id === s.id
                  return (
                    <div key={s.id} className="flex items-center gap-2 p-3">
                      <input
                        type="text"
                        defaultValue={s.name}
                        key={`${s.id}-${s.name}`}
                        onBlur={e => { if (e.target.value.trim() !== s.name) renameSection(s.id, e.target.value) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                        className="flex-1 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-violet-400 focus:outline-none text-sm font-medium"
                      />
                      {isLive && <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase">Live</span>}
                      <span className="text-xs text-gray-400">{taskCount} cards · {teamCount} teams</span>
                      <button onClick={() => deleteSection(s.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 disabled:opacity-40"
                        disabled={sections.length <= 1}>
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
