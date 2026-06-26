import { CONFIG } from '../config';
import { storageGet, storageSet, storageAvailable } from '../util/storage';

/** One finished-run record kept on the local leaderboard. */
export interface ScoreEntry {
  score: number;
  distanceM: number; // forward progress, metres (shown alongside the score)
  date: string; // ISO calendar day the run finished (YYYY-MM-DD), '' if unknown
}

/**
 * Leaderboard — the local top-N high-score table, persisted to `localStorage`.
 *
 * Loaded once on construction (sorted high→low, capped at `topN`) and held in
 * memory for the session; {@link submit} folds a finished run in, re-trims, and
 * writes back. Storage is best-effort: if it's unavailable the board still works
 * for the current session — scores just don't survive a reload. Malformed stored
 * JSON is treated as an empty board rather than crashing the game.
 */
export class Leaderboard {
  private entries: ScoreEntry[] = [];

  constructor() {
    this.entries = this.read();
  }

  /** Whether scores will persist across reloads (false → in-memory only). */
  get persistent(): boolean {
    return storageAvailable();
  }

  /** The highest score on record, or 0 when the board is empty. */
  best(): number {
    return this.entries.length > 0 ? this.entries[0].score : 0;
  }

  /** The top entries for display (already high→low), capped at `count`. */
  top(count: number = CONFIG.leaderboard.displayCount): ScoreEntry[] {
    return this.entries.slice(0, count);
  }

  /**
   * Record a finished run: insert it, keep the top `topN`, persist, and return
   * this entry's 1-based rank (or 0 if it didn't place). Persistence failures are
   * swallowed — the in-memory board still updates so the game-over screen is
   * correct for the session.
   */
  submit(entry: ScoreEntry): number {
    this.entries.push(entry);
    this.entries.sort((a, b) => b.score - a.score);
    this.entries = this.entries.slice(0, CONFIG.leaderboard.topN);
    // indexOf on the live reference: -1 (→ rank 0) if it got trimmed out.
    const rank = this.entries.indexOf(entry) + 1;
    storageSet(CONFIG.leaderboard.storageKey, JSON.stringify(this.entries));
    return rank;
  }

  /** Parse and sanitise the stored board; any problem yields an empty board. */
  private read(): ScoreEntry[] {
    const raw = storageGet(CONFIG.leaderboard.storageKey);
    if (!raw) return [];
    try {
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data
        .filter(
          (e): e is { score: number; distanceM?: number; date?: string } =>
            typeof e === 'object' && e !== null && typeof (e as { score: unknown }).score === 'number',
        )
        .map((e) => ({
          score: e.score,
          distanceM: typeof e.distanceM === 'number' ? e.distanceM : 0,
          date: typeof e.date === 'string' ? e.date : '',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.leaderboard.topN);
    } catch {
      return [];
    }
  }
}
