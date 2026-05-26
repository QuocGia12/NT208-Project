import Phaser from 'phaser';

export class TimerBar {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private maxWidth: number;
  private height: number;

  private background: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  private expiresAt: number | null;
  private totalDuration: number;
  private pulseTween: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene, x: number, y: number, maxWidth: number = 300, height: number = 8) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.maxWidth = maxWidth;
    this.height = height;

    this.expiresAt = null;
    this.totalDuration = 1;
    this.pulseTween = null;

    this.background = this.scene.add.graphics();
    this.fill = this.scene.add.graphics();

    this.label = this.scene.add.text(this.x, this.y - 14, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#dce7ff',
      fontStyle: 'bold',
    });
    this.label.setOrigin(0.5, 1);
    this.label.setDepth(90);

    this.background.setDepth(89);
    this.fill.setDepth(90);

    this.drawBackground();
    this.drawFill(0, 0x3ac46f);
  }

  showLabel(text: string): void {
    this.label.setText(text);
  }

  startCountdown(expiresAt: number): void {
    if (this.expiresAt === expiresAt) return;

    this.expiresAt = expiresAt;
    this.totalDuration = Math.max(1, expiresAt - Date.now());
    this.drawFill(1, 0x3ac46f);
  }

  update(): void {
    if (!this.expiresAt) return;

    const remaining = this.expiresAt - Date.now();
    const ratio = Phaser.Math.Clamp(remaining / this.totalDuration, 0, 1);

    let color = 0x3ac46f;
    if (ratio <= 0.2) {
      color = 0xe74c3c;
      this.ensurePulse();
    } else if (ratio <= 0.5) {
      color = 0xf1c40f;
      this.stopPulse();
    } else {
      color = 0x3ac46f;
      this.stopPulse();
    }

    this.drawFill(ratio, color);

    if (remaining <= 0) {
      this.stop();
    }
  }

  stop(): void {
    this.expiresAt = null;
    this.stopPulse();
    this.drawFill(0, 0x3ac46f);
  }

  destroy(): void {
    this.stopPulse();
    this.background.destroy();
    this.fill.destroy();
    this.label.destroy();
  }

  private drawBackground(): void {
    const left = this.x - this.maxWidth / 2;
    const top = this.y;

    this.background.clear();
    this.background.fillStyle(0x0d1529, 0.95);
    this.background.fillRoundedRect(left - 4, top - 4, this.maxWidth + 8, this.height + 8, 8);
    this.background.lineStyle(1.5, 0x324668, 0.9);
    this.background.strokeRoundedRect(left - 4, top - 4, this.maxWidth + 8, this.height + 8, 8);
  }

  private drawFill(ratio: number, color: number): void {
    const left = this.x - this.maxWidth / 2;
    const top = this.y;
    const width = Math.max(0, this.maxWidth * ratio);

    this.fill.clear();
    if (width <= 0) return;

    this.fill.fillStyle(color, 1);
    this.fill.fillRoundedRect(left, top, width, this.height, 6);
  }

  private ensurePulse(): void {
    if (this.pulseTween) return;

    this.fill.alpha = 1;
    this.pulseTween = this.scene.tweens.add({
      targets: this.fill,
      alpha: { from: 1, to: 0.35 },
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private stopPulse(): void {
    if (!this.pulseTween) {
      this.fill.alpha = 1;
      return;
    }

    this.pulseTween.stop();
    this.pulseTween = null;
    this.fill.alpha = 1;
  }
}
