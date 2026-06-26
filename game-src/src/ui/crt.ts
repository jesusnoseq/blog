import { CONFIG } from '../config';
import { storageGet, storageSet } from '../util/storage';

/**
 * crt — the optional scanline + vignette "CRT" overlay (default off).
 *
 * The effect itself is pure CSS in index.html (a fixed, pointer-events-none layer
 * with a scanline gradient + radial vignette), keyed off a single body class so it
 * costs nothing on the canvas/render path and can't affect gameplay. This module
 * just flips that class and remembers the preference in `localStorage` (best-effort
 * — it falls back to the default when storage is unavailable).
 */

/** Apply (or clear) the CRT overlay by toggling its body class. Safe pre-DOM. */
export function applyCrt(on: boolean): void {
  document.body?.classList.toggle(CONFIG.crt.bodyClass, on);
}

/** The saved CRT preference, or `CONFIG.crt.defaultOn` when none/unavailable. */
export function loadCrtPref(): boolean {
  const raw = storageGet(CONFIG.crt.storageKey);
  if (raw === null) return CONFIG.crt.defaultOn;
  return raw === '1';
}

/** Persist the CRT preference (no-op if storage is unavailable). */
export function saveCrtPref(on: boolean): void {
  storageSet(CONFIG.crt.storageKey, on ? '1' : '0');
}
