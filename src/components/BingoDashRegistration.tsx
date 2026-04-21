import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BingoTeam } from '../types/database'

interface BingoDashRegistrationProps {
  onRegister: (teamName: string, password: string) => Promise<unknown>
  hexCode: string
  taskTitle: string
}

export function BingoDashRegistration({ onRegister, hexCode, taskTitle }: BingoDashRegistrationProps) {
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BingoTeam | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: settings } = await supabase
        .from('bingo_settings').select('active_section_id').eq('id', 'main').single()
      const sectionId = settings?.active_section_id
      if (!sectionId) { setLoadingTeams(false); return }
      const { data } = await supabase
        .from('bingo_teams').select('*').eq('section_id', sectionId).order('name')
      setTeams(data ?? [])
      setLoadingTeams(false)
    })()
  }, [])

  const filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    setError('')
    try {
      await onRegister(selected.name, password.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join team')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: `linear-gradient(135deg, ${hexCode}22, ${hexCode}44)` }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
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
        <p className="text-gray-400 text-center text-sm mb-6">
          {selected ? `Enter your team password to join` : 'Find and select your team'}
        </p>

        {!selected ? (
          /* ── Team picker ── */
          <div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search teams..."
              className="w-full px-4 py-3 rounded-2xl border-2 text-base font-medium focus:outline-none transition-colors mb-3"
              style={{ borderColor: search ? hexCode : '#e5e7eb' }}
              autoFocus
            />

            {loadingTeams ? (
              <div className="py-8 text-center text-gray-300 font-bold animate-pulse">Loading teams...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-300 font-bold">
                {teams.length === 0 ? 'No teams registered yet.' : 'No teams match your search.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                {filtered.map(team => (
                  <button
                    key={team.id}
                    onClick={() => { setSelected(team); setError('') }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border-2 border-gray-100 hover:border-gray-300 text-left transition-all hover:bg-gray-50 active:scale-[0.98]"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-sm"
                      style={{ backgroundColor: hexCode }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-900 truncate">{team.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Password entry ── */
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setSelected(null); setPassword(''); setError('') }}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-1"
            >
              ← Back to team list
            </button>

            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2"
              style={{ borderColor: hexCode, backgroundColor: `${hexCode}10` }}
            >
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-black text-sm"
                style={{ backgroundColor: hexCode }}
              >
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-black text-gray-900">{selected.name}</span>
            </div>

            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Team password..."
              className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
              style={{ borderColor: password ? hexCode : '#e5e7eb' }}
              autoFocus
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
              disabled={!password.trim() || submitting}
              className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95 mt-1"
              style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
            >
              {submitting ? 'Joining...' : 'Start Challenge →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
