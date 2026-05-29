import * as Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // No external assets. All visuals are procedural Graphics.
  }

  create(): void {
    this.scene.start('BoardScene');
  }
}
