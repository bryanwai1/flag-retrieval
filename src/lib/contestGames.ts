// Contest games — the head-to-head duels a competition card can run.
//
// A contest card pairs two teams (challenger scans the defender's QR), then both
// phones unlock the SAME clue and the SAME randomised setup. Everything a game
// needs to be playable lives in this registry, so adding game #2 is one entry
// here plus nothing else: the duel engine, admin picker and player screens all
// read from ContestGame.
//
// `draw()` runs ONCE, on the challenger's phone, at the moment the duel is
// created. Its result is written to bingo_duels.payload and both sides render
// from that row — never re-drawn locally, or the two phones would disagree.

export type ContestPayload = {
  /** Image both teams must recreate, when the game uses one. */
  imageUrl?: string
  imageLabel?: string
}

export type ContestGame = {
  key: string
  name: string
  emoji: string
  /** One line the admin sees in the game picker. */
  tagline: string
  /** Shown to BOTH teams the moment the duel goes live. */
  clue: string
  /** Numbered instructions, identical on both phones. */
  steps: string[]
  /** The exact bar a team must clear to be declared the winner. */
  winCondition: string
  /** Rough minutes, shown as guidance — the duel itself is not timed by the app. */
  mins: number
  draw: () => ContestPayload
}

// ── Speed Edit target images ──────────────────────────────────────────────────
// Both teams race to recreate the SAME picture with AI. Styles are deliberately
// varied so a team can't reuse one winning prompt across duels.
export const SPEED_EDIT_IMAGES: { img: string; label: string }[] = [
  { img: '/gamesystem/edit1.jpg', label: '3D cartoon' },
  { img: '/gamesystem/edit2.jpg', label: 'Photorealistic' },
  { img: '/gamesystem/edit3.jpg', label: 'Pixel art' },
  { img: '/gamesystem/edit4.jpg', label: 'Watercolor' },
  { img: '/gamesystem/edit5.jpg', label: 'Claymation' },
  { img: '/gamesystem/edit6.jpg', label: 'Comic book' },
  { img: '/gamesystem/edit7.jpg', label: 'Paper cutout' },
  { img: '/gamesystem/edit8.jpg', label: 'Neon glow' },
  { img: '/gamesystem/edit9.jpg', label: 'Crayon drawing' },
  { img: '/gamesystem/edit10.jpg', label: 'Origami' },
  // Bryan wants 15. edit11–15 (stained glass, isometric miniature, synthwave,
  // blueprint line art, felt plush) still need generating — they are left out
  // rather than shipped as broken images, since draw() picks uniformly and a
  // missing file would blank the target on roughly one duel in three.
]

export const CONTEST_GAMES: ContestGame[] = [
  {
    key: 'speed-edit',
    name: 'Speed Edit Competition',
    emoji: '👁️',
    tagline: 'Both teams race to recreate the same image with AI. First to 80–100% wins.',
    clue: 'Recreate this picture with AI — as close as you can, as fast as you can. First team to get the marshal\'s ✅ wins the card.',
    steps: [
      'Look at the target image below — both teams get the exact same one.',
      'Use any AI image tool to recreate it. Take turns writing prompts!',
      'Keep regenerating until it looks 80–100% the same.',
      'Show the marshal your picture next to the target.',
      'The marshal says YES to the first team that hits 80–100% — that team wins.',
    ],
    winCondition: '80–100% similarity to the target image, approved by the marshal. First approval wins.',
    mins: 12,
    draw: () => {
      const pick = SPEED_EDIT_IMAGES[Math.floor(Math.random() * SPEED_EDIT_IMAGES.length)]
      return { imageUrl: pick.img, imageLabel: pick.label }
    },
  },
]

export function getContestGame(key: string | null | undefined): ContestGame {
  return CONTEST_GAMES.find(g => g.key === key) ?? CONTEST_GAMES[0]
}
