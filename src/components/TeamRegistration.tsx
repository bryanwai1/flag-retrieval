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

type Step = 'name' | 'choose' | 'create' | 'created' | 'join' | 'password'

export function TeamRegistration({
  onCreateTribe,
  onJoinTribe,
  onSearchTribes,
  hexCode,
  taskTitle,
}: TeamRegistrationProps) {
  const [step, setStep] = useState<Step>('name')
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

  // Load all tribes on enter join step
  useEffect(() => {
    if (step === 'join') {
      setTribesLoading(true)
      onSearchTribes('').then((results) => {
        setTribes(results)
        setTribesLoading(false)
      })
    }
  }, [step])

  // Debounced search
  useEffect(() => {
    if (step !== 'join') return
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

  const handleNameNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) return
    setStep('choose')
  }

  // Step 3a: Validate name locally, generate password, show 'created' step
  const handleCheckTribeName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tribeName.trim()) return
    const password = String(Math.floor(1000 + Math.random() * 9000))
    setCreatedPassword(password)
    setTribeNameTaken(false)
    setError('')
    setStep('created')
  }

  // Step 'created': Confirm and actually create the tribe in DB
  const handleConfirmCreate = async () => {
    setSubmitting(true)
    setError('')
    try {
      await onCreateTribe(tribeName.trim(), memberName.trim(), createdPassword)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'TRIBE_NAME_TAKEN') {
        setTribeNameTaken(true)
        setStep('create')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create tribe')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Step 'join': Select tribe → go to password step
  const handleSelectTribeForJoin = (tribe: TribeResult) => {
    setSelectedTribe(tribe)
    setPasswordInput('')
    setError('')
    setStep('password')
  }

  // Step 'password': Verify password and join
  const handleJoinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTribe || passwordInput.length !== 4) return
    setSubmitting(true)
    setError('')
    try {
      await onJoinTribe(selectedTribe.id, memberName.trim(), passwordInput)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'WRONG_PASSWORD') {
        setError(wrongCodeMsg)
      } else if (err instanceof Error && err.message === 'TRIBE_FULL') {
        setError(tribeFullMsg)
        setStep('join')
      } else {
        setError(err instanceof Error ? err.message : joinFailedMsg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step 1: Enter name ──────────────────────────────────────────────
  if (step === 'name') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <p className="text-xs font-bold text-center uppercase tracking-widest mb-1" style={{ color: hexCode }}>
            <T>{taskTitle}</T>
          </p>
          <h1 className="text-3xl font-black text-center text-gray-900 mb-1"><T>What's your name?</T></h1>
          <p className="text-gray-400 text-center text-sm mb-7"><T>You'll use this to join or create a tribe</T></p>
          <form onSubmit={handleNameNext} className="flex flex-col gap-4">
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
            <PrimaryButton hexCode={hexCode} disabled={!memberName.trim()}>
              <T>Next →</T>
            </PrimaryButton>
          </form>
        </div>
      </Wrapper>
    )
  }

  // ── Step 2: Choose create or join ───────────────────────────────────
  if (step === 'choose') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1">
            <T>Hi</T> {memberName}! 👋
          </h1>
          <p className="text-gray-400 text-center text-sm mb-7"><T>Do you want to start a new tribe or join one?</T></p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep('create')}
              className="w-full py-5 rounded-2xl text-white font-black text-lg transition-all hover:scale-105 active:scale-95"
              style={{ backgroundColor: hexCode, boxShadow: `0 6px 20px ${hexCode}44` }}
            >
              🏴 <T>Start a Tribe</T>
            </button>
            <button
              onClick={() => setStep('join')}
              className="w-full py-5 rounded-2xl font-black text-lg border-2 transition-all hover:scale-105 active:scale-95"
              style={{ color: hexCode, borderColor: hexCode, backgroundColor: `${hexCode}10` }}
            >
              🔍 <T>Join a Tribe</T>
            </button>
          </div>
          <BackButton onClick={() => setStep('name')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step 3a: Name the tribe ─────────────────────────────────────────
  if (step === 'create') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Name your tribe</T></h1>
          <p className="text-gray-400 text-center text-sm mb-7">
            <T>You'll be the creator. Up to 3 others can join.</T>
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
          <BackButton onClick={() => setStep('choose')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step 3b: Show generated tribe code ──────────────────────────────
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

          {/* Password display */}
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

          {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

          <PrimaryButton hexCode={hexCode} loading={submitting} onClick={handleConfirmCreate}>
            <T>{submitting ? 'Creating...' : 'Create Tribe & Start →'}</T>
          </PrimaryButton>
          <BackButton onClick={() => setStep('create')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step 4a: Join tribe — browse list ───────────────────────────────
  if (step === 'join') {
    return (
      <Wrapper hexCode={hexCode}>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in flex flex-col" style={{ maxHeight: '85vh' }}>
          <Flag hexCode={hexCode} />
          <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Join a Tribe</T></h1>
          <p className="text-gray-400 text-center text-sm mb-5"><T>Find your tribe, then enter the code</T></p>

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
                  <T>{searchQuery ? 'Try a different search' : 'Be the first to create one!'}</T>
                </p>
              </div>
            ) : (
              tribes.map((tribe) => (
                <div
                  key={tribe.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-gray-100 hover:border-current transition-colors"
                >
                  <div>
                    <p className="font-bold text-gray-800">{tribe.name}</p>
                    <p className="text-xs text-gray-400">
                      {tribe.memberCount} <T>members</T>
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectTribeForJoin(tribe)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-white text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: hexCode }}
                  >
                    <T>Join</T>
                  </button>
                </div>
              ))
            )}
          </div>

          <BackButton onClick={() => setStep('choose')} />
        </div>
      </Wrapper>
    )
  }

  // ── Step 4b: Enter tribe password ───────────────────────────────────
  return (
    <Wrapper hexCode={hexCode}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
        <Flag hexCode={hexCode} />
        <h1 className="text-2xl font-black text-center text-gray-900 mb-1"><T>Enter Tribe Code</T></h1>
        <p className="font-bold text-center text-lg mb-1" style={{ color: hexCode }}>{selectedTribe?.name}</p>
        <p className="text-gray-400 text-center text-sm mb-6">
          <T>Ask your tribe creator for their 4-digit code</T>
        </p>
        <form onSubmit={handleJoinWithPassword} className="flex flex-col gap-4">
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
          <PrimaryButton hexCode={hexCode} disabled={passwordInput.length !== 4} loading={submitting}>
            <T>{submitting ? 'Joining...' : 'Join Tribe 🏴'}</T>
          </PrimaryButton>
        </form>
        <BackButton onClick={() => { setStep('join'); setPasswordInput(''); setError('') }} />
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
