/*
 * Launch Pad — projector (display only).
 *
 * launch-pad.html?e=<code>       → live 3-slide big-screen view
 *   &demo=1                      → localStorage-only rehearsal mode
 *
 * Slides are driven from Mission Control (launch-pad-admin.html): instantly
 * when both pages are open in the same browser (BroadcastChannel), otherwise
 * by polling li_events.slide every ~1.5s. F / double-click = fullscreen.
 * If the slide-control SQL hasn't been run, ← → / 1 2 3 work locally.
 *
 * Slides: 1 Submit (big QR + steps) · 2 Game Galaxy (library + submit QR)
 *         3 Cosmic Vote (vote + submit QR, live ranked scoreboard)
 *         4 Spotlight (poster carousel, auto-swipe or paused by the admin)
 */
import { makeStore, drawQr, startStarfield, esc, slideChannel, spotPosition } from './li-store.js?v=20261108d';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const qs = new URLSearchParams(location.search);
const demo = qs.get('demo') === '1';
const code = (qs.get('e') || '').trim().toLowerCase();
const GAMES_MS = 3000;
const SLIDE_MS = 1500;
const BOARD_MAX = 10;

const stars = startStarfield($('stars'));

const state = {
  store: null,
  event: null,
  slide: 0,
  remote: true,      // false when li_events.slide isn't available yet
  games: [],
  images: {},
  tally: {},
  voters: 0,
  votingOpen: false,
  first: true,
  prevVotes: {},
  spot: { auto: true, index: 0, seconds: 6, at: new Date().toISOString() },
  skew: 0,
  guardUntil: 0,     // ignore polled slide/spot briefly after a same-browser message
  spotKey: '',
  spotPrev: {}
};

const pageUrl = (file, extra = '') => {
  const base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  return `${base}${file}?e=${encodeURIComponent(code)}${demo ? '&demo=1' : ''}${extra}`;
};

function show(id) {
  ['screenSetup', 'screenError', 'screenLive'].forEach(s => { $(s).hidden = s !== id; });
}
function fail(title, detail) {
  $('errTitle').textContent = title;
  $('errDetail').textContent = detail || '';
  show('screenError');
}

// ------------------------------------------------------------------
// No event code: ask for one
// ------------------------------------------------------------------

function setupScreen() {
  show('screenSetup');
  if (demo) $('adminLink').href = 'launch-pad-admin.html?demo=1';
  $('openForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = $('openCode').value.trim().toLowerCase();
    if (c) location.href = `launch-pad.html?e=${encodeURIComponent(c)}${demo ? '&demo=1' : ''}`;
  });
}

// ------------------------------------------------------------------
// Live projector
// ------------------------------------------------------------------

async function startLive() {
  try {
    state.store = await makeStore(code, demo);
    state.event = await state.store.getEvent();
  } catch (err) {
    fail('Can’t reach the launch pad', err.message);
    return;
  }
  if (!state.event) { fail('Event not found', `No event with code “${code}”.`); return; }

  $$('.event-title').forEach(el => { el.textContent = state.event.title; });
  $$('.event-code').forEach(el => { el.textContent = code; });
  document.title = `${state.event.title} — Launch Pad`;
  $('modeBadge').textContent = demo ? 'Demo mode · this browser only' : '';

  show('screenLive');
  drawQrs();
  wireControls();
  state.remote = state.event.slide != null;
  goTo(state.event.slide || parseInt(location.hash.slice(1), 10) || 1);
  await pollGames();
  setInterval(pollGames, GAMES_MS);
  setInterval(pollSlide, SLIDE_MS);
  setInterval(() => { if (state.slide === 4) renderSpot(false); }, 150);
  addEventListener('resize', () => { renderLibrary(true); renderBoard(); renderSpot(true); });
}

