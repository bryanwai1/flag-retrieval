export interface Point {
  icon: string
  text: string
  sub: string
}

export interface Slide {
  id: string
  gradientFrom: string
  gradientVia: string
  gradientTo: string
  accent: string
  glowColor: string
  icon: string
  stepLabel: string
  stepColor: string
  title: string
  titleColor: string
  points: Point[]
  qrNote?: boolean
}

export interface Deck {
  id: string
  label: string
  icon: string
  accent: string
  tagline: string
  slides: Slide[]
}

const flagRetrievalSlides: Slide[] = [
  {
    id: 'register',
    gradientFrom: '#1e0a3c', gradientVia: '#0f1b4d', gradientTo: '#071e3d',
    accent: '#a78bfa', glowColor: 'rgba(167,139,250,0.35)',
    icon: '📱', stepLabel: '⚡ BEFORE YOU START', stepColor: '#a78bfa',
    title: 'SCAN & REGISTER', titleColor: '#e9d5ff',
    points: [
      { icon: '👑', text: 'TEAM LEADERS go first!', sub: 'Scan the main QR code on screen' },
      { icon: '✍️', text: 'Enter TRIBE NAME + PASSWORD', sub: 'Share the password with your whole team' },
      { icon: '👥', text: 'Teammates scan & JOIN the tribe', sub: 'Maximum 3 teammates per tribe' },
    ],
    qrNote: true,
  },
  {
    id: 'step1',
    gradientFrom: '#3b0a0a', gradientVia: '#431407', gradientTo: '#1c1002',
    accent: '#fb923c', glowColor: 'rgba(251,146,60,0.35)',
    icon: '🚩', stepLabel: 'STEP 1', stepColor: '#fb923c',
    title: 'FIND THE FLAG!', titleColor: '#fed7aa',
    points: [
      { icon: '👀', text: 'Search the ROOM / VENUE', sub: 'Flags are hidden all around you!' },
      { icon: '🏃', text: 'GRAB the physical flag', sub: 'Each color = a different challenge' },
    ],
  },
  {
    id: 'step2',
    gradientFrom: '#03162b', gradientVia: '#061e2f', gradientTo: '#01171f',
    accent: '#22d3ee', glowColor: 'rgba(34,211,238,0.35)',
    icon: '📲', stepLabel: 'STEP 2', stepColor: '#22d3ee',
    title: 'GET THE QR CODE', titleColor: '#a5f3fc',
    points: [
      { icon: '🧑‍⚖️', text: 'Go to the MARSHAL', sub: 'They are wearing official vests' },
      { icon: '📱', text: 'SCAN the QR code they show you', sub: "Use your phone camera — it's easy!" },
    ],
  },
  {
    id: 'step3',
    gradientFrom: '#021a0e', gradientVia: '#031e10', gradientTo: '#01171a',
    accent: '#34d399', glowColor: 'rgba(52,211,153,0.35)',
    icon: '📋', stepLabel: 'STEP 3', stepColor: '#34d399',
    title: 'DO THE CHALLENGE!', titleColor: '#a7f3d0',
    points: [
      { icon: '📖', text: 'READ the instructions carefully', sub: 'Think before you move!' },
      { icon: '🧰', text: 'Need PROPS? Grab from marshal table', sub: 'Some challenges need equipment' },
      { icon: '🎯', text: 'No props? Start ANYWHERE — GO!', sub: "Just follow what's on screen" },
    ],
  },
  {
    id: 'step4',
    gradientFrom: '#1c1000', gradientVia: '#1e0f00', gradientTo: '#1a0900',
    accent: '#fbbf24', glowColor: 'rgba(251,191,36,0.35)',
    icon: '✅', stepLabel: 'STEP 4', stepColor: '#fbbf24',
    title: 'VERIFY WITH MARSHAL', titleColor: '#fde68a',
    points: [
      { icon: '🏁', text: 'Challenge DONE?', sub: "Don't run off just yet..." },
      { icon: '🧑‍⚖️', text: 'Show the ONSITE MARSHAL', sub: 'They will check your work' },
      { icon: '👍', text: 'Wait for VERIFICATION', sub: 'Marshal confirms you did it right!' },
    ],
  },
  {
    id: 'step5',
    gradientFrom: '#2d0018', gradientVia: '#1e000f', gradientTo: '#1a0005',
    accent: '#f472b6', glowColor: 'rgba(244,114,182,0.35)',
    icon: '🃏', stepLabel: 'STEP 5', stepColor: '#f472b6',
    title: 'COLLECT YOUR CARD!', titleColor: '#fbcfe8',
    points: [
      { icon: '🎉', text: 'VERIFIED — Amazing work!', sub: 'The marshal is proud of you' },
      { icon: '🃏', text: 'Get your COMPLETION CARD', sub: 'Physical card — handed by marshal' },
      { icon: '💎', text: "KEEP IT SAFE — it's your proof!", sub: "Don't lose this card!" },
    ],
  },
  {
    id: 'step6',
    gradientFrom: '#1a003d', gradientVia: '#1e0035', gradientTo: '#2a0040',
    accent: '#c084fc', glowColor: 'rgba(192,132,252,0.35)',
    icon: '🌈', stepLabel: 'STEP 6', stepColor: '#c084fc',
    title: 'NEXT FLAG — GO AGAIN!', titleColor: '#e9d5ff',
    points: [
      { icon: '🔄', text: 'Repeat STEPS 1 to 5', sub: 'For every new flag color' },
      { icon: '🏆', text: 'Most CARDS / POINTS wins!', sub: 'Collect as many completion cards as you can!' },
      { icon: '⏱️', text: 'TIME matters too!', sub: 'Fastest tribe wins in a tie — so hustle!' },
    ],
  },
]

