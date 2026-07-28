// AI Team Building — the 10 activities, ported from the offline Game System app
// (D:\4. Team Building Activities\25. Game library\Game System\index.html).
// Steps are written so "a 6-year-old understands" — keep them short and fun.
// tagline = one punchy line; desc = full facilitator description; learning = outcome.

// Interactive in-app systems on the mission page. Each stores its result into
// aitb_progress.words (positions match AITB_MODULE_SLOTS) → live in the admin.
export type AitbModule = 'cups' | 'roulette' | 'cards' | 'animals'

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
  /** Hand-set challenge tier shown on the draw cards. Decoupled from `mins` so a
   *  quick activity can still read Hard (and a long one Easy). */
  difficulty: 'Easy' | 'Normal' | 'Hard'
  /** Physical props the marshal hands the team at this station. Empty = phones only. */
  props: string[]
  /** When set, the mission page shows word inputs the team fills in; submissions
   *  land on aitb_progress.words and appear live in the admin panel. */
  wordsInput?: { count: number; title: string; hint: string; labels?: string[] }
  /** Speed-bonus milestones, unique per game. Ascending absolute minutes from
   *  check-in: finish within uptoMin → earn pts; past the last tier → 0. */
  bonusTiers: { uptoMin: number; pts: number }[]
  /** Playable reference games shown as buttons on the mission page (act 02). */
  demos?: { emoji: string; label: string; sub: string; url: string }[]
  /** Sample photo gallery shown on the mission page (act 08 target images). */
  gallery?: { img: string; label: string }[]
  /** Optional reassuring disclaimer shown as a callout on the mission page. */
  note?: string
  /** Interactive in-app system rendered on the mission page (Nerf cup picker,
   *  roulette spin, card / animal draw). Results save to aitb_progress.words. */
  module?: AitbModule
}

/* ── AI tool registry ────────────────────────────────────────────────────────
   Every name in an activity's `apps` list is looked up here so the mission page,
   the projector briefing and the admin can render it as a real button that opens
   the tool in the player's browser. A name with no entry (or no url) still shows
   as a plain pill, so adding a tool name never breaks a screen.
   `note` is surfaced once per screen, grouped — e.g. "Sign in with Google". */
export type AitbApp = { url: string; note?: string; sub?: string }

export const AITB_APPS: Record<string, AitbApp> = {
  // Battle-mode arena — one place to make an image OR a video, models side by side
  'Arena':      { url: 'https://arena.ai', sub: 'Battle mode → Image or Video' },
  // Music
  'Suno':       { url: 'https://suno.com', sub: 'AI song in ~60 seconds' },
  // App / game building (all Google sign-in except Kimi)
  'AI Studio':  { url: 'https://aistudio.google.com', note: 'Sign in with your Google account', sub: 'Google AI Studio' },
  'Canva AI':   { url: 'https://www.canva.com', note: 'Sign in with your Google account', sub: 'Magic Studio / Canva Code' },
  'Antigravity':{ url: 'https://antigravity.google', note: 'Sign in with your Google account', sub: 'Google’s agentic builder' },
  'Kimi':       { url: 'https://www.kimi.com', sub: 'Free — no Google needed' },
  // General chat assistants (also great for images)
  'ChatGPT':    { url: 'https://chatgpt.com' },
  'Gemini':     { url: 'https://gemini.google.com', note: 'Sign in with your Google account' },
  'Copilot':    { url: 'https://copilot.microsoft.com' },
  'Claude':     { url: 'https://claude.ai' },
  // Image
  'Nano Banana':{ url: 'https://gemini.google.com', note: 'Sign in with your Google account', sub: 'Gemini’s image model' },
  'Ideogram':   { url: 'https://ideogram.ai' },
  // Video
  'Kling':      { url: 'https://app.klingai.com' },
  'Veo (Flow)': { url: 'https://labs.google/fx/tools/flow', note: 'Sign in with your Google account', sub: 'Google Flow' },
  'Higgsfield': { url: 'https://higgsfield.ai' },
  // Web-app builders
  'Lovable':    { url: 'https://lovable.dev' },
  'Bolt':       { url: 'https://bolt.new' },
}

