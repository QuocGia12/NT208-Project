import { CELL_TYPES } from '../../../shared/constants/CELL_TYPES.js';

export class SkillEngine {
    constructor(gameState, stackEngine) {
        this.gs = gameState;
        this.stack = stackEngine;
    }

    // Kiểm tra nhân vật có thể dùng kỹ năng không
    canUseSkill(player) {
        if (player.skillUsedThisTurn) {
        throw new Error('Đã dùng kỹ năng trong lượt này');
        }
        if (player.isSkipTurn || player.isSleeping) {
        throw new Error('Đang bị khống chế, không thể dùng kỹ năng');
        }

        const currentCell = this.gs.board[player.position];

        // Một số kỹ năng cấm dùng ở Trường học
        const forbiddenAtSchool = ['char_ngo', 'char_tuat'];
        if (
        currentCell.type === CELL_TYPES.SCHOOL &&
        forbiddenAtSchool.includes(player.characterId)
        ) {
        throw new Error('Không thể dùng kỹ năng này tại Trường học');
        }
    }

    useSkill(actor, targetId, extraData = {}) {
        this.canUseSkill(actor);

        const target = targetId
        ? this.gs.players.find(p => p.userId === targetId)
        : null;

        const result = this._resolveSkill(actor, target, extraData);
        actor.skillUsedThisTurn = true;

        return result;
    }

    _resolveSkill(actor, target, extra) {
        switch (actor.characterId) {

        // Tý (+): khi người khác lấy đồ từ shop ≥2 bao → lấy tất cả còn lại
        // Logic này được trigger trong CombatEngine._pickupFood()
        // Đây là passive — không cần useSkill thủ công
        case 'char_ty':
            return { type: 'passive', message: 'Kỹ năng Tý là passive, tự động kích hoạt' };

        // Sửu (-): húc văng 1 lá bài + đẩy 2 ô
        case 'char_suu': {
            if (!target) throw new Error('Cần chọn mục tiêu');
            const stolenCard = this._stealRandomCard(target);
            const pushResult = this._pushPlayerNSteps(target, extra.direction ?? 0, 2);
            return { type: 'suu', stolenCard, pushResult };
        }

        // Dần (+): khi người khác lấy bao từ Shop → ép cống nạp
        case 'char_dan':
            return { type: 'passive', message: 'Kỹ năng Dần là passive, tự động kích hoạt' };

        // Mão (+): ru ngủ 1 người (hoặc bản thân)
        case 'char_mao': {
            const victim = target ?? actor;
            victim.isSleeping = true;
            return {
            type: 'mao',
            victimId: victim.userId,
            message: `${victim.username} bị ru ngủ, mất lượt tiếp theo`
            };
        }

        // Thìn (+): đổ lại xúc xắc, đi giúp người khác
        case 'char_thin': {
            const diceResult = Math.floor(Math.random() * 6) + 1;
            const victim = target ?? actor;
            this.gs.lastDiceRoll = diceResult;
            return {
            type: 'thin',
            diceResult,
            affectedPlayerId: victim.userId,
            direction: extra.direction ?? 0,
            message: `Thìn đổ được ${diceResult} cho ${victim.username}`
            };
        }

        // Tỵ (+): hủy kỹ năng nhân vật của người khác 1 lượt
        case 'char_ty2': {
            if (!target) throw new Error('Cần chọn mục tiêu');
            target.skillUsedThisTurn = true;
            return {
            type: 'ty2',
            targetId: target.userId,
            message: `Kỹ năng của ${target.username} bị vô hiệu hóa lượt này`
            };
        }

        // Ngọ (-): đổ xúc xắc thêm 1 lần (cấm ở Trường học)
        case 'char_ngo': {
            const bonus = Math.floor(Math.random() * 6) + 1;
            this.gs.lastDiceRoll = (this.gs.lastDiceRoll ?? 0) + bonus;
            return {
            type: 'ngo',
            bonus,
            total: this.gs.lastDiceRoll,
            message: `Ngọ đi thêm ${bonus} bước`
            };
        }

        // Mùi (+): sao chép thẻ vừa được dùng trên bàn
        case 'char_mui': {
            if (!extra.lastUsedCard) {
            throw new Error('Chưa có thẻ nào được dùng để sao chép');
            }
            actor.handCards.push({ ...extra.lastUsedCard });
            return {
            type: 'mui',
            copiedCard: extra.lastUsedCard.name,
            message: `Mùi sao chép ${extra.lastUsedCard.name}`
            };
        }

        // Thân (+): yêu cầu người vừa đổ xúc xắc chọn mặt đối lập
        case 'char_than': {
            if (!target) throw new Error('Cần chọn mục tiêu');
            const opposite = 7 - (this.gs.lastDiceRoll ?? 1);
            this.gs.lastDiceRoll = opposite;
            return {
            type: 'than',
            targetId: target.userId,
            originalDice: 7 - opposite,
            newDice: opposite,
            message: `Thân đổi xúc xắc của ${target.username} thành ${opposite}`
            };
        }

        // Dậu (-): tặng 1 bài → ép trả lại 2 bài
        case 'char_dau': {
            if (!target) throw new Error('Cần chọn mục tiêu');
            if (actor.handCards.length === 0) throw new Error('Không có bài để tặng');

            // Tặng bài đầu tiên
            const giftCard = actor.handCards.shift();
            target.handCards.push(giftCard);

            // Trả về danh sách bài target đang có để client cho actor chọn 2 bài
            return {
            type: 'dau',
            giftCard: giftCard.name,
            targetCards: target.handCards,
            targetId: target.userId,
            message: `Dậu tặng ${giftCard.name}, chờ ${target.username} trả 2 bài`,
            awaitResponse: true   // client cần xử lý thêm
            };
        }

        // Tuất (-): dịch chuyển đến Shop bất kỳ đang có đồ
        case 'char_tuat': {
            if (!extra.targetCellId) {
            // Trả về danh sách shop có đồ để client chọn
            const availableShops = this.gs.board.filter(
                c => c.type === CELL_TYPES.SHOP && c.food > 0 && !c.isDestroyed
            );
            return {
                type: 'tuat',
                awaitChoice: true,
                availableShops: availableShops.map(s => ({ id: s.id, food: s.food }))
            };
            }
            // Thực hiện teleport
            const fromCell = this.gs.board[actor.position];
            const toCell = this.gs.board[extra.targetCellId];
            fromCell.occupants = fromCell.occupants.filter(id => id !== actor.userId);
            actor.position = extra.targetCellId;
            toCell.occupants.push(actor.userId);
            return {
            type: 'tuat',
            fromCell: fromCell.id,
            toCell: extra.targetCellId
            };
        }

        // Hợi (-): lấy từ xa 1 bao từ Shop bất kỳ
        case 'char_hoi': {
            if (!extra.targetCellId) {
            const shops = this.gs.board.filter(
                c => c.type === CELL_TYPES.SHOP && c.food > 0 && !c.isDestroyed
            );
            return {
                type: 'hoi',
                awaitChoice: true,
                availableShops: shops.map(s => ({ id: s.id, food: s.food }))
            };
            }
            const shop = this.gs.board[extra.targetCellId];
            if (!shop || shop.food <= 0) throw new Error('Shop không có lương thực');
            shop.food -= 1;
            actor.foodCount += 1;
            return {
            type: 'hoi',
            shopId: extra.targetCellId,
            newFood: shop.food,
            actorFood: actor.foodCount
            };
        }

        default:
            throw new Error(`Kỹ năng ${actor.characterId} chưa được implement`);
        }
    }

