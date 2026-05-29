import * as Phaser from 'phaser';
import { PublicPlayerState, TeamInfo } from '../../types/game';
import { getZodiacIconKey } from '../assets/gameUIAssets';

type PlayerCardEntry = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Image;
  wood: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Image;
  iconFrame: Phaser.GameObjects.Image;
  zodiacIcon: Phaser.GameObjects.Image;
  namePlateShadow: Phaser.GameObjects.Graphics;
  namePlate: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  progressLabel: Phaser.GameObjects.Text;
  progressValue: Phaser.GameObjects.Text;
  handLabel: Phaser.GameObjects.Text;
  handValue: Phaser.GameObjects.Text;
  distanceLabel: Phaser.GameObjects.Text;
  distanceValue: Phaser.GameObjects.Text;
};

export class PlayerInfoPanel {
  private scene: Phaser.Scene;
  private entries: PlayerCardEntry[];
  private cardWidth: number;
  private cardHeight: number;
  private splitLine: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, topY: number, cardWidth: number = 244, cardHeight: number = 136) {
    this.scene = scene;
    this.entries = [];
    this.cardWidth = cardWidth;
    this.cardHeight = cardHeight;
    this.splitLine = this.scene.add.image(0, 0, 'ui-player-line-split-team');

    const sameTeamGap = 6;
    const splitGap = 28;

    for (let i = 0; i < 4; i += 1) {
      const extraOffset = i >= 2 ? splitGap - sameTeamGap : 0;
      const y = topY + i * (cardHeight + sameTeamGap) + extraOffset;
      const entry = this.createEntry(x, y);
      this.entries.push(entry);
      this.setEntrySelected(entry, false);
    }

    const secondCardCenterY = topY + (cardHeight + sameTeamGap);
    const thirdCardCenterY = topY + (cardHeight + sameTeamGap) * 2 + (splitGap - sameTeamGap);
    const splitY = (secondCardCenterY + cardHeight / 2 + thirdCardCenterY - cardHeight / 2) / 2;
    this.drawSplitLine(x, splitY);
  }

  update(players: PublicPlayerState[], currentPlayerId: string, teams: TeamInfo[] = []): void {
    const sorted = [...players].sort((a, b) => a.turnIndex - b.turnIndex);

    this.entries.forEach((entry, index) => {
      const player = sorted[index];
      if (!player) {
        entry.nameText.setText('Dang cho nguoi choi...');
        entry.progressValue.setText('-');
        entry.handValue.setText('-');
        entry.distanceValue.setText('-');
        entry.zodiacIcon.setVisible(false);
        entry.container.setAlpha(0.72);
        this.setEntrySelected(entry, false);
        return;
      }

      const isCurrentTurn = player.id === currentPlayerId;
      this.setEntrySelected(entry, isCurrentTurn);
      entry.container.setAlpha(player.connected ? 1 : 0.84);

      const iconKey = getZodiacIconKey(player.zodiac);
      if (iconKey) {
        entry.zodiacIcon.setTexture(iconKey);
        entry.zodiacIcon.setVisible(true);
      } else {
        entry.zodiacIcon.setVisible(false);
      }

      entry.nameText.setText(player.name);
      entry.progressValue.setText(`${player.claimedCount}/5`);
      entry.handValue.setText(`${player.handSize}`);
      entry.distanceValue.setText(this.getDistanceText(player, players, teams));
    });
  }

  destroy(): void {
    this.entries.forEach((entry) => entry.container.destroy(true));
    this.splitLine.destroy();
    this.entries = [];
  }

  private createEntry(x: number, y: number): PlayerCardEntry {
    const halfWidth = this.cardWidth / 2;
    const halfHeight = this.cardHeight / 2;

    const background = this.scene.add.image(0, 0, 'ui-player-bg-normal');
    const wood = this.scene.add.image(0, 0, 'ui-player-wood-normal');
    const frame = this.scene.add.image(0, 0, 'ui-player-frame-normal');
    const iconFrame = this.scene.add.image(-halfWidth + 43, 0, 'ui-player-icon-normal');
    const zodiacIcon = this.scene.add.image(-halfWidth + 43, 0, 'ui-icon-tys');

    background.setDisplaySize(this.cardWidth, this.cardHeight);
    frame.setDisplaySize(this.cardWidth, this.cardHeight);
    wood.setDisplaySize(86, 119);
    wood.setPosition(-77, -1);
    iconFrame.setDisplaySize(97, 96);
    iconFrame.setPosition(-77, -1);
    zodiacIcon.setDisplaySize(44, 58);
    zodiacIcon.setPosition(-77, -1);

    const namePlateShadow = this.scene.add.graphics();
    const namePlate = this.scene.add.graphics();

    const sharedTextStyle = {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#971D1D',
    } as const;

    const nameText = this.scene.add.text(49, -halfHeight + 27, '', {
      ...sharedTextStyle,
      fontSize: '15px',
      align: 'center',
      wordWrap: { width: 116 },
    });
    nameText.setOrigin(0.5);

    const progressLabel = this.scene.add.text(-15, -7, 'Tiến độ:', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    progressLabel.setOrigin(0, 0.5);

    const progressValue = this.scene.add.text(68, -7, '0/5', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    progressValue.setOrigin(0, 0.5);

    const handLabel = this.scene.add.text(-15, 17, 'Số thẻ bài:', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    handLabel.setOrigin(0, 0.5);

    const handValue = this.scene.add.text(81, 17, '0', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    handValue.setOrigin(0, 0.5);

    const distanceLabel = this.scene.add.text(-15, 40, 'Khoảng cách:', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    distanceLabel.setOrigin(0, 0.5);

    const distanceValue = this.scene.add.text(81, 40, '0', {
      ...sharedTextStyle,
      fontSize: '15px',
    });
    distanceValue.setOrigin(0, 0.5);

    const container = this.scene.add.container(x, y, [
      background,
      wood,
      frame,
      iconFrame,
      zodiacIcon,
      namePlateShadow,
      namePlate,
      nameText,
      progressLabel,
      progressValue,
      handLabel,
      handValue,
      distanceLabel,
      distanceValue,
    ]);
    container.setDepth(110);

    return {
      container,
      background,
      wood,
      frame,
      iconFrame,
      zodiacIcon,
      namePlateShadow,
      namePlate,
      nameText,
      progressLabel,
      progressValue,
      handLabel,
      handValue,
      distanceLabel,
      distanceValue,
    };
  }

  private setEntrySelected(entry: PlayerCardEntry, selected: boolean): void {
    entry.background.setTexture(selected ? 'ui-player-bg-selected' : 'ui-player-bg-normal');
    entry.wood.setTexture(selected ? 'ui-player-wood-selected' : 'ui-player-wood-normal');
    entry.frame.setTexture(selected ? 'ui-player-frame-selected' : 'ui-player-frame-normal');
    entry.iconFrame.setTexture(selected ? 'ui-player-icon-selected' : 'ui-player-icon-normal');
    this.drawNamePlate(entry, selected);
  }

  private drawNamePlate(entry: PlayerCardEntry, selected: boolean): void {
    const plateWidth = 140;
    const plateHeight = 34;
    const plateX = 49 - plateWidth / 2;
    const plateY = -this.cardHeight / 2 + 10;
    const borderColor = selected ? 0x7c3817 : 0x704022;
    const topColor = selected ? 0xf9cf84 : 0xf3bf71;
    const bottomColor = selected ? 0xf4b657 : 0xeeb35c;

    entry.namePlateShadow.clear();
    entry.namePlateShadow.fillStyle(0x6a3217, 0.38);
    entry.namePlateShadow.fillRoundedRect(plateX + 2, plateY + 3, plateWidth, plateHeight, 15);

    entry.namePlate.clear();
    entry.namePlate.fillStyle(borderColor, 1);
    entry.namePlate.fillRoundedRect(plateX, plateY, plateWidth, plateHeight, 15);
    entry.namePlate.fillStyle(topColor, 1);
    entry.namePlate.fillRoundedRect(plateX + 3, plateY + 3, plateWidth - 6, plateHeight - 6, 12);
    entry.namePlate.fillStyle(bottomColor, 0.96);
    entry.namePlate.fillRoundedRect(plateX + 3, plateY + 16, plateWidth - 6, plateHeight - 19, 11);
    entry.namePlate.lineStyle(1.5, 0xffe4aa, 0.45);
    entry.namePlate.strokeRoundedRect(plateX + 5, plateY + 4, plateWidth - 10, plateHeight - 9, 10);
  }

  private getDistanceText(player: PublicPlayerState, players: PublicPlayerState[], teams: TeamInfo[]): string {
    const team = teams.find((item) => item.teamId === player.teamId);
    if (!team) {
      return '-';
    }

    const teammateId = team.playerIds.find((id) => id !== player.id);
    if (!teammateId) {
      return '-';
    }

    const teammate = players.find((item) => item.id === teammateId);
    if (!teammate || !player.hasSpawned || !teammate.hasSpawned) {
      return '-';
    }

    const rawDx = Math.abs(player.position.x - teammate.position.x);
    const rawDy = Math.abs(player.position.y - teammate.position.y);
    const gapX = rawDx > 0 ? rawDx - 1 : 0;
    const gapY = rawDy > 0 ? rawDy - 1 : 0;
    return `${Math.floor(Math.sqrt(gapX * gapX + gapY * gapY))}`;
  }

  private drawSplitLine(centerX: number, y: number): void {
    this.splitLine.setDepth(121);
    this.splitLine.setPosition(centerX, y);
    this.splitLine.setDisplaySize(this.cardWidth + 18, 5);
  }
}
