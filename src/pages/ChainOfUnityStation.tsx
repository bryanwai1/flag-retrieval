import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import type { ChainStation } from '../types/database'

type Status = 'loading' | 'invalid' | 'ready' | 'error'

const SCANNER_KEY = 'chain-of-unity-scanner-id'

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

export function ChainOfUnityStation() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = (rawCode ?? '').trim()
  const [status, setStatus] = useState<Status>('loading')
  const [station, setStation] = useState<ChainStation | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

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
        .from('chain_stations')
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
      const s = data as ChainStation
      setStation(s)
      setStatus('ready')

      // Fire-and-forget scan log. Don't block UI on failure.
      supabase
        .from('chain_station_scans')
        .insert({ station_id: s.id, scanner_id: getScannerId() })
        .then(({ error: scanErr }) => {
          if (scanErr) console.warn('chain_station_scans insert failed:', scanErr.message)
        })
    }
    run()
    return () => { cancelled = true }
  }, [code])

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
      <ParticleBackground />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        {status === 'loading' && (
          <Centered>
            <div className="animate-pulse text-gray-400">Loading station…</div>
          </Centered>
        )}

        {status === 'invalid' && (
          <Centered>
            <div className="text-7xl mb-3">⛓️</div>
            <h1 className="text-3xl font-black mb-2">Station not found</h1>
            <p className="text-gray-400 max-w-md">
              This QR isn't tied to an active station. Ask your facilitator to show you a fresh QR from the admin dashboard.
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

        {status === 'ready' && station && (
          <div className="animate-slide-up">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">⛓️ Chain of Unity · Station</p>
              <h1 className="text-3xl sm:text-4xl font-black">{station.title}</h1>
            </div>

            {station.image_url && (
              <div className="rounded-2xl overflow-hidden border border-white/10 mb-6 bg-black/40">
                <img
                  src={station.image_url}
                  alt={station.title}
                  className="w-full h-auto object-contain max-h-[60vh]"
                />
              </div>
            )}

            {station.body && (
              <div className="rounded-2xl p-5 sm:p-6 bg-white/5 border border-white/10 whitespace-pre-wrap text-gray-200 leading-relaxed">
                {station.body}
              </div>
            )}

            <div className="mt-6 rounded-2xl p-5 border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-rose-500/10">
              <h3 className="text-amber-200 font-black text-lg mb-1">🏴‍☠️ When you're done</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Find the <strong className="text-white">marshal at this station</strong> to record your points and crates before moving on.
              </p>
            </div>

            <p className="text-center text-xs text-gray-500 mt-8">
              Stay tied. Move as one. Good luck, crew.
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
