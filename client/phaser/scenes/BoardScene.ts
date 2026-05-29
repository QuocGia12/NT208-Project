import * as Phaser from 'phaser';
import { SocketClient } from '../../lib/SocketClient';
import {
  CardState,
  CardType,
  Direction,
  ErrorCode,
  Phase,
  Phase2Context,
  Phase3Context,
  PickSpawnContext,
  Position,
  PublicGameState,
  PublicPlayerState,
} from '../../types/game';
import { BoardRenderer } from '../objects/BoardRenderer';
import { PlayerSprite } from '../objects/PlayerSprite';
import { GAME_UI_LAYOUT } from '../layout/gameUILayout';
import type { PreviewPrivateState } from '../mock/gamePreviewData';

export class BoardScene extends Phaser.Scene {
  private boardRenderer!: BoardRenderer;
  private backgroundImage!: Phaser.GameObjects.Image;
  private boardTableBackground!: Phaser.GameObjects.Graphics;
  private playerSprites: Map<string, PlayerSprite> = new Map();
  private socketClient!: SocketClient;
  private localPlayerId = '';
  private roomId = '';
  private tetherGraphics!: Phaser.GameObjects.Graphics;

  private currentState: PublicGameState | null = null;
  private myHand: CardState[] = [];
  private myPlayableCards: string[] = [];

  private selectedCardId: string | null = null;
  private selectedHelperCardId: string | null = null;
  private highlightedTargets: Position[] = [];
  private pendingTargetCardId: string | null = null;
  private pendingChangeTeammateCardId: string | null = null;
  private helperHighlightCardIds: string[] = [];
  private isPreviewMode = false;

  private readonly onStateUpdateHandler = (payload: any): void => this.onStateUpdate(payload);
  private readonly onPrivateUpdateHandler = (payload: any): void => this.onPrivateUpdate(payload);
  private readonly onPublicRevealHandler = (payload: any): void => this.onCardPublicReveal(payload);
  private readonly onRevealEndedHandler = (payload: any): void => this.onCardRevealEnded(payload);
  private readonly onPlayerRespawnHandler = (payload: any): void => this.onPlayerRespawn(payload);
  private readonly onGameOverHandler = (payload: any): void => this.onGameOver(payload);
  private readonly onGameErrorHandler = (payload: any): void => this.onGameError(payload);
  private readonly onDiscardRequiredHandler = (payload: any): void => this.onDiscardRequired(payload);
  private readonly onDiscardResolvedHandler = (payload: any): void => this.onDiscardResolved(payload);

  constructor() {
    super({ key: 'BoardScene' });
  }

