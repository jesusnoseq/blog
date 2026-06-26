import Phaser from 'phaser';
import { CONFIG } from '../config';
import { PALETTE, ROCKET_SWATCHES, hex, lighten, darken } from './palette';

/**
 * SpriteFactory — procedural pixel-art texture generation, cached.
 *
 * Every sprite is painted ONCE onto an offscreen canvas at final size using
 * chunky `pixelScale`-sized blocks (each art "pixel" is a solid block), then
 * registered as a Phaser texture and cached by key. Nothing is regenerated per
 * frame: rockets are keyed by swatch, rocks by variant+radius, and the road /
 * void / fuel-pad textures are built once up front. With the global `pixelArt`
 * NEAREST filter, the chunky blocks stay crisp at any window scale.
 *
 * Rocks are stamped into each chunk's RenderTexture via {@link stampRock} (a
 * reused, off-display scratch Image carries the rotation/flip), so the pooled
 * one-display-object-per-chunk design is preserved.
 */
export class SpriteFactory {
  private readonly scene: Phaser.Scene;
  private readonly scale = CONFIG.render.pixelScale;
  /** Off-display image reused to stamp rotated/flipped rocks into chunk RTs. */
  private readonly stamp: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Off-display scratch image reused for stamping; '__DEFAULT' is the engine's
    // always-present boot texture (real texture is set per stamp).
    this.stamp = scene.make.image({ key: '__DEFAULT', add: false });

