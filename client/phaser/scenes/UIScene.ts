import * as Phaser from 'phaser';
import { SocketClient } from '../../lib/SocketClient';
import {
  CardState,
  CardType,
  Direction,
  Phase,
  Phase1Context,
  Phase2Context,
  Phase3Context,
  PublicGameState,
  PublicPlayerState,
} from '../../types/game';
import { getCardTextureKey } from '../assets/gameUIAssets';
import { GAME_CANVAS, GAME_UI_LAYOUT } from '../layout/gameUILayout';
import { drawActionButtonFace, drawOrnatePanel } from '../layout/gameUITheme';
import { CardPanel } from '../objects/CardPanel';
import { DiceDisplay } from '../objects/DiceDisplay';
import { PlayerInfoPanel } from '../objects/PlayerInfoPanel';
import { TimerBar } from '../objects/TimerBar';

type RevealPopup = {
  container: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  cardImage: Phaser.GameObjects.Image;
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

type ActionButton = {
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
  container: Phaser.GameObjects.Zone;
  overlay: Phaser.GameObjects.Graphics;
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
  private waitButton!: ActionButton;
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

    this.diceDisplay = new DiceDisplay(this, GAME_UI_LAYOUT.dice.centerX, GAME_UI_LAYOUT.dice.centerY);
    this.timerBar = new TimerBar(this, GAME_UI_LAYOUT.board.centerX, 28, 300, 8);
    this.cardPanel = new CardPanel(this, GAME_UI_LAYOUT.cardPanel.centerX, GAME_UI_LAYOUT.cardPanel.centerY);
    this.playerInfoPanel = new PlayerInfoPanel(this, 193, 136, 244, 136);

    this.cardPanel.setOnCardClick(() => {
      // BoardScene listens for the emitted card-clicked event.
    });

    this.createRevealPopup();
    this.createEliminationBanner();
    this.createGameOverOverlay();
    this.createWaitButton();
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
    this.waitButton.container.destroy(true);
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
      this.discardSelected.forEach((cardId) => {
        if (!this.myHand.some((card) => card.id === cardId)) {
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

  private onDiscardRequired(data: unknown): void {
    const payload = this.asRecord(data);
    const requiredCount = typeof payload?.requiredCount === 'number' ? payload.requiredCount : 0;
    const expiresAt = typeof payload?.expiresAt === 'number' ? payload.expiresAt : Date.now();

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

  private onCardPublicReveal(data: unknown): void {
    const payload = this.asRecord(data);
    const card = this.asRecord(payload?.card);
    const playerName = typeof payload?.playerName === 'string' ? payload.playerName : 'Nguoi choi';
    const cardName = typeof card?.displayName === 'string' ? card.displayName : 'The bi an';
    const cardType = typeof card?.type === 'string' ? (card.type as CardType) : null;
    this.showRevealPopup(`${playerName} rut duoc:`, cardName, cardType);
  }

  private onCardRevealEnded(): void {
    this.hideRevealPopup();
  }

  private onPlayerEliminated(data: unknown): void {
    const payload = this.asRecord(data);
    const playerName = typeof payload?.playerName === 'string' ? payload.playerName : 'Nguoi choi';
    const cellsLost = typeof payload?.cellsLost === 'number' ? payload.cellsLost : 0;

    this.eliminationBanner.text.setText(`${playerName} bi ket! Mat ${cellsLost} o, hoi sinh!`);
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

  private onGameOver(data: unknown): void {
    const payload = this.asRecord(data);
    const winner = this.asRecord(payload?.winner);
    const winnerNames = Array.isArray(winner?.playerNames)
      ? winner.playerNames.filter((name): name is string => typeof name === 'string').join(' & ')
      : 'Unknown';
    const teamId = typeof winner?.teamId === 'string' ? winner.teamId : '';

    this.gameOverOverlay.title.setText(`Team thang: ${teamId}\n${winnerNames}`);
    this.setWaitButtonVisible(false);
    this.setMovementPadVisible(false);

    const statsLines: string[] = [];
    const finalState = this.asRecord(payload?.finalState);
    const finalPlayers = Array.isArray(finalState?.players) ? (finalState.players as PublicPlayerState[]) : [];
    if (finalPlayers.length > 0) {
      finalPlayers
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex)
        .forEach((player) => {
          const teamLabel = player.teamId === 'team1' ? '[T1]' : '[T2]';
          statsLines.push(`${teamLabel} ${player.name}: ${player.claimedCount}/5 o`);
        });
    }

    const stats = this.asRecord(payload?.stats);
    const claimedByTeam = this.asRecord(stats?.claimedByTeam);
    if (claimedByTeam) {
      statsLines.push('');
      Object.entries(claimedByTeam).forEach(([tid, count]) => {
        if (typeof count === 'number') {
          statsLines.push(`${tid}: ${count}/10`);
        }
      });
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
      this.timerBar.showLabel(isMyTurn ? 'Chon o xuat phat...' : 'Nguoi choi khac dang chon o xuat phat');
      this.diceDisplay.hide();
      this.setWaitButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.DRAW_CARD) {
      this.timerBar.stop();
      this.timerBar.showLabel('Rut bai...');
      this.diceDisplay.hide();
      this.rollingShown = false;
      this.setWaitButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.ROLL_DICE && state.phaseContext.phase === 1) {
      const phase1 = state.phaseContext as Phase1Context;
      this.timerBar.stop();

      if (phase1.diceResult === null) {
        this.timerBar.showLabel('Dang do xuc xac...');
        if (!this.rollingShown) {
          const duration = Math.max(200, phase1.rollEndAt - Date.now());
          this.diceDisplay.rollAnimation(duration);
          this.rollingShown = true;
        }
      } else {
        this.timerBar.showLabel(`Xuc xac: ${phase1.diceResult}`);
        this.diceDisplay.showResult(phase1.diceResult);
        this.rollingShown = false;
      }

      this.setWaitButtonVisible(false);
      this.setMovementPadVisible(false);
      return;
    }

    if (state.currentPhase === Phase.MOVE && state.phaseContext.phase === 3) {
      const phase2 = state.phaseContext as Phase2Context;
      this.timerBar.stop();
      this.timerBar.showLabel(`Di chuyen: ${phase2.stepsRemaining} buoc`);
      this.diceDisplay.showResult(phase2.diceResult);
      this.rollingShown = false;
      this.setWaitButtonVisible(false);
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
      const phaseLabel = phase3.phase === 2 ? 'Phase 2: Dung bai (60s)' : 'Phase 4: Dung bai (60s)';
      this.timerBar.showLabel(phaseLabel);
      this.timerBar.startCountdown(phase3.timerExpiresAt);
      this.rollingShown = false;
      this.setWaitButtonVisible(isMyTurn);
      this.setMovementPadVisible(false);
      return;
    }

    this.timerBar.stop();
    this.timerBar.showLabel('');
    this.setWaitButtonVisible(false);
    this.setMovementPadVisible(false);
  }

  private handleRevealFromState(state: PublicGameState): void {
    if (!state.publicReveal) {
      this.hideRevealPopup();
      return;
    }

    const player = state.players.find((item) => item.id === state.publicReveal?.playerId);
    const playerName = player?.name ?? 'Nguoi choi';
    this.showRevealPopup(
      `${playerName} rut duoc:`,
      state.publicReveal.card.displayName,
      state.publicReveal.card.type,
    );
  }

  private createRevealPopup(): void {
    const bg = this.add.graphics();
    drawOrnatePanel(bg, -190, -132, 380, 264, 18);

    const title = this.add.text(0, -98, '', {
      fontFamily: '"Playpen Sans", cursive',
      fontSize: '18px',
      color: '#f5d56f',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 260 },
    });
    title.setOrigin(0.5);

    const cardImage = this.add.image(0, 6, 'ui-card-zodiac-tys');
    cardImage.setDisplaySize(110, 162);

    const cardText = this.add.text(0, 98, '', {
      fontFamily: '"Playpen Sans", cursive',
      fontSize: '14px',
      color: '#fff8dd',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 220 },
    });
    cardText.setOrigin(0.5);

    const container = this.add.container(GAME_CANVAS.width / 2, 322, [bg, title, cardImage, cardText]);
    container.setDepth(300);
    container.setVisible(false);

    this.revealPopup = { container, title, cardImage, cardText };
  }

  private createEliminationBanner(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x4a1f1f, 0.94);
    bg.fillRoundedRect(-290, -24, 580, 48, 12);
    bg.lineStyle(3, 0x8b2e2e, 0.95);
    bg.strokeRoundedRect(-290, -24, 580, 48, 12);
    bg.lineStyle(1.5, 0xffd0c6, 0.7);
    bg.strokeRoundedRect(-282, -16, 564, 32, 8);

    const text = this.add.text(0, 0, '', {
      fontFamily: 'Georgia',
      fontSize: '20px',
      color: '#fff0e8',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    const container = this.add.container(GAME_CANVAS.width / 2, 58, [bg, text]);
    container.setDepth(310);
    container.setVisible(false);

    this.eliminationBanner = { container, text };
  }

  private createGameOverOverlay(): void {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x05080d, 0.8);
    backdrop.fillRect(0, 0, GAME_CANVAS.width, GAME_CANVAS.height);

    const panel = this.add.graphics();
    drawOrnatePanel(panel, -270, -200, 540, 400, 18);

    const title = this.add.text(0, -130, 'Game Over', {
      fontFamily: 'Georgia',
      fontSize: '42px',
      color: '#ffe58c',
      fontStyle: 'bold',
      align: 'center',
    });
    title.setOrigin(0.5);

    const stats = this.add.text(0, -10, '', {
      fontFamily: 'Georgia',
      fontSize: '21px',
      color: '#e3ecff',
      align: 'center',
      lineSpacing: 8,
    });
    stats.setOrigin(0.5);

    const buttonBg = this.add.graphics();
    drawActionButtonFace(buttonBg, 220, 50);

    const buttonText = this.add.text(0, 0, 'Ve Lobby', {
      fontFamily: 'Georgia',
      fontSize: '22px',
      color: '#fff5d5',
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

    const container = this.add.container(GAME_CANVAS.width / 2, GAME_CANVAS.height / 2, [
      backdrop,
      panel,
      title,
      stats,
      button,
    ]);
    container.setDepth(350);
    container.setVisible(false);

    this.gameOverOverlay = { container, title, stats, button };
  }

  private createDiscardOverlay(): void {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x05080d, 0.8);
    backdrop.fillRect(0, 0, GAME_CANVAS.width, GAME_CANVAS.height);

    const panel = this.add.graphics();
    drawOrnatePanel(panel, -390, -182, 780, 364, 18);

    const instruction = this.add.text(0, -128, '', {
      fontFamily: 'Georgia',
      fontSize: '24px',
      color: '#fff4d3',
      fontStyle: 'bold',
      align: 'center',
    });
    instruction.setOrigin(0.5);

    const timerText = this.add.text(0, -92, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f6d178',
      align: 'center',
    });
    timerText.setOrigin(0.5);

    const cardsRoot = this.add.container(0, 4);

    const confirmBg = this.add.graphics();
    drawActionButtonFace(confirmBg, 180, 44);

    const confirmLabel = this.add.text(0, 0, 'Xac nhan', {
      fontFamily: 'Georgia',
      fontSize: '20px',
      color: '#fff3cc',
      fontStyle: 'bold',
    });
    confirmLabel.setOrigin(0.5);

    const confirmButton = this.add.container(0, 130, [confirmBg, confirmLabel]);
    confirmButton.setSize(180, 44);
    confirmButton.setInteractive(new Phaser.Geom.Rectangle(-90, -22, 180, 44), Phaser.Geom.Rectangle.Contains);
    confirmButton.on('pointerover', () => {
      if (confirmButton.alpha >= 0.99) {
        confirmButton.setScale(1.04);
      }
    });
    confirmButton.on('pointerout', () => {
      confirmButton.setScale(1);
    });
    confirmButton.on('pointerdown', () => {
      if (this.discardSelected.size !== this.discardRequiredCount) {
        return;
      }
      SocketClient.getInstance().sendDiscardCards([...this.discardSelected]);
    });

    const container = this.add.container(GAME_CANVAS.width / 2, GAME_CANVAS.height / 2, [
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
    const cardWidth = 142;
    const cardHeight = 72;
    const gap = 14;
    const totalWidth = cards.length * cardWidth + Math.max(0, cards.length - 1) * gap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const cardX = startX + index * (cardWidth + gap);
      const selected = this.discardSelected.has(card.id);
      const texture = getCardTextureKey(card.type);

      const image = this.add.image(0, 0, texture);
      image.setDisplaySize(cardWidth, cardHeight);

      const outline = this.add.graphics();
      outline.lineStyle(selected ? 4 : 2, selected ? 0xffa8a0 : 0xf0d68c, selected ? 1 : 0.65);
      outline.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
      if (selected) {
        outline.fillStyle(0x4f1410, 0.28);
        outline.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth - 4, cardHeight - 4, 10);
      }

      const caption = this.add.text(0, cardHeight / 2 + 16, card.displayName, {
        fontFamily: 'Georgia',
        fontSize: '13px',
        color: selected ? '#ffd7d1' : '#fff6dc',
        align: 'center',
      });
      caption.setOrigin(0.5);

      const cardContainer = this.add.container(cardX, 6, [image, outline, caption]);
      cardContainer.setSize(cardWidth, cardHeight + 30);
      cardContainer.setInteractive(
        new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
        Phaser.Geom.Rectangle.Contains,
      );

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
    this.discardOverlay.instruction.setText(
      `Chon ${this.discardRequiredCount} la bai de bo (${selectedCount}/${this.discardRequiredCount})`,
    );

    const canConfirm = selectedCount === this.discardRequiredCount;
    this.discardOverlay.confirmButton.alpha = canConfirm ? 1 : 0.45;
    this.discardOverlay.confirmButton.setScale(1);
    this.discardOverlay.confirmLabel.setText(canConfirm ? 'Xac nhan' : 'Chon du la');
  }

  private updateDiscardOverlayTimer(): void {
    if (!this.discardOverlay.container.visible) {
      return;
    }

    const remainingMs = Math.max(0, this.discardExpiresAt - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    this.discardOverlay.timerText.setText(`Tu dong random sau: ${remainingSec}s`);
  }

  private hideDiscardOverlay(): void {
    this.discardRequiredCount = 0;
    this.discardExpiresAt = 0;
    this.discardSelected.clear();
    this.discardOverlay.cardsRoot.removeAll(true);
    this.discardOverlay.container.setVisible(false);
  }

  private createMovementPad(): void {
    const root = this.add.container(GAME_UI_LAYOUT.movementPad.centerX, GAME_UI_LAYOUT.movementPad.centerY);
    root.setDepth(135);
    root.setVisible(false);

    const base = this.add.image(0, 0, 'ui-movement-pad');
    base.setDisplaySize(
      Math.round(GAME_UI_LAYOUT.movementPad.width),
      Math.round(GAME_UI_LAYOUT.movementPad.height),
    );
    root.add(base);

    const buttonSpecs: Array<{ direction: Direction; x: number; y: number; width: number; height: number }> = [
      { direction: Direction.UP, x: 0, y: -72, width: 70, height: 70 },
      { direction: Direction.LEFT, x: -74, y: 0, width: 70, height: 70 },
      { direction: Direction.RIGHT, x: 74, y: 0, width: 70, height: 70 },
      { direction: Direction.DOWN, x: 0, y: 72, width: 70, height: 70 },
    ];

    const buttons = new Map<Direction, MovementPadButton>();

    buttonSpecs.forEach((spec) => {
      const overlay = this.add.graphics();
      const hitZone = this.add.zone(spec.x, spec.y, spec.width, spec.height);
      hitZone.setOrigin(0.5);
      hitZone.setInteractive();

      const button: MovementPadButton = {
        container: hitZone,
        overlay,
        direction: spec.direction,
        enabled: false,
      };

      hitZone.on('pointerover', () => {
        if (button.enabled) {
          hitZone.setScale(1.04);
          this.redrawMovementPadButton(button, false, true);
        }
      });
      hitZone.on('pointerout', () => {
        hitZone.setScale(1);
        this.redrawMovementPadButton(button, false, false);
      });
      hitZone.on('pointerdown', () => {
        if (!button.enabled || !this.boardSceneRef) {
          return;
        }
        this.boardSceneRef.events.emit('virtual-move', button.direction);
      });

      root.add([overlay, hitZone]);
      this.redrawMovementPadButton(button, false, false);
      buttons.set(spec.direction, button);
    });

    this.movementPad = { container: root, buttons };
  }

  private updateMovementPad(validDirections: Direction[]): void {
    const validSet = new Set(validDirections);
    this.movementPad.buttons.forEach((button) => {
      button.enabled = validSet.has(button.direction);
      this.redrawMovementPadButton(button, false, false);
    });
  }

  private setMovementPadVisible(visible: boolean): void {
    this.movementPad.container.setVisible(visible);
    if (!visible) {
      this.movementPad.buttons.forEach((button) => {
        button.container.setScale(1);
      });
    }
  }

  private flashMovementPadButton(direction: Direction): void {
    const button = this.movementPad.buttons.get(direction);
    if (!button || !this.movementPad.container.visible) {
      return;
    }

    this.redrawMovementPadButton(button, true, false);
    button.container.setScale(1);
    this.tweens.killTweensOf(button.container);
    this.tweens.add({
      targets: button.container,
      scale: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Sine.Out',
    });

    this.time.delayedCall(220, () => {
      this.redrawMovementPadButton(button, false, false);
      button.container.setScale(1);
    });
  }

  private redrawMovementPadButton(button: MovementPadButton, active: boolean, hover: boolean): void {
    const width = button.container.width;
    const height = button.container.height;
    const x = button.container.x;
    const y = button.container.y;
    const enabled = button.enabled || active;

    button.overlay.clear();
    if (!enabled) {
      button.overlay.fillStyle(0x081120, 0.46);
      button.overlay.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
      button.overlay.lineStyle(1.5, 0x4c3f33, 0.6);
      button.overlay.strokeRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
      return;
    }

    if (active) {
      button.overlay.fillStyle(0xf1d17a, 0.18);
      button.overlay.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
      button.overlay.lineStyle(3, 0xfff0b8, 0.95);
      button.overlay.strokeRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
      return;
    }

    if (hover) {
      button.overlay.fillStyle(0xffefb0, 0.1);
      button.overlay.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
      button.overlay.lineStyle(2, 0xf5df9a, 0.9);
      button.overlay.strokeRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 12);
    }
  }

  private createWaitButton(): void {
    this.waitButton = this.createActionButton(
      GAME_UI_LAYOUT.waitButton.centerX,
      GAME_UI_LAYOUT.waitButton.centerY,
      Math.round(GAME_UI_LAYOUT.waitButton.width),
      Math.round(GAME_UI_LAYOUT.waitButton.height),
      'Dung cho',
      'ui-button-skip',
      () => {
        if (this.boardSceneRef) {
          this.boardSceneRef.events.emit('card-phase-stop');
        }
      },
    );
    this.setWaitButtonVisible(false);
  }

  private setWaitButtonVisible(visible: boolean): void {
    this.waitButton.container.setVisible(visible);
    if (!visible) {
      this.waitButton.container.setScale(1);
    }
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    textureKey: string,
    onClick: () => void,
  ): ActionButton {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const bg = this.add.image(0, 0, textureKey);
    bg.setDisplaySize(width, height);

    const label = this.add.text(0, 0, text, {
      fontFamily: 'Georgia',
      fontSize: '1px',
      color: '#fff3cc',
    });
    label.setVisible(false);

    const container = this.add.container(x, y, [bg, label]);
    container.setDepth(130);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-halfWidth, -halfHeight, width, height),
      Phaser.Geom.Rectangle.Contains,
    );

    container.on('pointerover', () => {
      container.setScale(1.04);
    });
    container.on('pointerout', () => {
      container.setScale(1);
    });
    container.on('pointerdown', onClick);

    return { container, label };
  }

  private showRevealPopup(title: string, cardName: string, cardType?: CardType | null): void {
    this.revealPopup.title.setText(title);
    this.revealPopup.cardText.setText(cardName);
    this.revealPopup.cardImage.setTexture(getCardTextureKey(cardType ?? null));

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
    if (!this.revealVisible) {
      return;
    }

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

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object') {
      return null;
    }

    return input as Record<string, unknown>;
  }
}
