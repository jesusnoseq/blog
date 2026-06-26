import Phaser from 'phaser';
import { CONFIG } from '../config';
import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';
import { PlayerRocket } from '../entities/PlayerRocket';
import type { Rocket } from '../entities/Rocket';
import { AIRocket } from '../entities/AIRocket';
import type { AIPerception, FuelTarget, RockHit } from '../entities/AIRocket';
import { Road } from '../world/Road';
import { HUD } from '../ui/HUD';
import { Leaderboard } from '../ui/Leaderboard';
import { applyCrt, loadCrtPref, saveCrtPref } from '../ui/crt';
import { SpriteFactory } from '../render/SpriteFactory';
import { ParticleSystem } from '../render/ParticleSystem';
import { MusicSynth } from '../audio/MusicSynth';

/** Run lifecycle. A run opens on the `ready` start screen and launches on thrust. */
type GameState = 'ready' | 'playing' | 'paused' | 'gameover';

// Camera-floor bound span. The crush floor is imposed by moving a Phaser camera
// bound so only its *bottom* limit binds `scrollY`; these make the other three
// edges effectively infinite (huge enough no realistic run reaches them, small
// enough to stay float-exact).
const CAMERA_BOUND_TOP = -1e8;
const CAMERA_BOUND_X = -1e8;
const CAMERA_BOUND_SPAN = 2e8;

/**
 * GameScene — milestones 4–7.
 *
 * Runs the game loop with a physics-driven player rocket the camera follows over
 * an infinite, chunked road, plus pause (P) and restart (R). Physics integrate
 * at a fixed timestep and the visual is rendered at an interpolated position for
 * smooth motion independent of frame rate. The run ends — game-over summary up,
 * simulation halted until R — when the rocket crosses a boundary (gated by
 * `CONFIG.ELIMINATE_ON_OFFROAD`), hits rocks hard enough to be shoved off, or runs
 * the fuel tank dry and coasts to a stop. Fuel drains while thrusting and refills
 * inside pads. AI, combat and pixel-art rendering arrive later; the player is still
 * a plain rectangle.
 */
export class GameScene extends Phaser.Scene {
  // NOTE: `input` is reserved by Phaser.Scene, so the manager is `inputManager`.
  private inputManager!: InputManager;
  private sprites!: SpriteFactory;
  private player!: PlayerRocket;
  private playerSprite!: Phaser.GameObjects.Image;
  // Tiling starfield drawn in the void outside the road; drifts with the camera.
  private voidBg!: Phaser.GameObjects.TileSprite;
  // AI opponents and their visuals, kept index-aligned; both shrink on elimination.
  private ais: AIRocket[] = [];
  private aiSprites: Phaser.GameObjects.Image[] = [];
  // Per-frame scratch reused across frames (cleared, not reallocated) so AI
  // perception doesn't grow garbage: the shared rock/fuel snapshots and AI inputs.
  private readonly rockScratch: RockHit[] = [];
  private readonly fuelScratch: FuelTarget[] = [];
  private readonly aiInputs: InputState[] = [];
  // Reused [player, ...ais] list for the pairwise rocket-vs-rocket collision pass
  // (also reused as the source/target list for the cone-push pass).
  private readonly rocketScratch: Rocket[] = [];
  // Per-AI rival snapshot (the player + every other AI), reused per think() call.
  private readonly rivalScratch: Rocket[] = [];
  // Steer commanded by each rocket this frame, index-aligned with rocketScratch
  // during the cone-push pass.
  private readonly pushSteers: number[] = [];
  // Translucent debug overlay for the active exhaust cones (gated by CONFIG.combat.debugCone).
  private coneGfx!: Phaser.GameObjects.Graphics;
  private particles!: ParticleSystem;
  private road!: Road;
  private hud!: HUD;
  // Local high-score table. Re-read from storage each create() so a restart picks
  // up the score the previous run just submitted.
  private leaderboard!: Leaderboard;
  // CRT (scanline + vignette) overlay state; persisted, toggled live with V.
  private crtOn = false;
  // Procedural background music. Created once and kept across restarts (a single
  // AudioContext is reused — browsers cap how many you may open), so it's `?`
  // and lazily initialised rather than rebuilt each create().
  private music?: MusicSynth;
  private accumulator = 0;
  private survivalTime = 0; // seconds elapsed while playing (frozen on pause/death)
  private eliminatedCount = 0; // opponents you've eliminated this run (scores killBonus each)
  private nextSwatch = 0; // rotates AI body colours so each spawn looks different
  private spawnTimer = 0; // countdown (s) staggering respawns when below maxConcurrent
  private cameraFloorY = 0; // max allowed camera scrollY; ratchets up at minScrollSpeed
  private state: GameState = 'ready';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = 'ready';
    this.accumulator = 0;
    this.survivalTime = 0;
    this.eliminatedCount = 0;
    this.nextSwatch = 0;
    this.spawnTimer = 0;

