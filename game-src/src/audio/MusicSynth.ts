import { CONFIG } from '../config';

/**
 * MusicSynth — procedural background music, generated entirely in code via the
 * Web Audio API. No audio assets ship: the soundtrack is synthesised live and
 * scheduled against the audio clock, in keeping with the game's "everything is
 * generated, nothing is a file" rule (same as the pixel art).
 *
 * Style: an original 90s-arcade × Eurobeat racing cut — 165 BPM, dark/uplifting
 * D-minor, four-on-the-floor kick with sidechain pump, a galloping rolling
 * bassline, detuned supersaw brass stabs + shimmering wide pads, FM-bell
 * arpeggios, and a bright supersaw lead hook. It plays a full ~32-bar *form*
 * with dramatic transitions: a build (risers, no kick) → chorus → a stripped
 * groove → another build → a final chorus transposed up a whole step (the
 * classic Eurobeat key change), then loops.
 *
 * Signal flow: pitched harmony (bass/pads/stabs) routes through a `duckBus`
 * that's ducked on every kick (sidechain compression / "pump"); lead, bells and
 * drums stay dry. A short gated-reverb convolver gives the snare/crash its
 * arcade splash. Stereo panners spread the supersaw/arp voices wide.
 *
 * Scheduling uses the standard Web Audio lookahead pattern: a coarse JS timer
 * wakes periodically and schedules any 16th-note steps within a short window
 * ahead of `ctx.currentTime`, so timing stays sample-accurate regardless of
 * timer jitter. The whole thing is one {@link AudioContext}; pause/resume
 * suspends it (freezing the clock so nothing over-schedules), and the master
 * gain ramps for clean fade-in/out without clicks.
 *
 * The AudioContext is created lazily on the first {@link start} — that call must
 * originate from a user gesture (the launch keypress) to satisfy browser
 * autoplay policy.
 */
export class MusicSynth {
  private ctx?: AudioContext;
  private master?: GainNode; // global fade + level
  private dryBus?: AudioNode; // un-ducked voices (lead, bells, drums, risers)
  private duckBus?: GainNode; // sidechain-pumped voices (bass, pads, stabs)
  private reverbIn?: GainNode; // send into the gated-reverb convolver
  private noiseBuffer?: AudioBuffer;
  private enabled: boolean = CONFIG.music.enabled;
  private started = false; // true between start() and stop()
  private paused = false;
  private nextStepTime = 0; // audio-clock time of the next 16th to schedule
  private step = 0; // running 16th-note index (mod SCORE_STEPS)
  private timer?: ReturnType<typeof setInterval>;

