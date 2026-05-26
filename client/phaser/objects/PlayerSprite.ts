import Phaser from 'phaser';

export class PlayerSprite {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public playerId: string;
  public color: number;

  private pulseTween: Phaser.Tweens.Tween | null;
  private moveTween: Phaser.Tweens.Tween | null;
  private eliminated: boolean;
  private locked: boolean;
  private xOverlay: Phaser.GameObjects.Text;
  private baseWorldX: number;
  private baseWorldY: number;
  private stackOffset: { x: number; y: number };

  constructor(scene: Phaser.Scene, playerId: string, name: string, color: number) {
    this.scene = scene;
    this.playerId = playerId;
    this.color = color;
    this.pulseTween = null;
    this.moveTween = null;
    this.eliminated = false;
    this.locked = false;
    this.baseWorldX = 0;
    this.baseWorldY = 0;
    this.stackOffset = { x: 0, y: 0 };

    const outline = this.scene.add.circle(0, 0, 21, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.8);
    const body = this.scene.add.circle(0, 0, 18, color, 1).setStrokeStyle(2, 0x0f1118, 0.85);

    const safeName = name.length > 10 ? `${name.slice(0, 10)}...` : name;
    const nameText = this.scene.add.text(0, 27, safeName, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#0f1118',
      strokeThickness: 3,
    });
    nameText.setOrigin(0.5, 0);

    this.xOverlay = this.scene.add.text(0, 0, 'X', {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ff5c5c',
      stroke: '#250000',
      strokeThickness: 4,
    });
    this.xOverlay.setOrigin(0.5);
    this.xOverlay.setVisible(false);

    this.container = this.scene.add.container(0, 0, [outline, body, nameText, this.xOverlay]);
    this.container.setDepth(40);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  setStackOffset(index: number, total: number): void {
    this.stackOffset = PlayerSprite.computeStackOffset(index, total);
    this.container.setPosition(
      this.baseWorldX + this.stackOffset.x,
      this.baseWorldY + this.stackOffset.y
    );
  }

  moveTo(worldX: number, worldY: number, duration: number = 200): Promise<void> {
    this.baseWorldX = worldX;
    this.baseWorldY = worldY;

    const targetX = worldX + this.stackOffset.x;
    const targetY = worldY + this.stackOffset.y;

    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }

    if (duration <= 0) {
      this.container.setPosition(targetX, targetY);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.moveTween = this.scene.tweens.add({
        targets: this.container,
        x: targetX,
        y: targetY,
        duration,
        ease: 'Sine.Out',
        onComplete: () => {
          this.moveTween = null;
          resolve();
        },
      });
    });
  }

  setActive(isActive: boolean): void {
    if (this.eliminated) {
      if (this.pulseTween) {
        this.pulseTween.stop();
        this.pulseTween = null;
      }
      this.container.setScale(1);
      return;
    }

    if (isActive) {
      if (this.pulseTween) return;
      this.pulseTween = this.scene.tweens.add({
        targets: this.container,
        scaleX: { from: 1, to: 1.15 },
        scaleY: { from: 1, to: 1.15 },
        duration: 430,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      return;
    }

    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.container.setScale(1);
  }

  setEliminated(): void {
    this.eliminated = true;
    this.setActive(false);
    this.container.setAlpha(0.3);
    this.xOverlay.setVisible(true);
    this.xOverlay.setColor('#ff5c5c');
  }

  setLocked(isLocked: boolean): void {
    this.locked = isLocked;
    if (this.eliminated) return;
    this.xOverlay.setVisible(isLocked);
    this.xOverlay.setColor('#ffd36d');
  }

  destroy(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }
    this.container.destroy(true);
  }

  private static computeStackOffset(index: number, total: number): { x: number; y: number } {
    const gap = 14;

    if (total <= 1) {
      return { x: 0, y: 0 };
    }

    if (total === 2) {
      return index === 0 ? { x: -gap / 1.2, y: 0 } : { x: gap / 1.2, y: 0 };
    }

    if (total === 3) {
      const offsets = [
        { x: 0, y: -gap },
        { x: -gap, y: gap * 0.7 },
        { x: gap, y: gap * 0.7 },
      ];
      return offsets[index] ?? { x: 0, y: 0 };
    }

    if (total === 4) {
      const offsets = [
        { x: -gap, y: -gap },
        { x: gap, y: -gap },
        { x: -gap, y: gap },
        { x: gap, y: gap },
      ];
      return offsets[index] ?? { x: 0, y: 0 };
    }

    const angle = (index / total) * Math.PI * 2;
    return {
      x: Math.cos(angle) * gap,
      y: Math.sin(angle) * gap,
    };
  }
}