    // SpriteFactory generates + caches every pixel-art texture once, up front.
    this.sprites = new SpriteFactory(this);

    // Tiling starfield behind the road, locked to the camera (drifts in update).
    this.voidBg = this.add
      .tileSprite(0, 0, CONFIG.width, CONFIG.height, SpriteFactory.VOID_TILE)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(CONFIG.road.depth - 1);

    // Road is created next so the player draws on top of it.
    this.road = new Road(this, this.sprites);

    // Cone-push debug overlay sits just above the road, below the rockets.
    this.coneGfx = this.add.graphics().setDepth(CONFIG.road.depth + 1);

    // Exhaust/explosion particles render behind the rockets (above the road/pads).
    this.particles = new ParticleSystem(this, CONFIG.road.depth + 3);

    this.player = new PlayerRocket(0, 0);
    this.player.maxFuel = CONFIG.fuel.max;
    this.player.fuel = CONFIG.fuel.start;
    this.playerSprite = this.add.image(0, 0, this.sprites.rocketKey(CONFIG.render.rocket.playerSwatch));

    // Spawn the AI field. Fresh arrays each create() so a restart doesn't retain
    // references to the previous run's (now destroyed) rockets/rects. The field is
    // maintained at maxConcurrent and replacements appear *ahead* of the player
    // (see spawnAI). Seed a full field: a couple start beside the player (flanking
    // it left/right at the same height) so the race feels contested from frame one,
    // the rest start ahead.
    this.ais = [];
    this.aiSprites = [];
    const flank = CONFIG.ai.startAlongside;
    const side = CONFIG.ai.startSideX;
    for (let i = 0; i < CONFIG.ai.maxConcurrent; i++) {
      if (i < flank) {
        // Spread the flankers symmetrically across [-side, +side] at the player's
        // height; with 2 that's exactly one on each side.
        const x = flank > 1 ? -side + (2 * side * i) / (flank - 1) : 0;
        this.spawnAIAt(x, this.player.y);
      } else {
        this.spawnAI();
      }
    }

    const cam = this.cameras.main;
    cam.setBackgroundColor(CONFIG.backgroundColor);
    cam.startFollow(this.playerSprite, true, CONFIG.camera.lerp, CONFIG.camera.lerp);
    cam.setDeadzone(CONFIG.camera.deadzoneWidth, CONFIG.camera.deadzoneHeight);
    // Lean the view "forward" (up) so the player sits lower and sees ahead.
    cam.setFollowOffset(0, CONFIG.camera.lookahead);
    // Camera starts unbounded; the first playing frame establishes the crush floor
    // from wherever the follow settles. (Reset here so restarts start fresh.)
    cam.removeBounds();
    this.cameraFloorY = cam.scrollY;

    this.inputManager = new InputManager(this);
    this.hud = new HUD(this);

    // Local leaderboard (best score → HUD, top-5 → game-over) + the CRT overlay
    // preference. Both degrade gracefully when localStorage is unavailable. The
    // board is kept across restarts (like `music`) so in-memory scores survive a
    // restart even when storage is down; with storage it's the same data anyway.
    if (!this.leaderboard) this.leaderboard = new Leaderboard();
    this.crtOn = loadCrtPref();
    applyCrt(this.crtOn);

    // Music persists across restarts (one shared AudioContext); ensure it's
    // silent on the start screen — it launches with the run, on first thrust.
    if (!this.music) this.music = new MusicSynth();
    this.music.stop();

