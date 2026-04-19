import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { BingoSection } from '../types/database'
import {
  SLIDE_LABELS,
  addSlide,
  buildAwardSlides,
  countsFromOrder,
  defaultSlideOrder,
  isPrizeKind,
  normalizeSlideOrder,
  removeSlide,
  type AwardSlideKind,
  type AwardSlideId,
  type PrizeKind,
} from '../lib/awardSlides'

type DraftConfig = {
  total_points: number
  image_url: string | null
  slide_order: AwardSlideId[]
  slide_points: Record<string, number>
}

const INITIAL_ORDER: AwardSlideId[] = defaultSlideOrder({
  consolation_count: 3,
  third_count: 1,
  second_count: 1,
  first_count: 1,
})

const EMPTY_DRAFT: DraftConfig = {
  total_points: 0,
  image_url: null,
  slide_order: INITIAL_ORDER,
  slide_points: {},
}

export function BingoDashAwardAdmin() {
  const { sectionSlug } = useParams<{ sectionSlug: string }>()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [section, setSection] = useState<BingoSection | null>(null)
  const [configId, setConfigId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftConfig>(EMPTY_DRAFT)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!sectionSlug) return
    let cancelled = false
    ;(async () => {
      const { data: sec } = await supabase
        .from('bingo_sections')
        .select('*')
        .eq('slug', sectionSlug)
        .maybeSingle()
      if (cancelled) return
      if (!sec) { setLoaded(true); return }
      setSection(sec)
      const { data: cfg } = await supabase
        .from('bingo_award_configs')
        .select('*')
        .eq('section_id', sec.id)
        .maybeSingle()
      if (cancelled) return
      if (cfg) {
        setConfigId(cfg.id)
        const counts = {
          consolation_count: cfg.consolation_count ?? 3,
          third_count: cfg.third_count ?? 1,
          second_count: cfg.second_count ?? 1,
          first_count: cfg.first_count ?? 1,
        }
        setDraft({
          total_points: cfg.total_points ?? 0,
          image_url: cfg.image_url ?? null,
          slide_order: normalizeSlideOrder(cfg.slide_order, counts),
          slide_points: (cfg.slide_points && typeof cfg.slide_points === 'object') ? cfg.slide_points : {},
        })
      }
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [sectionSlug])

  const slides = useMemo(() => buildAwardSlides(draft.slide_order), [draft.slide_order])
  const hasIntro = draft.slide_order.includes('intro')
  const hasHolding = draft.slide_order.includes('holding')

  const moveSlide = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= draft.slide_order.length) return
    const next = [...draft.slide_order]
    ;[next[from], next[to]] = [next[to], next[from]]
    setDraft(d => ({ ...d, slide_order: next }))
  }

  const doAddSlide = (kind: AwardSlideKind) => {
    setDraft(d => ({ ...d, slide_order: addSlide(d.slide_order, kind) }))
  }

  const doRemoveSlide = (id: AwardSlideId) => {
    setDraft(d => {
      const { [id]: _, ...restPoints } = d.slide_points
      return {
        ...d,
        slide_order: removeSlide(d.slide_order, id),
        slide_points: restPoints,
      }
    })
  }

  const setSlidePoints = (id: AwardSlideId, value: number) => {
    const v = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
    setDraft(d => ({ ...d, slide_points: { ...d.slide_points, [id]: v } }))
  }

  const uploadImage = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      alert('Image too large (max 8 MB)')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `bingo-media/awards/${fileName}`
      const { error } = await supabase.storage.from('media').upload(path, file)
      if (error) { alert(`Upload failed: ${error.message}`); return }
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      setDraft(d => ({ ...d, image_url: data.publicUrl }))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (!section) return
    setSaving(true)
    try {
      const counts = countsFromOrder(draft.slide_order)
      const payload = {
        section_id: section.id,
        total_points: draft.total_points,
        image_url: draft.image_url,
        consolation_count: counts.consolation_count,
        third_count: counts.third_count,
        second_count: counts.second_count,
        first_count: counts.first_count,
        slide_order: draft.slide_order,
        slide_points: draft.slide_points,
      }
      if (configId) {
        const { error } = await supabase.from('bingo_award_configs').update(payload).eq('id', configId)
        if (error) { alert(`Save failed: ${error.message}`); return }
      } else {
        const { data, error } = await supabase
          .from('bingo_award_configs')
          .insert(payload)
          .select()
          .single()
        if (error || !data) { alert(`Save failed: ${error?.message ?? 'unknown'}`); return }
        setConfigId(data.id)
      }
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading…</div>
  }
  if (!section) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-2xl font-black">Compartment not found.</p>
        <a href="/bingo-dash/slides/awards" className="text-amber-400 hover:text-amber-300 underline">Pick another</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/bingo-dash/slides/awards')}
          className="text-xs text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest font-semibold"
        >
          ← Awards Home
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black truncate">🎖 Award Slides · {section.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure ceremony content, prize points, and slide order</p>
        </div>
        <button
          onClick={() => navigate(`/bingo-dash/slides/awards/${section.slug}`)}
          className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          ▶ Run show
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>
        )}
      </header>

      <div className="max-w-6xl mx-auto p-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: holding slide content */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-black text-gray-900 mb-4">Holding slide</h2>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Total points shown</label>
            <input
              type="number"
              min={0}
              value={draft.total_points}
              onChange={e => setDraft(d => ({ ...d, total_points: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
              onClick={e => (e.target as HTMLInputElement).select()}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Manual value — type whatever number you want. Ignores game scores entirely.
            </p>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Hero image</label>
              {draft.image_url ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: '16/9' }}>
                  <img src={draft.image_url} alt="Hero" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => setDraft(d => ({ ...d, image_url: null }))}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center gap-2 hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-4xl">🖼️</span>
                  <span className="text-sm text-gray-500 font-semibold">
                    {uploading ? 'Uploading…' : 'Click to upload hero image'}
                  </span>
                  <span className="text-xs text-gray-400">JPG or PNG · max 8 MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadImage(f)
                }}
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-black text-gray-900 mb-2">Ceremony summary</h2>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>{slides.length} slide{slides.length === 1 ? '' : 's'} total</li>
              <li>{slides.filter(s => isPrizeKind(s.kind)).length} prize reveal{slides.filter(s => isPrizeKind(s.kind)).length === 1 ? '' : 's'}</li>
              <li>Total points (holding slide): <span className="font-mono font-bold">{draft.total_points}</span></li>
              <li>Prize pool (sum of per-slide pts): <span className="font-mono font-bold">
                {slides.filter(s => isPrizeKind(s.kind)).reduce((sum, s) => sum + (draft.slide_points[s.id] ?? 0), 0)}
              </span></li>
              <li>Hero image: <span className="font-mono">{draft.image_url ? 'set' : 'none'}</span></li>
            </ul>
          </section>
        </div>

        {/* Right: sequence + add */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-black text-gray-900">Slide sequence</h2>
              <button
                onClick={() => setDraft(d => ({ ...d, slide_order: defaultSlideOrder(countsFromOrder(d.slide_order)) }))}
                className="text-xs text-gray-500 hover:text-gray-900 underline"
                title="Put slides back in default order (intro → holding → consolation → 3rd → 2nd → 1st)"
              >
                Reset order
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Reorder with arrows · Remove with ✕ · Type prize pts per slide</p>

            <ol className="space-y-2">
              {slides.map((s, i) => {
                const { label, emoji, accent } = SLIDE_LABELS[s.kind]
                const pts = draft.slide_points[s.id] ?? 0
                const subtitle = s.kind === 'intro'
                  ? '🏆 Award Ceremony title reveal'
                  : s.kind === 'holding'
                    ? `${draft.total_points} pts tease${draft.image_url ? ' · with image' : ''}`
                    : `Team rank #${s.teamRank} · ${label}${s.rank && s.rank > 1 ? ` #${s.rank}` : ''}`
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                  >
                    <span
                      className="w-8 h-8 flex items-center justify-center rounded-lg font-black text-base shrink-0"
                      style={{ background: accent, color: '#111' }}
                    >
                      {emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {label}{s.rank != null && s.rank > 1 ? ` · #${s.rank}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>
                    </div>

                    {isPrizeKind(s.kind) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          value={pts}
                          onChange={e => setSlidePoints(s.id, parseInt(e.target.value, 10) || 0)}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          className="w-20 px-2 py-1.5 rounded-lg border border-gray-300 text-center font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          title="Points this team receives"
                        />
                        <span className="text-[10px] font-bold text-gray-400 uppercase">pts</span>
                      </div>
                    )}

                    <span className="text-[10px] font-mono text-gray-400 w-5 text-right">{i + 1}</span>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => moveSlide(i, -1)}
                        disabled={i === 0}
                        className="w-7 h-5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-xs disabled:opacity-30 flex items-center justify-center"
                        title="Move up"
                      >▲</button>
                      <button
                        onClick={() => moveSlide(i, 1)}
                        disabled={i === slides.length - 1}
                        className="w-7 h-5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-xs disabled:opacity-30 flex items-center justify-center"
                        title="Move down"
                      >▼</button>
                    </div>
                    <button
                      onClick={() => doRemoveSlide(s.id)}
                      className="w-7 h-7 rounded bg-white border border-gray-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0"
                      title="Remove this slide"
                    >✕</button>
                  </li>
                )
              })}
              {slides.length === 0 && (
                <li className="text-sm text-gray-400 italic text-center py-6">
                  No slides yet. Use the buttons below to add one.
                </li>
              )}
            </ol>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-black text-gray-900 mb-1">Add a slide</h2>
            <p className="text-xs text-gray-400 mb-4">New slides are appended to the end. Reorder with the arrows above.</p>

            <div className="grid grid-cols-2 gap-2">
              <AddButton
                disabled={hasIntro}
                emoji="✨"
                label="Intro"
                sublabel={hasIntro ? 'already added' : 'animated opener'}
                accent="#fde68a"
                onClick={() => doAddSlide('intro')}
              />
              <AddButton
                disabled={hasHolding}
                emoji="⏳"
                label="Holding"
                sublabel={hasHolding ? 'already added' : 'total points tease'}
                accent="#fcd34d"
                onClick={() => doAddSlide('holding')}
              />
              {(['first', 'second', 'third', 'consolation'] as PrizeKind[]).map(kind => (
                <AddButton
                  key={kind}
                  emoji={SLIDE_LABELS[kind].emoji}
                  label={`+ ${SLIDE_LABELS[kind].label}`}
                  sublabel={`Currently ${slides.filter(s => s.kind === kind).length}`}
                  accent={SLIDE_LABELS[kind].accent}
                  onClick={() => doAddSlide(kind)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function AddButton({
  disabled, emoji, label, sublabel, accent, onClick,
}: {
  disabled?: boolean
  emoji: string
  label: string
  sublabel: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-amber-300 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:border-gray-200"
    >
      <span
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
        style={{ background: accent }}
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate">{label}</p>
        <p className="text-[11px] text-gray-500 truncate">{sublabel}</p>
      </div>
    </button>
  )
}
