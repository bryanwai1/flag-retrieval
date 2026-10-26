# Plan: Player Demo for `/aitb/admin`

## Goal
Add a `🎓 Demo` button to the `/aitb/admin` top bar. It opens a new tab showing the **real player view** (no new UI), starting from "Pick your team", with zero writes to the live DB.

## Approach
Run the real `AitbHome` and `AitbMission` pages against an **in-memory fake database**. Only the data source changes.

## Steps
1. **Button** — in `src/pages/AitbAdmin.tsx` sticky bar (next to Projector): `<a href="/aitb/home?demo=1" target="_blank" rel="noopener noreferrer">🎓 Demo</a>`. Same styling as Projector; icon-only on mobile.
2. **Demo flag** — `?demo=1` sets `sessionStorage['aitb_demo']='1'` (per tab, so `/aitb/m/:id` links stay in demo; real players never have it).
3. **Fake DB** — new `src/lib/aitbDb.ts` exporting a `supabase`-compatible client. Normal mode returns the real client. Demo mode serves a fake DB persisted in `sessionStorage`. Covers only what the player pages use:
   - `aitb_teams` select
   - `aitb_progress` select / upsert / update (`steps_done`, `words`, `completed_at`, `bonus`) / delete
   - `aitb_settings` select (`admin_password` = `4321`, `game_ends_at` = null)
   - `channel` / `removeChannel` / reactions: no-ops
4. **Swap imports** — in `AitbHome.tsx`, `AitbMission.tsx`, `useAitbGameTimer.ts`, `useAitbRealtime.ts`, `useAitbReactions.ts`: import from `aitbDb` instead of `lib/supabase`.
5. **Team key** — in demo, store the picked team under `aitb_my_team_demo` so a real team choice is never overwritten.
6. **Seed** — 4 teams: Sample Team Alpha, Beta, Gamma, Delta. All start with no progress. Rivals may get pre-made completed missions so the rank chip is meaningful (decision pending).
7. **Reset** — close the tab. The existing "Switch team" menu still works.

## Player flow (real UI, unchanged)
Pick team → Draw 3 cards → Start (+100) → Open steps, tick → Marshal code `4321` → Complete (+300 + speed bonus, rocket moves, rank updates).

## Not changed
DB schema, real-event data, `dist/`. No guided tour or captions (can be a later layer).

## Verify
- Full flow in browser at phone width.
- Network tab: zero Supabase writes in demo.
- Normal `/aitb/home` and `/aitb/m/:id` behave the same.
- `npm run build` and lint pass.

## Open decision
Rivals pre-scored, or all four teams start at 0?
