import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { VotePoll, VotePhoto } from '../types/database'

const VOTER_ID_KEY = 'voting_voter_id'

function getVoterId(): string {
  let id = localStorage.getItem(VOTER_ID_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(VOTER_ID_KEY, id)
  }
  return id
}

export function VotingVote() {
  const { pollId } = useParams<{ pollId: string }>()
  const [poll, setPoll] = useState<VotePoll | null>(null)
  const [photos, setPhotos] = useState<VotePhoto[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const voterId = useMemo(() => getVoterId(), [])

  const load = useCallback(async () => {
    if (!pollId || !isSupabaseConfigured) { setLoading(false); return }
    const [pollRes, photosRes, ballotsRes] = await Promise.all([
      supabase.from('vote_polls').select('*').eq('id', pollId).maybeSingle(),
      supabase.from('vote_photos').select('*').eq('poll_id', pollId).order('sort_order'),
      supabase.from('vote_ballots').select('*').eq('poll_id', pollId).eq('voter_id', voterId),
    ])
    setPoll(pollRes.data ?? null)
    setPhotos(photosRes.data ?? [])
    if (ballotsRes.data && ballotsRes.data.length > 0) {
      setSubmitted(true)
      setSelected(new Set(ballotsRes.data.map(b => b.photo_id)))
    }
    setLoading(false)
  }, [pollId, voterId])

  useEffect(() => { load() }, [load])

  const maxVotes = poll?.max_votes_per_voter ?? 2
  const remaining = maxVotes - selected.size

  const togglePhoto = (photoId: string) => {
    if (submitted) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else if (next.size < maxVotes) {
        next.add(photoId)
      }
      return next
    })
  }

  const submit = async () => {
    if (!poll || !pollId) return
    if (selected.size === 0) { setError('Pick at least one photo.'); return }
    setSubmitting(true)
    setError(null)
    const rows = Array.from(selected).map(photoId => ({
      poll_id: pollId,
      photo_id: photoId,
      voter_id: voterId,
    }))
    const { error: insErr } = await supabase.from('vote_ballots').insert(rows)
    if (insErr) {
      setError(insErr.message.includes('duplicate') ? 'You already voted on this device.' : insErr.message)
      setSubmitting(false)
      return
    }
    setSubmitted(true)
    setSubmitting(false)
    await load()
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2">Poll not found</h1>
          <p className="text-gray-400">Ask the organiser for a fresh QR code.</p>
        </div>
      </div>
    )
  }

  if (!poll.is_open && !submitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⏸</div>
          <h1 className="text-2xl font-black mb-2">Voting isn't open yet</h1>
          <p className="text-gray-400">{poll.title} — wait for the organiser to start the vote, then refresh this page.</p>
        </div>
      </div>
    )
  }

  const isVideo = poll.media_type === 'video'
  const itemNoun = isVideo ? 'video' : 'photo'

  if (submitted) {
    const myPhotos = photos.filter(p => selected.has(p.id))
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-md mx-auto pt-10">
          <div className="text-6xl text-center mb-3">✓</div>
          <h1 className="text-3xl font-black text-center mb-2">Thanks for voting!</h1>
          <p className="text-gray-400 text-center mb-8">{poll.title}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-3 text-center">Your picks</p>
          <div className="grid grid-cols-2 gap-3">
            {myPhotos.map(p => (
              <div key={p.id} className="rounded-xl overflow-hidden border-2 border-emerald-400/60">
                <div className="aspect-square bg-black">
                  {isVideo ? (
                    <video src={p.photo_url} controls preload="metadata" playsInline className="w-full h-full object-contain bg-black" />
                  ) : (
                    <img src={p.photo_url} alt={p.label ?? ''} className="w-full h-full object-cover" />
                  )}
                </div>
                {p.label && <div className="p-2 text-xs text-center text-gray-300 bg-black/30">{p.label}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-black">{poll.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Pick <span className="text-violet-300 font-bold">{maxVotes}</span> {itemNoun}{maxVotes === 1 ? '' : 's'}.
          {isVideo && <span className="text-gray-500"> Tap ▶ to play, then tap “Pick” to vote.</span>}
        </p>
        {photos.length === 0 && (
          <p className="mt-8 text-gray-500 text-center">No {itemNoun}s yet — check back in a moment.</p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          {photos.map(photo => {
            const isSelected = selected.has(photo.id)
            const atLimit = !isSelected && selected.size >= maxVotes

            if (isVideo) {
              return (
                <div
                  key={photo.id}
                  className={`relative rounded-xl overflow-hidden border-2 transition ${
                    isSelected ? 'border-emerald-400 ring-4 ring-emerald-400/30' : 'border-white/10'
                  }`}
                >
                  <div className="aspect-square bg-black">
                    <video
                      src={photo.photo_url}
                      controls
                      preload="metadata"
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  </div>
                  {photo.label && (
                    <div className="px-3 py-1.5 bg-black/70 text-xs text-white text-left truncate">{photo.label}</div>
                  )}
                  <button
                    onClick={() => togglePhoto(photo.id)}
                    disabled={atLimit}
                    className={`w-full py-3 font-black text-sm transition disabled:opacity-40 ${
                      isSelected
                        ? 'bg-emerald-400 text-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isSelected ? '✓ Selected' : 'Pick this'}
                  </button>
                </div>
              )
            }

            return (
              <button
                key={photo.id}
                onClick={() => togglePhoto(photo.id)}
                disabled={atLimit}
                className={`relative rounded-xl overflow-hidden border-2 transition disabled:opacity-40 ${
                  isSelected ? 'border-emerald-400 ring-4 ring-emerald-400/30' : 'border-white/10 hover:border-white/40'
                }`}
              >
                <div className="aspect-square bg-black/30">
                  <img src={photo.photo_url} alt={photo.label ?? ''} className="w-full h-full object-cover" />
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-400 text-black flex items-center justify-center font-black text-lg">
                    ✓
                  </div>
                )}
                {photo.label && (
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/70 text-xs text-white text-left truncate">
                    {photo.label}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-white/10 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-bold">
              {selected.size} / {maxVotes} selected
            </div>
            <div className="text-xs text-gray-400">
              {remaining > 0 ? `Pick ${remaining} more or submit now` : 'Tap submit when ready'}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={submitting || selected.size === 0}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-black disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit vote'}
          </button>
        </div>
        {error && <p className="text-rose-400 text-xs mt-2 text-center">{error}</p>}
      </div>
    </div>
  )
}
