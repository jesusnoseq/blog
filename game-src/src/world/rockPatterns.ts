import type Phaser from 'phaser';
import type { CONFIG } from '../config';

/** A rock in chunk-local coordinates: x ∈ [-half, half], y ∈ [0, height]. */
export interface Rock {
  x: number;
  y: number;
  r: number;
}

/** Chunk extents a pattern lays rocks within. */
export interface PatternDims {
  half: number; // half the corridor width — rocks stay inside ±half
  height: number; // chunk height (local y range)
}

type RockConfig = typeof CONFIG.rocks;

/**
 * A pattern fills one chunk with a readable rock arrangement. Patterns are pure:
 * given a seeded RNG they return chunk-local rocks, so the same chunk index always
 * produces the same layout. Geometry is derived from the corridor dimensions and
 * `CONFIG.rocks` — no magic numbers — and every rock is clamped on-road so the
 * boundary stays the only off-road hazard.
 */
export type RockPattern = (
  rng: Phaser.Math.RandomDataGenerator,
  dims: PatternDims,
  cfg: RockConfig,
) => Rock[];

/** Random radius in the configured range. */
function radius(rng: Phaser.Math.RandomDataGenerator, cfg: RockConfig): number {
  return rng.between(cfg.minRadius, cfg.maxRadius);
}

/** Keep a rock fully on-road: its centre stays ≥ r inside each boundary. */
function clampX(x: number, r: number, half: number): number {
  const limit = half - r;
  return Math.max(-limit, Math.min(limit, x));
}

/**
 * Slalom — rocks alternating off each side down the chunk, forcing a left-right
 * weave. Each rock sits one `minGap`-worth in from a boundary, leaving the rest of
 * the corridor open on the opposite side.
 */
const slalom: RockPattern = (rng, { half, height }, cfg) => {
  const rocks: Rock[] = [];
  const count = 3;
  // Offset from centre toward a boundary; the open lane on the far side is
  // (corridor − this − rock) wide, which we keep ≥ minGap.
  const offset = half - cfg.minGap / 2;
  let side = rng.pick([-1, 1]);
  for (let i = 0; i < count; i++) {
    const r = radius(rng, cfg);
    const y = (height * (i + 0.5)) / count;
    rocks.push({ x: clampX(side * offset, r, half), y, r });
    side *= -1;
  }
  return rocks;
};

/**
 * Chicane — a tight S: two staggered rocks on opposite sides near the middle that
 * kink the racing line without fully blocking either lane.
 */
const chicane: RockPattern = (rng, { half, height }, cfg) => {
  const offset = half - cfg.minGap;
  const side = rng.pick([-1, 1]);
  const r1 = radius(rng, cfg);
  const r2 = radius(rng, cfg);
  return [
    { x: clampX(side * offset, r1, half), y: height * 0.35, r: r1 },
    { x: clampX(-side * offset, r2, half), y: height * 0.65, r: r2 },
  ];
};

/**
 * Narrow passage — rocks pushing in from both edges leaving a single `minGap`
 * opening, placed at a randomly offset point across the corridor.
 */
const narrowPassage: RockPattern = (rng, { half, height }, cfg) => {
  const r1 = radius(rng, cfg);
  const r2 = radius(rng, cfg);
  // Centre of the gap, kept far enough from each wall that both rocks fit.
  const slack = half - cfg.minGap / 2 - Math.max(r1, r2);
  const gapCentre = rng.realInRange(-slack, slack);
  const y = height * 0.5;
  return [
    { x: clampX(gapCentre - cfg.minGap / 2 - r1, r1, half), y, r: r1 },
    { x: clampX(gapCentre + cfg.minGap / 2 + r2, r2, half), y, r: r2 },
  ];
};

/**
 * Cluster — a clump of rocks around a seeded point biased to one side, leaving the
 * opposite side of the corridor open to round.
 */
const cluster: RockPattern = (rng, { half, height }, cfg) => {
  const rocks: Rock[] = [];
  const count = rng.between(cfg.clusterMin, cfg.clusterMax);
  const side = rng.pick([-1, 1]);
  const centreX = side * (half - cfg.minGap);
  const centreY = height * 0.5;
  const spread = cfg.maxRadius * 1.6;
  for (let i = 0; i < count; i++) {
    const r = radius(rng, cfg);
    const x = clampX(centreX + rng.realInRange(-spread, spread), r, half);
    const y = centreY + rng.realInRange(-spread, spread);
    rocks.push({ x, y, r });
  }
  return rocks;
};

/** All patterns the generator picks from. */
export const PATTERNS: RockPattern[] = [slalom, chicane, narrowPassage, cluster];
