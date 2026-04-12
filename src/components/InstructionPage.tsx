import type { TaskPage } from '../types/database'

interface InstructionPageProps {
  page: TaskPage
  hexCode: string
}

export function InstructionPage({ page, hexCode }: InstructionPageProps) {
  const pointers = [
    page.pointer_1, page.pointer_2, page.pointer_3,
    page.pointer_4, page.pointer_5, page.pointer_6,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      {page.media_url && (
        <div className="rounded-2xl overflow-hidden bg-gray-100 animate-slide-up shadow-lg">
          {page.media_type === 'video' ? (
            <video
              src={page.media_url}
              controls
              className="w-full max-h-[300px] object-contain"
            />
          ) : (
            <img
              src={page.media_url}
              alt="Instruction"
              className="w-full max-h-[300px] object-contain"
            />
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {pointers.map((pointer, i) => (
          <div
            key={i}
            className="flex items-start gap-3 animate-slide-up bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md"
              style={{
                backgroundColor: hexCode,
                boxShadow: `0 4px 12px ${hexCode}44`,
              }}
            >
              {i + 1}
            </div>
            <p className="text-gray-800 text-lg leading-relaxed font-medium pt-1.5">{pointer}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
