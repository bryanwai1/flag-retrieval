/*
 * DISC Projector — live big-screen view of where every participant
 * sits on the DISC quadrant. Polls Supabase every 5 seconds, redraws.
 *
 * URL: disc-projector.html?s=<session-code>
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { drawQuadrant } from './disc-chart.js?v=20260505b';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(window.location.search);
const sessionCode = (qs.get('s') || '').trim().toLowerCase();

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const state = {
  session: null,
  rows: []
};

function showError(title, detail) {
  $('screenLoading').hidden = true;
  $('screenLive').hidden = true;
  $('screenError').hidden = false;
  $('errTitle').textContent = title;
  $('errDetail').textContent = detail || '';
}

async function bootstrap() {
  if (!sessionCode) {
    showError('No session link', 'Open this page with ?s=<session-code> to project a live DISC map.');
    return;
  }

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

  const joinUrl = `${location.origin}/disc-quiz.html?s=${encodeURIComponent(session.code)}`;
  $('joinQr').src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&bgcolor=ffffff&color=0F172A&data=${encodeURIComponent(joinUrl)}`;
  $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, '');
  $('joinCode').textContent = session.code;

  $('screenLoading').hidden = true;
  $('screenLive').hidden = false;

  await refresh();
  setInterval(refresh, 5000);
}

async function refresh() {
  // Note: the public anon key only allows SELECT on submissions for
  // admins. Projector pages must therefore be opened by an admin who's
  // already logged in via the admin dashboard (same browser session),
  // OR you can open up a read-only RLS policy for projector use.
  const { data, error } = await sb
    .from('submissions')
    .select('full_name, primary_type, d_score, i_score, s_score, c_score, answers, submitted_at')
    .eq('session_id', state.session.id)
    .order('submitted_at', { ascending: true });

  if (error) {
    console.warn('projector load error', error.message);
    return;
  }
  state.rows = data || [];

  renderStats();
  renderCanvas();
  $('lastUpdate').textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

function renderStats() {
  const counts = { total: state.rows.length, D: 0, I: 0, S: 0, C: 0 };
  state.rows.forEach(r => {
    const t = (r.primary_type || '')[0];
    if (counts[t] != null) counts[t]++;
  });
  $('countTotal').textContent = counts.total;
  $('countD').textContent = counts.D;
  $('countI').textContent = counts.I;
  $('countS').textContent = counts.S;
  $('countC').textContent = counts.C;
}

function renderCanvas() {
  const canvas = $('projCanvas');
  const dots = state.rows.map(r => {
    const pos = (r.answers && r.answers.position) || computePos(r);
    return {
      label: r.full_name,
      x: pos.x,
      y: pos.y,
      primary: r.primary_type,
      isYou: false
    };
  });

  // De-overlap labels by jittering coincident points slightly
  const seen = new Map();
  dots.forEach(d => {
    const key = `${Math.round(d.x)}|${Math.round(d.y)}`;
    const n = seen.get(key) || 0;
    if (n > 0) {
      d.x += (n % 2 === 0 ? 1 : -1) * (1.6 + Math.floor(n / 2));
      d.y += (n % 3 === 0 ? -1 : 1) * (1.6 + Math.floor(n / 3));
    }
    seen.set(key, n + 1);
  });

  drawQuadrant(canvas, dots);
}

function computePos(r) {
  return {
    x: (r.i_score + r.s_score) - (r.d_score + r.c_score),
    y: (r.d_score + r.i_score) - (r.s_score + r.c_score)
  };
}

// Fullscreen on F
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

bootstrap();
