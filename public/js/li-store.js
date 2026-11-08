/*
 * Launch Pad — data layer shared by the projector and the phone page.
 *
 * Live mode talks to Supabase (supabase/link-inserter-schema.sql).
 * Demo mode (?demo=1) keeps everything in this browser's localStorage
 * so the whole flow can be rehearsed in a few tabs without a database.
 */

export const MAX_VOTES = 2;

export async function makeStore(code, demo) {
  return demo ? demoStore(code) : liveStore(code);
}

export function randomId(len = 24) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(buf, b => a[b % a.length]).join('');
}

function errMsg(e) {
  const m = (e && (e.message || e.details)) || String(e);
  if (/function .*li_|relation .*li_|schema cache/i.test(m)) {
    return 'Launch Pad tables are missing — run supabase/link-inserter-schema.sql in Supabase.';
  }
  return m;
}

// ------------------------------------------------------------------
// Live (Supabase)
// ------------------------------------------------------------------

async function liveStore(code) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(errMsg(error));
    return data;
  };
  const q = async (p) => {
    const { data, error } = await p;
    if (error) throw new Error(errMsg(error));
    return data;
  };

  return {
    mode: 'live',
    getEvent: () => rpc('li_get_event', { p_code: code }),
    createEvent: (key, title) => rpc('li_create_event', { p_code: code, p_host_key: key, p_title: title }),
    checkHost: (key) => rpc('li_check_host', { p_code: code, p_host_key: key }),
    setVoting: (key, open) => rpc('li_set_voting', { p_code: code, p_host_key: key, p_open: open }),
    listGames: () => q(sb.from('li_games')
      .select('id, author_name, game_name, link, created_at')
      .eq('event_code', code).order('created_at', { ascending: true })),
    async getImages(ids, field = 'image') {
      if (!ids.length) return {};
      const rows = await q(sb.from('li_games').select(`id, ${field}`).in('id', ids));
      const out = {};
      rows.forEach(r => { out[r.id] = r[field]; });
      return out;
    },
    async addGame(g) {
      const row = await q(sb.from('li_games').insert({ event_code: code, ...g }).select('id').single());
      return row.id;
    },
    deleteGame: (id, key) => rpc('li_delete_game', { p_game_id: id, p_host_key: key }),
    tally: () => rpc('li_tally', { p_code: code }),
    myVotes: (voterId) => rpc('li_my_votes', { p_code: code, p_voter_id: voterId }),
    castVote: (gameId, voterId) => rpc('li_cast_vote', { p_game_id: gameId, p_voter_id: voterId }),
    unvote: (gameId, voterId) => rpc('li_unvote', { p_game_id: gameId, p_voter_id: voterId }),
    resetVotes: (key) => rpc('li_reset_votes', { p_code: code, p_host_key: key })
  };
}

// ------------------------------------------------------------------
// Demo (localStorage, same browser only)
// ------------------------------------------------------------------

