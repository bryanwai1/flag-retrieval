/*
 * Launch Pad — participant phone page.
 *
 * launch-pad-play.html?e=<code>        → submit tab
 * launch-pad-play.html?e=<code>&v=1    → vote tab (2 votes per phone)
 */
import { makeStore, randomId, startStarfield, esc, MAX_VOTES } from './li-store.js?v=20261108b';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const demo = qs.get('demo') === '1';
const code = (qs.get('e') || '').trim().toLowerCase();
const ns = `${demo ? 'demo_' : ''}${code}`;

startStarfield($('stars'), { density: 0.7 });

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const voterId = ls.get('li_voter') || (() => { const id = randomId(24); ls.set('li_voter', id); return id; })();
const state = {
  store: null,
  tab: qs.get('v') === '1' ? 'vote' : 'submit',
  image: null,
  thumb: null,
  games: [],
  thumbs: {},
  mine: new Set(ls.get(`li_mine_${ns}`, [])),
  myVotes: new Set(),
  votingOpen: false,
  busy: false
};

function snack(msg, bad = false) {
  const s = $('snack');
  s.textContent = msg;
  s.className = `lp-snack show${bad ? ' bad' : ''}`;
  clearTimeout(snack.t);
  snack.t = setTimeout(() => s.classList.remove('show'), 2600);
}

function fail(title, detail) {
  $('screenApp').hidden = true;
  $('screenError').hidden = false;
  $('errTitle').textContent = title;
  $('errDetail').textContent = detail || '';
}

// ------------------------------------------------------------------
// Tabs
// ------------------------------------------------------------------

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.lp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('tabSubmit').hidden = tab !== 'submit';
  $('tabVote').hidden = tab !== 'vote';
  $('headTitle').textContent = tab === 'vote' ? 'Cosmic Vote' : 'Submit your game';
  $('headSub').textContent = tab === 'vote'
    ? `Pick your ${MAX_VOTES} favourite games`
    : 'Send your AI Studio game to the big screen';
  const u = new URL(location.href);
  if (tab === 'vote') u.searchParams.set('v', '1'); else u.searchParams.delete('v');
  history.replaceState(null, '', u);
  if (tab === 'vote') refreshVote();
}

// ------------------------------------------------------------------
// Submit
// ------------------------------------------------------------------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Couldn’t read that image — try a JPG or PNG screenshot.')); };
    img.src = url;
  });
}

/** Centre-crop to 16:9 and encode as JPEG. */
function crop169(img, w, quality) {
  const h = Math.round(w * 9 / 16);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sw = img.naturalWidth, sh = img.naturalHeight;
  let cw = sw, ch = sw * 9 / 16;
  if (ch > sh) { ch = sh; cw = sh * 16 / 9; }
  ctx.fillStyle = '#0b0d2a';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

$('fImage').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  $('submitErr').textContent = '';
  try {
    const img = await loadImage(file);
    let full = crop169(img, 1280, 0.82);
    if (full.length > 850000) full = crop169(img, 960, 0.7);
    state.image = full;
    state.thumb = crop169(img, 480, 0.72);
    $('preview').src = full;
    $('preview').hidden = false;
    $('drop').classList.add('has-img');
  } catch (err) {
    $('submitErr').textContent = err.message;
  }
});

function normaliseLink(v) {
  v = v.trim();
  if (v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null; }
  catch { return null; }
}

$('submitForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.busy) return;
  const err = $('submitErr');
  err.textContent = '';
  const author = $('fName').value.trim();
  const game = $('fGame').value.trim();
  const link = normaliseLink($('fLink').value);
  if (!author) { err.textContent = 'Add your name.'; $('fName').focus(); return; }
  if (!game) { err.textContent = 'Give your game a name.'; $('fGame').focus(); return; }
  if (!link) { err.textContent = 'That link doesn’t look right — paste the full https:// link.'; $('fLink').focus(); return; }
  if (!state.image) { err.textContent = 'Upload a 16:9 screenshot of your game.'; return; }

  state.busy = true;
  $('submitBtn').disabled = true;
  $('submitBtn').textContent = 'Launching…';
  try {
    const id = await state.store.addGame({ author_name: author, game_name: game, link, image: state.image, thumb: state.thumb });
    state.mine.add(id);
    ls.set(`li_mine_${ns}`, [...state.mine]);
    ls.set('li_name', author);
    $('doneImg').src = state.image;
    $('doneName').textContent = game;
    $('doneBy').textContent = `by ${author}`;
    $('submitForm').hidden = true;
    $('submitDone').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    state.busy = false;
    $('submitBtn').disabled = false;
    $('submitBtn').textContent = '🚀 Launch my game';
  }
});

