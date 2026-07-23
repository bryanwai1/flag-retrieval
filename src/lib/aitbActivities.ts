// AI Team Building — the 10 activities, ported from the offline Game System app
// (D:\4. Team Building Activities\25. Game library\Game System\index.html).
// Steps are written so "a 6-year-old understands" — keep them short and fun.
// tagline = one punchy line; desc = full facilitator description; learning = outcome.

export type AitbActivity = {
  id: number
  act: string
  emoji: string
  color: string
  name: string
  outType: string
  tagline: string
  desc: string
  learning: string
  steps: string[]
  stepEmojis: string[]
  apps: string[]
  mins: number
  hero: string
  /** Physical props the marshal hands the team at this station. Empty = phones only. */
  props: string[]
}

export const AITB_ACTIVITIES: AitbActivity[] = [
  {
    id: 1, act: '01', emoji: '🎯', color: '#fb7185', name: 'Nerf Prompt Cups',
    outType: 'AI Image',
    tagline: 'Shoot cups, reveal secret words, turn them into a wild AI picture!',
    desc: 'Three separate sets of coloured cups — Red = Character, Blue = Action, Yellow = Scene. Teams shoot one cup from each set and reveal a hidden slip inside. The combination becomes their prompt for a wild AI image.',
    learning: 'Precision, role delegation, and reveal-based creative problem-solving.',
    steps: [
      'Shoot 1 red, 1 blue and 1 yellow cup.',
      'Shout the cup numbers to the host!',
      'Watch the big screen — your secret words appear!',
      'Put the 3 words together — that’s your prompt!',
      'Ask AI to make the picture and score points!',
    ],
    stepEmojis: ['🔫', '📢', '📺', '🧩', '🎨'],
    apps: ['Ideogram', 'NanoBanana', 'ChatGPT'], mins: 10, hero: '/aitb/hero1.jpg',
    props: ['Nerf blaster + darts', 'Red / blue / yellow cup sets (numbered)', 'Secret word slips inside each cup', 'Table to line up the cups'],
  },
  {
    id: 2, act: '02', emoji: '🕹️', color: '#22d3ee', name: 'Retro Game Speed Build',
    outType: '3 Playable Browser Games',
    tagline: 'Fastest team to build 3 working retro games with AI wins!',
    desc: 'Fastest team to build 3 working browser games — Super Mario, Pac-Man, Donkey Kong — wins. Teams choose which AI tool for each game and work in parallel. A game only counts if it actually plays.',
    learning: 'Parallel workflow, tool selection strategy, and rapid QA under pressure.',
    steps: [
      'Pick 1 builder for each game + 1 tester.',
      'Ask AI to build Mario, Pac-Man and Donkey Kong.',
      'You have 15 minutes — go go go!',
      'Test every game — it must really play!',
      'Other team tries your games. Best games win!',
    ],
    stepEmojis: ['🙋', '🤖', '⏱️', '🎮', '🏆'],
    apps: ['AI Studio', 'Canva', 'Antigravity'], mins: 15, hero: '/aitb/hero2.jpg',
    props: [],
  },
  {
    id: 3, act: '03', emoji: '🏰', color: '#a78bfa', name: 'Rubber Band Castle',
    outType: 'AI Castle + Team Composite',
    tagline: 'Stack ALL the cups into a castle — no hands, only strings!',
    desc: 'One rubber band with 6-8 strings tied around it — each team member holds ONE string. No hands may touch the cups. ALL cups must be stacked into the castle. AI then transforms the cup castle into a real one with the team on top.',
    learning: 'Non-verbal coordination, tension calibration, and full-team completion under constraint.',
    steps: [
      'Everyone holds ONE string on the rubber band.',
      'Pull together to grab cups — NO hands!',
      'Stack ALL the cups into one castle.',
      'Take a photo of your cup castle.',
      'AI turns it into a REAL castle — with your team on top!',
    ],
    stepEmojis: ['🪢', '🙌', '🏗️', '📸', '🏰'],
    apps: ['NanoBanana', 'ChatGPT', 'Ideogram'], mins: 12, hero: '/aitb/hero3.jpg',
    props: ['Rubber band with 6–8 strings tied on', 'Stack of cups (8–10) for the castle'],
  },
  {
    id: 4, act: '04', emoji: '🌳', color: '#34d399', name: 'Resort Tree App Sprint',
    outType: 'Interactive Web App',
    tagline: 'Photograph 6 trees, then build a real tree app with AI!',
    desc: 'Team splits up to photograph 6 pre-marked trees around the resort, then races back to build a real, deployable interactive web app showcasing all 6 trees with facts, photos, and one interactive element.',
    learning: 'Distributed exploration, focused technical collaboration, and shipping real products fast.',
    steps: [
      'Find the 6 marked trees around the resort.',
      'Split up and snap photos of each tree.',
      'Run back and build a tree app with AI.',
      'Add fun facts + 1 mini game or quiz.',
      'Share your app with a QR code!',
    ],
    stepEmojis: ['🔍', '📷', '💻', '🧠', '📲'],
    apps: ['Claude', 'Lovable', 'Bolt'], mins: 20, hero: '/aitb/hero4.jpg',
    props: ['6 numbered tree marker tags (hang around resort BEFORE the game)'],
  },
  {
    id: 5, act: '05', emoji: '🎶', color: '#f472b6', name: 'Roulette Jingle & Dance Off',
    outType: 'AI Song + Live Dance',
    tagline: 'Spin the wheels, make an AI song, dance it live!',
    desc: 'Two roulette wheels: one picks the genre (K-pop, dangdut, Bollywood...), one picks the mandatory topic (nasi lemak, KPI targets, the boss). Team writes lyrics, generates the song in Suno, then choreographs a live team dance.',
    learning: 'Creative negotiation, vulnerability unlock, and shared physical expression.',
    steps: [
      'Spin both wheels — keep what you get!',
      'Write a song about your two words.',
      'Make the song with AI (60 seconds).',
      'Invent a dance — EVERYONE joins in.',
      'Perform it live for the crowd!',
    ],
    stepEmojis: ['🎡', '✍️', '🎵', '💃', '🎤'],
    apps: ['Suno', 'Claude', 'ChatGPT'], mins: 15, hero: '/aitb/hero5.jpg',
    props: ['Portable speaker (play the AI song for the dance)'],
  },
  {
    id: 6, act: '06', emoji: '🎬', color: '#fbbf24', name: 'Random Card Cinematic',
    outType: 'Cinematic Video',
    tagline: '4 surprise cards become one epic AI movie scene!',
    desc: 'A digital random card app deals 4 wildcards to each team — Country/Civilization, Character, Scene, Cinematic Style. No re-draws. Team assembles the four elements into a cinematic prompt and generates a short historical epic movie scene.',
    learning: 'Collective decision-making, negotiation, and creative reconciliation of random constraints.',
    steps: [
      'Tap DRAW and get 4 surprise cards.',
      'No swapping — keep what you get!',
      'Mix all 4 cards into one movie idea.',
      'Ask AI to make your movie scene.',
      'Watch it together on the big screen!',
    ],
    stepEmojis: ['🃏', '🚫', '🎭', '🤖', '🍿'],
    apps: ['Kling', 'Veo', 'Hailuo'], mins: 15, hero: '/aitb/hero6.jpg',
    props: [],
  },
  {
    id: 7, act: '07', emoji: '🏓', color: '#60a5fa', name: 'Ping Pong Alphabet Pitch',
    outType: 'AI Ad Campaign + Pitch',
    tagline: 'Bounce balls into letter cups, make 7 words, pitch a crazy AI ad!',
    desc: '26 cups labelled A–Z. Teams bounce ping pong balls into the cups — must land in at least 7 different cups. Team then builds 7 words that together include ALL 7 collected letters. Those words become mandatory ingredients for a wild AI ad campaign, pitched live Shark-Tank style.',
    learning: 'Constraint-driven creativity, prompt engineering under limits, and live pitch performance.',
    steps: [
      'Bounce balls into the letter cups — 90 seconds!',
      'Collect at least 7 different letters.',
      'Make 7 words using ALL your letters.',
      'Give the words to AI — it makes a crazy ad!',
      'Pitch your ad like a TV star!',
    ],
    stepEmojis: ['🏓', '🔤', '📝', '🤖', '🌟'],
    apps: ['Claude', 'ChatGPT', 'Ideogram'], mins: 12, hero: '/aitb/hero7.jpg',
    props: ['26 cups labelled A–Z', 'Ping pong balls (6+)', 'Table for the cup grid'],
  },
  {
    id: 8, act: '08', emoji: '👁️', color: '#f59e0b', name: 'Speed Edit Showdown',
    outType: 'Image Recreation',
    tagline: 'Relay-race to recreate the picture on the big screen with AI!',
    desc: 'A target image goes up on the big screen. Team members take turns — relay style — each writing the next prompt to recreate it with AI. Race to submit: the faster your picture gets the marshal’s ✅, the more points you score.',
    learning: 'Turn-taking, observation, and reverse prompt engineering under time pressure.',
    steps: [
      'Look at the target picture on the big screen.',
      'Take turns — each member writes the next prompt!',
      'Keep regenerating until it matches.',
      'Show your best picture to the marshal.',
      'Faster ✅ from the marshal = more points!',
    ],
    stepEmojis: ['👀', '🔁', '🎨', '🙋', '⚡'],
    apps: ['NanoBanana', 'Ideogram', 'ChatGPT'], mins: 12, hero: '/aitb/hero8.jpg',
    props: [],
  },
  {
    id: 9, act: '09', emoji: '🐘', color: '#2dd4bf', name: 'Found Object Animals',
    outType: 'Animated Interaction Video',
    tagline: 'Build animals from random stuff — AI makes them come ALIVE!',
    desc: 'Each team gets 2 animal archetypes. Teams gather random found objects and arrange them flat on the ground to form the shape of each animal. Photograph, use AI to bring the shape to life as a realistic animal, then animate the two animals interacting.',
    learning: 'Creative resourcefulness, spatial composition, and full AI pipeline from flat-lay to motion.',
    steps: [
      'Get your 2 animals (like Tiger + Elephant).',
      'Collect stuff — leaves, shoes, spoons, anything!',
      'Arrange it all into animal shapes on the floor.',
      'Photo it — AI makes them REAL animals!',
      'AI animates your 2 animals playing together.',
    ],
    stepEmojis: ['🦁', '🧺', '🖼️', '📸', '🎬'],
    apps: ['NanoBanana', 'Kling', 'Higgsfield'], mins: 15, hero: '/aitb/hero9.jpg',
    props: ['2 animal archetype cards per team', 'Collection basket for found objects'],
  },
  {
    id: 10, act: '10', emoji: '🧭', color: '#c084fc', name: 'Resort Character Journey',
    outType: '10-Scene Travelogue',
    tagline: 'One mascot, 10 real resort spots — tell A Day in the Life!',
    desc: 'Team designs ONE cartoon mascot character. Split up to photograph 10 real resort locations. Use AI to place the SAME cartoon character into each REAL background photo. Present as a “Day in the Life” resort marketing campaign.',
    learning: 'Grand finale synthesis — storytelling, character consistency, and real-world compositing.',
    steps: [
      'Create ONE cartoon mascot character.',
      'Photo 10 real spots — pool, lobby, spa...',
      'AI puts your mascot in every photo.',
      'Same mascot in all 10 — don’t change it!',
      'Tell the story: A Day in the Life!',
    ],
    stepEmojis: ['🎨', '📷', '🤖', '🔒', '📖'],
    apps: ['NanoBanana', 'ChatGPT', 'Ideogram'], mins: 20, hero: '/aitb/hero10.jpg',
    props: [],
  },
]

