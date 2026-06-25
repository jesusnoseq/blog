import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Rock } from './rockPatterns';

/**
 * Chunk — one fixed-height segment of the road, pooled and repositioned rather
 * than recreated.
 *
 * The corridor is centred on world x = 0 and constant-width, so every empty
 * chunk looks identical: the static road art (asphalt, boundary lines, dashed
 * centre lane) is drawn once into a Graphics in *local* coordinates
 * [0 .. chunkHeight], and recycling only moves the Graphics' y. The dash period
 * divides chunkHeight evenly so lane marks tile seamlessly across chunk seams.
 *
 * A chunk spans world Y [index*chunkHeight, (index+1)*chunkHeight]; "forward" is
 * up (-Y), so more-negative indices are further ahead.
 */
export class Chunk {
  private readonly gfx: Phaser.GameObjects.Graphics;
  index = 0;
  topY = 0;
  /** Obstacle rocks in local coordinates; the generator fills these per placement. */
  readonly rocks: Rock[] = [];

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(CONFIG.road.depth);
  }

  /**
   * Position this chunk at the given index (and reveal it). Each placement gets a
   * fresh layout, so the static road art is redrawn and any prior rocks cleared;
   * the generator then adds this placement's rocks via {@link addRock}.
   */
  place(index: number): void {
    this.index = index;
    this.topY = index * CONFIG.road.chunkHeight;
    this.gfx.setY(this.topY);
    this.gfx.setVisible(true);
    this.rocks.length = 0;
    this.gfx.clear();
    this.drawRoad();
  }

  /** Add a rock (local coords) to this chunk: record its collider and draw it. */
  addRock(x: number, y: number, r: number): void {
    this.rocks.push({ x, y, r });
    const c = CONFIG.rocks;
    this.gfx.fillStyle(c.outlineColor, 1);
    this.gfx.fillCircle(x, y, r + c.outlineWidth);
    this.gfx.fillStyle(c.color, 1);
    this.gfx.fillCircle(x, y, r);
  }

  /** Hide while parked in the pool. */
  hide(): void {
    this.gfx.setVisible(false);
  }

  /**
   * Draw the static road art (asphalt, boundaries, dashed lane) in local
   * coordinates. Redrawn on each {@link place} so a recycled chunk starts from a
   * clean surface before its rocks (and later fuel pads) are layered on top.
   */
  private drawRoad(): void {
    const r = CONFIG.road;
    const half = r.width / 2;
    const h = r.chunkHeight;

    // Asphalt surface (void outside is the camera background showing through).
    this.gfx.fillStyle(r.asphaltColor, 1);
    this.gfx.fillRect(-half, 0, r.width, h);

    // Bright left/right boundary lines.
    this.gfx.fillStyle(r.boundaryColor, 1);
    this.gfx.fillRect(-half - r.boundaryWidth / 2, 0, r.boundaryWidth, h);
    this.gfx.fillRect(half - r.boundaryWidth / 2, 0, r.boundaryWidth, h);

    // Dashed centre lane. Period (dashLength + dashGap) divides chunkHeight.
    this.gfx.fillStyle(r.laneColor, 1);
    const period = r.dashLength + r.dashGap;
    for (let y = 0; y < h; y += period) {
      this.gfx.fillRect(-r.laneWidth / 2, y, r.laneWidth, r.dashLength);
    }
  }
}
