import * as Phaser from 'phaser';
import { CardState } from '../../types/game';
import { getCardTextureKey } from '../assets/gameUIAssets';

const FIGMA_SLOT_OFFSETS = [-233, -140, -47, 47, 140, 233];
const FIGMA_SLOT_ROTATIONS = [-0.055, -0.03, -0.012, 0.012, 0.03, 0.055];
const FIGMA_SLOT_Y = [2, 0, -2, -2, 0, 2];
const DOUBLE_CLICK_MS = 240;

export class CardPanel {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;

  private root: Phaser.GameObjects.Container;
  private cardsRoot: Phaser.GameObjects.Container;
  private emptyText: Phaser.GameObjects.Text;
  private onCardClickCallback: ((cardId: string) => void) | null;
  private pendingClickTimer: Phaser.Time.TimerEvent | null;
  private pendingClickCardId: string | null;
  private pendingClickPlayable = false;
  private previewOverlay: Phaser.GameObjects.Container | null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.onCardClickCallback = null;
    this.pendingClickTimer = null;
    this.pendingClickCardId = null;
    this.previewOverlay = null;

    this.emptyText = this.scene.add.text(0, 0, 'Khong co bai', {
      fontFamily: '"Playpen Sans", cursive',
      fontSize: '18px',
      color: '#f6d89e',
    });
    this.emptyText.setOrigin(0.5);