    // Passive trigger cho Tý — gọi từ CombatEngine
    triggerTyPassive(actor, shop) {
        const tyPlayer = this.gs.players.find(p => p.characterId === 'char_ty');
        if (!tyPlayer || tyPlayer.userId === actor.userId) return null;
        if (shop.food <= 0) return null;

        const taken = shop.food;
        tyPlayer.foodCount += taken;
        shop.food = 0;

        return {
        type: 'ty_passive',
        tyPlayerId: tyPlayer.userId,
        taken,
        message: `Tý kích hoạt kỹ năng, lấy thêm ${taken} bao!`
        };
    }

    // Passive trigger cho Dần — gọi từ CombatEngine
    triggerDanPassive(actor, pickedFood) {
        const danPlayer = this.gs.players.find(p => p.characterId === 'char_dan');
        if (!danPlayer || danPlayer.userId === actor.userId) return null;
        if (actor.foodCount <= 0) return null;

        actor.foodCount -= 1;
        danPlayer.foodCount += 1;

        return {
        type: 'dan_passive',
        danPlayerId: danPlayer.userId,
        fromPlayerId: actor.userId,
        message: `Dần ép ${actor.username} cống nạp 1 bao!`
        };
    }

    _stealRandomCard(target) {
        if (target.handCards.length === 0) return null;
        const idx = Math.floor(Math.random() * target.handCards.length);
        return target.handCards.splice(idx, 1)[0];
    }

    _pushPlayerNSteps(target, direction, steps) {
        for (let i = 0; i < steps; i++) {
        const cell = this.gs.board[target.position];
        const next = cell.linked[direction % cell.linked.length];
        cell.occupants = cell.occupants.filter(id => id !== target.userId);
        target.position = next;
        this.gs.board[next].occupants.push(target.userId);
        }
        return { newPosition: target.position };
    }
}