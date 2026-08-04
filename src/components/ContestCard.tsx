import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { QRScanner } from './QRScanner'
import { getContestGame } from '../lib/contestGames'
import { useBingoDuels, duelQrValue, parseDuelQr } from '../hooks/useBingoDuels'
import type { BingoDuel, BingoTask, BingoTeam } from '../types/database'

// The whole contending flow on a contest card, from one team's phone.
//
//   idle → challenge (scan the other team's QR, or pick them from the list)
//        → waiting for them to accept
//        → LIVE: both phones show the same clue + the same drawn setup
//        → marshal declares the winner
//        → result
//
// The defender never opens this card — their phone gets the incoming-challenge
// banner from <IncomingDuelBanner/> instead, and lands in the same LIVE view.

// The board screens only carry a team's id and name, so that is all this asks
// for — nothing here needs the full BingoTeam row.
type DuelTeam = { id: string; name: string }

type Props = {
  task: BingoTask
  team: DuelTeam
  sectionId: string
  marshalPassword: string
}

export function ContestCard({ task, team, sectionId, marshalPassword }: Props) {
  const duels = useBingoDuels(team.id, sectionId)
  const [mode, setMode] = useState<'idle' | 'scan' | 'pick'>('idle')
  const [teams, setTeams] = useState<BingoTeam[]>([])
  const [error, setError] = useState('')
  const game = getContestGame(task.contest_game)

  // Opponents to pick from when a camera isn't usable — in-app browsers often
  // have no camera at all, and that must never block a live event.
  useEffect(() => {
    if (mode !== 'pick') return
    supabase.from('bingo_teams').select('*').eq('section_id', sectionId).order('name')
      .then(({ data }) => setTeams((data ?? []).filter(t => t.id !== team.id)))
  }, [mode, sectionId, team.id])

  const start = async (defenderTeamId: string) => {
    setError('')
    const { error: err } = await duels.challenge(task, defenderTeamId)
    if (err) { setError(err); return }
    setMode('idle')
  }

  const myDuelForThisCard = duels.duels.find(
    d => d.task_id === task.id && (d.status === 'active' || d.status === 'pending'),
  ) ?? null
  const finished = duels.resultFor(task.id)

  // ── Resolved ───────────────────────────────────────────────────────────────
  if (finished) return <DuelResult duel={finished} myTeamId={team.id} />

  // ── Live duel ──────────────────────────────────────────────────────────────
  if (myDuelForThisCard?.status === 'active') {
    return (
      <LiveDuel
        duel={myDuelForThisCard}
        myTeamId={team.id}
        sectionId={sectionId}
        marshalPassword={marshalPassword}
        onResolve={(winner) => duels.resolve(myDuelForThisCard, winner)}
        onCancel={() => duels.cancel(myDuelForThisCard.id)}
      />
    )
  }

  // ── Waiting for the defender to accept ─────────────────────────────────────
  if (myDuelForThisCard?.status === 'pending') {
    return (
      <div className="rounded-3xl p-5 border-2 border-amber-400/50 bg-amber-400/10 text-center">
        <div className="text-4xl mb-2 animate-pulse">📡</div>
        <p className="text-amber-200 font-black text-lg">Challenge sent!</p>
        <p className="text-amber-200/70 text-sm mt-1">
          Waiting for the other team to accept on their phone.
        </p>
        <p className="text-amber-200/50 text-xs mt-3 font-mono">Duel #{myDuelForThisCard.code}</p>
        <button
          onClick={() => duels.cancel(myDuelForThisCard.id)}
          className="mt-4 text-xs font-bold text-amber-200/60 hover:text-red-300 transition-colors"
        >
          Cancel challenge
        </button>
      </div>
    )
  }

  // ── Idle: start a challenge ────────────────────────────────────────────────
  return (
    <div className="rounded-3xl p-5 border-2 border-white/15 bg-white/5">
      <div className="text-center mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Contest Card</p>
        <p className="text-white font-black text-xl mt-1">{game.emoji} {game.name}</p>
        <p className="text-white/60 text-sm mt-1">{game.tagline}</p>
      </div>

      <div className="rounded-2xl bg-black/30 border border-white/10 p-3 mb-4">
        <p className="text-white/80 text-xs font-bold leading-relaxed">
          Find another team face to face. You cross this tile off either way — but the
          <span className="text-amber-300"> winner takes +{task.contest_bonus} bonus points</span>.
        </p>
      </div>

      {mode === 'idle' && (
        <>
          {/* This team's own QR — the other team scans it to challenge US */}
          <div className="flex flex-col items-center gap-2 mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Your contending code</p>
            <div className="bg-white p-2.5 rounded-2xl">
              <QRCodeSVG value={duelQrValue(sectionId, team.id)} size={132} />
            </div>
            <p className="text-white/50 text-[11px] font-semibold">{team.name}</p>
          </div>

          <button
            onClick={() => { setError(''); setMode('scan') }}
            className="w-full py-4 rounded-2xl text-white text-lg font-black uppercase tracking-wider bg-red-500 active:scale-95 transition-transform"
            style={{ boxShadow: '0 6px 0 #b91c1c, 0 8px 20px #ef444455' }}
          >
            📷 Scan a team to challenge
          </button>
          <button
            onClick={() => { setError(''); setMode('pick') }}
            className="w-full mt-3 py-3 rounded-2xl text-white/70 text-sm font-bold border border-white/15 hover:bg-white/5 transition-colors"
          >
            No camera? Pick the team instead
          </button>
        </>
      )}

      {mode === 'scan' && (
        <QRScanner
          hint="Point at the other team's contending code"
          onCancel={() => setMode('idle')}
          onResult={(raw) => {
            const parsed = parseDuelQr(raw)
            if (!parsed) { setError('That is not a team\'s contending code.'); setMode('idle'); return }
            if (parsed.sectionId !== sectionId) { setError('That team is playing a different board.'); setMode('idle'); return }
            void start(parsed.teamId)
          }}
        />
      )}

      {mode === 'pick' && (
        <div className="rounded-2xl border border-white/15 bg-gray-950 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest text-white/50">Choose opponent</p>
            <button onClick={() => setMode('idle')} className="text-xs font-bold text-gray-400">Cancel</button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {teams.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No other teams on this board yet.</p>}
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => void start(t.id)}
                className="w-full px-4 py-3 text-left text-white font-bold text-sm hover:bg-white/5 transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-center text-red-400 text-xs font-bold">{error}</p>}
    </div>
  )
}

