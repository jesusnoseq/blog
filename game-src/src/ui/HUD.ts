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
  cause: string; // why the run ended (e.g. "Off the road", "Out of fuel")
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
  private readonly fuelBar: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly cause: Phaser.GameObjects.Text;
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

    this.fuelBar = scene.add.graphics().setScrollFactor(0).setDepth(h.depth);

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

    this.cause = scene.add
      .text(cx, cy - h.titleFontSize, '', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.causeColor,
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

  /** Redraw the fuel bar to the given 0..1 fill (turns red when low). */
  setFuel(fraction: number): void {
    const f = CONFIG.hud.fuelBar;
    const frac = Phaser.Math.Clamp(fraction, 0, 1);
    this.fuelBar.clear();
    this.fuelBar.fillStyle(f.bgColor, 1);
    this.fuelBar.fillRect(f.x, f.y, f.width, f.height);
    this.fuelBar.fillStyle(frac <= f.lowFrac ? f.lowColor : f.color, 1);
    this.fuelBar.fillRect(f.x, f.y, f.width * frac, f.height);
    this.fuelBar.lineStyle(f.borderWidth, f.borderColor, 1);
    this.fuelBar.strokeRect(f.x, f.y, f.width, f.height);
  }

  /** Show the game-over overlay with the run summary; hides the live stats + bar. */
  showGameOver({ distanceM, timeS, score, cause }: GameOverStats): void {
    this.stats.setVisible(false);
    this.fuelBar.setVisible(false);
    this.cause.setText(cause);
    this.summary.setText([
      `Distance   ${Math.floor(distanceM)} m`,
      `Survived   ${timeS.toFixed(1)} s`,
      `Score      ${score}`,
    ]);
    this.overlay.setVisible(true);
    this.title.setVisible(true);
    this.cause.setVisible(true);
    this.summary.setVisible(true);
    this.prompt.setVisible(true);
  }
}
