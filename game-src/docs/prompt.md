# Build a Top-Down Infinite Rocket Racing Game

## Deliverable

- Build a minimal project with TypeScript.
- It should result in a JS and an HTML file to run the game.
- The JS should be embeddable.
- Use Phaser if you see it necessary.
- Runs by opening the file in any modern browser. Target a steady 60 FPS using `requestAnimationFrame` with a fixed-timestep physics update and delta-time interpolation.

## Core Concept

Top-down 2D arcade game. Rocket vehicles travel "up" an endless, procedurally generated vertical road. Camera follows the player. Goal: survive as long as possible while managing fuel, dodging rocks, and using thruster exhaust to shove AI rivals into hazards. The world scrolls infinitely; difficulty rises with distance.

## Objective & Scoring (survival + ranking blend)

- It is endless survival, not a finish-line race.
- `Score = floor(distance) + (time_survived * k) + (opponents_eliminated * BONUS)`.
- Track and display opponents still alive AND opponents you eliminated.
- Game over = your rocket is destroyed (fuel hits 0 and you stop moving long enough, OR you leave the road, OR you take a fatal hit). On game over show: distance, survival time, opponents eliminated, final score, best score.

## Controls (arcade — intuitive)

- **Up / W**: main engine. Consumes fuel, adds forward (upward) acceleration. Draw exhaust flame behind (below) the rocket.
- **Left / A**: move LEFT. Apply leftward force. Visually, the exhaust plume appears on the RIGHT side of the rocket (physically correct), and that plume is the combat cone (see Combat). Consumes fuel.
- **Right / D**: move RIGHT. Rightward force; exhaust + combat cone on the LEFT side. Consumes fuel.
- **P**: pause/resume. **R**: restart on game-over screen.
- Movement must feel physical: integrate velocity from acceleration, apply drag, clamp to a max speed. No instant snapping.
- Add gamepad support, using the left joystick.

## Physics

- 2D vector velocity/acceleration. Per-frame: apply thrust forces, apply drag (separate longitudinal/lateral drag feels good), integrate position.
- Collisions resolved with circle-based colliders for simplicity.

## Infinite Road

- Constant road width. Road is a vertical corridor; "forward" = decreasing world Y (up). Camera centers on the player with slight look-ahead.
- Procedurally generate fixed-height chunks ahead of the camera; recycle chunks that scroll off-screen behind. Use an object pool — never grow unbounded.
- Visuals: dark asphalt road, lane markings/scroll texture, void or grass outside the road, clearly drawn left/right boundaries.

## Off-Road Rule (instant elimination)

- Any rocket (player or AI) whose body crosses a road boundary EXPLODES and is eliminated immediately (particle burst). This makes "push them off the road" a primary kill. Expose `ELIMINATE_ON_OFFROAD` as a config constant so it can be switched to slowdown later.

## Scroll-Crush Rule (forced pace — instant elimination)

- The camera has a **minimum upward scroll speed**: a constant `CAMERA_MIN_SCROLL_SPEED` (`CONFIG`) that it will always advance at, regardless of how slow (or stopped) the player is. The camera still follows the player normally when they out-run that floor — the minimum is a floor, never a cap. The camera never moves backward (down) and never scrolls slower than the floor, so the world is always being pulled "up" out from under a lagging rocket.
- Any rocket (player or AI) that falls off the **bottom edge** of the camera view is eliminated immediately (same explosion/particle burst as off-road). Out-pacing a rival so they drop off the bottom is therefore a kill, and AI that fall too far behind the player get crushed automatically.
- Elimination triggers only when a rocket's body has **fully cleared** the bottom edge of the view (forgiving — mirrors the off-road body-cross feel, not the centre-based off-road test). Tunable via the rocket's collision radius already in `CONFIG`.
- **Danger-zone warning:** when the player's rocket enters a `CONFIG`-defined danger band just above the bottom edge (`CAMERA_DANGER_BAND`), show a visual warning (edge flash / "FALLING BEHIND" alert) so the crush is never a silent surprise. The warning clears once the player climbs back out of the band.
- On game over via this rule, the cause readout reads e.g. "Fell behind" (alongside the existing "Off the road" / "Out of fuel" causes).
- Expose `ELIMINATE_ON_BOTTOM` as a config flag (parallel to `ELIMINATE_ON_OFFROAD`) so the crush can be switched off or to a slowdown later.

## Fuel

- Player has fuel (0..MAX). Main engine and side thrusters each drain fuel at tunable rates. HUD shows a fuel bar.
- Fuel zones: glowing pads placed periodically along the road. While a rocket's center is inside a zone, fuel refills continuously up to MAX. If fuel reaches 0 the engine is dead; once the rocket coasts to a stop it is destroyed.

## Obstacles (rocks)

- Circular/polygonal rocks with circle colliders. Collision causes speed loss + knockback (and optional damage flag, default off).
- Spawn rocks in designed patterns: slalom, chicane, narrow passage, cluster. Each pattern is a reusable function that populates a chunk.