function demoStore(code) {
  const KEY = `li_demo_${code}`;
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  };
  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const need = () => {
    const db = load();
    if (!db) throw new Error('Event not found');
    return db;
  };
  const host = (db, key) => { if (db.event.host_key !== key) throw new Error('Not the host of this event'); };
  const ok = (v) => Promise.resolve(v);
  const wrap = (fn) => (...a) => { try { return ok(fn(...a)); } catch (e) { return Promise.reject(e); } };

  return {
    mode: 'demo',
    getEvent: wrap(() => {
      const db = load();
      return db ? { code, title: db.event.title, voting_open: db.event.voting_open } : null;
    }),
    createEvent: wrap((key, title) => {
      const db = load();
      if (db) { host(db, key); return true; }
      save({ event: { host_key: key, title: title || 'AI Game Jam', voting_open: false }, games: [], votes: [] });
      return true;
    }),
    checkHost: wrap((key) => { const db = load(); return !!db && db.event.host_key === key; }),
    setVoting: wrap((key, open) => { const db = need(); host(db, key); db.event.voting_open = open; save(db); }),
    listGames: wrap(() => need().games.map(({ image, thumb, ...g }) => g)),
    getImages: wrap((ids, field = 'image') => {
      const out = {};
      need().games.forEach(g => { if (ids.includes(g.id)) out[g.id] = g[field]; });
      return out;
    }),
    addGame: wrap((g) => {
      const db = need();
      const id = crypto.randomUUID();
      db.games.push({ id, ...g, created_at: new Date().toISOString() });
      try { save(db); } catch { throw new Error('Demo storage is full — clear old demo events.'); }
      return id;
    }),
    deleteGame: wrap((id, key) => {
      const db = need(); host(db, key);
      db.games = db.games.filter(g => g.id !== id);
      db.votes = db.votes.filter(v => v.game_id !== id);
      save(db);
    }),
    tally: wrap(() => {
      const db = need();
      const tally = {};
      db.votes.forEach(v => { tally[v.game_id] = (tally[v.game_id] || 0) + 1; });
      return { voting_open: db.event.voting_open, voters: new Set(db.votes.map(v => v.voter_id)).size, tally };
    }),
    myVotes: wrap((voterId) => need().votes.filter(v => v.voter_id === voterId).map(v => v.game_id)),
    castVote: wrap((gameId, voterId) => {
      const db = need();
      if (!db.event.voting_open) throw new Error('Voting is closed');
      if (!db.games.some(g => g.id === gameId)) throw new Error('Game not found');
      const mine = db.votes.filter(v => v.voter_id === voterId);
      if (mine.some(v => v.game_id === gameId)) throw new Error('You already voted for this game');
      if (mine.length >= MAX_VOTES) throw new Error('You have used both votes');
      db.votes.push({ game_id: gameId, voter_id: voterId });
      save(db);
      return MAX_VOTES - mine.length - 1;
    }),
    unvote: wrap((gameId, voterId) => {
      const db = need();
      if (!db.event.voting_open) throw new Error('Voting is closed');
      db.votes = db.votes.filter(v => !(v.game_id === gameId && v.voter_id === voterId));
      save(db);
    }),
    resetVotes: wrap((key) => { const db = need(); host(db, key); db.votes = []; save(db); })
  };
}

// ------------------------------------------------------------------
// Shared bits
// ------------------------------------------------------------------

/** Draw a QR code for `text` onto `canvas` (needs qrcode-generator loaded). */
export function drawQr(canvas, text, { dark = '#05060f', light = '#ffffff' } = {}) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = 10, margin = 2;
  const size = (n + margin * 2) * cell;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
}

/** Animated starfield behind the page. Returns { burst() } for shooting-star bursts. */
export function startStarfield(canvas, { density = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, dpr, stars = [], shooters = [];
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 5200 * density);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      t: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 190 : 280) : 0
    }));
  };
  const shoot = () => {
    const fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
      y: Math.random() * h * 0.4,
      vx: (fromLeft ? 1 : -1) * (9 + Math.random() * 6), vy: 4 + Math.random() * 3, life: 1
    });
  };
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 16.7, 3); last = now;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduce) { s.x -= s.z * 0.25 * dt; s.t += 0.03 * dt; if (s.x < 0) s.x += w; }
      const a = 0.35 + 0.65 * s.z * (0.6 + 0.4 * Math.sin(s.t));
      const r = s.z * 1.6;
      ctx.fillStyle = s.hue ? `hsla(${s.hue},90%,75%,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduce && Math.random() < 0.004 * dt) shoot();
    shooters = shooters.filter(s => s.life > 0);
    for (const s of shooters) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= 0.012 * dt;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
      g.addColorStop(0, `rgba(255,255,255,${s.life})`);
      g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12); ctx.stroke();
    }
    requestAnimationFrame(frame);
  };
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
  return { burst(n = 6) { for (let i = 0; i < n; i++) setTimeout(shoot, i * 120); } };
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
