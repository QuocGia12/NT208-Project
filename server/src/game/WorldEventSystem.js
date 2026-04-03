export class WorldEventSystem {
    constructor(gameState) {
        this.gs = gameState;
        this.monsterDeck = this._buildMonsterDeck();
    }

    _buildMonsterDeck() {
        // Tên các Shop — shuffle ngẫu nhiên
        const shops = this.gs.board
        .filter(c => c.type === 'shop')
        .map(c => c.id);

        // Fisher-Yates shuffle
        for (let i = shops.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shops[i], shops[j]] = [shops[j], shops[i]];
        }
        return shops;
    }

    onRoundEnd() {
        if (this.monsterDeck.length === 0) return null;

        const targetShopId = this.monsterDeck.pop();
        const shop = this.gs.board[targetShopId];

        if (!shop || shop.isDestroyed) return this.onRoundEnd(); // bỏ qua shop đã hỏng

        const penalized = [];

        // Trừ đồ người đứng tại shop
        for (const userId of shop.occupants) {
        const player = this.gs.players.find(p => p.userId === userId);
        if (player && player.foodCount > 0) {
            player.foodCount -= 1;
            penalized.push({ userId, newFood: player.foodCount });
        }
        }

        // Phá hủy shop
        shop.food = 0;
        shop.isDestroyed = true;

        return {
        targetShopId,
        penalized,
        remainingShops: this.monsterDeck.length
        };
    }
}
