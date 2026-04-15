export const BINGO_GRID_SIZE = 25

// All 12 possible bingo lines: 5 rows + 5 cols + 2 diagonals
export const BINGO_LINES: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]

export function buildBingoSlots<T extends { id: string; sort_order: number }>(
  tasks: T[],
  size = BINGO_GRID_SIZE,
): (T | null)[] {
  const slots: (T | null)[] = Array(size).fill(null)
  const overflow: T[] = []
  for (const t of tasks) {
    const s = t.sort_order
    if (Number.isInteger(s) && s >= 0 && s < size && slots[s] === null) slots[s] = t
    else overflow.push(t)
  }
  for (const t of overflow) {
    const i = slots.findIndex(x => x === null)
    if (i !== -1) slots[i] = t
  }
  return slots
}

export function completedBingoLines(
  slots: ({ id: string } | null)[],
  completedIds: Set<string>,
): number[] {
  const out: number[] = []
  BINGO_LINES.forEach((line, i) => {
    const allDone = line.every(idx => {
      const task = slots[idx]
      return !!task && completedIds.has(task.id)
    })
    if (allDone) out.push(i)
  })
  return out
}
