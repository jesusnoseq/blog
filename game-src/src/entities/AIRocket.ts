import type { InputState } from '../input/InputManager';
import { Rocket } from './Rocket';

/** A rock collider in world coordinates (the subset AI navigation needs). */
export interface RockHit {
  x: number;
  y: number;
  r: number;
}

/** A fuel pad's centre in world coordinates. */
export interface FuelTarget {
  x: number;
  y: number;
}

/** A rival rocket's centre in world coordinates (the subset combat needs). */
export interface RivalTarget {
  x: number;
  y: number;
}

/**
 * What an {@link AIRocket} can perceive of the world this frame. Assembled by the
 * scene from {@link Road} so the AI stays decoupled from Phaser/Road (mirrors how
 * {@link Rocket} avoids importing CONFIG). The arrays are shared across all AI in a
 * frame — read-only, never mutated here.
 */
export interface AIPerception {
  roadHalfWidth: number; // corridor extends to world x = ±this
  bottomEdge: number; // crush kill line (world Y); the rocket must stay above it
  rocks: ReadonlyArray<RockHit>; // active rock colliders, world coords
  fuelZones: ReadonlyArray<FuelTarget>; // active fuel-pad centres, world coords
  rivals: ReadonlyArray<RivalTarget>; // every *other* rocket's centre (combat targets)
}

/** Steering/navigation knobs. A subset of `CONFIG.ai` (the part `think` consumes). */
export interface AINavTuning {
  size: number; // body size px (its half-width sets the rock in-path test)
  lookahead: number; // px ahead (-Y) to scan for threatening rocks
  avoidClearance: number; // px lateral margin to clear a rock when dodging
  edgeMargin: number; // keep the steer target within ±(halfWidth - edgeMargin)
  steerGain: number; // (targetX - x) px → steerX before clamp
  refuelFraction: number; // tank below → 'refueling'
  resumeFraction: number; // tank above → 'racing'
  combatRange: number; // px to a rival within which it's worth firing the cone
  combatLevelBand: number; // max |Δy| to a rival (horizontal cone → stay level)
  combatEdgeSafety: number; // don't fire if thrusting away would shove self toward an edge
}

/** Mutually exclusive driving modes; hysteresis between them avoids dithering. */
export type AIState = 'racing' | 'refueling';

/**
 * AIRocket — an opponent that drives the course on its own.
 *
 * It reuses {@link Rocket}'s physics, fuel and collision wholesale; the only thing
 * it adds is a controller that synthesises an {@link InputState} each frame from an
 * {@link AIPerception} snapshot. A small `racing ⇄ refueling` state machine sets a
 * desired lane (`targetX`): centre while racing, biased to the nearest fuel pad when
 * low. Rock avoidance overrides the target to dodge the nearest threat ahead, then a
 * boundary clamp keeps it on-road (no self-elimination). It always thrusts forward —
 * progress, and staying ahead of the crush floor. Combat/push arrives later (M9).
 */
export class AIRocket extends Rocket {
  state: AIState = 'racing';

