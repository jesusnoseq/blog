import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ScoreEntry } from './Leaderboard';

/** Live run stats shown top-left while playing. */
export interface HudStats {
  distanceM: number; // forward progress, metres
  speed: number; // current speed, metres per second
  score: number; // running score (survival + ranking blend)
  best: number; // best score on record (or this run's, whichever is higher)
  opponents: number; // AI rockets still alive
  eliminated: number; // opponents you've eliminated this run
}

/** Final run summary shown on the game-over overlay. */
export interface GameOverStats {
  distanceM: number;
  timeS: number; // survival time, seconds
  score: number;
  eliminated: number; // opponents eliminated this run
  cause: string; // why the run ended (e.g. "Off the road", "Out of fuel")
}

/** The leaderboard slice shown under the run summary on game-over. */
export interface GameOverBoard {
  entries: ScoreEntry[]; // top entries, high→low (already capped for display)
  rank: number; // this run's 1-based rank, or 0 if it didn't place
  saved: boolean; // false → storage unavailable, scores won't survive a reload
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
  private readonly boardTitle: Phaser.GameObjects.Text;
  private readonly board: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly dangerBand: Phaser.GameObjects.Rectangle;
  private readonly dangerText: Phaser.GameObjects.Text;
  private readonly dangerPulse: Phaser.Tweens.Tween;
  private dangerActive = false;
  private readonly startTitle: Phaser.GameObjects.Text;
  private readonly startControls: Phaser.GameObjects.Text;
  private readonly startPrompt: Phaser.GameObjects.Text;
  private readonly startPulse: Phaser.Tweens.Tween;

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
      .setOrigin(0.5,0.20)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    // High-score table under the run summary (heading + the top-N rows).
    this.boardTitle = scene.add
      .text(cx, cy + h.titleFontSize * 3, 'HIGH SCORES', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.causeColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.board = scene.add
      .text(cx, cy + h.titleFontSize * 3 + h.panelFontSize * 1.6, '', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.panelColor,
        align: 'left',
        lineSpacing: h.lineSpacing,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.prompt = scene.add
      .text(cx, CONFIG.height - h.padding, 'Press R to restart', {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: h.promptColor,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    // Fall-behind warning: a red band hugging the bottom edge with a label,
    // shown while the player nears the camera's bottom (the crush kill line).
    const d = h.danger;
    this.dangerBand = scene.add
      .rectangle(cx, CONFIG.height - d.bandHeight / 2, CONFIG.width, d.bandHeight, d.color, d.alpha)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.dangerText = scene.add
      .text(cx, CONFIG.height - d.bandHeight / 2, d.text, {
        fontFamily: h.fontFamily,
        fontSize: `${d.fontSize}px`,
        color: d.textColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    // One paused pulse tween reused across runs: fades the warning in/out while active.
    this.dangerPulse = scene.tweens.add({
      targets: [this.dangerBand, this.dangerText],
      alpha: { from: 1, to: 0.3 },
      duration: d.pulseMs,
      yoyo: true,
      repeat: -1,
      paused: true,
    });

    // Start screen — controls listing + launch prompt over the dimming overlay,
    // shown before the run begins and dismissed once the player thrusts forward.
    const s = h.startScreen;
    this.startTitle = scene.add
      .text(cx, cy - h.titleFontSize * 3, s.title, {
        fontFamily: h.fontFamily,
        fontSize: `${h.titleFontSize}px`,
        color: s.titleColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.startControls = scene.add
      .text(cx, cy, s.controls.join('\n'), {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: s.controlsColor,
        align: 'left',
        lineSpacing: h.lineSpacing,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    this.startPrompt = scene.add
      .text(cx, cy + h.titleFontSize * 3, s.prompt, {
        fontFamily: h.fontFamily,
        fontSize: `${h.panelFontSize}px`,
        color: s.promptColor,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(h.depth)
      .setVisible(false);

    // Blink the launch prompt while the start screen is up (paused otherwise).
    this.startPulse = scene.tweens.add({
      targets: this.startPrompt,
      alpha: { from: 1, to: 0.3 },
      duration: s.pulseMs,
      yoyo: true,
      repeat: -1,
      paused: true,
    });
  }

  /** Show the start-screen controls overlay; hides the live stats + fuel bar. */
  showControls(): void {
    this.stats.setVisible(false);
    this.fuelBar.setVisible(false);
    this.overlay.setVisible(true);
    this.startTitle.setVisible(true);
    this.startControls.setVisible(true);
    this.startPrompt.setVisible(true);
    this.startPulse.restart();
  }

  /** Dismiss the start-screen overlay and reveal the live HUD (called on launch). */
  hideControls(): void {
    this.startPulse.pause();
    this.overlay.setVisible(false);
    this.startTitle.setVisible(false);
    this.startControls.setVisible(false);
    this.startPrompt.setVisible(false);
    this.stats.setVisible(true);
    this.fuelBar.setVisible(true);
  }

  /** Refresh the live stats readout. */
  setStats({ distanceM, speed, score, best, opponents, eliminated }: HudStats): void {
    this.stats.setText([
      `DIST  ${Math.floor(distanceM)} m`,
      `SPEED ${Math.round(speed)} m/s`,
      `SCORE ${score}`,
      `BEST  ${best}`,
      `OPP   ${opponents}`,
      `KILLS ${eliminated}`,
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

  /**
   * Toggle the fall-behind warning. Idempotent — the pulse tween is only
   * started/stopped on a state change, so calling this every frame is cheap.
   */
  setDanger(active: boolean): void {
    if (active === this.dangerActive) return;
    this.dangerActive = active;
    this.dangerBand.setVisible(active);
    this.dangerText.setVisible(active);
    if (active) {
      this.dangerPulse.restart();
    } else {
      this.dangerPulse.pause();
    }
  }

  /** Show the game-over overlay with the run summary + high scores; hides the live HUD. */
  showGameOver(
    { distanceM, timeS, score, eliminated, cause }: GameOverStats,
    board: GameOverBoard,
  ): void {
    this.setDanger(false);
    this.stats.setVisible(false);
    this.fuelBar.setVisible(false);
    this.cause.setText(cause);
    this.summary.setText([
      `Distance   ${Math.floor(distanceM)} m`,
      `Survived   ${timeS.toFixed(1)} s`,
      `Eliminated ${eliminated}`,
      `Score      ${score}`,
    ]);
    this.boardTitle.setText(board.saved ? 'HIGH SCORES' : 'HIGH SCORES (not saved)');
    this.board.setText(this.formatBoard(board));
    this.overlay.setVisible(true);
    this.title.setVisible(true);
    this.cause.setVisible(true);
    this.summary.setVisible(true);
    this.boardTitle.setVisible(true);
    this.board.setVisible(true);
    this.prompt.setVisible(true);
  }

  /**
   * Format the high-score rows as monospace columns (rank · score · distance).
   * The just-finished run is flagged with a leading '▶' so the player can spot
   * their placement; an empty board reads as a single placeholder line.
   */
  private formatBoard({ entries, rank }: GameOverBoard): string[] {
    if (entries.length === 0) return ['  no scores yet — finish a run!'];
    return entries.map((e, i) => {
      const here = i + 1 === rank ? '▶' : ' ';
      const place = `${i + 1}`.padStart(2, ' ');
      const pts = `${e.score}`.padStart(7, ' ');
      return `${here}${place}. ${pts}   ${Math.floor(e.distanceM)} m`;
    });
  }
}