const bingoDashSlides: Slide[] = [
  {
    id: 'register',
    gradientFrom: '#1e0a3c', gradientVia: '#0f1b4d', gradientTo: '#071e3d',
    accent: '#a78bfa', glowColor: 'rgba(167,139,250,0.35)',
    icon: '📱', stepLabel: '⚡ BEFORE YOU START', stepColor: '#a78bfa',
    title: 'SCAN & REGISTER', titleColor: '#e9d5ff',
    points: [
      { icon: '👑', text: 'TEAM LEADERS go first!', sub: 'Scan the main QR code on screen' },
      { icon: '✍️', text: 'Enter TRIBE NAME + PASSWORD', sub: 'Share the password with your whole team' },
      { icon: '👥', text: 'Teammates scan & JOIN the tribe', sub: 'Everyone shares the same bingo board' },
    ],
    qrNote: true,
  },
  {
    id: 'goal',
    gradientFrom: '#2d0018', gradientVia: '#1e000f', gradientTo: '#1a0005',
    accent: '#f472b6', glowColor: 'rgba(244,114,182,0.35)',
    icon: '🎯', stepLabel: 'THE GOAL', stepColor: '#f472b6',
    title: 'COMPLETE THE BOARD', titleColor: '#fbcfe8',
    points: [
      { icon: '🟪', text: 'Fill ROWS, COLUMNS or DIAGONALS', sub: 'Every line you complete scores points' },
      { icon: '🏆', text: 'Most completed cards WIN', sub: 'Quality + quantity both matter' },
      { icon: '⏱️', text: 'Race against the CLOCK', sub: 'Beat other tribes to the BINGO!' },
    ],
  },
  {
    id: 'gameplay',
    gradientFrom: '#021a0e', gradientVia: '#031e10', gradientTo: '#01171a',
    accent: '#34d399', glowColor: 'rgba(52,211,153,0.35)',
    icon: '🎲', stepLabel: 'GAMEPLAY', stepColor: '#34d399',
    title: 'PICK & PLAY CARDS', titleColor: '#a7f3d0',
    points: [
      { icon: '👆', text: 'TAP any card on your board', sub: 'Each card is a mini-challenge' },
      { icon: '📖', text: 'READ the challenge carefully', sub: 'Photo, answer, or action — follow the brief' },
      { icon: '🤝', text: 'WORK together as a tribe', sub: 'Split up for speed or team up for tricky ones' },
    ],
  },
  {
    id: 'submission',
    gradientFrom: '#03162b', gradientVia: '#061e2f', gradientTo: '#01171f',
    accent: '#22d3ee', glowColor: 'rgba(34,211,238,0.35)',
    icon: '📤', stepLabel: 'SUBMISSION', stepColor: '#22d3ee',
    title: 'SUBMIT YOUR ANSWER', titleColor: '#a5f3fc',
    points: [
      { icon: '📸', text: 'Upload your PHOTO or ANSWER', sub: 'Right from your phone — easy!' },
      { icon: '✍️', text: 'Type your response if asked', sub: 'Be clear, be accurate' },
      { icon: '✔️', text: 'Tap SUBMIT when ready', sub: 'Your tribe can see what you sent in' },
    ],
  },
  {
    id: 'verification',
    gradientFrom: '#1c1000', gradientVia: '#1e0f00', gradientTo: '#1a0900',
    accent: '#fbbf24', glowColor: 'rgba(251,191,36,0.35)',
    icon: '✅', stepLabel: 'VERIFICATION', stepColor: '#fbbf24',
    title: 'MARSHAL APPROVES', titleColor: '#fde68a',
    points: [
      { icon: '🧑‍⚖️', text: 'Marshal REVIEWS your submission', sub: 'They decide if it counts' },
      { icon: '🟢', text: 'APPROVED = card is marked', sub: 'Your board lights up with progress' },
      { icon: '🔁', text: 'REJECTED? Try again', sub: 'Adjust and resubmit — no penalty' },
    ],
  },
  {
    id: 'next',
    gradientFrom: '#1a003d', gradientVia: '#1e0035', gradientTo: '#2a0040',
    accent: '#c084fc', glowColor: 'rgba(192,132,252,0.35)',
    icon: '➡️', stepLabel: 'NEXT CARD', stepColor: '#c084fc',
    title: 'KEEP THE DASH GOING!', titleColor: '#e9d5ff',
    points: [
      { icon: '🔄', text: 'Pick the NEXT card', sub: 'Go for the line that brings you closest to BINGO' },
      { icon: '📊', text: 'Watch the LEADERBOARD', sub: 'See how other tribes are doing' },
      { icon: '🏁', text: 'First to fill the BOARD wins', sub: 'Every second counts — hustle!' },
    ],
  },
]

