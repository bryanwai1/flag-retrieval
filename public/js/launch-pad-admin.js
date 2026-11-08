/*
 * Launch Pad — admin panel (mission control) for the host's laptop.
 *
 * launch-pad-admin.html             → create an event / pick a recent one
 * launch-pad-admin.html?e=<code>    → control panel for that event
 *   &k=<hostKey>                    → hand admin control to another device
 *   &demo=1                         → localStorage-only rehearsal
 *
 * Changing the slide here moves the projector (launch-pad.html?e=<code>):
 * instantly when both are open in this browser, otherwise within ~2s via
 * the li_events.slide column.
 */
import { makeStore, randomId, drawQr, startStarfield, esc, slideChannel, hostKeyName, spotPosition } from './li-store.js?v=20261108c';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const qs = new URLSearchParams(location.search);
const demo = qs.get('demo') === '1';
const code = (qs.get('e') || '').trim().toLowerCase();
const POLL_MS = 3000;

startStarfield($('stars'), { density: 0.6 });

const state = {
  store: null, event: null, hostKey: null,
  slide: 1, votingOpen: false, slideSynced: true,
  games: [], thumbs: {}, tally: {}, voters: 0,
  spot: { auto: true, index: 0, seconds: 6, at: new Date().toISOString() },
  spotSupported: true, skew: 0, guardUntil: 0
};
const channel = code ? slideChannel(code, demo) : null;

const pageUrl = (file, extra = '') => {
  const base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  return `${base}${file}?e=${encodeURIComponent(code)}${demo ? '&demo=1' : ''}${extra}`;
};

function show(id) { ['screenSetup', 'screenError', 'screenLive'].forEach(s => { $(s).hidden = s !== id; }); }
function fail(t, d) { $('errTitle').textContent = t; $('errDetail').textContent = d || ''; show('screenError'); }
function snack(msg, bad = false) {
  const s = $('snack');
  s.textContent = msg;
  s.className = `lp-snack show${bad ? ' bad' : ''}`;
  clearTimeout(snack.t);
  snack.t = setTimeout(() => s.classList.remove('show'), 2600);
}
function warn(msg) { $('warn').hidden = !msg; $('warn').textContent = msg || ''; }

// ------------------------------------------------------------------
// Recent events (this browser)
// ------------------------------------------------------------------
const RECENT = 'li_recent_events';
function recent() { try { return JSON.parse(localStorage.getItem(RECENT)) || []; } catch { return []; } }
function remember(c, title) {
  const list = recent().filter(r => !(r.code === c && !!r.demo === demo));
  list.unshift({ code: c, title, demo, ts: Date.now() });
  try { localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8))); } catch {}
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------
function setupScreen() {
  show('screenSetup');
  const list = recent().filter(r => !!r.demo === demo && localStorage.getItem(hostKeyName(r.code, demo)));
  if (list.length) {
    $('recentWrap').hidden = false;
    $('recentList').innerHTML = list.map(r => `
      <a class="lp-recent-item" href="launch-pad-admin.html?e=${encodeURIComponent(r.code)}${demo ? '&demo=1' : ''}">
        <b>${esc(r.title)}</b><span>${esc(r.code)} · ${new Date(r.ts).toLocaleDateString()}</span>
      </a>`).join('');
  }
  $('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('createErr').textContent = '';
    $('createBtn').disabled = true;
    try {
      const newCode = randomId(5);
      const key = randomId(24);
      const title = $('createTitle').value.trim();
      const store = await makeStore(newCode, demo);
      await store.createEvent(key, title);
      localStorage.setItem(hostKeyName(newCode, demo), key);
      remember(newCode, title || 'AI Game Jam');
      location.href = `launch-pad-admin.html?e=${newCode}${demo ? '&demo=1' : ''}`;
    } catch (err) {
      $('createErr').textContent = err.message;
      $('createBtn').disabled = false;
    }
  });
}

