import Phaser from 'phaser';
import { CONFIG } from '../config';

/** Live run stats shown top-left while playing. */
export interface HudStats {
  distanceM: number; // forward progress, metres
  speed: number; // current speed, metres per second
  score: number; // running score (stub: tracks distance)
}

/** Final run summary shown on the game-over overlay. */
export interface GameOverStats {
  distanceM: number;
  timeS: number; // survival time, seconds
  score: number;
}

/**
 * HUD — the heads-up display and the game-over overlay.
 *
 * Owns scene display objects pinned to the camera (`setScrollFactor(0)`) so they
 * stay put while the world scrolls. While playing, a live stats readout updates
 * every frame; when the run ends, a dimming panel plus title / summary / restart
 * prompt take over. Everything is rebuilt fresh on `scene.restart()`, so there is
 * no teardown — a new HUD starts with the overlay hidden and zeroed stats. Score is
 * a stub this milestone; the real survival+ranking formula arrives with combat.
 *
 * Phaser renders each Text object in one colour/size, so the game-over title and
 * prompt are separate objects from the stat block to keep their distinct styling.
 */
export class HUD {
  private readonly stats: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const h = CONFIG.hud;
    const cx = CONFIG.width / 2;
    const cy = CONFIG.height / 2;

    this.stats = scene.add
      .text(h.padding, h.padding, '', {
        fontFamily: h.fontFamily,
        fontSize: `${h.statsFontSize}px`,
        color: h.statsColor,
      })
      .setScrollFactor(0)
      .setDepth(h.depth);

    // Full-canvas dimming panel behind the game-over text.
    this.overlay = scene.add
      .rectangle(cx, cy, CONFIG.width, CONFIG.height, h.overlayColor, h.overlayAlpha)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.title = scene.add
      .text(cx, cy - h.titleFontSize * 2, 'ELIMINATED', {
        fontFamily: h.fontFamily,
        fontSize: `${h.titleFontSize}px`,
        color: h.titleColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.summary = scene.add
      .text(cx, cy, '', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.panelColor,
        align: 'center',
        lineSpacing: h.lineSpacing,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.prompt = scene.add
      .text(cx, cy + h.titleFontSize * 2, 'Press R to restart', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.promptColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);
  }

  /** Refresh the live stats readout. */
  setStats({ distanceM, speed, score }: HudStats): void {
    this.stats.setText([
      `DIST  ${Math.floor(distanceM)} m`,
      `SPEED ${Math.round(speed)} m/s`,
      `SCORE ${score}`,
    ]);
  }

  /** Show the game-over overlay with the run summary; hides the live stats. */
  showGameOver({ distanceM, timeS, score }: GameOverStats): void {
    this.stats.setVisible(false);
    this.summary.setText([
      `Distance   ${Math.floor(distanceM)} m`,
      `Survived   ${timeS.toFixed(1)} s`,
      `Score      ${score}`,
    ]);
    this.overlay.setVisible(true);
    this.title.setVisible(true);
    this.summary.setVisible(true);
    this.prompt.setVisible(true);
  }
}
