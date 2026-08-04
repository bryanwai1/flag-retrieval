/**
 * AI Team Building brief, rendered inside a Bingo Dash card.
 *
 * This is the /aitb mission page's brief — hero, steps, props, interactive
 * system, tool buttons — lifted onto a bingo tile so an imported AITB card
 * plays exactly like it does in the standalone AI TB app.
 *
 * What deliberately does NOT come across is AITB's scoring furniture: the
 * check-in button, the per-step points and the speed-bonus ladder. On a bingo
 * board the card's own `points` are the score and the marshal password is the
 * gate, so a second timer and a second points economy would be two scoreboards
 * disagreeing on the same tile. Steps stay tickable as a plain checklist.
 *
 * Rendered in place of the generic instruction pages — the steps live here, so
 * showing both would print the same five lines twice.
 */
import { useEffect, useMemo, useState } from 'react'
import { AitbMissionModule } from './AitbMissionModule'
import { AitbAppLinks } from './AitbAppLinks'
import type { AitbActivity } from '../lib/aitbActivities'

type Props = {
  activity: AitbActivity
  /** bingo_scans row id — namespaces the module's spin counter. */
  scanId: string
  teamId: string
  taskId: string
  /** bingo_scans.words — the team's shared draw / typed result. */
  words: string[]
  /** Persist a new result for the whole team. */
  onSaveWords: (words: string[]) => void
  /** Card already completed: the brief goes read-only. */
  locked: boolean
  /** Tile points, shown next to the difficulty so the team knows the stake. */
  points: number
}

const DIFFICULTY_COLOR: Record<AitbActivity['difficulty'], string> = {
  Easy: '#34d399',
  Normal: '#fbbf24',
  Hard: '#f87171',
}