// ------------------------------------------------------------------
// Live control panel
// ------------------------------------------------------------------
async function startLive() {
  try {
    state.store = await makeStore(code, demo);
    state.event = await state.store.getEvent();
  } catch (err) { fail('Can’t reach the launch pad', err.message); return; }
  if (!state.event) { fail('Event not found', `No event with code “${code}”.`); return; }

  const urlKey = qs.get('k');
  if (urlKey) {
    localStorage.setItem(hostKeyName(code, demo), urlKey);
    qs.delete('k');
    history.replaceState(null, '', `${location.pathname}?${qs}`);
  }
  state.hostKey = localStorage.getItem(hostKeyName(code, demo));
  let ok = false;
  if (state.hostKey) { try { ok = !!(await state.store.checkHost(state.hostKey)); } catch {} }
  if (!ok) {
    fail('Not your event', 'This browser doesn’t have the admin key for this event. Open the “Copy admin link” URL from the laptop that created it.');
    return;
  }
  remember(code, state.event.title);

  $('eventTitle').textContent = state.event.title;
  $('eventCode').textContent = code;
  document.title = `${state.event.title} — Mission Control`;
  state.slide = state.event.slide || 1;
  state.votingOpen = !!state.event.voting_open;

  const submit = pageUrl('launch-pad-play.html');
  const vote = pageUrl('launch-pad-play.html', '&v=1');
  $('submitUrl').textContent = submit;
  $('voteUrl').textContent = vote;
  $$('.qr-submit').forEach(c => drawQr(c, submit));
  $$('.qr-vote').forEach(c => drawQr(c, vote));

  show('screenLive');
  wire();
  renderSlide();
  renderVoting();
  await poll();
  setInterval(poll, POLL_MS);
  setInterval(renderSpot, 250);
}

function wire() {
  $$('.lp-slide-btn').forEach(b => b.addEventListener('click', () => setSlide(+b.dataset.slide)));
  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setSlide(state.slide + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setSlide(state.slide - 1); }
    else if (['1', '2', '3', '4'].includes(e.key)) setSlide(+e.key);
    else if (e.key === ' ') { e.preventDefault(); spotToggle(); }
  });
  $('spotPrev').addEventListener('click', () => spotStep(-1));
  $('spotNext').addEventListener('click', () => spotStep(1));
  $('spotToggle').addEventListener('click', spotToggle);
  $('spotSpeed').addEventListener('change', () => {
    sendSpot({ auto: state.spot.auto, index: spotNow().index, seconds: +$('spotSpeed').value });
  });
  $('openProjector').addEventListener('click', () => {
    window.open(pageUrl('launch-pad.html'), 'launchpad_projector');
  });
  $('copyHost').addEventListener('click', async () => {
    const link = `${location.href.split(/[?#]/)[0]}?e=${code}${demo ? '&demo=1' : ''}&k=${state.hostKey}`;
    try { await navigator.clipboard.writeText(link); snack('Admin link copied — keep it private'); }
    catch { prompt('Admin link (keep it private):', link); }
  });
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($(b.dataset.copy).textContent); snack('Link copied'); }
    catch { prompt('Copy this link:', $(b.dataset.copy).textContent); }
  }));
  $('voteToggle').addEventListener('click', () => setVoting(!state.votingOpen));
  $('resetVotes').addEventListener('click', async () => {
    if (!confirm('Clear every vote for this event? This can’t be undone.')) return;
    try { await state.store.resetVotes(state.hostKey); snack('Votes cleared'); poll(); } catch (e) { snack(e.message, true); }
  });
}