const snakeLadderSlides: Slide[] = [
  {
    id: 'register',
    gradientFrom: '#1e0a3c', gradientVia: '#0f1b4d', gradientTo: '#071e3d',
    accent: '#a78bfa', glowColor: 'rgba(167,139,250,0.35)',
    icon: '♟️', stepLabel: '⚡ BEFORE YOU START', stepColor: '#a78bfa',
    title: 'REGISTER & PICK PIECE', titleColor: '#e9d5ff',
    points: [
      { icon: '👑', text: 'TEAM LEADERS register first', sub: 'Scan the QR code and name your tribe' },
      { icon: '👥', text: 'Teammates scan & JOIN the tribe', sub: 'Share the password with your crew' },
      { icon: '♞', text: 'CHOOSE your chess piece', sub: 'Each tribe picks a unique mascot piece' },
    ],
    qrNote: true,
  },
  {
    id: 'place',
    gradientFrom: '#3b0a0a', gradientVia: '#431407', gradientTo: '#1c1002',
    accent: '#fb923c', glowColor: 'rgba(251,146,60,0.35)',
    icon: '📍', stepLabel: 'STEP 1', stepColor: '#fb923c',
    title: 'PLACE YOUR MASCOT', titleColor: '#fed7aa',
    points: [
      { icon: '🗺️', text: 'Find the PHYSICAL BOARD', sub: 'Giant snake & ladder grid on the floor' },
      { icon: '♟️', text: 'Place your team MASCOT on START', sub: 'Every tribe begins on tile 1' },
      { icon: '📣', text: 'Wait for the MARSHAL to signal GO', sub: 'No rolling until the whistle blows!' },
    ],
  },
  {
    id: 'roll',
    gradientFrom: '#021a0e', gradientVia: '#031e10', gradientTo: '#01171a',
    accent: '#34d399', glowColor: 'rgba(52,211,153,0.35)',
    icon: '🎲', stepLabel: 'STEP 2', stepColor: '#34d399',
    title: 'ROLL THE DICE', titleColor: '#a7f3d0',
    points: [
      { icon: '🎲', text: 'THROW the physical dice', sub: 'Move your mascot that many tiles' },
      { icon: '🃏', text: 'Every TILE has a CHALLENGE', sub: 'Read what is on the tile' },
      { icon: '✅', text: 'COMPLETE it, then roll AGAIN', sub: 'No skipping — every tile must be cleared' },
    ],
  },
  {
    id: 'snakes',
    gradientFrom: '#2d0018', gradientVia: '#1e000f', gradientTo: '#1a0005',
    accent: '#f472b6', glowColor: 'rgba(244,114,182,0.35)',
    icon: '🐍', stepLabel: 'WATCH OUT', stepColor: '#f472b6',
    title: 'SNAKES & LADDERS', titleColor: '#fbcfe8',
    points: [
      { icon: '🪜', text: 'Land on a LADDER — climb up!', sub: 'Fast-track toward the finish' },
      { icon: '🐍', text: 'Land on a SNAKE — slide down', sub: 'Unlucky! Keep playing — tiles still count' },
      { icon: '🧑‍⚖️', text: 'Marshal VERIFIES every move', sub: 'They confirm ladders and snakes' },
    ],
  },
  {
    id: 'goal',
    gradientFrom: '#1c1000', gradientVia: '#1e0f00', gradientTo: '#1a0900',
    accent: '#fbbf24', glowColor: 'rgba(251,191,36,0.35)',
    icon: '🏁', stepLabel: 'THE GOAL', stepColor: '#fbbf24',
    title: 'REACH THE END IN TIME', titleColor: '#fde68a',
    points: [
      { icon: '🎯', text: 'Get your MASCOT to the FINAL tile', sub: 'Before the timer runs out' },
      { icon: '⏱️', text: 'TIME is the enemy', sub: 'Every challenge eats the clock — hustle!' },
      { icon: '🤝', text: 'Split roles as a TRIBE', sub: 'Runner, roller, challenger — divide and conquer' },
    ],
  },
  {
    id: 'win',
    gradientFrom: '#1a003d', gradientVia: '#1e0035', gradientTo: '#2a0040',
    accent: '#c084fc', glowColor: 'rgba(192,132,252,0.35)',
    icon: '🏆', stepLabel: 'WINNERS', stepColor: '#c084fc',
    title: 'HIGHEST POINTS WINS', titleColor: '#e9d5ff',
    points: [
      { icon: '🥇', text: 'FIRST to reach the end WINS', sub: 'Clean sweep of the board!' },
      { icon: '💯', text: 'Otherwise — MOST POINTS wins', sub: 'Tiles cleared + bonus challenges' },
      { icon: '⚖️', text: 'Tie? FASTEST tribe takes it', sub: 'So keep the pace up, no lulls!' },
    ],
  },
]

