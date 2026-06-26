import Phaser from 'phaser';
import { CONFIG } from '../config';
import { SpriteFactory } from '../render/SpriteFactory';
import type { Rock } from './rockPatterns';
import type { FuelZone } from './FuelZone';

/**
 * Chunk — one fixed-height segment of the road, pooled and repositioned rather
 * than recreated.
 *
 * The corridor is centred on world x = 0 and constant-width, so every empty
 * chunk looks identical: the pixel-art road tile, rocks and fuel pads are stamped
 * into ONE per-chunk {@link Phaser.GameObjects.RenderTexture} in local coordinates
 * [0 .. chunkHeight], and recycling only moves the RT's y. The road tile tiles
 * seamlessly across chunk seams (its dash period divides chunkHeight).
 *
 * Rocks (static) are stamped into the RT; fuel pads need to animate (palette-cycle
 * pulse) so they're separate pooled Sprites the chunk owns and repositions.
 *
 * A chunk spans world Y [index*chunkHeight, (index+1)*chunkHeight]; "forward" is
 * up (-Y), so more-negative indices are further ahead.
 */
export class Chunk {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  /** RT-internal x of the corridor centre (RT spans the full canvas width). */
  private readonly halfRtWidth = CONFIG.width / 2;
  /** Pooled fuel-pad sprites (≥0 active per placement); hidden while parked. */
  private readonly fuelSprites: Phaser.GameObjects.Sprite[] = [];
  private fuelUsed = 0;
  index = 0;
  topY = 0;
  /** Obstacle rocks in local coordinates; the generator fills these per placement. */
  readonly rocks: Rock[] = [];
  /** Refuel pads in local coordinates; filled by the generator per placement. */
  readonly fuelZones: FuelZone[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprites: SpriteFactory,
  ) {
    this.rt = scene.add.renderTexture(0, 0, CONFIG.width, CONFIG.road.chunkHeight);
    this.rt.setOrigin(0.5, 0); // top-centred: world x=0 is the corridor centre
    this.rt.setDepth(CONFIG.road.depth);
  }

  /**
   * Position this chunk at the given index (and reveal it). Each placement gets a
   * fresh layout, so the RT is cleared and re-stamped with the road tile, prior
   * rocks/pads cleared; the generator then adds this placement's rocks and pads.
   */
  place(index: number): void {
    this.index = index;
    this.topY = index * CONFIG.road.chunkHeight;
    this.rt.setY(this.topY);
    this.rt.setVisible(true);
    this.rocks.length = 0;
    this.fuelZones.length = 0;
    this.fuelUsed = 0;
    for (const s of this.fuelSprites) s.setVisible(false);

    this.rt.clear();
    // Stamp the shared road tile, centred in the canvas-width RT.
    const offsetX = (CONFIG.width - CONFIG.road.width) / 2;
    this.rt.draw(SpriteFactory.ROAD_TILE, offsetX, 0);
  }

  /** Add a rock (local coords): record its collider and stamp its sprite. */
  addRock(x: number, y: number, r: number): void {
    this.rocks.push({ x, y, r });
    // Deterministic per-position variety so a recycled layout stamps identically.
    const variant = Math.abs(Math.round(x * 3 + y)) % CONFIG.render.rock.variants;
    const quarter = Math.abs(Math.round(x + y * 2)) % 4;
    const flip = Math.abs(Math.round(x * 5 + y * 7)) % 2 === 0;
    const key = this.sprites.ensureRock(variant, r);
    this.sprites.stampRock(this.rt, key, x + this.halfRtWidth, y, (quarter * Math.PI) / 2, flip);
  }

  /** Add a refuel pad (local coords, centre + size): record it and show a pulsing sprite. */
  addFuelZone(x: number, y: number, w: number, h: number): void {
    this.fuelZones.push({ x, y, w, h });
    const sprite = this.acquireFuelSprite();
    sprite.setPosition(x, this.topY + y);
    sprite.setVisible(true);
  }

  /** Hide while parked in the pool (RT + any active fuel sprites). */
  hide(): void {
    this.rt.setVisible(false);
    for (const s of this.fuelSprites) s.setVisible(false);
  }

  /** Get the next pooled fuel sprite (grow the pool if needed), playing the pulse. */
  private acquireFuelSprite(): Phaser.GameObjects.Sprite {
    let sprite = this.fuelSprites[this.fuelUsed];
    if (!sprite) {
      sprite = this.scene.add.sprite(0, 0, this.sprites.fuelFrame0Key());
      sprite.setDepth(CONFIG.road.depth + 2); // above the road, below the rockets
      sprite.play(SpriteFactory.FUEL_ANIM);
      this.fuelSprites.push(sprite);
    }
    this.fuelUsed++;
    return sprite;
  }
}