async function setSlide(n) {
  n = Math.max(1, Math.min(4, n));
  state.slide = n;
  state.guardUntil = Date.now() + 3000;
  renderSlide();
  channel.postMessage({ slide: n });
  if (n === 4 && !state.spotSupported) {
    warn('Spotlight needs one more SQL step — run supabase/link-inserter-spotlight.sql in Supabase. Until then, the Spotlight slide only works when the projector is open in this same browser.');
    return;
  }
  try {
    await state.store.setSlide(state.hostKey, n);
    state.slideSynced = true;
    warn('');
  } catch (e) {
    state.slideSynced = false;
    warn(`${e.message} Until then, slides only follow when the projector is open in this same browser.`);
  }
  const flag = `li_autovote_${demo ? 'demo_' : ''}${code}`;
  if (n === 3 && !state.votingOpen && !localStorage.getItem(flag)) {
    localStorage.setItem(flag, '1');
    setVoting(true);
  }
}

async function setVoting(open) {
  try {
    await state.store.setVoting(state.hostKey, open);
    state.votingOpen = open;
    renderVoting();
    snack(open ? 'Voting is open' : 'Voting closed');
  } catch (e) { snack(e.message, true); }
}

function renderSlide() {
  $$('.lp-slide-btn').forEach(b => b.classList.toggle('on', +b.dataset.slide === state.slide));
}
function renderVoting() {
  $('votePill').className = `lp-pill ${state.votingOpen ? 'open' : 'closed'}`;
  $('votePill').textContent = state.votingOpen ? 'Open' : 'Closed';
  $('voteToggle').textContent = state.votingOpen ? 'Close voting' : 'Open voting';
}

