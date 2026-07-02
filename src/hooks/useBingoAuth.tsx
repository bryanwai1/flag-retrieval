import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { BingoAccount } from '../types/database'

interface BingoAuthValue {
  session: Session | null
  account: BingoAccount | null
  loading: boolean
  isOwner: boolean
  isApproved: boolean
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
  const [loading, setLoading] = useState(true)

  const loadAccount = useCallback(async (userId: string | undefined) => {
    if (!userId) { setAccount(null); return }
    const { data } = await supabase
      .from('bingo_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setAccount((data as BingoAccount) ?? null)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      await loadAccount(data.session?.user.id)
      setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      await loadAccount(newSession?.user.id)
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
  }, [])

  const refreshAccount = useCallback(() => loadAccount(session?.user.id), [loadAccount, session])

  const value: BingoAuthValue = {
    session,
    account,
    loading,
    isOwner: account?.role === 'owner' && account?.status === 'approved',
    isApproved: account?.status === 'approved',
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
