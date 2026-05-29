import * as Phaser from 'phaser';
import { CardState } from '../../types/game';
import { getCardTextureKey } from '../assets/gameUIAssets';

const FIGMA_SLOT_OFFSETS = [-233, -140, -47, 47, 140, 233];
const FIGMA_SLOT_ROTATIONS = [-0.055, -0.03, -0.012, 0.012, 0.03, 0.055];
const FIGMA_SLOT_Y = [2, 0, -2, -2, 0, 2];

export class CardPanel {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;

  private root: Phaser.GameObjects.Container;
  private cardsRoot: Phaser.GameObjects.Container;
  private emptyText: Phaser.GameObjects.Text;
  private onCardClickCallback: ((cardId: string) => void) | null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.onCardClickCallback = null;

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

        cardContainer.setSize(cardWidth, cardHeight);
        cardContainer.setInteractive(
          new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
          Phaser.Geom.Rectangle.Contains,
        );
        cardContainer.on('pointerover', () => {
          cardContainer.setScale(1.04);
          cardContainer.y = slot.y - 10;
        });
        cardContainer.on('pointerout', () => {
          cardContainer.setScale(1);
          cardContainer.y = slot.y;
        });
        cardContainer.on('pointerdown', () => {
          this.handleCardClick(card.id);
        });
      }

      this.cardsRoot.add(cardContainer);
    });
  }

  setOnCardClick(callback: (cardId: string) => void): void {
    this.onCardClickCallback = callback;
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private handleCardClick(cardId: string): void {
    if (this.onCardClickCallback) {
      this.onCardClickCallback(cardId);
    }

    const boardScene = this.scene.scene.get('BoardScene');
    boardScene.events.emit('card-clicked', cardId);
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
