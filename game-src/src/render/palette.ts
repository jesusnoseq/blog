/**
 * PALETTE — the game's single, fixed retro colour set.
 *
 * A tight, vibrant 16-ish colour palette (saturated neons + a few darks for
 * outlines/shading). EVERY procedural sprite draws only from these colours so the
 * whole game stays cohesive (per docs/prompt.md §Graphics). Stored as 0xRRGGBB
 * numbers so CONFIG can point its colour fields straight at them; the SpriteFactory
 * converts to CSS strings via {@link hex} when painting offscreen canvases.
 *
 * No imports — safe to import from config.ts without a cycle.
 */
export const PALETTE = {
  // Darks — background void, asphalt, outlines.
  void: 0x0a0a12, // deep background outside the road
  asphalt: 0x15151f, // road surface
  asphaltDark: 0x101019, // dithered asphalt speckle (one step darker)
  lane: 0x3a3a52, // centre lane marks / muted trim
  outline: 0x07070c, // near-black 1px sprite outline

  // Brights — boundaries, fuel, UI accents.
  boundary: 0x49c5ff, // road boundary lines (also player hue)
  fuel: 0x1bd97b, // fuel pad fill
  fuelBright: 0x49ff8e, // fuel pad glow / healthy fuel bar

  // Rocks — chunky greys.
  rock: 0x6b6b7a,
  rockLight: 0x8d8da0,
  rockDark: 0x44444f,
  rockOutline: 0x2a2a34,

  // Flame / explosion ramp (used by sprites' nozzles now; particles later).
  white: 0xfdf7ff,
  yellow: 0xffe066,
  orange: 0xff8e49,
  red: 0xff5a6e,

  // Stars in the void.
  star: 0x6a6a9c,
  starBright: 0xb9c7ff,
} as const;

/** A 0xRRGGBB colour as a CSS `#rrggbb` string for canvas `fillStyle`. */
export function hex(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** Split a 0xRRGGBB colour into [r, g, b] (0..255). */
function rgb(n: number): [number, number, number] {
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Pack [r, g, b] (0..255, clamped) back into a 0xRRGGBB number. */
function pack(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Mix a colour toward white by `t` (0..1) — the top-edge highlight step. */
export function lighten(n: number, t: number): number {
  const [r, g, b] = rgb(n);
  return pack(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/** Mix a colour toward black by `t` (0..1) — the shaded/outline step. */
export function darken(n: number, t: number): number {
  const [r, g, b] = rgb(n);
  return pack(r * (1 - t), g * (1 - t), b * (1 - t));
}

/**
 * Distinct rocket body hues — one per rocket so the player and each AI are
 * tellable apart at a glance. The SpriteFactory derives each rocket's highlight
 * (lighten) and outline (darken) from its swatch for a cohesive shaded look.
 * Index 0 is the player's blue; the rest are the AI field.
 */
export const ROCKET_SWATCHES: readonly number[] = [
  PALETTE.boundary, // 0 — player: cyan/blue
  PALETTE.orange, // 1 — AI
  0xb96bff, // 2 — AI: purple
  PALETTE.fuelBright, // 3 — AI: green
  PALETTE.red, // 4 — spare
] as const;
