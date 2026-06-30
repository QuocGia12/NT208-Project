import * as Phaser from 'phaser';
import { preloadGameUIAssets } from '../assets/gameUIAssets';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const dicePanelImageUrl = this.registry.get('dicePanelImageUrl') as string | null | undefined;
    const mapSkinAssets = this.registry.get('mapSkinAssets');
    preloadGameUIAssets(this, { dicePanelImageUrl, mapSkinAssets });
  }

  create(): void {
    // Delay to ensure fonts are ready
    this.time.delayedCall(200, () => {
      this.scene.start('BoardScene');
    });
  }
}
