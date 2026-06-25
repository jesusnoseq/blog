import Phaser from 'phaser';
import { CONFIG } from './config';
import { GameScene } from './scenes/GameScene';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: CONFIG.backgroundColor,
  pixelArt: true, // crisp nearest-neighbour scaling for the procedural pixel art to come
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: CONFIG.targetFps,
    forceSetTimeOut: false,
  },
  input: {
    gamepad: true,
  },
  scene: [GameScene],
};

new Phaser.Game(gameConfig);