    // Prime the road around the starting view so chunk 0 is present on frame 1.
    this.road.update(cam.worldView);

    // Open on the start screen: show the controls and wait for forward thrust.
    this.hud.showControls();
  }

  update(_time: number, delta: number): void {
    // Restart works from any state and fully resets via create().
    if (this.inputManager.justPressedRestart()) {
      this.scene.restart();
      return;
    }

    // M toggles the music on/off at any time. When re-enabled mid-run, resume it.
    if (this.inputManager.justPressedMute()) {
      const on = !this.music!.isEnabled();
      this.music!.setEnabled(on);
      if (on && this.state === 'playing') this.music!.start();
    }

    // V toggles the CRT scanline/vignette overlay at any time (preference saved).
    if (this.inputManager.justPressedCrt()) {
      this.crtOn = !this.crtOn;
      applyCrt(this.crtOn);
      saveCrtPref(this.crtOn);
    }

    const dt = delta / 1000;

    // Start screen: the world is staged but frozen until the player commands
    // forward thrust (W / ↑ / gamepad). That press both launches the run and
    // counts as this frame's thrust, so the rocket moves off immediately.
    if (this.state === 'ready') {
      if (this.inputManager.getState().thrust > 0) {
        this.state = 'playing';
        this.hud.hideControls();
        // The launch keypress is the user gesture that unlocks audio; start the tune.
        this.music!.start();
      } else {
        return;
      }
    }

    // The run is over: the sim is halted, but keep ticking particles so the death
    // burst plays out under the overlay.
    if (this.state === 'gameover') {
      this.particles.update(dt);
      this.particles.draw();
      return;
    }

    // Pause toggles play⇄pause and is checked before the paused early-out so it
    // still unpauses.
    if (this.inputManager.justPressedPause()) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.music!.setPaused(this.state === 'paused');
    }
    if (this.state === 'paused') {
      this.hud.setDanger(false); // don't leave the warning lingering over a pause
      return;
    }

    this.survivalTime += dt;
    const input = this.inputManager.getState();

    // Build this frame's shared AI perception and let every AI decide its intent
    // once (reused across substeps, exactly like the player's input). The rock/fuel
    // snapshots are one frame lagged from the world — harmless at these margins.
    const aiInputs = this.thinkAI();

    // Fixed-timestep integration: accumulate real time and step physics in
    // constant slices so behaviour is frame-rate independent. The cap avoids a
    // spiral of death if a frame stalls (e.g. tab backgrounded). Input is
    // sampled once per frame and reused across substeps. AI step in lockstep so
    // every rocket shares one physics clock.
    this.accumulator = Math.min(this.accumulator + dt, CONFIG.physics.maxFrameTime);
    while (this.accumulator >= CONFIG.physics.fixedStep) {
      this.player.step(CONFIG.physics.fixedStep, input, CONFIG.physics, CONFIG.fuel);
      for (let i = 0; i < this.ais.length; i++) {
        this.ais[i].step(CONFIG.physics.fixedStep, aiInputs[i], CONFIG.ai, CONFIG.fuel);
      }
      this.accumulator -= CONFIG.physics.fixedStep;
    }

    // Propulsion combat: side-thruster exhaust cones shove other rockets away
    // (player ⇄ AI ⇄ AI). A velocity impulse applied once per frame with frame
    // dt — same pattern as refuel/knockback; position catches up via integration.
    this.applyConePush(dt, input.steerX, aiInputs);

    // Rock collisions: resolve after the step so knockback can push a rocket
    // across a boundary (checked next) and into elimination. Same rule for all.
    this.resolveCollisions(this.player);
    for (const ai of this.ais) this.resolveCollisions(ai);

    // Rocket-vs-rocket: rockets shoulder-check each other (player ⇄ AI ⇄ AI).
    this.resolveRocketCollisions();

    // Refuel while inside a pad (before the dead-engine check, so a zone can
    // revive a coasting empty rocket that drifts into it).
    if (this.road.isInFuelZone(this.player.x, this.player.y)) {
      this.player.refuel(CONFIG.fuel.refillRate * dt);
    }
    for (const ai of this.ais) {
      if (this.road.isInFuelZone(ai.x, ai.y)) ai.refuel(CONFIG.fuel.refillRate * dt);
    }

    // Render at the interpolated position between the two latest physics states.
    // Rockets bank (tilt) toward their steer for arcade feel — visual only.
    const alpha = this.accumulator / CONFIG.physics.fixedStep;
    const bank = Phaser.Math.DegToRad(CONFIG.render.rocket.bankDeg);
    this.playerSprite.x = this.player.getRenderX(alpha);
    this.playerSprite.y = this.player.getRenderY(alpha);
    this.playerSprite.rotation = input.steerX * bank;
    this.emitExhaust(this.player, this.playerSprite.x, this.playerSprite.y, input, dt);
    for (let i = 0; i < this.ais.length; i++) {
      const rx = this.ais[i].getRenderX(alpha);
      const ry = this.ais[i].getRenderY(alpha);
      this.aiSprites[i].x = rx;
      this.aiSprites[i].y = ry;
      this.aiSprites[i].rotation = aiInputs[i].steerX * bank;
      this.emitExhaust(this.ais[i], rx, ry, aiInputs[i], dt);
    }

    // Advance and draw the exhaust/explosion particles for this frame.
    this.particles.update(dt);
    this.particles.draw();

    // Drift the starfield with the camera (parallax) so the void feels alive.
    this.voidBg.tilePositionY = this.cameras.main.scrollY * CONFIG.render.void.parallax;

    // Camera floor (scroll-crush): ratchet the max allowed scrollY up by at least
    // minScrollSpeed each frame and never let it fall back, imposed via a moving
    // camera bound that Phaser's follow clamps against in preRender. The floor is
    // relative to the camera's own position, so the follow still wins (the floor
    // trails) whenever the player out-runs it; when the player stalls the floor
    // drags the view up past them.
    const cam = this.cameras.main;
    this.cameraFloorY = cam.scrollY - CONFIG.camera.minScrollSpeed * dt;
    cam.setBounds(
      CAMERA_BOUND_X,
      CAMERA_BOUND_TOP,
      CAMERA_BOUND_SPAN,
      this.cameraFloorY + cam.height - CAMERA_BOUND_TOP,
    );
    const bottomEdge = this.cameraFloorY + cam.height; // world Y of the kill line

    // Off-road = elimination: end the run once the rocket's centre leaves the
    // corridor (gated by the feature flag so it can be disabled for testing).
    if (CONFIG.ELIMINATE_ON_OFFROAD && this.road.isOffRoad(this.player.x)) {
      this.endRun('Off the road');
      return;
    }

    // Scroll-crush = elimination: the rocket has fully dropped off the bottom of
    // the view. Shared per-rocket test so AI reuse it once they exist (M8).
    if (CONFIG.ELIMINATE_ON_BOTTOM && this.hasFallenBehind(this.player, bottomEdge)) {
      this.endRun('Fell behind');
      return;
    }

    // AI elimination: the same off-road / scroll-crush rules apply to opponents,
    // but their death only thins the field (HUD count) — it never ends the player's
    // run. Iterate back-to-front so removals don't skip entries.
    this.eliminateDeadAI(bottomEdge);

    // Refill the field: spawn fresh opponents ahead, staggered, up to maxConcurrent.
    this.maintainField(dt);

    // Warn before the crush: the player's body is within the danger band of the edge.
    this.hud.setDanger(bottomEdge - this.player.y < CONFIG.camera.dangerBand);

    // Out of fuel: the engine is dead and the rocket has coasted to a near-stop.
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (this.player.fuel <= 0 && speed < CONFIG.fuel.deadStopSpeed) {
      this.endRun('Out of fuel');
      return;
    }

    const score = this.score();
    this.hud.setStats({
      distanceM: this.distanceMeters(),
      speed: speed / CONFIG.hud.pixelsPerMeter,
      score,
      best: Math.max(this.leaderboard.best(), score),
      opponents: this.ais.length,
      eliminated: this.eliminatedCount,
    });
    this.hud.setFuel(this.player.fuelFraction());

    // Generate/recycle road chunks around the (one-frame-lagged) camera view;
    // the ahead/behind margins absorb the lag.
    this.road.update(cam.worldView);
  }

  /** Emit each thrusting rocket's exhaust (engine + correct-side plume) this frame. */
  private emitExhaust(rocket: Rocket, x: number, y: number, intent: InputState, dt: number): void {
    if (rocket.fuel <= 0) return;
    if (intent.thrust > 0) {
      this.particles.emitEngine(x, y, rocket.vx, rocket.vy, intent.thrust, dt);
    }
    if (Math.abs(intent.steerX) >= CONFIG.combat.minSteer) {
      // Exhaust (plume) is on the side opposite the motion — same as the combat cone.
      const dirX = -Math.sign(intent.steerX);
      this.particles.emitSide(x, y, dirX, rocket.vx, rocket.vy, Math.abs(intent.steerX), dt);
    }
  }

  /** End the run: freeze the sim, record the score, and show the game-over summary. */
  private endRun(cause: string): void {
    this.state = 'gameover';
    this.music?.stop();
    this.particles.emitExplosion(this.playerSprite.x, this.playerSprite.y);

    const distanceM = this.distanceMeters();
    const score = this.score();
    // Record the run, then read back the top slice + this run's placement.
    const rank = this.leaderboard.submit({
      score,
      distanceM,
      date: new Date().toISOString().slice(0, 10),
    });

    this.hud.showGameOver(
      { distanceM, timeS: this.survivalTime, score, eliminated: this.eliminatedCount, cause },
      { entries: this.leaderboard.top(), rank, saved: this.leaderboard.persistent },
    );
  }

  /**
   * Whether a rocket has fully cleared the bottom edge of the view (its whole
   * body is below `bottomEdge`, the camera's bottom in world space). Forgiving
   * by design — the rocket survives until its leading point passes the line,
   * mirroring the body-cross feel of the off-road rule. Reused per-rocket by AI.
   */
  private hasFallenBehind(rocket: Rocket, bottomEdge: number): boolean {
    return rocket.y - CONFIG.collision.playerRadius > bottomEdge;
  }

  /**
   * Refresh the shared rock/fuel perception snapshot and have every AI decide its
   * intent for this frame. Returns an index-aligned input array (reused scratch).
   * The crush line is taken from last frame's floor — it moves slowly, so the lag
   * is immaterial and saves recomputing the camera bound up front.
   */
  private thinkAI(): InputState[] {
    this.rockScratch.length = 0;
    this.road.forEachRock((x, y, r) => this.rockScratch.push({ x, y, r }));
    this.fuelScratch.length = 0;
    this.road.forEachFuelZone((x, y) => this.fuelScratch.push({ x, y }));

    const perception: AIPerception = {
      roadHalfWidth: this.road.halfWidth,
      bottomEdge: this.cameraFloorY + this.cameras.main.height,
      rocks: this.rockScratch,
      fuelZones: this.fuelScratch,
      rivals: this.rivalScratch,
    };

    this.aiInputs.length = 0;
    for (let i = 0; i < this.ais.length; i++) {
      // Rivals for AI i = the player + every *other* AI. Push the live Rocket refs
      // (they expose x/y) into the reused scratch so perception stays zero-garbage.
      this.rivalScratch.length = 0;
      this.rivalScratch.push(this.player);
      for (let j = 0; j < this.ais.length; j++) {
        if (j !== i) this.rivalScratch.push(this.ais[j]);
      }
      this.aiInputs.push(this.ais[i].think(perception, CONFIG.ai));
    }
    return this.aiInputs;
  }

  /**
   * Remove any AI that left play this frame and let {@link maintainField} refill
   * the slot ahead. Three exits: off-road, fallen behind the crush, or pulled too
   * far ahead (silently recycled to keep the stream near the player). Only a death
   * caused by combat — eliminated within `combatCreditWindow` of an exhaust-cone
   * push — scores `killBonus` and plays the explosion; natural fall-behind /
   * off-road / far-ahead removals are silent. Walks back-to-front so the
   * index-aligned splices don't skip survivors. Never ends the player's run.
   */
  private eliminateDeadAI(bottomEdge: number): void {
    for (let i = this.ais.length - 1; i >= 0; i--) {
      const ai = this.ais[i];
      const offRoad = CONFIG.ELIMINATE_ON_OFFROAD && this.road.isOffRoad(ai.x);
      const crushed = CONFIG.ELIMINATE_ON_BOTTOM && this.hasFallenBehind(ai, bottomEdge);
      const tooFarAhead = this.player.y - ai.y > CONFIG.ai.despawnAheadDist;
      if (!(offRoad || crushed || tooFarAhead)) continue;

      // Credit a kill only when a recent cone push drove this elimination.
      const combatKill =
        (offRoad || crushed) &&
        this.survivalTime - ai.lastPushedTime <= CONFIG.combat.combatCreditWindow;
      if (combatKill) {
        this.eliminatedCount++;
        this.particles.emitExplosion(this.aiSprites[i].x, this.aiSprites[i].y);
      }
      this.aiSprites[i].destroy();
      this.aiSprites.splice(i, 1);
      this.ais.splice(i, 1);
    }
  }

  /**
   * Keep the opponent field populated. While below `maxConcurrent`, count down a
   * stagger timer and spawn one fresh opponent ahead each time it elapses, so
   * replacements trickle in rather than popping in all at once. When the field is
   * full, hold the timer at a fresh random delay so the next freed slot still waits.
   */
  private maintainField(dt: number): void {
    if (this.ais.length >= CONFIG.ai.maxConcurrent) {
      this.spawnTimer = Phaser.Math.FloatBetween(CONFIG.ai.spawnDelayMin, CONFIG.ai.spawnDelayMax);
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnAI();
      this.spawnTimer = Phaser.Math.FloatBetween(CONFIG.ai.spawnDelayMin, CONFIG.ai.spawnDelayMax);
    }
  }

  /**
   * Spawn one AI opponent ahead of the player (forward = -Y), at a random on-road
   * lane, cruising forward so it races with the field instead of being instantly
   * overtaken. Picks a random on-road lane a random distance ahead (-Y) within
   * `aheadMin`/`aheadMax`, then defers to {@link spawnAIAt}.
   */
  private spawnAI(
    aheadMin: number = CONFIG.ai.spawnAheadMin,
    aheadMax: number = CONFIG.ai.spawnAheadMax,
  ): void {
    const halfX = this.road.halfWidth - CONFIG.ai.edgeMargin;
    const x = Phaser.Math.FloatBetween(-halfX, halfX);
    const y = this.player.y - Phaser.Math.FloatBetween(aheadMin, aheadMax);
    this.spawnAIAt(x, y);
  }

  /**
   * Place one AI opponent at an exact world position, cruising forward. Each spawn
   * cycles to the next body colour so respawns/flankers look distinct. Pushes the
   * rocket and its sprite in lockstep (the arrays stay index-aligned).
   */
  private spawnAIAt(x: number, y: number): void {
    const a = CONFIG.ai;
    const ai = new AIRocket(x, y);
    ai.maxFuel = a.maxFuel;
    ai.fuel = a.startFuel;
    ai.vy = -a.spawnSpeed; // already cruising forward (-Y)
    this.ais.push(ai);

    const swatches = CONFIG.render.rocket.aiSwatches;
    const swatch = swatches[this.nextSwatch++ % swatches.length];
    this.aiSprites.push(this.add.image(x, y, this.sprites.rocketKey(swatch)));
  }

  /**
   * Propulsion combat — apply each firing side thruster's exhaust cone to the
   * other rockets. A thruster fires when its rocket has fuel and a real lateral
   * command (`|steerX| >= minSteer`); its cone points to the exhaust side
   * (opposite the motion: `coneDirX = -sign(steerX)`), spreads to `halfAngleDeg`,
   * and reaches `range`. Any other rocket inside is pushed *away from the source*
   * by a velocity impulse that falls off linearly with distance — strongest at
   * point-blank. Symmetric over all rockets, so player↔AI↔AI all push each other.
   * Reuses `rocketScratch` (rebuilt here) as the shared source/target list.
   */
  private applyConePush(dt: number, playerSteer: number, aiSteers: InputState[]): void {
    const c = CONFIG.combat;
    this.coneGfx.clear(); // also clears last frame's cones when the overlay is off

    const rockets = this.rocketScratch;
    rockets.length = 0;
    rockets.push(this.player);
    for (const ai of this.ais) rockets.push(ai);

    const steers = this.pushSteers;
    steers.length = 0;
    steers.push(playerSteer);
    for (const s of aiSteers) steers.push(s.steerX);

    const cosHalf = Math.cos(Phaser.Math.DegToRad(c.halfAngleDeg));

    for (let i = 0; i < rockets.length; i++) {
      const src = rockets[i];
      const steer = steers[i];
      // No thruster without fuel or a real lateral command → no cone.
      if (src.fuel <= 0 || Math.abs(steer) < c.minSteer) continue;
      // Exhaust (and its cone) is on the side opposite the motion.
      const coneDirX = -Math.sign(steer);

      if (c.debugCone) this.drawDebugCone(src.x, src.y, coneDirX, c.range, c.halfAngleDeg);

      for (let j = 0; j < rockets.length; j++) {
        if (j === i) continue;
        const tgt = rockets[j];
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 0 || dist > c.range) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        // Inside the cone? dot of unit (src→target) with axis (coneDirX, 0).
        if (nx * coneDirX < cosHalf) continue;
        // Push away from the source, strongest at point-blank.
        const accel = c.pushAccel * (1 - dist / c.range) * dt;
        tgt.vx += nx * accel;
        tgt.vy += ny * accel;
        // Tag the hit so an elimination shortly after is credited as a combat kill.
        tgt.lastPushedTime = this.survivalTime;
      }
    }
  }

  /** Stroke one exhaust cone as a translucent triangle (debug tuning aid). */
  private drawDebugCone(
    x: number,
    y: number,
    coneDirX: number,
    range: number,
    halfAngleDeg: number,
  ): void {
    const half = Phaser.Math.DegToRad(halfAngleDeg);
    const axis = coneDirX > 0 ? 0 : Math.PI; // cone axis angle (horizontal)
    const p1x = x + Math.cos(axis - half) * range;
    const p1y = y + Math.sin(axis - half) * range;
    const p2x = x + Math.cos(axis + half) * range;
    const p2y = y + Math.sin(axis + half) * range;
    this.coneGfx.fillStyle(0xff5a6e, 0.18);
    this.coneGfx.fillTriangle(x, y, p1x, p1y, p2x, p2y);
  }

  /**
   * Bump every pair of rockets (player + AI) that overlap this frame, so they
   * can't pass through one another. Builds the flat list into reused scratch and
   * resolves each unordered pair once.
   */
  private resolveRocketCollisions(): void {
    const rockets = this.rocketScratch;
    rockets.length = 0;
    rockets.push(this.player);
    for (const ai of this.ais) rockets.push(ai);

    const r = CONFIG.collision.rocket;
    for (let i = 0; i < rockets.length; i++) {
      for (let j = i + 1; j < rockets.length; j++) {
        rockets[i].resolveRocketCollision(rockets[j], r.radius, r.radius, r);
      }
    }
  }

  /** Push a rocket out of any rock it overlaps, slowing and bouncing it. Shared by all rockets. */
  private resolveCollisions(rocket: Rocket): void {
    this.road.forEachRock((x, y, r) => {
      rocket.resolveRockCollision(x, y, r, CONFIG.collision.playerRadius, CONFIG.collision);
    });
  }

  /** Forward progress in metres. Start is y=0 and "forward" is -Y, so -y is gain. */
  private distanceMeters(): number {
    return Math.max(0, -this.player.y) / CONFIG.hud.pixelsPerMeter;
  }

  /**
   * Score — the survival + ranking blend: forward distance, plus time survived
   * (rewards staying alive even when stalled), plus a bonus per opponent
   * eliminated. All three weights live in CONFIG.score.
   */
  private score(): number {
    return Math.floor(
      this.distanceMeters() +
        this.survivalTime * CONFIG.score.timeScore +
        this.eliminatedCount * CONFIG.score.killBonus,
    );
  }
}
