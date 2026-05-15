import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ParticleBackground } from '../components/ParticleBackground'
import type { ChainGroup, ChainStation } from '../types/database'

type Phase = 'loading' | 'invalid' | 'pickTribe' | 'instructions' | 'error'

const SCANNER_KEY = 'chain-of-unity-scanner-id'
const TRIBE_KEY = 'chain-of-unity-tribe-id'

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
  const [phase, setPhase] = useState<Phase>('loading')
  const [station, setStation] = useState<ChainStation | null>(null)
  const [tribe, setTribe] = useState<ChainGroup | null>(null)
  const [groups, setGroups] = useState<ChainGroup[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [joining, setJoining] = useState(false)

  // Load station + decide whether to show tribe picker.
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!code) { setPhase('invalid'); return }
      if (!isSupabaseConfigured) {
        setErrorMsg('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        setPhase('error')
        return
      }
      const { data: stationData, error: stationErr } = await supabase
        .from('chain_stations')
        .select('*')
        .eq('code', code)
        .maybeSingle()
      if (cancelled) return
      if (stationErr) { setErrorMsg(stationErr.message); setPhase('error'); return }
      if (!stationData) { setPhase('invalid'); return }
      const s = stationData as ChainStation
      setStation(s)

      const tiedId = localStorage.getItem(TRIBE_KEY)
      if (tiedId) {
        const { data: tribeData } = await supabase
          .from('chain_groups')
          .select('*')
          .eq('id', tiedId)
          .eq('session_id', s.session_id)
          .maybeSingle()
        if (cancelled) return
        if (tribeData) {
          setTribe(tribeData as ChainGroup)
          await logStationScan(s.id, (tribeData as ChainGroup).id)
          setPhase('instructions')
          return
        }
        // Stored tribe id no longer matches this session — drop it and pick again.
        localStorage.removeItem(TRIBE_KEY)
      }

      const { data: groupsData, error: groupsErr } = await supabase
        .from('chain_groups')
        .select('*')
        .eq('session_id', s.session_id)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (groupsErr) { setErrorMsg(groupsErr.message); setPhase('error'); return }
      setGroups((groupsData ?? []) as ChainGroup[])
      setPhase('pickTribe')
    }
    run()
    return () => { cancelled = true }
  }, [code])

  const logStationScan = async (stationId: string, groupId: string | null) => {
    const { error } = await supabase
      .from('chain_station_scans')
      .insert({ station_id: stationId, group_id: groupId, scanner_id: getScannerId() })
    if (error) console.warn('chain_station_scans insert failed:', error.message)
  }

  const handlePickTribe = async (g: ChainGroup) => {
    if (!station) return
    setJoining(true)
    // Mirror the original join flow: record a chain_scans row so admin sees the join.
    await supabase
      .from('chain_scans')
      .insert({ group_id: g.id, scanner_id: getScannerId() })
    await logStationScan(station.id, g.id)
    localStorage.setItem(TRIBE_KEY, g.id)
    setTribe(g)
    setJoining(false)
    setPhase('instructions')
  }

  const pointers = useMemo(() => {
    if (!station) return []
    const out: { text: string; icon: string | null; idx: number }[] = []
    for (let i = 1; i <= 6; i++) {
      const text = station[`pointer_${i}` as keyof ChainStation] as string | null
      const icon = station[`icon_${i}` as keyof ChainStation] as string | null
      if (text && text.trim()) out.push({ text, icon, idx: i })
    }
    return out
  }, [station])

  return (
    <div className="min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
      <ParticleBackground />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        {phase === 'loading' && (
          <Centered>
            <div className="animate-pulse text-gray-400">Loading station…</div>
          </Centered>
        )}

        {phase === 'invalid' && (
          <Centered>
            <div className="text-7xl mb-3">⛓️</div>
            <h1 className="text-3xl font-black mb-2">Station not found</h1>
            <p className="text-gray-400 max-w-md">
              This QR isn't tied to an active station. Ask your facilitator for a fresh QR.
            </p>
            <Link to="/" className="mt-6 inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm">
              &larr; Back to Game Hub
            </Link>
          </Centered>
        )}

        {phase === 'error' && (
          <Centered>
            <div className="text-7xl mb-3">⚠️</div>
            <h1 className="text-3xl font-black mb-2">Something went wrong</h1>
            <p className="text-gray-400 max-w-md break-words">{errorMsg}</p>
            <Link to="/" className="mt-6 inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm">
              &larr; Back to Game Hub
            </Link>
          </Centered>
        )}

        {phase === 'pickTribe' && station && (
          <div className="animate-slide-up">
            <div className="text-center mb-6">
              <div className="text-6xl mb-3">⛓️</div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">Chain of Unity</p>
              <h1 className="text-3xl sm:text-4xl font-black mb-2">First, pick your tribe</h1>
              <p className="text-gray-400 max-w-md mx-auto">
                Tap your tribe below. You're tied to it for the whole event — you won't see this again on the next stations.
              </p>
            </div>

            {groups.length === 0 ? (
              <Centered>
                <p className="text-gray-400">No tribes set up for this session yet. Ask your facilitator.</p>
              </Centered>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handlePickTribe(g)}
                    disabled={joining}
                    className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-400/60 transition disabled:opacity-50"
                  >
                    <div className="font-bold text-white">{g.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{g.code}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'instructions' && station && (
          <div className="animate-slide-up">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">
                ⛓️ Station {station.position} {tribe && <span className="text-gray-400 normal-case tracking-normal">· {tribe.name}</span>}
              </p>
              <h1 className="text-3xl sm:text-4xl font-black">{station.title}</h1>
              {station.time_limit_min ? (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold uppercase tracking-wider">
                  ⏱ {station.time_limit_min} min max
                </div>
              ) : null}
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

            {station.objective && (
              <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-orange-500/10 to-rose-500/10 border border-orange-400/30 mb-5">
                <p className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-2">Objective</p>
                <p className="text-white text-lg leading-relaxed">{station.objective}</p>
              </div>
            )}

            {pointers.length > 0 && (
              <>
                <h2 className="text-xs uppercase tracking-[0.3em] text-orange-300 font-bold mb-3">Rules</h2>
                <ol className="space-y-3">
                  {pointers.map(p => (
                    <li key={p.idx} className="relative pl-14 pr-4 py-4 rounded-xl bg-white/5 border border-white/10">
                      <span
                        className="absolute left-3 top-3.5 w-8 h-8 rounded-full flex items-center justify-center font-black text-black text-sm"
                        style={{ background: 'linear-gradient(135deg, #fb923c, #f43f5e)' }}
                      >
                        {p.icon?.trim() || p.idx}
                      </span>
                      <div className="text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{p.text}</div>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {pointers.length === 0 && station.body && (
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
