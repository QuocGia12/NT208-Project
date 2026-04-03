import { GameEngine } from '../game/GameEngine.js';
import { SOCKET_EVENTS } from '../../../shared/constants/EVENTS.js';

// Map roomCode → GameEngine instance
const activeGames = new Map();

export function registerGameHandlers(io, socket) {
    socket.on(SOCKET_EVENTS.GAME_START, async ({ roomCode, players }) => {
        try {
        const engine = new GameEngine(io, roomCode);
        activeGames.set(roomCode, engine);
        await engine.initMatch(players);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });

    socket.on(SOCKET_EVENTS.ROLL_DICE, ({ roomCode, userId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onDiceRoll(userId);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });

    socket.on(SOCKET_EVENTS.MOVE_PLAYER, ({ roomCode, userId, targetCellId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onMoveChosen(userId, targetCellId);
        } catch (err) {
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

    socket.on('game:turnEnd', ({ roomCode, userId }) => {
        try {
        const engine = activeGames.get(roomCode);
        if (!engine) throw new Error('Game không tồn tại');
        engine.onTurnEnd(userId);
        } catch (err) {
        socket.emit('error', { message: err.message });
        }
    });
}