  /** Toggle music on/off. Disabling mid-run stops it; enabling re-arms the next start(). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Begin (or resume from a full stop) playback. Lazily builds the audio graph,
   * resumes a suspended context (autoplay-policy unlock; safe to call repeatedly)
   * and kicks off the lookahead scheduler from the top of the form.
   */
  start(): void {
    if (!this.enabled || this.started) return;
    const ctx = this.ensureContext();
    if (!ctx) return; // Web Audio unavailable — fail silent, game still runs.

    void ctx.resume();
    this.started = true;
    this.paused = false;
    this.step = 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    const m = CONFIG.music;
    // Fade in to avoid a click on the first note.
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master!.gain.exponentialRampToValueAtTime(m.masterVolume, ctx.currentTime + 0.4);

    this.timer = setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  /** Stop playback and tear down the scheduler, fading the master out cleanly. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.paused = false;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    const ctx = this.ctx;
    if (ctx && this.master) {
      const t = ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      // Ramp from the current value so an interrupted fade-in doesn't click.
      this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), t);
      this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    }
  }

  /** Freeze (true) or thaw (false) playback by suspending the audio clock. */
  setPaused(paused: boolean): void {
    if (!this.started || this.paused === paused) return;
    this.paused = paused;
    const ctx = this.ctx;
    if (!ctx) return;
    if (paused) {
      void ctx.suspend();
    } else {
      // currentTime froze while suspended; re-anchor the schedule to "now".
      void ctx.resume().then(() => {
        this.nextStepTime = Math.max(this.nextStepTime, ctx.currentTime + 0.05);
      });
    }
  }

  /** Build the audio graph + buffers once; returns undefined if Web Audio is missing. */
  private ensureContext(): AudioContext | undefined {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    const ctx = new Ctor();
    this.ctx = ctx;

    // Master: bright lowpass to round the supersaws → fade gain → out.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7200;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    lp.connect(master).connect(ctx.destination);
    this.master = master;
    this.dryBus = lp;

    // Sidechain bus: bass/pads/stabs route here; pumped down on each kick.
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(lp);
    this.duckBus = duck;

    // Gated reverb: a convolver fed by a short, hard-gated noise impulse, for
    // the snare/crash splash. A modest return level keeps it an accent.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeGatedImpulse(ctx);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = CONFIG.music.reverb.volume;
    const reverbIn = ctx.createGain();
    reverbIn.connect(convolver).connect(reverbReturn).connect(lp);
    this.reverbIn = reverbIn;

    // One reusable white-noise buffer for the percussion + risers.
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    return ctx;
  }

  /** A short, hard-gated noise impulse response (the "gated reverb" character). */
  private makeGatedImpulse(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Flat-ish tail, then a hard gate at ~70% — the gated-reverb signature.
        const gate = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
        d[i] = (Math.random() * 2 - 1) * gate;
      }
    }
    return buf;
  }

  /**
   * Lookahead scheduler: while the next 16th falls within {@link LOOKAHEAD}s of
   * the clock, emit every voice for that step and advance. When the context is
   * suspended (pause) `currentTime` stops, so this loop simply idles.
   */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.started || this.paused) return;
    const secPer16th = 60 / CONFIG.music.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step % SCORE_STEPS, this.nextStepTime, secPer16th);
      this.nextStepTime += secPer16th;
      this.step++;
    }
  }

  /** Emit every voice for 16th `s` of the full form (sections gate which play). */
  private playStep(s: number, time: number, sec16: number): void {
    const m = CONFIG.music;
    const beatDur = sec16 * 4;
    const barDur = sec16 * 16;
    const formBar = Math.floor(s / 16) % FORM_BARS;
    const plan = BAR_PLAN[formBar];
    const sec = plan.section;
    const beat = s % 16;
    const tr = sec.transpose; // section key-change in semitones
    const chord = plan.chordBar;
    const offbeat = beat % 4 === 2; // the "&" of each beat — Eurobeat accent

    // --- Section transitions: trigger a riser/crash on the downbeat of a section.
    if (beat === 0 && plan.sectionStart) {
      if (sec.riser) this.playRiser(time, plan.sectionBars * barDur);
      if (sec.crash) this.playCrash(time, m.drums.volume);
    }

    // --- Kick + sidechain pump (four-on-the-floor). The duck bus dips on each
    // kick and breathes back up, pumping the bass/pads/stabs.
    if (sec.kick && beat % 4 === 0) {
      this.playKick(time, m.drums.volume);
      this.pump(time, beatDur);
    }

    // --- Bass: relentless rolling 16ths (root + octave/fifth gallop), pumped.
    if (sec.bass) {
      this.playTone({
        type: m.bass.type, freq: midiToFreq(CHORD_ROOTS[chord] + BASS_RIFF[beat] + tr),
        time, dur: sec16 * 0.92, vol: m.bass.volume, attack: 0.004, detune: 6, duck: true,
      });
    }

    // --- Pads: lush, wide supersaw chord held across the bar; pumped, slow swell.
    if (sec.pad && beat === 0) {
      for (const n of CHORD_TRIADS[chord]) {
        this.playTone({
          type: m.pad.type, freq: midiToFreq(n + 12 + tr), time, dur: barDur * 1.05,
          vol: m.pad.volume, attack: barDur * 0.18, detune: 16, spread: 0.8, duck: true,
        });
      }
    }

    // --- Brass stabs: detuned supersaw triad punched on every offbeat 8th; pumped.
    if (sec.stab && offbeat) {
      for (const n of CHORD_TRIADS[chord]) {
        this.playTone({
          type: m.stab.type, freq: midiToFreq(n + 12 + tr), time, dur: sec16 * 1.5,
          vol: m.stab.volume, attack: 0.004, detune: 12, spread: 0.5, duck: true,
        });
      }
    }

    // --- Arpeggio: rapid FM-bell 16ths walking the chord, ping-pong panned (dry).
    if (sec.arp) {
      const pool = ARP_POOLS[chord];
      const note = pool[(s % pool.length)] + 12 + tr;
      const pan = beat % 2 === 0 ? -0.5 : 0.5;
      this.playBell(midiToFreq(note), time, sec16 * 1.3, m.arp.volume, pan);
    }

    // --- Lead hook: bright supersaw melody with vibrato; sparse, sustained (dry).
    if (sec.lead) {
      const leadNote = LEAD[s];
      if (leadNote) {
        this.playTone({
          type: m.lead.type, freq: midiToFreq(leadNote + tr), time, dur: sec16 * 3.2,
          vol: m.lead.volume, attack: 0.008, detune: 11, spread: 0.35, vibrato: true,
        });
      }
    }

    // --- Snare + hats.
    if (sec.kick && (beat === 4 || beat === 12)) this.playSnare(time, m.drums.volume);
    if (sec.hat && offbeat) this.playHat(time, m.drums.volume * 0.85, true); // open on the &
    else if (sec.hat && beat % 2 === 1) this.playHat(time, m.drums.volume * 0.3, false);
  }

  /** Sidechain pump: dip the ducked bus to the floor on a kick, swell it back. */
  private pump(time: number, beatDur: number): void {
    const d = this.duckBus;
    if (!d) return;
    d.gain.cancelScheduledValues(time);
    d.gain.setValueAtTime(CONFIG.music.sidechain, time);
    d.gain.linearRampToValueAtTime(1, time + beatDur * 0.9);
  }

  /**
   * One melodic/harmonic note: an AD-enveloped oscillator, optionally thickened
   * into a wide supersaw by ± `detune`-cent voices panned across ± `spread`.
   * Routes to the sidechain bus when `duck`, else stays dry. Voices share one
   * envelope gain placed *after* the panners so the stereo image is preserved.
   */
  private playTone(o: {
    type: OscillatorType; freq: number; time: number; dur: number; vol: number;
    attack: number; detune?: number; spread?: number; vibrato?: boolean; duck?: boolean;
  }): void {
    const ctx = this.ctx;
    const bus = o.duck ? this.duckBus : this.dryBus;
    if (!ctx || !bus) return;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.time);
    g.gain.exponentialRampToValueAtTime(o.vol, o.time + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, o.time + o.dur);
    g.connect(bus);

    // Voice spread: centre, plus a ± detuned pair panned out for stereo width.
    const sp = o.spread ?? 0;
    const voices: Array<{ cents: number; pan: number }> = o.detune
      ? [{ cents: -o.detune, pan: -sp }, { cents: 0, pan: 0 }, { cents: o.detune, pan: sp }]
      : [{ cents: 0, pan: 0 }];

    let lead: OscillatorNode | undefined;
    for (const v of voices) {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.value = o.freq;
      osc.detune.value = v.cents;
      if (v.pan !== 0) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = v.pan;
        osc.connect(pan).connect(g);
      } else {
        osc.connect(g);
      }
      osc.start(o.time);
      osc.stop(o.time + o.dur + 0.02);
      if (v.cents === 0) lead = osc;
    }

    if (o.vibrato && lead) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = o.freq * 0.012;
      lfo.connect(lfoGain).connect(lead.frequency);
      lfo.start(o.time);
      lfo.stop(o.time + o.dur + 0.02);
    }
  }

  /** FM bell (2-op): a bright metallic pluck for the arpeggio, stereo-panned. */
  private playBell(freq: number, time: number, dur: number, vol: number, pan: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.dryBus) return;
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * 2.0; // ratio 2:1 → hollow bell
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 3, time); // bright attack…
    modGain.gain.exponentialRampToValueAtTime(freq * 0.4, time + dur); // …decaying timbre
    mod.connect(modGain).connect(carrier.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    carrier.connect(g).connect(p).connect(this.dryBus);

    carrier.start(time); mod.start(time);
    carrier.stop(time + dur + 0.02); mod.stop(time + dur + 0.02);
  }

  /** Riser: a noise sweep climbing in filter + level across a build, into the drop. */
  private playRiser(time: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.dryBus || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, time);
    bp.frequency.exponentialRampToValueAtTime(9000, time + dur); // sweep up
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(CONFIG.music.drums.volume * 0.5, time + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur); // cut at the drop
    src.connect(bp).connect(g).connect(this.dryBus);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  /** Crash: long bright noise splash on a section downbeat, sent to gated reverb. */
  private playCrash(time: number, vol: number): void {
    this.playNoise(time, vol * 0.7, 0.5, 'highpass', 6000, 0.7, true);
  }

  /** Kick: sine with a fast downward pitch sweep and snappy decay. */
  private playKick(time: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.dryBus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g).connect(this.dryBus);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  /** Snare: filtered noise burst with a short body, sent to gated reverb. */
  private playSnare(time: number, vol: number): void {
    this.playNoise(time, vol * 0.7, 0.18, 'bandpass', 1900, 1.2, true);
  }

  /** Hi-hat: short closed tick, or a longer open hat for the offbeat accent (dry). */
  private playHat(time: number, vol: number, open: boolean): void {
    this.playNoise(time, vol * 0.5, open ? 0.13 : 0.04, 'highpass', 8000, 0.9, false);
  }

  /** Shared noise voice for the percussion/crash, optionally bussed to reverb. */
  private playNoise(
    time: number, vol: number, dur: number, filter: BiquadFilterType,
    freq: number, q: number, reverb: boolean,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.dryBus || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = filter;
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(bp).connect(g);
    g.connect(this.dryBus);
    if (reverb && this.reverbIn) g.connect(this.reverbIn);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}

