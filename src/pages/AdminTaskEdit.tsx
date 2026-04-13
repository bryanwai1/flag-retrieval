import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTaskPages } from '../hooks/useTaskPages'
import { useTaskPhotos } from '../hooks/useTaskPhotos'
import { TaskForm } from '../components/TaskForm'
import { PageForm } from '../components/PageForm'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import { AdminPhotoUpload } from '../components/AdminPhotoUpload'
import { ParticleBackground } from '../components/ParticleBackground'
import { PhotoGalleryView } from '../components/PhotoGalleryView'
import type { Task, TaskPage } from '../types/database'

export function AdminTaskEdit() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const { pages, createPage, updatePage, deletePage, reorderPages } = useTaskPages(taskId)
  const { photos } = useTaskPhotos(taskId)

  useEffect(() => {
    if (!taskId) return
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) { setTask(data); setTitleValue(data.title) }
    })
  }, [taskId])

  const handleTitleSave = async () => {
    if (!task || !titleValue.trim() || titleValue.trim() === task.title) {
      setEditingTitle(false)
      setTitleValue(task?.title || '')
      return
    }
    setTitleSaving(true)
    const { error } = await supabase.from('tasks').update({ title: titleValue.trim() }).eq('id', task.id)
    setTitleSaving(false)
    if (error) { alert('Failed to save title: ' + error.message); return }
    setTask({ ...task, title: titleValue.trim() })
    setEditingTitle(false)
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading task...</p>
      </div>
    )
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const reordered = [...pages]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    reorderPages(reordered)
  }

  const handleMoveDown = (index: number) => {
    if (index === pages.length - 1) return
    const reordered = [...pages]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    reorderPages(reordered)
  }

  const handleAddPage = async () => {
    await createPage({
      task_id: task.id,
      page_order: pages.length,
      media_url: null,
      media_type: null,
      pointer_1: null,
      pointer_2: null,
      pointer_3: null,
      pointer_4: null,
      pointer_5: null,
      pointer_6: null,
      example_1: null,
      example_2: null,
      example_3: null,
      example_4: null,
      example_5: null,
      example_6: null,
      icon_1: null,
      icon_2: null,
      icon_3: null,
      icon_4: null,
      icon_5: null,
      icon_6: null,
    })
  }

  if (previewMode) {
    return (
      <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: `color-mix(in srgb, ${task.hex_code} 25%, #0f0f0f)` }}>
        <ParticleBackground hexCode={task.hex_code} />

        {/* Floating exit button */}
        <button
          onClick={() => { setPreviewMode(false); setPreviewPage(0) }}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-black/60 backdrop-blur-sm text-white rounded-lg hover:bg-black/80 text-sm font-bold border border-white/20 transition-colors"
        >
          ✕ Exit Preview
        </button>

        {/* Header — mirrors ParticipantView */}
        <header className="px-6 py-5 text-white relative z-10 overflow-hidden">
          <div className="absolute inset-0" style={{ backgroundColor: task.hex_code, opacity: 0.35 }} />
          <div className="absolute inset-0 bg-black/30" />
          <div className="max-w-lg mx-auto relative z-10">
            <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Team: Preview Team</p>
            <h1 className="text-3xl font-black tracking-tight">{task.title}</h1>
            <div className="text-sm opacity-70 mt-1 uppercase tracking-wider">{task.color} Flag Challenge</div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-6 py-8 relative z-10">
          {pages.length === 0 && photos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No instructions available for this task yet.
            </div>
          ) : (
            <>
              {pages.length > 0 && (
                <>
                  <InstructionPage page={pages[previewPage]} hexCode={task.hex_code} />
                  <PageNavigator
                    current={previewPage}
                    total={pages.length}
                    onPrev={() => setPreviewPage((p) => Math.max(0, p - 1))}
                    onNext={() => setPreviewPage((p) => Math.min(pages.length - 1, p + 1))}
                    hexCode={task.hex_code}
                  />
                </>
              )}

              {photos.length > 0 && (
                <div className={pages.length > 0 ? 'mt-8' : ''}>
                  <PhotoGalleryView photos={photos} hexCode={task.hex_code} />
                </div>
              )}

              {/* Complete Activity — static preview state */}
              <div className="mt-8">
                <div className="text-center">
                  <p className="text-sm text-white/50 font-medium mb-3">
                    Collect your Completion Card from the marshal, then tap below
                  </p>
                  <button
                    disabled
                    className="w-full py-4 rounded-2xl text-white text-xl font-black uppercase tracking-wider opacity-50 cursor-default"
                    style={{
                      backgroundColor: task.hex_code,
                      boxShadow: `0 6px 0 ${task.hex_code}88, 0 8px 20px ${task.hex_code}44`,
                    }}
                  >
                    Complete Activity ✅
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-600">← Back</button>
            <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: task.hex_code }} />
            {editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setEditingTitle(false); setTitleValue(task.title) } }}
                disabled={titleSaving}
                className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent px-1 min-w-0 w-64"
              />
            ) : (
              <button
                onClick={() => { setEditingTitle(true); setTitleValue(task.title) }}
                className="text-xl font-bold text-gray-900 hover:text-blue-600 text-left group flex items-center gap-1.5"
                title="Click to edit title"
              >
                {task.title}
                <span className="text-gray-300 group-hover:text-blue-400 text-sm font-normal">✏️</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditingMeta(!editingMeta)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors">
              {editingMeta ? 'Hide Details' : 'Edit Details'}
            </button>
            <button onClick={() => { setPreviewMode(true); setPreviewPage(0) }} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors">
              Preview
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {editingMeta && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Task Details</h3>
            <TaskForm
              initial={task}
              onSave={async (data) => {
                const { error } = await supabase.from('tasks').update(data).eq('id', task.id)
                if (error) { alert('Failed to save: ' + error.message); return }
                setTask({ ...task, ...data })
                setTitleValue(data.title)
                setEditingMeta(false)
              }}
              onCancel={() => setEditingMeta(false)}
            />
          </div>
        )}

        {/* Clue Photos */}
        <div className="mb-6">
          <AdminPhotoUpload taskId={task.id} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Instruction Pages ({pages.length})</h2>
          <button onClick={handleAddPage} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors">
            + Add Page
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            No instruction pages yet. Click "Add Page" to create the first one.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pages.map((page: TaskPage, index: number) => (
              <PageForm
                key={page.id}
                page={page}
                index={index}
                hexCode={task.hex_code}
                onSave={updatePage}
                onDelete={deletePage}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                isFirst={index === 0}
                isLast={index === pages.length - 1}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
