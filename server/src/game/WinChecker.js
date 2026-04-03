export class WinChecker {
    check(gameState) {
        const allShopsDestroyed = gameState.board
        .filter(c => c.type === 'shop')
        .every(c => c.isDestroyed);

        const allFoodCollected = gameState.board
        .filter(c => c.type === 'shop')
        .every(c => c.food === 0);

        if (!allShopsDestroyed && !allFoodCollected) return null;

        const endReason = allShopsDestroyed
        ? 'all_shops_destroyed'
        : 'all_food_collected';

        const rankings = [...gameState.players]
        .sort((a, b) => b.foodCount - a.foodCount)
        .map((p, idx) => ({
            userId: p.userId,
            username: p.username,
            rank: idx + 1,
            finalFood: p.foodCount,
            goldReward: this._calcGold(idx + 1)
        }));

        return { endReason, rankings };
    }

    _calcGold(rank) {
        const rewards = { 1: 100, 2: 60, 3: 30, 4: 10 };
        return rewards[rank] ?? 10;
    }
}
