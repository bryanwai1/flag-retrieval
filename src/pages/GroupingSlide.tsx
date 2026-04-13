import { useState, useRef, useEffect } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'
import { useFullscreen } from '../hooks/useFullscreen'

const GROUP_COLORS = [
  '#a855f7', '#3b82f6', '#f97316', '#ef4444',
  '#22c55e', '#eab308', '#06b6d4',
]

const DEFAULT_GROUPS: { name: string; members: string[] }[] = [
  { name: 'Group 1', members: ['Abinaya Ashok','Ray Wang','Brian Liu','Jason Moon','Takeaki Sugita','Jean-Pierre Berbee','Shi-xian Ng','Mikki Moo','Weonjin Lee','Michael Tse','Timo Datwyler','Annie Tan'] },
  { name: 'Group 2', members: ['Alex Chen','Feng Xie','Will Wang','Paul Wang','Gang Zheng','Mieko Morioka','Jeffrey Cheek','Boonkung Yeoh','Vivin Joghee','Irene Li','Jiawen Zhang','Edmund Koh'] },
  { name: 'Group 3', members: ['Kishore Mukka','Suzie Ju','Niki Luo','Alice Zeng','Ramaneshwaran Baskaran','Mohammad Zaman','Ching-yee Kan','Weijie Lee','Eric Chai','Quentin Bortolin','Jason Low'] },
  { name: 'Group 4', members: ['David Liu','Toby Cheung','Tomoko Suruki','Albert Cho','Nicole Jolliffe','Sandeep Phad','Horyan Low','Dante Chan','Ramprasath Pitchiah','Laura Fu','Vincent Kam'] },
  { name: 'Group 5', members: ['Yin-chen Ha','Chengwei Zhao','Jackson Yip','Dao Cuong','Tejashree Chavan','Justin Ong','Vivien Lee','Asami Kataoka','Kaustubh Damodare','Jing Nie','Kar-mun Yen'] },
  { name: 'Group 6', members: ['Andrew Yi','Yuanyuan Su','Hyundong Lee','Sam Thung','Kenneth Leung','Jordan Wong','Nicolas Ooka','Asma Mabrouk','Berry Hamzah','Desmond Leung','Rachel Liow'] },
  { name: 'Group 7', members: ['Peter Cheng','Justin Zhu','Robin Li','Kevin Jadin','Hayley Huang','Crystal Lee','Asyraf Aziz','Yeongking Lai','Yuan Cao','Niko Moo','Jason Jin'] },
]

function loadGroups() {
  try {
    const saved = localStorage.getItem('grouping_data')
    if (saved) return JSON.parse(saved) as typeof DEFAULT_GROUPS
  } catch {}
  return DEFAULT_GROUPS
}

function saveGroups(groups: typeof DEFAULT_GROUPS) {
  localStorage.setItem('grouping_data', JSON.stringify(groups))
}

