import Phaser from 'phaser';
import { SocketClient } from '../../lib/SocketClient';
import {
  CardState,
  Direction,
  Phase,
  Phase1Context,
  Phase2Context,
  Phase3Context,
  PublicGameState,
  PublicPlayerState,
} from '../../types/game';
import { CardPanel } from '../objects/CardPanel';
import { DiceDisplay } from '../objects/DiceDisplay';
import { PlayerInfoPanel } from '../objects/PlayerInfoPanel';
import { TimerBar } from '../objects/TimerBar';

type RevealPopup = {
  container: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  cardText: Phaser.GameObjects.Text;
};

type EliminationBanner = {
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
};

type GameOverOverlay = {
  container: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Container;
};

type StopPhaseButton = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
};

type DiscardOverlay = {
  container: Phaser.GameObjects.Container;
  instruction: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  cardsRoot: Phaser.GameObjects.Container;
  confirmButton: Phaser.GameObjects.Container;
  confirmLabel: Phaser.GameObjects.Text;
};

type MovementPadButton = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  direction: Direction;
  enabled: boolean;
};

type MovementPad = {
  container: Phaser.GameObjects.Container;
  buttons: Map<Direction, MovementPadButton>;
};

export class UIScene extends Phaser.Scene {
  private diceDisplay!: DiceDisplay;
  private timerBar!: TimerBar;
  private cardPanel!: CardPanel;
  private playerInfoPanel!: PlayerInfoPanel;

  private revealPopup!: RevealPopup;
  private eliminationBanner!: EliminationBanner;
  private gameOverOverlay!: GameOverOverlay;
  private stopPhaseButton!: StopPhaseButton;
  private discardOverlay!: DiscardOverlay;
  private movementPad!: MovementPad;

  private localPlayerId = '';
  private myHand: CardState[] = [];
  private myPlayableCards: string[] = [];
  private helperHighlightCardIds: string[] = [];

  private boardSceneRef: Phaser.Scene | null = null;
  private currentState: PublicGameState | null = null;

  private eliminationHideEvent: Phaser.Time.TimerEvent | null = null;
  private revealVisible = false;
  private rollingShown = false;
  private discardRequiredCount = 0;
  private discardExpiresAt = 0;
  private discardSelected = new Set<string>();

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.localPlayerId = String(this.game.registry.get('playerId') ?? '');

    this.createLayoutPanels();

    this.diceDisplay = new DiceDisplay(this, 1180, 220);
    this.timerBar = new TimerBar(this, 640, 24, 300, 8);
    this.cardPanel = new CardPanel(this, 640, 670, 860);
    this.playerInfoPanel = new PlayerInfoPanel(this, 100, 95, 190, 145);

    this.cardPanel.setOnCardClick(() => {
      // BoardScene receives card-clicked via CardPanel emission.
    });

    this.createRevealPopup();
    this.createEliminationBanner();
    this.createGameOverOverlay();
    this.createStopPhaseButton();
    this.createDiscardOverlay();
    this.createMovementPad();

    this.bindBoardSceneEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  update(): void {
    this.timerBar.update();
    this.updateDiscardOverlayTimer();
  }

  private bindBoardSceneEvents(): void {
    const boardScene = this.scene.get('BoardScene');
    this.boardSceneRef = boardScene;

    boardScene.events.on('state-update', this.onStateUpdate, this);
    boardScene.events.on('private-update', this.onPrivateUpdate, this);
    boardScene.events.on('card-public-reveal', this.onCardPublicReveal, this);
    boardScene.events.on('card-reveal-ended', this.onCardRevealEnded, this);
    boardScene.events.on('player-eliminated', this.onPlayerEliminated, this);
    boardScene.events.on('game-over', this.onGameOver, this);
    boardScene.events.on('change-teammate-helper-options', this.onHelperHighlightChanged, this);
    boardScene.events.on('discard-required', this.onDiscardRequired, this);
    boardScene.events.on('discard-resolved', this.onDiscardResolved, this);
    boardScene.events.on('movement-direction-used', this.onMovementDirectionUsed, this);
  }

