import * as Phaser from 'phaser';

export class DiceDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private diceFace: Phaser.GameObjects.Graphics;
  private dicePips: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;

  private rollEvent: Phaser.Time.TimerEvent | null;
  private pulseTween: Phaser.Tweens.Tween | null;
  private currentValue: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.rollEvent = null;
    this.pulseTween = null;
    this.currentValue = 1;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x101a30, 0.9);
    panel.fillRoundedRect(-78, -92, 156, 184, 12);
    panel.lineStyle(2, 0x2f477a, 0.9);
    panel.strokeRoundedRect(-78, -92, 156, 184, 12);

    this.titleText = this.scene.add.text(0, -72, 'XÃºc xáº¯c', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d8e4ff',
      fontStyle: 'bold',
    });
    this.titleText.setOrigin(0.5);

    this.diceFace = this.scene.add.graphics();
    this.dicePips = this.scene.add.graphics();

    this.container = this.scene.add.container(x, y, [panel, this.diceFace, this.dicePips, this.titleText]);
    this.container.setDepth(80);

    this.drawFace(1);
  }

  rollAnimation(durationMs: number = 3000): void {
    if (this.rollEvent) {
      return;
    }

    this.container.setVisible(true);

    const endAt = this.scene.time.now + durationMs;
    this.rollEvent = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        const nextValue = Phaser.Math.Between(1, 6);
        this.drawFace(nextValue);
        this.pulseQuick();

        if (this.scene.time.now >= endAt) {
          this.stopRolling();
        }
      },
    });
  }

  showResult(value: number): void {
    this.stopRolling();
    const normalized = Phaser.Math.Clamp(Math.floor(value), 1, 6);

    this.container.setVisible(true);
    this.drawFace(normalized);

    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    this.container.setScale(1);
    this.pulseTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.16 },
      scaleY: { from: 1, to: 1.16 },
      duration: 160,
      yoyo: true,
      ease: 'Back.Out',
      onComplete: () => {
        this.container.setScale(1);
        this.pulseTween = null;
      },
    });
  }

  hide(): void {
    this.stopRolling();
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.container.setVisible(false);
    this.container.setScale(1);
  }

  destroy(): void {
    this.stopRolling();
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.container.destroy(true);
  }

  private stopRolling(): void {
    if (this.rollEvent) {
      this.rollEvent.remove(false);
      this.rollEvent = null;
    }
  }

  private pulseQuick(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    this.container.setScale(1);
    this.pulseTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.07 },
      scaleY: { from: 1, to: 1.07 },
      duration: 70,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.container.setScale(1);
        this.pulseTween = null;
      },
    });
  }

  private drawFace(value: number): void {
    this.currentValue = value;

    this.diceFace.clear();
    this.dicePips.clear();

    const size = 86;
    const half = size / 2;

    this.diceFace.fillStyle(0xf7f8ff, 1);
    this.diceFace.fillRoundedRect(-half, -half + 12, size, size, 14);
    this.diceFace.lineStyle(2, 0x203154, 0.95);
    this.diceFace.strokeRoundedRect(-half, -half + 12, size, size, 14);

    const cx = 0;
    const cy = 12;
    const gap = 20;

    const pips = this.getPipLayout(value).map(([px, py]) => ({ x: cx + px * gap, y: cy + py * gap }));

    this.dicePips.fillStyle(0x1a1f2b, 1);
    pips.forEach(pip => {
      this.dicePips.fillCircle(pip.x, pip.y, 5.3);
    });
  }

  private getPipLayout(value: number): Array<[number, number]> {
    const center: [number, number] = [0, 0];
    const tl: [number, number] = [-1, -1];
    const tr: [number, number] = [1, -1];
    const ml: [number, number] = [-1, 0];
    const mr: [number, number] = [1, 0];
    const bl: [number, number] = [-1, 1];
    const br: [number, number] = [1, 1];

    if (value === 1) return [center];
    if (value === 2) return [tl, br];
    if (value === 3) return [tl, center, br];
    if (value === 4) return [tl, tr, bl, br];
    if (value === 5) return [tl, tr, center, bl, br];
    return [tl, tr, ml, mr, bl, br];
  }
}
