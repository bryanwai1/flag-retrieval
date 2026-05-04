/*
 * DISC Personality Test — engine.
 * Loads session, runs the 40-statement Likert quiz, scores into D/I/S/C
 * axes, plots the participant on the DISC quadrant, and submits to
 * Supabase. Also handles the participant PDF download.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { drawQuadrant, DISC_COLORS } from './disc-chart.js?v=20260504a';

export { drawQuadrant };

const $  = (id) => document.getElementById(id);
const qs = new URLSearchParams(window.location.search);
const sessionCode = (qs.get('s') || '').trim().toLowerCase();

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const quiz = window.DISC_QUIZ;

const state = {
  session: null,
  test: null,
  answers: new Array(quiz.questions.length).fill(null),
  currentIndex: 0,
  startedAt: null,
  result: null
};

// ---------------------------------------------------------------
// Screens
// ---------------------------------------------------------------

function show(screenId) {
  document.querySelectorAll('.quiz-screen').forEach(el => el.classList.remove('active'));
  $(screenId).classList.add('active');
}
function showError(msg, detail) {
  $('errTitle').textContent = msg;
  $('errDetail').textContent = detail || '';
  show('screenError');
}

// ---------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------

async function bootstrap() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR-PROJECT')) {
    showError('Setup incomplete',
      'Supabase credentials have not been configured. See SUPABASE_SETUP.md in the project root.');
    return;
  }
  if (!sessionCode) {
    showError('No session link',
      'This test must be opened using a session link (e.g. ?s=acme-2026-05-04). Ask your trainer for the correct link.');
    return;
  }

  const { data: session, error: sErr } = await sb
    .from('sessions')
    .select('id, code, company_name, event_date, is_active, test_id')
    .eq('code', sessionCode)
    .maybeSingle();

  if (sErr || !session) {
    showError('Session not found',
      'That link doesn’t match any active session. Double-check the URL your trainer shared.');
    return;
  }
  if (!session.is_active) {
    showError('Session closed',
      'This session is no longer accepting submissions.');
    return;
  }

  const { data: test, error: tErr } = await sb
    .from('tests').select('id, slug, name')
    .eq('id', session.test_id).maybeSingle();
  if (tErr || !test) {
    showError('Test misconfigured', 'The test linked to this session could not be loaded.');
    return;
  }

  state.session = session;
  state.test = test;

  $('quizTitle').textContent = quiz.title;
  $('quizSubtitle').textContent = quiz.subtitle;
  $('sessionCompany').textContent = session.company_name;
  if (session.event_date) {
    $('sessionDate').textContent = new Date(session.event_date).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  $('questionCount').textContent = quiz.questions.length;
  show('screenLanding');
}

// ---------------------------------------------------------------
// Landing
// ---------------------------------------------------------------

$('landingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fullName = $('fullName').value.trim();
  const ageRaw   = $('age').value.trim();
  const position = $('position').value.trim();
  if (!fullName || !ageRaw || !position) return;
  const age = parseInt(ageRaw, 10);
  if (Number.isNaN(age) || age < 14 || age > 99) return;

  state.fullName = fullName;
  state.age = age;
  state.position = position;
  state.email = $('email').value.trim() || null;
  state.startedAt = new Date().toISOString();
  state.currentIndex = 0;
  renderQuestion();
  show('screenQuiz');
});

// ---------------------------------------------------------------
// Quiz rendering
// ---------------------------------------------------------------

function renderQuestion() {
  const i = state.currentIndex;
  const q = quiz.questions[i];
  const total = quiz.questions.length;

  $('qProgressLabel').textContent = `Statement ${i + 1} of ${total}`;
  $('qProgressBar').style.width = `${((i) / total) * 100}%`;
  $('qText').textContent = q.text;

  const scaleEl = $('qScale');
  scaleEl.innerHTML = '';
  for (let v = 1; v <= 5; v++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'disc-scale-btn';
    btn.dataset.value = String(v);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', state.answers[i] === v ? 'true' : 'false');
    if (state.answers[i] === v) btn.classList.add('selected');
    btn.innerHTML = `<span class="disc-scale-num">${v}</span><span class="disc-scale-label">${quiz.scaleLabels[v - 1]}</span>`;
    btn.addEventListener('click', () => {
      state.answers[i] = v;
      scaleEl.querySelectorAll('.disc-scale-btn').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      $('qNext').disabled = false;
    });
    scaleEl.appendChild(btn);
  }

  $('qPrev').disabled = i === 0;
  $('qNext').disabled = state.answers[i] === null;
  $('qNext').textContent = i === total - 1 ? 'Submit →' : 'Next →';
}

$('qPrev').addEventListener('click', () => {
  if (state.currentIndex > 0) { state.currentIndex--; renderQuestion(); }
});

$('qNext').addEventListener('click', async () => {
  const total = quiz.questions.length;
  if (state.currentIndex < total - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    await submit();
  }
});

// ---------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------

const BLEND_BAND = 6;     // pts within which top-2 dimensions are a "blend"
const BALANCED_RANGE = 7; // if (max - min) across dims <= 7, profile is balanced

function computeScores() {
  const sums = { D: 0, I: 0, S: 0, C: 0 };
  quiz.questions.forEach((q, i) => {
    const v = state.answers[i] || 0;
    sums[q.dim] += v;
  });
  return sums; // each axis 10..50 (when fully answered)
}

function pickProfile(scores) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [top, second] = entries;
  const range = entries[0][1] - entries[entries.length - 1][1];

  // Balanced — no dimension is meaningfully higher than the others
  if (range <= BALANCED_RANGE) {
    return { primary: 'BALANCED', profile: quiz.profiles.BALANCED, blend: false };
  }

  // Blend — top two are within BLEND_BAND, return blend profile
  if (top[1] - second[1] <= BLEND_BAND) {
    const blendKey = `${top[0]}${second[0]}`;
    if (quiz.profiles[blendKey]) {
      return { primary: blendKey, profile: quiz.profiles[blendKey], blend: true };
    }
  }

  return { primary: top[0], profile: quiz.profiles[top[0]], blend: false };
}

function computePosition(scores) {
  // Map each axis 10..50 to a relative score, then plot.
  //   x = (I + S) - (D + C)   range -80..+80
  //   y = (D + I) - (S + C)   range -80..+80
  const x = (scores.I + scores.S) - (scores.D + scores.C);
  const y = (scores.D + scores.I) - (scores.S + scores.C);
  return { x, y };
}

// ---------------------------------------------------------------
// Submit
// ---------------------------------------------------------------

async function submit() {
  show('screenSubmitting');

  const scores = computeScores();
  const { primary, profile } = pickProfile(scores);
  const position = computePosition(scores);

  const result = {
    scores,
    primary,
    profile,
    position
  };
  state.result = result;

  const payload = {
    session_id: state.session.id,
    full_name: state.fullName,
    email: state.email,
    age: state.age,
    position: state.position,
    score: scores.D + scores.I + scores.S + scores.C,
    max_score: 4 * 5 * (quiz.questions.length / 4),
    result_tier: primary,
    primary_type: primary,
    d_score: scores.D,
    i_score: scores.I,
    s_score: scores.S,
    c_score: scores.C,
    answers: {
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      values: state.answers,
      position
    }
  };

  const { error } = await sb.from('submissions').insert(payload);
  if (error) {
    showError('Couldn’t submit your answers',
      error.message + ' — please tell your trainer.');
    return;
  }

  renderResultScreen();
  show('screenResult');
}

// ---------------------------------------------------------------
// Result screens
// ---------------------------------------------------------------

function renderResultScreen() {
  const { scores, primary, profile } = state.result;
  const badge = $('resultBadge');
  badge.textContent = profile.code === 'BALANCED' ? '✨' : profile.code;
  badge.className = `disc-result-badge disc-badge--${primary}`;

  $('resultLabel').textContent = profile.label;
  $('resultTagline').textContent = profile.tagline;
  $('resultSummary').textContent = profile.summary;
  $('resultName').textContent = state.fullName;
  $('scoreD').textContent = scores.D;
  $('scoreI').textContent = scores.I;
  $('scoreS').textContent = scores.S;
  $('scoreC').textContent = scores.C;
}

$('toQuadrantBtn').addEventListener('click', () => {
  renderQuadrantScreen();
  show('screenQuadrant');
});

function renderQuadrantScreen() {
  const { profile, position } = state.result;

  drawQuadrant($('quadrantCanvas'), [
    { label: 'You', x: position.x, y: position.y, primary: state.result.primary, isYou: true }
  ]);

  fillList('resultStrengths', profile.strengths);
  fillList('resultWatchouts', profile.watchouts);
  fillList('resultTips', profile.tipsForOthers);
  $('resultBestRoles').textContent = profile.bestRoles;
}

function fillList(id, items) {
  const el = $(id);
  el.innerHTML = '';
  (items || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    el.appendChild(li);
  });
}

// ---------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------

$('downloadPdfBtn').addEventListener('click', () => {
  generateParticipantPdf();
});

function generateParticipantPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library failed to load.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const { profile, scores, position } = state.result;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text('THE AI PLAYGROUND  ·  DISC PROFILE REPORT', margin, y);
  y += 24;

  doc.setFontSize(26);
  doc.setTextColor(20);
  doc.text(profile.label, margin, y);
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(70);
  doc.text(profile.tagline, margin, y);
  y += 24;

  // Participant
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text(`Name: ${state.fullName}`, margin, y); y += 16;
  doc.text(`Age: ${state.age}    Position: ${state.position}`, margin, y); y += 16;
  doc.text(`Session: ${state.session.company_name}${state.session.event_date ? '  ·  ' + state.session.event_date : ''}`, margin, y); y += 22;

  // Scores bars
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Your scores', margin, y); y += 14;

  const drawBar = (label, value, color) => {
    const barW = pageW - margin * 2 - 90;
    const pct = (value - 10) / 40; // 10..50 → 0..1
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(label, margin, y + 10);
    doc.setFillColor(230, 232, 236);
    doc.rect(margin + 30, y, barW, 12, 'F');
    doc.setFillColor(...hexToRgb(color));
    doc.rect(margin + 30, y, Math.max(2, barW * pct), 12, 'F');
    doc.text(`${value} / 50`, margin + 30 + barW + 8, y + 10);
    y += 20;
  };
  drawBar('D', scores.D, DISC_COLORS.D);
  drawBar('I', scores.I, DISC_COLORS.I);
  drawBar('S', scores.S, DISC_COLORS.S);
  drawBar('C', scores.C, DISC_COLORS.C);
  y += 8;

  // Quadrant chart — render to offscreen canvas at print res, embed
  const off = document.createElement('canvas');
  off.width = 720; off.height = 720;
  drawQuadrant(off, [{ label: state.fullName, x: position.x, y: position.y, primary: state.result.primary, isYou: true }]);
  const img = off.toDataURL('image/png');
  const chartW = pageW - margin * 2;
  const chartH = chartW;
  if (y + chartH > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
  doc.addImage(img, 'PNG', margin, y, chartW, chartH);
  y += chartH + 12;

  // New page for narrative
  doc.addPage();
  y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('What this means', margin, y); y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(50);
  const summaryLines = doc.splitTextToSize(profile.summary, pageW - margin * 2);
  doc.text(summaryLines, margin, y); y += summaryLines.length * 14 + 14;

  const writeBlock = (heading, items) => {
    if (y > doc.internal.pageSize.getHeight() - margin - 80) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(heading, margin, y); y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50);
    items.forEach(it => {
      const lines = doc.splitTextToSize('•  ' + it, pageW - margin * 2 - 8);
      if (y + lines.length * 14 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(lines, margin + 4, y);
      y += lines.length * 14 + 2;
    });
    y += 8;
  };

  writeBlock('Strengths', profile.strengths);
  writeBlock('Watch-outs', profile.watchouts);
  writeBlock('How others should work with you', profile.tipsForOthers);

  if (y > doc.internal.pageSize.getHeight() - margin - 60) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Where you shine', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(50);
  const roleLines = doc.splitTextToSize(profile.bestRoles, pageW - margin * 2);
  doc.text(roleLines, margin, y);

  const filename = `disc-${slug(state.fullName)}-${profile.code}.pdf`;
  doc.save(filename);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function slug(s) {
  return (s || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Go
bootstrap().catch(err => {
  console.error(err);
  showError('Something went wrong', err.message || String(err));
});
