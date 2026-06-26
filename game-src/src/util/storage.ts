/**
 * storage — a defensive wrapper around `localStorage`.
 *
 * Persistence is a nice-to-have, never a requirement: the game must run when
 * storage is unavailable (private-browsing quirks, disabled cookies, a sandboxed
 * iframe with no `allow-same-origin`, or a full quota). Every access is guarded
 * and degrades to a no-op that returns `null`/`false` rather than throwing, so
 * callers can treat "couldn't read" and "nothing stored" identically.
 *
 * Availability is probed once (write-then-remove a sentinel) and cached — some
 * browsers throw only on *write*, so a read-only probe wouldn't catch them.
 */
let available: boolean | undefined;

function isAvailable(): boolean {
  if (available !== undefined) return available;
  try {
    const probe = '__rr_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** True if `localStorage` can be read and written this session. */
export function storageAvailable(): boolean {
  return isAvailable();
}

/** Read a key, or `null` if missing or storage is unavailable. Never throws. */
export function storageGet(key: string): string | null {
  if (!isAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write a key. Returns whether it persisted (false if unavailable/quota). Never throws. */
export function storageSet(key: string, value: string): boolean {
  if (!isAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
