export const SOCKET_EVENTS = {
    // Room
    CREATE_ROOM: 'room:create',
    JOIN_ROOM: 'room:join',
    ROOM_UPDATED: 'room:updated',
    // Game
    GAME_START: 'game:start',
    ROLL_DICE: 'game:rollDice',
    MOVE_PLAYER: 'game:movePlayer',
    PLAY_CARD: 'game:playCard',
    USE_SKILL: 'game:useSkill',
    GAME_STATE_UPDATE: 'game:stateUpdate',
    GAME_OVER: 'game:over',
    // Stack
    STACK_WINDOW_OPEN: 'stack:windowOpen',
    STACK_WINDOW_CLOSE: 'stack:windowClose',
};
