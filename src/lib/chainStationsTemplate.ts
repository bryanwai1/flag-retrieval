// 8 stations from the original Chain of Unity briefing deck.
// Used by the "Seed 8 stations from template" button in admin.

export interface StationTemplate {
  position: number
  title: string
  objective: string
  materials: string
  marshal_role: string
  time_limit_min: number
  pointers: string[]
}

export const STATION_TEMPLATES: StationTemplate[] = [
  {
    position: 1,
    title: 'TRANSFER BALANCE',
    objective: 'Move the water bottle from Point A to Point B on a shared canvas — without dropping it.',
    materials: 'Canvas sheet\nWater bottle\nMasking tape (mark A & B)',
    marshal_role: 'Mark Point A and Point B clearly\nCheck all hands are on canvas\nMonitor safety throughout\nCall restart if bottle falls',
    time_limit_min: 7,
    pointers: [
      'Everyone holds the canvas — at all times',
      'Bottle stays in the centre of canvas',
      'Move slowly, stay in sync',
      'Bottle drops → restart from Point A',
    ],
  },
  {
    position: 2,
    title: 'EGG TOSS',
    objective: 'Toss ping pong balls simultaneously — complete a full round with zero drops.',
    materials: 'Ping pong balls — 1 per person',
    marshal_role: 'Give one clear start signal\nWatch for wrong hand use\nCall restart immediately on any drop',
    time_limit_min: 7,
    pointers: [
      "Toss simultaneously on marshal's signal",
      'Right hand only for tossing',
      'Catch the ball coming from your left',
      'Any drop → restart from the beginning',
    ],
  },
  {
    position: 3,
    title: 'CHOPSTICK CHALLENGE',
    objective: 'Transfer as many beans as possible from one cup to another in 7 minutes using chopsticks.',
    materials: 'Chopsticks — 1 set per person\n1 full cup of beans\n1 empty cup\nTimer',
    marshal_role: 'Prepare materials, start the timer\nEnforce no-hand rule\nCount transferred beans at end\nRecord team score',
    time_limit_min: 7,
    pointers: [
      'Stand in a single line',
      'Chopsticks only — no hands on beans',
      'Timer runs for 7 minutes',
      'Highest bean count wins',
    ],
  },
  {
    position: 4,
    title: 'HOCKEY CHALLENGE',
    objective: 'Guide the ball A → B → A using PVC pipes only. Fastest team wins.',
    materials: 'PVC pipes — 1 per person\nBall\nMarkers for A & B\nTimer',
    marshal_role: '⚠ Run ONE team at a time\nStart and stop timer precisely\nEnsure everyone takes their turn\nMonitor fair play & safety',
    time_limit_min: 7,
    pointers: [
      'PVC pipes only — no touching ball',
      'Ball travels A → B → back to A',
      'Everyone takes a turn in order',
      '⚠ ONE team at a time (exception)',
    ],
  },
  {
    position: 5,
    title: 'PING PONG CHALLENGE',
    objective: 'Pass balls between teammates — score as many passes from different people as possible in 7 minutes.',
    materials: 'Ping pong balls\nMarked playing area',
    marshal_role: 'Hand out balls and brief scoring rules\nTrack passes — count unique passers per round\nMinimum 5 different people = points secured\nRecord highest score at the 7-min mark',
    time_limit_min: 7,
    pointers: [
      'Pass balls between teammates freely',
      'Minimum 5 passes from 5 different people to score',
      'Each unique passer adds to the score',
      'Highest score at end of 7 minutes wins',
    ],
  },
  {
    position: 6,
    title: 'ACID RIVER',
    objective: 'Cross from Point A to Point B using only the 10 plates — no body part may touch the ground.',
    materials: '10 stepping plates per team\nMarked Point A & Point B',
    marshal_role: 'Issue 10 plates, mark A and B clearly\nWatch for any ground contact — call faults\nRestart team from A on any fault\nConfirm all plates and all members reach B',
    time_limit_min: 7,
    pointers: [
      'Step on plates only — no touching the ground',
      'Any body part touches ground → restart from A',
      'Must bring ALL plates to Point B',
      'Tied together — plan plate moves as a team',
    ],
  },
  {
    position: 7,
    title: 'COLOR HUNT',
    objective: 'Take 24 photos: 4 per color × 6 colors. Every shot needs at least 2 team members.',
    materials: 'Color list (6 colors)\nTeam phone or camera',
    marshal_role: 'Hand out the color list\nBrief both conditions clearly\nReview photos at end\nTally: correct color + 2 people visible',
    time_limit_min: 7,
    pointers: [
      '4 photos × 6 colors = 24 total',
      'Each photo: correct color + 2 people',
      'Wrong color or solo shot = invalid',
    ],
  },
  {
    position: 8,
    title: 'HOLE TARP',
    objective: 'Land all 5 balls in the target cup by manoeuvring the tarp — follow the arrow path.',
    materials: 'Holed tarpaulin (with arrows)\n5 balls\n1 target cup',
    marshal_role: 'Position team evenly around tarp\nWatch for hole & edge faults\nReset ball on each fault\nCount balls that land in cup',
    time_limit_min: 7,
    pointers: [
      'Follow the arrow direction on tarp',
      'Ball through a hole → reset that ball',
      'Ball off the edge → reset that ball',
      'Land all 5 balls in the cup to win',
    ],
  },
]
