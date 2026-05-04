/*
 * DISC Personality Test — question bank + profile content.
 *
 * 40 statements, 10 per dimension (D, I, S, C). Participants rate each
 * statement on a 1-5 scale (Strongly Disagree → Strongly Agree). Scoring
 * sums the points per dimension into raw totals (10–50), which are then
 * mapped to a 2-D position on the DISC quadrant:
 *
 *      Active / Fast-paced  (D, I)
 *               +y
 *                |
 *   Task    --- + ---   People
 *      D    |       |     I
 *      C    |       |     S
 *               -y
 *      Reflective / Measured (S, C)
 *
 *   x =  (i + s) - (d + c)   →  task-focused (left)  ↔  people-focused (right)
 *   y =  (d + i) - (s + c)   →  reflective  (down)  ↔  active (up)
 *
 * Centre-band buffer: anyone whose dominant axis is within ±6 points of
 * the next-highest is reported as a "Blend" or "Balanced" profile, so
 * the test honours people who don't fit neatly into one corner.
 */
window.DISC_QUIZ = {
  testSlug: 'disc-personality',
  title: 'DISC Personality Test',
  subtitle: 'A 40-statement profile that maps how you naturally show up at work.',
  scaleLabels: [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree'
  ],
  // Each question is tagged with the dimension it measures.
  // Score = the chosen scale value (1..5). Total per dimension = 10..50.
  questions: [
    // ---------- D — Dominance (10) ----------
    { dim: 'D', text: 'I take charge quickly when no one else is leading.' },
    { dim: 'D', text: 'I push hard for results, even when it ruffles feathers.' },
    { dim: 'D', text: 'I make decisions fast and adjust later if needed.' },
    { dim: 'D', text: 'I am direct and to the point when I speak.' },
    { dim: 'D', text: 'I enjoy being responsible for the outcome of a project.' },
    { dim: 'D', text: 'I am comfortable challenging ideas in a meeting.' },
    { dim: 'D', text: 'I get impatient when work moves too slowly.' },
    { dim: 'D', text: 'I am willing to take big risks to win big.' },
    { dim: 'D', text: 'I prefer to set the agenda rather than follow one.' },
    { dim: 'D', text: 'I focus on the goal more than on how people feel about it.' },

    // ---------- I — Influence (10) ----------
    { dim: 'I', text: 'I energise a room when I walk into it.' },
    { dim: 'I', text: 'I make new connections easily with people I just met.' },
    { dim: 'I', text: 'I am optimistic, even when things look uncertain.' },
    { dim: 'I', text: 'I enjoy talking through ideas out loud with others.' },
    { dim: 'I', text: 'I express my emotions openly and visibly.' },
    { dim: 'I', text: 'I like being recognised in front of the team.' },
    { dim: 'I', text: 'I would rather brainstorm with people than work alone.' },
    { dim: 'I', text: 'I rely on charm and persuasion to get buy-in.' },
    { dim: 'I', text: 'I tell stories to make a point land.' },
    { dim: 'I', text: 'I can usually read what someone is feeling in the room.' },

    // ---------- S — Steadiness (10) ----------
    { dim: 'S', text: 'I am the calm one when things get tense.' },
    { dim: 'S', text: 'I prefer steady, predictable work over constant change.' },
    { dim: 'S', text: 'I listen more than I talk in most meetings.' },
    { dim: 'S', text: 'I follow through on what I promise, every time.' },
    { dim: 'S', text: 'I value harmony in the team over winning an argument.' },
    { dim: 'S', text: 'I am patient with people who need things explained twice.' },
    { dim: 'S', text: 'I prefer to be asked rather than told what to do.' },
    { dim: 'S', text: 'I find it hard to say no when someone needs help.' },
    { dim: 'S', text: 'I dislike sudden changes to plans I had agreed to.' },
    { dim: 'S', text: 'I am loyal to my team even when leaving would be easier.' },

    // ---------- C — Conscientiousness (10) ----------
    { dim: 'C', text: 'I double-check my work before sending it out.' },
    { dim: 'C', text: 'I want to see the data before I commit to a position.' },
    { dim: 'C', text: 'I notice details that other people miss.' },
    { dim: 'C', text: 'I prefer clear rules and processes over making it up as I go.' },
    { dim: 'C', text: 'I like to fully understand a problem before suggesting a fix.' },
    { dim: 'C', text: 'I keep notes, lists or trackers for things I am working on.' },
    { dim: 'C', text: 'I am uncomfortable submitting work that is not polished.' },
    { dim: 'C', text: 'I think things through privately before sharing my view.' },
    { dim: 'C', text: 'I want to know the standard before I start a new task.' },
    { dim: 'C', text: 'I would rather be accurate than fast.' }
  ],

  // ------------------------------------------------------------------
  // Profile content — one entry per primary type, plus blends + balanced
  // ------------------------------------------------------------------
  profiles: {
    D: {
      code: 'D',
      label: 'The Driver',
      tagline: 'Direct, decisive, results-first.',
      summary: 'You move fast, take charge, and care about outcomes more than process. People look to you when a decision needs making and someone has to own it. You are at your best leading from the front; at your worst you can steamroll quieter voices and skip the listening step.',
      strengths: [
        'Decides quickly under pressure',
        'Owns outcomes and accountability',
        'Cuts through noise to the point',
        'Comfortable with risk and challenge'
      ],
      watchouts: [
        'Can come across as blunt or impatient',
        'May skip context others need',
        'Risk of overruling cautious teammates',
        'Burns out chasing results without rest'
      ],
      tipsForOthers: [
        'Lead with the bottom line, then the detail',
        'Be direct — don’t soften the ask',
        'Give them options and a deadline',
        'Don’t take sharpness personally'
      ],
      bestRoles: 'Leadership, sales, ops turnaround, crisis response, anything where speed and clear ownership matter.'
    },
    I: {
      code: 'I',
      label: 'The Influencer',
      tagline: 'Outgoing, optimistic, people-energising.',
      summary: 'You bring energy, ideas and connection. You think out loud, win people over with story and warmth, and make work feel like fun. At your best you build culture and momentum; at your worst you can over-promise, under-detail and lose interest before the finish line.',
      strengths: [
        'Inspires and rallies people',
        'Generates ideas at speed',
        'Builds rapport almost instantly',
        'Optimistic when others are stuck'
      ],
      watchouts: [
        'Can over-commit and under-deliver',
        'May skip the boring detail',
        'Talks more than listens',
        'Loses focus when energy drops'
      ],
      tipsForOthers: [
        'Make space for them to talk it out',
        'Acknowledge them before correcting them',
        'Pin commitments down in writing',
        'Pair them with a detail-oriented teammate'
      ],
      bestRoles: 'Sales, marketing, hosting, training, partnerships, anything that needs charisma and momentum.'
    },
    S: {
      code: 'S',
      label: 'The Steady',
      tagline: 'Calm, dependable, harmony-keeper.',
      summary: 'You are the steady hand. You listen, you follow through, and you keep the team feeling safe. You don’t need the spotlight to do great work. At your best you are the glue; at your worst you can avoid hard conversations and stay silent when you should push back.',
      strengths: [
        'Reliable and consistent',
        'Patient and supportive of others',
        'Calm under pressure',
        'Builds long-term trust'
      ],
      watchouts: [
        'Avoids confrontation, even when needed',
        'Resists sudden change',
        'Can be too accommodating to others’ demands',
        'Holds back opinions in meetings'
      ],
      tipsForOthers: [
        'Give them time to process change',
        'Ask their view directly — they may not volunteer it',
        'Don’t rush them into decisions',
        'Recognise quiet, consistent contribution'
      ],
      bestRoles: 'Operations, customer success, HR, project follow-through, anywhere consistency and trust matter most.'
    },
    C: {
      code: 'C',
      label: 'The Conscientious',
      tagline: 'Analytical, precise, quality-driven.',
      summary: 'You think before you speak, and you want the answer to be right. You ask the question others didn’t notice. At your best you raise the standard for the whole team; at your worst you can over-analyse, delay decisions and frustrate fast-movers who are happy to ship a B+.',
      strengths: [
        'High accuracy and quality',
        'Spots flaws before they ship',
        'Thinks systematically',
        'Trusted with complex detail'
      ],
      watchouts: [
        'Slow to commit without enough data',
        'Can come across as cold or critical',
        'Perfectionism delays delivery',
        'Reluctant to share half-formed ideas'
      ],
      tipsForOthers: [
        'Bring data and reasoning, not vibes',
        'Give them time to think before they answer',
        'Be specific about the standard you want',
        'Don’t take their questions as resistance'
      ],
      bestRoles: 'Engineering, finance, compliance, research, QA, anything where being right matters more than being fast.'
    },

    // ---------- Two-letter blends (when top two are within 6 pts) ----------
    DI: {
      code: 'DI',
      label: 'Driver-Influencer',
      tagline: 'Bold, charismatic, leads from the front.',
      summary: 'You combine the decisiveness of a Driver with the warmth of an Influencer. You set the direction AND make people want to follow. Watch the impatience-with-detail trap — your two strongest modes both want to move fast.',
      strengths: ['Charismatic leadership', 'Fast decisions with buy-in', 'Drives change visibly', 'Comfortable in front of a room'],
      watchouts: ['Can dominate the room', 'Skips the detail', 'Over-promises in the moment', 'Steamrolls cautious voices'],
      tipsForOthers: ['Lead with outcome AND why it matters', 'Pin down the specifics afterwards', 'Don’t take the volume personally'],
      bestRoles: 'Founder, head of sales, executive leadership, public-facing roles.'
    },
    ID: {
      code: 'ID',
      label: 'Influencer-Driver',
      tagline: 'Energetic, persuasive, takes the lead.',
      summary: 'You bring people along with charm first, but you’re happy to take the wheel when needed. Be careful not to over-rely on persuasion when a hard conversation is the right move.',
      strengths: ['Inspires action', 'Quick to step up', 'Strong network', 'Optimistic under pressure'],
      watchouts: ['Avoids hard truths', 'Loses interest mid-project', 'Over-commits the team'],
      tipsForOthers: ['Acknowledge their idea before challenging it', 'Lock in deliverables in writing'],
      bestRoles: 'Sales leadership, BD, marketing leads, evangelist roles.'
    },
    DC: {
      code: 'DC',
      label: 'Driver-Conscientious',
      tagline: 'Decisive, demanding, high standards.',
      summary: 'You decide fast AND you decide carefully. Results matter and so does quality. You can be tough — both on yourself and the team. Soften the edges; people perform better when they don’t feel constantly graded.',
      strengths: ['Strategic and decisive', 'Holds a high bar', 'Spots weak logic fast', 'Owns outcomes'],
      watchouts: ['Comes across as harsh', 'Impatient with looser thinkers', 'Hard to please'],
      tipsForOthers: ['Bring evidence and a recommendation', 'Don’t pad the message — they’ll see through it'],
      bestRoles: 'CTO, COO, head of strategy, technical leadership.'
    },
    CD: {
      code: 'CD',
      label: 'Conscientious-Driver',
      tagline: 'Analytical, principled, quietly demanding.',
      summary: 'You think things through, then push hard once you’re sure. You are tough on quality without needing to be loud. Your risk is over-analysis before action — sometimes B+ now beats A+ in three weeks.',
      strengths: ['Rigorous reasoning', 'Holds standards quietly', 'Decisive once convinced', 'Trusted with complex calls'],
      watchouts: ['Slow to commit', 'Hard to read', 'Critical of imprecise work'],
      tipsForOthers: ['Bring the analysis, not the pitch', 'Give them quiet time to land on a view'],
      bestRoles: 'Architecture, research lead, audit, deep technical roles.'
    },
    IS: {
      code: 'IS',
      label: 'Influencer-Steady',
      tagline: 'Warm, supportive, people-first.',
      summary: 'You blend the energy of an Influencer with the dependability of a Steady. People feel safe AND inspired around you. Watch out for over-accommodating — being everyone’s friend can quietly delay decisions that need to be made.',
      strengths: ['Builds team culture', 'Easy to trust', 'Defuses conflict', 'Balances energy and consistency'],
      watchouts: ['Avoids hard conversations', 'Says yes when they should say no', 'Defers leadership'],
      tipsForOthers: ['Ask their honest view, then wait', 'Don’t mistake niceness for agreement'],
      bestRoles: 'Customer success, team leadership, training, community roles.'
    },
    SI: {
      code: 'SI',
      label: 'Steady-Influencer',
      tagline: 'Calm, friendly, quietly persuasive.',
      summary: 'You are the easy-to-work-with one. Calm by default, warm when needed, and you bring people on without forcing it. Push yourself to speak up earlier — your view often arrives after the decision was made.',
      strengths: ['Trusted by everyone', 'Patient mentor', 'Calm presence', 'Quietly influential'],
      watchouts: ['Holds back opinions', 'Slow to push back', 'Can be overlooked for promotion'],
      tipsForOthers: ['Invite their view directly', 'Recognise the quiet contribution'],
      bestRoles: 'Operations, HR, account management, mentorship, internal partnerships.'
    },
    SC: {
      code: 'SC',
      label: 'Steady-Conscientious',
      tagline: 'Quiet, careful, deeply reliable.',
      summary: 'You combine calm dependability with careful precision. People trust your work without needing to check it. Your risk is invisibility — your output is excellent, but you might not market yourself enough for the room to notice.',
      strengths: ['Extremely reliable', 'High accuracy', 'Long-term trust', 'Steady under pressure'],
      watchouts: ['Avoids the spotlight', 'Slow to advocate for self', 'Resists rapid change'],
      tipsForOthers: ['Give them time and clear specs', 'Recognise consistency openly'],
      bestRoles: 'Finance, compliance, project management, ops, deep specialist tracks.'
    },
    CS: {
      code: 'CS',
      label: 'Conscientious-Steady',
      tagline: 'Precise, patient, quality and calm.',
      summary: 'You think carefully, work consistently, and rarely lose your head. You are the person teams rely on for the answer that holds up. Watch over-thinking — sometimes the team needs a decision more than a perfect one.',
      strengths: ['Rigorous and reliable', 'Calm analytical mind', 'Trusted on detail', 'Steady contributor'],
      watchouts: ['Analysis paralysis', 'Reluctant to share early ideas', 'Slow to embrace change'],
      tipsForOthers: ['Give a clear standard up front', 'Don’t rush them into a verbal answer'],
      bestRoles: 'Engineering, audit, scientific work, long-form research, infrastructure.'
    },

    // ---------- Balanced (no clear primary) ----------
    BALANCED: {
      code: 'BALANCED',
      label: 'The Adapter',
      tagline: 'Flexible, balanced, reads the room.',
      summary: 'You don’t lean strongly into any one DISC quadrant — your scores are close together. That usually means you adapt your style to the situation rather than defaulting to one mode. You can lead, listen, push or analyse depending on what the moment needs. The risk is that other people aren’t sure what to expect from you, so be deliberate about which mode you’re in for a given task.',
      strengths: ['Versatile across situations', 'Reads context well', 'Bridges different styles', 'Hard to throw off'],
      watchouts: ['Others may struggle to predict you', 'Can lack a clear personal brand', 'May not fully commit to one style'],
      tipsForOthers: ['Tell them which mode you need from them', 'Don’t assume — ask their preference'],
      bestRoles: 'Generalist, consultant, chief of staff, founding-team roles, integrator positions.'
    }
  }
};
