# CLAUDE.md

## What this is

An **infinite top-down rocket racing game** built as a self-contained web game that
lives inside a Hugo blog (`C:\dev\blog`). The build output must be embeddable: a JS
bundle + an HTML file that run by opening in any modern browser.

The full game design is in [`prompt.md`](./docs/prompt.md). The ordered build plan with
per-step test gates is in [`milestones.md`](./docs/milestones.md). **Read both before
implementing** — they are the source of truth for scope and acceptance criteria.

## Tech stack & tooling

- **Language:** TypeScript (5.9.3).
- **Build tool:** Vite (7.3.5).
- **Engine:** Phaser 3 (3.90.0).
- **Package manager:** pnpm, run via `npx` (`npx pnpm ...`).
- **Dependency policy:** prefer well-maintained, stable libraries. Avoid experimental
  or low-adoption packages. Any dependency must be **at least 7 days old**.

## Where the code lives

The Vite/TS/Phaser dev project is in **`game-src/` at the repo root**
(`C:\dev\blog\game-src`), *outside* `static/` so its `node_modules`/source are never
published. Vite **builds into `static/game/`** (this directory), which Hugo serves at
`/game/`. The generated `index.html` + `assets/` are gitignored; the `.md` docs here
are tracked.

Run all commands from `game-src/`:

- `npx pnpm install` — install deps
- `npx pnpm dev` — Vite dev server (HMR) at http://localhost:5173
- `npx pnpm typecheck` — `tsc --noEmit`
- `npx pnpm build` — bundle into `../static/game` (uses `emptyOutDir: false` so it
  never deletes the `.md` docs)
- `npx pnpm preview` — serve the production build

## Architecture (intended)

ES6 classes, with all tunables in a single top-level `CONFIG` object so balancing
lives in one place. Core classes:

`Game` (loop + state: menu/playing/paused/gameover), `Camera`, `Road`, `Chunk`,
`ProceduralGenerator`, `Rocket` (base) → `PlayerRocket` / `AIRocket`, `Obstacle`,
`FuelZone`, `ParticleSystem`, `InputManager`, `HUD`, `Leaderboard`,
`SpriteFactory`.

## Non-negotiable constraints

- **60 FPS** via `requestAnimationFrame`, fixed-timestep physics + delta-time
  interpolation.
- **Bounded memory** — object-pool chunks/particles; recycle, never grow unbounded.
- **No image assets** — all sprites are procedural pixel art generated at load/spawn
  onto offscreen canvases, cached by seed, drawn with `imageSmoothingEnabled = false`
  and integer upscaling. Never generate sprites in the render loop.
- **Every gameplay number lives in `CONFIG`** — no magic numbers scattered in logic.
- Controls: W/A/D or arrows + gamepad left stick; P = pause, R = restart.

## Workflow

- Build milestone by milestone (see `milestones.md`); each has a **test gate** —
  satisfy it before moving on. Tune feel (drag/accel/push force) in `CONFIG` before
  polishing.
- Out of scope for v1: boost mode, sound effects, mobile/touch. Leave clean extension
  points but don't build them.

## Current state

**Milestones 1–5 — done.**
- **M1 (Skeleton + loop):** Vite + TS + Phaser 3; `CONFIG`; `InputManager` (W/A/D +
  arrows, P, R, gamepad left-stick stub); fixed-timestep loop with P pause / R restart.
- **M2 (Movement physics):** `Rocket` base + `PlayerRocket`; vector velocity/accel,
  per-axis longitudinal/lateral drag, max-speed clamp; render interpolation; camera
  follow with look-ahead.
- **M3 (Infinite road):** `Road` / `Chunk` / `ProceduralGenerator` (empty chunks);
  constant-width corridor, object-pooled chunks, bounded chunk count.
- **M4 (Off-road elimination + game over):** `Road.isOffRoad(x)` (centre crossing the
  ±halfWidth boundary); `GameScene` state machine (`playing | paused | gameover`) +
  survival timer; `HUD` (live distance/speed/score readout + game-over overlay with
  distance/time/score and restart prompt). `CONFIG.ELIMINATE_ON_OFFROAD` gates the
  check; score is a distance-based stub. R restarts with full state reset.
- **M5 (Rocks + collision):** `rockPatterns.ts` (slalom/chicane/narrow/cluster,
  seeded, on-road clamped); `ProceduralGenerator` picks empty-vs-rock per chunk via a
  per-index reseeded RNG (safe start kept clear); `Chunk` stores + draws rocks and
  redraws on each placement; `Road.forEachRock` yields world-space colliders;
  `Rocket.resolveRockCollision` (separate + speed-loss + knockback, reused by AI
  later) wired in `GameScene` before the off-road check. `CONFIG.rocks` /
  `CONFIG.collision` (incl. off-by-default `damage` flag).

**Next:** Milestone 6 — Fuel system (fuel 0..MAX drained by main + side thrusters at
CONFIG rates, fuel bar in HUD).
