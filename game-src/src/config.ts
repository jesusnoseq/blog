/**
 * CONFIG — single source of truth for every tunable in the game.
 *
 * Per the design rule "all gameplay numbers live in CONFIG", balancing happens
 * here and nowhere else. Milestone 1 only needs rendering, camera and a
 * placeholder player; later milestones (physics, fuel, rocks, AI, combat,
 * difficulty, particles, leaderboard) extend this object.
 */
export const CONFIG = {
  // --- Rendering / canvas (logical resolution; scaled to fit the window) ---
  width: 480,
  height: 800,
  backgroundColor: '#0a0a12',
  targetFps: 60,

  // --- Camera ---
  camera: {
    lookahead: 120, // px the camera leans toward "forward" (up) so you see ahead
    lerp: 0.1, // follow smoothing, 0..1 (lower = smoother/laggier)
    deadzoneWidth: 80,
    deadzoneHeight: 140,
  },

  // --- Placeholder player ---
  // NOTE: milestone 1 only. Real velocity/acceleration/drag physics replaces
  // `placeholderSpeed` in milestone 2 (Player rocket + movement physics).
  player: {
    size: 24,
    color: 0x49c5ff,
    placeholderSpeed: 320, // px/sec, simple translation to exercise camera follow
  },

  // --- Input ---
  input: {
    gamepadDeadzone: 0.25,
  },

  // --- Feature flags (extension points for later milestones) ---
  ELIMINATE_ON_OFFROAD: true,
} as const;
