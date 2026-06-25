/**
 * FuelZone — a refuel pad in chunk-local coordinates.
 *
 * A pad is an axis-aligned rectangle centred at (x, y) with size (w, h). Stored on
 * its chunk and translated to world space by the chunk's topY for containment tests
 * (see `Road.isInFuelZone`). A plain rect for now; the graphics milestone gives pads
 * an animated glowing pixel-art look.
 */
export interface FuelZone {
  x: number; // centre x (local)
  y: number; // centre y (local, 0..chunkHeight)
  w: number; // full width
  h: number; // full height
}