function drawQrs() {
  const submit = pageUrl('launch-pad-play.html');
  const vote = pageUrl('launch-pad-play.html', '&v=1');
  $$('.qr-submit').forEach(c => drawQr(c, submit));
  $$('.qr-vote').forEach(c => drawQr(c, vote));
  $$('.qr-submit-url').forEach(el => { el.textContent = submit.replace(/^https?:\/\//, ''); });
}

// ---------- Slides ----------

function goTo(n) {
  n = Math.max(1, Math.min(4, n | 0));
  if (n === state.slide) return;
  state.slide = n;
  $$('.lp-slide').forEach(s => s.classList.toggle('active', s.dataset.slide === String(n)));
  history.replaceState(null, '', `${location.pathname}${location.search}#${n}`);
  if (n === 2) renderLibrary(true);
  if (n === 3) renderBoard();
  if (n === 4) renderSpot(true);
}

function wireControls() {
  // Same-browser admin → instant switch.
  slideChannel(code, demo).addEventListener('message', (e) => {
    const d = e.data || {};
    state.guardUntil = Date.now() + 3000;
    if (d.spot) { state.spot = d.spot; renderSpot(true); }
    if (d.slide) goTo(d.slide);
  });

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') { toggleFs(); return; }
    if (state.remote) return; // admin is in charge
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goTo(state.slide + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(state.slide - 1); }
    else if (['1', '2', '3', '4'].includes(e.key)) goTo(+e.key);
  });
  addEventListener('dblclick', toggleFs);
  setTimeout(() => $('fsHint').classList.add('gone'), 6000);
  document.addEventListener('fullscreenchange', () => $('fsHint').classList.add('gone'));
}

function toggleFs() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

// ---------- Polling ----------

function applyTally(t) {
  state.tally = t.tally || {};
  state.voters = t.voters || 0;
  state.votingOpen = !!t.voting_open;
  state.remote = t.slide != null;
  if (t.now) state.skew = Date.parse(t.now) - (t._recv || Date.now());
  if (Date.now() < state.guardUntil) return;
  if (t.spot && t.spot.at) state.spot = t.spot;
  if (state.remote) goTo(t.slide);
}

async function pollSlide() {
  try {
    applyTally(await state.store.tally());
    renderCounts();
    renderVoteState();
    if (state.slide === 3) renderBoard();
  } catch { /* pollGames reports errors */ }
}

const loadingImg = new Set();
async function loadImagesInBackground(ids) {
  ids.forEach(id => loadingImg.add(id));
  // Posters closest to the one in the Spotlight right now load first.
  const order = new Map(state.games.map((g, i) => [g.id, i]));
  const n = state.games.length || 1;
  const cur = spotPosition(state.spot, state.games, state.skew).index;
  const dist = (id) => { const d = Math.abs((order.get(id) ?? 0) - cur); return Math.min(d, n - d); };
  ids = [...ids].sort((a, b) => dist(a) - dist(b));
  for (let i = 0; i < ids.length; i += 4) {
    const batch = ids.slice(i, i + 4);
    try {
      Object.assign(state.images, await state.store.getImages(batch, 'image'));
    } catch { /* retried on a later poll */ }
    batch.forEach(id => loadingImg.delete(id));
    renderLibrary(false);
    renderBoard();
    if (state.slide === 4) renderSpot(false);
  }
}

async function pollGames() {
  try {
    const [games, t] = await Promise.all([state.store.listGames(), state.store.tally()]);
    const known = new Set(state.games.map(g => g.id));
    const fresh = games.filter(g => !known.has(g.id));
    const needImg = games.filter(g => !(g.id in state.images) && !loadingImg.has(g.id)).map(g => g.id);
    if (needImg.length && !state.first && needImg.length <= 3) {
      // A fresh upload or two: wait so the "new launch" toast has its poster.
      Object.assign(state.images, await state.store.getImages(needImg, 'image'));
    }
    // First load (or a big batch): show names now, fill posters in as they arrive.
    const background = needImg.filter(id => !(id in state.images));

    const changed = fresh.length || games.length !== state.games.length;
    state.games = games;
    applyTally(t);
    if (background.length) loadImagesInBackground(background);

    if (!state.first) fresh.forEach(g => queueToast(g));
    state.first = false;

    renderCounts();
    renderVoteState();
    if (changed) renderLibrary(false);
    renderBoard();
    $('modeBadge').textContent = demo ? 'Demo mode · this browser only' : '';
  } catch (err) {
    $('modeBadge').textContent = `⚠ ${err.message}`;
  }
}

function renderCounts() {
  $$('.count-games').forEach(el => { el.textContent = state.games.length; });
  const makers = new Set(state.games.map(g => g.author_name.trim().toLowerCase())).size;
  $$('.count-makers').forEach(el => { el.textContent = makers; });
  const total = Object.values(state.tally).reduce((a, b) => a + b, 0);
  $('countVotes').textContent = total;
  $('countVoters').textContent = state.voters;
}

function renderVoteState() {
  const pill = $('votePill');
  pill.className = `lp-pill ${state.votingOpen ? 'open' : 'closed'}`;
  pill.textContent = state.votingOpen ? 'Voting open' : 'Voting closed';
}

// ---------- Slide 2: library grid ----------

function fitGrid(n, W, H) {
  const gap = Math.round(Math.max(12, Math.min(26, W * 0.014)));
  const maxW = W * 0.55;
  const capH = (cw) => Math.max(14, Math.min(28, cw * 0.07)) * 3.7;
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const cw = Math.min(maxW, (W - gap * (cols - 1)) / cols);
    const rows = Math.ceil(n / cols);
    const ch = cw * 9 / 16 + capH(cw);
    if (rows * ch + (rows - 1) * gap <= H && (!best || cw > best.cw)) best = { cols, cw, gap, scroll: 0 };
  }
  if (best) return best;
  const cols = Math.max(1, Math.floor((W + gap) / (240 + gap)));
  const cw = (W - gap * (cols - 1)) / cols;
  const rows = Math.ceil(n / cols);
  const total = rows * (cw * 9 / 16 + capH(cw)) + (rows - 1) * gap;
  return { cols, cw, gap, scroll: total - H };
}