  create(): void {
    const previewState = this.game.registry.get('previewState') as PublicGameState | null;
    const previewPrivateState = this.game.registry.get('previewPrivateState') as PreviewPrivateState | null;

    this.socketClient = SocketClient.getInstance();
    this.roomId = String(this.game.registry.get('roomId') ?? '');
    this.localPlayerId = String(this.game.registry.get('playerId') ?? this.socketClient.myPlayerId ?? '');
    this.socketClient.myRoomId = this.roomId;

    this.backgroundImage = this.add.image(640, 360, 'ui-background-main');
    this.backgroundImage.setDisplaySize(1280, 720);
    this.backgroundImage.setDepth(-20);

    this.boardTableBackground = this.add.graphics();
    this.boardTableBackground.setDepth(-5);
    this.drawBoardTableBackground();

    this.boardRenderer = new BoardRenderer(this);
    this.isPreviewMode = Boolean(previewState && previewPrivateState);

    this.tetherGraphics = this.add.graphics();
    this.tetherGraphics.setDepth(15);

    this.setupInput();

    this.events.on('card-clicked', this.onCardClicked, this);
    this.events.on('card-phase-stop', this.onCardPhaseStop, this);
    this.events.on('virtual-move', this.onVirtualMove, this);

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    if (this.isPreviewMode && previewState && previewPrivateState) {
      this.applyPreviewData(previewState, previewPrivateState);
    } else {
      this.registerSocketEvents();
    }

    if (!this.isPreviewMode && this.roomId) {
      this.socketClient.requestState(this.roomId);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  update(): void {
    if (!this.currentState || !this.currentState.teams) return;

    this.tetherGraphics.clear();

    for (const team of this.currentState.teams) {
      if (team.playerIds.length !== 2) continue;

      const p1Id = team.playerIds[0];
      const p2Id = team.playerIds[1];

      const sprite1 = this.playerSprites.get(p1Id);
      const sprite2 = this.playerSprites.get(p2Id);

      const p1State = this.currentState.players.find(p => p.id === p1Id);
      const p2State = this.currentState.players.find(p => p.id === p2Id);

      if (!sprite1 || !sprite2 || !p1State || !p2State) continue;
      if (!p1State.hasSpawned || !p2State.hasSpawned) continue;

      // Tính khoảng cách trên board để đổi màu
      const dist = this.calculateTetherDistance(p1State.position, p2State.position);

      const tetherLimit = team.tetherLength;

      // Màu mặc định: trắng (rất an toàn)
      // Vàng (gần tới giới hạn - 2 ô)
      // Đỏ (bằng giới hạn)
      let lineColor = 0xffffff;
      if (dist >= tetherLimit) {
        lineColor = 0xff4444; // Đỏ
      } else if (dist >= Math.max(1, tetherLimit - 2)) {
        lineColor = 0xffd700; // Vàng
      }

      this.tetherGraphics.lineStyle(4, lineColor, 0.7);
      
      // Vẽ nét đứt để trông đẹp hơn
      const p1x = sprite1.container.x;
      const p1y = sprite1.container.y;
      const p2x = sprite2.container.x;
      const p2y = sprite2.container.y;
      
      this.tetherGraphics.beginPath();
      this.tetherGraphics.moveTo(p1x, p1y);
      this.tetherGraphics.lineTo(p2x, p2y);
      this.tetherGraphics.strokePath();
    }
  }

  private registerSocketEvents(): void {
    this.socketClient.on('game:state_update', this.onStateUpdateHandler);
    this.socketClient.on('game:private_update', this.onPrivateUpdateHandler);
    this.socketClient.on('game:card_public_reveal', this.onPublicRevealHandler);
    this.socketClient.on('game:card_reveal_ended', this.onRevealEndedHandler);
    this.socketClient.on('game:player_respawn', this.onPlayerRespawnHandler);
    this.socketClient.on('game:over', this.onGameOverHandler);
    this.socketClient.on('game:error', this.onGameErrorHandler);
    this.socketClient.on('game:discard_required', this.onDiscardRequiredHandler);
    this.socketClient.on('game:discard_resolved', this.onDiscardResolvedHandler);
  }

  private calculateTetherDistance(posA: Position, posB: Position): number {
    const rawDx = Math.abs(posA.x - posB.x);
    const rawDy = Math.abs(posA.y - posB.y);
    const gapX = rawDx > 0 ? rawDx - 1 : 0;
    const gapY = rawDy > 0 ? rawDy - 1 : 0;
    return Math.floor(Math.sqrt(gapX * gapX + gapY * gapY));
  }

  private setupInput(): void {
    this.input.keyboard?.on('keydown', this.onKeyboardInput, this);
    this.input.on('pointerdown', this.onBoardClick, this);
  }

  private cleanup(): void {
    if (!this.isPreviewMode) {
      this.socketClient.off('game:state_update', this.onStateUpdateHandler);
      this.socketClient.off('game:private_update', this.onPrivateUpdateHandler);
      this.socketClient.off('game:card_public_reveal', this.onPublicRevealHandler);
      this.socketClient.off('game:card_reveal_ended', this.onRevealEndedHandler);
      this.socketClient.off('game:player_respawn', this.onPlayerRespawnHandler);
      this.socketClient.off('game:over', this.onGameOverHandler);
      this.socketClient.off('game:error', this.onGameErrorHandler);
      this.socketClient.off('game:discard_required', this.onDiscardRequiredHandler);
      this.socketClient.off('game:discard_resolved', this.onDiscardResolvedHandler);
    }

    this.input.keyboard?.off('keydown', this.onKeyboardInput, this);
    this.input.off('pointerdown', this.onBoardClick, this);
    this.events.off('card-clicked', this.onCardClicked, this);
    this.events.off('card-phase-stop', this.onCardPhaseStop, this);
    this.events.off('virtual-move', this.onVirtualMove, this);

    this.boardRenderer.clearHighlights();
    this.boardTableBackground.destroy();

    for (const sprite of this.playerSprites.values()) {
      sprite.destroy();
    }
    this.playerSprites.clear();
  }

  private onStateUpdate(payload: any): void {
    const state = payload?.data?.state ?? payload?.state;
    if (!state) return;

    const firstRender = !this.currentState;
    this.currentState = state as PublicGameState;
    this.registry.set('activeZodiacs', this.currentState.board.activeZodiacs);

    if (firstRender) {
      this.boardRenderer.init(this.currentState.board, this.currentState.players);
    } else {
      this.boardRenderer.update(this.currentState.board, this.currentState.players);
    }

    this.syncPlayerSprites(this.currentState.players);

    if (this.currentState.currentPhase !== Phase.PLAY_CARD) {
      if (this.selectedCardId) {
        this.exitTargetSelectionMode();
      }
      this.pendingChangeTeammateCardId = null;
      this.pendingTargetCardId = null;
      this.clearHelperCardHighlights();
    }

    this.refreshHighlightsFromState();
    this.events.emit('state-update', this.currentState);
  }

  private onPrivateUpdate(payload: any): void {
    const data = payload?.data ?? payload;
    if (!data) return;

    if (typeof data.playerId === 'string' && data.playerId.length > 0) {
      this.localPlayerId = data.playerId;
      this.socketClient.myPlayerId = data.playerId;
    }

    this.myHand = Array.isArray(data.myHand) ? (data.myHand as CardState[]) : [];
    this.myPlayableCards = Array.isArray(data.myPlayableCards)
      ? (data.myPlayableCards as string[])
      : [];

    if (this.helperHighlightCardIds.length > 0) {
      const playableSet = new Set(this.myPlayableCards);
      this.helperHighlightCardIds = this.helperHighlightCardIds.filter(id => playableSet.has(id));
      this.emitHelperCardHighlights();
    }

    this.events.emit('private-update', {
      playerId: this.localPlayerId,
      myHand: this.myHand,
      myPlayableCards: this.myPlayableCards,
    });
  }

  private onCardPublicReveal(payload: any): void {
    const data = payload?.data ?? payload;
    this.events.emit('card-public-reveal', data);
  }

  private onCardRevealEnded(payload: any): void {
    const data = payload?.data ?? payload;
    this.events.emit('card-reveal-ended', data);
  }

  private onPlayerRespawn(payload: any): void {
    const data = payload?.data ?? payload;
    // Test 7: Respawn, not elimination — emit for UIScene banner
    this.events.emit('player-eliminated', data);
  }

  private onGameOver(payload: any): void {
    const data = payload?.data ?? payload;
    this.events.emit('game-over', data);
  }

  private onDiscardRequired(payload: any): void {
    const data = payload?.data ?? payload;
    this.events.emit('discard-required', data);
  }

  private onDiscardResolved(payload: any): void {
    const data = payload?.data ?? payload;
    this.events.emit('discard-resolved', data);
  }

  private onGameError(payload: any): void {
    const error = payload?.data ?? payload;
    if (!error) return;

    const code = error.code as ErrorCode | undefined;
    const context = this.toRecord(error.context);
    const validTargets = this.extractValidTargets(context?.validTargets);
    const contextCardId = typeof context?.cardId === 'string' ? context.cardId : null;
    const contextHelperCardId = typeof context?.helperCardId === 'string' ? context.helperCardId : null;
    const helperCardIds = Array.isArray(context?.helperCardIds)
      ? (context?.helperCardIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    if (code === ErrorCode.CARD_LINKED_CARD_REQUIRED) {
      this.pendingChangeTeammateCardId = contextCardId ?? this.pendingChangeTeammateCardId;
      this.pendingTargetCardId = this.pendingChangeTeammateCardId;
      this.setHelperCardHighlights(helperCardIds);
      this.events.emit('game-error', {
        ...error,
        message: error?.message ?? 'Chọn thêm 1 lá di chuyển để dùng cùng Đổi vị trí đồng đội.',
      });
      return;
    }

    if (code === ErrorCode.CARD_LINKED_CARD_INVALID) {
      this.pendingChangeTeammateCardId = contextCardId ?? this.pendingChangeTeammateCardId;
      this.pendingTargetCardId = this.pendingChangeTeammateCardId;
      this.setHelperCardHighlights(helperCardIds);
      this.events.emit('game-error', {
        ...error,
        context: {
          ...(context ?? {}),
          helperCardIds,
        },
      });
      return;
    }

    if (
      (code === ErrorCode.CARD_TARGET_REQUIRED || code === ErrorCode.CARD_INVALID_TARGET) &&
      validTargets.length > 0
    ) {
      const cardId = contextCardId ?? this.pendingTargetCardId;
      if (cardId) {
        this.clearHelperCardHighlights();
        this.enterTargetSelectionMode(cardId, validTargets, contextHelperCardId ?? this.selectedHelperCardId);
      }
    }

    this.events.emit('game-error', error);
  }

  private syncPlayerSprites(players: PublicPlayerState[]): void {
    const playerIds = new Set(players.map(player => player.id));

    for (const [playerId, sprite] of this.playerSprites.entries()) {
      if (!playerIds.has(playerId)) {
        sprite.destroy();
        this.playerSprites.delete(playerId);
      }
    }

    for (const player of players) {
      if (!this.playerSprites.has(player.id)) {
        const color = BoardRenderer.PLAYER_COLORS[player.turnIndex % BoardRenderer.PLAYER_COLORS.length];
        this.playerSprites.set(player.id, new PlayerSprite(this, player.id, player.name, color));
      }
    }

    const groups = new Map<string, PublicPlayerState[]>();
    for (const player of players) {
      const key = `${player.position.x},${player.position.y}`;
      const existing = groups.get(key) ?? [];
      existing.push(player);
      groups.set(key, existing);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => a.turnIndex - b.turnIndex);
    }

    const currentTurnPlayerId = this.currentState
      ? this.currentState.turnOrder[this.currentState.currentPlayerIndex]
      : null;

    for (const group of groups.values()) {
      group.forEach((player, index) => {
        const sprite = this.playerSprites.get(player.id);
        if (!sprite) return;

        if (!player.hasSpawned) {
          sprite.setVisible(false);
          sprite.setLocked(false);
          return;
        }

        sprite.setVisible(true);
        sprite.setStackOffset(index, group.length);
        const { worldX, worldY } = this.boardRenderer.getCellWorldPos(
          player.position.x,
          player.position.y
        );

        void sprite.moveTo(worldX, worldY, 200);

        // Test 7: No permanent elimination, all players are always active
        sprite.setActive(player.id === currentTurnPlayerId);
        sprite.setLocked(Boolean(player.isLocked || player.skipNextTurn));
      });
    }
  }

  private refreshHighlightsFromState(): void {
    if (this.selectedCardId && this.highlightedTargets.length > 0) {
      this.boardRenderer.highlightCells(this.highlightedTargets, 0xffd700);
      return;
    }

    if (!this.currentState || !this.isMyTurn(this.currentState)) {
      this.boardRenderer.clearHighlights();
      return;
    }

    if (this.currentState.currentPhase === Phase.PICK_SPAWN) {
      const pickCtx = this.currentState.phaseContext as PickSpawnContext;
      this.boardRenderer.highlightCells(pickCtx.availablePositions, 0x00ff00); // Green
      return;
    }

    if (this.currentState.currentPhase !== Phase.MOVE || this.currentState.phaseContext.phase !== 3) {
      this.boardRenderer.clearHighlights();
      return;
    }

    const myPlayer = this.currentState.players.find(player => player.id === this.localPlayerId);
    if (!myPlayer) {
      this.boardRenderer.clearHighlights();
      return;
    }

    const phase2 = this.currentState.phaseContext as Phase2Context;
    const positions = phase2.validDirections.map(direction =>
      this.directionToPosition(myPlayer.position, direction)
    );

    this.boardRenderer.highlightCells(positions);
  }

  private onKeyboardInput(event: KeyboardEvent): void {
    if (event.repeat) return;

    const direction = this.mapKeyToDirection(event);
    if (!direction) return;

    this.trySendMove(direction);
  }

  private onVirtualMove(direction: Direction): void {
    if (this.isPreviewMode) return;
    this.trySendMove(direction);
  }

  private trySendMove(direction: Direction): boolean {
    if (this.isPreviewMode) return false;
    if (!this.currentState) return false;
    if (!this.isMyTurn(this.currentState)) return false;

    if (this.currentState.currentPhase !== Phase.MOVE || this.currentState.phaseContext.phase !== 3) {
      return false;
    }

    const phase2 = this.currentState.phaseContext as Phase2Context;
    if (!phase2.validDirections.includes(direction)) {
      return false;
    }

    this.socketClient.sendMove(direction);
    this.events.emit('movement-direction-used', direction);
    return true;
  }

  private onCardClicked(cardId: string): void {
    if (this.isPreviewMode) return;
    if (!this.currentState) return;
    if (!this.isMyTurn(this.currentState)) return;
    if (this.currentState.currentPhase !== Phase.PLAY_CARD) return;
    const cardPhase = this.currentState.phaseContext as Phase3Context;
    if (cardPhase.phase !== 2 && cardPhase.phase !== 4) return;
    if (!this.myPlayableCards.includes(cardId)) return;

    const card = this.myHand.find(item => item.id === cardId);
    if (!card) return;

    if (this.pendingChangeTeammateCardId) {
      if (cardId === this.pendingChangeTeammateCardId) {
        this.pendingChangeTeammateCardId = null;
        this.pendingTargetCardId = null;
        this.clearHelperCardHighlights();
        this.events.emit('game-error', { message: 'Đã hủy chọn Đổi vị trí đồng đội.' });
        return;
      }

      if (!this.isMovementCard(card.type)) {
        this.events.emit('game-error', {
          message: 'Hãy chọn 1 lá di chuyển hợp lệ để kết hợp với Đổi vị trí đồng đội.',
        });
        return;
      }

      const mainCardId = this.pendingChangeTeammateCardId;
      this.pendingTargetCardId = mainCardId;
      this.selectedHelperCardId = cardId;
      this.clearHelperCardHighlights();
      this.socketClient.sendPlayCard(mainCardId, undefined, cardId);
      return;
    }

    this.pendingTargetCardId = cardId;

    if (card.type === CardType.EXTRA_TURN) {
      this.exitTargetSelectionMode();
      this.pendingTargetCardId = null;
      this.socketClient.sendPlayCard(cardId);
      return;
    }

    if (card.type === CardType.SWAP_TEAMMATE) {
      this.exitTargetSelectionMode();
      this.pendingTargetCardId = null;
      this.socketClient.sendPlayCard(cardId);
      return;
    }

    if (card.type === CardType.CHANGE_TEAMMATE) {
      this.pendingChangeTeammateCardId = cardId;
      this.selectedHelperCardId = null;
      this.setHelperCardHighlights([]);
      this.socketClient.sendPlayCard(cardId);
      this.events.emit('game-error', {
        message: 'Đang lấy danh sách lá di chuyển hợp lệ...',
      });
      return;
    }

    this.socketClient.sendPlayCard(cardId);
  }

  private onCardPhaseStop(): void {
    if (this.isPreviewMode) return;
    if (!this.currentState) return;
    if (!this.isMyTurn(this.currentState)) return;
    if (this.currentState.currentPhase !== Phase.PLAY_CARD) return;

    const cardPhase = this.currentState.phaseContext as Phase3Context;
    if (cardPhase.phase !== 2 && cardPhase.phase !== 4) return;

    this.exitTargetSelectionMode();
    this.pendingTargetCardId = null;
    this.pendingChangeTeammateCardId = null;
    this.selectedHelperCardId = null;
    this.clearHelperCardHighlights();
    this.socketClient.endCardPhaseNow();
  }

  private enterTargetSelectionMode(
    cardId: string,
    validTargets: Position[],
    helperCardId?: string | null,
  ): void {
    this.selectedCardId = cardId;
    this.pendingTargetCardId = cardId;
    this.selectedHelperCardId = helperCardId ?? null;
    this.highlightedTargets = validTargets.map(target => ({ x: target.x, y: target.y }));
    this.boardRenderer.highlightCells(this.highlightedTargets, 0xffd700);
  }

  private onBoardClick(pointer: Phaser.Input.Pointer): void {
    const boardPos = this.boardRenderer.getCellAtWorldPos(pointer.worldX, pointer.worldY);
    if (!boardPos) return;

    if (this.currentState?.currentPhase === Phase.PICK_SPAWN && this.isMyTurn(this.currentState)) {
      const pickCtx = this.currentState.phaseContext as PickSpawnContext;
      const isValidSpawn = pickCtx.availablePositions.some(
        p => p.x === boardPos.x && p.y === boardPos.y
      );
      if (isValidSpawn) {
        this.socketClient.sendPickSpawn(boardPos);
        return;
      }
    }

    if (!this.selectedCardId) return;
    if (this.highlightedTargets.length === 0) return;

    const isValidTarget = this.highlightedTargets.some(
      target => target.x === boardPos.x && target.y === boardPos.y
    );
    if (!isValidTarget) return;

    this.socketClient.sendPlayCard(this.selectedCardId, boardPos, this.selectedHelperCardId ?? undefined);
    this.pendingTargetCardId = null;
    this.pendingChangeTeammateCardId = null;
    this.selectedHelperCardId = null;
    this.clearHelperCardHighlights();
    this.exitTargetSelectionMode();
  }

  private applyPreviewData(state: PublicGameState, privateState: PreviewPrivateState): void {
    this.localPlayerId = privateState.playerId;
    this.socketClient.myPlayerId = privateState.playerId;

    this.time.delayedCall(0, () => {
      this.onStateUpdate({ state });
      this.onPrivateUpdate(privateState);
    });
  }

  private exitTargetSelectionMode(): void {
    this.selectedCardId = null;
    this.selectedHelperCardId = null;
    this.highlightedTargets = [];
    this.refreshHighlightsFromState();
  }

  private setHelperCardHighlights(cardIds: string[]): void {
    this.helperHighlightCardIds = [...cardIds];
    this.emitHelperCardHighlights();
  }

  private clearHelperCardHighlights(): void {
    if (this.helperHighlightCardIds.length === 0) return;
    this.helperHighlightCardIds = [];
    this.emitHelperCardHighlights();
  }

  private emitHelperCardHighlights(): void {
    this.events.emit('change-teammate-helper-options', {
      helperCardIds: [...this.helperHighlightCardIds],
      changeCardId: this.pendingChangeTeammateCardId,
    });
  }

  private isMyTurn(state: PublicGameState): boolean {
    return state.turnOrder[state.currentPlayerIndex] === this.localPlayerId;
  }

  private mapKeyToDirection(event: KeyboardEvent): Direction | null {
    const key = event.key.toLowerCase();

    if (key === 'arrowup' || key === 'w') return Direction.UP;
    if (key === 'arrowdown' || key === 's') return Direction.DOWN;
    if (key === 'arrowleft' || key === 'a') return Direction.LEFT;
    if (key === 'arrowright' || key === 'd') return Direction.RIGHT;

    return null;
  }

  private directionToPosition(from: Position, direction: Direction): Position {
    if (direction === Direction.UP) return { x: from.x, y: from.y - 1 };
    if (direction === Direction.DOWN) return { x: from.x, y: from.y + 1 };
    if (direction === Direction.LEFT) return { x: from.x - 1, y: from.y };
    return { x: from.x + 1, y: from.y };
  }

  private isMovementCard(type: CardType): boolean {
    return (
      type !== CardType.EXTRA_TURN
      && type !== CardType.CHANGE_TEAMMATE
      && type !== CardType.SWAP_TEAMMATE
    );
  }

  private extractValidTargets(input: unknown): Position[] {
    if (!Array.isArray(input)) return [];

    const targets: Position[] = [];
    for (const entry of input) {
      if (!entry || typeof entry !== 'object') continue;

      const obj = entry as Record<string, unknown>;
      if (typeof obj.x !== 'number' || typeof obj.y !== 'number') continue;

      targets.push({ x: obj.x, y: obj.y });
    }

    return targets;
  }

  private toRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object') return null;
    return input as Record<string, unknown>;
  }

  private drawBoardTableBackground(): void {
    const { x, y, width, height } = GAME_UI_LAYOUT.boardTable;

    this.boardTableBackground.clear();
    this.boardTableBackground.fillStyle(0x432718, 0.9);
    this.boardTableBackground.fillRoundedRect(x, y, width, height, 5);
    this.boardTableBackground.fillStyle(0x1a2030, 0.92);
    this.boardTableBackground.fillRoundedRect(x + 12, y + 12, width - 24, height - 24, 2);
    this.boardTableBackground.lineStyle(2, 0x7b5b34, 0.75);
    this.boardTableBackground.strokeRoundedRect(x + 2, y + 2, width - 4, height - 4, 5);
    this.boardTableBackground.lineStyle(1.5, 0x8fa7c0, 0.22);
    this.boardTableBackground.strokeRoundedRect(x + 14, y + 14, width - 28, height - 28, 2);
  }
}

