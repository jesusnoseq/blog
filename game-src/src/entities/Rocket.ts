import type { InputState } from '../input/InputManager';

/**
 * Per-rocket physics tuning. Mirrors the shape of `CONFIG.physics` so the scene
 * can pass it straight through; kept as a parameter (not imported) so the class
 * stays decoupled and each rocket type can be tuned independently later.
 */
export interface RocketTuning {
  forwardAccel: number; // px/s^2 applied by main engine (Up/W)
  lateralAccel: number; // px/s^2 applied by side thrusters (A/D)
  longitudinalDrag: number; // 1/s exponential decay on forward (Y) velocity
  lateralDrag: number; // 1/s exponential decay on lateral (X) velocity
  maxSpeed: number; // px/s clamp on velocity magnitude
}

/** Collision response tuning. Mirrors the shape of `CONFIG.collision`. */
export interface CollisionResponse {
  speedLoss: number; // fraction of velocity kept on impact (0..1)
  knockback: number; // px/s outward impulse along the contact normal
}

/** Fuel burn rates. A subset of `CONFIG.fuel` (the part `step` consumes). */
export interface FuelTuning {
  mainDrain: number; // units/s at full forward thrust
  sideDrain: number; // units/s at full lateral thrust
}

/**
 * Rocket — engine-agnostic physics body shared by the player and AI.
 *
 * Pure state + integration, no Phaser display object: the scene owns the visual
 * and reads back interpolated position. "Forward" is up = decreasing world Y, so
 * thrust pushes -Y. Drag is applied separately per axis (longitudinal vs lateral)
 * which is what gives the arcade feel — keep forward momentum, settle sideways
 * slides. Integration is frame-rate independent; call `step` at a fixed dt.
 */
export class Rocket {
  /** Current world position. */
  x: number;
  y: number;
  /** Position at the start of the last fixed step, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Velocity vector (px/s). */
  vx = 0;
  vy = 0;
  /** Fuel level and capacity. Set by the owner; 0 = dead engine (no thrust). */
  fuel = 0;
  maxFuel = 0;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
  }

  /**
   * Advance the simulation by one fixed step of `dt` seconds. Thrust intent only
   * takes effect while the tank has fuel ("dead engine" otherwise — the rocket
   * coasts on drag), and acting on it burns fuel at the configured rates.
   */
  step(dt: number, input: InputState, tuning: RocketTuning, fuel: FuelTuning): void {
    this.prevX = this.x;
    this.prevY = this.y;

    // Dead engine when out of fuel: thrusters produce no force.
    const live = this.fuel > 0;
    const thrust = live ? input.thrust : 0;
    const steerX = live ? input.steerX : 0;

    // Acceleration from input intent. Forward thrust is up (-Y).
    const ax = steerX * tuning.lateralAccel;
    const ay = -thrust * tuning.forwardAccel;

    // Burn fuel for the force actually commanded this step.
    if (live) {
      const burn = (thrust * fuel.mainDrain + Math.abs(steerX) * fuel.sideDrain) * dt;
      this.fuel = Math.max(0, this.fuel - burn);
    }

    // Integrate velocity.
    this.vx += ax * dt;
    this.vy += ay * dt;

    // Separate per-axis drag (exponential decay, frame-rate independent).
    this.vx *= Math.exp(-tuning.lateralDrag * dt);
    this.vy *= Math.exp(-tuning.longitudinalDrag * dt);

    // Clamp velocity magnitude to max speed.
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > tuning.maxSpeed) {
      const scale = tuning.maxSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    // Integrate position.
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /**
   * Resolve a circle-vs-circle hit against a rock at (rx, ry) with radius `rr`,
   * this rocket modelled as a circle of `selfR`. On overlap: push the rocket out
   * along the contact normal (moving `prev` too so render interpolation doesn't
   * fight the correction), bleed speed by `speedLoss`, then add a `knockback`
   * impulse outward. No overlap is a no-op. Returns whether a hit occurred — the
   * hook for damage/particles later. Shared by player and AI rockets.
   */
  resolveRockCollision(
    rx: number,
    ry: number,
    rr: number,
    selfR: number,
    response: CollisionResponse,
  ): boolean {
    const dx = this.x - rx;
    const dy = this.y - ry;
    const minDist = selfR + rr;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return false;

    const dist = Math.sqrt(distSq);
    // Exactly concentric (dist 0): fall back to a deterministic forward (-Y) normal.
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : -1;

    // Separate out of the rock; shift prev too so interpolation stays consistent.
    const overlap = minDist - dist;
    this.x += nx * overlap;
    this.y += ny * overlap;
    this.prevX += nx * overlap;
    this.prevY += ny * overlap;

    // Bleed speed, then bounce outward.
    this.vx = this.vx * response.speedLoss + nx * response.knockback;
    this.vy = this.vy * response.speedLoss + ny * response.knockback;
    return true;
  }

  /**
   * Resolve a circle-vs-circle hit against another rocket. Unlike
   * {@link resolveRockCollision} (static rock), both bodies are dynamic: the
   * overlap is split evenly and each is pushed half out along the contact normal
   * (prev shifted too so interpolation stays consistent), then each bleeds speed by
   * `speedLoss` and takes a `knockback` impulse in opposite directions — an arcade
   * bump that lets rockets shoulder-check each other. No overlap is a no-op.
   * Returns whether a hit occurred. Call once per unordered pair.
   */
  resolveRocketCollision(
    other: Rocket,
    selfR: number,
    otherR: number,
    response: CollisionResponse,
  ): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const minDist = selfR + otherR;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return false;

    const dist = Math.sqrt(distSq);
    // Exactly concentric (dist 0): fall back to a deterministic sideways normal so
    // the pair still separates.
    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;

    // Split the overlap: push each body half out along the normal (and its prev).
    const half = (minDist - dist) / 2;
    this.x += nx * half;
    this.y += ny * half;
    this.prevX += nx * half;
    this.prevY += ny * half;
    other.x -= nx * half;
    other.y -= ny * half;
    other.prevX -= nx * half;
    other.prevY -= ny * half;

    // Bleed speed, then bump apart in opposite directions.
    this.vx = this.vx * response.speedLoss + nx * response.knockback;
    this.vy = this.vy * response.speedLoss + ny * response.knockback;
    other.vx = other.vx * response.speedLoss - nx * response.knockback;
    other.vy = other.vy * response.speedLoss - ny * response.knockback;
    return true;
  }

  /** Add fuel (e.g. from a zone), capped at the tank's capacity. */
  refuel(amount: number): void {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  /** Tank level as a 0..1 fraction (0 when uninitialised). */
  fuelFraction(): number {
    return this.maxFuel > 0 ? this.fuel / this.maxFuel : 0;
  }

  /** Position lerped from prev → current by `alpha` (0..1) for smooth rendering. */
  getRenderX(alpha: number): number {
    return this.prevX + (this.x - this.prevX) * alpha;
  }

  getRenderY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha;
  }
}