// ── Live duel — identical on both phones ─────────────────────────────────────

function LiveDuel({
  duel, myTeamId, sectionId, marshalPassword, onResolve, onCancel,
}: {
  duel: BingoDuel
  myTeamId: string
  sectionId: string
  marshalPassword: string
  onResolve: (winnerTeamId: string) => Promise<{ error?: string }>
  onCancel: () => void
}) {
  const game = getContestGame(duel.game_key)
  const [names, setNames] = useState<Record<string, string>>({})
  const [declaring, setDeclaring] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('bingo_teams').select('id, name').eq('section_id', sectionId)
      .then(({ data }) => setNames(Object.fromEntries((data ?? []).map(t => [t.id, t.name]))))
  }, [sectionId])

  const nameOf = (id: string) => names[id] ?? 'Team'
  const iAmChallenger = duel.challenger_team_id === myTeamId

  const declare = async (winnerTeamId: string) => {
    if (pw.trim() !== marshalPassword) { setErr('Wrong marshal password.'); return }
    setDeclaring(true)
    const { error } = await onResolve(winnerTeamId)
    setDeclaring(false)
    if (error) setErr(error)
  }

  return (
    <div className="rounded-3xl border-2 border-red-400/60 bg-red-500/10 overflow-hidden">
      <div className="px-4 py-3 bg-red-500/20 border-b border-red-400/30 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-200">Duel live · #{duel.code}</p>
        <p className="text-white font-black text-base mt-0.5">
          {nameOf(duel.challenger_team_id)} <span className="text-red-300">vs</span> {nameOf(duel.defender_team_id)}
        </p>
        <p className="text-red-200/60 text-[11px] mt-0.5">
          {iAmChallenger ? 'You challenged — this tile crosses off either way' : 'You were challenged — your board is untouched'}
        </p>
      </div>

      <div className="p-5">
        <p className="text-white font-black text-lg text-center">{game.emoji} {game.name}</p>
        <p className="text-white/70 text-sm text-center mt-2 leading-relaxed">{game.clue}</p>

        {/* Shared drawn setup — both phones read the same duel row */}
        {duel.payload?.imageUrl && (
          <div className="mt-4 rounded-2xl overflow-hidden border border-white/15 bg-black">
            <img src={duel.payload.imageUrl} alt={duel.payload.imageLabel ?? 'Target'} className="w-full block" />
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Target image</span>
              <span className="text-xs font-bold text-white/70">{duel.payload.imageLabel}</span>
            </div>
          </div>
        )}

        <ol className="mt-4 space-y-2">
          {game.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-white/80">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white/60 text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 p-3 rounded-2xl bg-amber-400/15 border border-amber-400/40">
          <p className="text-amber-200 text-xs font-black uppercase tracking-wide">To win</p>
          <p className="text-amber-100/80 text-sm mt-1 leading-snug">{game.winCondition}</p>
          <p className="text-amber-200/70 text-xs mt-2 font-bold">Winner takes +{duel.bonus_points} bonus points</p>
        </div>

        {/* Marshal decides. Either phone can be used — the password is the gate. */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">👮</span>
            <p className="text-white font-black text-sm uppercase tracking-wide">Marshal declares the winner</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr('') }}
            placeholder="Marshal password..."
            className="w-full px-4 py-3 rounded-2xl border-2 border-white/20 bg-white/10 text-white text-center font-bold placeholder-white/30 focus:outline-none focus:border-white/50"
          />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[duel.challenger_team_id, duel.defender_team_id].map(id => (
              <button
                key={id}
                onClick={() => void declare(id)}
                disabled={declaring || !pw}
                className="py-3 rounded-2xl text-white text-sm font-black bg-white/10 border border-white/20 disabled:opacity-40 active:scale-95 transition-transform"
              >
                🏆 {nameOf(id)}
              </button>
            ))}
          </div>
          {err && <p className="mt-2 text-center text-red-400 text-xs font-bold">{err}</p>}
          <button onClick={onCancel} className="w-full mt-3 text-[11px] font-bold text-white/30 hover:text-red-300 transition-colors">
            Cancel duel (no points, no cross-off)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Result ───────────────────────────────────────────────────────────────────