export function aitbApp(name: string): AitbApp | undefined {
  return AITB_APPS[name]
}

/** Unique `note` lines for a set of app names, so a screen can show the
 *  "Sign in with your Google account" hint once instead of per button. */
export function aitbAppNotes(names: string[]): string[] {
  const seen = new Set<string>()
  for (const n of names) {
    const note = AITB_APPS[n]?.note
    if (note) seen.add(note)
  }
  return [...seen]
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
    apps: ['Arena', 'ChatGPT', 'Gemini', 'Copilot', 'Ideogram'], mins: 10, hero: '/aitb/hero1.jpg', difficulty: 'Easy',
    props: ['Nerf blaster + darts', 'Red / blue / yellow cup sets (numbered)', 'Secret word slips inside each cup', 'Table to line up the cups'],
    module: 'cups',
    bonusTiers: [{ uptoMin: 2.5, pts: 1000 }, { uptoMin: 5, pts: 800 }, { uptoMin: 7.5, pts: 600 }, { uptoMin: 10, pts: 400 }, { uptoMin: 12.5, pts: 200 }],
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
    apps: ['AI Studio', 'Canva AI', 'Antigravity', 'Kimi'], mins: 15, hero: '/aitb/hero2.jpg', difficulty: 'Hard',
    props: [],
    demos: [
      { emoji: '🍄', label: 'Super Jumpman', sub: 'the Mario one', url: '/gamesystem/index.html?v=2#/play/jump' },
      { emoji: '👻', label: 'Chomp Maze', sub: 'the Pac-Man one', url: '/gamesystem/index.html?v=2#/play/chomp' },
      { emoji: '🦍', label: 'Barrel Climb', sub: 'the Donkey Kong one', url: '/gamesystem/index.html?v=2#/play/barrel' },
    ],
    bonusTiers: [{ uptoMin: 4, pts: 1000 }, { uptoMin: 8, pts: 800 }, { uptoMin: 11, pts: 600 }, { uptoMin: 15, pts: 400 }, { uptoMin: 19, pts: 200 }],
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
    apps: ['Arena', 'ChatGPT', 'Gemini', 'Copilot', 'Nano Banana'], mins: 12, hero: '/aitb/hero3.jpg', difficulty: 'Normal',
    props: ['Rubber band with 6–8 strings tied on', 'Stack of cups (8–10) for the castle'],
    bonusTiers: [{ uptoMin: 3, pts: 1000 }, { uptoMin: 6, pts: 800 }, { uptoMin: 9, pts: 600 }, { uptoMin: 12, pts: 400 }, { uptoMin: 15, pts: 200 }],
  },
  {
    id: 4, act: '04', emoji: '🌳', color: '#34d399', name: 'Resort Tree App Sprint',
    outType: 'Interactive Web App',
    tagline: 'Photograph 6 trees, then build a real tree app with AI!',
    desc: 'Team splits up to photograph any 6 different trees around the vicinity, then races back to build a real, deployable interactive web app showcasing all 6 trees with facts, photos, and one interactive element.',
    learning: 'Distributed exploration, focused technical collaboration, and shipping real products fast.',
    steps: [
      'Find any 6 different trees around the vicinity.',
      'Split up and snap photos of each tree.',
      'Run back and build a tree app with AI.',
      'Add fun facts + 1 mini game or quiz.',
      'Share your app with a QR code!',
    ],
    stepEmojis: ['🔍', '📷', '💻', '🧠', '📲'],
    apps: ['Canva AI', 'AI Studio', 'Antigravity', 'Kimi', 'Claude'], mins: 20, hero: '/aitb/hero4.jpg', difficulty: 'Hard',
    props: [],
    note: "📸 Can't get the tree photos into your app? No worries — that's totally okay! Just focus on the facts and your mini game or quiz.",
    bonusTiers: [{ uptoMin: 5, pts: 1000 }, { uptoMin: 10, pts: 800 }, { uptoMin: 15, pts: 600 }, { uptoMin: 20, pts: 400 }, { uptoMin: 25, pts: 200 }],
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
    apps: ['Suno', 'ChatGPT', 'Claude'], mins: 15, hero: '/aitb/hero5.jpg', difficulty: 'Normal',
    props: ['Portable speaker (play the AI song for the dance)'],
    module: 'roulette',
    bonusTiers: [{ uptoMin: 4, pts: 1000 }, { uptoMin: 8, pts: 800 }, { uptoMin: 11, pts: 600 }, { uptoMin: 15, pts: 400 }, { uptoMin: 19, pts: 200 }],
  },
  {
    id: 6, act: '06', emoji: '🎬', color: '#fbbf24', name: 'Random Card Cinematic',
    outType: 'Cinematic Video',
    tagline: '4 surprise cards become one epic AI movie scene!',
    desc: 'A digital random card app deals 4 wildcards to each team — Country/Civilization, Character, Scene, Cinematic Style. No re-draws. Two teammates must star in the scene as the actors, so the team photographs them and works their faces into the shot. Team assembles the four elements into a cinematic prompt and generates a short historical epic movie scene.',
    learning: 'Collective decision-making, negotiation, and creative reconciliation of random constraints.',
    steps: [
      'Tap DRAW — no swaps, keep all 4 cards!',
      'Pick 2 teammates to star as your actors.',
      'Mix the cards + your actors into one movie idea.',
      'Ask AI to make your movie scene.',
      'Watch it together on the big screen!',
    ],
    stepEmojis: ['🃏', '🎭', '💡', '🤖', '🍿'],
    apps: ['Arena', 'Kling', 'Veo (Flow)', 'Higgsfield'], mins: 15, hero: '/aitb/hero6.jpg', difficulty: 'Normal',
    props: [],
    module: 'cards',
    bonusTiers: [{ uptoMin: 4, pts: 1000 }, { uptoMin: 8, pts: 800 }, { uptoMin: 11, pts: 600 }, { uptoMin: 15, pts: 400 }, { uptoMin: 19, pts: 200 }],
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
    apps: ['Arena', 'ChatGPT', 'Gemini', 'Copilot', 'Claude'], mins: 12, hero: '/aitb/hero7.jpg', difficulty: 'Normal',
    props: ['26 cups labelled A–Z', 'Ping pong balls (6+)', 'Table for the cup grid'],
    wordsInput: { count: 7, title: '🔤 Your 7 words', hint: 'Type the 7 words that use ALL your collected letters!' },
    bonusTiers: [{ uptoMin: 3, pts: 1000 }, { uptoMin: 6, pts: 800 }, { uptoMin: 9, pts: 600 }, { uptoMin: 12, pts: 400 }, { uptoMin: 15, pts: 200 }],
  },
  {
    id: 8, act: '08', emoji: '👁️', color: '#f59e0b', name: 'Speed Edit Showdown',
    outType: 'Image Recreation',
    tagline: 'Relay-race to recreate the picture on the big screen with AI!',
    desc: 'A target image goes up on the big screen. Team members take turns — relay style — each writing the next prompt to recreate it with AI. Race to submit: the faster your picture gets the marshal’s ✅, the more points you score.',
    learning: 'Turn-taking, observation, and reverse prompt engineering under time pressure.',
    steps: [
      'Pick a target picture from the gallery below.',
      'Take turns — each member writes the next prompt!',
      'Keep regenerating until it matches.',
      'Show the marshal your picture AND your prompt!',
      'Faster ✅ from the marshal = more points!',
    ],
    stepEmojis: ['👀', '🔁', '🎨', '🙋', '⚡'],
    apps: ['Arena', 'ChatGPT', 'Gemini', 'Copilot', 'Nano Banana'], mins: 12, hero: '/aitb/hero8.jpg', difficulty: 'Easy',
    props: [],
    gallery: [
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
    ],
    bonusTiers: [{ uptoMin: 3, pts: 1000 }, { uptoMin: 6, pts: 800 }, { uptoMin: 9, pts: 600 }, { uptoMin: 12, pts: 400 }, { uptoMin: 15, pts: 200 }],
  },
  {
    id: 9, act: '09', emoji: '🐘', color: '#2dd4bf', name: 'Found Object Animals',
    outType: 'Animated Interaction Video',
    tagline: 'Draw 2 surprise animals — build them, then bring them to life with AI!',
    desc: 'Tap the in-app randomizer to get 2 surprise animals. Recreate each one from physical items found indoors or outdoors — or simply draw them. Photograph your creations, use AI to bring them to life as realistic animals, then animate the two interacting.',
    learning: 'Creative resourcefulness, spatial composition, and full AI pipeline from flat-lay to motion.',
    steps: [
      'Tap DRAW to get your 2 surprise animals!',
      'Build each from found items (indoors/outdoors) — or draw them!',
      'Finish both animal shapes and snap a photo.',
      'Photo it — AI makes them REAL animals!',
      'AI animates your 2 animals playing together.',
    ],
    stepEmojis: ['🎲', '🧺', '🖼️', '📸', '🎬'],
    apps: ['Arena', 'Nano Banana', 'Gemini', 'Kling', 'Higgsfield'], mins: 15, hero: '/aitb/hero9.jpg', difficulty: 'Hard',
    props: ['Collection basket for found objects', 'Paper + markers (for teams who prefer to draw)'],
    module: 'animals',
    bonusTiers: [{ uptoMin: 4, pts: 1000 }, { uptoMin: 8, pts: 800 }, { uptoMin: 11, pts: 600 }, { uptoMin: 15, pts: 400 }, { uptoMin: 19, pts: 200 }],
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
    apps: ['Arena', 'ChatGPT', 'Gemini', 'Copilot', 'Nano Banana'], mins: 20, hero: '/aitb/hero10.jpg', difficulty: 'Hard',
    props: [],
    bonusTiers: [{ uptoMin: 5, pts: 1000 }, { uptoMin: 10, pts: 800 }, { uptoMin: 15, pts: 600 }, { uptoMin: 20, pts: 400 }, { uptoMin: 25, pts: 200 }],
  },
]

