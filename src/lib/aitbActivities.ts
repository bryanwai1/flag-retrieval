// AI Team Building — the 10 activities, ported from the offline Game System app
// (D:\4. Team Building Activities\25. Game library\Game System\index.html).
// Steps are written so "a 6-year-old understands" — keep them short and fun.

export type AitbActivity = {
  id: number
  act: string
  emoji: string
  color: string
  name: string
  outType: string
  desc: string
  steps: string[]
  stepEmojis: string[]
  apps: string[]
  mins: number
  hero: string
}

export const AITB_ACTIVITIES: AitbActivity[] = [
  {
    id: 1, act: '01', emoji: '🎯', color: '#fb7185', name: 'Nerf Prompt Cups',
    outType: 'AI Image',
    desc: 'Shoot cups, reveal secret words, turn them into a wild AI picture!',
    steps: [
      'Shoot 1 red, 1 blue and 1 yellow cup.',
      'Shout the cup numbers to the host!',
      'Watch the big screen — your secret words appear!',
      'Put the 3 words together — that’s your prompt!',
      'Ask AI to make the picture and score points!',
    ],
    stepEmojis: ['🔫', '📢', '📺', '🧩', '🎨'],
    apps: ['Ideogram', 'NanoBanana', 'ChatGPT'], mins: 10, hero: '/aitb/hero1.jpg',
  },
  {
    id: 2, act: '02', emoji: '🕹️', color: '#22d3ee', name: 'Retro Game Speed Build',
    outType: '3 Playable Browser Games',
    desc: 'Fastest team to build 3 working retro games with AI wins!',
    steps: [
      'Pick 1 builder for each game + 1 tester.',
      'Ask AI to build Mario, Pac-Man and Donkey Kong.',
      'You have 15 minutes — go go go!',
      'Test every game — it must really play!',
      'Other team tries your games. Best games win!',
    ],
    stepEmojis: ['🙋', '🤖', '⏱️', '🎮', '🏆'],
    apps: ['AI Studio', 'Canva', 'Antigravity'], mins: 15, hero: '/aitb/hero2.jpg',
  },
  {
    id: 3, act: '03', emoji: '🏰', color: '#a78bfa', name: 'Rubber Band Castle',
    outType: 'AI Castle + Team Composite',
    desc: 'Stack ALL the cups into a castle — no hands, only strings!',
    steps: [
      'Everyone holds ONE string on the rubber band.',
      'Pull together to grab cups — NO hands!',
      'Stack ALL the cups into one castle.',
      'Take a photo of your cup castle.',
      'AI turns it into a REAL castle — with your team on top!',
    ],
    stepEmojis: ['🪢', '🙌', '🏗️', '📸', '🏰'],
    apps: ['NanoBanana', 'ChatGPT', 'Ideogram'], mins: 12, hero: '/aitb/hero3.jpg',
  },
  {
    id: 4, act: '04', emoji: '🌳', color: '#34d399', name: 'Resort Tree App Sprint',
    outType: 'Interactive Web App',
    desc: 'Photograph 6 trees, then build a real tree app with AI!',
    steps: [
      'Find the 6 marked trees around the resort.',
      'Split up and snap photos of each tree.',
      'Run back and build a tree app with AI.',
      'Add fun facts + 1 mini game or quiz.',
      'Share your app with a QR code!',
    ],
    stepEmojis: ['🔍', '📷', '💻', '🧠', '📲'],
    apps: ['Claude', 'Lovable', 'Bolt'], mins: 20, hero: '/aitb/hero4.jpg',
  },
  {
    id: 5, act: '05', emoji: '🎶', color: '#f472b6', name: 'Roulette Jingle & Dance Off',
    outType: 'AI Song + Live Dance',
    desc: 'Spin the wheels, make an AI song, dance it live!',
    steps: [
      'Spin both wheels — keep what you get!',
      'Write a song about your two words.',
      'Make the song with AI (60 seconds).',
      'Invent a dance — EVERYONE joins in.',
      'Perform it live for the crowd!',
    ],
    stepEmojis: ['🎡', '✍️', '🎵', '💃', '🎤'],
    apps: ['Suno', 'Claude', 'ChatGPT'], mins: 15, hero: '/aitb/hero5.jpg',
  },
  {
    id: 6, act: '06', emoji: '🎬', color: '#fbbf24', name: 'Random Card Cinematic',
    outType: 'Cinematic Video',
    desc: '4 surprise cards become one epic AI movie scene!',
    steps: [
      'Tap DRAW and get 4 surprise cards.',
      'No swapping — keep what you get!',
      'Mix all 4 cards into one movie idea.',
      'Ask AI to make your movie scene.',
      'Watch it together on the big screen!',
    ],
    stepEmojis: ['🃏', '🚫', '🎭', '🤖', '🍿'],
    apps: ['Kling', 'Veo', 'Hailuo'], mins: 15, hero: '/aitb/hero6.jpg',
  },
  {
    id: 7, act: '07', emoji: '🏓', color: '#60a5fa', name: 'Ping Pong Alphabet Pitch',
    outType: 'AI Ad Campaign + Pitch',
    desc: 'Bounce balls into letter cups, make 7 words, pitch a crazy AI ad!',
    steps: [
      'Bounce balls into the letter cups — 90 seconds!',
      'Collect at least 7 different letters.',
      'Make 7 words using ALL your letters.',
      'Give the words to AI — it makes a crazy ad!',
      'Pitch your ad like a TV star!',
    ],
    stepEmojis: ['🏓', '🔤', '📝', '🤖', '🌟'],
    apps: ['Claude', 'ChatGPT', 'Ideogram'], mins: 12, hero: '/aitb/hero7.jpg',
  },
  {
    id: 8, act: '08', emoji: '👁️', color: '#f59e0b', name: 'Speed Edit Showdown',
    outType: 'Image Recreation',
    desc: 'Relay-race to recreate the picture on the big screen with AI!',
    steps: [
      'Look at the target picture on the big screen.',
      'Take turns — each member writes the next prompt!',
      'Keep regenerating until it matches.',
      'Show your best picture to the marshal.',
      'Faster ✅ from the marshal = more points!',
    ],
    stepEmojis: ['👀', '🔁', '🎨', '🙋', '⚡'],
    apps: ['NanoBanana', 'Ideogram', 'ChatGPT'], mins: 12, hero: '/aitb/hero8.jpg',
  },
  {
    id: 9, act: '09', emoji: '🐘', color: '#2dd4bf', name: 'Found Object Animals',
    outType: 'Animated Interaction Video',
    desc: 'Build animals from random stuff — AI makes them come ALIVE!',
    steps: [
      'Get your 2 animals (like Tiger + Elephant).',
      'Collect stuff — leaves, shoes, spoons, anything!',
      'Arrange it all into animal shapes on the floor.',
      'Photo it — AI makes them REAL animals!',
      'AI animates your 2 animals playing together.',
    ],
    stepEmojis: ['🦁', '🧺', '🖼️', '📸', '🎬'],
    apps: ['NanoBanana', 'Kling', 'Higgsfield'], mins: 15, hero: '/aitb/hero9.jpg',
  },
  {
    id: 10, act: '10', emoji: '🧭', color: '#c084fc', name: 'Resort Character Journey',
    outType: '10-Scene Travelogue',
    desc: 'One mascot, 10 real resort spots — tell A Day in the Life!',
    steps: [
      'Create ONE cartoon mascot character.',
      'Photo 10 real spots — pool, lobby, spa...',
      'AI puts your mascot in every photo.',
      'Same mascot in all 10 — don’t change it!',
      'Tell the story: A Day in the Life!',
    ],
    stepEmojis: ['🎨', '📷', '🤖', '🔒', '📖'],
    apps: ['NanoBanana', 'ChatGPT', 'Ideogram'], mins: 20, hero: '/aitb/hero10.jpg',
  },
]

export function aitbActivity(id: number): AitbActivity | undefined {
  return AITB_ACTIVITIES.find(a => a.id === id)
}

/* ---------- Scoring (all values in hundreds) ----------
   Timer starts the moment the team checks in (scans the QR and taps start).
   +100  check-in (scan)
   +100  per step ticked (5 steps = 500)
   +300  activity completed (admin password)
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