// --- Scheduler timing ---
const SCHEDULER_INTERVAL_MS = 25; // how often the JS timer wakes to schedule
const LOOKAHEAD = 0.12; // s of audio scheduled ahead of the clock each wake

// =====================================================================
//  The composition (content, not gameplay tunables, so it lives here)
// =====================================================================
// An 8-bar D-minor progression with a harmonic-minor V, arranged into a ~32-bar
// form with builds, a stripped groove and a key-changed final chorus.
//   Dm  Bb  F  C  |  Dm  Bb  C  A(maj)

/** MIDI note → frequency (A4 = 69 = 440 Hz). */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const PROG_LEN = 8;

// Chord root per bar for the bass (low octave).
const CHORD_ROOTS = [
  38, // D2   Dm
  34, // Bb1  Bb
  41, // F2   F
  36, // C2   C
  38, // D2   Dm
  34, // Bb1  Bb
  36, // C2   C
  33, // A1   A (harmonic-minor V)
];

// Triad per bar (mid octave) for pads + stabs.
const CHORD_TRIADS = [
  [50, 53, 57], // D3 F3 A3    Dm
  [46, 50, 53], // Bb2 D3 F3   Bb
  [53, 57, 60], // F3 A3 C4    F
  [48, 52, 55], // C3 E3 G3    C
  [50, 53, 57], // D3 F3 A3    Dm
  [46, 50, 53], // Bb2 D3 F3   Bb
  [48, 52, 55], // C3 E3 G3    C
  [45, 49, 52], // A2 C#3 E3   A (raised 3rd → leading-tone pull to Dm)
];

