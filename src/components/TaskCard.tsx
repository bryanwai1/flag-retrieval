import type { Task } from '../types/database'

interface TaskCardProps {
  task: Task
  size?: 'large' | 'small'
  onClick?: () => void
  children?: React.ReactNode
}

export function TaskCard({ task, size = 'large', onClick, children }: TaskCardProps) {
  const isLarge = size === 'large'

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-3xl text-white cursor-pointer
        transition-all duration-300 hover:scale-110 hover:-rotate-2
        animate-pulse-glow
        ${isLarge ? 'px-10 py-14 min-w-[220px]' : 'px-6 py-8 min-w-[160px]'}
      `}
      style={{
        backgroundColor: task.hex_code,
        textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        boxShadow: `0 8px 32px ${task.hex_code}66`,
      }}
    >
      <div className="absolute inset-0 rounded-3xl bg-white/10 opacity-0 hover:opacity-100 transition-opacity duration-300" />
      <div className={`font-black ${isLarge ? 'text-5xl' : 'text-2xl'} tracking-tight relative z-10`}>
        {task.title}
      </div>
      <div className={`mt-2 font-bold uppercase tracking-[0.2em] relative z-10 ${isLarge ? 'text-lg opacity-90' : 'text-sm opacity-80'}`}>
        {task.color} FLAG
      </div>
      {isLarge && (
        <div className="mt-4 text-sm opacity-70 relative z-10">
          Tap to show QR code
        </div>
      )}
      {children && <div className="mt-4 relative z-10">{children}</div>}
    </div>
  )
}
