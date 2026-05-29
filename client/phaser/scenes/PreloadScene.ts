import * as Phaser from 'phaser';
import { preloadGameUIAssets } from '../assets/gameUIAssets';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    preloadGameUIAssets(this);
  }

  create(): void {
    // Delay to ensure fonts are ready
    this.time.delayedCall(200, () => {
      this.scene.start('BoardScene');
    });
  }
}
