import { useState } from 'react'
import type { TaskPage } from '../types/database'

interface PageFormProps {
  page: TaskPage
  index: number
  onSave: (id: string, updates: Partial<TaskPage>) => Promise<void>
  onDelete: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

export function PageForm({ page, index, onSave, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: PageFormProps) {
  const [mediaUrl, setMediaUrl] = useState(page.media_url || '')
  const [mediaType, setMediaType] = useState<'image' | 'video' | ''>(page.media_type || '')
  const [pointers, setPointers] = useState([
    page.pointer_1 || '',
    page.pointer_2 || '',
    page.pointer_3 || '',
    page.pointer_4 || '',
    page.pointer_5 || '',
    page.pointer_6 || '',
  ])
  const [saving, setSaving] = useState(false)

  const updatePointer = (i: number, val: string) => {
    const next = [...pointers]
    next[i] = val
    setPointers(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(page.id, {
        media_url: mediaUrl || null,
        media_type: (mediaType || null) as TaskPage['media_type'],
        pointer_1: pointers[0] || null,
        pointer_2: pointers[1] || null,
        pointer_3: pointers[2] || null,
        pointer_4: pointers[3] || null,
        pointer_5: pointers[4] || null,
        pointer_6: pointers[5] || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Page {index + 1}</h3>
        <div className="flex items-center gap-2">
          <button onClick={onMoveUp} disabled={isFirst} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30" title="Move up">↑</button>
          <button onClick={onMoveDown} disabled={isLast} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30" title="Move down">↓</button>
          <button onClick={() => onDelete(page.id)} className="px-2 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Media URL</label>
            <input type="text" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Media Type</label>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'image' | 'video' | '')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {pointers.map((val, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-600 mb-1">Pointer {i + 1}</label>
              <input type="text" value={val} onChange={(e) => updatePointer(i, e.target.value)} placeholder={`Enter pointer ${i + 1}...`} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving} className="self-start px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Saving...' : 'Save Page'}
        </button>
      </div>
    </div>
  )
}
