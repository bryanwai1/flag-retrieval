/**
 * AITB — projector slides shown from the /aitb nav.
 *
 *   · <AitbTitleSlide>     the animated opening hero (game title)
 *   · <AitbQrSlide>        full-screen QR — player join, or observer / cheer
 *   · <AitbHowItWorksSlide> how the game works, in short animated pointers
 *
 * All styling is self-contained in SLIDE_CSS so these can't disturb the rest of
 * the app, and everything is sized for the back of a function room.
 */
import { QRCodeSVG } from 'qrcode.react'
import { AITB_POINTS } from '../lib/aitbActivities'

const TITLE = 'AI TEAM BUILDING'

/* ── Opening title slide ───────────────────────────────────────────────────── */
export function AitbTitleSlide() {
  // Deterministic-ish decorative layers: stars, drifting orbs, orbiting emoji.
  const stars = Array.from({ length: 90 }, (_, i) => ({
    left: (i * 37.6) % 100,
    top: (i * 61.3) % 100,
    size: 1 + ((i * 13) % 5) * 0.55,
    delay: ((i * 7) % 40) / 10,
    dur: 2.4 + ((i * 11) % 30) / 10,
  }))
  const orbit = ['🤖', '🎨', '🎬', '🎵', '🚀', '🧠', '✨', '🎮']

  return (
    <div className="aitb-slide aitb-title">
      <style>{SLIDE_CSS}</style>
      <div className="aitb-nebula" />
      <div className="aitb-grid" />
      {stars.map((s, i) => (
        <span key={i} className="aitb-star"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
      ))}

      {/* a rocket streaking across behind the title */}
      <div className="aitb-flyby">🚀</div>

      <div className="aitb-title-inner">
        <div className="aitb-eyebrow">
          <span className="aitb-eyebrow-dot" /> LIVE TEAM CHALLENGE
        </div>

        {/* Letters animate individually, but each WORD is one nowrap unit so a
            narrow projector can only ever break between words — never mid-word
            (which produced "AI TEAM BUILDIN" + an orphan "G" below ~1645px). */}
        <h1 className="aitb-bigtitle" aria-label={TITLE}>
          {(() => { let n = 0; return TITLE.split(' ').map(word => (
            <span key={word} className="aitb-word">
              {word.split('').map((ch, j) => (
                <span key={j} className="aitb-letter" style={{ animationDelay: `${0.24 + n++ * 0.055}s` }}>{ch}</span>
              ))}
            </span>
          )) })()}
          <span className="aitb-shine" />
        </h1>

        <div className="aitb-sub">
          <span>10 missions</span><i>·</i><span>2 at a time</span><i>·</i><span>fastest team wins</span>
        </div>

        {/* orbiting tool emoji */}
        <div className="aitb-orbit-wrap">
          <div className="aitb-orbit-ring" />
          {orbit.map((e, i) => (
            <span key={e} className="aitb-orbit-item"
              style={{ ['--a' as string]: `${(360 / orbit.length) * i}deg`, animationDelay: `${i * 0.12}s` }}>
              <span className="aitb-orbit-emoji">{e}</span>
            </span>
          ))}
          <div className="aitb-core">🏆</div>
        </div>

        <div className="aitb-tag">scan 📱 · build 🤖 · score 🏆</div>
      </div>
    </div>
  )
}

/* ── Full-screen QR slide (player join / observer cheer) ───────────────────── */
export function AitbQrSlide({ kind, url }: { kind: 'player' | 'observer'; url: string }) {
  const player = kind === 'player'
  const accent = player ? '#fbbf24' : '#c084fc'
  const steps = player
    ? ['Scan the QR', 'Pick your team — once', 'Draw & start missions']
    : ['Scan the QR', 'Pick a team to cheer', 'Fire emoji — they pop up here!']

  return (
    <div className="aitb-slide aitb-qr" style={{ ['--accent' as string]: accent }}>
      <style>{SLIDE_CSS}</style>
      <div className="aitb-nebula" />
      <div className="aitb-grid" />

      <div className="aitb-qr-inner">
        <div className="aitb-qr-left">
          <div className="aitb-eyebrow"><span className="aitb-eyebrow-dot" /> {player ? 'PLAYERS' : 'EVERYONE ELSE'}</div>
          <h1 className="aitb-qr-title">
            {player ? <>Scan to<br />join the race</> : <>Watch &amp;<br />cheer live</>}
          </h1>
          <p className="aitb-qr-lead">
            {player
              ? 'One scan gets your team on the board. Pick your team once — this phone remembers it.'
              : 'Not playing? Follow every rocket live and fire emoji that pop on this screen.'}
          </p>
          <ol className="aitb-qr-steps">
            {steps.map((s, i) => (
              <li key={s} style={{ animationDelay: `${0.3 + i * 0.14}s` }}>
                <span className="aitb-qr-num">{i + 1}</span>{s}
              </li>
            ))}
          </ol>
        </div>

        <div className="aitb-qr-right">
          <div className="aitb-qr-card">
            <div className="aitb-qr-glow" />
            <div className="aitb-qr-box">
              <QRCodeSVG value={url} size={380} />
            </div>
            <div className="aitb-qr-url">{url}</div>
          </div>
          <div className="aitb-qr-hint">{player ? '📱 One phone per person is fine' : '🎉 Reactions show up instantly'}</div>
        </div>
      </div>
    </div>
  )
}

