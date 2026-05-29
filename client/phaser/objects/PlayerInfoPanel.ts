import * as Phaser from 'phaser';
import { PublicPlayerState, TeamInfo } from '../../types/game';
import { BoardRenderer } from './BoardRenderer';

type PlayerCardEntry = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  token: Phaser.GameObjects.Graphics;
  turnMarker: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  zodiacText: Phaser.GameObjects.Text;
  progressText: Phaser.GameObjects.Text;
  handText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  warningText: Phaser.GameObjects.Text;
};

export class PlayerInfoPanel {
  private scene: Phaser.Scene;
  private entries: PlayerCardEntry[];

  constructor(scene: Phaser.Scene, x: number, topY: number, cardWidth: number = 190, cardHeight: number = 145) {
    this.scene = scene;
    this.entries = [];

    const gap = 10;

    for (let i = 0; i < 4; i++) {
      const y = topY + i * (cardHeight + gap);

      const background = this.scene.add.graphics();
      const token = this.scene.add.graphics();

      const turnMarker = this.scene.add.text(-cardWidth / 2 + 10, -cardHeight / 2 + 10, '', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffd36d',
        fontStyle: 'bold',
      });
      turnMarker.setOrigin(0, 0);

      const nameText = this.scene.add.text(-cardWidth / 2 + 42, -cardHeight / 2 + 12, '---', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#f0f4ff',
        fontStyle: 'bold',
      });
      nameText.setOrigin(0, 0);

      const zodiacText = this.scene.add.text(-cardWidth / 2 + 42, -cardHeight / 2 + 34, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#c8d7ff',
      });
      zodiacText.setOrigin(0, 0);

      const progressText = this.scene.add.text(-cardWidth / 2 + 10, -cardHeight / 2 + 62, '', {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: '#d9e4ff',
      });
      progressText.setOrigin(0, 0);

      const handText = this.scene.add.text(-cardWidth / 2 + 10, -cardHeight / 2 + 86, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#d9e4ff',
      });
      handText.setOrigin(0, 0);

      const statusText = this.scene.add.text(-cardWidth / 2 + 10, -cardHeight / 2 + 108, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#9fc1ff',
      });
      statusText.setOrigin(0, 0);

      const warningText = this.scene.add.text(-cardWidth / 2 + 10, -cardHeight / 2 + 126, '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ff9c9c',
      });
      warningText.setOrigin(0, 0);

      const container = this.scene.add.container(x, y, [
        background,
        token,
        turnMarker,
        nameText,
        zodiacText,
        progressText,
        handText,
        statusText,
        warningText,
      ]);
      container.setDepth(110);

      this.entries.push({
        container,
        background,
        token,
        turnMarker,
        nameText,
        zodiacText,
        progressText,
        handText,
        statusText,
        warningText,
      });

      this.drawCardBackground(background, cardWidth, cardHeight, false, false);
      token.fillStyle(0x657292, 0.9);
      token.fillCircle(-cardWidth / 2 + 24, -cardHeight / 2 + 24, 12);
      token.lineStyle(2, 0x0f1118, 0.9);
      token.strokeCircle(-cardWidth / 2 + 24, -cardHeight / 2 + 24, 12);
    }
  }

  update(players: PublicPlayerState[], currentPlayerId: string, teams: TeamInfo[] = []): void {
    const sorted = [...players].sort((a, b) => a.turnIndex - b.turnIndex);

    this.entries.forEach((entry, index) => {
      const player = sorted[index];
      if (!player) {
        entry.turnMarker.setText('');
        entry.nameText.setText('Dang cho nguoi choi...');
        entry.zodiacText.setText('');
        entry.progressText.setText('');
        entry.handText.setText('');
        entry.statusText.setText('');
        entry.warningText.setText('');
        entry.container.setAlpha(0.7);
        return;
      }

      const isCurrentTurn = player.id === currentPlayerId;

      this.drawCardBackground(entry.background, 190, 145, isCurrentTurn, false);

      const color = BoardRenderer.PLAYER_COLORS[player.turnIndex % BoardRenderer.PLAYER_COLORS.length];
      entry.token.clear();
      entry.token.fillStyle(color, 1);
      entry.token.fillCircle(-95 + 24, -72 + 24, 12);
      entry.token.lineStyle(2, 0x0f1118, 0.9);
      entry.token.strokeCircle(-95 + 24, -72 + 24, 12);

      // Test 7: Show team label
      const teamLabel = player.teamId === 'team1' ? '[T1]' : '[T2]';
      entry.turnMarker.setText(isCurrentTurn ? `${teamLabel} >` : teamLabel);
      entry.nameText.setText(player.name);
      entry.zodiacText.setText(`Con giÃ¡p: ${player.zodiac}`);
      // Test 7: Progress out of 5 per player
      entry.progressText.setText(`Tiáº¿n Ä‘á»™: ${this.buildProgress(player.claimedCount)} (${player.claimedCount}/5)`);
      // Test 7: Show tether length
      const team = teams.find(t => t.teamId === player.teamId);
      const tetherStr = team ? `DÃ¢y: ${team.tetherLength} | Team: ${team.totalClaimed}/10` : '';
      entry.handText.setText(`Tháº» bÃ i: x${player.handSize}  ${tetherStr}`);

      const isLocked = Boolean(player.isLocked || player.skipNextTurn);
      if (isLocked) {
        entry.statusText.setText('Bá»‹ khÃ³a: bá» lÆ°á»£t tiáº¿p theo');
        entry.statusText.setColor('#ffd36d');
      } else {
        entry.statusText.setText('Äang chÆ¡i');
        entry.statusText.setColor('#9fc1ff');
      }

      if (!player.connected) {
        entry.warningText.setText('! Máº¥t káº¿t ná»‘i');
      } else {
        entry.warningText.setText('');
      }

      entry.container.setAlpha(1);
    });
  }

  destroy(): void {
    this.entries.forEach(entry => {
      entry.container.destroy(true);
    });
    this.entries = [];
  }

  private buildProgress(claimedCount: number): string {
    const safeClaimed = Phaser.Math.Clamp(claimedCount, 0, 5);
    const filled = '|'.repeat(safeClaimed);
    const empty = '?'.repeat(5 - safeClaimed);
    return `${filled}${empty}`;
  }

  private drawCardBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    isCurrentTurn: boolean,
    isEliminated: boolean
  ): void {
    graphics.clear();

    let fill = 0x101a30;
    let border = 0x2f477a;

    if (isEliminated) {
      fill = 0x2a2a2a;
      border = 0x656565;
    } else if (isCurrentTurn) {
      fill = 0x1a2d57;
      border = 0xf1c40f;
    }

    graphics.fillStyle(fill, 0.96);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    graphics.lineStyle(isCurrentTurn ? 3 : 2, border, 0.95);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
  }
}
