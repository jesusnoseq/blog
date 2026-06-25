import Phaser from 'phaser';
import { CONFIG } from '../config';
import { InputManager } from '../input/InputManager';

/**
 * GameScene — milestone 1 skeleton.
 *
 * Stands up the game loop with a placeholder player the camera follows, plus
 * pause (P) and restart (R). Real movement physics, the road, rocks, fuel, AI,
 * combat and pixel-art rendering arrive in later milestones; the placeholder
 * translation here exists purely to make camera-follow visibly work.
 */
export class GameScene extends Phaser.Scene {
  // NOTE: `input` is reserved by Phaser.Scene, so the manager is `inputManager`.
  private inputManager!: InputManager;
  private player!: Phaser.GameObjects.Rectangle;
  private isPaused = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.isPaused = false;

    this.drawWorldGrid();

    this.player = this.add.rectangle(
      0,
      0,
      CONFIG.player.size,
      CONFIG.player.size,
      CONFIG.player.color,
    );

    const cam = this.cameras.main;
    cam.setBackgroundColor(CONFIG.backgroundColor);
    cam.startFollow(this.player, true, CONFIG.camera.lerp, CONFIG.camera.lerp);
    cam.setDeadzone(CONFIG.camera.deadzoneWidth, CONFIG.camera.deadzoneHeight);
    // Lean the view "forward" (up) so the player sits lower and sees ahead.
    cam.setFollowOffset(0, CONFIG.camera.lookahead);

    this.inputManager = new InputManager(this);
  }

  update(_time: number, delta: number): void {
    // Pause/restart are checked first so they work even while paused.
    if (this.inputManager.justPressedPause()) {
      this.isPaused = !this.isPaused;
    }
    if (this.inputManager.justPressedRestart()) {
      this.scene.restart();
      return;
    }
    if (this.isPaused) return;

    const dt = delta / 1000;
    const { thrust, steerX } = this.inputManager.getState();

    // Placeholder translation only (NOT the real physics model — milestone 2).
    const speed = CONFIG.player.placeholderSpeed;
    this.player.x += steerX * speed * dt;
    this.player.y -= thrust * speed * dt; // "forward" = up = decreasing world Y
  }

  /**
   * A faint reference grid so movement and camera-follow are visible against the
   * otherwise empty world. Temporary scaffolding — the procedural road replaces
   * it in the "Infinite road + camera" milestone.
   */
  private drawWorldGrid(): void {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x223044, 1);
    const extent = 5000;
    const step = 100;
    for (let x = -extent; x <= extent; x += step) {
      grid.lineBetween(x, -extent, x, extent);
    }
    for (let y = -extent; y <= extent; y += step) {
      grid.lineBetween(-extent, y, extent, y);
    }
    grid.setDepth(-10);
  }
}
