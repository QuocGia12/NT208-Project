import { GameState, PlayerState } from './GameState.js';
import { TurnManager } from './TurnManager.js';
import { MovementEngine } from './MovementEngine.js';
import { CombatEngine } from './CombatEngine.js';
import { StackEngine } from './StackEngine.js';
import { WorldEventSystem } from './WorldEventSystem.js';
import { WinChecker } from './WinChecker.js';
import { buildBoard } from './BoardBuilder.js';
import Card from '../models/Card.js';

export class GameEngine {
    constructor(io, roomCode) {
        this.io = io;
        this.roomCode = roomCode;
        this.state = null;
        this.turnManager = null;
        this.movement = null;
        this.combat = null;
        this.stack = null;
        this.worldEvents = null;
        this.winChecker = new WinChecker();
    }

    async initMatch(playerInfos) {
        console.log('initMatch called with:', JSON.stringify(playerInfos));
        // Load tất cả cards từ MongoDB một lần
        const allCards = await Card.find({}).lean();
        const deck = this._buildDeck(allCards);

        const board = buildBoard();
        const startCell = board.find(c => c.type === 'graduation') ?? board[0];

        // Tạo PlayerState cho từng người
        const players = playerInfos.map(info => {
        const p = new PlayerState(
            info.userId,
            info.username,
            info.characterId,
            startCell.id
        );
        startCell.occupants.push(info.userId);
        return p;
        });

        // Player đầu tiên đến lượt
        if (players.length > 0) {
            players[0].isMyTurn = true;  // ← chỉ set sau khi players đã có phần tử
        }

        this.state = new GameState(this.roomCode, players, board);
        this.turnManager = new TurnManager(this.state, deck);
        this.movement = new MovementEngine(this.state);
        this.combat = new CombatEngine(this.state);
        this.stack = new StackEngine(this.io, this.roomCode);
        this.worldEvents = new WorldEventSystem(this.state);

        this._broadcast('game:started', {
        state: this.state.snapshot(),
        message: 'Ván game bắt đầu!'
        });

        // Bắt đầu lượt đầu tiên
        this._startTurn();
    }

    // ── HANDLERS nhận từ Socket ──

    onDiceRoll(userId) {
        const player = this._validateTurn(userId);
        if (this.state.phase !== 'draw' && this.state.phase !== 'action') {
        throw new Error('Chưa đến lúc đổ xúc xắc');
        }

        const result = this.movement.roll();

        // Tính các đường đi có thể
        const paths = this.movement.getPath(player.position, result);

        this._broadcast('game:diceRolled', {
        userId,
        result,
        paths,                      // gửi về client để render highlight
        state: this.state.snapshot()
        });

        return result;
    }

    onMoveChosen(userId, targetCellId) {
        const player = this._validateTurn(userId);
        if (this.state.phase !== 'move') throw new Error('Chưa đến lúc di chuyển');

        // Validate ô đích có trong danh sách hợp lệ không
        const validPaths = this.movement.getPath(player.position, this.state.lastDiceRoll);
        const validTargets = validPaths.map(p => p[p.length - 1]);
        if (!validTargets.includes(targetCellId)) {
        throw new Error('Ô đích không hợp lệ');
        }

        const path = validPaths.find(p => p[p.length - 1] === targetCellId);
        const landedCell = this.movement.executeMove(player, targetCellId);

        this._broadcast('game:playerMoved', {
        userId,
        path,                       // client dùng để animate từng ô
        targetCellId,
        cellType: landedCell.type,
        state: this.state.snapshot()
        });

        // Xử lý ô đặc biệt
        if (landedCell.type === 'station') {
        const options = this.movement.handleStation(player, landedCell);
        this._broadcastToPlayer(userId, 'game:stationChoice', { options });
        return;
        }

        // Xử lý combat
        const combatResults = this.combat.resolveCell(player);
        if (combatResults.length > 0) {
        this._broadcast('game:combatResolved', { results: combatResults.flat() });
        }

        this._checkWinAndBroadcast();
    }

    onCardPlayed(userId, cardId, targetUserId) {
        const player = this._validateTurn(userId);
        const cardIdx = player.handCards.findIndex(c => c.card_code === cardId);
        if (cardIdx === -1) throw new Error('Không có lá bài này trong tay');

        const card = player.handCards[cardIdx];
        const target = targetUserId
        ? this.state.players.find(p => p.userId === targetUserId)
        : null;

        // Xóa bài khỏi tay
        player.handCards.splice(cardIdx, 1);

        // Mở Stack window
        this.stack.open(card, player, target, (resolvedEffects) => {
        this._applyEffects(resolvedEffects);
        this._checkWinAndBroadcast();
        });
    }