  private cleanup(): void {
    if (this.boardSceneRef) {
      this.boardSceneRef.events.off('state-update', this.onStateUpdate, this);
      this.boardSceneRef.events.off('private-update', this.onPrivateUpdate, this);
      this.boardSceneRef.events.off('card-public-reveal', this.onCardPublicReveal, this);
      this.boardSceneRef.events.off('card-reveal-ended', this.onCardRevealEnded, this);
      this.boardSceneRef.events.off('player-eliminated', this.onPlayerEliminated, this);
      this.boardSceneRef.events.off('game-over', this.onGameOver, this);
      this.boardSceneRef.events.off('change-teammate-helper-options', this.onHelperHighlightChanged, this);
      this.boardSceneRef.events.off('discard-required', this.onDiscardRequired, this);
      this.boardSceneRef.events.off('discard-resolved', this.onDiscardResolved, this);
      this.boardSceneRef.events.off('movement-direction-used', this.onMovementDirectionUsed, this);
    }

    if (this.eliminationHideEvent) {
      this.eliminationHideEvent.remove(false);
      this.eliminationHideEvent = null;
    }

    this.diceDisplay.destroy();
    this.timerBar.destroy();
    this.cardPanel.destroy();
    this.playerInfoPanel.destroy();

    this.revealPopup.container.destroy(true);
    this.eliminationBanner.container.destroy(true);
    this.gameOverOverlay.container.destroy(true);
    this.stopPhaseButton.container.destroy(true);
    this.discardOverlay.container.destroy(true);
    this.movementPad.container.destroy(true);
  }

  private onStateUpdate(state: PublicGameState): void {
    this.currentState = state;

    const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
    this.playerInfoPanel.update(state.players, currentPlayerId, state.teams ?? []);

    this.handlePhaseUI(state);
    this.handleRevealFromState(state);
  }

  private onPrivateUpdate(data: { playerId?: string; myHand: CardState[]; myPlayableCards: string[] }): void {
    if (typeof data?.playerId === 'string' && data.playerId.length > 0) {
      this.localPlayerId = data.playerId;
    }

    this.myHand = Array.isArray(data?.myHand) ? data.myHand : [];
    this.myPlayableCards = Array.isArray(data?.myPlayableCards) ? data.myPlayableCards : [];

    this.cardPanel.render(this.myHand, this.myPlayableCards, this.helperHighlightCardIds);
    if (this.discardOverlay.container.visible) {
      this.discardSelected.forEach(cardId => {
        if (!this.myHand.some(card => card.id === cardId)) {
          this.discardSelected.delete(cardId);
        }
      });
      this.renderDiscardOverlayCards();
    }
  }

  private onHelperHighlightChanged(payload: { helperCardIds?: string[] }): void {
    this.helperHighlightCardIds = Array.isArray(payload?.helperCardIds) ? payload.helperCardIds : [];
    this.cardPanel.render(this.myHand, this.myPlayableCards, this.helperHighlightCardIds);
  }

  private onDiscardRequired(data: any): void {
    const requiredCount = typeof data?.requiredCount === 'number' ? data.requiredCount : 0;
    const expiresAt = typeof data?.expiresAt === 'number' ? data.expiresAt : Date.now();
    if (requiredCount <= 0) {
      this.hideDiscardOverlay();
      return;
    }

    this.discardRequiredCount = requiredCount;
    this.discardExpiresAt = expiresAt;
    this.discardSelected.clear();
    this.discardOverlay.container.setVisible(true);
    this.renderDiscardOverlayCards();
  }

  private onDiscardResolved(): void {
    this.hideDiscardOverlay();
  }

  private onMovementDirectionUsed(direction: Direction): void {
    this.flashMovementPadButton(direction);
  }

  private onCardPublicReveal(data: any): void {
    const playerName = typeof data?.playerName === 'string' ? data.playerName : 'Người chơi';
    const cardName = typeof data?.card?.displayName === 'string' ? data.card.displayName : 'Thẻ bí ẩn';
    this.showRevealPopup(`${playerName} rút được:`, cardName);
  }

  private onCardRevealEnded(): void {
    this.hideRevealPopup();
  }

