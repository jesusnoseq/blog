import Phaser from 'phaser';
import { CONFIG } from '../config';
import { InputManager } from '../input/InputManager';
import { PlayerRocket } from '../entities/PlayerRocket';
import { Road } from '../world/Road';
import { HUD } from '../ui/HUD';

/** Run lifecycle. (Menu arrives later; runs start in `playing` for now.) */
type GameState = 'playing' | 'paused' | 'gameover';

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
    if (this.state === 'paused') return;

    this.survivalTime += delta / 1000;
    const input = this.inputManager.getState();

    // Fixed-timestep integration: accumulate real time and step physics in
    // constant slices so behaviour is frame-rate independent. The cap avoids a
    // spiral of death if a frame stalls (e.g. tab backgrounded). Input is
    // sampled once per frame and reused across substeps.
    this.accumulator = Math.min(
      this.accumulator + delta / 1000,
      CONFIG.physics.maxFrameTime,
    );
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
      this.player.refuel(CONFIG.fuel.refillRate * (delta / 1000));
    }

    // Render at the interpolated position between the two latest physics states.
    const alpha = this.accumulator / CONFIG.physics.fixedStep;
    this.playerRect.x = this.player.getRenderX(alpha);
    this.playerRect.y = this.player.getRenderY(alpha);

    // Off-road = elimination: end the run once the rocket's centre leaves the
    // corridor (gated by the feature flag so it can be disabled for testing).
    if (CONFIG.ELIMINATE_ON_OFFROAD && this.road.isOffRoad(this.player.x)) {
      this.endRun('Off the road');
      return;
    }

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
    this.road.update(this.cameras.main.worldView);
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