    onStackInterrupt(userId, cardId, targetUserId) {
        const player = this.state.players.find(p => p.userId === userId);
        if (!player) throw new Error('Người chơi không tồn tại');

        const cardIdx = player.handCards.findIndex(c => c.card_code === cardId);
        if (cardIdx === -1) throw new Error('Không có lá bài này trong tay');

        const card = player.handCards[cardIdx];
        if (card.timing !== '+') throw new Error('Chỉ thẻ (+) mới can thiệp được');

        const target = targetUserId
        ? this.state.players.find(p => p.userId === targetUserId)
        : null;

        player.handCards.splice(cardIdx, 1);
        this.stack.interrupt(card, player, target);
    }

    onTurnEnd(userId) {
        this._validateTurn(userId);

        const { roundComplete, newRound } = this.turnManager.endTurn();

        if (roundComplete) {
        const eventResult = this.worldEvents.onRoundEnd();
        if (eventResult) {
            this._broadcast('game:monsterEvent', {
            ...eventResult,
            message: `Quái thú tấn công Shop #${eventResult.targetShopId}!`
            });
        }
        this._checkWinAndBroadcast();
        }

        this._startTurn();
    }

    // ── PRIVATE HELPERS ──

    _startTurn() {
        const result = this.turnManager.startTurn();

        if (result.skipped) {
        this._broadcast('game:turnSkipped', {
            userId: result.playerId,
            reason: result.reason ?? 'skip_turn'
        });
        setTimeout(() => this._startTurn(), 1000);
        return;
        }

        // Kiểm tra hand limit
        const player = this.state.getCurrentPlayer();
        const excess = this.turnManager.enforceHandLimit(player);

        this._broadcast('game:turnStarted', {
        currentPlayer: player.userId,
        drawnCard: result.drawnCard,
        mustDiscard: excess,
        state: this.state.snapshot()
        });
    }

    _applyEffects(effects) {
        for (const ef of effects) {
        const actor = this.state.players.find(p => p.userId === ef.actor);
        const target = ef.target
            ? this.state.players.find(p => p.userId === ef.target)
            : null;

        switch (ef.effect.action) {
            case 'steal_food':
            if (target && target.foodCount > 0) {
                target.foodCount -= 1;
                if (actor) actor.foodCount += 1;
            }
            break;
            case 'skip_turn':
            if (target) target.isSkipTurn = true;
            break;
            case 'restrict_move':
            if (target) target.isSleeping = true;
            break;
            case 'draw_cards':
            for (let i = 0; i < ef.effect.value; i++) {
                // TODO: draw từ deck
            }
            break;
            case 'counter_spell':
            // Đã xử lý trong StackEngine (thẻ cuối cancel thẻ trước)
            break;
            case 'add_steps':
            this.state.lastDiceRoll =
                Math.min(6, (this.state.lastDiceRoll ?? 0) + ef.effect.value);
            break;
            case 'force_dice':
            if (ef.effect.value > 0) this.state.lastDiceRoll = ef.effect.value;
            break;
            default:
            console.log(`Effect chưa implement: ${ef.effect.action}`);
        }
        }

        this._broadcast('game:stateUpdate', { state: this.state.snapshot() });
    }

    _validateTurn(userId) {
        const player = this.state.getCurrentPlayer();
        if (player.userId !== userId) {
        throw new Error('Chưa đến lượt của bạn');
        }
        return player;
    }

    _checkWinAndBroadcast() {
        const result = this.winChecker.check(this.state);
        if (!result) return;

        this.state.status = 'finished';
        this._broadcast('game:over', result);
    }

    _broadcast(event, data) {
        this.io.to(this.roomCode).emit(event, data);
    }

    _broadcastToPlayer(userId, event, data) {
        // Cần map userId → socketId, tạm thời broadcast cho cả phòng
        this._broadcast(event, { ...data, targetUserId: userId });
    }

    _buildDeck(cards) {
        const deck = [];
        for (const card of cards) {
        for (let i = 0; i < card.max_in_deck; i++) {
            deck.push(card);
        }
        }
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
}
