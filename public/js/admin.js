/*
 * Game Hub — DISC admin dashboard.
 * Login + sessions + per-session detail. DISC-only (no literacy quiz path).
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { drawQuadrant } from './disc-chart.js?v=20260504a';

const $  = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const DISC_COLORS = { D: '#ef4444', I: '#f59e0b', S: '#10b981', C: '#3b82f6', BALANCED: '#8b5cf6' };
const DISC_SLUG = 'disc-personality';

const state = {
  user: null,
  discTest: null,
  sessions: [],
  submissions: [],
  activeSessionId: null
};

// ---------- Screens ----------

function show(screenId) {
  $$('.admin-screen').forEach(el => el.classList.remove('active'));
  $(screenId).classList.add('active');
}

function toast(msg, kind = 'info') {
  const el = $('adminToast');
  el.textContent = msg;
  el.className = `admin-toast admin-toast--${kind} visible`;
  setTimeout(() => el.classList.remove('visible'), 3500);
}

// ---------- Bootstrap ----------

async function bootstrap() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR-PROJECT')) {
    $('loginError').textContent = 'Supabase is not configured. See SUPABASE_SETUP.md.';
    show('screenLogin');
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.user = session.user;
    await loadDashboard();
  } else {
    show('screenLogin');
  }
}

// ---------- Login ----------

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginError').textContent = '';
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    $('loginError').textContent = error.message;
    return;
  }
  state.user = data.user;
  await loadDashboard();
});

const onLogout = async () => {
  await sb.auth.signOut();
  state.user = null;
  show('screenLogin');
};
$('logoutBtn').addEventListener('click', onLogout);
$('logoutBtn2').addEventListener('click', onLogout);

$('backToSessionsBtn').addEventListener('click', () => {
  state.activeSessionId = null;
  show('screenDashboard');
});

// ---------- Dashboard ----------

async function loadDashboard() {
  show('screenDashboard');
  $('adminEmail').textContent = state.user.email;
  $('adminEmail2').textContent = state.user.email;
  await loadDiscTest();
  await Promise.all([loadSessions(), loadSubmissions()]);
  renderAll();
}

async function loadDiscTest() {
  const { data, error } = await sb.from('tests').select('*').eq('slug', DISC_SLUG).single();
  if (error) { toast(`Tests: ${error.message}`, 'error'); return; }
  state.discTest = data;
}

async function loadSessions() {
  if (!state.discTest) { state.sessions = []; return; }
  const { data, error } = await sb.from('sessions')
    .select('*')
    .eq('test_id', state.discTest.id)
    .order('created_at', { ascending: false });
  if (error) { toast(`Sessions: ${error.message}`, 'error'); return; }
  state.sessions = data || [];
}

async function loadSubmissions() {
  if (state.sessions.length === 0) { state.submissions = []; return; }
  const ids = state.sessions.map(s => s.id);
  const { data, error } = await sb.from('submissions')
    .select('*')
    .in('session_id', ids)
    .order('submitted_at', { ascending: false });
  if (error) { toast(`Submissions: ${error.message}`, 'error'); return; }
  state.submissions = data || [];
}

function renderAll() {
  renderSessionsTable();
  renderStats();
}

function renderStats() {
  $('statSessions').textContent = state.sessions.length;
  $('statSubmissions').textContent = state.submissions.length;
  let d = 0, i = 0, s = 0, c = 0;
  state.submissions.forEach(sub => {
    const t = (sub.primary_type || '')[0];
    if (t === 'D') d++;
    else if (t === 'I') i++;
    else if (t === 'S') s++;
    else if (t === 'C') c++;
  });
  $('statD').textContent = d;
  $('statI').textContent = i;
  $('statS').textContent = s;
  $('statC').textContent = c;
}

// ---------- Sessions ----------

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function shareLinkForSession(sess) {
  const base = `${location.origin}${location.pathname.replace(/admin\.html$/, '')}`;
  return `${base}disc-quiz.html?s=${encodeURIComponent(sess.code)}`;
}

function projectorLinkForSession(sess) {
  const base = `${location.origin}${location.pathname.replace(/admin\.html$/, '')}`;
  return `${base}disc-projector.html?s=${encodeURIComponent(sess.code)}`;
}

function renderSessionsTable() {
  const tbody = $('sessionsTbody');
  tbody.innerHTML = '';
  if (state.sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No sessions yet. Create one above.</td></tr>';
    return;
  }
  state.sessions.forEach(s => {
    const subCount = state.submissions.filter(sub => sub.session_id === s.id).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong></strong><div class="admin-muted-sm"></div></td>
      <td></td>
      <td>${subCount}</td>
      <td><span class="admin-pill admin-pill--${s.is_active ? 'green' : 'grey'}">${s.is_active ? 'Active' : 'Closed'}</span></td>
      <td class="admin-row-actions">
        <button class="admin-icon-btn" data-action="open" title="Open session details">&#x1F4C2;</button>
        <button class="admin-icon-btn" data-action="copy-link" title="Copy share link">&#x1F517;</button>
        <button class="admin-icon-btn" data-action="toggle-active" title="Toggle active">${s.is_active ? '\u{1F512}' : '\u{1F513}'}</button>
        <button class="admin-icon-btn admin-icon-btn--danger" data-action="delete" title="Delete session">\u{1F5D1}</button>
      </td>`;
    tr.querySelector('strong').textContent = s.company_name;
    tr.querySelector('.admin-muted-sm').textContent = s.event_date || '';
    tr.children[1].textContent = s.code;

    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openSessionDetail(s.id);
    });

    tr.querySelector('[data-action="open"]').addEventListener('click', () => openSessionDetail(s.id));
    tr.querySelector('[data-action="copy-link"]').addEventListener('click', () => {
      navigator.clipboard.writeText(shareLinkForSession(s)).then(() => toast('Link copied to clipboard.'));
    });
    tr.querySelector('[data-action="toggle-active"]').addEventListener('click', async () => {
      const { error } = await sb.from('sessions').update({ is_active: !s.is_active }).eq('id', s.id);
      if (error) return toast(error.message, 'error');
      await loadSessions(); renderSessionsTable();
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`Delete session "${s.company_name}" and all its submissions? This cannot be undone.`)) return;
      const { error } = await sb.from('sessions').delete().eq('id', s.id);
      if (error) return toast(error.message, 'error');
      toast('Session deleted.');
      await Promise.all([loadSessions(), loadSubmissions()]);
      renderAll();
    });

    tbody.appendChild(tr);
  });
}

$('newSessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.discTest) return toast('DISC test not loaded.', 'error');
  const company_name = $('newSessionCompany').value.trim();
  const event_date = $('newSessionDate').value || null;
  const notes = $('newSessionNotes').value.trim() || null;
  if (!company_name) return;

  const base = slugify(company_name);
  const code = event_date
    ? `${base}-${event_date}`
    : `${base}-${Date.now().toString(36)}`;

  const { error } = await sb.from('sessions').insert({
    test_id: state.discTest.id,
    company_name, event_date, notes, code, is_active: true
  });
  if (error) return toast(error.message, 'error');
  toast('Session created.');
  e.target.reset();
  await loadSessions();
  renderSessionsTable();
});

// ---------- Session detail ----------

function openSessionDetail(sessionId) {
  state.activeSessionId = sessionId;
  show('screenSessionDetail');
  renderSessionDetail();
}

function renderSessionDetail() {
  const sess = state.sessions.find(s => s.id === state.activeSessionId);
  if (!sess) return;
  const subs = state.submissions.filter(s => s.session_id === sess.id);

  $('sessionHeader').textContent = sess.company_name;
  $('sessionHeaderSub').textContent =
    `DISC Personality Test  ·  ${sess.code}${sess.event_date ? '  ·  ' + sess.event_date : ''}  ·  ${subs.length} submissions`;
  $('openProjectorBtn').href = projectorLinkForSession(sess);

  $('copyShareLinkBtn').onclick = () => {
    navigator.clipboard.writeText(shareLinkForSession(sess)).then(() => toast('Share link copied.'));
  };
  $('exportSessionCsvBtn').onclick = () => exportSessionCsv(sess, subs);
  $('exportSessionPdfBtn').onclick = () => exportSessionPdf(sess, subs);

  renderDiscSummary(subs);
  renderSessionSubmissionsTable(subs);
}

function renderDiscSummary(subs) {
  const counts = { D: 0, I: 0, S: 0, C: 0, blend: 0, balanced: 0 };
  let dSum = 0, iSum = 0, sSum = 0, cSum = 0;
  subs.forEach(s => {
    const t = s.primary_type || '';
    if (t === 'BALANCED') counts.balanced++;
    else if (t.length === 2) counts.blend++;
    else if (counts[t] != null) counts[t]++;
    dSum += s.d_score || 0; iSum += s.i_score || 0;
    sSum += s.s_score || 0; cSum += s.c_score || 0;
  });
  $('discCountD').textContent = counts.D;
  $('discCountI').textContent = counts.I;
  $('discCountS').textContent = counts.S;
  $('discCountC').textContent = counts.C;
  $('discCountBlend').textContent = counts.blend;
  $('discCountBalanced').textContent = counts.balanced;

  const n = Math.max(1, subs.length);
  const avg = { D: dSum / n, I: iSum / n, S: sSum / n, C: cSum / n };

  const barsEl = $('discAvgBars');
  barsEl.innerHTML = '';
  ['D', 'I', 'S', 'C'].forEach(k => {
    const row = document.createElement('div');
    row.className = 'admin-disc-bar';
    const pct = Math.round(((avg[k] - 10) / 40) * 100);
    row.innerHTML = `
      <span class="admin-disc-bar-key disc-stat-${k}">${k}</span>
      <span class="admin-disc-bar-track"><span class="admin-disc-bar-fill" style="width: ${Math.max(2, pct)}%; background: ${DISC_COLORS[k]};"></span></span>
      <span class="admin-disc-bar-val">${avg[k].toFixed(1)} / 50</span>`;
    barsEl.appendChild(row);
  });

  const dots = subs.map(s => {
    const pos = (s.answers && s.answers.position) || {
      x: ((s.i_score || 0) + (s.s_score || 0)) - ((s.d_score || 0) + (s.c_score || 0)),
      y: ((s.d_score || 0) + (s.i_score || 0)) - ((s.s_score || 0) + (s.c_score || 0))
    };
    return { label: s.full_name, x: pos.x, y: pos.y, primary: s.primary_type || 'BALANCED', isYou: false };
  });
  drawQuadrant($('adminQuadrantCanvas'), dots);
}

function renderSessionSubmissionsTable(subs) {
  const tbody = $('sessionSubmissionsTbody');
  tbody.innerHTML = '';
  if (subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">No submissions yet for this session.</td></tr>';
    return;
  }
  subs.forEach(sub => {
    const tr = document.createElement('tr');
    const type = sub.primary_type || 'BALANCED';
    const tr1 = type[0];
    const resultBadge = `<span class="admin-pill admin-disc-pill admin-disc-pill--${tr1}">${type}</span>`;
    const scoreCell = `${sub.d_score || 0} / ${sub.i_score || 0} / ${sub.s_score || 0} / ${sub.c_score || 0}`;

    tr.innerHTML = `
      <td><strong></strong></td>
      <td></td>
      <td></td>
      <td></td>
      <td>${resultBadge}</td>
      <td class="admin-mono">${scoreCell}</td>
      <td class="admin-muted-sm">${new Date(sub.submitted_at).toLocaleString()}</td>`;
    tr.children[0].querySelector('strong').textContent = sub.full_name;
    tr.children[1].textContent = sub.age || '—';
    tr.children[2].textContent = sub.position || '—';
    tr.children[3].textContent = sub.email || '—';
    tbody.appendChild(tr);
  });
}

// ---------- Exports ----------

function exportSessionCsv(sess, subs) {
  if (subs.length === 0) { toast('Nothing to export.', 'error'); return; }
  const header = ['full_name','age','position','email','primary_type','d_score','i_score','s_score','c_score','submitted_at'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  subs.forEach(sub => {
    const row = [
      sub.full_name, sub.age || '', sub.position || '', sub.email || '',
      sub.primary_type || '', sub.d_score || 0, sub.i_score || 0, sub.s_score || 0, sub.c_score || 0,
      sub.submitted_at
    ];
    lines.push(row.map(esc).join(','));
  });
  download(`${sess.code}-${new Date().toISOString().slice(0,10)}.csv`,
           lines.join('\n'), 'text/csv');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSessionPdf(sess, subs) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast('PDF library failed to load.', 'error'); return;
  }
  if (subs.length === 0) { toast('No submissions to report.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Cover
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text('GAME HUB  ·  SESSION REPORT', margin, y);
  y += 26;

  doc.setFontSize(28);
  doc.setTextColor(20);
  doc.text(sess.company_name, margin, y); y += 28;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('DISC Personality Test', margin, y); y += 16;
  doc.text(`Session code: ${sess.code}`, margin, y); y += 14;
  if (sess.event_date) { doc.text(`Event date: ${sess.event_date}`, margin, y); y += 14; }
  doc.text(`Submissions: ${subs.length}`, margin, y); y += 14;
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); y += 26;

  addDiscReportContent(doc, subs, margin, y, pageW, pageH);

  const filename = `${sess.code}-report-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

function addDiscReportContent(doc, subs, margin, startY, pageW, pageH) {
  let y = startY;
  // Distribution
  const counts = { D: 0, I: 0, S: 0, C: 0, blend: 0, balanced: 0 };
  let dSum = 0, iSum = 0, sSum = 0, cSum = 0;
  subs.forEach(s => {
    const t = s.primary_type || '';
    if (t === 'BALANCED') counts.balanced++;
    else if (t.length === 2) counts.blend++;
    else if (counts[t] != null) counts[t]++;
    dSum += s.d_score || 0; iSum += s.i_score || 0;
    sSum += s.s_score || 0; cSum += s.c_score || 0;
  });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text('DISC distribution', margin, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(40);
  const lines = [
    `Dominance (D): ${counts.D}`,
    `Influence (I): ${counts.I}`,
    `Steadiness (S): ${counts.S}`,
    `Conscientiousness (C): ${counts.C}`,
    `Two-letter blends: ${counts.blend}`,
    `Balanced (centred): ${counts.balanced}`
  ];
  lines.forEach(l => { doc.text(l, margin, y); y += 14; });
  y += 8;

  // Average scores
  const n = Math.max(1, subs.length);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text('Average scores', margin, y); y += 18;
  const drawBar = (label, value, color) => {
    const barW = pageW - margin * 2 - 100;
    const pct = (value - 10) / 40;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(40);
    doc.text(label, margin, y + 10);
    doc.setFillColor(230, 232, 236);
    doc.rect(margin + 30, y, barW, 12, 'F');
    doc.setFillColor(...hexToRgb(color));
    doc.rect(margin + 30, y, Math.max(2, barW * pct), 12, 'F');
    doc.text(`${value.toFixed(1)} / 50`, margin + 30 + barW + 8, y + 10);
    y += 20;
  };
  drawBar('D', dSum / n, DISC_COLORS.D);
  drawBar('I', iSum / n, DISC_COLORS.I);
  drawBar('S', sSum / n, DISC_COLORS.S);
  drawBar('C', cSum / n, DISC_COLORS.C);
  y += 12;

  // Group quadrant chart
  const off = document.createElement('canvas');
  off.width = 720; off.height = 720;
  const dots = subs.map(s => {
    const pos = (s.answers && s.answers.position) || {
      x: ((s.i_score || 0) + (s.s_score || 0)) - ((s.d_score || 0) + (s.c_score || 0)),
      y: ((s.d_score || 0) + (s.i_score || 0)) - ((s.s_score || 0) + (s.c_score || 0))
    };
    return { label: s.full_name, x: pos.x, y: pos.y, primary: s.primary_type || 'BALANCED' };
  });
  drawQuadrant(off, dots);
  const chartW = pageW - margin * 2;
  const chartH = chartW;
  if (y + chartH > pageH - margin) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text('Group quadrant map', margin, y); y += 18;
  doc.addImage(off.toDataURL('image/png'), 'PNG', margin, y, chartW, chartH);
  y += chartH + 12;

  // Per-participant table
  doc.addPage(); y = margin;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text('Participant results', margin, y); y += 18;

  const colX = [margin, margin + 170, margin + 215, margin + 350, margin + 395, margin + 425, margin + 455, margin + 485];
  doc.setFontSize(10); doc.setTextColor(120);
  ['Name', 'Age', 'Position', 'Type', 'D', 'I', 'S', 'C'].forEach((h, i) => doc.text(h, colX[i], y));
  y += 12;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y); y += 10;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40);
  subs.forEach(s => {
    if (y > pageH - margin - 14) {
      doc.addPage(); y = margin;
    }
    doc.text(truncate(s.full_name, 26), colX[0], y);
    doc.text(String(s.age || '—'), colX[1], y);
    doc.text(truncate(s.position || '—', 20), colX[2], y);
    doc.text(s.primary_type || '—', colX[3], y);
    doc.text(String(s.d_score || 0), colX[4], y);
    doc.text(String(s.i_score || 0), colX[5], y);
    doc.text(String(s.s_score || 0), colX[6], y);
    doc.text(String(s.c_score || 0), colX[7], y);
    y += 14;
  });
}

function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

bootstrap().catch(err => {
  console.error(err);
  $('loginError').textContent = err.message || String(err);
  show('screenLogin');
});
