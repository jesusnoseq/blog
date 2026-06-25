# Milestones

Milestones to build [prompt](prompt.md)

## Skeleton + game loop

Create the project structure, setup dependencies (phaser), wire up camera and controls to have an empty game running.
It should restart with R, P should pause.
Use TypeScript and Vite, and run pnpm via npx. Use pnpm as the package manager. Avoid experimental or unproven dependencies (e.g., packages with low adoption or clearly unstable releases), and prefer well-maintained, stable libraries. At least 7 days older.

## Player rocket + movement physics

Rocket base + PlayerRocket. Vector velocity/acceleration, drag
(separate longitudinal/lateral), max-speed clamp. Up/W = forward thrust,
Left+Right/A+D = lateral force (arcade: left = left). Render rocket as a plain
shape for now. Camera follows player with slight look-ahead.
Test gate: Movement feels physical (accelerates, drifts, decelerates — not
instant). Steering is intuitive. Camera tracks smoothly. Tune drag/accel in
CONFIG until it feels good before continuing.

## Infinite road + camera

Road, Chunk, ProceduralGenerator (empty chunks only for now).
Constant-width vertical corridor, dark asphalt + lane markings + boundary lines +
void outside. Generate chunks ahead, recycle behind via an object pool.
Test gate: Road scrolls infinitely as you thrust up. No memory growth over a
2-minute run (check chunk count stays bounded). Boundaries clearly visible.

## Off-road elimination + game over

Detect rocket crossing a boundary → destroy + game-over state.
Game-over screen: distance, survival time, final score (stub), restart. HUD stub
(distance, speed, score). ELIMINATE_ON_OFFROAD config flag.
Test gate: Leaving the road ends the run and shows the screen; restart works
cleanly (state fully resets).

## Camera minimum speed + scroll-crush

Give the camera a constant minimum upward scroll speed (`CAMERA_MIN_SCROLL_SPEED`
in CONFIG): it always advances at least this fast and never moves backward, but
still follows the player normally when they out-run the floor. Any rocket whose
body fully clears the bottom edge of the view is eliminated (same explosion +
game-over path as off-road; cause reads "Fell behind"). When the player enters a
danger band above the bottom edge (`CAMERA_DANGER_BAND`), show a visual warning
that clears when they climb back out. Add `ELIMINATE_ON_BOTTOM` config flag. (AI
are only subject to the crush once they exist — wire the shared check so it
applies to every rocket; until then it gates the player.)
Test gate: Sitting still (or coasting slowly) scrolls the world up and eventually
crushes you off the bottom with a clear warning first; thrusting forward escapes
the band. Restart fully resets camera scroll state.

## Rocks + collision

Obstacle rocks with circle colliders. Collision = speed loss +
knockback (+ optional damage flag, default off). Pattern functions: slalom,
chicane, narrow passage, cluster. Add rock chunk types to the generator.
Test gate: Rocks spawn in readable patterns, collisions knock you back and
slow you without feeling random/unfair. You can weave through a slalom.

## Fuel system

Fuel 0..MAX, drained by main + side thrusters (CONFIG rates). Fuel bar
in HUD.

## Fuel zones

FuelZone pads spawned periodically; refill while inside. Fuel-zero =
dead engine, coast to stop = destroyed.

Fuel drains while thrusting, refills in zones, caps at MAX, and
running dry ends the run. Rates feel fair (you can reach the next zone with
careful play).

## AI opponents

AIRocket state machine: follow road forward, avoid rocks +
boundaries, divert to nearest fuel zone when low, respect edges (no
self-elimination). Spawn N (CONFIG). HUD: opponents alive.
Test gate: AI rockets drive the course competently, refuel, and stay on-road
on their own. They feel like racers, not drifting boxes.

## Propulsion combat

Side thruster spawns a cone-shaped force field on the exhaust side;
any other rocket inside gets pushed away from the source (scaled by proximity).
Wire it both ways: player can push AI, AI can push player/each other. Track
opponents eliminated; full survival+ranking score formula. HUD: eliminated count.
Test gate: You can shove an AI into rocks or off the road for a kill. Push
force is decisive but not instant-win. AI occasionally pushes back. This is where
you'll tune the most — get the push feel right before polishing.

## Difficulty scaling + procedural weights

Finalize weighted chunk generation (80/10/10 of empty road, rocks, fueld zones) with seedable RNG. As
distance grows: scroll speed up, rock density/cluster size up, fuel-zone
frequency down — smooth curves clamped to maxima.
Test gate: Early game is approachable; minutes in it's noticeably harder.
Difficulty curve has no sudden impossible spikes.

## Pixel-art graphics

SpriteFactory: seeded pixel-art rockets (generate half + mirror, 1px
outline + top highlight), cached once. Procedural rock sprites (seeded variants).
Pixel-tile road/void. Glowing animated fuel pads (palette cycling). Render with
imageSmoothingEnabled = false + integer upscale. Fixed vibrant PALETTE
constant. Distinct palette swatch per rocket.
Test gate: Crisp (not blurry) retro pixel art, cohesive palette, player vs AI
visually distinct, still a steady 60 FPS (sprites generated at spawn/load, never
per-frame).

## Particles

Pooled square-pixel particles: engine flame, side-thruster plumes,
explosion bursts (palette-stepped fade, no alpha blur)

## Leaderboard

LocalStorage leaderboard
(top N), best score on HUD, top-5 on game-over screen,
Graceful fallback if storage unavailable. Optional scanline/vignette toggle (default off).

## Polish

Thrusters and explosions look juicy, particle counts stay bounded,
60 FPS holds, scores persist across reloads.

## Final acceptance

* Steady 60 FPS, bounded memory over a long run.
* Physical movement, arcade steering, correct-side exhaust visuals.
* Fuel drain/refill/death works; rocks + patterns + knockback; cone-push affects all rockets.
* AI navigates, refuels, pushes, avoids self-elimination.
* Off-road = explosion + elimination (player and AI).
* Camera holds a minimum upward scroll speed; falling off the bottom edge =
  explosion + elimination (player and AI), with a danger-zone warning first.
* Difficulty rises with distance; pixel sprites crisp; particles render;
* leaderboard persists; pause + restart work.
* Every gameplay number lives in CONFIG.
