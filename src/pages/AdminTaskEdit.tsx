import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTaskPages } from '../hooks/useTaskPages'
import { TaskForm } from '../components/TaskForm'
import { PageForm } from '../components/PageForm'
import { InstructionPage } from '../components/InstructionPage'
import { PageNavigator } from '../components/PageNavigator'
import type { Task, TaskPage } from '../types/database'

export function AdminTaskEdit() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const { pages, createPage, updatePage, deletePage, reorderPages } = useTaskPages(taskId)

  useEffect(() => {
    if (!taskId) return
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (data) setTask(data)
    })
  }, [taskId])

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
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-600">← Back</button>
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: task.hex_code }} />
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditingMeta(!editingMeta)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors">
              {editingMeta ? 'Hide Details' : 'Edit Details'}
            </button>
            <button onClick={() => { setPreviewMode(!previewMode); setPreviewPage(0) }} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors">
              {previewMode ? 'Exit Preview' : 'Preview'}
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
                await supabase.from('tasks').update(data).eq('id', task.id)
                setTask({ ...task, ...data })
                setEditingMeta(false)
              }}
              onCancel={() => setEditingMeta(false)}
            />
          </div>
        )}

        {previewMode ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-lg mx-auto">
            <h3 className="font-bold text-gray-900 text-center mb-6">Participant Preview</h3>
            {pages.length === 0 ? (
              <p className="text-gray-400 text-center">No pages to preview.</p>
            ) : (
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
          </div>
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  )
}
