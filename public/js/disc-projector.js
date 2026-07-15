/*
 * DISC Projector — live big-screen view of where every participant
 * sits on the DISC quadrant.
 *
 * URL: disc-projector.html            → session picker
 *      disc-projector.html?s=<code>   → live view for that session
 *
 * The live view shows a join QR (participants scan it, enter their
 * name and pick an emoji on the quiz landing page) and reads the
 * public `disc_live` table — no admin login required. Each finished
 * participant appears as their emoji on the quadrant, with a legend
 * on the side mapping emoji → name.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { drawQuadrant, quadrantColor } from './disc-chart.js?v=20260715a';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(window.location.search);
const sessionCode = (qs.get('s') || '').trim().toLowerCase();

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const DISC_SLUG = 'disc-personality';

const state = {
  session: null,
  entries: []
};

function showScreen(id) {
  ['screenLoading', 'screenPicker', 'screenError', 'screenLive'].forEach(s => {
    $(s).hidden = s !== id;
  });
}

function showError(title, detail) {
  showScreen('screenError');
  $('errTitle').textContent = title;
  $('errDetail').textContent = detail || '';
}

// ---------------------------------------------------------------
// Session picker (no ?s= in the URL)
// ---------------------------------------------------------------

async function loadPicker() {
  const { data: test, error: tErr } = await sb
    .from('tests').select('id')
    .eq('slug', DISC_SLUG).maybeSingle();
  if (tErr || !test) {
    showError('DISC test not found', tErr ? tErr.message : 'The DISC test is not seeded in the database.');
    return;
  }

  const { data: sessions, error: sErr } = await sb
    .from('sessions')
    .select('code, company_name, event_date, is_active, created_at')
    .eq('test_id', test.id)
    .order('created_at', { ascending: false });
  if (sErr) {
    showError('Couldn’t load sessions', sErr.message);
    return;
  }

  const list = $('pickerList');
  list.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    list.innerHTML = '<p class="disc-projector-picker-empty">No sessions yet. Create one in the DISC Admin dashboard first.</p>';
  } else {
    // Active sessions first, then most recent.
    sessions.sort((a, b) => (b.is_active - a.is_active));
    sessions.forEach(s => {
      const a = document.createElement('a');
      a.className = 'disc-projector-picker-item';
      a.href = `disc-projector.html?s=${encodeURIComponent(s.code)}`;
      a.innerHTML = `
        <span class="disc-projector-picker-name"></span>
        <span class="disc-projector-picker-meta"></span>
        <span class="admin-pill ${s.is_active ? 'admin-pill--green' : 'admin-pill--grey'}">${s.is_active ? 'Active' : 'Closed'}</span>`;
      a.querySelector('.disc-projector-picker-name').textContent = s.company_name;
      a.querySelector('.disc-projector-picker-meta').textContent =
        `${s.code}${s.event_date ? '  ·  ' + s.event_date : ''}`;
      list.appendChild(a);
    });
  }
  showScreen('screenPicker');
}

// ---------------------------------------------------------------
// Live view
// ---------------------------------------------------------------

function joinLink() {
  const base = `${location.origin}${location.pathname.replace(/disc-projector\.html$/, '')}`;
  return `${base}disc-quiz.html?s=${encodeURIComponent(state.session.code)}`;
}

function drawJoinQr() {
  const link = joinLink();
  const qr = window.qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const canvas = $('joinQrCanvas');
  const ctx = canvas.getContext('2d');
  const moduleCount = qr.getModuleCount();
  const cellSize = 8;
  const margin = 3;
  const size = (moduleCount + margin * 2) * cellSize;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0b0f1a';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
      }
    }
  }
  $('joinLinkText').textContent = link.replace(/^https?:\/\//, '');
}

async function loadLive() {
  const { data: session, error } = await sb
    .from('sessions')
    .select('id, code, company_name, event_date')
    .eq('code', sessionCode)
    .maybeSingle();

  if (error || !session) {
    showError('Session not found', 'Double-check the session code in the URL.');
    return;
  }

  state.session = session;
  $('sessionTitle').textContent =
    `${session.company_name}${session.event_date ? '  ·  ' + session.event_date : ''}`;
  showScreen('screenLive');
  drawJoinQr();

  await refresh();
  setInterval(refresh, 4000);
}

async function refresh() {
  const { data, error } = await sb
    .from('disc_live')
    .select('full_name, emoji, x, y, primary_type, created_at, finished_at')
    .eq('session_id', state.session.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('projector load error', error.message);
    showError('Live board unavailable',
      `${error.message} — has supabase/disc-live-schema.sql been run in this project?`);
    return;
  }
  state.entries = data || [];

  renderStats();
  renderLegend();
  renderCanvas();
  $('lastUpdate').textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

function renderStats() {
  const done = state.entries.filter(e => e.finished_at);
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  done.forEach(e => {
    const t = (e.primary_type || '')[0];
    if (counts[t] != null) counts[t]++;
  });
  $('countTotal').textContent = state.entries.length;
  $('countDone').textContent = done.length;
  $('countD').textContent = counts.D;
  $('countI').textContent = counts.I;
  $('countS').textContent = counts.S;
  $('countC').textContent = counts.C;
}

function renderLegend() {
  const list = $('legendList');
  list.innerHTML = '';
  $('legendCount').textContent = state.entries.length ? `(${state.entries.length})` : '';
  if (state.entries.length === 0) {
    list.innerHTML = '<li class="disc-projector-legend-empty">Nobody has joined yet — scan the QR to be first!</li>';
    return;
  }
  state.entries.forEach(e => {
    const li = document.createElement('li');
    li.className = e.finished_at ? 'is-done' : 'is-pending';
    const type = e.finished_at ? (e.primary_type || '') : '';
    li.innerHTML = `
      <span class="disc-legend-emoji"></span>
      <span class="disc-legend-name"></span>
      <span class="disc-legend-type"></span>`;
    li.querySelector('.disc-legend-emoji').textContent = e.emoji;
    li.querySelector('.disc-legend-name').textContent = e.full_name;
    const typeEl = li.querySelector('.disc-legend-type');
    if (e.finished_at) {
      typeEl.textContent = type === 'BALANCED' ? '✨' : type;
      typeEl.style.color = quadrantColor(e.primary_type);
    } else {
      typeEl.textContent = '…';
      typeEl.title = 'Still taking the test';
    }
    list.appendChild(li);
  });
}

function renderCanvas() {
  const canvas = $('projCanvas');
  const dots = state.entries
    .filter(e => e.finished_at && e.x != null && e.y != null)
    .map(e => ({
      emoji: e.emoji,
      x: Number(e.x),
      y: Number(e.y),
      primary: e.primary_type,
      isYou: false
    }));

  // De-overlap coincident markers by jittering slightly
  const seen = new Map();
  dots.forEach(d => {
    const key = `${Math.round(d.x / 4)}|${Math.round(d.y / 4)}`;
    const n = seen.get(key) || 0;
    if (n > 0) {
      d.x += (n % 2 === 0 ? 1 : -1) * (4 + Math.floor(n / 2) * 3);
      d.y += (n % 3 === 0 ? -1 : 1) * (4 + Math.floor(n / 3) * 3);
    }
    seen.set(key, n + 1);
  });

  drawQuadrant(canvas, dots);
}

// Fullscreen on F
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

// ---------------------------------------------------------------
// Go
// ---------------------------------------------------------------

(sessionCode ? loadLive() : loadPicker()).catch(err => {
  console.error(err);
  showError('Something went wrong', err.message || String(err));
});
