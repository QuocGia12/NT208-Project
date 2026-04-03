import { GameEngine } from '../game/GameEngine.js';
import * as roomService from '../services/roomService.js';
import { SOCKET_EVENTS } from '../../../shared/constants/EVENTS.js';

// Map roomCode → GameEngine instance
const activeGames = new Map();

export function registerGameHandlers(io, socket) {
    socket.on(SOCKET_EVENTS.GAME_START, async ({ roomCode, players }) => {
    try {
        // Lấy room từ Redis thay vì nhận từ client
        const room = await roomService.getRoom(roomCode);
        if (!room) throw new Error('Phòng không tồn tại');
        if (room.players.length < 2) throw new Error('Cần ít nhất 2 người chơi');

        const engine = new GameEngine(io, roomCode);
        activeGames.set(roomCode, engine);

        // Truyền players từ Redis vào
        await engine.initMatch(room.players);
    } 
    
    catch (err) {
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
