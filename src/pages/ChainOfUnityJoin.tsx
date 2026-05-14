import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import type { ChainGroup } from '../types/database'

type Status = 'loading' | 'invalid' | 'join' | 'instructions' | 'error'

const SCANNER_KEY = 'chain-of-unity-scanner-id'
const joinedKey = (code: string) => `chain-of-unity-joined-${code}`

function getScannerId(): string {
  let id = localStorage.getItem(SCANNER_KEY)
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(SCANNER_KEY, id)
  }
  return id
}

export function ChainOfUnityJoin() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = (rawCode ?? '').trim()
  const [status, setStatus] = useState<Status>('loading')
  const [group, setGroup] = useState<ChainGroup | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!code) { setStatus('invalid'); return }
      if (!isSupabaseConfigured) {
        setErrorMsg('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        setStatus('error')
        return
      }
      const { data, error } = await supabase
        .from('chain_groups')
        .select('*')
        .eq('code', code)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setErrorMsg(error.message)
        setStatus('error')
        return
      }
      if (!data) {
        setStatus('invalid')
        return
      }
      setGroup(data as ChainGroup)
      if (localStorage.getItem(joinedKey(code))) {
        setStatus('instructions')
      } else {
        setStatus('join')
      }
    }
    run()
    return () => { cancelled = true }
  }, [code])

  const handleJoin = async () => {
    if (!group) return
    setJoining(true)
    const { error } = await supabase
      .from('chain_scans')
      .insert({ group_id: group.id, scanner_id: getScannerId() })
    setJoining(false)
    if (error) {
      alert(`Couldn't record your scan: ${error.message}`)
      return
    }
    localStorage.setItem(joinedKey(group.code), new Date().toISOString())
    setStatus('instructions')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
      <ParticleBackground />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        {status === 'loading' && (
          <Centered>
            <div className="animate-pulse text-gray-400">Loading your group…</div>
          </Centered>
        )}

        {status === 'invalid' && (
          <Centered>
            <div className="text-7xl mb-3">⛓️</div>
            <h1 className="text-3xl font-black mb-2">QR code not recognised</h1>
            <p className="text-gray-400 max-w-md">
              This link isn't tied to a Chain of Unity group. Ask your facilitator to show you a fresh QR from the admin dashboard.
            </p>
            <Link to="/" className="mt-6 inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm">
              &larr; Back to Game Hub
            </Link>
          </Centered>
        )}

        {status === 'error' && (
          <Centered>
            <div className="text-7xl mb-3">⚠️</div>
            <h1 className="text-3xl font-black mb-2">Something went wrong</h1>
            <p className="text-gray-400 max-w-md break-words">{errorMsg}</p>
            <Link to="/" className="mt-6 inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm">
              &larr; Back to Game Hub
            </Link>
          </Centered>
        )}

        {status === 'join' && group && (
          <Centered>
            <div className="text-7xl mb-4 animate-float">⛓️</div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">Chain of Unity</p>
            <h1 className="text-3xl sm:text-4xl font-black mb-4">You're joining…</h1>
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-orange-500/15 border border-orange-400/40 text-orange-200 mb-5">
              <span className="text-[10px] uppercase tracking-widest text-orange-300/80 font-bold">Group</span>
              <span className="font-bold text-white">{group.name}</span>
            </div>
            <p className="text-gray-400 max-w-md mb-6">
              Tap below to lock in your spot. Then read your <strong className="text-white">6 rules of the chain</strong> before your first station.
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full max-w-sm py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black rounded-2xl font-black text-base tracking-wide transition-all hover:scale-[1.02]"
            >
              {joining ? 'Joining…' : "I'm in — show me the rules →"}
            </button>
            <p className="text-xs text-gray-500 mt-4 max-w-md">
              Your scan appears live on the facilitator's dashboard.
            </p>
          </Centered>
        )}

        {status === 'instructions' && group && (
          <div className="animate-slide-up">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">⛓️ The Rules of the Chain</p>
              <h1 className="text-3xl sm:text-4xl font-black mb-2">
                Welcome aboard, <span className="text-orange-300">{group.name}</span>.
              </h1>
              <p className="text-gray-400 max-w-xl mx-auto">
                You're tied together for the whole event. Read these <strong className="text-white">6 rules</strong> before your first station.
              </p>
            </div>

            <ol className="space-y-3">
              <Rule n={1} title="Stay tied — move as ONE.">
                One person moves, everyone moves. You're a single synchronized unit through every station.
              </Rule>
              <Rule n={2} title="Rest as ONE.">
                One person rests, everyone rests. No splitting up — this is <em>not</em> flag retrieval.
              </Rule>
              <Rule n={3} title="Plan together — 10 minutes max per station.">
                Within each 10-minute window, decide what your team can realistically attempt and finish.
              </Rule>
              <Rule n={4} title="Every member participates.">
                Completion requires every team member to take part. Nobody sits out.
              </Rule>
              <Rule n={5} title="Mind the penalties (and the bonuses).">
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Tag tone="bad">Rope disconnects = 5-crate penalty</Tag>
                  <Tag tone="bad">Free hand used independently = task resets</Tag>
                  <Tag tone="good">Perfect rhythm = bonus crates</Tag>
                </div>
              </Rule>
              <Rule n={6} title="Done with a station? Find your marshal.">
                Show them the result. They'll record your points and your crates before you move on.
              </Rule>
            </ol>

            <div className="mt-6 rounded-2xl p-5 border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-rose-500/10">
              <h3 className="text-amber-200 font-black text-lg mb-1">🏴‍☠️ Claim your points</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Once your team completes a station, look for the <strong className="text-white">marshal at that station</strong> to award your points.
                Then head to the next one — still tied, still as one.
              </p>
            </div>

            <p className="text-center text-xs text-gray-500 mt-8">
              Keep this page open — refer back any time. Good luck, crew.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
      {children}
    </div>
  )
}

function Rule({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-14 pr-4 py-4 rounded-xl bg-white/5 border border-white/10">
      <span
        className="absolute left-3 top-3.5 w-8 h-8 rounded-full flex items-center justify-center font-black text-black text-sm"
        style={{ background: 'linear-gradient(135deg, #fb923c, #f43f5e)' }}
      >
        {n}
      </span>
      <div className="font-bold text-white mb-1">{title}</div>
      <div className="text-gray-300 text-sm leading-relaxed">{children}</div>
    </li>
  )
}

function Tag({ tone, children }: { tone: 'good' | 'bad'; children: React.ReactNode }) {
  const cls =
    tone === 'good'
      ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
      : 'bg-rose-500/15 text-rose-200 border-rose-400/30'
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  )
}