  /**
   * Decide this frame's movement intent. Pure: reads `this` + perception, mutates
   * only `this.state`. Sampled once per frame and reused across physics substeps,
   * exactly like the player's input.
   */
  think(p: AIPerception, cfg: AINavTuning): InputState {
    // State machine with hysteresis: only divert to refuel when there's a pad to
    // aim at, and don't flip back to racing until comfortably topped up.
    const frac = this.fuelFraction();
    if (this.state === 'racing') {
      if (frac < cfg.refuelFraction && p.fuelZones.length > 0) this.state = 'refueling';
    } else if (frac > cfg.resumeFraction) {
      this.state = 'racing';
    }

    // Desired lane: centre by default, or the nearest fuel pad's lane when refuelling.
    let targetX = 0;
    if (this.state === 'refueling') {
      const pad = this.nearestFuel(p.fuelZones);
      if (pad) targetX = pad.x;
    }

    // Rock avoidance: dodge the nearest threat ahead, overriding the lane target.
    const halfWidth = cfg.size / 2;
    const threat = this.nearestThreat(p.rocks, targetX, halfWidth, cfg);
    if (threat) {
      const limit = p.roadHalfWidth - cfg.edgeMargin;
      const offset = threat.r + halfWidth + cfg.avoidClearance;
      const left = threat.x - offset;
      const right = threat.x + offset;
      // Prefer the side that stays in bounds; if both fit, take the one nearer the
      // current position so the rocket commits to the smaller course change.
      const leftOk = left >= -limit;
      const rightOk = right <= limit;
      if (leftOk && (!rightOk || Math.abs(left - this.x) <= Math.abs(right - this.x))) {
        targetX = left;
      } else {
        targetX = right;
      }
    }

    // Keep the target on-road so steering never drives the rocket off the side.
    const limit = p.roadHalfWidth - cfg.edgeMargin;
    targetX = Math.max(-limit, Math.min(limit, targetX));

    // Proportional steer toward the target lane.
    let steerX = Math.max(-1, Math.min(1, (targetX - this.x) * cfg.steerGain));

    // Offensive push: when racing with a clear path (navigation/refuel keep
    // priority over combat), shove a nearby level rival with the exhaust cone.
    // The cone fires opposite the motion, so to aim it at a rival on side `s` we
    // thrust *away* (`steerX = -s`) — but only if that won't drive us off-road.
    if (this.state === 'racing' && !threat) {
      const rival = this.nearestRival(p.rivals, cfg);
      if (rival) {
        const s = Math.sign(rival.x - this.x);
        const fire = -s; // thrust away → exhaust (and its cone) points at the rival
        const safe =
          fire > 0 ? this.x < limit - cfg.combatEdgeSafety : this.x > -limit + cfg.combatEdgeSafety;
        if (s !== 0 && safe) steerX = fire;
      }
    }

    // Always drive forward: makes progress and stays ahead of the crush floor.
    return { thrust: 1, steerX };
  }

  /** Nearest fuel pad to the rocket's current position, or null if none. */
  private nearestFuel(zones: ReadonlyArray<FuelTarget>): FuelTarget | null {
    let best: FuelTarget | null = null;
    let bestSq = Infinity;
    for (const z of zones) {
      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        best = z;
      }
    }
    return best;
  }

  /**
   * Nearest rival worth firing the exhaust cone at: within `combatRange` and
   * roughly level (`|Δy| <= combatLevelBand`, since the cone is horizontal).
   * Returns null when no rival qualifies.
   */
  private nearestRival(rivals: ReadonlyArray<RivalTarget>, cfg: AINavTuning): RivalTarget | null {
    let best: RivalTarget | null = null;
    let bestSq = cfg.combatRange * cfg.combatRange;
    for (const r of rivals) {
      if (Math.abs(r.y - this.y) > cfg.combatLevelBand) continue;
      const dx = r.x - this.x;
      const dy = r.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        best = r;
      }
    }
    return best;
  }

  /**
   * Closest rock that actually threatens the intended path: ahead of the rocket
   * (forward is -Y), within `lookahead`, and laterally overlapping the lane the
   * rocket means to take (`targetX`). Returns null when the path is clear.
   */
  private nearestThreat(
    rocks: ReadonlyArray<RockHit>,
    targetX: number,
    halfWidth: number,
    cfg: AINavTuning,
  ): RockHit | null {
    let best: RockHit | null = null;
    let bestAhead = Infinity;
    for (const rock of rocks) {
      const ahead = this.y - rock.y; // >0 = rock is ahead (smaller Y)
      if (ahead <= 0 || ahead > cfg.lookahead) continue;
      if (Math.abs(rock.x - targetX) > rock.r + halfWidth + cfg.avoidClearance) continue;
      if (ahead < bestAhead) {
        bestAhead = ahead;
        best = rock;
      }
    }
    return best;
  }
}