  private onPlayerEliminated(data: any): void {
    const playerName = typeof data?.playerName === 'string' ? data.playerName : 'Người chơi';

    // Test 7: respawn banner instead of elimination
    const cellsLost = typeof data?.cellsLost === 'number' ? data.cellsLost : 0;
    this.eliminationBanner.text.setText(`${playerName} bị kẹt! Mất ${cellsLost} ô, hồi sinh!`);
    this.eliminationBanner.container.setVisible(true);
    this.eliminationBanner.container.alpha = 0;

    this.tweens.killTweensOf(this.eliminationBanner.container);
    this.tweens.add({
      targets: this.eliminationBanner.container,
      alpha: 1,
      duration: 180,
      ease: 'Sine.Out',
    });

    if (this.eliminationHideEvent) {
      this.eliminationHideEvent.remove(false);
    }

    this.eliminationHideEvent = this.time.addEvent({
      delay: 3000,
      callback: () => {
        this.tweens.add({
          targets: this.eliminationBanner.container,
          alpha: 0,
          duration: 260,
          onComplete: () => {
            this.eliminationBanner.container.setVisible(false);
          },
        });
      },
    });
  }

  private onGameOver(data: any): void {
    // Test 7: Team-based winner
    const winnerNames = Array.isArray(data?.winner?.playerNames)
      ? data.winner.playerNames.join(' & ')
      : 'Unknown';
    const teamId = data?.winner?.teamId ?? '';
    this.gameOverOverlay.title.setText(`Team thắng: ${teamId}\n${winnerNames}`);
    this.setStopPhaseButtonVisible(false);
    this.setMovementPadVisible(false);

    const statsLines: string[] = [];
    const finalPlayers = (data?.finalState?.players ?? []) as PublicPlayerState[];
    if (Array.isArray(finalPlayers) && finalPlayers.length > 0) {
      finalPlayers
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex)
        .forEach(player => {
          const teamLabel = player.teamId === 'team1' ? '[T1]' : '[T2]';
          statsLines.push(`${teamLabel} ${player.name}: ${player.claimedCount}/5 ô`);
        });
    }

    // Show team totals
    const claimedByTeam = data?.stats?.claimedByTeam as Record<string, number> | undefined;
    if (claimedByTeam) {
      statsLines.push('');
      for (const [tid, count] of Object.entries(claimedByTeam)) {
        statsLines.push(`${tid}: ${count}/10`);
      }
    }

    this.gameOverOverlay.stats.setText(statsLines.join('\n'));
    this.gameOverOverlay.container.setVisible(true);
    this.gameOverOverlay.container.alpha = 0;

