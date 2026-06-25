# CLAUDE.md

## What this is

An **infinite top-down rocket racing game** built as a self-contained web game that
lives inside a Hugo blog (`C:\dev\blog`). The build output must be embeddable: a JS
bundle + an HTML file that run by opening in any modern browser.

The full game design is in [`prompt.md`](./prompt.md). The ordered build plan with
per-step test gates is in [`milestones.md`](./milestones.md). **Read both before
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

**Milestone 1 (Skeleton + game loop) — done.** `game-src/` scaffolded with Vite + TS +
Phaser 3; `CONFIG` seeded; `InputManager` (keyboard W/A/D + arrows, P, R, gamepad
left-stick stub); `GameScene` with a placeholder player the camera follows, P
pause/resume, R restart. Typecheck + build pass; dev server runs.

**Next:** Milestone 2 — Player rocket + movement physics (vector velocity/accel,
separate longitudinal/lateral drag, max-speed clamp). This replaces the placeholder
translation in `GameScene.update` / `CONFIG.player.placeholderSpeed`.
