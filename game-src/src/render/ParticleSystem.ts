import Phaser from 'phaser';
import { CONFIG } from '../config';

/** One pooled square pixel. Plain mutable struct — never allocated per frame. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sizeBlocks: number; // square edge in art blocks (×pixelScale px)
  ramp: readonly number[]; // palette colours stepped through over the lifetime
}

/**
 * ParticleSystem — pooled square-pixel particles (engine flame, side-thruster
 * plumes, explosion bursts).
 *
 * Everything lives in one fixed-size pool and is drawn each frame into a single
 * Graphics with opaque `fillRect`s. Particles fade by STEPPING DOWN their palette
 * ramp (hot → cool → dark) and shrinking in whole pixels — no alpha blur, matching
 * the chunky pixel-art look. Counts are hard-capped and `emit` drops when full, so
 * memory stays flat; `update` swap-removes dead particles in place with zero
 * allocation. Emission counts scale with dt, so behaviour is frame-rate independent.
 */
export class ParticleSystem {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scale = CONFIG.render.pixelScale;
  private readonly pool: Particle[] = [];
  private live = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.gfx = scene.add.graphics().setDepth(depth);
    for (let i = 0; i < CONFIG.particles.max; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, sizeBlocks: 1, ramp: [] });
    }
  }

  /** Drop all live particles (restart safety). */
  reset(): void {
    this.live = 0;
    this.gfx.clear();
  }

  /** Spawn one particle; silently dropped when the pool is full (hard cap). */
  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    sizeBlocks: number,
    ramp: readonly number[],
  ): void {
    if (this.live >= this.pool.length) return;
    const p = this.pool[this.live++];
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.age = 0;
    p.life = life;
    p.sizeBlocks = sizeBlocks;
    p.ramp = ramp;
  }

  /** dt-scaled spawn count with a probabilistic fractional remainder. */
  private count(rate: number, dt: number): number {
    const n = rate * dt;
    let c = Math.floor(n);
    if (Math.random() < n - c) c++;
    return c;
  }

  /** Main engine exhaust behind a rocket (rear = +Y, since "up" is forward). */
  emitEngine(x: number, y: number, vx: number, vy: number, intensity: number, dt: number): void {
    const e = CONFIG.particles.engine;
    const n = this.count(e.rate * intensity, dt);
    for (let k = 0; k < n; k++) {
      this.emit(
        x + rand(-3, 3),
        y + e.originY,
        vx * e.velCarry + rand(-e.spread, e.spread),
        vy * e.velCarry + e.speed + rand(-e.spread * 0.3, e.spread * 0.3),
        e.life,
        e.sizeBlocks,
        e.ramp,
      );
    }
  }

  /** Side-thruster plume on the exhaust side (`dirX` = exhaust direction = -sign(steer)). */
  emitSide(
    x: number,
    y: number,
    dirX: number,
    vx: number,
    vy: number,
    intensity: number,
    dt: number,
  ): void {
    const s = CONFIG.particles.side;
    const n = this.count(s.rate * intensity, dt);
    for (let k = 0; k < n; k++) {
      this.emit(
        x + dirX * s.originX + rand(-2, 2),
        y + rand(-4, 4),
        vx * s.velCarry + dirX * s.speed + rand(-s.spread * 0.3, s.spread * 0.3),
        vy * s.velCarry + rand(-s.spread, s.spread),
        s.life,
        s.sizeBlocks,
        s.ramp,
      );
    }
  }

  /** One-shot radial burst when a rocket is eliminated. */
  emitExplosion(x: number, y: number): void {
    const ex = CONFIG.particles.explosion;
    for (let k = 0; k < ex.count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * ex.speed;
      this.emit(
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        ex.life * (0.6 + 0.4 * Math.random()),
        ex.sizeBlocks,
        ex.ramp,
      );
    }
  }

  /** Age, integrate (with drag) and swap-remove dead particles. */
  update(dt: number): void {
    const decay = Math.exp(-CONFIG.particles.drag * dt);
    let i = 0;
    while (i < this.live) {
      const p = this.pool[i];
      p.age += dt;
      if (p.age >= p.life) {
        // Swap the dead particle to the end of the live range and shrink it.
        this.live--;
        this.pool[i] = this.pool[this.live];
        this.pool[this.live] = p;
        continue;
      }
      p.vx *= decay;
      p.vy *= decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      i++;
    }
  }

  /** Redraw all live particles as opaque, grid-snapped chunky squares. */
  draw(): void {
    const s = this.scale;
    this.gfx.clear();
    for (let i = 0; i < this.live; i++) {
      const p = this.pool[i];
      const frac = p.age / p.life;
      const color = p.ramp[Math.min(p.ramp.length - 1, Math.floor(frac * p.ramp.length))];
      const size = Math.max(1, Math.round(p.sizeBlocks * (1 - frac))) * s;
      // Snap the top-left to the pixel grid so squares stay crisp and aligned.
      const x = Math.round((p.x - size / 2) / s) * s;
      const y = Math.round((p.y - size / 2) / s) * s;
      this.gfx.fillStyle(color, 1);
      this.gfx.fillRect(x, y, size, size);
    }
  }
}

/** Uniform random in [a, b). */
function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
