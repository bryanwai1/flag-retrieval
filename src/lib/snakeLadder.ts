// Snake and Ladder board utilities.

// Board is 10x10, numbered 1-100 in boustrophedon order starting bottom-left.
// Row 0 (bottom): 1..10 left→right
// Row 1:         20..11 right→left (so 11 sits above 10)
// ... etc.

export const BOARD_SIZE = 10
export const TOTAL_TILES = 100

// Default snakes/ladders — applied to new games.
export const DEFAULT_SNAKES: Record<number, number> = {
  99: 41, 95: 75, 87: 24, 64: 60, 62: 19, 56: 53, 49: 11, 16: 6,
}
export const DEFAULT_LADDERS: Record<number, number> = {
  4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100,
}

// Given a tile number 1-100, return {row, col} where row 0 is bottom.
export function tileToRC(n: number): { row: number; col: number } {
  const idx = n - 1
  const row = Math.floor(idx / BOARD_SIZE)
  const rawCol = idx % BOARD_SIZE
  const col = row % 2 === 0 ? rawCol : BOARD_SIZE - 1 - rawCol
  return { row, col }
}

// Convert logical (row, col) with row 0 at bottom to grid position.
// Returns {gridRow, gridCol} with gridRow 1 = top (CSS grid 1-indexed).
export function tileToGridRC(n: number): { gridRow: number; gridCol: number } {
  const { row, col } = tileToRC(n)
  return { gridRow: BOARD_SIZE - row, gridCol: col + 1 }
}

// Apply snake or ladder. Returns the resolved landing position.
export function resolveJump(
  position: number,
  snakes: Record<string | number, number>,
  ladders: Record<string | number, number>,
): { final: number; jump: 'snake' | 'ladder' | null; from: number; to: number } {
  const s = snakes[position] ?? snakes[String(position)]
  if (typeof s === 'number') return { final: s, jump: 'snake', from: position, to: s }
  const l = ladders[position] ?? ladders[String(position)]
  if (typeof l === 'number') return { final: l, jump: 'ladder', from: position, to: l }
  return { final: position, jump: null, from: position, to: position }
}
