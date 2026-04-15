import { useState } from 'react'

interface BingoDashRegistrationProps {
  onRegister: (teamName: string, password: string) => Promise<unknown>
  hexCode: string
  taskTitle: string
}

export function BingoDashRegistration({ onRegister, hexCode, taskTitle }: BingoDashRegistrationProps) {
  const [teamName, setTeamName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onRegister(teamName.trim(), password.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register team')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, ${hexCode}22, ${hexCode}44)` }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center animate-wiggle"
          style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
        >
          <span className="text-2xl">🎯</span>
        </div>

        <p className="text-xs font-bold text-center uppercase tracking-widest mb-1" style={{ color: hexCode }}>
          {taskTitle}
        </p>
        <h1 className="text-3xl font-black text-center text-gray-900 mb-1">Join Challenge</h1>
        <p className="text-gray-400 text-center text-sm mb-7">
          Enter your team name and password to access this challenge
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={teamName}
            onChange={(e) => { setTeamName(e.target.value); setError('') }}
            placeholder="Team name..."
            className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
            style={{ borderColor: teamName ? hexCode : '#e5e7eb' }}
            autoFocus
            maxLength={40}
            disabled={submitting}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="Password..."
            className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
            style={{ borderColor: password ? hexCode : '#e5e7eb' }}
            maxLength={40}
            disabled={submitting}
          />

          {error && (
            <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span>🚫</span>
              <p className="text-red-600 font-bold text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!teamName.trim() || submitting}
            className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95 mt-1"
            style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
          >
            {submitting ? 'Joining...' : 'Start Challenge →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-5">
          Already have a team? Use the same name and password to re-join.
        </p>
      </div>
    </div>
  )
}