const shapeSequenceSlides: Slide[] = [
  {
    id: 'register',
    gradientFrom: '#1e0a3c', gradientVia: '#0f1b4d', gradientTo: '#071e3d',
    accent: '#a78bfa', glowColor: 'rgba(167,139,250,0.35)',
    icon: '📱', stepLabel: '⚡ BEFORE YOU START', stepColor: '#a78bfa',
    title: 'GATHER YOUR TRIBE', titleColor: '#e9d5ff',
    points: [
      { icon: '👥', text: 'Sit TOGETHER as a tribe', sub: 'Eyes on the main projector screen' },
      { icon: '📝', text: 'Grab PEN + ANSWER SHEET', sub: 'One sheet per tribe — pass it around' },
      { icon: '🤫', text: 'NO phones, NO cameras', sub: 'Pure memory — no cheating!' },
    ],
  },
  {
    id: 'goal',
    gradientFrom: '#03162b', gradientVia: '#061e2f', gradientTo: '#01171f',
    accent: '#22d3ee', glowColor: 'rgba(34,211,238,0.35)',
    icon: '🧠', stepLabel: 'THE GOAL', stepColor: '#22d3ee',
    title: 'MEMORISE THE SEQUENCE', titleColor: '#a5f3fc',
    points: [
      { icon: '🔷', text: 'Shapes flash on the SCREEN', sub: 'A grid of circles filled with shapes' },
      { icon: '👀', text: 'STUDY the pattern', sub: "You'll need to reproduce it from memory" },
      { icon: '🏆', text: 'Most CORRECT shapes wins', sub: 'Accuracy beats speed' },
    ],
  },
  {
    id: 'rounds',
    gradientFrom: '#3b0a0a', gradientVia: '#431407', gradientTo: '#1c1002',
    accent: '#fb923c', glowColor: 'rgba(251,146,60,0.35)',
    icon: '🔁', stepLabel: 'THE ROUNDS', stepColor: '#fb923c',
    title: '3 ROUNDS — GETS HARDER', titleColor: '#fed7aa',
    points: [
      { icon: '1️⃣', text: 'ROUND 1 — 20 circles', sub: 'Warm-up — learn the shapes' },
      { icon: '2️⃣', text: 'ROUND 2 — more circles', sub: 'Tighter grid, faster reveal' },
      { icon: '3️⃣', text: 'ROUND 3 — full board', sub: 'Final push — every shape counts' },
    ],
  },
  {
    id: 'memorise',
    gradientFrom: '#021a0e', gradientVia: '#031e10', gradientTo: '#01171a',
    accent: '#34d399', glowColor: 'rgba(52,211,153,0.35)',
    icon: '👁️', stepLabel: 'STEP 1', stepColor: '#34d399',
    title: 'WATCH CAREFULLY', titleColor: '#a7f3d0',
    points: [
      { icon: '⏱️', text: 'Shapes appear for a FEW SECONDS', sub: 'Blink and you miss them!' },
      { icon: '🧩', text: 'Note the POSITION + SHAPE', sub: 'Both matter — location is scored too' },
      { icon: '🤐', text: 'NO talking during reveal', sub: 'Discuss only after shapes are hidden' },
    ],
  },
  {
    id: 'answer',
    gradientFrom: '#1c1000', gradientVia: '#1e0f00', gradientTo: '#1a0900',
    accent: '#fbbf24', glowColor: 'rgba(251,191,36,0.35)',
    icon: '✍️', stepLabel: 'STEP 2', stepColor: '#fbbf24',
    title: 'FILL THE ANSWER SHEET', titleColor: '#fde68a',
    points: [
      { icon: '📝', text: 'Draw the shapes on your SHEET', sub: 'Match position to the grid' },
      { icon: '🤝', text: 'DISCUSS as a tribe', sub: 'Pool memories — whoever saw it best wins' },
      { icon: '⏰', text: 'Submit BEFORE time runs out', sub: 'Late sheets do not score' },
    ],
  },
  {
    id: 'scoring',
    gradientFrom: '#2d0018', gradientVia: '#1e000f', gradientTo: '#1a0005',
    accent: '#f472b6', glowColor: 'rgba(244,114,182,0.35)',
    icon: '🧑‍⚖️', stepLabel: 'STEP 3', stepColor: '#f472b6',
    title: 'MARSHAL SCORES', titleColor: '#fbcfe8',
    points: [
      { icon: '✅', text: 'Marshal CHECKS each shape', sub: 'Correct shape + correct spot = full points' },
      { icon: '➗', text: 'Partial credit for HALF-RIGHT', sub: 'Right shape, wrong spot still counts' },
      { icon: '📣', text: 'Scores READ OUT each round', sub: 'Live leaderboard on the projector' },
    ],
  },
  {
    id: 'win',
    gradientFrom: '#1a003d', gradientVia: '#1e0035', gradientTo: '#2a0040',
    accent: '#c084fc', glowColor: 'rgba(192,132,252,0.35)',
    icon: '🏆', stepLabel: 'WINNERS', stepColor: '#c084fc',
    title: 'HIGHEST TOTAL WINS', titleColor: '#e9d5ff',
    points: [
      { icon: '➕', text: 'Add ALL 3 rounds together', sub: 'Every round feeds the final score' },
      { icon: '🥇', text: 'Top tribe takes the CROWN', sub: 'Sharp eyes + sharp memory = victory' },
      { icon: '🤝', text: 'Tie? Round 3 breaks it', sub: 'So finish strong — never coast!' },
    ],
  },
]

export const decks: Deck[] = [
  {
    id: 'flag-retrieval', label: 'Flag Retrieval', icon: '🚩', accent: '#fb923c',
    tagline: 'Hunt · Scan · Verify · Collect',
    slides: flagRetrievalSlides,
  },
  {
    id: 'bingo-dash', label: 'Bingo Dash', icon: '🎯', accent: '#a855f7',
    tagline: 'Register · Play · Submit · Verify',
    slides: bingoDashSlides,
  },
  {
    id: 'snake-ladder', label: 'Snake & Ladder', icon: '🐍', accent: '#f59e0b',
    tagline: 'Roll · Challenge · Climb · Win',
    slides: snakeLadderSlides,
  },
  {
    id: 'shape-sequence', label: 'Shape Sequence', icon: '🔷', accent: '#60a5fa',
    tagline: 'Memorise · Draw · Score · Repeat',
    slides: shapeSequenceSlides,
  },
]

export function getDeck(id: string | undefined): Deck | undefined {
  return decks.find(d => d.id === id)
}