export function aitbActivity(id: number): AitbActivity | undefined {
  return AITB_ACTIVITIES.find(a => a.id === id)
}

/** How many missions a team may have running at once. Enforced on the board and
 *  again on the mission page, so opening a mission directly can't beat the cap. */
export const AITB_MAX_ACTIVE = 2

/* ── Interactive module content (ported from the offline Game System) ───────── */
export const AITB_POOLS = {
  cupCharacter: ['A grumpy astronaut', 'A disco unicorn', 'A samurai chef', 'A robot grandma', 'A ninja penguin', 'A wizard toddler', 'A pirate librarian', 'A cyborg cat', 'A viking ballerina', 'A detective sloth', 'A superhero janitor', 'A vampire barista'],
  cupAction: ['riding a rocket', 'breakdancing', 'brewing potions', 'surfing on lava', 'juggling planets', 'escaping a maze', 'taming a dragon', 'stealing a giant cookie', 'arm-wrestling a bear', 'painting the sky', 'deep-sea diving', 'racing a cheetah'],
  cupScene: ['in a neon jungle', 'on the moon', 'inside a volcano', 'in a candy kingdom', 'in an underwater city', 'in a haunted mansion', 'atop a skyscraper', 'in a desert oasis', 'in a cyberpunk market', 'in an ancient temple', 'on a floating island', 'in a frozen tundra'],
  genre: ['K-Pop', 'Dangdut', 'Bollywood', 'EDM Anthem', 'Country Ballad', 'Opera', 'Hip-Hop', 'Reggae', 'Smooth Jazz', '70s Disco', 'Lo-fi Chill', 'Broadway Musical', 'Acoustic Café', 'Joget', 'Nursery Rhyme'],
  topic: ['Nasi Lemak', 'KPI Targets', 'The Boss', 'Monday Mornings', 'The Office Coffee', 'Traffic Jams', 'The Team WhatsApp Group', 'The Broken Printer', 'Working Overtime', 'Annual Leave', 'Endless Zoom Calls', 'The Company Canteen', 'Impossible Deadlines', 'Teh Tarik'],
  country: ['Ancient Egypt', 'The Roman Empire', 'Feudal Japan', 'The Aztec Empire', 'Viking Norse', 'Ancient Greece', 'Mughal India', 'Ming Dynasty China', 'The Ottoman Empire', 'The Mali Empire', 'Babylon', 'The Inca Empire'],
  cardChar: ['A Warrior Queen', 'An Exiled Prince', 'A Blind Prophet', 'A Rogue General', 'A Young Blacksmith', 'A Court Jester', 'A Masked Assassin', 'A Wandering Monk', 'A Pirate Captain', 'A Fallen Knight', 'A Street Orphan', 'A High Priestess'],
  cardScene: ['A burning city', 'A royal coronation', 'A desert ambush', 'A stormy sea battle', 'A secret tunnel escape', 'A grand feast betrayal', 'A duel at dawn', 'A sacred temple ritual', 'A crowded market chase', 'A frozen mountain pass'],
  style: ['Slow-motion epic', 'Cartoon / animated', 'Horror movie', 'Old-school black & white'],
  animal: ['Tiger', 'Elephant', 'Penguin', 'Octopus', 'Kangaroo', 'Giraffe', 'Crocodile', 'Peacock', 'Sloth', 'Flamingo', 'Rhino', 'Gorilla', 'Dolphin', 'Owl', 'Panda', 'Cheetah'],
} as const

