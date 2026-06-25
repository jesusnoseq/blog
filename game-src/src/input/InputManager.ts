import Phaser from 'phaser';
import { CONFIG } from '../config';

/** Normalized per-frame movement intent, engine-agnostic. */
export interface InputState {
  /** Forward (up) thrust intent, 0..1. */
  thrust: number;
  /** Lateral steer, -1 (left) .. 1 (right). */
  steerX: number;
}

type KeyName = 'up' | 'w' | 'down' | 's' | 'left' | 'a' | 'right' | 'd';

/**
 * Wraps Phaser keyboard + gamepad input behind a small intent API so gameplay
 * code never touches raw key/pad state. Keyboard is the only input that must
 * work this milestone; the gamepad left-stick read is wired but a no-op when no
 * pad is connected.
 */
export class InputManager {
  private readonly scene: Phaser.Scene;
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private readonly pauseKey: Phaser.Input.Keyboard.Key;
  private readonly restartKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) {
      throw new Error('Keyboard input plugin is not available.');
    }
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.pauseKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.restartKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  /** Current continuous movement intent for this frame. */
  getState(): InputState {
    let thrust = 0;
    let steerX = 0;

    if (this.keys.up.isDown || this.keys.w.isDown) thrust = 1;
    if (this.keys.left.isDown || this.keys.a.isDown) steerX -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) steerX += 1;

    // Gamepad left stick (optional). axes[1] is up-negative, so forward = -y.
    const pad = this.scene.input.gamepad?.getPad(0);
    if (pad) {
      const ax = pad.axes[0]?.getValue() ?? 0;
      const ay = pad.axes[1]?.getValue() ?? 0;
      if (Math.abs(ax) > CONFIG.input.gamepadDeadzone) steerX += ax;
      if (-ay > CONFIG.input.gamepadDeadzone) thrust = Math.max(thrust, -ay);
    }

    return {
      thrust: Phaser.Math.Clamp(thrust, 0, 1),
      steerX: Phaser.Math.Clamp(steerX, -1, 1),
    };
  }

  /** True only on the frame P transitions from up to down. */
  justPressedPause(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.pauseKey);
  }

  /** True only on the frame R transitions from up to down. */
  justPressedRestart(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.restartKey);
  }
}