## Propulsion Combat (key mechanic)

- When a side thruster fires, spawn a cone-shaped force field on the exhaust side (right plume when moving left, left plume when moving right), originating at the rocket and widening outward.
- Any OTHER rocket inside the cone receives a force pushing it away from the exhaust source (direction = from rocket toward target, scaled by proximity).
- This lets the player (and AI) shove rivals into rocks, off the road, or away from fuel zones. Tune force so it's decisive but not instant-win.

## AI Opponents

- Several AI rockets (configurable count, e.g. 4). Simple but competitive state machine: follow road forward, steer to avoid rocks and boundaries, divert to nearest fuel zone when low, and fire a side thruster at a nearby rival when one is in push range. AI must respect boundaries (avoid self-elimination) but can be pushed off by the player.

## Procedural Generation

- Weighted chunk types: 80% empty road, 10% rocks, 10% fuel zone. Weighted random with a seedable RNG.

## Difficulty Scaling

- As distance grows: increase base scroll speed, rock density/cluster size, and reduce fuel-zone frequency, on smooth curves clamped to sane maxima.

## Particle Exhaust

- Lightweight pooled particle system for engine flames, side-thruster plumes, and explosion bursts. Particles fade/shrink over lifetime. Keep counts bounded.

## HUD

- Fuel bar, distance traveled, current speed, opponents alive, opponents eliminated, current score, best score.

## Graphics — Procedurally generated pixel art, retro arcade style

- No image assets. All sprites are generated in code at runtime onto small offscreen canvases, then drawn to the main canvas with `ctx.imageSmoothingEnabled = false` (nearest-neighbor) and an integer upscale factor (e.g. logical 24x24 sprite drawn at 3x-4x) for crisp pixels.
- Define a `PALETTE` constant: a tight, vibrant 16-ish-color retro palette (saturated neons + a few darks for outlines/shading). All sprites draw only from this palette so everything stays cohesive.
- Rocket sprites: a `SpriteFactory` generates each rocket from a seed (`PixelRocket(seed, paletteSwatch)`). Generate ONE half of the body on a grid and mirror it horizontally for left/right symmetry; add a 1px dark outline and a lighter top-edge highlight for a shaded retro look. Give the player and each AI a distinct palette swatch so they're tellable apart.
- Cache every generated sprite once (keyed by seed) — never regenerate per frame.
- Rocks: also procedural pixel sprites — a few seeded variants of chunky, outlined boulders, randomly rotated/flipped from a small cached set.
- Road & world drawn with pixel-grid tiles: dark asphalt with dithered/striped lane markings, bright contrasting boundary lines, and a void/grass texture outside. Keep it on the same pixel grid as the sprites so scale is consistent.
- Fuel zones: glowing animated pixel pads (pulsing brightness via palette cycling on a timer, not gradients).
- Particles (exhaust, explosions): square pixel particles colored from the `PALETTE` (hot whites/yellows for flame, oranges/reds for explosions), sized in whole pixels and fading by stepping down the palette — no soft alpha blur.
- Optional retro touch: a subtle scanline or slight vignette overlay, toggle in `CONFIG` (default off).
- Everything must still hold 60 FPS — sprite generation happens at load/spawn, not in the render loop.

## Leaderboard (localStorage)

- Persist top N scores in localStorage. Show best score on HUD and a top-5 list on the game-over screen. Handle storage being unavailable gracefully.

## Code Structure (ES6 classes in the single file)

`Game` (loop, state: menu/playing/paused/gameover), `Camera`, `Road`, `Chunk`, `ProceduralGenerator`, `Rocket` (base), `PlayerRocket`, `AIRocket`, `Obstacle`, `FuelZone`, `ParticleSystem`, `InputManager`, `HUD`, `Leaderboard`. Put all tunables in a single `CONFIG` object at the top (fuel rates, forces, drag, speeds, road width, AI count, chunk weights, `ELIMINATE_ON_OFFROAD`, `CAMERA_MIN_SCROLL_SPEED`, `CAMERA_DANGER_BAND`, `ELIMINATE_ON_BOTTOM`, etc.) so balancing is one place.

## Acceptance Checklist

- 60 FPS with chunk recycling (no memory growth over time).
- Physical, draggy movement; arcade-correct steering with correct-side exhaust.
- Working fuel drain/refill and fuel-zero death.
- Rocks with patterns + knockback; cone-push affects other rockets.
- AI navigates, refuels, pushes, and avoids self-elimination.
- Off-road = explosion + elimination for player and AI.
- Camera holds a minimum upward scroll speed; falling off the bottom edge = explosion + elimination (player and AI), with a danger-zone warning before the crush.
- Difficulty rises with distance; particles render; localStorage leaderboard persists; pause and restart work.
- All gameplay numbers live in `CONFIG`.

## Out of Scope for v1 (do not build)

Boost mode, sound effects, mobile/touch. Leave clean extension points for them.

## Plan

Check the [Physics section](./milestones.md).
