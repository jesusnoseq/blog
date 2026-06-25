import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Chunk } from './Chunk';
import { PATTERNS } from './rockPatterns';

/**
 * ProceduralGenerator — decides what fills each road chunk.
 *
 * For now it produces either an empty chunk or a single rock pattern, chosen by a
 * seeded RNG keyed on the chunk **index** so layouts are deterministic and stable
 * across recycling. The starting chunks are forced empty for a fair launch. This is
 * the seam the difficulty milestone extends to fully weighted empty/rock/fuel
 * generation (≈80/10/10) — the per-index reseeding is already in place here.
 */
export class ProceduralGenerator {
  // Reused across chunks; reseeded per index so we never allocate per frame.
  private readonly rng = new Phaser.Math.RandomDataGenerator();

  /** Fill a chunk placed at `index`. */
  populate(chunk: Chunk, index: number): void {
    this.rng.sow([String(index)]);

    if (this.isSafeStart(index) || this.rng.frac() > CONFIG.rocks.spawnChance) {
      return; // empty road
    }

    const pattern = this.rng.pick(PATTERNS);
    const dims = {
      half: CONFIG.road.width / 2,
      height: CONFIG.road.chunkHeight,
    };
    for (const rock of pattern(this.rng, dims, CONFIG.rocks)) {
      chunk.addRock(rock.x, rock.y, rock.r);
    }
  }

  /**
   * The spawn chunk (index 0) and the first `safeAheadChunks` ahead of it (forward
   * is -Y → negative indices) stay empty so the run never opens on an unavoidable
   * rock.
   */
  private isSafeStart(index: number): boolean {
    return index <= 0 && index >= -CONFIG.rocks.safeAheadChunks;
  }
}