export function aitbActivity(id: number): AitbActivity | undefined {
  return AITB_ACTIVITIES.find(a => a.id === id)
}

/* ---------- Scoring (all values in hundreds) ----------
   Timer starts the moment the team checks in (scans the QR and taps start).
   +100  check-in (scan)
   +100  per step ticked (5 steps = 500)
   +300  activity completed (marshal password)
   +bonus speed bonus on completion, based on elapsed vs the activity's minutes:
         ≤50% time → +500 · ≤75% → +400 · ≤100% → +300 · ≤125% → +200 · else +100
   Max per activity: 1400 pts                                            */
export const AITB_POINTS = { scan: 100, step: 100, complete: 300 } as const

export function aitbSpeedBonus(elapsedMs: number, mins: number): number {
  const frac = elapsedMs / (mins * 60_000)
  if (frac <= 0.5) return 500
  if (frac <= 0.75) return 400
  if (frac <= 1.0) return 300
  if (frac <= 1.25) return 200
  return 100
}

export function aitbProgressPoints(p: {
  scanned_at: string | null
  steps_done: number[] | null
  completed_at: string | null
  bonus: number | null
}): number {
  let pts = 0
  if (p.scanned_at) pts += AITB_POINTS.scan
  pts += (p.steps_done?.length ?? 0) * AITB_POINTS.step
  if (p.completed_at) pts += AITB_POINTS.complete + (p.bonus ?? 0)
  return pts
}
