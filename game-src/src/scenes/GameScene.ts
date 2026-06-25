import Phaser from 'phaser';
import { CONFIG } from '../config';
import { InputManager } from '../input/InputManager';
import { PlayerRocket } from '../entities/PlayerRocket';
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

    // Fixed-timestep integration: accumulate real time and step physics in
    // constant slices so behaviour is frame-rate independent. The cap avoids a
    // spiral of death if a frame stalls (e.g. tab backgrounded). Input is
    // sampled once per frame and reused across substeps.
    this.accumulator = Math.min(this.accumulator + dt, CONFIG.physics.maxFrameTime);
    while (this.accumulator >= CONFIG.physics.fixedStep) {
      this.player.step(CONFIG.physics.fixedStep, input, CONFIG.physics, CONFIG.fuel);
      this.accumulator -= CONFIG.physics.fixedStep;
    }

    // Rock collisions: resolve after the step so knockback can push the player
    // across a boundary (checked next) and into elimination.
    this.resolveCollisions();

    // Refuel while inside a pad (before the dead-engine check, so a zone can
    // revive a coasting empty rocket that drifts into it).
    if (this.road.isInFuelZone(this.player.x, this.player.y)) {
      this.player.refuel(CONFIG.fuel.refillRate * dt);
    }

    // Render at the interpolated position between the two latest physics states.
    const alpha = this.accumulator / CONFIG.physics.fixedStep;
    this.playerRect.x = this.player.getRenderX(alpha);
    this.playerRect.y = this.player.getRenderY(alpha);

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
  private hasFallenBehind(rocket: PlayerRocket, bottomEdge: number): boolean {
    return rocket.y - CONFIG.collision.playerRadius > bottomEdge;
  }

  /** Push the player out of any rock it overlaps, slowing and bouncing it. */
  private resolveCollisions(): void {
    this.road.forEachRock((x, y, r) => {
      this.player.resolveRockCollision(x, y, r, CONFIG.collision.playerRadius, CONFIG.collision);
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
