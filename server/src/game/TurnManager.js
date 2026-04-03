export class TurnManager {
    constructor(gameState, deck) {
        this.gs = gameState;
        this.deck = deck;
    }

    startTurn() {
        const player = this.gs.getCurrentPlayer();

        // Xử lý skip turn (bị Khóa tài khoản)
        if (player.isSkipTurn) {
        player.isSkipTurn = false;
        this.gs.advanceTurn();
        return { skipped: true, playerId: player.userId };
        }

        // Xử lý ngủ (bị Ru ngủ)
        if (player.isSleeping) {
        player.isSleeping = false;
        this.gs.advanceTurn();
        return { skipped: true, playerId: player.userId, reason: 'sleeping' };
        }

        player.isMyTurn = true;
        player.skillUsedThisTurn = false;
        this.gs.phase = 'draw';

        // Tự động rút bài
        const drawnCard = this.autoDrawCard(player);

        return { skipped: false, drawnCard, player };
    }

    autoDrawCard(player) {
        if (this.deck.length === 0) return null;

        const card = this.deck.pop();
        player.handCards.push(card);
        return card;
    }

    enforceHandLimit(player) {
        // Trả về số bài cần bỏ, client xử lý việc chọn bài nào bỏ
        const excess = player.handCards.length - 6;
        return excess > 0 ? excess : 0;
    }

    discardCard(player, cardId) {
        const idx = player.handCards.findIndex(c => c.card_code === cardId);
        if (idx === -1) throw new Error('Không tìm thấy lá bài này trong tay');
        player.handCards.splice(idx, 1);
    }

    endTurn() {
        const player = this.gs.getCurrentPlayer();
        player.isMyTurn = false;

        const wasRoundComplete = this.gs.isRoundComplete();
        this.gs.advanceTurn();

        if (wasRoundComplete) {
        this.gs.currentRound++;
        }

        return { roundComplete: wasRoundComplete, newRound: this.gs.currentRound };
    }
}