function renderLibrary(layoutOnly) {
  const lib = $('library');
  const n = state.games.length;
  if (!n) {
    lib.innerHTML = `<div class="lp-empty"><div><span class="big">🛸</span>No games have landed yet.<br>Scan the QR to be the first!</div></div>`;
    return;
  }
  let grid = lib.querySelector('.lp-grid');
  if (!grid) { lib.innerHTML = ''; grid = document.createElement('div'); grid.className = 'lp-grid'; lib.appendChild(grid); }

  if (!layoutOnly) {
    const existing = new Map(Array.from(grid.children).map(el => [el.dataset.id, el]));
    const ids = new Set(state.games.map(g => g.id));
    existing.forEach((el, id) => { if (!ids.has(id)) el.remove(); });
    state.games.forEach((g, i) => {
      let el = existing.get(g.id);
      if (!el) {
        el = document.createElement('article');
        el.className = 'lp-card';
        el.dataset.id = g.id;
        el.style.animationDelay = state.first ? `${Math.min(i, 20) * 40}ms` : '0ms';
        el.innerHTML = `
          <img class="lp-card-img" alt="">
          <div class="lp-card-cap">
            <div class="lp-card-name">${esc(g.game_name)}</div>
            <div class="lp-card-by">by ${esc(g.author_name)}</div>
          </div>`;
        el.addEventListener('click', () => window.open(g.link, '_blank', 'noopener'));
      }
      const img = el.querySelector('img');
      if (state.images[g.id] && img.getAttribute('src') !== state.images[g.id]) img.src = state.images[g.id];
      grid.appendChild(el); // keeps order
    });
  }

  if (state.slide !== 2 && layoutOnly) return;
  const W = lib.clientWidth, H = lib.clientHeight;
  if (!W || !H) return;
  const f = fitGrid(n, W, H);
  grid.style.setProperty('--gap', `${f.gap}px`);
  grid.style.gridTemplateColumns = `repeat(${f.cols}, ${f.cw}px)`;
  grid.style.setProperty('--fs', `${Math.max(14, Math.min(28, f.cw * 0.07))}px`);
  grid.classList.toggle('scrolling', f.scroll > 0);
  if (f.scroll > 0) {
    grid.style.setProperty('--dist', `${-f.scroll}px`);
    grid.style.setProperty('--dur', `${Math.max(12, f.scroll / 25)}s`);
  }
}