export type AitbPoolKey = keyof typeof AITB_POOLS

export type AitbModuleSlot = { pool: AitbPoolKey; label: string; emoji: string }

/** Ordered result slots per module. Word positions in aitb_progress.words map
 *  1:1 onto this array, and each slot draws its options from `pool`. */
export const AITB_MODULE_SLOTS: Record<AitbModule, AitbModuleSlot[]> = {
  cups: [
    { pool: 'cupCharacter', label: 'Character', emoji: '🔴' },
    { pool: 'cupAction', label: 'Action', emoji: '🔵' },
    { pool: 'cupScene', label: 'Scene', emoji: '🟡' },
  ],
  roulette: [
    { pool: 'genre', label: 'Genre', emoji: '🎸' },
    { pool: 'topic', label: 'Topic', emoji: '🎯' },
  ],
  cards: [
    { pool: 'country', label: 'Civilization', emoji: '🏛️' },
    { pool: 'cardChar', label: 'Character', emoji: '🎭' },
    { pool: 'cardScene', label: 'Scene', emoji: '🎬' },
    { pool: 'style', label: 'Style', emoji: '🎨' },
  ],
  animals: [
    { pool: 'animal', label: 'Animal 1', emoji: '🐾' },
    { pool: 'animal', label: 'Animal 2', emoji: '🐾' },
  ],
}

