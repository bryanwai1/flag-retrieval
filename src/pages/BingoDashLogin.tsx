import { useState } from 'react'
import { useBingoAuth } from '../hooks/useBingoAuth'
import { ParticleBackground } from '../components/ParticleBackground'

export function BingoDashLogin() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useBingoAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password)
        if (needsConfirmation) {
          setNotice('Account created. Check your email to confirm, then sign in. An admin still needs to approve your access.')
          setMode('login')
        } else {
          setNotice('Account created — waiting for admin approval.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setBusy(true); setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <ParticleBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-white text-3xl font-black tracking-tight">Bingo Dash Admin</h1>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'Sign in to manage your boards' : 'Create an account'}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-gray-800 font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email" required value={email} autoComplete="email"
              onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="w-full px-4 py-3 rounded-2xl bg-black/30 border-2 border-white/15 text-white placeholder-white/30 focus:border-purple-500 outline-none transition-colors"
            />
            <input
              type="password" required value={password} minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={e => setPassword(e.target.value)} placeholder="Password"
              className="w-full px-4 py-3 rounded-2xl bg-black/30 border-2 border-white/15 text-white placeholder-white/30 focus:border-purple-500 outline-none transition-colors"
            />
            {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}
            {notice && <p className="text-green-300 text-sm font-medium text-center">{notice}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full py-3 rounded-2xl text-white font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}
            className="w-full text-center text-sm text-gray-400 hover:text-white mt-4 transition-colors"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
