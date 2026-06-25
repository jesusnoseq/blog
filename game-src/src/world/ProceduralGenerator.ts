import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Chunk } from './Chunk';
import { PATTERNS } from './rockPatterns';

/**
 * ProceduralGenerator — decides what fills each road chunk.
 *
 * On a fixed periodic cadence a chunk gets a refuel pad (so pads are always
 * reachable); independently it may also get a rock pattern, chosen by a seeded RNG
 * keyed on the chunk **index** — so rocks can share a chunk with (and sit over) a
 * pad, and layouts are deterministic and stable across recycling. The starting
 * chunks are forced empty for a fair launch. This is the seam the difficulty
 * milestone extends to fully weighted empty/rock/fuel generation (≈80/10/10); the
 * per-index reseeding is already in place here.
 */
export class ProceduralGenerator {
  // Reused across chunks; reseeded per index so we never allocate per frame.
  private readonly rng = new Phaser.Math.RandomDataGenerator();

  /** Fill a chunk placed at `index`. */
  populate(chunk: Chunk, index: number): void {
    this.rng.sow([String(index)]);

    if (this.isSafeStart(index)) {
      return; // clear launch area
    }

    // Periodic refuel pad. Drawn first so any rocks land on top of it — rocks may
    // share the chunk (and overlap the pad), so this does not short-circuit.
    if (this.isFuelZone(index)) {
      const z = CONFIG.fuelZone;
      chunk.addFuelZone(0, CONFIG.road.chunkHeight / 2, z.width, z.height);
    }

    if (this.rng.frac() > CONFIG.rocks.spawnChance) {
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

  /** A pad every `fuelZone.interval` chunks ahead (negative indices). */
  private isFuelZone(index: number): boolean {
    return index < 0 && index % CONFIG.fuelZone.interval === 0;
  }
}
