import { useState } from 'react'

interface TeamRegistrationProps {
  onRegister: (name: string) => Promise<void>
  hexCode: string
  taskTitle: string
}

export function TeamRegistration({ onRegister, hexCode, taskTitle }: TeamRegistrationProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onRegister(name.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, ${hexCode}22, ${hexCode}44)` }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full animate-bounce-in">
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-wiggle"
          style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
        >
          <span className="text-3xl">🚩</span>
        </div>
        <h2 className="text-xl font-bold text-center text-gray-500 mb-1">{taskTitle}</h2>
        <h1 className="text-3xl font-black text-center text-gray-900 mb-2">
          Join the Challenge!
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Enter your team name to start
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your team name..."
            className="px-5 py-4 rounded-2xl border-2 border-gray-200 text-xl font-medium focus:outline-none focus:border-current transition-colors text-center"
            style={{ '--tw-border-opacity': 1, borderColor: name ? hexCode : undefined } as React.CSSProperties}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="px-8 py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: hexCode,
              boxShadow: `0 8px 24px ${hexCode}44`,
            }}
          >
            {submitting ? 'Joining...' : "LET'S GO! 🔥"}
          </button>
        </form>
      </div>
    </div>
  )
}