$('againBtn').addEventListener('click', () => {
  $('fGame').value = '';
  $('fLink').value = '';
  $('fImage').value = '';
  state.image = state.thumb = null;
  $('preview').hidden = true;
  $('drop').classList.remove('has-img');
  $('submitDone').hidden = true;
  $('submitForm').hidden = false;
});

// ------------------------------------------------------------------
// Vote
// ------------------------------------------------------------------

async function refreshVote() {
  try {
    const [games, t, mine] = await Promise.all([
      state.store.listGames(), state.store.tally(), state.store.myVotes(voterId)
    ]);
    state.votingOpen = !!t.voting_open;
    state.myVotes = new Set(mine || []);
    const need = games.filter(g => !(g.id in state.thumbs)).map(g => g.id);
    if (need.length) {
      const th = await state.store.getImages(need, 'thumb');
      // Older rows without a thumb fall back to the full image.
      const missing = need.filter(id => !th[id]);
      if (missing.length) Object.assign(th, await state.store.getImages(missing, 'image'));
      Object.assign(state.thumbs, th);
    }
    state.games = games;
    renderVote();
  } catch (err) {
    snack(err.message, true);
  }
}

function renderVote() {
  $('voteLocked').hidden = state.votingOpen;
  $('voteOpen').hidden = !state.votingOpen;
  if (!state.votingOpen) return;

  const left = Math.max(0, MAX_VOTES - state.myVotes.size);
  $('votesLeftText').textContent = left === 0 ? 'All votes used 🎉' : `${left} vote${left === 1 ? '' : 's'} left`;
  document.querySelectorAll('.lp-votes-left .dot').forEach((d, i) => d.classList.toggle('full', i < state.myVotes.size));

  const list = $('voteList');
  const sig = JSON.stringify([state.games.map(g => g.id), [...state.myVotes]]);
  if (sig === renderVote.sig) return;
  renderVote.sig = sig;
  if (!state.games.length) {
    list.innerHTML = '<div class="lp-panel lp-locked"><span class="big">🪐</span><h2>No games yet</h2></div>';
    return;
  }
  list.innerHTML = '';
  state.games.forEach(g => {
    const mine = state.mine.has(g.id);
    const voted = state.myVotes.has(g.id);
    const el = document.createElement('div');
    el.className = `lp-vcard${voted ? ' voted' : ''}${mine ? ' mine' : ''}`;
    el.setAttribute('role', 'button');
    el.innerHTML = `
      ${mine ? '<span class="lp-vcard-tag">⭐ Your game</span>' : ''}
      <a class="lp-vcard-open" href="${esc(g.link)}" target="_blank" rel="noopener">Play ↗</a>
      <img alt="" src="${esc(state.thumbs[g.id] || '')}">
      <div class="lp-vcard-cap">
        <div>
          <div class="lp-vcard-name">${esc(g.game_name)}</div>
          <div class="lp-vcard-by">by ${esc(g.author_name)}</div>
        </div>
        <span class="lp-vcard-heart">${voted ? '💗' : '🤍'}</span>
      </div>`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (mine) { snack('You can’t vote for your own game 😉'); return; }
      toggleVote(g);
    });
    list.appendChild(el);
  });
}

async function toggleVote(g) {
  if (state.busy) return;
  const voted = state.myVotes.has(g.id);
  if (!voted && state.myVotes.size >= MAX_VOTES) {
    snack(`You’ve used both votes — tap one of your picks to undo it.`);
    return;
  }
  state.busy = true;
  try {
    if (voted) {
      await state.store.unvote(g.id, voterId);
      state.myVotes.delete(g.id);
      snack(`Vote removed from ${g.game_name}`);
    } else {
      await state.store.castVote(g.id, voterId);
      state.myVotes.add(g.id);
      snack(`💗 Voted for ${g.game_name}`);
    }
    renderVote();
  } catch (err) {
    snack(err.message, true);
    refreshVote();
  } finally {
    state.busy = false;
  }
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------

async function boot() {
  if (!code) { fail('Missing event code', 'Scan the QR code on the big screen to join.'); return; }
  try {
    state.store = await makeStore(code, demo);
    const ev = await state.store.getEvent();
    if (!ev) { fail('Event not found', 'Scan the QR code on the big screen again.'); return; }
    $('eventTitle').textContent = ev.title;
    document.title = `${ev.title} — Launch Pad`;
  } catch (err) {
    fail('Lost signal', err.message);
    return;
  }
  $('fName').value = ls.get('li_name', '') || '';
  $('screenApp').hidden = false;
  document.querySelectorAll('.lp-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  setTab(state.tab);
  setInterval(() => { if (state.tab === 'vote' && !state.busy) refreshVote(); }, 4000);
}

boot();