function DuelResult({ duel, myTeamId }: { duel: BingoDuel; myTeamId: string }) {
  const won = duel.winner_team_id === myTeamId
  const iAmChallenger = duel.challenger_team_id === myTeamId
  return (
    <div className={`rounded-3xl p-6 border-2 text-center ${won ? 'border-green-400/60 bg-green-400/10' : 'border-white/15 bg-white/5'}`}>
      <div className="text-5xl mb-2">{won ? '🏆' : '🤝'}</div>
      <p className={`font-black text-xl ${won ? 'text-green-300' : 'text-white/70'}`}>
        {won ? 'You won the duel!' : 'Duel lost'}
      </p>
      <p className="text-white/60 text-sm mt-2 leading-snug">
        {won
          ? `+${duel.bonus_points} bonus points added to your score.`
          : 'No bonus this time — the other team took it.'}
        {iAmChallenger && ' This tile is crossed off and its points are yours.'}
      </p>
      <p className="text-white/25 text-[11px] mt-3 font-mono">Duel #{duel.code}</p>
    </div>
  )
}

// ── Incoming challenge banner ────────────────────────────────────────────────
// Lives on the board screen, not the card — the defender is never inside the
// contest card when someone challenges them.

export function IncomingDuelBanner({ team, sectionId }: { team: DuelTeam; sectionId: string }) {
  const { incoming, accept, decline } = useBingoDuels(team.id, sectionId)
  const [challengerNames, setChallengerNames] = useState<Record<string, string>>({})
  const duel = incoming[0] ?? null

  const challengerIds = useMemo(() => incoming.map(d => d.challenger_team_id).join(','), [incoming])
  useEffect(() => {
    if (!challengerIds) return
    supabase.from('bingo_teams').select('id, name').in('id', challengerIds.split(','))
      .then(({ data }) => setChallengerNames(Object.fromEntries((data ?? []).map(t => [t.id, t.name]))))
  }, [challengerIds])

  if (!duel) return null
  const game = getContestGame(duel.game_key)

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="max-w-md mx-auto rounded-3xl border-2 border-red-400/70 bg-gray-950 overflow-hidden shadow-2xl animate-slide-up">
        <div className="px-4 py-3 bg-red-500/20 border-b border-red-400/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-200">You've been challenged!</p>
          <p className="text-white font-black text-lg leading-tight mt-0.5">
            {challengerNames[duel.challenger_team_id] ?? 'Another team'} wants to duel
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-white/80 text-sm font-bold">{game.emoji} {game.name}</p>
          <p className="text-white/50 text-xs mt-1 leading-snug">{game.tagline}</p>
          <p className="text-amber-300 text-xs font-bold mt-2">Win and you take +{duel.bonus_points} bonus points. Your board is untouched.</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => void decline(duel.id)}
              className="py-3 rounded-2xl text-white/60 text-sm font-bold border border-white/15"
            >
              Decline
            </button>
            <button
              onClick={() => void accept(duel.id)}
              className="py-3 rounded-2xl text-white text-sm font-black bg-red-500 active:scale-95 transition-transform"
            >
              Accept duel ⚔️
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
