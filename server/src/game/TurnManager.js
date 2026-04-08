export class TurnManager {
    constructor(gameState, deck) {
        this.gs = gameState;
        this.deck = deck;
    }

    startTurn() {
        const player = this.gs.getCurrentPlayer();

        if (player.isSkipTurn) {
            player.isSkipTurn = false;
            this.gs.advanceTurn();
            return { skipped: true, playerId: player.userId };
        }

        if (player.isSleeping) {
            player.isSleeping = false;
            this.gs.advanceTurn();
            return { skipped: true, playerId: player.userId, reason: 'sleeping' };
        }

        player.isMyTurn = true;
        player.skillUsedThisTurn = false;
        this.gs.phase = 'draw';        // ← đảm bảo reset về 'draw'
        this.gs.lastDiceRoll = null;   // ← reset xúc xắc

        const drawnCard = this.autoDrawCard(player);
        const excess = player.handCards.length - 6;
        return { 
            skipped: false, 
            drawnCard, 
            player,
            excess: excess > 0 ? excess : 0,
            mustDiscard: excess > 0
         };
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

        // Advance turn trước, rồi check xem có complete vòng không
        this.gs.advanceTurn();
        const wasRoundComplete = this.gs.isRoundComplete();

        if (wasRoundComplete) {
        this.gs.currentRound++;
        }

        return { roundComplete: wasRoundComplete, newRound: this.gs.currentRound };
    }
}
