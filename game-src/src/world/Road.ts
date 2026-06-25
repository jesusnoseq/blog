import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Chunk } from './Chunk';
import { ProceduralGenerator } from './ProceduralGenerator';

/**
 * Road — the infinite vertical corridor.
 *
 * The world is static; the camera moves up (-Y) through it, which is what makes
 * the road appear to scroll. Chunks live at fixed world positions, identified by
 * integer index, and are recycled through an object pool when they fall outside
 * the camera view plus margins. The active set spans a constant index range, so
 * chunk count (and total objects ever created) stays bounded.
 */
export class Road {
  private readonly scene: Phaser.Scene;
  private readonly generator = new ProceduralGenerator();
  private readonly active = new Map<number, Chunk>();
  private readonly pool: Chunk[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Ensure chunks exist across the camera's visible range (plus ahead/behind
   * margins) and recycle any that have scrolled out of it.
   */
  update(view: Phaser.Geom.Rectangle): void {
    const { chunkHeight, aheadChunks, behindChunks } = CONFIG.road;

    // "ahead" is up (-Y, smaller index); "behind" is down (+Y, larger index).
    const minIndex = Math.floor(view.top / chunkHeight) - aheadChunks;
    const maxIndex = Math.floor(view.bottom / chunkHeight) + behindChunks;

    // Spawn any missing chunks in range.
    for (let i = minIndex; i <= maxIndex; i++) {
      if (!this.active.has(i)) {
        const chunk = this.acquire();
        chunk.place(i);
        this.generator.populate(chunk, i);
        this.active.set(i, chunk);
      }
    }

    // Recycle chunks that have left the range.
    for (const [i, chunk] of this.active) {
      if (i < minIndex || i > maxIndex) {
        this.release(chunk);
        this.active.delete(i);
      }
    }
  }

  /**
   * Half the corridor width — boundary lines sit at world x = ±halfWidth. The
   * corridor is centred on x = 0, so this is all the geometry an off-road test
   * needs; a future curving road would localise the change here.
   */
  get halfWidth(): number {
    return CONFIG.road.width / 2;
  }

  /** True when world x is outside the corridor (its centre has crossed a boundary). */
  isOffRoad(x: number): boolean {
    return Math.abs(x) > this.halfWidth;
  }

  /**
   * Visit every active rock in world coordinates. The active set is only a handful
   * of chunks with a few rocks each, so a flat scan is cheap — no spatial index
   * needed yet. Rocks are stored chunk-local, so each is offset by its chunk topY.
   */
  forEachRock(cb: (worldX: number, worldY: number, r: number) => void): void {
    for (const chunk of this.active.values()) {
      for (const rock of chunk.rocks) {
        cb(rock.x, chunk.topY + rock.y, rock.r);
      }
    }
  }

  /** Number of live chunks — should stay a small constant (bounded-memory check). */
  get activeCount(): number {
    return this.active.size;
  }

  get poolSize(): number {
    return this.pool.length;
  }

  private acquire(): Chunk {
    return this.pool.pop() ?? new Chunk(this.scene);
  }

  private release(chunk: Chunk): void {
    chunk.hide();
    this.pool.push(chunk);
  }
}