    this.tweens.killTweensOf(this.gameOverOverlay.container);
    this.tweens.add({
      targets: this.gameOverOverlay.container,
      alpha: 1,
      duration: 260,
      ease: 'Sine.Out',
    });
  }

  private handlePhaseUI(state: PublicGameState): void {
    const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
    const isMyTurn = currentPlayerId === this.localPlayerId;

    if (state.currentPhase === Phase.PICK_SPAWN) {
      this.timerBar.stop();
      this.timerBar.showLabel(isMyTurn ? 'Chọn ô xuất phát...' : 'Người khác đang chọn ô xuất phát');
      this.diceDisplay.hide();
      this.setStopPhaseButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.DRAW_CARD) {
      this.timerBar.stop();
      this.timerBar.showLabel('Rút bài...');
      this.diceDisplay.hide();
      this.rollingShown = false;
      this.setStopPhaseButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.ROLL_DICE && state.phaseContext.phase === 1) {
      const phase1 = state.phaseContext as Phase1Context;
      this.timerBar.stop();

      if (phase1.diceResult === null) {
        this.timerBar.showLabel('Đang đổ xúc xắc...');
        if (!this.rollingShown) {
          const duration = Math.max(200, phase1.rollEndAt - Date.now());
          this.diceDisplay.rollAnimation(duration);
          this.rollingShown = true;
        }
      } else {
        this.timerBar.showLabel(`Xúc xắc: ${phase1.diceResult}`);
        this.diceDisplay.showResult(phase1.diceResult);
        this.rollingShown = false;
      }
      this.setStopPhaseButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.MOVE && state.phaseContext.phase === 3) {
      const phase2 = state.phaseContext as Phase2Context;
      this.timerBar.stop();
      this.timerBar.showLabel(`Di chuyển: ${phase2.stepsRemaining} bước`);
      this.diceDisplay.showResult(phase2.diceResult);
      this.rollingShown = false;
      this.setStopPhaseButtonVisible(false);
      this.setMovementPadVisible(isMyTurn);
      if (isMyTurn) {
        this.updateMovementPad(phase2.validDirections);
      }
      return;
    }

    if (
      state.currentPhase === Phase.PLAY_CARD
      && (state.phaseContext.phase === 2 || state.phaseContext.phase === 4)
    ) {
      const phase3 = state.phaseContext as Phase3Context;
      const phaseLabel = phase3.phase === 2 ? 'Phase 2: Dùng bài (60s)' : 'Phase 4: Dùng bài (60s)';
      this.timerBar.showLabel(phaseLabel);
      this.timerBar.startCountdown(phase3.timerExpiresAt);
      this.rollingShown = false;
      this.setStopPhaseButtonVisible(isMyTurn);
      this.setMovementPadVisible(false);
      return;
    }

    this.timerBar.stop();
    this.timerBar.showLabel('');
    this.setStopPhaseButtonVisible(false);
    this.setMovementPadVisible(false);
  }

  private handleRevealFromState(state: PublicGameState): void {
    if (!state.publicReveal) {
      this.hideRevealPopup();
      return;
    }

    const player = state.players.find(p => p.id === state.publicReveal?.playerId);
    const playerName = player?.name ?? 'Người chơi';
    this.showRevealPopup(`${playerName} rút được:`, state.publicReveal.card.displayName);
  }

  private createLayoutPanels(): void {
    const g = this.add.graphics();
    g.setDepth(70);

    // Left panel
    g.fillStyle(0x0e162a, 0.82);
    g.fillRect(0, 0, 200, 720);
    g.lineStyle(2, 0x273b68, 0.9);
    g.strokeRect(0, 0, 200, 720);

    // Right panel
    g.fillStyle(0x0e162a, 0.82);
    g.fillRect(1080, 0, 200, 720);
    g.lineStyle(2, 0x273b68, 0.9);
    g.strokeRect(1080, 0, 200, 720);

    // Bottom bar
    g.fillStyle(0x0b1325, 0.9);
    g.fillRect(200, 620, 880, 100);
    g.lineStyle(2, 0x273b68, 0.9);
    g.strokeRect(200, 620, 880, 100);
  }

  private createRevealPopup(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x0f1830, 0.96);
    bg.fillRoundedRect(-210, -62, 420, 124, 12);
    bg.lineStyle(2, 0xf1c40f, 0.95);
    bg.strokeRoundedRect(-210, -62, 420, 124, 12);

    const title = this.add.text(0, -18, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f5d56f',
      fontStyle: 'bold',
      align: 'center',
    });
    title.setOrigin(0.5);

    const cardText = this.add.text(0, 20, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    });
    cardText.setOrigin(0.5);

    const container = this.add.container(640, 300, [bg, title, cardText]);
    container.setDepth(300);
    container.setVisible(false);

    this.revealPopup = { container, title, cardText };
  }

  private createEliminationBanner(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x4a1f1f, 0.94);
    bg.fillRoundedRect(-280, -22, 560, 44, 10);
    bg.lineStyle(2, 0xff8b8b, 0.95);
    bg.strokeRoundedRect(-280, -22, 560, 44, 10);

    const text = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffe6e6',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    const container = this.add.container(640, 58, [bg, text]);
    container.setDepth(310);
    container.setVisible(false);

    this.eliminationBanner = { container, text };
  }

  private createGameOverOverlay(): void {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.72);
    backdrop.fillRect(0, 0, 1280, 720);

    const panel = this.add.graphics();
    panel.fillStyle(0x111c35, 0.97);
    panel.fillRoundedRect(-260, -190, 520, 380, 14);
    panel.lineStyle(2, 0x3a5ea1, 0.95);
    panel.strokeRoundedRect(-260, -190, 520, 380, 14);

    const title = this.add.text(0, -130, 'Game Over', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#ffe58c',
      fontStyle: 'bold',
      align: 'center',
    });
    title.setOrigin(0.5);

    const stats = this.add.text(0, -10, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#d9e6ff',
      align: 'center',
      lineSpacing: 8,
    });
    stats.setOrigin(0.5);

    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(0x2f6cff, 0.96);
    buttonBg.fillRoundedRect(-110, -24, 220, 48, 10);
    buttonBg.lineStyle(2, 0x8eb6ff, 0.9);
    buttonBg.strokeRoundedRect(-110, -24, 220, 48, 10);

    const buttonText = this.add.text(0, 0, 'Ve Lobby', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    buttonText.setOrigin(0.5);

    const button = this.add.container(0, 130, [buttonBg, buttonText]);
    button.setSize(220, 48);
    button.setInteractive(new Phaser.Geom.Rectangle(-110, -24, 220, 48), Phaser.Geom.Rectangle.Contains);

    button.on('pointerover', () => {
      button.setScale(1.04);
    });
    button.on('pointerout', () => {
      button.setScale(1);
    });
    button.on('pointerdown', () => {
      this.events.emit('ui:go_lobby');
      if (this.boardSceneRef) {
        this.boardSceneRef.events.emit('ui:go_lobby');
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    });

    const container = this.add.container(640, 360, [backdrop, panel, title, stats, button]);
    container.setDepth(350);
    container.setVisible(false);

    this.gameOverOverlay = {
      container,
      title,
      stats,
      button,
    };
  }

  private createDiscardOverlay(): void {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.72);
    backdrop.fillRect(0, 0, 1280, 720);

    const panel = this.add.graphics();
    panel.fillStyle(0x152443, 0.98);
    panel.fillRoundedRect(-360, -170, 720, 340, 14);
    panel.lineStyle(2, 0x6f9eff, 0.95);
    panel.strokeRoundedRect(-360, -170, 720, 340, 14);

    const instruction = this.add.text(0, -120, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f4f8ff',
      fontStyle: 'bold',
      align: 'center',
    });
    instruction.setOrigin(0.5);

    const timerText = this.add.text(0, -84, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffd46b',
      align: 'center',
    });
    timerText.setOrigin(0.5);

    const cardsRoot = this.add.container(0, 0);

    const confirmBg = this.add.graphics();
    confirmBg.fillStyle(0x2f6cff, 0.96);
    confirmBg.fillRoundedRect(-90, -22, 180, 44, 10);
    confirmBg.lineStyle(2, 0x8eb6ff, 0.95);
    confirmBg.strokeRoundedRect(-90, -22, 180, 44, 10);

    const confirmLabel = this.add.text(0, 0, 'Xác nhận', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    confirmLabel.setOrigin(0.5);

    const confirmButton = this.add.container(0, 120, [confirmBg, confirmLabel]);
    confirmButton.setSize(180, 44);
    confirmButton.setInteractive(
      new Phaser.Geom.Rectangle(-90, -22, 180, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    confirmButton.on('pointerover', () => {
      if (confirmButton.alpha >= 0.99) confirmButton.setScale(1.04);
    });
    confirmButton.on('pointerout', () => {
      confirmButton.setScale(1);
    });
    confirmButton.on('pointerdown', () => {
      if (this.discardSelected.size !== this.discardRequiredCount) return;
      SocketClient.getInstance().sendDiscardCards([...this.discardSelected]);
    });

    const container = this.add.container(640, 360, [
      backdrop,
      panel,
      instruction,
      timerText,
      cardsRoot,
      confirmButton,
    ]);
    container.setDepth(340);
    container.setVisible(false);

    this.discardOverlay = {
      container,
      instruction,
      timerText,
      cardsRoot,
      confirmButton,
      confirmLabel,
    };
  }

  private renderDiscardOverlayCards(): void {
    this.discardOverlay.cardsRoot.removeAll(true);

    const cards = [...this.myHand];
    const cardWidth = 128;
    const cardHeight = 64;
    const gap = 14;
    const totalWidth = cards.length * cardWidth + Math.max(0, cards.length - 1) * gap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const cardX = startX + index * (cardWidth + gap);
      const selected = this.discardSelected.has(card.id);

      const cardContainer = this.add.container(cardX, 6);
      cardContainer.setSize(cardWidth, cardHeight);
      cardContainer.setInteractive(
        new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
        Phaser.Geom.Rectangle.Contains,
      );

      const g = this.add.graphics();
      g.fillStyle(selected ? 0x5d1e1e : 0x243559, 0.96);
      g.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
      g.lineStyle(2.5, selected ? 0xff7f7f : 0x8eb6ff, 0.95);
      g.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

      const text = this.add.text(0, 0, card.displayName, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#f4f8ff',
        align: 'center',
        wordWrap: { width: cardWidth - 14, useAdvancedWrap: true },
      });
      text.setOrigin(0.5);

      cardContainer.add([g, text]);
      cardContainer.on('pointerdown', () => {
        if (this.discardSelected.has(card.id)) {
          this.discardSelected.delete(card.id);
        } else if (this.discardSelected.size < this.discardRequiredCount) {
          this.discardSelected.add(card.id);
        }
        this.renderDiscardOverlayCards();
      });
      cardContainer.on('pointerover', () => {
        cardContainer.setScale(1.04);
      });
      cardContainer.on('pointerout', () => {
        cardContainer.setScale(1);
      });

      this.discardOverlay.cardsRoot.add(cardContainer);
    });

    const selectedCount = this.discardSelected.size;
    this.discardOverlay.instruction.setText(`Chọn ${this.discardRequiredCount} lá bài để bỏ (${selectedCount}/${this.discardRequiredCount})`);
    const canConfirm = selectedCount === this.discardRequiredCount;
    this.discardOverlay.confirmButton.alpha = canConfirm ? 1 : 0.45;
    this.discardOverlay.confirmButton.setScale(1);
    this.discardOverlay.confirmLabel.setText(canConfirm ? 'Xác nhận' : 'Chọn đủ lá');
  }

  private updateDiscardOverlayTimer(): void {
    if (!this.discardOverlay.container.visible) return;
    const remainingMs = Math.max(0, this.discardExpiresAt - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    this.discardOverlay.timerText.setText(`Tự động random sau: ${remainingSec}s`);
  }

  private hideDiscardOverlay(): void {
    this.discardRequiredCount = 0;
    this.discardExpiresAt = 0;
    this.discardSelected.clear();
    this.discardOverlay.cardsRoot.removeAll(true);
    this.discardOverlay.container.setVisible(false);
  }

  private createMovementPad(): void {
    const root = this.add.container(1180, 520);
    root.setDepth(135);
    root.setVisible(false);

    const title = this.add.text(0, -92, 'Di chuyển', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#cfdcff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    root.add(title);

    const buttons = new Map<Direction, MovementPadButton>();
    const buttonSpecs: Array<{ direction: Direction; x: number; y: number; label: string }> = [
      { direction: Direction.UP, x: 0, y: -54, label: '^' },
      { direction: Direction.LEFT, x: -54, y: 0, label: '<' },
      { direction: Direction.RIGHT, x: 54, y: 0, label: '>' },
      { direction: Direction.DOWN, x: 0, y: 54, label: 'v' },
    ];

    for (const spec of buttonSpecs) {
      const background = this.add.graphics();
      const label = this.add.text(0, -1, spec.label, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#f4f8ff',
        fontStyle: 'bold',
      });
      label.setOrigin(0.5);

      const buttonContainer = this.add.container(spec.x, spec.y, [background, label]);
      buttonContainer.setSize(46, 46);
      buttonContainer.setInteractive(
        new Phaser.Geom.Rectangle(-23, -23, 46, 46),
        Phaser.Geom.Rectangle.Contains,
      );

      const button: MovementPadButton = {
        container: buttonContainer,
        background,
        label,
        direction: spec.direction,
        enabled: false,
      };

      buttonContainer.on('pointerover', () => {
        if (button.enabled) buttonContainer.setScale(1.05);
      });
      buttonContainer.on('pointerout', () => {
        buttonContainer.setScale(1);
      });
      buttonContainer.on('pointerdown', () => {
        if (!button.enabled || !this.boardSceneRef) return;
        this.boardSceneRef.events.emit('virtual-move', button.direction);
      });

      this.redrawMovementPadButton(button, false);
      buttons.set(spec.direction, button);
      root.add(buttonContainer);
    }

    this.movementPad = { container: root, buttons };
  }

  private updateMovementPad(validDirections: Direction[]): void {
    const validSet = new Set(validDirections);
    for (const button of this.movementPad.buttons.values()) {
      button.enabled = validSet.has(button.direction);
      this.redrawMovementPadButton(button, false);
    }
  }

  private setMovementPadVisible(visible: boolean): void {
    this.movementPad.container.setVisible(visible);
    if (!visible) {
      for (const button of this.movementPad.buttons.values()) {
        button.container.setScale(1);
      }
    }
  }

  private flashMovementPadButton(direction: Direction): void {
    const button = this.movementPad.buttons.get(direction);
    if (!button || !this.movementPad.container.visible) return;

    this.redrawMovementPadButton(button, true);
    button.container.setScale(1);
    this.tweens.killTweensOf(button.container);
    this.tweens.add({
      targets: button.container,
      scale: 1.13,
      duration: 90,
      yoyo: true,
      ease: 'Sine.Out',
    });
    this.time.delayedCall(220, () => {
      this.redrawMovementPadButton(button, false);
      button.container.setScale(1);
    });
  }

  private redrawMovementPadButton(button: MovementPadButton, active: boolean): void {
    const fillColor = active ? 0xf1c40f : (button.enabled ? 0x274e95 : 0x17223a);
    const borderColor = active ? 0xffffff : (button.enabled ? 0x91b8ff : 0x3f4d6b);
    const textColor = active ? '#13203d' : (button.enabled ? '#ffffff' : '#7e8bab');

    button.background.clear();
    button.background.fillStyle(fillColor, button.enabled || active ? 0.96 : 0.62);
    button.background.fillRoundedRect(-23, -23, 46, 46, 8);
    button.background.lineStyle(active ? 3 : 2, borderColor, 0.95);
    button.background.strokeRoundedRect(-23, -23, 46, 46, 8);
    button.label.setColor(textColor);
    button.container.setAlpha(button.enabled || active ? 1 : 0.48);
  }

  private createStopPhaseButton(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x274e95, 0.95);
    bg.fillRoundedRect(-75, -22, 150, 44, 10);
    bg.lineStyle(2, 0x91b8ff, 0.95);
    bg.strokeRoundedRect(-75, -22, 150, 44, 10);

    const label = this.add.text(0, 0, 'Dung cho', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);

    const container = this.add.container(1180, 390, [bg, label]);
    container.setDepth(130);
    container.setSize(150, 44);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-75, -22, 150, 44),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerover', () => {
      container.setScale(1.04);
    });
    container.on('pointerout', () => {
      container.setScale(1);
    });
    container.on('pointerdown', () => {
      if (this.boardSceneRef) {
        this.boardSceneRef.events.emit('card-phase-stop');
      }
    });

    this.stopPhaseButton = { container, label };
    this.setStopPhaseButtonVisible(false);
  }

  private setStopPhaseButtonVisible(visible: boolean): void {
    this.stopPhaseButton.container.setVisible(visible);
    if (!visible) {
      this.stopPhaseButton.container.setScale(1);
    }
  }

  private showRevealPopup(title: string, cardName: string): void {
    this.revealPopup.title.setText(title);
    this.revealPopup.cardText.setText(cardName);

    if (!this.revealVisible) {
      this.revealPopup.container.setVisible(true);
      this.revealPopup.container.alpha = 0;
      this.tweens.add({
        targets: this.revealPopup.container,
        alpha: 1,
        duration: 200,
        ease: 'Sine.Out',
      });
      this.revealVisible = true;
    }
  }

  private hideRevealPopup(): void {
    if (!this.revealVisible) return;

    this.revealVisible = false;
    this.tweens.killTweensOf(this.revealPopup.container);
    this.tweens.add({
      targets: this.revealPopup.container,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.revealPopup.container.setVisible(false);
      },
    });
  }
}