export function AitbCardBrief({
  activity, scanId, teamId, taskId, words, onSaveWords, locked, points,
}: Props) {
  const color = activity.color
  const [zoomImg, setZoomImg] = useState<number | null>(null)

  // Ticks are a checklist, not a score — they never leave the phone that made
  // them, so they live in localStorage rather than costing a round trip.
  const stepsKey = `bingo-aitb-steps-${teamId}-${taskId}`
  const [ticked, setTicked] = useState<number[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(stepsKey) || 'null')
      return Array.isArray(raw) ? raw.filter((n: unknown) => typeof n === 'number') : []
    } catch { return [] }
  })
  useEffect(() => {
    try { localStorage.setItem(stepsKey, JSON.stringify(ticked)) } catch { /* private mode */ }
  }, [stepsKey, ticked])

  const toggleStep = (i: number) => {
    if (locked) return
    setTicked(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b)))
  }

  // ── Typed words (Ping Pong's 7 words) ──────────────────────────────────────
  const wordsCfg = activity.wordsInput
  // null until someone types on THIS phone — until then the boxes mirror the
  // team's saved row, so a teammate's submission shows up here without an
  // effect that could clobber half-typed text.
  const [drafts, setDrafts] = useState<string[] | null>(null)
  const [wordsError, setWordsError] = useState('')
  const [wordsSaved, setWordsSaved] = useState(false)

  const shownDrafts = useMemo(
    () => drafts ?? Array.from({ length: wordsCfg?.count ?? 0 }, (_, i) => words[i] ?? ''),
    [drafts, wordsCfg, words],
  )

  const submitWords = () => {
    if (!wordsCfg || locked) return
    const clean = shownDrafts.map(w => w.trim())
    if (clean.some(w => !w)) {
      setWordsError(`Fill in all ${wordsCfg.count} words first!`)
      return
    }
    setWordsError('')
    onSaveWords(clean)
    setWordsSaved(true)
    setTimeout(() => setWordsSaved(false), 2500)
  }

  const hasResult = useMemo(() => words.some(w => (w ?? '').trim()), [words])

  return (
    <div className="animate-slide-up">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden mb-4" style={{ border: `2px solid ${color}55` }}>
        <img src={activity.hero} alt="" loading="lazy" className="w-full aspect-video object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0a0a 5%, rgba(10,10,10,0.35) 50%, transparent)' }} />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>
            Activity {activity.act} · {activity.mins} min · {activity.outType}
          </div>
          <h2 className="text-white text-2xl font-black leading-tight">{activity.emoji} {activity.name}</h2>
        </div>
      </div>

      <p className="text-white/80 text-base font-medium mb-3">{activity.tagline}</p>

      {/* Stake: difficulty tier + what the tile pays on the scoreboard */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span
          className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide"
          style={{
            background: `${DIFFICULTY_COLOR[activity.difficulty]}22`,
            color: DIFFICULTY_COLOR[activity.difficulty],
            border: `1.5px solid ${DIFFICULTY_COLOR[activity.difficulty]}66`,
          }}
        >
          {activity.difficulty}
        </span>
        {points > 0 && (
          <span
            className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide"
            style={{ background: `${color}22`, color, border: `1.5px solid ${color}66` }}
          >
            🏆 {points} pts to your team
          </span>
        )}
      </div>

      {/* ── Props the marshal hands you ───────────────────────────────────── */}
      {activity.props.length > 0 && (
        <>
          <SectionLabel>🎒 What you get at this station</SectionLabel>
          <div className="rounded-2xl px-4 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${color}33` }}>
            <ul className="flex flex-col gap-1.5">
              {activity.props.map(p => (
                <li key={p} className="text-white/75 text-sm font-bold flex gap-2">
                  <span style={{ color }}>▪</span>{p}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── Steps ─────────────────────────────────────────────────────────── */}
      <SectionLabel>✅ Tick as you go</SectionLabel>
      <div className="flex flex-col gap-2 mb-5">
        {activity.steps.map((s, i) => {
          const done = ticked.includes(i)
          return (
            <button
              key={i}
              onClick={() => toggleStep(i)}
              disabled={locked}
              className="flex items-center gap-3 text-left rounded-2xl px-4 py-3 transition-all active:scale-[0.98] disabled:active:scale-100"
              style={{
                background: done ? `${color}1e` : 'rgba(255,255,255,0.05)',
                border: `2px solid ${done ? color : 'rgba(255,255,255,0.1)'}`,
                opacity: locked && !done ? 0.6 : 1,
              }}
            >
              <span className="text-3xl flex-shrink-0">{activity.stepEmojis[i]}</span>
              <span className={`flex-1 font-bold text-white ${done ? 'line-through opacity-70' : ''}`}>{s}</span>
              <span className="text-2xl flex-shrink-0">{done ? '✅' : '⬜'}</span>
            </button>
          )
        })}
      </div>

      {/* ── Reassuring disclaimer (e.g. act 04 tree photos) ───────────────── */}
      {activity.note && (
        <div className="rounded-2xl px-4 py-3 mb-5" style={{ background: `${color}12`, border: `2px solid ${color}44` }}>
          <p className="text-sm font-bold leading-relaxed" style={{ color }}>{activity.note}</p>
        </div>
      )}

      {/* ── Interactive system: cups / roulette / cards / animals ─────────── */}
      {activity.module && (
        <AitbMissionModule
          // Two activities share one module component (cards and animals both
          // deal), so key by activity + row or React reuses the mounted one and
          // carries the other card's draw across.
          key={`${activity.id}-${scanId}`}
          activity={activity}
          savedWords={words}
          disabled={locked}
          onSave={onSaveWords}
          progressId={scanId}
        />
      )}

      {/* ── Playable reference games (act 02) ─────────────────────────────── */}
      {activity.demos && (
        <>
          <SectionLabel>🕹️ Play the 3 games first!</SectionLabel>
          <div className="flex flex-col gap-2 mb-5">
            {activity.demos.map(d => (
              <a
                key={d.label}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all active:scale-[0.98]"
                style={{ background: `${color}12`, border: `2px solid ${color}55` }}
              >
                <span className="text-3xl flex-shrink-0">{d.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-black text-white">{d.label}</span>
                  <span className="text-white/50 font-bold text-sm"> — {d.sub}</span>
                </span>
                <span className="font-black flex-shrink-0" style={{ color }}>PLAY ▶</span>
              </a>
            ))}
          </div>
        </>
      )}

      {/* ── Target picture gallery (act 08) ───────────────────────────────── */}
      {activity.gallery && (
        <>
          <SectionLabel>🖼️ The 10 target pictures</SectionLabel>
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${color}44` }}>
            <p className="text-sm font-bold mb-3" style={{ color }}>
              ⚠️ You must REGENERATE the picture with AI — then show the marshal your picture AND the prompt you used. No prompt = no points!
            </p>
            <div className="grid grid-cols-2 gap-2">
              {activity.gallery.map((s, i) => (
                <button key={s.img} onClick={() => setZoomImg(i)} className="text-left">
                  <img
                    src={s.img}
                    alt={s.label}
                    loading="lazy"
                    className="rounded-xl w-full aspect-square object-cover"
                    style={{ border: `2px solid ${color}44` }}
                  />
                  <div className="text-xs font-bold text-white/70 mt-1">#{i + 1} · {s.label}</div>
                </button>
              ))}
            </div>
            <p className="text-white/40 text-xs mt-2">Tap a picture to see it big.</p>
          </div>
        </>
      )}

      {/* ── Typed words (act 07) ──────────────────────────────────────────── */}
      {wordsCfg && (
        <>
          <SectionLabel>{wordsCfg.title}</SectionLabel>
          <div
            className="rounded-2xl p-4 mb-5"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `2px solid ${hasResult ? '#34d39966' : `${color}44`}`,
            }}
          >
            <p className="text-white/50 text-sm mb-3">{wordsCfg.hint}</p>
            <div className={`grid gap-2 mb-3 ${wordsCfg.count > 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {shownDrafts.map((w, i) => (
                <input
                  key={i}
                  value={w}
                  disabled={locked}
                  onChange={e => {
                    // Functional update: a paste that fills several boxes in one
                    // tick would otherwise have every handler build off the same
                    // stale array and keep only the last.
                    const val = e.target.value
                    setDrafts(prev => (prev ?? shownDrafts).map((cur, j) => (j === i ? val : cur)))
                    setWordsError('')
                  }}
                  placeholder={wordsCfg.labels?.[i] ?? `Word ${i + 1}`}
                  className="bg-black/40 rounded-xl px-3 py-2.5 font-bold text-white outline-none"
                  style={{ border: `1.5px solid ${w.trim() ? `${color}77` : 'rgba(255,255,255,0.12)'}` }}
                />
              ))}
            </div>
            {wordsError && <div className="text-red-400 text-sm font-bold mb-2">{wordsError}</div>}
            {!locked && (
              <button
                onClick={submitWords}
                className="w-full py-3 rounded-xl font-black text-lg transition-all active:scale-95"
                style={{ background: color, color: '#000' }}
              >
                {wordsSaved ? '✅ SENT!' : hasResult ? '🔁 UPDATE WORDS' : '📤 SUBMIT WORDS'}
              </button>
            )}
            {hasResult && (
              <div className="text-emerald-400 text-sm font-bold mt-2 text-center">
                ✅ Saved for your whole team{locked ? '' : ' — you can still fix them until the marshal signs off'}!
              </div>
            )}
          </div>
        </>
      )}

      {/* ── AI tools ──────────────────────────────────────────────────────── */}
      <SectionLabel>🤖 Your AI tools — tap to open</SectionLabel>
      <div className="mb-5">
        <AitbAppLinks apps={activity.apps} color={color} />
      </div>

      {/* ── Full brief, tucked away so the card stays fun ─────────────────── */}
      <details className="rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.08)' }}>
        <summary
          className="px-4 py-3 cursor-pointer list-none font-black text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', color }}
        >
          📖 More info
        </summary>
        <div className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <p className="text-white/70 text-sm leading-relaxed mb-2">{activity.desc}</p>
          <p className="text-white/40 text-sm">🧠 {activity.learning}</p>
        </div>
      </details>

      {/* Fullscreen target picture */}
      {zoomImg !== null && activity.gallery && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setZoomImg(null)}
        >
          <img src={activity.gallery[zoomImg].img} alt="" className="max-w-full max-h-[75vh] rounded-2xl" />
          <div className="font-black text-xl mt-3" style={{ color }}>
            #{zoomImg + 1} · {activity.gallery[zoomImg].label}
          </div>
          <div className="text-white/50 text-sm font-bold mt-1 text-center">
            Regenerate this with AI — show the marshal the picture + your prompt!
          </div>
          <div className="text-white/30 text-xs mt-3">tap anywhere to close</div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-black tracking-widest uppercase text-white/40 mb-2">{children}</div>
  )
}
