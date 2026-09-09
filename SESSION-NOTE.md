# Session note — AI Bingo demo (2026-09-07)

## Start here

Work happens in **`D:\Claude Projects\flag-retrieval`** (Vite + React + Supabase, Vercel project `game_hub`, domain `flag-retrieval.vercel.app`, GitHub `bryanwai1/flag-retrieval`).

⚠️ This is **not** `D:\bingo-dash` — that's a separate Next.js/Prisma app that happens to share the "bingo dash" name. Everything under `flag-retrieval.vercel.app`, including the `/bingo-dash/...` paths, lives in this repo. There's also a stale clone at `C:\flag-retrieval` (~90 commits behind) — ignore it.

## What shipped

All pushed to `master` (deployed): **`bd15ede`** AI Bingo demo, **`6040b66`** AITB module setState fix.

**`/bingo-dash/sample-ai`** — the Bingo Sample with its three "Longest Breathe" tiles (the red 100pt ones) replaced by playable AI Team Building missions:

| Tile | Mission | Difficulty | Max pts |
|---|---|---|---|
| 1 | 🎶 Roulette Jingle & Dance Off | Normal | 330 |
| 2 | 🎬 Random Card Cinematic | Normal | 330 |
| 3 | 🐘 Found Object Animals | Hard | 400 |

Reachable from the Game Hub via the **🤖 AI BINGO DEMO** button. Demo passwords: join `1234`, marshal `4321`. The four red "Paper Scissors Rock!" tiles were deliberately left alone.

## Two design decisions to preserve

1. **Points are scaled into Bingo's economy.** AITB natively pays up to ~2,350 (Normal) / ~2,900 (Hard); Bingo tiles are 100–250. Scaled so a perfect mission ≈ 330/400 — the best tile on the board, not a board-winning one. Full AITB scale was explicitly rejected.
2. **The tile swap is client-side only.** The sample reads the live Supabase board that real events share, so the substitution happens at render time and nothing is written to the DB. The plain `/bingo-dash/sample` is unchanged.

## ⚠️ The fragile part: wheel angle tables

The roulette spins Higgsfield-generated images with the options **printed into the artwork**. The generated slices are **not evenly spaced** (Genre ranges 21.4°–28.5°), so the app cannot assume `index × segment`.

Every slice's real angle was measured off the images by sampling wedge colours around the disc, and stored in **`src/lib/aitbWheels.ts`**:
- **Genre** — 15 individually measured angles (irregular), tiling a full 360.0°
- **Topic** — 14 equal 25.714° slices at a 13.0° offset (measured spread 0.34°)

**Regenerating a wheel image invalidates its table.** Re-measure or the pointer stops on the wrong word. The measuring script is gone with the scratchpad; the method is: sample wedge colour around a ring between the label text and the gold bezel (~0.66–0.78 R), smooth, run-length encode, take the arc midpoints.

Verified by forcing landings and reading the screen: Reggae, Country Ballad, Deadlines, Traffic Jams all correct, plus live spins.

## Open items

- **Six Topic labels are abbreviated on the wheel** ("OFFICE COFFEE", "ZOOM CALLS", "DEADLINES", "WHATSAPP GROUP", "BROKEN PRINTER", "COMPANY CANTEEN") vs the app's pool values ("The Office Coffee", …). Selection is correct; only the wording differs, and the song brief uses the long form. Aligning them means either regenerating the wheel with full strings (which previously caused **duplicate wedges**) or renaming pool values (which would break the `aitbReelImage` filenames for the reveal images).
- **`/aitb/admin` is publicly reachable without a password** — Bryan confirmed this is intended. Restoring the gate is a small commit if he changes his mind.
- **`public/rocket-dash/landing_old_backup.mp4`** is untracked and was left alone — not from this work.
- **The AITB mission page (`/aitb/m/5`) shares the wheel code** and got the change too, but was only verified through the Bingo demo — reaching the module on that page requires checking a team in, which writes a real row to the live event database. Test there only with a throwaway team.
- Pre-existing lint noise in `AitbMissionModule.tsx` (4 setState-in-effect / purity errors) is unchanged from before this work — left alone deliberately.

## Housekeeping

A hook flagged this session running ~5× its starting quota per turn (92k → 417k). Context was saved to `~/.clauditor/last-session.md`.
