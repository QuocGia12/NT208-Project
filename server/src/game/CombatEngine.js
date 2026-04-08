export class CombatEngine {
    constructor(gameState) {
        this.gs = gameState;
    }

    // Kiểm tra ô đích sau khi di chuyển xong
    // Chỉ xảy ra lúc player vừa tới ô, không phải lần sau
    resolveCell(mover) {
        const cell = this.gs.board[mover.position];
        const results = [];

        // Ưu tiên 1: Nhặt lương thực trên shop
        // Chỉ nhặt nếu: ô là shop, có lương thực, và mover là người duy nhất đứng đó
        if (cell.type === 'shop' && cell.food > 0 && cell.occupants.length === 1) {
            const picked = this._pickupFood(mover, cell);
            results.push(picked);
            return results; // Dừng tại đây, không xử lý combat
        }

        // Ưu tiên 2: Xử lý combat (húc văng) nếu có người khác đứng cùng ô
        const others = cell.occupants
            .filter(id => id !== mover.userId)
            .map(id => this._getPlayer(id));

        if (others.length > 0) {
            for (const victim of others) {
                const pushResult = this._pushPlayer(mover, victim);
                results.push(pushResult);
            }
        }

        return results;
    }

    // Nhặt 1 lương thực từ ô shop
    // Mỗi lần player tới ô shop: -1 food từ ô, +1 food cho player
    _pickupFood(player, cell) {
        if (cell.type !== 'shop' || cell.food <= 0) {
            throw new Error('Không thể nhặt lương thực từ ô này');
        }

        cell.food -= 1;
        player.foodCount += 1;

        return {
            type: 'pickup',
            playerId: player.userId,
            cellId: cell.id,
            newFood: cell.food,  // Số lương thực còn lại trên shop
            playerFood: player.foodCount  // Số lương thực mới của player
        };
    }

    _pushPlayer(attacker, victim) {
        const currentCell = this.gs.board[victim.position];
        const results = [];

        // Tìm ô kề để đẩy victim sang
        // Attacker chọn hướng — ở đây mặc định đẩy về phía trước (linked[0])
        // Client sẽ gửi lên hướng cụ thể, tạm thời dùng linked[0]
        const pushTargetId = currentCell.linked.find(id => id !== attacker.position)
        ?? currentCell.linked[0];

        // Di chuyển victim
        currentCell.occupants = currentCell.occupants.filter(id => id !== victim.userId);
        const pushTarget = this.gs.board[pushTargetId];
        victim.position = pushTargetId;
        pushTarget.occupants.push(victim.userId);

        results.push({
        type: 'push',
        attackerId: attacker.userId,
        victimId: victim.userId,
        fromCell: currentCell.id,
        toCell: pushTargetId
        });

        // Kiểm tra domino — victim bị đẩy vào ô có người khác không?
        const dominoTargets = pushTarget.occupants
        .filter(id => id !== victim.userId)
        .map(id => this._getPlayer(id));

        if (dominoTargets.length > 0) {
        // Người cuối cùng trong chuỗi domino mới bị mất đồ
        const chainEnd = dominoTargets[dominoTargets.length - 1];
        const stealResult = this._stealFood(attacker, chainEnd);
        results.push({ type: 'domino', chainEnd: chainEnd.userId });
        results.push(stealResult);
        } else {
        // Húc văng thẳng — cướp đồ của victim
        const stealResult = this._stealFood(attacker, victim);
        results.push(stealResult);
        }

        return results;
    }

    _stealFood(attacker, victim) {
        if (victim.foodCount <= 0) {
        return { type: 'steal', success: false, reason: 'no_food' };
        }
        victim.foodCount -= 1;
        attacker.foodCount += 1;
        return {
        type: 'steal',
        success: true,
        attackerId: attacker.userId,
        victimId: victim.userId,
        attackerFood: attacker.foodCount,
        victimFood: victim.foodCount
        };
    }

    _getPlayer(userId) {
        return this.gs.players.find(p => p.userId === userId);
    }
}