/** How a module is played: pick from lists, spin one slot at a time, or deal
 *  every slot at once (and never re-deal). */
export const AITB_MODULE_MODE: Record<AitbModule, 'pick' | 'spin' | 'deal'> = {
  cups: 'pick', roulette: 'spin', cards: 'deal', animals: 'deal',
}

/* ── Reel artwork (one generated image per pool item) ────────────────────────
   Pools listed here have a picture for every option at
   /public/aitb/reel/<pool>/<slug>.webp. A module upgrades from a text reel to
   an image slot-machine once every one of its slot pools has art. */
export const AITB_REEL_POOLS: AitbPoolKey[] = ['country', 'cardChar', 'cardScene', 'style', 'animal', 'genre', 'topic']

/** Filename-safe slug — must match the saved image filenames exactly. */
export function aitbSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Public path to the reel image for one pool item. */
export function aitbReelImage(pool: AitbPoolKey, item: string): string {
  return `/aitb/reel/${pool}/${aitbSlug(item)}.webp`
}

/** True when every slot of a module has generated art (→ image slot-machine). */
export function aitbModuleHasImages(mod: AitbModule): boolean {
  return AITB_MODULE_SLOTS[mod].every(s => AITB_REEL_POOLS.includes(s.pool))
}

/** Labels for each stored word of an activity (interactive module OR typed
 *  wordsInput), so the admin can show "Genre: K-Pop". null = stores no words. */