    // Static world textures + every rocket are generated up front so the first
    // frame already has them (no spawn-time hitch); rocks are lazy per radius.
    this.ensureRoadTile();
    this.ensureVoidTile();
    this.ensureFuelAnim();
    for (let i = 0; i < ROCKET_SWATCHES.length; i++) this.ensureRocket(i);
  }

  // --- Texture keys -------------------------------------------------------

  static readonly ROAD_TILE = 'sprite:road';
  static readonly VOID_TILE = 'sprite:void';

  rocketKey(swatch: number): string {
    return `sprite:rocket:${swatch}`;
  }

  rockKey(variant: number, radius: number): string {
    return `sprite:rock:${variant}:${Math.round(radius)}`;
  }

  // --- Low-level canvas helpers ------------------------------------------

  /** Paint `key` once via `draw` on a fresh w×h canvas; cached on re-call. */
  private paint(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
    if (this.scene.textures.exists(key)) return key;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    this.scene.textures.addCanvas(key, canvas);
    return key;
  }

  /** Fill one art-pixel block (grid cell → scale×scale screen px). */
  private cell(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: number, alpha = 1): void {
    const s = this.scale;
    ctx.fillStyle = alpha >= 1 ? hex(color) : this.rgba(color, alpha);
    ctx.fillRect(gx * s, gy * s, s, s);
  }

  private rgba(color: number, alpha: number): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Paint a [y][x] grid of colours (−1 = transparent) as chunky blocks. */
  private paintGrid(key: string, cells: number[][]): string {
    const h = cells.length;
    const w = cells[0].length;
    return this.paint(key, w * this.scale, h * this.scale, (ctx) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cells[y][x] >= 0) this.cell(ctx, x, y, cells[y][x]);
        }
      }
    });
  }

  /** Wrap a filled silhouette with a 1-cell outline (empties touching a fill). */
  private addOutline(cells: number[][], color: number): void {
    const h = cells.length;
    const w = cells[0].length;
    const edges: Array<[number, number]> = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x] >= 0) continue;
        const near =
          (y > 0 && cells[y - 1][x] >= 0) ||
          (y < h - 1 && cells[y + 1][x] >= 0) ||
          (x > 0 && cells[y][x - 1] >= 0) ||
          (x < w - 1 && cells[y][x + 1] >= 0);
        if (near) edges.push([x, y]);
      }
    }
    for (const [x, y] of edges) cells[y][x] = color;
  }

  private grid(w: number, h: number): number[][] {
    return Array.from({ length: h }, () => new Array<number>(w).fill(-1));
  }

  // --- Rocket -------------------------------------------------------------

  /**
   * A retro rocket facing up, generated as a left half + mirror for symmetry,
   * with a 1px dark outline and a lighter top-edge highlight. Body colour is the
   * rocket's distinct palette swatch (player vs each AI), so they're tellable
   * apart. Cached by swatch.
   */
  ensureRocket(swatch: number): string {
    const key = this.rocketKey(swatch);
    if (this.scene.textures.exists(key)) return key;

    const r = CONFIG.render.rocket;
    const W = r.gridW + 2; // +1 margin each side for the outline
    const H = r.gridH + 2;
    const cx = (r.gridW - 1) / 2 + 1; // body centre column (margin-shifted)
    const base = ROCKET_SWATCHES[swatch % ROCKET_SWATCHES.length];
    const mid = base;
    const hi = lighten(base, 0.5);
    const glass = lighten(base, 0.75);
    const fin = darken(base, 0.2);
    const nozzle = PALETTE.rockDark;
    const cells = this.grid(W, H);

    // Hull half-widths per body row (1 = just the centre column → width 1).
    const hull = [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2];
    for (let row = 0; row < hull.length; row++) {
      const y = row + 1;
      const hw = hull[row];
      for (let c = cx - hw + 1; c <= cx; c++) {
        cells[y][c] = mid;
        cells[y][2 * cx - c] = mid; // mirror to the right
      }
    }
    // Fins flare out near the base.
    for (const y of [11, 12]) {
      for (const c of [1, 2]) {
        cells[y][c] = fin;
        cells[y][W - 1 - c] = fin;
      }
    }
    // Cockpit glass (bright patch high on the hull).
    for (const y of [4, 5]) for (const c of [cx - 1, cx, cx + 1]) cells[y][c] = glass;
    // Engine nozzle at the tail.
    for (const c of [cx - 1, cx, cx + 1]) cells[H - 2][c] = nozzle;
    // Top-edge highlight: topmost body cell of every column catches the light.
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (cells[y][x] === mid) {
          cells[y][x] = hi;
          break;
        }
      }
    }

    this.addOutline(cells, PALETTE.outline);
    return this.paintGrid(key, cells);
  }

  // --- Rocks --------------------------------------------------------------

  /**
   * A chunky outlined boulder sized to `radius`, lumpiness/speckles seeded by
   * `variant` (so the few variants stay distinct and stable). Cached by
   * variant+radius — radius is quantised by the chunk grid, so the set is small.
   */
  ensureRock(variant: number, radius: number): string {
    const key = this.rockKey(variant, radius);
    if (this.scene.textures.exists(key)) return key;

    const ar = Math.max(2, Math.round(radius / this.scale));
    const size = ar * 2 + 3; // diameter + 1-cell margin each side for the outline
    const c = ar + 1.5; // centre (cell coords)
    const rng = mulberry32(0x9e37 + variant * 2654435761);
    // A couple of seeded sine lobes give each variant a lumpy silhouette.
    const ph1 = rng() * Math.PI * 2;
    const ph2 = rng() * Math.PI * 2;
    const cells = this.grid(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c + 0.5;
        const dy = y - c + 0.5;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const lobe = 1 + 0.16 * Math.sin(ang * 3 + ph1) + 0.1 * Math.sin(ang * 5 + ph2);
        if (dist > ar * lobe) continue;
        // Shade: lit on top, darker below, with sparse speckles for texture.
        let color: number = PALETTE.rock;
        if (dy < -ar * 0.25) color = PALETTE.rockLight;
        else if (dy > ar * 0.3) color = PALETTE.rockDark;
        if (rng() < 0.12) color = PALETTE.rockDark;
        cells[y][x] = color;
      }
    }

    this.addOutline(cells, PALETTE.rockOutline);
    return this.paintGrid(key, cells);
  }

  // --- Road & void --------------------------------------------------------

  /** One chunk-sized road tile: dithered asphalt, boundary lines, dashed lane. */
  private ensureRoadTile(): string {
    const road = CONFIG.road;
    const s = this.scale;
    const aw = Math.round(road.width / s);
    const ah = Math.round(road.chunkHeight / s);
    const cells = this.grid(aw, ah);
    const bw = Math.max(1, Math.round(road.boundaryWidth / s)); // boundary thickness (cells)
    const lane = Math.max(1, Math.round(road.laneWidth / s));
    const dash = Math.round(road.dashLength / s);
    const period = Math.round((road.dashLength + road.dashGap) / s);
    const cx = Math.floor(aw / 2);

    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        // Dithered asphalt base.
        cells[y][x] = (x * 7 + y * 13) % 5 === 0 ? PALETTE.asphaltDark : PALETTE.asphalt;
      }
      // Bright boundary lines hugging both edges.
      for (let b = 0; b < bw; b++) {
        cells[y][b] = PALETTE.boundary;
        cells[y][aw - 1 - b] = PALETTE.boundary;
      }
      // Dashed centre lane.
      if (y % period < dash) {
        for (let l = 0; l < lane; l++) cells[y][cx - Math.floor(lane / 2) + l] = PALETTE.lane;
      }
    }
    return this.paintGrid(SpriteFactory.ROAD_TILE, cells);
  }

  /** Small tiling void texture: dark base with a sprinkle of palette stars. */
  private ensureVoidTile(): string {
    const v = CONFIG.render.void;
    const s = this.scale;
    const a = Math.round(v.tileSize / s);
    const cells = this.grid(a, a);
    for (let y = 0; y < a; y++) for (let x = 0; x < a; x++) cells[y][x] = PALETTE.void;
    const rng = mulberry32(0x51ed);
    for (let i = 0; i < v.starCount; i++) {
      const x = Math.floor(rng() * a);
      const y = Math.floor(rng() * a);
      cells[y][x] = rng() < 0.3 ? PALETTE.starBright : PALETTE.star;
    }
    return this.paintGrid(SpriteFactory.VOID_TILE, cells);
  }

  // --- Fuel pad (animated palette-cycle pulse) ----------------------------

  static readonly FUEL_ANIM = 'fuelPulse';

  /** The fuel-pad sprite's first-frame texture key (a sprite plays FUEL_ANIM). */
  fuelFrame0Key(): string {
    return 'sprite:fuel:0';
  }

  /** Generate N brightness frames of the pad and the looping pulse animation. */
  private ensureFuelAnim(): void {
    const fp = CONFIG.render.fuelPad;
    const keys: string[] = [];
    for (let i = 0; i < fp.frames; i++) keys.push(this.ensureFuelFrame(i, fp.frames));
    if (!this.scene.anims.exists(SpriteFactory.FUEL_ANIM)) {
      this.scene.anims.create({
        key: SpriteFactory.FUEL_ANIM,
        frames: keys.map((key) => ({ key })),
        frameRate: 1000 / fp.frameRateMs,
        repeat: -1,
      });
    }
  }

  private ensureFuelFrame(i: number, frames: number): string {
    const key = `sprite:fuel:${i}`;
    if (this.scene.textures.exists(key)) return key;

    const z = CONFIG.fuelZone;
    const s = this.scale;
    const aw = Math.round(z.width / s);
    const ah = Math.round(z.height / s);
    // Smooth periodic brightness (frame 0 dim → mid bright → back) so the loop
    // reads as a glow pulse without a seam.
    const t = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frames);
    const border = lighten(PALETTE.fuelBright, 0.15 * t);
    const fill = lighten(PALETTE.fuel, 0.2 * t);
    const fillA = 0.14 + 0.16 * t;
    const cells = this.grid(aw, ah);

    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        const edge = x < 2 || x >= aw - 2 || y < 2 || y >= ah - 2;
        if (edge) cells[y][x] = border;
        else if (y % 6 < 2) cells[y][x] = fill; // runway dashes inside the pad
      }
    }
    // Interior dashes get the pulsing translucency; border stays solid.
    return this.paint(key, aw * s, ah * s, (ctx) => {
      for (let y = 0; y < ah; y++) {
        for (let x = 0; x < aw; x++) {
          if (cells[y][x] < 0) continue;
          const edge = x < 2 || x >= aw - 2 || y < 2 || y >= ah - 2;
          this.cell(ctx, x, y, cells[y][x], edge ? 0.95 : fillA);
        }
      }
    });
  }

  // --- Stamping -----------------------------------------------------------

  /**
   * Stamp a rock texture into a chunk's RenderTexture at (x, y) (RT-internal,
   * origin-centred) with an axis-aligned rotation (multiples of 90° keep pixels
   * crisp) and optional horizontal flip, via the reused off-display scratch image.
   */
  stampRock(
    rt: Phaser.GameObjects.RenderTexture,
    key: string,
    x: number,
    y: number,
    rot: number,
    flipX: boolean,
  ): void {
    const s = this.stamp;
    s.setTexture(key);
    s.setOrigin(0.5);
    s.setFlipX(flipX);
    s.setRotation(rot);
    rt.draw(s, x, y);
  }
}

/** Tiny deterministic PRNG (mulberry32) — seeds the boulder/star variety. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