// ------------------------------------------------------------------
// Polling + game list
// ------------------------------------------------------------------
async function poll() {
  try {
    const [games, t] = await Promise.all([state.store.listGames(), state.store.tally()]);
    const need = games.filter(g => !(g.id in state.thumbs)).map(g => g.id);
    if (need.length) {
      const th = await state.store.getImages(need, 'thumb');
      const missing = need.filter(id => !th[id]);
      if (missing.length) Object.assign(th, await state.store.getImages(missing, 'image'));
      Object.assign(state.thumbs, th);
    }
    state.games = games;
    state.tally = t.tally || {};
    state.voters = t.voters || 0;
    state.votingOpen = !!t.voting_open;
    if (t.now) state.skew = Date.parse(t.now) - Date.now();
    state.spotSupported = !!(t.spot && t.spot.at);
    if (Date.now() > state.guardUntil) {
      if (state.spotSupported) { state.spot = t.spot; $('spotSpeed').value = String(t.spot.seconds); }
      if (t.slide) { state.slide = t.slide; renderSlide(); }
    }
    if (t.slide == null && state.slideSynced) {
      warn('Slide control needs one more SQL step — run supabase/link-inserter-slides.sql in Supabase. Until then, slides only follow when the projector is open in this same browser.');
    }
    renderVoting();
    renderList();
    $('lastSync').textContent = `synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (err) {
    $('lastSync').textContent = `⚠ ${err.message}`;
  }
}

function renderList() {
  const total = Object.values(state.tally).reduce((a, b) => a + b, 0);
  $('sGames').textContent = state.games.length;
  $('sMakers').textContent = new Set(state.games.map(g => g.author_name.trim().toLowerCase())).size;
  $('sVotes').textContent = total;
  $('sVoters').textContent = state.voters;

  const rows = state.games.map(g => ({ ...g, votes: state.tally[g.id] || 0 }));
  rows.sort((a, b) => b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.votes !== prev) { rank = i + 1; prev = r.votes; } r.rank = rank; });

  const sig = JSON.stringify(rows.map(r => [r.id, r.votes, !!state.thumbs[r.id]]));
  if (sig === renderList.sig) return;
  renderList.sig = sig;

  const list = $('gameList');
  if (!rows.length) {
    list.innerHTML = '<p class="lp-hint" style="text-align:center;padding:30px 0">No games yet — they appear here as players submit.</p>';
    return;
  }
  list.innerHTML = '';
  rows.forEach(r => {
    const el = document.createElement('div');
    el.className = 'lp-admin-item';
    if (r.votes > 0) el.dataset.rank = r.rank;
    el.innerHTML = `
      <span class="lp-rank">${r.votes > 0 ? r.rank : '–'}</span>
      <img alt="" src="${esc(state.thumbs[r.id] || '')}">
      <div class="lp-admin-item-text"><b>${esc(r.game_name)}</b><span>by ${esc(r.author_name)}</span></div>
      <span class="lp-admin-votes"><strong>${r.votes}</strong> votes</span>
      <button class="lp-mini spot" title="Show this game in the Spotlight carousel">Spotlight</button>
      <a class="lp-mini" href="${esc(r.link)}" target="_blank" rel="noopener">Play ↗</a>
      <button class="lp-mini danger" title="Remove this game">Remove</button>`;
    el.querySelector('.spot').addEventListener('click', () => {
      const i = state.games.findIndex(g => g.id === r.id);
      sendSpot({ auto: state.spot.auto, index: i, seconds: state.spot.seconds });
      if (state.slide !== 4) setSlide(4);
      snack(`Spotlight: ${r.game_name}`);
    });
    el.querySelector('.danger').addEventListener('click', async () => {
      if (!confirm(`Remove “${r.game_name}” by ${r.author_name}? Its votes go too.`)) return;
      try { await state.store.deleteGame(r.id, state.hostKey); snack('Game removed'); renderList.sig = null; poll(); }
      catch (e) { snack(e.message, true); }
    });
    list.appendChild(el);
  });
}

// ------------------------------------------------------------------
// Spotlight carousel
// ------------------------------------------------------------------

function spotNow() { return spotPosition(state.spot, state.games.length, state.skew); }

async function sendSpot({ auto, index, seconds }) {
  const n = state.games.length || 1;
  index = ((index % n) + n) % n;
  // Stamp `at` in server time so every screen computes the same poster.
  state.spot = { auto, index, seconds, at: new Date(Date.now() + state.skew).toISOString() };
  state.guardUntil = Date.now() + 3000;
  channel.postMessage({ spot: state.spot });
  renderSpot();
  if (!state.spotSupported) {
    warn('Spotlight needs one more SQL step — run supabase/link-inserter-spotlight.sql in Supabase. Until then, the Spotlight slide only works when the projector is open in this same browser.');
    return;
  }
  try { await state.store.setSpotlight(state.hostKey, { auto, index, seconds }); }
  catch (e) { warn(e.message); }
}

function spotStep(delta) {
  sendSpot({ auto: state.spot.auto, index: spotNow().index + delta, seconds: state.spot.seconds });
}

function spotToggle() {
  const { index } = spotNow();
  sendSpot({ auto: !state.spot.auto, index, seconds: state.spot.seconds });
  snack(state.spot.auto ? 'Auto-swipe on' : 'Auto-swipe stopped');
}

function renderSpot() {
  const n = state.games.length;
  const { index, progress } = spotNow();
  $('spotPill').className = `lp-pill ${state.spot.auto ? 'open' : 'paused'}`;
  $('spotPill').textContent = state.spot.auto ? 'Auto-swipe' : 'Stopped';
  $('spotToggle').textContent = state.spot.auto ? '⏸ Stop auto-swipe' : '▶ Start auto-swipe';
  $('spotBar').style.width = state.spot.auto ? `${progress * 100}%` : '0%';
  if (!n) { $('spotName').textContent = 'No games yet'; $('spotMeta').textContent = ''; $('spotThumb').removeAttribute('src'); return; }
  const g = state.games[index];
  $('spotName').textContent = g.game_name;
  $('spotMeta').textContent = `by ${g.author_name} · ${index + 1} of ${n}`;
  const src = state.thumbs[g.id] || '';
  if ($('spotThumb').getAttribute('src') !== src) $('spotThumb').src = src;
}

if (code) startLive(); else setupScreen();
