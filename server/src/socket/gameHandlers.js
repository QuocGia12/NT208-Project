import { GameEngine } from '../game/GameEngine.js';
import * as roomService from '../services/roomService.js';
import { SOCKET_EVENTS } from '../../../shared/constants/EVENTS.js';

// Map roomCode → GameEngine instance
const activeGames = new Map();

export function registerGameHandlers(io, socket) {
    // Client request state của game hiện tại
    socket.on('game:requestState', ({ roomCode }) => {
        try {
            console.log('[game:requestState] roomCode:', roomCode, 'activeGames keys:', Array.from(activeGames.keys()));
            const engine = activeGames.get(roomCode);
            if (engine && engine.state) {
                console.log('[game:requestState] Found engine, sending state');
                socket.emit('game:started', {
                    state: engine.state.snapshot(),
                    message: 'Nhận state game'
                });
            } else {
                console.log('[game:requestState] Engine not found!');
                socket.emit('error', { message: 'Game chưa bắt đầu hoặc không tồn tại' });
            }
        } catch (err) {
            console.error('[game:requestState] Error:', err);
            socket.emit('error', { message: err.message });
        }
    });

    socket.on(SOCKET_EVENTS.GAME_START, async ({ roomCode, players }) => {
    try {
        console.log('[game:start] roomCode:', roomCode, 'players:', players.length);
        // Lấy room từ Redis thay vì nhận từ client
        const room = await roomService.getRoom(roomCode);
        if (!room) throw new Error('Phòng không tồn tại');
        if (room.players.length < 2) throw new Error('Cần ít nhất 2 người chơi');

        const engine = new GameEngine(io, roomCode);
        activeGames.set(roomCode, engine);
        console.log('[game:start] Engine created, activeGames size:', activeGames.size);

        // Truyền players từ Redis vào
        await engine.initMatch(room.players);
    } 
    
    catch (err) {
        console.error('[game:start] Error:', err);
        socket.emit('error', { message: err.message });
    }
    });

    socket.on(SOCKET_EVENTS.ROLL_DICE, ({ roomCode, userId }) => {
        try {
            console.log('[game:rollDice] roomCode:', roomCode, 'userId:', userId, 'activeGames size:', activeGames.size);
            const engine = activeGames.get(roomCode);
            if (!engine) throw new Error('Game không tồn tại');
            engine.onDiceRoll(userId);
        } catch (err) {
            console.error('[game:rollDice] Error:', err);
            socket.emit('error', { message: err.message });
        }
    });

    socket.on(SOCKET_EVENTS.MOVE_PLAYER, ({ roomCode, userId, targetCellId }) => {
        try {
            console.log('[game:movePlayer] roomCode:', roomCode, 'userId:', userId, 'target:', targetCellId);
            const engine = activeGames.get(roomCode);
            if (!engine) throw new Error('Game không tồn tại');
            engine.onMoveChosen(userId, targetCellId);
        } catch (err) {
            console.error('[game:movePlayer] Error:', err);
            socket.emit('error', { message: err.message });
        }
    });

    socket.on(SOCKET_EVENTS.PLAY_CARD, ({ roomCode, userId, cardId, targetUserId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onCardPlayed(userId, cardId, targetUserId);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });

    socket.on('game:stackInterrupt', ({ roomCode, userId, cardId, targetUserId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onStackInterrupt(userId, cardId, targetUserId);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });

    socket.on('game:useSkill', ({ roomCode, userId, targetUserId }) => {
        try {
            const engine = activeGames.get(roomCode);
            if (!engine) throw new Error('Game không tồn tại');
            engine.onSkillUsed(userId, targetUserId);
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('game:turnEnd', ({ roomCode, userId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onTurnEnd(userId);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });

    socket.on('game:discardCards', ({ roomCode, userId, cardIds }) => {
        try {
            const engine = activeGames.get(roomCode);
            if (!engine) throw new Error('Game không tồn tại');

            // Validate: chỉ người chơi hiện tại (có lượt) mới được bỏ bài
            const currentPlayer = engine.state.getCurrentPlayer();
            if (currentPlayer.userId !== userId) {
                throw new Error('Chưa đến lượt của bạn');
            }

            // Kiểm tra số bài cần bỏ
            const excess = currentPlayer.handCards.length - 6;
            if (excess <= 0) {
                throw new Error('Không cần bỏ bài');
            }
            if (cardIds.length !== excess) {
                throw new Error(`Cần bỏ ${excess} lá, bạn chọn ${cardIds.length} lá`);
            }

            // Verify: các lá bài phải thuộc về người chơi này
            for (const cardId of cardIds) {
                const idx = currentPlayer.handCards.findIndex(c => c.card_code === cardId);
                if (idx === -1) {
                    throw new Error('Không thể bỏ lá bài không có trong tay');
                }
            }

            // Bỏ các lá đã chọn
            cardIds.forEach(cardId => {
                const idx = currentPlayer.handCards.findIndex(c => c.card_code === cardId);
                if (idx !== -1) currentPlayer.handCards.splice(idx, 1);
            });

            console.log(`${userId} bỏ ${cardIds.length} lá, còn ${currentPlayer.handCards.length} lá`);

            // Reveal lá mới và broadcast turnStarted
            const newCard = currentPlayer.handCards[currentPlayer.handCards.length - 1];
            engine._broadcast('game:turnStarted', {
                currentPlayer: currentPlayer.userId,
                drawnCard: newCard,
                mustDiscard: 0,
                state: engine.state.snapshot()
            });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });
}