    this.cardsRoot = this.scene.add.container(0, 0);
    this.root = this.scene.add.container(this.x, this.y, [this.cardsRoot, this.emptyText]);
    this.root.setDepth(120);
  }

  render(
    hand: CardState[],
    playableCardIds: string[],
    helperHighlightCardIds: string[] = [],
  ): void {
    this.cardsRoot.removeAll(true);

    if (hand.length === 0) {
      this.emptyText.setVisible(true);
      return;
    }

    this.emptyText.setVisible(false);
    const playableSet = new Set(playableCardIds);
    const helperHighlightSet = new Set(helperHighlightCardIds);
    const hasHelperFocus = helperHighlightSet.size > 0;
    const cardWidth = 96;
    const cardHeight = 142;

    hand.forEach((card, index) => {
      const texture = getCardTextureKey(card.type);
      const isPlayable = playableSet.has(card.id);
      const isHelperHighlighted = helperHighlightSet.has(card.id);
      const slot = this.getSlotTransform(index, hand.length);

      const image = this.scene.add.image(0, 0, texture);
      image.setDisplaySize(cardWidth, cardHeight);

      const glow = this.scene.add.rectangle(0, 0, cardWidth - 8, cardHeight - 8, 0xf8e08c, 0);
      glow.setStrokeStyle(
        isHelperHighlighted ? 4 : 2,
        isHelperHighlighted ? 0x74f7ff : 0xf8e08c,
        isPlayable ? 0.96 : 0.25,
      );

      const cardContainer = this.scene.add.container(slot.x, slot.y, [image, glow]);
      cardContainer.setDepth(121);
      cardContainer.setRotation(slot.rotation);

      if (!isPlayable) {
        cardContainer.setAlpha(0.42);
      } else {
        if (hasHelperFocus && !isHelperHighlighted) {
          cardContainer.setAlpha(0.58);
        }

        cardContainer.on('pointerover', () => {
          cardContainer.setScale(1.04);
          cardContainer.y = slot.y - 10;
        });
        cardContainer.on('pointerout', () => {
          cardContainer.setScale(1);
          cardContainer.y = slot.y;
        });
      }

      cardContainer.setSize(cardWidth, cardHeight);
      cardContainer.setInteractive(
        new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
        Phaser.Geom.Rectangle.Contains,
      );
      cardContainer.on('pointerdown', () => {
        this.handleCardPointerDown(card, isPlayable);
      });

      this.cardsRoot.add(cardContainer);
    });
  }

  setOnCardClick(callback: (cardId: string) => void): void {
    this.onCardClickCallback = callback;
  }

  destroy(): void {
    this.clearPendingSingleClick();
    this.hideCardPreview(false);
    this.root.destroy(true);
  }

  private handleCardPointerDown(card: CardState, isPlayable: boolean): void {
    if (this.pendingClickTimer && this.pendingClickCardId === card.id) {
      this.clearPendingSingleClick();
      this.showCardPreview(card);
      return;
    }

    if (this.pendingClickTimer) {
      const pendingCardId = this.pendingClickCardId;
      const pendingPlayable = this.pendingClickPlayable;
      this.clearPendingSingleClick();

      if (pendingCardId && pendingPlayable) {
        this.handleCardClick(pendingCardId);
      }
    }

    this.pendingClickCardId = card.id;
    this.pendingClickPlayable = isPlayable;
    this.pendingClickTimer = this.scene.time.delayedCall(DOUBLE_CLICK_MS, () => {
      const pendingCardId = this.pendingClickCardId;
      const pendingPlayable = this.pendingClickPlayable;
      this.clearPendingSingleClick();

      if (pendingCardId && pendingPlayable) {
        this.handleCardClick(pendingCardId);
      }
    });
  }

  private handleCardClick(cardId: string): void {
    if (this.onCardClickCallback) {
      this.onCardClickCallback(cardId);
    }

    const boardScene = this.scene.scene.get('BoardScene');
    boardScene.events.emit('card-clicked', cardId);
  }

  private clearPendingSingleClick(): void {
    if (this.pendingClickTimer) {
      this.pendingClickTimer.remove(false);
      this.pendingClickTimer = null;
    }

    this.pendingClickCardId = null;
    this.pendingClickPlayable = false;
  }

  private showCardPreview(card: CardState): void {
    this.hideCardPreview(false);

    const width = this.scene.scale.width || this.scene.cameras.main.width;
    const height = this.scene.scale.height || this.scene.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const texture = getCardTextureKey(card.type);

    const dimmer = this.scene.add.rectangle(centerX, centerY, width, height, 0x020617, 0.72);
    dimmer.setInteractive();
    dimmer.on('pointerdown', () => {
      this.hideCardPreview(true);
    });

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1b3a16, 0.96);
    panel.fillRoundedRect(centerX - 185, centerY - 250, 370, 500, 24);
    panel.lineStyle(4, 0xf4b73b, 0.95);
    panel.strokeRoundedRect(centerX - 185, centerY - 250, 370, 500, 24);
    panel.lineStyle(2, 0xfff0b8, 0.75);
    panel.strokeRoundedRect(centerX - 172, centerY - 237, 344, 474, 18);

    const title = this.scene.add.text(centerX, centerY - 208, card.displayName, {
      fontFamily: '"Playpen Sans", "Baloo 2", cursive',
      fontSize: '24px',
      color: '#fcd65a',
      stroke: '#4c1616',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 320 },
    });
    title.setOrigin(0.5);

    const image = this.scene.add.image(centerX, centerY + 28, texture);
    image.setDisplaySize(230, 340);

    const hint = this.scene.add.text(centerX, centerY + 220, 'Click ben ngoai de dong', {
      fontFamily: '"Playpen Sans", "Baloo 2", cursive',
      fontSize: '16px',
      color: '#fff3cc',
    });
    hint.setOrigin(0.5);

    const popupHitArea = this.scene.add.zone(centerX, centerY, 390, 520);
    popupHitArea.setInteractive();
    popupHitArea.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
      },
    );

    this.previewOverlay = this.scene.add.container(0, 0, [
      dimmer,
      panel,
      title,
      image,
      hint,
      popupHitArea,
    ]);
    this.previewOverlay.setDepth(500);

    const boardScene = this.scene.scene.get('BoardScene');
    boardScene.events.emit('card-preview-opened');
  }

  private hideCardPreview(emitClosed: boolean): void {
    if (!this.previewOverlay) return;

    this.previewOverlay.destroy(true);
    this.previewOverlay = null;

    if (emitClosed) {
      const boardScene = this.scene.scene.get('BoardScene');
      boardScene.events.emit('card-preview-closed');
    }
  }

  private getSlotTransform(index: number, count: number): { x: number; y: number; rotation: number } {
    if (count <= FIGMA_SLOT_OFFSETS.length) {
      const offset = Math.floor((FIGMA_SLOT_OFFSETS.length - count) / 2);
      const slotIndex = offset + index;
      return {
        x: FIGMA_SLOT_OFFSETS[slotIndex],
        y: FIGMA_SLOT_Y[slotIndex],
        rotation: FIGMA_SLOT_ROTATIONS[slotIndex],
      };
    }

    const spacing = 88;
    const startX = -((count - 1) * spacing) / 2;
    return {
      x: startX + index * spacing,
      y: 0,
      rotation: (index - (count - 1) / 2) * 0.018,
    };
  }
}