export function GroupingSlide() {
  const eventName = localStorage.getItem('event_name') || 'SWIFT TEAM BUILDING'
  const [groups, setGroups] = useState(loadGroups)
  const dragSrc = useRef<{ groupIdx: number; memberIdx: number } | null>(null)
  const [dragOver, setDragOver] = useState<{ groupIdx: number; memberIdx: number } | null>(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  const updateGroups = (next: typeof DEFAULT_GROUPS) => {
    setGroups(next)
    saveGroups(next)
  }

  const renameMember = (groupIdx: number, memberIdx: number, value: string) => {
    const next = groups.map((g, gi) =>
      gi === groupIdx ? { ...g, members: g.members.map((m, mi) => (mi === memberIdx ? value : m)) } : g
    )
    updateGroups(next)
  }

  const handleDragStart = (groupIdx: number, memberIdx: number) => {
    dragSrc.current = { groupIdx, memberIdx }
  }

  const handleDrop = (toGroupIdx: number, toMemberIdx: number) => {
    const src = dragSrc.current
    if (!src) return
    if (src.groupIdx === toGroupIdx && src.memberIdx === toMemberIdx) return
    const next = groups.map((g) => ({ ...g, members: [...g.members] }))
    const [moved] = next[src.groupIdx].members.splice(src.memberIdx, 1)
    const insertIdx = src.groupIdx === toGroupIdx && toMemberIdx > src.memberIdx ? toMemberIdx - 1 : toMemberIdx
    next[toGroupIdx].members.splice(insertIdx, 0, moved)
    dragSrc.current = null
    setDragOver(null)
    updateGroups(next)
  }

  const handleDropOnGroup = (toGroupIdx: number) => {
    const src = dragSrc.current
    if (!src) return
    const next = groups.map((g) => ({ ...g, members: [...g.members] }))
    const [moved] = next[src.groupIdx].members.splice(src.memberIdx, 1)
    next[toGroupIdx].members.push(moved)
    dragSrc.current = null
    setDragOver(null)
    updateGroups(next)
  }

  const resetGroups = () => {
    if (confirm('Reset all groups to original data?')) updateGroups(DEFAULT_GROUPS)
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-950 relative flex flex-col">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 text-center pt-4 pb-2 px-8 flex-shrink-0">
        <p className="text-white/30 text-xs font-bold uppercase tracking-[0.35em] mb-0.5">{eventName}</p>
        <h1 className="text-2xl font-black text-white tracking-tight">TEAM GROUPINGS</h1>
        <p className="text-white/20 text-xs mt-0.5 uppercase tracking-widest">Click to edit · Drag to move</p>
      </header>

      {/* All 7 groups — 2 rows, no scroll */}
      <main className="relative z-10 flex-1 flex flex-col gap-2.5 px-4 pb-3 min-h-0">
        {/* Row 1: Groups 1–4 */}
        <div className="grid grid-cols-4 gap-2.5 flex-1 min-h-0">
          {groups.slice(0, 4).map((group, i) => (
            <GroupCard
              key={i}
              group={group}
              color={GROUP_COLORS[i]}
              groupIdx={i}
              index={i}
              dragOver={dragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDropOnGroup={handleDropOnGroup}
              onDragOver={setDragOver}
              onDragEnd={() => setDragOver(null)}
              onRename={renameMember}
            />
          ))}
        </div>

        {/* Row 2: Groups 5–7 — centred with matching column width */}
        <div className="grid grid-cols-4 gap-2.5 flex-1 min-h-0">
          {groups.slice(4).map((group, i) => (
            <GroupCard
              key={4 + i}
              group={group}
              color={GROUP_COLORS[4 + i]}
              groupIdx={4 + i}
              index={4 + i}
              dragOver={dragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDropOnGroup={handleDropOnGroup}
              onDragOver={setDragOver}
              onDragEnd={() => setDragOver(null)}
              onRename={renameMember}
            />
          ))}
          {/* Invisible spacer so groups 5-7 align left like a 3-of-4 grid */}
          <div className="invisible" />
        </div>
      </main>

      {/* Footer */}
      <div className="relative z-10 text-center pb-3 flex-shrink-0 flex items-center justify-center gap-5">
        <a href="/event" className="text-xs text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest">← Event</a>
        <span className="text-white/10">·</span>
        <button onClick={resetGroups} className="text-xs text-white/15 hover:text-red-400/60 transition-colors uppercase tracking-widest">Reset</button>
        <span className="text-white/10">·</span>
        <a href="/" className="text-xs text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest">Hub</a>
      </div>

      {/* Fullscreen button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-white/30 hover:text-white transition-all"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function GroupCard({
  group, color, groupIdx, dragOver, index,
  onDragStart, onDrop, onDropOnGroup, onDragOver, onDragEnd, onRename,
}: {
  group: { name: string; members: string[] }
  color: string
  groupIdx: number
  dragOver: { groupIdx: number; memberIdx: number } | null
  index: number
  onDragStart: (g: number, m: number) => void
  onDrop: (g: number, m: number) => void
  onDropOnGroup: (g: number) => void
  onDragOver: (pos: { groupIdx: number; memberIdx: number } | null) => void
  onDragEnd: () => void
  onRename: (g: number, m: number, val: string) => void
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: `1.5px solid ${color}40`,
        boxShadow: `0 4px 24px ${color}15`,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDropOnGroup(groupIdx) }}
    >
      {/* Group header */}
      <div
        className="px-3 py-2 flex items-center gap-2.5 flex-shrink-0"
        style={{ background: `${color}22`, borderBottom: `1px solid ${color}30` }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: color }}>
          {index + 1}
        </div>
        <div className="min-w-0">
          <p className="text-white font-black text-sm tracking-tight leading-tight">{group.name}</p>
          <p className="text-white/35 text-xs leading-tight">{group.members.length} members</p>
        </div>
      </div>

      {/* Members — fills remaining height */}
      <div className="flex-1 px-2 py-1.5 min-h-0 overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <ul className="h-full flex flex-col justify-start gap-0">
          {group.members.map((name, mi) => (
            <MemberRow
              key={mi}
              name={name}
              groupIdx={groupIdx}
              memberIdx={mi}
              color={color}
              isDragTarget={dragOver?.groupIdx === groupIdx && dragOver?.memberIdx === mi}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onRename={onRename}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

function MemberRow({
  name, groupIdx, memberIdx, color, isDragTarget,
  onDragStart, onDrop, onDragOver, onDragEnd, onRename,
}: {
  name: string
  groupIdx: number
  memberIdx: number
  color: string
  isDragTarget: boolean
  onDragStart: (g: number, m: number) => void
  onDrop: (g: number, m: number) => void
  onDragOver: (pos: { groupIdx: number; memberIdx: number } | null) => void
  onDragEnd: () => void
  onRename: (g: number, m: number, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setVal(name) }, [name])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const save = () => {
    setEditing(false)
    if (val.trim() && val.trim() !== name) onRename(groupIdx, memberIdx, val.trim())
    else setVal(name)
  }

  return (
    <li
      draggable
      onDragStart={() => onDragStart(groupIdx, memberIdx)}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver({ groupIdx, memberIdx }) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(groupIdx, memberIdx) }}
      onDragEnd={onDragEnd}
      className="flex items-center gap-1 px-1 py-0.5 rounded group cursor-grab active:cursor-grabbing transition-all"
      style={{
        background: isDragTarget ? `${color}30` : 'transparent',
        borderTop: isDragTarget ? `1.5px solid ${color}80` : '1.5px solid transparent',
      }}
    >
      <span className="text-white/15 group-hover:text-white/40 transition-colors text-xs flex-shrink-0 select-none leading-none">⠿</span>
      {editing ? (
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setVal(name) } }}
          className="flex-1 bg-white/10 text-white text-xs font-medium px-1 py-0 rounded outline-none border border-white/30 min-w-0 leading-tight"
        />
      ) : (
        <span
          className="flex-1 text-white text-xs font-medium leading-tight cursor-pointer truncate"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {name}
        </span>
      )}
    </li>
  )
}
