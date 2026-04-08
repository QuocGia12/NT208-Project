import { GameState, PlayerState } from './GameState.js';
import { TurnManager } from './TurnManager.js';
import { MovementEngine } from './MovementEngine.js';
import { CombatEngine } from './CombatEngine.js';
import { StackEngine } from './StackEngine.js';
import { WorldEventSystem } from './WorldEventSystem.js';
import { WinChecker } from './WinChecker.js';
import { buildBoard } from './BoardBuilder.js';
import Card from '../models/Card.js';
import Match from '../models/Match.js';
import { SkillEngine } from './SkillEngine.js';

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
        this.skill = new SkillEngine(this.state, this.stack);

        this._broadcast('game:started', {
            state: this.state.snapshot(),
            message: 'Ván game bắt đầu!'
        });

        setTimeout(() => {
            console.log('Bắt đầu lượt đầu tiên...');
            this._startTurn();
        }, 1500);
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

        // Cập nhật phase sang move để cho phép người chơi di chuyển
        this.state.phase = 'move';
        this.state.lastDiceRoll = result;

        console.log(`[onDiceRoll] Setting phase to move, current state.phase: ${this.state.phase}`);

        const snapshot = this.state.snapshot();
        console.log(`[onDiceRoll] Snapshot phase: ${snapshot.phase}`);

        this._broadcast('game:diceRolled', {
        userId,
        result,
        paths,
        phase: 'move',  // gửi phase rõ ràng
        state: snapshot
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

        // Xử lý ô đặc biệt
        if (landedCell.type === 'station') {
            const options = this.movement.handleStation(player, landedCell);
            this._broadcast('game:playerMoved', {
                userId,
                path,
                targetCellId,
                cellType: landedCell.type,
                state: this.state.snapshot()
            });
            this._broadcastToPlayer(userId, 'game:stationChoice', { options });
            return;
        }

        // Xử lý combat (pickup, push, steal) - phải làm TRƯỚC broadcast
        const combatResults = this.combat.resolveCell(player);
        
        // Broadcast 1 event duy nhất với state FINAL (đã resolve combat)
        // Kèm theo combatResults để client log chi tiết
        this._broadcast('game:playerMoved', {
            userId,
            path,
            targetCellId,
            cellType: landedCell.type,
            combatResults: combatResults.length > 0 ? combatResults.flat() : [],
            state: this.state.snapshot()  // ← State cuối cùng với food change
        });

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

        // Kiểm tra stack đang mở không
        if (!this.stack.isOpen) {
            throw new Error('Không trong cửa sổ Stack - không thể can thiệp');
        }

        const cardIdx = player.handCards.findIndex(c => c.card_code === cardId);
        if (cardIdx === -1) throw new Error('Không có lá bài này trong tay');

        const card = player.handCards[cardIdx];
        if (card.timing !== '+') throw new Error('Chỉ thẻ (+) mới có thể can thiệp');

        const target = targetUserId
            ? this.state.players.find(p => p.userId === targetUserId)
            : null;

        // Xóa bài khỏi tay
        player.handCards.splice(cardIdx, 1);
        
        // Push lá bài vào stack
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
            message: `Quái thú tấn công Shop #${eventResult.targetShopId}!`,
            state: this.state.snapshot()
            });
            // Chờ client hiển thị event quái thú xong rồi mới bắt đầu lượt tiếp
            setTimeout(() => {
            this._checkWinAndBroadcast();
            this._startTurn();
            }, 2500);
            return;
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

        const player = this.state.getCurrentPlayer();
        const excess = this.turnManager.enforceHandLimit(player);

        if (result.mustDiscard) {
            // Gửi riêng cho player đó — kèm tay bài CHƯA có lá mới
            // để họ chọn bỏ trước khi thấy lá mới
            const handWithoutNew = player.handCards.slice(0, -1); // bỏ lá cuối (lá vừa rút)
            const newCard = player.handCards[player.handCards.length - 1];

            // Emit chỉ cho socket của player này
            this._broadcastToPlayer(player.userId, 'game:mustDiscard', {
            handCards: handWithoutNew,
            excess: result.excess,
            newCard: newCard // server giữ, chưa reveal
            });

            // Broadcast cho mọi người biết đang chờ player bỏ bài
            this._broadcast('game:turnStarted', {
            currentPlayer: player.userId,
            drawnCard: null, // chưa reveal
            mustDiscard: result.excess,
            state: this.state.snapshot()
            });
            return;
        }

        // Trường hợp bình thường: không skip, không discard
        this._broadcast('game:turnStarted', {
        currentPlayer: player.userId,
        drawnCard: result.drawnCard,
        mustDiscard: 0,
        state: this.state.snapshot()
        });
    }

    _applyEffects(effects) {
        try {
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
        } catch (err) {
            console.error('Lỗi khi áp dụng hiệu ứng:', err);
                try {
                this._broadcast('game:stateUpdate', { state: this.state.snapshot() });
                } 
                catch (e) {
                console.error('Không thể broadcast state:', e);
                }
        }

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
        this._saveMatchResult(result);
    }

    async _saveMatchResult(result) {
        try {
            await Match.create({
                room_code: this.roomCode,
                status: 'completed',
                players: result.rankings.map(r => ({
                    user_id: r.userId,
                    character_used: this.state.players.find(p => p.userId === r.userId)?.characterId,
                    final_food: r.finalFood,
                    rank: r.rank,
                    gold_reward: r.goldReward
                })),
                end_reason: result.endReason,
                world_events_triggered: []
            });
        } catch (err) {
            console.error('Lỗi lưu match history:', err);
        }
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

    onSkillUsed(userId, targetUserId, extraData = {}) {
        // Kỹ năng chỉ dùng được lúc là lượt của mình
        const player = this._validateTurn(userId);

        // Lấy thẻ vừa dùng gần nhất nếu Mùi cần sao chép
        extraData.lastUsedCard = this.lastUsedCard ?? null;

        const result = this.skill.useSkill(player, targetUserId, extraData);

        // Nếu kỹ năng có timing (+), mở Stack window
        // TODO: Load timing từ character DB
        const character = { timing: '+' }; 
        if (character.timing === '+') {
            this.stack.open(
                { 
                    name: `Kỹ năng ${player.characterId}`, 
                    effect: result, 
                    timing: '+' 
                },
                player,
                targetUserId ? this.state.players.find(p => p.userId === targetUserId) : null,
                (resolvedEffects) => {
                    this._applyEffects(resolvedEffects);
                    this._broadcast('game:skillResolved', { result });
                    this._checkWinAndBroadcast();
                }
            );
        } else {
            this._broadcast('game:skillResolved', { result });
            this._checkWinAndBroadcast();
        }
    }


    _applyEffects(effects) {
        for (const ef of effects) {
            const actor = this.state.players.find(p => p.userId === ef.actor);
            const target = ef.target
            ? this.state.players.find(p => p.userId === ef.target)
            : null;

            this._applySingleEffect(ef.effect, actor, target);
        }
        this._broadcast('game:stateUpdate', { state: this.state.snapshot() });
        }

        _applySingleEffect(effect, actor, target) {
        switch (effect.action) {

            // ── NHÓM TÀI NGUYÊN ──
            case 'draw_cards':
            for (let i = 0; i < effect.value; i++) {
                if (this.deck.length > 0) actor.handCards.push(this.deck.pop());
            }
            break;

            case 'draw_cards_all':
            for (const p of this.state.players) {
                if (this.deck.length > 0) p.handCards.push(this.deck.pop());
            }
            break;

            case 'take_food_remote': {
            const shops = this.state.board.filter(
                c => c.type === 'shop' && c.food > 0 && !c.isDestroyed
            );
            if (shops.length > 0) {
                const shop = shops[Math.floor(Math.random() * shops.length)];
                shop.food -= 1;
                actor.foodCount += 1;
            }
            break;
            }

            // ── NHÓM TẤN CÔNG ──
            case 'steal_card': {
            if (!target || target.handCards.length === 0) break;
            const idx = Math.floor(Math.random() * target.handCards.length);
            const card = target.handCards.splice(idx, 1)[0];
            actor.handCards.push(card);
            break;
            }

            case 'destroy_card': {
            if (!target || target.handCards.length === 0) break;
            const idx = Math.floor(Math.random() * target.handCards.length);
            target.handCards.splice(idx, 1);
            break;
            }

            case 'steal_food':
            if (target && target.foodCount > 0) {
                target.foodCount -= 1;
                actor.foodCount += 1;
            }
            break;

            case 'block_food':
            if (target) target.blockFoodThisTurn = true;
            break;

            case 'skip_turn':
            if (target) target.isSkipTurn = true;
            break;

            // ── NHÓM PHÒNG THỦ ──
            case 'immune_event':
            if (actor) actor.immuneEvent = true;
            break;

            case 'counter_spell':
            // Đã xử lý bởi StackEngine — thẻ cuối trong stack cancel thẻ trước nó
            // Không cần làm gì thêm ở đây
            break;

            case 'reflect':
            // Áp dụng effect của thẻ trước đó lên attacker thay vì actor
            // TODO: lấy thẻ trước trong stack và đổi target
            break;

            // ── NHÓM DI CHUYỂN ──
            case 'move_to_station': {
            const stations = this.state.board.filter(c => c.type === 'station');
            if (stations.length === 0) break;
            // Chờ client chọn trạm → xử lý qua event riêng
            this._broadcastToPlayer(actor.userId, 'game:chooseStation', {
                stations: stations.map(s => ({ id: s.id }))
            });
            break;
            }

            case 'move_to_shop': {
            const shops = this.state.board.filter(
                c => c.type === 'shop' && c.food > 0 && !c.isDestroyed
            );
            this._broadcastToPlayer(actor.userId, 'game:chooseShop', {
                shops: shops.map(s => ({ id: s.id, food: s.food }))
            });
            break;
            }

            case 'move_to_target': {
            if (!target) break;
            const targetCell = this.state.board[target.position];
            const adjacent = targetCell.linked[0];
            const fromCell = this.state.board[actor.position];
            fromCell.occupants = fromCell.occupants.filter(id => id !== actor.userId);
            actor.position = adjacent;
            this.state.board[adjacent].occupants.push(actor.userId);
            break;
            }

            case 'swap_position': {
            if (!target) break;
            const posA = actor.position;
            const posB = target.position;
            const cellA = this.state.board[posA];
            const cellB = this.state.board[posB];
            cellA.occupants = cellA.occupants.filter(id => id !== actor.userId);
            cellB.occupants = cellB.occupants.filter(id => id !== target.userId);
            actor.position = posB;
            target.position = posA;
            cellB.occupants.push(actor.userId);
            cellA.occupants.push(target.userId);
            break;
            }

            case 'force_move': {
            if (!target) break;
            // Đẩy target về ô Tốt nghiệp (graduation)
            const grad = this.state.board.find(c => c.type === 'graduation');
            if (!grad) break;
            const fromCell = this.state.board[target.position];
            fromCell.occupants = fromCell.occupants.filter(id => id !== target.userId);
            target.position = grad.id;
            grad.occupants.push(target.userId);
            break;
            }

            case 'teleport_pull': {
            if (!target) break;
            const actorCell = this.state.board[actor.position];
            const pullTo = actorCell.linked[0];
            const fromCell = this.state.board[target.position];
            fromCell.occupants = fromCell.occupants.filter(id => id !== target.userId);
            target.position = pullTo;
            this.state.board[pullTo].occupants.push(target.userId);
            break;
            }

            case 'pull_to_school': {
            if (!target) break;
            const school = this.state.board.find(c => c.type === 'school');
            if (!school) break;
            const fromCell = this.state.board[target.position];
            fromCell.occupants = fromCell.occupants.filter(id => id !== target.userId);
            target.position = school.id;
            school.occupants.push(target.userId);
            break;
            }

            case 'pull_all_to_school': {
            const school = this.state.board.find(c => c.type === 'school');
            if (!school) break;
            for (const p of this.state.players) {
                const fromCell = this.state.board[p.position];
                fromCell.occupants = fromCell.occupants.filter(id => id !== p.userId);
                p.position = school.id;
                school.occupants.push(p.userId);
            }
            break;
            }

            case 'restrict_move':
            if (target) target.isSleeping = true;
            break;

            case 'add_steps':
            this.state.lastDiceRoll = Math.min(
                12,
                (this.state.lastDiceRoll ?? 0) + effect.value
            );
            break;

            // ── NHÓM XÚC XẮC ──
            case 'choose_dice':
            // Client gửi lên số muốn chọn qua event riêng
            this._broadcastToPlayer(actor.userId, 'game:chooseDice', {
                options: [1, 2, 3, 4, 5, 6]
            });
            break;

            case 'force_dice':
            if (effect.value > 0) this.state.lastDiceRoll = effect.value;
            break;

            default:
            console.warn(`Effect chưa implement: ${effect.action}`);
        }
        }


}