// Arp pools per bar: the triad walked up-and-back for a rolling 16th figure.
const ARP_POOLS = CHORD_TRIADS.map((t) => [t[0], t[1], t[2], t[0] + 12, t[2], t[1]]);

// Rolling bass riff within a bar: semitone offset from the chord root per 16th.
// Root-root-octave-fifth gallop — the busy Eurobeat drive.
const BASS_RIFF = [0, 0, 12, 7, 0, 0, 12, 7, 0, 0, 12, 7, 0, 0, 12, 7];

// Lead hook across the 8 bars, indexed by absolute 16th (absent = rest).
// A dramatic statement (bars 0–3) and a higher, climactic answer (bars 4–7).
const LEAD: Record<number, number> = {
  // Bar 0 (Dm)
  0: 69, 2: 74, 3: 77, 4: 81, 7: 79, 8: 77, 10: 74, 12: 76, 14: 77,
  // Bar 1 (Bb)
  16: 74, 19: 77, 20: 74, 22: 70, 24: 74, 26: 77, 28: 81, 30: 79,
  // Bar 2 (F)
  32: 77, 34: 81, 35: 77, 36: 72, 39: 74, 40: 77, 44: 81, 46: 79, 47: 77,
  // Bar 3 (C)
  48: 76, 50: 79, 52: 72, 54: 76, 56: 79, 59: 77, 60: 76, 62: 74,
  // Bar 4 (Dm) — climb to the top octave
  64: 86, 66: 81, 67: 77, 68: 81, 71: 86, 72: 84, 74: 81, 76: 77, 78: 81,
  // Bar 5 (Bb)
  80: 82, 82: 81, 83: 77, 84: 74, 86: 77, 88: 82, 90: 81, 92: 79, 94: 77,
  // Bar 6 (C)
  96: 79, 98: 76, 99: 79, 100: 84, 103: 81, 104: 79, 106: 76, 108: 74, 110: 76,
  // Bar 7 (A) — leading-tone (C#) tensions the loop back to Dm
  112: 73, 114: 76, 116: 81, 118: 79, 120: 76, 122: 73, 124: 76,
};

