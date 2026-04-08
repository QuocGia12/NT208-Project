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

        // Sắp xếp theo foodCount giảm dần
        const sorted = [...gameState.players]
            .sort((a, b) => b.foodCount - a.foodCount);

        // Bước 1: Group các player theo foodCount (để xác định tie)
        const groups = [];
        let currentGroup = [];
        let prevFood = null;

        for (const player of sorted) {
            if (prevFood !== null && player.foodCount !== prevFood) {
                // foodCount thay đổi → lưu group hiện tại, bắt đầu group mới
                groups.push([...currentGroup]);
                currentGroup = [];
            }
            currentGroup.push(player);
            prevFood = player.foodCount;
        }
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        // Bước 2: Tính rank và tiền cho từng group
        const rankings = [];
        let currentRank = 1;

        for (const group of groups) {
            const baseReward = this._calcGold(currentRank);
            const sharedReward = Math.floor(baseReward / group.length);  // Chia tiền
            const isTied = group.length > 1;  // Hòa nếu >1 người

            for (const player of group) {
                rankings.push({
                    userId: player.userId,
                    username: player.username,
                    rank: currentRank,
                    finalFood: player.foodCount,
                    goldReward: sharedReward,
                    isTied: isTied
                });
            }

            // Cập nhật rank cho group tiếp theo
            currentRank += group.length;
        }

        return { endReason, rankings };
    }

    _calcGold(rank) {
        const rewards = { 1: 100, 2: 60, 3: 30, 4: 10 };
        return rewards[rank] ?? 10;
    }
}
