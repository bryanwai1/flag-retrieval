import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { VotePoll, VotePhoto, VoteBallot } from '../types/database'

export function VotingResults() {
  const { pollId: pollIdParam } = useParams<{ pollId: string }>()
  const [polls, setPolls] = useState<VotePoll[]>([])
  const [resolvedPollId, setResolvedPollId] = useState<string | null>(pollIdParam ?? null)
  const [poll, setPoll] = useState<VotePoll | null>(null)
  const [photos, setPhotos] = useState<VotePhoto[]>([])
  const [ballots, setBallots] = useState<VoteBallot[]>([])
  const [loading, setLoading] = useState(true)
  const [qrFullscreen, setQrFullscreen] = useState(false)

  // When no pollId is in the URL, fetch all polls and pick the most recent open one
  // (or the most recent overall as a fallback).
  useEffect(() => {
    if (pollIdParam) { setResolvedPollId(pollIdParam); return }
    if (!isSupabaseConfigured) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('vote_polls')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      const list = data ?? []
      setPolls(list)
      const open = list.find(p => p.is_open)
      setResolvedPollId(open?.id ?? list[0]?.id ?? null)
    })()
    return () => { cancelled = true }
  }, [pollIdParam])

  const load = useCallback(async () => {
    if (!resolvedPollId || !isSupabaseConfigured) { setLoading(false); return }
    const [pollRes, photosRes, ballotsRes] = await Promise.all([
      supabase.from('vote_polls').select('*').eq('id', resolvedPollId).maybeSingle(),
      supabase.from('vote_photos').select('*').eq('poll_id', resolvedPollId).order('sort_order'),
      supabase.from('vote_ballots').select('*').eq('poll_id', resolvedPollId),
    ])
    setPoll(pollRes.data ?? null)
    setPhotos(photosRes.data ?? [])
    setBallots(ballotsRes.data ?? [])
    setLoading(false)
  }, [resolvedPollId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!resolvedPollId || !isSupabaseConfigured) return
    const channel = supabase
      .channel(`voting-results-${resolvedPollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_ballots', filter: `poll_id=eq.${resolvedPollId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_photos', filter: `poll_id=eq.${resolvedPollId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_polls', filter: `id=eq.${resolvedPollId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [resolvedPollId, load])

  // Keep the picker in sync with any new polls created while we're watching.
  useEffect(() => {
    if (pollIdParam || !isSupabaseConfigured) return
    const channel = supabase
      .channel('voting-results-poll-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_polls' }, async () => {
        const { data } = await supabase.from('vote_polls').select('*').order('created_at', { ascending: false })
        setPolls(data ?? [])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pollIdParam])

  const ranked = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of ballots) counts.set(b.photo_id, (counts.get(b.photo_id) ?? 0) + 1)
    return photos
      .map(p => ({ photo: p, votes: counts.get(p.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.photo.sort_order - b.photo.sort_order)
  }, [photos, ballots])

  const totalVotes = ballots.length
  const uniqueVoters = useMemo(() => new Set(ballots.map(b => b.voter_id)).size, [ballots])
  const topVotes = ranked[0]?.votes ?? 0

  const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const voteUrl = resolvedPollId ? `${baseUrl}/voting/vote/${resolvedPollId}` : ''

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-3">🗳️</div>
          <h1 className="text-2xl font-black mb-2">No active poll</h1>
          <p className="text-gray-400 text-sm">Create one in the admin panel and click <span className="text-emerald-300 font-bold">▶ Open voting</span> to start a vote.</p>
          <a href="/voting" className="inline-block mt-6 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl font-bold text-sm">Open Admin Panel</a>
        </div>
      </div>
    )
  }

  const showPicker = !pollIdParam && polls.length > 1

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-6">
          <div className="flex-1 min-w-[260px]">
            <p className="text-violet-300 text-sm font-bold uppercase tracking-widest">Live Results</p>
            <h1 className="text-5xl font-black mt-1">{poll.title}</h1>
            {showPicker && (
              <select
                value={resolvedPollId ?? ''}
                onChange={e => setResolvedPollId(e.target.value || null)}
                className="mt-3 px-3 py-1.5 bg-white/10 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {polls.map(p => (
                  <option key={p.id} value={p.id} className="bg-gray-900">
                    {p.title}{p.is_open ? ' · live' : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-6 mt-5">
              <Stat label="Voters" value={uniqueVoters} />
              <Stat label="Total votes" value={totalVotes} />
              <Stat label="Per voter" value={`${poll.max_votes_per_voter}`} />
            </div>
          </div>
          {voteUrl && poll.is_open && (
            <button
              onClick={() => setQrFullscreen(true)}
              className="group flex items-center gap-4 bg-white rounded-2xl p-4 shadow-2xl hover:scale-[1.02] transition cursor-pointer"
              title="Click to enlarge"
            >
              <div className="bg-white p-1 rounded-xl">
                <QRCodeSVG value={voteUrl} size={140} level="H" />
              </div>
              <div className="text-left pr-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Scan to vote</div>
                <div className="text-xl font-black text-gray-900 leading-tight mt-0.5">{poll.title}</div>
                <div className="text-[10px] text-gray-400 mt-1.5 group-hover:text-violet-500 font-bold uppercase tracking-wider">Tap to enlarge ↗</div>
              </div>
            </button>
          )}
        </div>

        {ranked.length === 0 ? (
          <p className="text-center text-gray-500 mt-20">
            No {poll.media_type === 'video' ? 'videos' : 'photos'} uploaded yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ranked.map(({ photo, votes }, idx) => {
              const pct = topVotes > 0 ? (votes / topVotes) * 100 : 0
              const isLeader = idx === 0 && votes > 0
              const isVideo = poll.media_type === 'video'
              return (
                <div
                  key={photo.id}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                    isLeader ? 'border-amber-300 ring-4 ring-amber-400/30 scale-[1.02]' : 'border-white/10'
                  }`}
                >
                  <div className="aspect-square bg-black/40 relative">
                    {isVideo ? (
                      <video
                        src={photo.photo_url}
                        controls
                        preload="metadata"
                        playsInline
                        muted
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <img src={photo.photo_url} alt={photo.label ?? ''} className="w-full h-full object-cover" />
                    )}
                    {isLeader && (
                      <div className="absolute top-2 left-2 px-3 py-1 rounded-full bg-amber-300 text-black text-xs font-black z-10">
                        🏆 LEADING
                      </div>
                    )}
                    <div className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center font-black z-10">
                      #{idx + 1}
                    </div>
                  </div>
                  <div className="p-3 bg-black/40">
                    {photo.label && <div className="text-sm font-bold truncate">{photo.label}</div>}
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-3xl font-black tabular-nums">{votes}</span>
                      <span className="text-xs text-gray-400">{votes === 1 ? 'vote' : 'votes'}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ${isLeader ? 'bg-amber-300' : 'bg-violet-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!poll.is_open && (
          <p className="mt-8 text-center text-rose-300 text-sm">Voting is closed.</p>
        )}
      </div>

      {qrFullscreen && voteUrl && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center cursor-pointer"
          onClick={() => setQrFullscreen(false)}
        >
          <button
            onClick={() => setQrFullscreen(false)}
            className="absolute top-6 right-8 text-white/60 hover:text-white text-5xl font-light"
          >
            &times;
          </button>
          <div
            className="bg-white rounded-3xl p-12 flex flex-col items-center gap-6 max-w-2xl mx-4 cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-violet-600 text-sm font-black uppercase tracking-[0.3em]">Scan to vote</p>
            <h2 className="text-4xl font-black text-gray-900 text-center -mt-2">{poll.title}</h2>
            <div className="bg-white p-3 rounded-2xl border-2 border-gray-100">
              <QRCodeSVG value={voteUrl} size={520} level="H" />
            </div>
            <p className="text-xs text-gray-400 break-all text-center">{voteUrl}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  )
}
