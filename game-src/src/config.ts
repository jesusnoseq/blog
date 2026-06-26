/**
 * CONFIG — single source of truth for every tunable in the game.
 *
 * Per the design rule "all gameplay numbers live in CONFIG", balancing happens
 * here and nowhere else. Milestone 1 only needs rendering, camera and a
 * placeholder player; later milestones (physics, fuel, rocks, AI, combat,
 * difficulty, particles, leaderboard) extend this object.
 *
 * Colours come from the fixed retro {@link PALETTE} so the whole game stays
 * cohesive — fields point at palette entries rather than carrying loose hex.
 */
import { PALETTE } from './render/palette';

export const CONFIG = {
  // --- Rendering / canvas (logical resolution; scaled to fit the window) ---
  width: 480,
  height: 800,
  backgroundColor: '#0a0a12',
  targetFps: 60,

  // --- Camera ---
  camera: {
    lookahead: 200, // px the camera leans toward "forward" (up) so you see ahead
    lerp: 0.1, // follow smoothing, 0..1 (lower = smoother/laggier)
    deadzoneWidth: 800,
    deadzoneHeight: 140,
    minScrollSpeed: 300, // px/s — the view always advances up at least this fast (never reverses)
    dangerBand: 160, // px above the bottom edge where the "falling behind" warning shows
  },

  // --- Road (infinite vertical corridor; chunked + object-pooled) ---
  road: {
    width: 360, // corridor width px (logical canvas is 480 → ~60px void each side)
    chunkHeight: 200, // px per chunk (must be a whole multiple of the dash period)
    aheadChunks: 2, // chunks generated beyond the top of view
    behindChunks: 1, // chunks kept below view before recycling
    asphaltColor: PALETTE.asphalt, // dark asphalt, distinct from background void
    boundaryColor: PALETTE.boundary, // bright boundary lines — clearly visible
    boundaryWidth: 4,
    laneColor: PALETTE.lane, // centre dashed lane marking
    laneWidth: 4,
    dashLength: 28,
    dashGap: 12, // dash period 40 divides chunkHeight 200 → seamless tiling
    depth: -10, // render behind the player
  },

  // --- Player (visual) ---
  player: {
    size: 24,
    color: PALETTE.boundary,
  },

  // --- Movement physics (tunable; balanced by feel per the M2 test gate) ---
  // "Forward" is up (-Y). Drag is per-axis: low longitudinal keeps forward
  // momentum (satisfying coast), higher lateral lets sideways slides settle
  // with a touch of drift — the arcade-racer feel.
  physics: {
    fixedStep: 1 / 120, // s per physics step (interpolated up to display rate)
    maxFrameTime: 0.25, // accumulator cap — avoids spiral-of-death after a stall
    forwardAccel: 1400, // px/s^2 (Up/W)
    lateralAccel: 1100, // px/s^2 (A/D)
    longitudinalDrag: 0.8, // 1/s exponential decay on forward velocity
    lateralDrag: 3.0, // 1/s exponential decay on lateral velocity
    maxSpeed: 600, // px/s — clamp on velocity magnitude
  },

  // --- Input ---
  input: {
    gamepadDeadzone: 0.25,
  },

  // --- HUD + game-over screen (live stats and the run-end overlay) ---
  hud: {
    pixelsPerMeter: 10, // world px per displayed metre (distance/speed/score scale)
    padding: 12, // inset of the live-stats readout from the top-left corner
    fontFamily: 'monospace',
    statsFontSize: 16, // px — live stats text
    statsColor: '#cfe8ff',
    // Game-over overlay
    overlayColor: 0x0a0a12, // dimming panel (matches the void background)
    overlayAlpha: 0.72,
    titleFontSize: 40, // px — "ELIMINATED"
    titleColor: '#ff5a6e',
    panelFontSize: 18, // px — stat lines + restart prompt
    panelColor: '#cfe8ff',
    promptColor: '#8fa8c8',
    causeColor: '#ffb454', // game-over subtitle (why the run ended)
    lineSpacing: 8, // px between stacked game-over text lines
    depth: 1000, // render above everything (road = -10, player = default 0)
    // Fuel bar — sits under the live stats text, top-left.
    fuelBar: {
      x: 12,
      y: 126, // below the 5-line stats readout (DIST/SPEED/SCORE/OPP/KILLS)
      width: 160,
      height: 14,
      bgColor: 0x1f1f2e, // empty-tank track
      color: 0x49ff8e, // healthy fuel (green)
      lowColor: 0xff5a6e, // low fuel (red)
      lowFrac: 0.25, // bar turns red at/below this fraction
      borderColor: 0x3a3a52,
      borderWidth: 2,
    },
    // Start screen — controls overlay shown before the run begins (launch on thrust).
    startScreen: {
      title: 'ROCKET RACE',
      titleColor: '#49ff8e', // green, distinct from the red game-over title
      controlsColor: '#cfe8ff',
      promptColor: '#8fa8c8',
      controls: [
        'W / ↑        Thrust',
        'A D / ← →    Steer',
        'P            Pause',
        'R            Restart',
        'M            Music on/off',
      ],
      prompt: 'Press W or ↑ to launch',
      pulseMs: 600, // half-period of the prompt's blink (yoyo)
    },

    // Fall-behind warning — red band + text along the bottom when nearing the kill line.
    danger: {
      bandHeight: 90, // px tall red band hugging the bottom edge of the screen
      color: 0xff5a6e, // band fill (matches the eliminated-title red)
      alpha: 0.28, // band translucency at full pulse
      text: 'FALLING BEHIND',
      textColor: '#ff5a6e',
      fontSize: 22, // px — warning label
      pulseMs: 350, // half-period of the alpha pulse (yoyo)
    },
  },

  // --- Rocks (obstacle pixels; drawn into chunk graphics, pooled with chunks) ---
  // Pattern geometry derives from road.width + these knobs so nothing is magic.
  rocks: {
    spawnChance: 0.55, // probability an eligible chunk gets a rock pattern (else empty)
    safeAheadChunks: 1, // chunks ahead of the start kept clear (plus the spawn chunk)
    minRadius: 14,
    maxRadius: 24,
    minGap: 84, // smallest passable opening (player is 24 wide → comfortable weave)
    clusterMin: 3, // rocks in a cluster pattern (inclusive range)
    clusterMax: 5,
    color: PALETTE.rock, // rock body — muted grey, reads against dark asphalt
    outlineColor: PALETTE.rockOutline, // 1–2px darker rim for shape readability
    outlineWidth: 3,
  },

  // --- Fuel (drained by thrusters, refilled in zones; empty = dead engine) ---
  // Tuned so coasting (low longitudinal drag) stretches the tank far enough to
  // reach the next zone with careful play; balance by feel per the M7 gate.
  fuel: {
    max: 100,
    start: 100, // tank level at run start
    mainDrain: 9, // units/s at full forward thrust
    sideDrain: 6, // units/s at full lateral thrust
    refillRate: 40, // units/s while inside a fuel zone
    deadStopSpeed: 25, // px/s — empty tank + slower than this = coasted to death
  },

  // --- Fuel zones (refuel pads spawned periodically along the road) ---
  fuelZone: {
    interval: 6, // a pad every Nth chunk ahead (deterministic → always reachable)
    width: 100, // pad size px (narrow lane within the 360 corridor)
    height: 300, // pad extent along the chunk (long; of chunkHeight 200)
    color: PALETTE.fuel, // glowing green fill
    fillAlpha: 0.22,
    borderColor: PALETTE.fuelBright,
    borderWidth: 3,
  },

  // --- AI opponents (Rocket subclass; one InputState synthesised per frame) ---
  // Tuning mirrors `physics` initially so the race is fair, but lives separately so
  // AI can be balanced independently (RocketTuning is per-rocket by design). The
  // navigation knobs drive the racing/refuelling state machine in AIRocket.think.
  ai: {
    maxConcurrent: 4, // target field size + hard cap on concurrent opponents
    size: 24,
    colors: [PALETTE.orange, 0xb96bff, PALETTE.fuelBright], // ≥ count, all distinct from player blue
    spawnSpreadX: 240, // x span across which the N AI start (within road width 360)
    // Continuous spawning: opponents always appear *ahead* of the player (forward = -Y).
    spawnAheadMin: 600, // min px ahead of the player a new opponent appears
    spawnAheadMax: 1000, // max px ahead (near/just beyond the top of the ~800px view)
    // Run start: a few opponents begin level with the player, flanking it left/right
    // at the same height (rest spawn ahead). 2 → one each side; more → spread across.
    startAlongside: 2, // opponents that start beside the player at run start
    startSideX: 120, // px from centre of the outermost flanking starters (within the corridor)
    despawnAheadDist: 1400, // px ahead beyond which an opponent is silently recycled (> spawnAheadMax)
    spawnDelayMin: 0.8, // s — min stagger between respawns when below maxConcurrent
    spawnDelayMax: 1.8, // s — max stagger between respawns
    spawnSpeed: 540, // px/s forward (-Y) seeded on a new opponent so it cruises with the field
    // Physics (mirrors CONFIG.physics; see RocketTuning).
    forwardAccel: 1400,
    lateralAccel: 1100,
    longitudinalDrag: 0.8,
    lateralDrag: 3.0,
    maxSpeed: 570,
    // Navigation.
    lookahead: 280, // px ahead (-Y) to scan for threatening rocks
    avoidClearance: 40, // px lateral margin to clear a rock's radius when dodging
    edgeMargin: 60, // keep the steer target within ±(halfWidth - edgeMargin)
    steerGain: 0.02, // maps (targetX - x) px → steerX before clamp to [-1, 1]
    refuelFraction: 0.35, // tank below this → divert to the nearest fuel pad
    resumeFraction: 0.85, // tank above this → resume racing (hysteresis)
    maxFuel: 200,
    startFuel: 999,
    // Combat: when to fire the exhaust cone at a rival (see CONFIG.combat for the
    // push physics; these gate only the AI's *decision* to engage).
    combatRange: 110, // px to a rival within which it's worth firing
    combatLevelBand: 70, // max |Δy| to a rival (the cone is horizontal — stay level)
    combatEdgeSafety: 40, // don't fire if thrusting away would shove self toward an edge
  },

  // --- Collision response (circle vs circle; arcade speed-loss + knockback) ---
  collision: {
    playerRadius: 11, // a touch under player.size/2 (12) for forgiving corners
    speedLoss: 0.45, // fraction of velocity kept on impact (lower = harder stop)
    knockback: 160, // px/s outward impulse along the contact normal
    damage: false, // extension point: deal damage on hit (no health system yet)
    // Rocket-vs-rocket bump (both bodies move): split the overlap, bounce apart.
    // Softer than rocks — a shoulder-check, not a wall.
    rocket: {
      radius: 12, // collider radius per rocket (≈ size/2)
      speedLoss: 0.6, // velocity kept on a bump (higher = bouncier, less stopping)
      knockback: 120, // px/s outward impulse each body takes
    },
  },

  // --- Propulsion combat (side-thruster exhaust cone that shoves other rockets) ---
  // A firing side thruster emits a cone on its exhaust side (opposite the motion:
  // plume on the right when moving left). Any *other* rocket inside gets pushed
  // away from the source, scaled by proximity. Wired both ways (player ⇄ AI ⇄ AI).
  // This is the heaviest-tuned mechanic — balance for "decisive, not instant-win".
  combat: {
    range: 100, // px — cone length (max push reach)
    halfAngleDeg: 35, // cone half-angle from its axis (full spread = 70°)
    minSteer: 0.4, // |steerX| below this doesn't count as firing (ignore drift)
    pushAccel: 2400, // px/s^2 — peak push at point-blank, falls off linearly to 0 at range
    combatCreditWindow: 0.6, // s — an elimination within this long of a cone push counts as a combat kill
    debugCone: false, // draw active cones as translucent triangles (tuning aid; off for the polished art)
  },

  // --- Render (pixel-art sprite generation; all art is built from PALETTE) ---
  // Sprites are generated once onto offscreen canvases at final size using chunky
  // `pixelScale`-sized blocks (crisp nearest-neighbour, no fractional-scale blur),
  // cached by key, and never regenerated per frame. See SpriteFactory.
  render: {
    pixelScale: 3, // screen px per art "pixel" (the chunky-block size / integer upscale)
    rocket: {
      gridW: 9, // art-pixel grid width (final px = gridW * pixelScale) — odd for a centred nose
      gridH: 13, // art-pixel grid height
      playerSwatch: 0, // index into ROCKET_SWATCHES (0 = player blue)
      aiSwatches: [1, 2, 3, 4], // ≥ ai.maxConcurrent, all distinct from the player; cycled per spawn
      bankDeg: 12, // max sprite tilt when steering (visual only; rocket still flies up)
    },
    rock: {
      variants: 4, // distinct seeded boulder shapes (cached per variant + radius)
    },
    void: {
      tileSize: 64, // px of the tiling star/void texture outside the road
      parallax: 0.3, // fraction of camera scroll the starfield drifts (0 = fixed)
      starCount: 18, // stars sprinkled per void tile
    },
    fuelPad: {
      frames: 6, // brightness steps in the palette-cycle pulse spritesheet
      frameRateMs: 110, // ms per frame of the 'fuelPulse' loop
    },
  },

  // --- Score (survival + ranking blend) ---
  // Score = floor(distance) + time_survived * timeScore + eliminated * killBonus.
  score: {
    timeScore: 5, // points per second survived (the `k`)
    killBonus: 250, // points per opponent eliminated (the `BONUS`)
  },

  // --- Particles (pooled square pixels; palette-stepped fade, no alpha blur) ---
  // Engine flame + side-thruster plumes while thrusting, explosion bursts on death.
  // Counts are hard-capped (`max`) and emission scales with dt, so memory stays flat
  // and behaviour is frame-rate independent. Sizes are in art "blocks" (×pixelScale).
  particles: {
    max: 500, // pool cap — emit() drops when full (bounded memory)
    drag: 2.4, // 1/s exponential velocity decay so particles slow as they fade
    // Main engine exhaust — out the rear (+Y) while holding thrust.
    engine: {
      rate: 95, // particles/s at full thrust
      life: 0.28, // s
      speed: 190, // px/s backward (down) ejection
      spread: 70, // px/s lateral jitter
      velCarry: 0.25, // fraction of the rocket's own velocity inherited
      sizeBlocks: 2, // square edge in art blocks (×pixelScale px)
      originY: 18, // spawn this far behind (below) the rocket centre
      ramp: [PALETTE.white, PALETTE.yellow, PALETTE.orange], // hot → cool
    },
    // Side-thruster plume — on the exhaust side (opposite the steer).
    side: {
      rate: 70,
      life: 0.22,
      speed: 200,
      spread: 60,
      velCarry: 0.2,
      sizeBlocks: 2,
      originX: 14, // spawn this far to the exhaust side of the rocket centre
      ramp: [PALETTE.white, PALETTE.yellow],
    },
    // Explosion burst — one-shot radial spray when a rocket is eliminated.
    explosion: {
      count: 36, // particles per burst
      life: 0.6,
      speed: 260, // max radial speed (each particle randomised up to this)
      sizeBlocks: 3,
      ramp: [PALETTE.white, PALETTE.yellow, PALETTE.orange, PALETTE.red, PALETTE.ember],
    },
  },

  // --- Music (procedural background tune; generated in code, no audio assets) ---
  // An F-Zero-ish driving racer cut synthesised live via the Web Audio API.
  // Tempo + per-voice mix live here; the note score is composition (in MusicSynth).
  music: {
    enabled: true, // master switch (also toggled live with M)
    bpm: 165, // tempo — driving Eurobeat racing pace
    masterVolume: 0.32, // overall level (0..1); deliberately background
    sidechain: 0.34, // duck floor (0..1) the pumped bus dips to on each kick
    bass: { type: 'sawtooth' as OscillatorType, volume: 0.2 }, // rolling 16th-note low end
    lead: { type: 'sawtooth' as OscillatorType, volume: 0.12 }, // melody hook (vibrato + detune)
    stab: { type: 'sawtooth' as OscillatorType, volume: 0.07 }, // offbeat supersaw brass hits
    pad: { type: 'sawtooth' as OscillatorType, volume: 0.045 }, // wide shimmering chord bed
    arp: { volume: 0.055 }, // FM-bell arpeggio
    drums: { volume: 0.55 }, // kick/snare/hat bus level
    reverb: { volume: 0.45 }, // gated-reverb return level (snare/crash splash)
  },

  // --- Feature flags (extension points for later milestones) ---
  ELIMINATE_ON_OFFROAD: true,
  ELIMINATE_ON_BOTTOM: true, // crush: falling off the bottom of the view ends the run
} as const;