export function aitbResultLabels(a: AitbActivity): string[] | null {
  if (a.module) return AITB_MODULE_SLOTS[a.module].map(s => `${s.emoji} ${s.label}`)
  if (a.wordsInput) return a.wordsInput.labels ?? Array.from({ length: a.wordsInput.count }, (_, i) => `Word ${i + 1}`)
  return null
}

/* ---------- Scoring ----------
   Timer starts the moment the team checks in (scans the QR and taps start).
   +100  check-in (scan)
   +100  per step ticked (5 steps = 500)
   +300  activity completed (marshal password)
   +bonus speed bonus on completion from the game's own bonusTiers ladder:
         finish within the first milestone → top bonus (1000), each later
         milestone pays less, past the last milestone → 0.
   Max per activity: 1900 pts                                            */
// scan + per-step are flat "participation" points; `complete` is the fallback
// completion award when a difficulty isn't known (see AITB_COMPLETE below).
export const AITB_POINTS = { scan: 100, step: 100, complete: 300 } as const

// Harder missions are worth more. Completion award and the speed-bonus ladder
// both scale by the mission's challenge tier, so acing a Hard beats a Easy.
export const AITB_COMPLETE: Record<AitbActivity['difficulty'], number> = { Easy: 200, Normal: 350, Hard: 500 }
export const AITB_BONUS_MULT: Record<AitbActivity['difficulty'], number> = { Easy: 1, Normal: 1.4, Hard: 1.8 }

/** Best-case score if a mission is aced fast: scan + every step + completion + top bonus. */
export function aitbMaxPoints(a: AitbActivity): number {
  return AITB_POINTS.scan + a.steps.length * AITB_POINTS.step
    + AITB_COMPLETE[a.difficulty] + Math.round((a.bonusTiers[0]?.pts ?? 0) * AITB_BONUS_MULT[a.difficulty])
}

export function aitbSpeedBonus(elapsedMs: number, activity: Pick<AitbActivity, 'bonusTiers' | 'difficulty'>): number {
  const mins = elapsedMs / 60_000
  const mult = AITB_BONUS_MULT[activity.difficulty] ?? 1
  for (const t of activity.bonusTiers) if (mins <= t.uptoMin) return Math.round(t.pts * mult)
  return 0
}

export function aitbProgressPoints(
  p: {
    scanned_at: string | null
    steps_done: number[] | null
    completed_at: string | null
    bonus: number | null
  },
  // Pass the mission so the completion award scales by difficulty. Omitting it
  // falls back to the flat award (kept for safety / any legacy call site).
  activity?: Pick<AitbActivity, 'difficulty'>,
): number {
  let pts = 0
  if (p.scanned_at) pts += AITB_POINTS.scan
  pts += (p.steps_done?.length ?? 0) * AITB_POINTS.step
  if (p.completed_at) pts += (activity ? AITB_COMPLETE[activity.difficulty] : AITB_POINTS.complete) + (p.bonus ?? 0)
  return pts
}
