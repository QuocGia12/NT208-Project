import Phaser from 'phaser';
import { CardState } from '../../types/game';

export class CardPanel {
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private width: number;

  private root: Phaser.GameObjects.Container;
  private cardsRoot: Phaser.GameObjects.Container;
  private titleText: Phaser.GameObjects.Text;
  private emptyText: Phaser.GameObjects.Text;

  private onCardClickCallback: ((cardId: string) => void) | null;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number = 860) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;

    this.onCardClickCallback = null;

    const background = this.scene.add.graphics();
    background.fillStyle(0x101a30, 0.92);
    background.fillRoundedRect(-this.width / 2, -44, this.width, 88, 12);
    background.lineStyle(2, 0x2f477a, 0.88);
    background.strokeRoundedRect(-this.width / 2, -44, this.width, 88, 12);

    this.titleText = this.scene.add.text(-this.width / 2 + 10, -58, 'Thẻ bài của bạn', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#cfdcff',
      fontStyle: 'bold',
    });
    this.titleText.setOrigin(0, 0.5);

    this.emptyText = this.scene.add.text(0, 0, 'Không có bài', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#9ab0dc',
    });
    this.emptyText.setOrigin(0.5);

    this.cardsRoot = this.scene.add.container(0, 0);

    this.root = this.scene.add.container(this.x, this.y, [background, this.titleText, this.cardsRoot, this.emptyText]);
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
    const cardWidth = 120;
    const cardHeight = 60;
    const gap = 12;

    const totalWidth = hand.length * cardWidth + (hand.length - 1) * gap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    hand.forEach((card, index) => {
      const isPlayable = playableSet.has(card.id);
      const isHelperHighlighted = helperHighlightSet.has(card.id);
      const cardX = startX + index * (cardWidth + gap);

      const cardContainer = this.scene.add.container(cardX, 0);
      cardContainer.setDepth(121);

      const cardGraphic = this.scene.add.graphics();
      const fillColor = isHelperHighlighted
        ? 0x1f3f5d
        : isPlayable
          ? 0x273b6a
          : 0x1a243c;
      const borderColor = isHelperHighlighted
        ? 0x58d6ff
        : isPlayable
          ? 0xf1c40f
          : 0x4f5f82;
      const borderWidth = isHelperHighlighted ? 3.5 : (isPlayable ? 3 : 1.5);
      const fillAlpha = isHelperHighlighted ? 0.96 : (isPlayable ? 0.96 : 0.78);

      cardGraphic.fillStyle(fillColor, fillAlpha);
      cardGraphic.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
      cardGraphic.lineStyle(borderWidth, borderColor, 0.95);
      cardGraphic.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

      const label = this.scene.add.text(0, 0, card.displayName, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#f0f4ff',
        align: 'center',
        wordWrap: { width: cardWidth - 16, useAdvancedWrap: true },
      });
      label.setOrigin(0.5);

      cardContainer.add([cardGraphic, label]);

      if (!isPlayable) {
        cardContainer.setAlpha(0.55);
      } else {
        if (hasHelperFocus && !isHelperHighlighted) {
          cardContainer.setAlpha(0.58);
        }

        cardContainer.setSize(cardWidth, cardHeight);
        cardContainer.setInteractive(
          new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
          Phaser.Geom.Rectangle.Contains
        );

        cardContainer.on('pointerover', () => {
          cardContainer.setScale(1.04);
        });
        cardContainer.on('pointerout', () => {
          cardContainer.setScale(1);
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
}
