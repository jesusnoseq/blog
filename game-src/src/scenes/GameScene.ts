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

/** Run lifecycle. (Menu arrives later; runs start in `playing` for now.) */
type GameState = 'playing' | 'paused' | 'gameover';

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
  private player!: PlayerRocket;
  private playerRect!: Phaser.GameObjects.Rectangle;
  // AI opponents and their visuals, kept index-aligned; both shrink on elimination.
  private ais: AIRocket[] = [];
  private aiRects: Phaser.GameObjects.Rectangle[] = [];
  // Per-frame scratch reused across frames (cleared, not reallocated) so AI
  // perception doesn't grow garbage: the shared rock/fuel snapshots and AI inputs.
  private readonly rockScratch: RockHit[] = [];
  private readonly fuelScratch: FuelTarget[] = [];
  private readonly aiInputs: InputState[] = [];
  // Reused [player, ...ais] list for the pairwise rocket-vs-rocket collision pass.
  private readonly rocketScratch: Rocket[] = [];
  private road!: Road;
  private hud!: HUD;
  private accumulator = 0;
  private survivalTime = 0; // seconds elapsed while playing (frozen on pause/death)
  private cameraFloorY = 0; // max allowed camera scrollY; ratchets up at minScrollSpeed
  private state: GameState = 'playing';

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = 'playing';
    this.accumulator = 0;
    this.survivalTime = 0;

    // Road is created first so the player draws on top of it.
    this.road = new Road(this);

    this.player = new PlayerRocket(0, 0);
    this.player.maxFuel = CONFIG.fuel.max;
    this.player.fuel = CONFIG.fuel.start;
    this.playerRect = this.add.rectangle(
      0,
      0,
      CONFIG.player.size,
      CONFIG.player.size,
      CONFIG.player.color,
    );

    // Spawn the AI field. Fresh arrays each create() so a restart doesn't retain
    // references to the previous run's (now destroyed) rockets/rects. They start
    // spread across the corridor a touch behind the player, in the rock-free safe
    // zone (chunk 0 and ahead are kept clear by the generator).
    this.ais = [];
    this.aiRects = [];
    const a = CONFIG.ai;
    for (let i = 0; i < a.count; i++) {
      const x = a.spawnSpreadX * ((i + 0.5) / a.count - 0.5);
      const ai = new AIRocket(x, a.spawnY);
      ai.maxFuel = a.maxFuel;
      ai.fuel = a.startFuel;
      this.ais.push(ai);
      this.aiRects.push(
        this.add.rectangle(x, a.spawnY, a.size, a.size, a.colors[i % a.colors.length]),
      );
    }

    const cam = this.cameras.main;
    cam.setBackgroundColor(CONFIG.backgroundColor);
    cam.startFollow(this.playerRect, true, CONFIG.camera.lerp, CONFIG.camera.lerp);
    cam.setDeadzone(CONFIG.camera.deadzoneWidth, CONFIG.camera.deadzoneHeight);
    // Lean the view "forward" (up) so the player sits lower and sees ahead.
    cam.setFollowOffset(0, CONFIG.camera.lookahead);
    // Camera starts unbounded; the first playing frame establishes the crush floor
    // from wherever the follow settles. (Reset here so restarts start fresh.)
    cam.removeBounds();
    this.cameraFloorY = cam.scrollY;

    this.inputManager = new InputManager(this);
    this.hud = new HUD(this);

    // Prime the road around the starting view so chunk 0 is present on frame 1.
    this.road.update(cam.worldView);
  }

  update(_time: number, delta: number): void {
    // Restart works from any state and fully resets via create().
    if (this.inputManager.justPressedRestart()) {
      this.scene.restart();
      return;
    }
    // The run is over: the game-over overlay is up; nothing left to simulate.
    if (this.state === 'gameover') return;

    // Pause toggles play⇄pause and is checked before the paused early-out so it
    // still unpauses.
    if (this.inputManager.justPressedPause()) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
    }
    if (this.state === 'paused') {
      this.hud.setDanger(false); // don't leave the warning lingering over a pause
      return;
    }

    const dt = delta / 1000;
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
    const alpha = this.accumulator / CONFIG.physics.fixedStep;
    this.playerRect.x = this.player.getRenderX(alpha);
    this.playerRect.y = this.player.getRenderY(alpha);
    for (let i = 0; i < this.ais.length; i++) {
      this.aiRects[i].x = this.ais[i].getRenderX(alpha);
      this.aiRects[i].y = this.ais[i].getRenderY(alpha);
    }

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

    // Warn before the crush: the player's body is within the danger band of the edge.
    this.hud.setDanger(bottomEdge - this.player.y < CONFIG.camera.dangerBand);

    // Out of fuel: the engine is dead and the rocket has coasted to a near-stop.
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (this.player.fuel <= 0 && speed < CONFIG.fuel.deadStopSpeed) {
      this.endRun('Out of fuel');
      return;
    }

    this.hud.setStats({
      distanceM: this.distanceMeters(),
      speed: speed / CONFIG.hud.pixelsPerMeter,
      score: this.score(),
      opponents: this.ais.length,
    });
    this.hud.setFuel(this.player.fuelFraction());

    // Generate/recycle road chunks around the (one-frame-lagged) camera view;
    // the ahead/behind margins absorb the lag.
    this.road.update(cam.worldView);
  }

  /** End the run: freeze the sim and show the game-over summary with its cause. */
  private endRun(cause: string): void {
    this.state = 'gameover';
    this.hud.showGameOver({
      distanceM: this.distanceMeters(),
      timeS: this.survivalTime,
      score: this.score(),
      cause,
    });
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
    };

    this.aiInputs.length = 0;
    for (const ai of this.ais) this.aiInputs.push(ai.think(perception, CONFIG.ai));
    return this.aiInputs;
  }

  /**
   * Remove any AI eliminated this frame (off-road or fallen behind the crush),
   * hiding its rectangle. Walks back-to-front so the index-aligned splices don't
   * skip survivors. Does not touch run state — only the player can end the run.
   */
  private eliminateDeadAI(bottomEdge: number): void {
    for (let i = this.ais.length - 1; i >= 0; i--) {
      const ai = this.ais[i];
      const offRoad = CONFIG.ELIMINATE_ON_OFFROAD && this.road.isOffRoad(ai.x);
      const crushed = CONFIG.ELIMINATE_ON_BOTTOM && this.hasFallenBehind(ai, bottomEdge);
      if (offRoad || crushed) {
        this.aiRects[i].destroy();
        this.aiRects.splice(i, 1);
        this.ais.splice(i, 1);
      }
    }
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
   * Score — stub. Tracks distance for now; the full survival+ranking formula
   * (opponents eliminated, etc.) lands in the propulsion-combat milestone.
   */
  private score(): number {
    return Math.floor(this.distanceMeters());
  }
}