// --- Arrangement: the song form. Each section gates which voices play, sets a
// key-change `transpose`, and can fire a riser/crash on its downbeat.
interface Section {
  bars: number;
  transpose: number;
  kick: boolean;
  bass: boolean;
  stab: boolean;
  lead: boolean;
  arp: boolean;
  pad: boolean;
  hat: boolean;
  riser: boolean;
  crash: boolean;
}

const ARRANGEMENT: Section[] = [
  // Build-up: pads + bells + a 4-bar riser, no kick — tension before the drop.
  { bars: 4, transpose: 0, kick: false, bass: false, stab: false, lead: false, arp: true, pad: true, hat: false, riser: true, crash: false },
  // Chorus: everything in, crash on the drop. The main hook.
  { bars: 8, transpose: 0, kick: true, bass: true, stab: true, lead: true, arp: true, pad: true, hat: true, riser: false, crash: true },
  // Groove: stripped — kick + bass + arp + pads, no lead/stabs. A breather.
  { bars: 8, transpose: 0, kick: true, bass: true, stab: false, lead: false, arp: true, pad: true, hat: true, riser: false, crash: false },
  // Build 2: kick keeps driving under a riser; harmony drops out for tension.
  { bars: 4, transpose: 0, kick: true, bass: false, stab: false, lead: false, arp: true, pad: true, hat: true, riser: true, crash: false },
  // Final chorus: transposed up a whole step — the Eurobeat key change.
  { bars: 8, transpose: 2, kick: true, bass: true, stab: true, lead: true, arp: true, pad: true, hat: true, riser: false, crash: true },
];

// Flatten the arrangement into a per-bar plan the scheduler indexes directly.
interface BarPlan {
  section: Section;
  sectionStart: boolean; // first bar of its section (riser/crash trigger)
  sectionBars: number;
  chordBar: number; // index into the 8-bar progression
}

const BAR_PLAN: BarPlan[] = [];
for (const section of ARRANGEMENT) {
  for (let b = 0; b < section.bars; b++) {
    BAR_PLAN.push({
      section,
      sectionStart: b === 0,
      sectionBars: section.bars,
      chordBar: b % PROG_LEN,
    });
  }
}
const FORM_BARS = BAR_PLAN.length;
const SCORE_STEPS = FORM_BARS * 16;