/* ── How the game works ────────────────────────────────────────────────────── */
const HOW_STEPS = [
  { emoji: '📱', title: 'Scan & pick your team', sub: 'Once per phone' },
  { emoji: '🎴', title: 'Draw 3 mission cards', sub: 'Choose the one you want' },
  { emoji: '🚀', title: 'Start the mission', sub: `Timer runs · +${AITB_POINTS.scan} pts` },
  { emoji: '✅', title: 'Tick each step', sub: `+${AITB_POINTS.step} pts every step` },
  { emoji: '🤖', title: 'Make it with AI', sub: 'Tools are linked on your phone' },
  { emoji: '🏁', title: 'Marshal signs off', sub: 'Completion + speed bonus' },
]

const HOW_RULES = [
  { emoji: '⚡', text: 'Finish FAST — the bonus drops at every milestone' },
  { emoji: '🎯', text: 'Only 2 missions open at once' },
  { emoji: '🔒', text: 'Card & animal draws are final · roulette gets 2 spins' },
  { emoji: '⏰', text: 'When the clock hits zero, every phone locks' },
]

export function AitbHowItWorksSlide() {
  return (
    <div className="aitb-slide aitb-how">
      <style>{SLIDE_CSS}</style>
      <div className="aitb-nebula" />
      <div className="aitb-grid" />

      <div className="aitb-how-inner">
        <div className="aitb-how-head">
          <div className="aitb-eyebrow"><span className="aitb-eyebrow-dot" /> HOW IT WORKS</div>
          <h1 className="aitb-how-title">Six steps. Ten missions. One winner.</h1>
        </div>

        <div className="aitb-how-grid">
          {HOW_STEPS.map((s, i) => (
            <div key={s.title} className="aitb-how-card" style={{ animationDelay: `${0.18 + i * 0.11}s` }}>
              <div className="aitb-how-num">{i + 1}</div>
              <div className="aitb-how-emoji">{s.emoji}</div>
              <div className="aitb-how-card-title">{s.title}</div>
              <div className="aitb-how-card-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="aitb-how-rules">
          {HOW_RULES.map((r, i) => (
            <div key={r.text} className="aitb-how-rule" style={{ animationDelay: `${0.9 + i * 0.12}s` }}>
              <span className="aitb-how-rule-emoji">{r.emoji}</span>{r.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Shared slide styling ──────────────────────────────────────────────────── */
const SLIDE_CSS = `
/* --aitb-slide-h lets the projector deck reserve room for its nav bar, so slide
   content is never laid out under it. Defaults to the full viewport. */
.aitb-slide{position:relative;min-height:var(--aitb-slide-h,100vh);width:100%;overflow:hidden;background:#07050f;color:#fff;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
.aitb-nebula{position:absolute;inset:0;z-index:0;background:
  radial-gradient(60% 45% at 22% 18%,rgba(168,85,247,.30),transparent 62%),
  radial-gradient(55% 45% at 80% 28%,rgba(34,211,238,.22),transparent 60%),
  radial-gradient(70% 55% at 50% 96%,rgba(236,72,153,.20),transparent 62%);
  animation:aitb-neb 16s ease-in-out infinite alternate;}
@keyframes aitb-neb{from{transform:scale(1) translateY(0);opacity:.85}to{transform:scale(1.12) translateY(-22px);opacity:1}}
.aitb-grid{position:absolute;inset:-40% 0 0;z-index:0;opacity:.16;
  background-image:linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px);
  background-size:70px 70px;transform:perspective(520px) rotateX(62deg);animation:aitb-gridmove 7s linear infinite;
  mask-image:linear-gradient(transparent 45%,#000 100%);-webkit-mask-image:linear-gradient(transparent 45%,#000 100%);}
@keyframes aitb-gridmove{from{background-position:0 0}to{background-position:0 70px}}
.aitb-star{position:absolute;z-index:1;border-radius:50%;background:#fff;box-shadow:0 0 7px #fff;animation:aitb-tw 3s ease-in-out infinite;}
@keyframes aitb-tw{0%,100%{opacity:.18;transform:scale(.75)}50%{opacity:1;transform:scale(1.25)}}

.aitb-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:17px;font-weight:800;letter-spacing:.34em;
  color:#c4b5fd;text-transform:uppercase;animation:aitb-fadeup .8s ease both;}
.aitb-eyebrow-dot{width:11px;height:11px;border-radius:50%;background:#34d399;box-shadow:0 0 14px #34d399;animation:aitb-blink 1.5s ease-in-out infinite;}
@keyframes aitb-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes aitb-fadeup{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

/* ---- title slide ---- */
.aitb-title-inner{position:relative;z-index:3;min-height:var(--aitb-slide-h,100vh);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:40px;text-align:center;}
.aitb-bigtitle{position:relative;font-size:clamp(44px,8.4vw,150px);font-weight:900;line-height:.95;letter-spacing:-.02em;margin:6px 0 2px;
  display:flex;flex-wrap:wrap;justify-content:center;gap:0 .28em;overflow:hidden;padding:0 4px;}
/* one word = one unwrappable unit (letters inside still animate separately) */
.aitb-word{display:inline-flex;white-space:nowrap;}
.aitb-letter{display:inline-block;background:linear-gradient(120deg,#fff 12%,#c4b5fd 40%,#67e8f9 62%,#f0abfc 88%);
  -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 40px rgba(168,85,247,.55));
  animation:aitb-letterin .85s cubic-bezier(.2,1.1,.3,1) both;}
@keyframes aitb-letterin{0%{opacity:0;transform:translateY(70%) rotateX(-80deg) scale(.7);filter:blur(9px)}
  100%{opacity:1;transform:translateY(0) rotateX(0) scale(1);filter:blur(0)}}
.aitb-shine{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.85) 50%,transparent 62%);
  mix-blend-mode:overlay;transform:translateX(-120%);animation:aitb-shine 3.6s ease-in-out 1.5s infinite;}
@keyframes aitb-shine{0%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}
.aitb-sub{display:flex;align-items:center;gap:18px;font-size:clamp(18px,2.4vw,34px);font-weight:800;color:#e9d5ff;
  animation:aitb-fadeup .9s ease .95s both;}
.aitb-sub i{color:#a855f7;font-style:normal;}
.aitb-tag{font-size:clamp(16px,1.9vw,27px);font-weight:800;letter-spacing:.16em;color:#94a3b8;animation:aitb-fadeup .9s ease 1.5s both;}
.aitb-flyby{position:absolute;z-index:2;top:16%;left:-10%;font-size:64px;filter:drop-shadow(0 0 24px rgba(255,200,120,.8));
  animation:aitb-flyby 9s ease-in-out 1.2s infinite;}
@keyframes aitb-flyby{0%{transform:translate(-10vw,0) rotate(38deg);opacity:0}
  12%{opacity:1}70%{opacity:1}100%{transform:translate(118vw,-32vh) rotate(38deg);opacity:0}}

.aitb-orbit-wrap{position:relative;width:min(340px,34vh);height:min(340px,34vh);margin-top:6px;animation:aitb-fadeup 1s ease 1.15s both;}
.aitb-orbit-ring{position:absolute;inset:0;border-radius:50%;border:2px dashed rgba(196,181,253,.35);animation:aitb-spin 26s linear infinite;}
.aitb-orbit-item{position:absolute;inset:0;animation:aitb-spin 26s linear infinite;}
.aitb-orbit-item .aitb-orbit-emoji{position:absolute;top:-6px;left:50%;font-size:clamp(26px,3.2vw,44px);
  transform:translateX(-50%) rotate(calc(var(--a) * -1));display:block;filter:drop-shadow(0 4px 14px rgba(0,0,0,.6));}
.aitb-orbit-item{transform:rotate(var(--a));transform-origin:50% 50%;}
@keyframes aitb-spin{from{transform:rotate(var(--a,0deg))}to{transform:rotate(calc(var(--a,0deg) + 360deg))}}
.aitb-core{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(52px,7vw,104px);
  filter:drop-shadow(0 0 34px rgba(251,191,36,.65));animation:aitb-corepulse 3s ease-in-out infinite;}
@keyframes aitb-corepulse{0%,100%{transform:scale(1)}50%{transform:scale(1.11)}}

/* ---- QR slides ---- */
.aitb-qr-inner{position:relative;z-index:3;min-height:var(--aitb-slide-h,100vh);display:grid;grid-template-columns:1fr auto;align-items:center;gap:6vw;padding:6vh 6vw;}
.aitb-qr-title{font-size:clamp(40px,6.6vw,104px);font-weight:900;line-height:1.02;margin:14px 0 18px;
  background:linear-gradient(120deg,#fff,var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:aitb-fadeup .9s ease .12s both;}
.aitb-qr-lead{font-size:clamp(17px,1.75vw,28px);line-height:1.5;color:#cbd5e1;max-width:22ch;font-weight:600;
  animation:aitb-fadeup .9s ease .24s both;}
.aitb-qr-steps{list-style:none;margin-top:30px;display:flex;flex-direction:column;gap:14px;}
.aitb-qr-steps li{display:flex;align-items:center;gap:16px;font-size:clamp(17px,1.75vw,29px);font-weight:800;color:#f1f5f9;
  animation:aitb-fadeup .8s ease both;}
.aitb-qr-num{flex:none;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:22px;font-weight:900;color:#07050f;background:var(--accent);box-shadow:0 0 26px color-mix(in srgb,var(--accent) 55%,transparent);}
.aitb-qr-right{display:flex;flex-direction:column;align-items:center;gap:16px;animation:aitb-pop .8s cubic-bezier(.2,1.1,.3,1) .3s both;}
@keyframes aitb-pop{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}
.aitb-qr-card{position:relative;padding:26px;border-radius:34px;background:rgba(255,255,255,.05);
  border:2px solid color-mix(in srgb,var(--accent) 45%,transparent);backdrop-filter:blur(6px);}
.aitb-qr-glow{position:absolute;inset:-3px;border-radius:36px;pointer-events:none;
  box-shadow:0 0 70px color-mix(in srgb,var(--accent) 55%,transparent);animation:aitb-qrglow 2.6s ease-in-out infinite;}
@keyframes aitb-qrglow{0%,100%{opacity:.45}50%{opacity:1}}
.aitb-qr-box{background:#fff;padding:20px;border-radius:22px;display:flex;line-height:0;}
.aitb-qr-url{margin-top:14px;text-align:center;font-size:16px;font-weight:700;color:#94a3b8;word-break:break-all;}
.aitb-qr-hint{font-size:clamp(15px,1.4vw,22px);font-weight:800;color:var(--accent);}

/* ---- how it works ---- */
.aitb-how-inner{position:relative;z-index:3;min-height:var(--aitb-slide-h,100vh);display:flex;flex-direction:column;justify-content:center;gap:3vh;padding:5vh 5vw;}
.aitb-how-head{text-align:center;}
.aitb-how-title{font-size:clamp(32px,4.6vw,74px);font-weight:900;line-height:1.05;margin-top:12px;
  background:linear-gradient(120deg,#fff,#c4b5fd 55%,#67e8f9);-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:aitb-fadeup .9s ease .1s both;}
.aitb-how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:min(22px,2vw);}
@media (max-width:1100px){.aitb-how-grid{grid-template-columns:repeat(2,1fr);}}
.aitb-how-card{position:relative;border-radius:26px;padding:min(26px,2.4vh) min(22px,2vw);background:rgba(255,255,255,.055);
  border:2px solid rgba(255,255,255,.12);animation:aitb-cardin .75s cubic-bezier(.2,1.1,.3,1) both;overflow:hidden;}
.aitb-how-card::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(168,85,247,.16),transparent 60%);pointer-events:none;}
@keyframes aitb-cardin{from{opacity:0;transform:translateY(34px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
.aitb-how-num{position:absolute;top:14px;right:18px;font-size:clamp(30px,3.4vw,54px);font-weight:900;color:rgba(255,255,255,.13);line-height:1;}
.aitb-how-emoji{font-size:clamp(36px,4vw,60px);line-height:1;filter:drop-shadow(0 6px 18px rgba(0,0,0,.55));animation:aitb-bob 3.4s ease-in-out infinite;}
@keyframes aitb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
.aitb-how-card-title{font-size:clamp(19px,2vw,32px);font-weight:900;margin-top:10px;line-height:1.15;}
.aitb-how-card-sub{font-size:clamp(14px,1.35vw,21px);font-weight:700;color:#a5b4fc;margin-top:5px;}
.aitb-how-rules{display:flex;flex-wrap:wrap;justify-content:center;gap:min(14px,1.4vw);}
.aitb-how-rule{display:flex;align-items:center;gap:11px;padding:12px 22px;border-radius:999px;
  background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.16);
  font-size:clamp(14px,1.35vw,23px);font-weight:800;color:#e2e8f0;animation:aitb-fadeup .7s ease both;}
.aitb-how-rule-emoji{font-size:1.3em;}

/* Short projectors / windowed Chrome (≤900px tall): trim the title slide's
   decorative orbit and gaps so the tagline never falls below the fold. */
@media (max-height:900px){
  .aitb-title-inner{gap:12px;padding:24px;}
  .aitb-orbit-wrap{width:min(220px,26vh);height:min(220px,26vh);}
  .aitb-bigtitle{font-size:clamp(40px,7.4vw,120px);}
  .aitb-how-inner{gap:2vh;padding:3vh 4vw;}
  .aitb-how-card{padding:min(16px,1.8vh) min(18px,1.8vw);}
  .aitb-how-rule{padding:9px 16px;}
}
`
