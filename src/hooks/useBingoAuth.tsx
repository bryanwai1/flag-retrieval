import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { BingoAccount } from '../types/database'

interface BingoAuthValue {
  session: Session | null
  account: BingoAccount | null
  /** Host account row when this login is a facilitator (facilitator_host set). */
  hostAccount: BingoAccount | null
  loading: boolean
  isOwner: boolean
  isApproved: boolean
  isFacilitator: boolean
  /** access_expires_at has passed — RequireBingoAdmin shows the expired gate. */
  isExpired: boolean
  /**
   * The owner_id value this session reads/writes tenant rows with:
   * owner -> null (house data), facilitator -> the host tenant's value
   * (null when the host is the owner), sub -> own uid.
   */
  workingOwnerValue: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshAccount: () => Promise<void>
}

const BingoAuthContext = createContext<BingoAuthValue | null>(null)

export function BingoAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<BingoAccount | null>(null)
  const [hostAccount, setHostAccount] = useState<BingoAccount | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAccount = useCallback(async (userId: string | undefined) => {
    if (!userId) { setAccount(null); setHostAccount(null); return }
    const { data } = await supabase
      .from('bingo_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    const acct = (data as BingoAccount) ?? null
    // Facilitators need the host row before workingOwnerValue is trustworthy,
    // so fetch it here — the initial-load gate keeps loading=true until then.
    if (acct?.facilitator_host) {
      const { data: host } = await supabase
        .from('bingo_accounts')
        .select('*')
        .eq('id', acct.facilitator_host)
        .maybeSingle()
      setHostAccount((host as BingoAccount) ?? null)
    } else {
      setHostAccount(null)
    }
    setAccount(acct)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      // getSession() can throw a transient Navigator LockManager error when
      // another tab of the app steals the auth-token lock; retry, and always
      // resolve the loading gate so the admin never hangs on "Loading...".
      let initialSession: Session | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data } = await supabase.auth.getSession()
          initialSession = data.session
          break
        } catch {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
      if (!active) return
      setSession(initialSession)
      try {
        await loadAccount(initialSession?.user.id)
      } catch {
        // leave account null; RequireBingoAdmin will show the login gate
      }
      if (active) setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      try {
        await loadAccount(newSession?.user.id)
      } catch {
        // transient fetch failure; keep previous account state
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadAccount])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) throw error
    // When email confirmation is ON, Supabase returns a user with no active session.
    return { needsConfirmation: !data.session }
  }, [])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    // Default to the page the login gate rendered on, so Flag Retrieval's
    // /admin comes back to /admin instead of the bingo admin.
    const path = redirectTo ?? window.location.pathname
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${path}` },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAccount(null)
    setHostAccount(null)
  }, [])

  const refreshAccount = useCallback(() => loadAccount(session?.user.id), [loadAccount, session])

  const isFacilitator = !!account?.facilitator_host
  const value: BingoAuthValue = {
    session,
    account,
    hostAccount,
    loading,
    isOwner: account?.role === 'owner' && account?.status === 'approved',
    isApproved: account?.status === 'approved',
    isFacilitator,
    isExpired: !!account?.access_expires_at && new Date(account.access_expires_at).getTime() <= Date.now(),
    workingOwnerValue: !account
      ? null
      : account.role === 'owner'
        ? null
        : account.facilitator_host
          ? (hostAccount?.role === 'owner' ? null : account.facilitator_host)
          : account.id,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signOut,
    refreshAccount,
  }

  return <BingoAuthContext.Provider value={value}>{children}</BingoAuthContext.Provider>
}

export function useBingoAuth(): BingoAuthValue {
  const ctx = useContext(BingoAuthContext)
  if (!ctx) throw new Error('useBingoAuth must be used within a BingoAuthProvider')
  return ctx
}
