import { useState, useEffect, useRef } from 'react'
import type { TribeResult } from '../hooks/useCurrentTeam'
import { T, useT } from './T'
import { LanguageToggle } from './LanguageToggle'

interface TeamRegistrationProps {
  onCreateTribe: (tribeName: string, memberName: string, password: string) => Promise<unknown>
  onJoinTribe: (teamId: string, memberName: string, password: string) => Promise<unknown>
  onSearchTribes: (query: string) => Promise<TribeResult[]>
  hexCode: string
  taskTitle: string
}

type Step =
  | 'list'         // default — pick a tribe to join
  | 'password'     // enter 4-digit code for selected tribe
  | 'join-name'    // enter your name → join
  | 'create-tribe' // (settings path) name your new tribe
  | 'created'      // show auto-generated code
  | 'create-name'  // enter creator's name → create

export function TeamRegistration({
  onCreateTribe,
  onJoinTribe,
  onSearchTribes,
  hexCode,
  taskTitle,
}: TeamRegistrationProps) {
  const [step, setStep] = useState<Step>('list')
  const [memberName, setMemberName] = useState('')
  const [tribeName, setTribeName] = useState('')
  const [createdPassword, setCreatedPassword] = useState('')
  const [selectedTribe, setSelectedTribe] = useState<TribeResult | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tribes, setTribes] = useState<TribeResult[]>([])
  const [tribesLoading, setTribesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tribeNameTaken, setTribeNameTaken] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const yourNamePlaceholder = useT('Your name...')
  const tribeNamePlaceholder = useT('Tribe name...')
  const searchTribesPlaceholder = useT('Search tribes...')
  const wrongCodeMsg = useT('Wrong code — ask your tribe creator for the right one')
  const tribeFullMsg = useT('That tribe is already full. Pick another one.')
  const joinFailedMsg = useT('Failed to join tribe')

  // Load all tribes on enter list step
  useEffect(() => {
    if (step === 'list') {
      setTribesLoading(true)
      onSearchTribes('').then((results) => {
        setTribes(results)
        setTribesLoading(false)
      })
    }
  }, [step])

  // Debounced search
  useEffect(() => {
    if (step !== 'list') return
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setTribesLoading(true)
      onSearchTribes(searchQuery).then((results) => {
        setTribes(results)
        setTribesLoading(false)
      })
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery])

  // ── Join: pick tribe → enter password → enter name ───────────────
  const handleSelectTribe = (tribe: TribeResult) => {
    setSelectedTribe(tribe)
    setPasswordInput('')
    setError('')
    setStep('password')
  }

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTribe || passwordInput.length !== 4) return
    setError('')
    setMemberName('')
    setStep('join-name')
  }

  const handleSubmitJoinName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTribe || !memberName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onJoinTribe(selectedTribe.id, memberName.trim(), passwordInput)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'WRONG_PASSWORD') {
        setError(wrongCodeMsg)
        setStep('password')
      } else if (err instanceof Error && err.message === 'TRIBE_FULL') {
        setError(tribeFullMsg)
        setStep('list')
      } else {
        setError(err instanceof Error ? err.message : joinFailedMsg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Create (settings path): tribe name → code → your name ────────
  const handleCheckTribeName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tribeName.trim()) return
    const password = String(Math.floor(1000 + Math.random() * 9000))
    setCreatedPassword(password)
    setTribeNameTaken(false)
    setError('')
    setStep('created')
  }

  const handleConfirmCreatedCode = () => {
    setMemberName('')
    setError('')
    setStep('create-name')
  }

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onCreateTribe(tribeName.trim(), memberName.trim(), createdPassword)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'TRIBE_NAME_TAKEN') {
        setTribeNameTaken(true)
        setStep('create-tribe')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create tribe')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step: tribe list (default) ───────────────────────────────────
  if (step === 'list') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in flex flex-col" style={{ maxHeight: '85vh' }}>
          <Flag hexCode={hexCode} />
          <p className="text-xs font-bold text-center uppercase tracking-widest mb-1" style={{ color: hexCode }}>
            <T>{taskTitle}</T>
          </p>
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Pick your tribe</T></h1>
          <p className="text-gray-400 text-center text-sm mb-5"><T>Find your tribe, then enter the code to join</T></p>

          {/* Search */}
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchTribesPlaceholder}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 font-medium focus:outline-none transition-colors"
              style={{ borderColor: searchQuery ? hexCode : '#e5e7eb' }}
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

          {/* Tribe list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {tribesLoading ? (
              <p className="text-center text-gray-400 py-8 animate-pulse"><T>Searching...</T></p>
            ) : tribes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 font-medium"><T>No tribes found</T></p>
                <p className="text-gray-300 text-sm mt-1">
                  <T>{searchQuery ? 'Try a different search' : 'Ask your facilitator, or start one in settings below.'}</T>
                </p>
              </div>
            ) : (
              tribes.map((tribe) => (
                <button
                  key={tribe.id}
                  onClick={() => handleSelectTribe(tribe)}
                  disabled={submitting}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-gray-100 hover:border-current transition-colors text-left disabled:opacity-50"
                  style={{ color: hexCode }}
                >
                  <div>
                    <p className="font-bold text-gray-800">{tribe.name}</p>
                    <p className="text-xs text-gray-400">
                      {tribe.memberCount} <T>members</T>
                    </p>
                  </div>
                  <span
                    className="px-4 py-2 rounded-xl text-white text-sm font-black"
                    style={{ backgroundColor: hexCode }}
                  >
                    <T>Join</T>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Settings: start a new tribe */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setTribeName(''); setTribeNameTaken(false); setError(''); setStep('create-tribe') }}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              <span>⚙️</span>
              <T>Settings — Start a new tribe</T>
            </button>
          </div>
        </div>
      </Wrapper>
    )
  }

  // ── Step: enter password ─────────────────────────────────────────
  if (step === 'password') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Enter Tribe Code</T></h1>
          <p className="font-bold text-center text-lg mb-1" style={{ color: hexCode }}>{selectedTribe?.name}</p>
          <p className="text-gray-400 text-center text-sm mb-6">
            <T>Ask your tribe creator for their 4-digit code</T>
          </p>
          <form onSubmit={handleSubmitPassword} className="flex flex-col gap-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                setError('')
              }}
              placeholder="• • • •"
              className="w-full px-5 py-4 rounded-2xl border-2 text-4xl font-black focus:outline-none transition-colors text-center tracking-[0.6em]"
              style={{ borderColor: passwordInput.length === 4 ? hexCode : '#e5e7eb' }}
              autoFocus
              maxLength={4}
            />
            {error && (
              <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span>🚫</span>
                <p className="text-red-600 font-bold text-sm">{error}</p>
              </div>
            )}
            <PrimaryButton hexCode={hexCode} disabled={passwordInput.length !== 4}>
              <T>Next →</T>
            </PrimaryButton>
          </form>
          <BackButton onClick={() => { setStep('list'); setPasswordInput(''); setError('') }} />
        </div>
      </Wrapper>
    )
  }

  // ── Step: enter member name → join ───────────────────────────────
  if (step === 'join-name') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <p className="text-xs font-bold text-center uppercase tracking-widest mb-1" style={{ color: hexCode }}>
            <T>Joining</T> · {selectedTribe?.name}
          </p>
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>What's your name?</T></h1>
          <p className="text-gray-400 text-center text-sm mb-7"><T>Shown to your tribe and on the leaderboard</T></p>
          <form onSubmit={handleSubmitJoinName} className="flex flex-col gap-4">
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder={yourNamePlaceholder}
              className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
              style={{ borderColor: memberName ? hexCode : '#e5e7eb' }}
              autoFocus
              maxLength={40}
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <PrimaryButton hexCode={hexCode} disabled={!memberName.trim()} loading={submitting}>
              <T>{submitting ? 'Joining...' : 'Join Tribe 🏴'}</T>
            </PrimaryButton>
          </form>
          <BackButton onClick={() => setStep('password')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step: name the tribe (create flow) ───────────────────────────
  if (step === 'create-tribe') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Name your tribe</T></h1>
          <p className="text-gray-400 text-center text-sm mb-7">
            <T>You'll be the creator. Others can join with the code.</T>
          </p>
          <form onSubmit={handleCheckTribeName} className="flex flex-col gap-4">
            <input
              type="text"
              value={tribeName}
              onChange={(e) => { setTribeName(e.target.value); setTribeNameTaken(false) }}
              placeholder={tribeNamePlaceholder}
              className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
              style={{
                borderColor: tribeNameTaken ? '#ef4444' : tribeName ? hexCode : '#e5e7eb',
                backgroundColor: tribeNameTaken ? '#fef2f2' : undefined,
              }}
              autoFocus
              maxLength={40}
            />
            {tribeNameTaken && (
              <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span>🚫</span>
                <div>
                  <p className="text-red-600 font-bold text-sm leading-tight">"{tribeName}" <T>is already taken</T></p>
                  <p className="text-red-400 text-xs"><T>Try a different tribe name</T></p>
                </div>
              </div>
            )}
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <PrimaryButton hexCode={hexCode} disabled={!tribeName.trim()}>
              <T>Next →</T>
            </PrimaryButton>
          </form>
          <BackButton onClick={() => setStep('list')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step: show generated tribe code ──────────────────────────────
  if (step === 'created') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Tribe Code Ready!</T> 🔐</h1>
          <p className="font-bold text-center text-lg mb-1" style={{ color: hexCode }}>{tribeName}</p>
          <p className="text-gray-400 text-center text-sm mb-6">
            <T>Share this code with your teammates so they can join</T>
          </p>

          <div className="flex justify-center gap-3 mb-6">
            {createdPassword.split('').map((digit, i) => (
              <div
                key={i}
                className="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white select-all"
                style={{ backgroundColor: hexCode, boxShadow: `0 6px 16px ${hexCode}44` }}
              >
                {digit}
              </div>
            ))}
          </div>

          <div
            className="text-center text-xs font-bold uppercase tracking-wider mb-6 py-2 px-4 rounded-xl"
            style={{ backgroundColor: `${hexCode}15`, color: hexCode }}
          >
            <T>Members need this code to join</T>
          </div>

          <PrimaryButton hexCode={hexCode} onClick={handleConfirmCreatedCode}>
            <T>Next →</T>
          </PrimaryButton>
          <BackButton onClick={() => setStep('create-tribe')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step: creator's name → create tribe ──────────────────────────
  return (
    <Wrapper hexCode={hexCode}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
        <Flag hexCode={hexCode} />
        <p className="text-xs font-bold text-center uppercase tracking-widest mb-1" style={{ color: hexCode }}>
          <T>Creating</T> · {tribeName}
        </p>
        <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>What's your name?</T></h1>
        <p className="text-gray-400 text-center text-sm mb-7"><T>As the creator, you'll appear first in the tribe</T></p>
        <form onSubmit={handleSubmitCreate} className="flex flex-col gap-4">
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder={yourNamePlaceholder}
            className="w-full px-5 py-4 rounded-2xl border-2 text-xl font-medium focus:outline-none transition-colors text-center"
            style={{ borderColor: memberName ? hexCode : '#e5e7eb' }}
            autoFocus
            maxLength={40}
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <PrimaryButton hexCode={hexCode} disabled={!memberName.trim()} loading={submitting}>
            <T>{submitting ? 'Creating...' : 'Create Tribe & Start →'}</T>
          </PrimaryButton>
        </form>
        <BackButton onClick={() => setStep('created')} />
      </div>
    </Wrapper>
  )
}

// ── Shared sub-components ────────────────────────────────────────────

function Wrapper({ hexCode, children }: { hexCode: string; children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: `linear-gradient(135deg, ${hexCode}22, ${hexCode}44)` }}
    >
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle variant="light" />
      </div>
      {children}
    </div>
  )
}

function Flag({ hexCode }: { hexCode: string }) {
  return (
    <div
      className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center animate-wiggle"
      style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
    >
      <span className="text-2xl">🚩</span>
    </div>
  )
}

function PrimaryButton({
  hexCode,
  disabled,
  loading,
  children,
  onClick,
}: {
  hexCode: string
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95"
      style={{ backgroundColor: hexCode, boxShadow: `0 8px 24px ${hexCode}44` }}
    >
      {children}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
    >
      ← <T>Back</T>
    </button>
  )
}
