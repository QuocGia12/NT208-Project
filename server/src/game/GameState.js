export class GameState {
    constructor(matchId, players, boardCells) {
        this.matchId = matchId;
        this.players = players; // mảng PlayerState
        this.board = boardCells; // mảng MapCell
        this.currentPlayerIndex = 0;
        this.currentRound = 1;
        this.phase = "draw"; // draw → action → move → interact → end
        this.lastDiceRoll = null;
        this.status = "playing"; // playing | finished
        this.stackWindow = false; // đang trong cửa sổ Stack không
        this.createdAt = Date.now();
  }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    advanceTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.phase = "draw";
        this.lastDiceRoll = null;
    }

    isRoundComplete() {
        return this.currentPlayerIndex === 0;
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this));
    }
}

export class PlayerState {
    constructor(userId, username, characterId, startPosition) {
        this.userId = userId;
        this.username = username;
        this.characterId = characterId;
        this.position = startPosition;
        this.foodCount = 0;
        this.handCards = [];
        this.isMyTurn = false;
        this.isSleeping = false;
        this.isSkipTurn = false;
        this.skillUsedThisTurn = false;
    }
}