// ---------- Slide 3: scoreboard ----------

function ranked() {
  const rows = state.games.map(g => ({ ...g, votes: state.tally[g.id] || 0 }));
  rows.sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.votes !== prev) { rank = i + 1; prev = r.votes; } r.rank = rank; });
  return rows;
}

function renderBoard() {
  const board = $('board');
  const rows = ranked();
  if (!rows.length) {
    board.innerHTML = `<div class="lp-empty"><div><span class="big">🪐</span>Waiting for games to vote on…</div></div>`;
    $('boardMore').textContent = '';
    return;
  }
  board.querySelector('.lp-empty')?.remove();
  const shown = rows.slice(0, BOARD_MAX);
  const H = board.clientHeight || 600;
  const slots = Math.max(shown.length, 5);
  const gap = Math.max(8, Math.min(16, H * 0.018));
  const rowH = (H - gap * (slots - 1)) / slots;
  const rfs = Math.max(13, Math.min(30, rowH * 0.24));
  const max = Math.max(1, ...rows.map(r => r.votes));
  board.style.setProperty('--rfs', `${rfs}px`);

  const existing = new Map(Array.from(board.children).map(el => [el.dataset.id, el]));
  const keep = new Set(shown.map(r => r.id));
  existing.forEach((el, id) => { if (!keep.has(id)) el.remove(); });

  shown.forEach((r, i) => {
    let el = existing.get(r.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'lp-row';
      el.dataset.id = r.id;
      el.style.top = `${H}px`;
      el.innerHTML = `
        <div class="lp-row-bar"></div>
        <div class="lp-rank"></div>
        <img class="lp-row-thumb" alt="">
        <div class="lp-row-text">
          <div class="lp-row-name">${esc(r.game_name)}</div>
          <div class="lp-row-by">by ${esc(r.author_name)}</div>
        </div>
        <div class="lp-row-votes"><strong>0</strong><span>VOTES</span></div>`;
      board.appendChild(el);
      void el.offsetWidth;
    }
    el.style.height = `${rowH}px`;
    el.style.top = `${i * (rowH + gap)}px`;
    if (r.votes > 0) el.dataset.rank = r.rank; else delete el.dataset.rank;
    el.querySelector('.lp-rank').textContent = r.votes > 0 ? r.rank : '–';
    el.querySelector('.lp-row-bar').style.width = `${(r.votes / max) * 100}%`;
    const img = el.querySelector('img');
    if (state.images[r.id] && img.getAttribute('src') !== state.images[r.id]) img.src = state.images[r.id];
    const strong = el.querySelector('.lp-row-votes strong');
    if (strong.textContent !== String(r.votes)) {
      if ((state.prevVotes[r.id] ?? 0) < r.votes) {
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
      strong.textContent = r.votes;
    }
    state.prevVotes[r.id] = r.votes;
  });
  $('boardMore').textContent = rows.length > BOARD_MAX ? `+ ${rows.length - BOARD_MAX} more games in orbit` : '';
}

// ---------- Slide 4: Spotlight carousel ----------

function renderSpot(force) {
  const stage = $('spotStage');
  const games = state.games;
  const n = games.length;
  const { index, progress } = spotPosition(state.spot, games, state.skew);
  $('spotBar').style.width = state.spot.auto ? `${progress * 100}%` : '0%';
  const mode = $('spotMode');
  mode.className = `lp-pill ${state.spot.auto ? 'open' : 'paused'}`;
  mode.textContent = state.spot.auto ? 'Auto-swipe' : 'Paused';

  if (!n) {
    if (!stage.querySelector('.lp-empty')) {
      stage.innerHTML = `<div class="lp-empty"><div><span class="big">🔭</span>No games to spotlight yet.</div></div>`;
      $('spotName').textContent = ''; $('spotBy').textContent = ''; $('spotPos').textContent = '0 / 0';
      state.spotKey = '';
    }
    return;
  }
  const key = `${index}|${games.map(g => g.id).join(',')}|${Object.keys(state.images).length}`;
  if (!force && key === state.spotKey) return;
  state.spotKey = key;
  stage.querySelector('.lp-empty')?.remove();

  const W = stage.clientWidth, H = stage.clientHeight;
  const pw = Math.max(200, Math.min(W * 0.6, H * 0.94 * 16 / 9));
  stage.style.setProperty('--pw', `${pw}px`);

  const existing = new Map(Array.from(stage.children).map(el => [el.dataset.id, el]));
  const ids = new Set(games.map(g => g.id));
  existing.forEach((el, id) => { if (!ids.has(id)) el.remove(); });

  games.forEach((g, i) => {
    let el = existing.get(g.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'lp-spot-card';
      el.dataset.id = g.id;
      el.innerHTML = '<img alt="">';
      el.style.setProperty('--o', 0);
      stage.appendChild(el);
    }
    const img = el.querySelector('img');
    if (state.images[g.id] && img.getAttribute('src') !== state.images[g.id]) img.src = state.images[g.id];

    // Shortest circular distance from the current poster.
    let d = i - index;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    const a = Math.abs(d);
    const prev = state.spotPrev[g.id];
    el.classList.toggle('jump', prev !== undefined && Math.abs(prev - d) > 2);
    state.spotPrev[g.id] = d;
    el.classList.toggle('current', d === 0);
    el.style.setProperty('--x', `${d * pw * 0.74}px`);
    el.style.setProperty('--s', a === 0 ? 1 : a === 1 ? 0.7 : 0.5);
    el.style.setProperty('--r', `${-d * 24}deg`);
    el.style.setProperty('--o', a === 0 ? 1 : a === 1 ? 0.5 : a === 2 ? 0.16 : 0);
    el.style.setProperty('--z', 10 - Math.min(a, 9));
  });

  const g = games[index];
  if ($('spotName').dataset.id !== g.id) {
    $('spotName').dataset.id = g.id;
    for (const id of ['spotName', 'spotBy']) {   // replay the caption animation
      const el = $(id); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    }
    $('spotName').textContent = g.game_name;
    $('spotBy').textContent = `by ${g.author_name}`;
    drawQr($('spotQr'), g.link);
  }
  $('spotPos').textContent = `${index + 1} / ${n}`;
}

// ---------- New-game toast ----------

const toastQueue = [];
let toastBusy = false;
function queueToast(g) { toastQueue.push(g); if (!toastBusy) nextToast(); }
function nextToast() {
  const g = toastQueue.shift();
  if (!g) { toastBusy = false; return; }
  toastBusy = true;
  const t = $('toast');
  const img = t.querySelector('img');
  img.src = state.images[g.id] || '';
  img.hidden = !state.images[g.id];
  t.querySelector('.lp-toast-t').innerHTML = `${esc(g.game_name)} <span>by ${esc(g.author_name)}</span>`;
  t.classList.add('show');
  stars.burst(5);
  // Shorter toasts when a burst of games lands at once.
  const ms = toastQueue.length > 2 ? 1800 : 4200;
  setTimeout(() => { t.classList.remove('show'); setTimeout(nextToast, 700); }, ms);
}

// ------------------------------------------------------------------

if (code) startLive(); else setupScreen();
