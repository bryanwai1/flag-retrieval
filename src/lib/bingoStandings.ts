import { buildBingoSlots, completedBingoLines } from './bingoLines'
import { duelBonusByTeam } from '../hooks/useBingoDuels'
import type { BingoTask, BingoTeam, BingoScan, BingoDuel } from '../types/database'

/**
 * The only scan columns a score depends on. Callers that fetch standings for
 * many teams select just these — a full row carries `words` (the AITB draw
 * results), which is dead weight on a phone refetching every team's scans.
 */
export type ScoringScan = Pick<BingoScan, 'team_id' | 'task_id' | 'completed' | 'completed_at'>

export type BingoStandingRow = {
  team: BingoTeam
  /** Tile points + contest bonuses won in duels — everything earned in play. */
  points: number
  /** Contest bonus alone, so the board can show where a duel win landed. */
  duelBonus: number
  /** Manual bonus the admin adds during the award ceremony. */
  bonus: number
  bingos: number
  tasksDone: number
  /**
   * When this team last scored — the moment they reached their current total.
   * Ties are broken in favour of whoever got there first, so a team that
   * matches the leader later does not leapfrog them. Infinity = never scored.
   */
  reachedAt: number
}

/**
 * The one place a team's Bingo Dash score is worked out, so the projector, the
 * admin table and the players' live scoreboard can never disagree.
 */
export function computeBingoStandings({
  teams,
  gridTasks,
  scans,
  duels,
}: {
  teams: BingoTeam[]
  /** Cards actually placed on this board, in slot order. */
  gridTasks: BingoTask[]
  scans: ScoringScan[]
  /** Resolved duels (status 'done'). */
  duels: BingoDuel[]
}): BingoStandingRow[] {
  const slots = buildBingoSlots(gridTasks)
  const gridTaskIds = new Set(gridTasks.map(t => t.id))
  // Contest bonuses won in duels. A winning DEFENDER has no tile to hang points
  // on, so this is the only place their win shows up.
  const duelBonuses = duelBonusByTeam(duels)

  return teams.map(team => {
    const teamScans = scans.filter(s => s.team_id === team.id)
    const completedIds = new Set(
      teamScans.filter(s => s.completed && gridTaskIds.has(s.task_id)).map(s => s.task_id),
    )
    const tilePoints = gridTasks.reduce(
      (sum, t) => completedIds.has(t.id) ? sum + (t.points ?? 0) : sum, 0,
    )
    const duelBonus = duelBonuses.get(team.id) ?? 0
    const lastScan = teamScans.reduce((latest, s) => {
      if (!s.completed || !gridTaskIds.has(s.task_id) || !s.completed_at) return latest
      return Math.max(latest, Date.parse(s.completed_at))
    }, 0)
    // A duel win is a scoring moment too, so it counts for tie-breaking.
    const lastDuel = duels.reduce((latest, d) => {
      if (d.winner_team_id !== team.id || !d.resolved_at) return latest
      return Math.max(latest, Date.parse(d.resolved_at))
    }, 0)
    const reachedAt = Math.max(lastScan, lastDuel)
    return {
      team,
      points: tilePoints + duelBonus,
      duelBonus,
      bonus: team.bonus_points ?? 0,
      bingos: completedBingoLines(slots, completedIds).length,
      tasksDone: completedIds.size,
      reachedAt: reachedAt || Infinity,
    }
  })
}

/** Rank the rows in place, newest-first on score and earliest-first on ties. */
export function sortBingoStandings(rows: BingoStandingRow[], includeBonus: boolean): BingoStandingRow[] {
  const scoreOf = (r: BingoStandingRow) => includeBonus ? r.points + r.bonus : r.points
  return rows.sort((a, b) => {
    if (scoreOf(b) !== scoreOf(a)) return scoreOf(b) - scoreOf(a)
    if (b.bingos !== a.bingos) return b.bingos - a.bingos
    if (b.tasksDone !== a.tasksDone) return b.tasksDone - a.tasksDone
    // Dead heat on every score component: first to get there stays ahead.
    return a.reachedAt - b.reachedAt
  })
}
