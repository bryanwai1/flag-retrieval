import { useRef, useState } from 'react'
import { useBingoAuth } from '../hooks/useBingoAuth'
import { ParticleBackground } from '../components/ParticleBackground'

/**
 * Event-day shortcut.
 *
 * On the day, signing in through Google is the thing most likely to go wrong —
 * wrong account picked, popup blocked, someone else's session already on the
 * laptop. This signs straight into the shared event account instead.
 *
 * Configure with two build-time vars:
 *   VITE_EVENT_LOGIN_EMAIL     the account to sign in as
 *   VITE_EVENT_LOGIN_PASSWORD  its password — optional
 *
 * With both set, the button is a single tap. With only the email set, it fills
 * the address and leaves the password to be typed.
 *
 * ⚠️ Vite inlines VITE_* values into the built JavaScript, which is public. A
 * password set here is readable by anyone who opens the site — treat it as
 * published, not secret. Keep the blast radius small: point this at a
 * facilitator account (never the owner, so it cannot reach the Accounts page)
 * with access_expires_at set to just after the event, so an extracted password
 * stops working on its own. Rotate it after each event.
 */
const EVENT_LOGIN_EMAIL = (import.meta.env.VITE_EVENT_LOGIN_EMAIL as string | undefined)?.trim() ?? ''
const EVENT_LOGIN_PASSWORD = (import.meta.env.VITE_EVENT_LOGIN_PASSWORD as string | undefined) ?? ''
const LAST_EMAIL_KEY = 'bingo_last_login_email'

function readLastLoginEmail(): string {
  try { return localStorage.getItem(LAST_EMAIL_KEY)?.trim() ?? '' } catch { return '' }
}

export function BingoDashLogin() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useBingoAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)
  // Read once on mount: a device that has signed in before can offer that
  // account even when no build-time email is configured.
  const [eventEmail] = useState(() => EVENT_LOGIN_EMAIL || readLastLoginEmail())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
        // Remember what worked, so the next event-day login on this device is
        // one tap even if no email was configured at build time.
        try { localStorage.setItem(LAST_EMAIL_KEY, email.trim()) } catch { /* private mode — skip */ }
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

  // One tap when both vars are configured; otherwise fill the address and let
  // the password be typed. The configured pair is used together — pairing a
  // configured password with a remembered address would just fail.
  const oneTap = !!(EVENT_LOGIN_EMAIL && EVENT_LOGIN_PASSWORD)

  const handleEventLogin = async () => {
    setMode('login'); setError(''); setNotice('')
    if (!oneTap) { setEmail(eventEmail); passwordRef.current?.focus(); return }
    setEmail(EVENT_LOGIN_EMAIL); setPassword(EVENT_LOGIN_PASSWORD)
    setBusy(true)
    try {
      await signInWithPassword(EVENT_LOGIN_EMAIL, EVENT_LOGIN_PASSWORD)
      try { localStorage.setItem(LAST_EMAIL_KEY, EVENT_LOGIN_EMAIL) } catch { /* private mode */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Event login failed')
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
          {mode === 'login' && (oneTap || eventEmail) && (
            <>
              <button
                type="button" onClick={handleEventLogin} disabled={busy}
                className="w-full py-3.5 rounded-2xl font-black uppercase tracking-wider text-sm
                  bg-amber-400 text-gray-900 hover:bg-amber-300 active:scale-95 transition-all
                  disabled:opacity-50"
              >
                {busy && oneTap ? 'Signing in…' : '🎪 Marshal login'}
              </button>
              <p className="text-gray-400 text-xs text-center mt-2 mb-4 break-all">
                {oneTap
                  ? 'Shared event account — no sign-up, no approval needed.'
                  : <>Fills in <b className="text-gray-300">{eventEmail}</b> — just type the password.</>}
              </p>
            </>
          )}

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
              ref={passwordRef}
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
