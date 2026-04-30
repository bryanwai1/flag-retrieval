import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { VotePoll, VotePhoto, VoteBallot } from '../types/database'

const TARGET_PHOTO_COUNT = 16
const MAX_PHOTOS = 16

export function VotingAdmin() {
  const [polls, setPolls] = useState<VotePoll[]>([])
  const [activePollId, setActivePollId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<VotePhoto[]>([])
  const [ballots, setBallots] = useState<VoteBallot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [newPollTitle, setNewPollTitle] = useState('')
  const [newPollMediaType, setNewPollMediaType] = useState<'photo' | 'video'>('photo')
  const fileRef = useRef<HTMLInputElement>(null)

  const activePoll = useMemo(
    () => polls.find(p => p.id === activePollId) ?? null,
    [polls, activePollId]
  )

  const loadPolls = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const { data } = await supabase.from('vote_polls').select('*').order('created_at', { ascending: false })
    if (data) {
      setPolls(data)
      if (!activePollId && data[0]) setActivePollId(data[0].id)
    }
    setLoading(false)
  }, [activePollId])

  const loadPollData = useCallback(async (pollId: string) => {
    const [photosRes, ballotsRes] = await Promise.all([
      supabase.from('vote_photos').select('*').eq('poll_id', pollId).order('sort_order'),
      supabase.from('vote_ballots').select('*').eq('poll_id', pollId),
    ])
    if (photosRes.data) setPhotos(photosRes.data)
    if (ballotsRes.data) setBallots(ballotsRes.data)
  }, [])

  useEffect(() => { loadPolls() }, [loadPolls])

  useEffect(() => {
    if (!activePollId || !isSupabaseConfigured) return
    loadPollData(activePollId)
    const channel = supabase
      .channel(`voting-admin-${activePollId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_ballots', filter: `poll_id=eq.${activePollId}` }, () => loadPollData(activePollId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_photos', filter: `poll_id=eq.${activePollId}` }, () => loadPollData(activePollId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePollId, loadPollData])

  const createPoll = async () => {
    const title = newPollTitle.trim() || (newPollMediaType === 'video' ? 'Video Vote' : 'Photo Vote')
    const { data, error } = await supabase
      .from('vote_polls')
      .insert({ title, media_type: newPollMediaType })
      .select()
      .single()
    if (error || !data) { alert(error?.message ?? 'Failed to create poll'); return }
    setNewPollTitle('')
    setActivePollId(data.id)
    await loadPolls()
  }

  const updatePoll = async (patch: Partial<VotePoll>) => {
    if (!activePollId) return
    const { error } = await supabase.from('vote_polls').update(patch).eq('id', activePollId)
    if (error) { alert(error.message); return }
    await loadPolls()
  }

  const deletePoll = async () => {
    if (!activePollId) return
    if (!confirm('Delete this poll, its uploaded items, and all ballots?')) return
    await supabase.from('vote_polls').delete().eq('id', activePollId)
    setActivePollId(null)
    setPhotos([])
    setBallots([])
    await loadPolls()
  }

  const resetVotes = async () => {
    if (!activePollId) return
    if (!confirm('Delete every ballot in this poll? Uploaded items stay.')) return
    await supabase.from('vote_ballots').delete().eq('poll_id', activePollId)
    await loadPollData(activePollId)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePollId || !activePoll) return
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) {
      alert(`Max ${MAX_PHOTOS} items. You can add ${MAX_PHOTOS - photos.length} more.`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const isVideo = activePoll.media_type === 'video'
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024
    const maxLabel = isVideo ? '50 MB' : '5 MB'
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > maxBytes) { alert(`${file.name} too large (max ${maxLabel}). Skipped.`); continue }
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const path = `voting/${activePollId}/${fileName}`
        const { error: upErr } = await supabase.storage.from('media').upload(path, file, {
          contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        })
        if (upErr) { alert(`Upload failed: ${upErr.message}`); continue }
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
        await supabase.from('vote_photos').insert({
          poll_id: activePollId,
          photo_url: urlData.publicUrl,
          sort_order: photos.length + i,
        })
      }
      await loadPollData(activePollId)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const updatePhoto = async (id: string, patch: Partial<VotePhoto>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    await supabase.from('vote_photos').update(patch).eq('id', id)
  }

  const deletePhoto = async (id: string) => {
    if (!confirm('Delete this photo and its votes?')) return
    await supabase.from('vote_photos').delete().eq('id', id)
    if (activePollId) await loadPollData(activePollId)
  }

  const voteCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of ballots) m.set(b.photo_id, (m.get(b.photo_id) ?? 0) + 1)
    return m
  }, [ballots])

  const uniqueVoters = useMemo(() => new Set(ballots.map(b => b.voter_id)).size, [ballots])

  const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const voteUrl = activePollId ? `${baseUrl}/voting/vote/${activePollId}` : ''

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black mb-2">Supabase not configured</h1>
          <p className="text-gray-400">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then run the migration <code className="text-violet-300">supabase/migrations/20260430_voting.sql</code>.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-sm text-gray-400 hover:text-white">&larr; Game Hub</Link>
            <h1 className="text-3xl font-black mt-2">Voting · Admin</h1>
          </div>
          {activePollId && (
            <Link
              to={`/voting/results/${activePollId}`}
              target="_blank"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-bold text-sm"
            >
              ▶ Open Results Display
            </Link>
          )}
        </div>

        <section className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
          <h2 className="text-lg font-bold mb-3">Polls</h2>
          {polls.length === 0 && <p className="text-gray-400 text-sm mb-3">No polls yet — create one below.</p>}
          {polls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {polls.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePollId(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                    p.id === activePollId
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  <span className="mr-1.5">{p.media_type === 'video' ? '🎬' : '🖼️'}</span>
                  {p.title}
                  {p.is_open && <span className="ml-2 text-xs text-emerald-300">● live</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-stretch">
            <div className="inline-flex rounded-lg bg-white/10 p-1 border border-white/10">
              <button
                onClick={() => setNewPollMediaType('photo')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  newPollMediaType === 'photo' ? 'bg-violet-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                🖼️ Photo
              </button>
              <button
                onClick={() => setNewPollMediaType('video')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  newPollMediaType === 'video' ? 'bg-violet-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                🎬 Video
              </button>
            </div>
            <input
              type="text"
              value={newPollTitle}
              onChange={e => setNewPollTitle(e.target.value)}
              placeholder={newPollMediaType === 'video' ? 'New poll title (e.g. Best Team Video)' : 'New poll title (e.g. Best Team Photo)'}
              className="flex-1 min-w-[200px] px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button onClick={createPoll} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold text-sm">+ Create poll</button>
          </div>
        </section>

        {activePoll && (
          <>
            <section className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
              <div className="grid sm:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Title</label>
                  <input
                    type="text"
                    value={activePoll.title}
                    onChange={e => setPolls(prev => prev.map(p => p.id === activePoll.id ? { ...p, title: e.target.value } : p))}
                    onBlur={e => updatePoll({ title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">Votes per voter</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_PHOTOS}
                    value={activePoll.max_votes_per_voter}
                    onChange={e => updatePoll({ max_votes_per_voter: Math.max(1, Math.min(MAX_PHOTOS, Number(e.target.value) || 1)) })}
                    className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => updatePoll({ is_open: !activePoll.is_open })}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                    activePoll.is_open
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {activePoll.is_open ? '⏸ Close voting' : '▶ Open voting'}
                </button>
                <button
                  onClick={() => setShowQR(true)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm"
                >
                  📱 Show voter QR
                </button>
                <button onClick={resetVotes} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-sm">↺ Reset votes</button>
                <button onClick={deletePoll} className="ml-auto px-4 py-2 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 rounded-lg font-bold text-sm">Delete poll</button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <Stat label={activePoll.media_type === 'video' ? 'Videos' : 'Photos'} value={`${photos.length} / ${TARGET_PHOTO_COUNT}`} />
                <Stat label="Ballots" value={ballots.length} />
                <Stat label="Voters" value={uniqueVoters} />
              </div>
            </section>

            {(() => {
              const isVideo = activePoll.media_type === 'video'
              const itemNoun = isVideo ? 'videos' : 'photos'
              const itemNounSingle = isVideo ? 'video' : 'photo'
              return (
                <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold capitalize">{itemNoun}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Upload up to {MAX_PHOTOS}. Aim for {TARGET_PHOTO_COUNT}. {isVideo ? 'MP4 / WebM · max 50 MB each.' : 'JPG / PNG · max 5 MB each.'}
                      </p>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={isVideo ? 'video/*' : 'image/*'}
                      multiple
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading || photos.length >= MAX_PHOTOS}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg font-bold text-sm"
                    >
                      {uploading ? 'Uploading…' : `+ Add ${itemNoun} (${photos.length}/${MAX_PHOTOS})`}
                    </button>
                  </div>

                  {photos.length === 0 ? (
                    <div
                      className="border-2 border-dashed border-white/15 rounded-xl py-14 flex flex-col items-center gap-3 cursor-pointer hover:border-violet-400/50"
                      onClick={() => fileRef.current?.click()}
                    >
                      <div className="text-5xl">{isVideo ? '🎬' : '🖼️'}</div>
                      <p className="text-gray-300 font-medium">Click to upload {TARGET_PHOTO_COUNT} {itemNoun}</p>
                      <p className="text-xs text-gray-500">You can pick multiple at once</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                          <div className="aspect-square bg-black">
                            {isVideo ? (
                              <video
                                src={photo.photo_url}
                                controls
                                preload="metadata"
                                playsInline
                                className="w-full h-full object-contain bg-black"
                              />
                            ) : (
                              <img src={photo.photo_url} alt={photo.label ?? ''} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="p-2.5">
                            <input
                              type="text"
                              value={photo.label ?? ''}
                              onChange={e => setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, label: e.target.value } : p))}
                              onBlur={e => updatePhoto(photo.id, { label: e.target.value })}
                              placeholder="Optional label"
                              className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                              maxLength={60}
                            />
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs text-emerald-300 font-bold">{voteCounts.get(photo.id) ?? 0} votes</span>
                              <button onClick={() => deletePhoto(photo.id)} className="text-xs text-rose-400 hover:text-rose-300 font-bold">Delete {itemNounSingle}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })()}
          </>
        )}
      </div>

      {showQR && voteUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer"
          onClick={() => setShowQR(false)}
        >
          <button
            onClick={() => setShowQR(false)}
            className="absolute top-6 right-8 text-white/60 hover:text-white text-5xl font-light"
          >
            &times;
          </button>
          <div
            className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 max-w-lg mx-4 cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black text-gray-900">Scan to vote</h2>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">{activePoll?.title}</p>
            <div className="bg-white p-3 rounded-2xl border-2 border-gray-100">
              <QRCodeSVG value={voteUrl} size={380} level="H" />
            </div>
            <p className="text-xs text-gray-400 break-all text-center">{voteUrl}</p>
            {activePoll && !activePoll.is_open && (
              <p className="text-rose-600 text-sm font-bold">⚠ Voting is closed — open it before sharing.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}
