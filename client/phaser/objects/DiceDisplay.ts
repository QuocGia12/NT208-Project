import * as Phaser from 'phaser';

type PipPoint = { x: number; y: number };

const DIE_SIZE = 109;
const PIP_RADIUS = 9.5;
const PANEL_BROWN = 0x5a341d;
const DIE_FILL = 0xffde9a;
const DIE_STROKE = 0x734321;
const FACE_LAYOUTS: Record<number, PipPoint[]> = {
  1: [{ x: 54.5, y: 54.5 }],
  2: [{ x: 31.5, y: 32.5 }, { x: 78.5, y: 77.5 }],
  3: [{ x: 31.5, y: 37.5 }, { x: 54.5, y: 71.5 }, { x: 78.5, y: 37.5 }],
  4: [{ x: 31.5, y: 32.5 }, { x: 78.5, y: 32.5 }, { x: 31.5, y: 77.5 }, { x: 78.5, y: 77.5 }],
  5: [
    { x: 31.5, y: 32.5 },
    { x: 78.5, y: 32.5 },
    { x: 54.5, y: 54.5 },
    { x: 31.5, y: 77.5 },
    { x: 78.5, y: 77.5 },
  ],
  6: [
    { x: 30.5, y: 22.5 },
    { x: 77.5, y: 22.5 },
    { x: 31.5, y: 54.5 },
    { x: 78.5, y: 54.5 },
    { x: 31.5, y: 86.5 },
    { x: 78.5, y: 86.5 },
  ],
};

export class DiceDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Image;
  private panelCover: Phaser.GameObjects.Graphics;
  private dieFace: Phaser.GameObjects.Graphics;
  private pipGraphics: Phaser.GameObjects.Graphics;

  private rollEvent: Phaser.Time.TimerEvent | null;
  private rollTween: Phaser.Tweens.Tween | null;
  private shimmerTween: Phaser.Tweens.Tween | null;
  private faceValue = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.rollEvent = null;
    this.rollTween = null;
    this.shimmerTween = null;

    this.panel = this.scene.add.image(0, 0, 'ui-dice-panel');
    this.panel.setDisplaySize(165, 157);

    this.panelCover = this.scene.add.graphics();
    this.dieFace = this.scene.add.graphics();
    this.pipGraphics = this.scene.add.graphics();

    this.container = this.scene.add.container(x, y, [
      this.panel,
      this.panelCover,
      this.dieFace,
      this.pipGraphics,
    ]);
    this.container.setDepth(80);

    this.drawFace(1);
  }

  rollAnimation(durationMs: number = 3000): void {
    this.stopRolling();
    this.container.setVisible(true);

    const endAt = this.scene.time.now + durationMs;
    this.rollEvent = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        this.faceValue = this.faceValue >= 6 ? 1 : this.faceValue + 1;
        this.drawFace(this.faceValue);
        this.playRollPulse();
        if (this.scene.time.now >= endAt) {
          this.stopRolling();
        }
      },
    });
  }

  showResult(value: number): void {
    this.stopRolling();
    const normalized = Phaser.Math.Clamp(Math.floor(value), 1, 6);
    this.faceValue = normalized;
    this.container.setVisible(true);
    this.drawFace(normalized);

    this.scene.tweens.killTweensOf(this.container);
    this.rollTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 0.98, to: 1.08 },
      scaleY: { from: 0.98, to: 1.08 },
      angle: { from: -1.4, to: 1.4 },
      duration: 180,
      yoyo: true,
      ease: 'Back.Out',
      onComplete: () => {
        this.container.setScale(1);
        this.container.setAngle(0);
        this.rollTween = null;
      },
    });
  }

  hide(): void {
    this.stopRolling();
    this.container.setVisible(false);
    this.container.setScale(1);
    this.container.setAngle(0);
  }

  destroy(): void {
    this.stopRolling();
    this.container.destroy(true);
  }

  private stopRolling(): void {
    if (this.rollEvent) {
      this.rollEvent.remove(false);
      this.rollEvent = null;
    }

    if (this.rollTween) {
      this.rollTween.stop();
      this.rollTween = null;
    }

    if (this.shimmerTween) {
      this.shimmerTween.stop();
      this.shimmerTween = null;
    }

    this.container.setScale(1);
    this.container.setAngle(0);
  }

  private playRollPulse(): void {
    if (this.rollTween) {
      this.rollTween.stop();
    }
    if (this.shimmerTween) {
      this.shimmerTween.stop();
    }

    this.container.setScale(1);
    this.container.setAngle(0);
    this.rollTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: { from: 1, to: 1.035 },
      scaleY: { from: 1, to: 1.035 },
      angle: Phaser.Math.Between(-2, 2),
      duration: 70,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.container.setScale(1);
        this.container.setAngle(0);
        this.rollTween = null;
      },
    });

    this.shimmerTween = this.scene.tweens.add({
      targets: this.pipGraphics,
      alpha: { from: 0.65, to: 1 },
      duration: 70,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.pipGraphics.alpha = 1;
        this.shimmerTween = null;
      },
    });
  }

  private drawFace(value: number): void {
    const faceSize = 72;
    const scale = faceSize / DIE_SIZE;
    const centerX = 0;
    const centerY = 6;
    const left = centerX - faceSize / 2;
    const top = centerY - faceSize / 2;
    this.pipGraphics.clear();

    this.panelCover.clear();
    this.panelCover.fillStyle(PANEL_BROWN, 1);
    this.panelCover.fillRect(-42, -31, 84, 84);

    this.dieFace.clear();
    this.dieFace.fillStyle(DIE_FILL, 1);
    this.dieFace.lineStyle(2, DIE_STROKE, 0.95);
    this.dieFace.fillRoundedRect(left, top, faceSize, faceSize, 14);
    // this.dieFace.strokeRoundedRect(left, top, faceSize, faceSize, 14);

    const pips = FACE_LAYOUTS[value] ?? FACE_LAYOUTS[1];

    pips.forEach((pip) => {
      const x = left + pip.x * scale;
      const y = top + pip.y * scale;

      this.pipGraphics.fillStyle(0x3a2113, 1);
      this.pipGraphics.fillCircle(x, y, PIP_RADIUS * scale);
    });
  }
}
