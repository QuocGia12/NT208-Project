export class StackEngine {
    constructor(io, roomCode) {
        this.io = io;
        this.roomCode = roomCode;
        this.stack = [];           // mảng StackEntry
        this.windowMs = 3000;      // 3 giây
        this.timer = null;
        this.isOpen = false;
        this.onResolve = null;     // callback khi stack giải quyết xong
    }

    // Mở cửa sổ stack khi có thẻ/kỹ năng được kích hoạt
    open(card, actor, target, onResolve) {
        try {
            // Xóa timer cũ nếu có
            if (this.timer) clearTimeout(this.timer);

            // Push thẻ đầu tiên vào stack
            this.stack.push({ card, actor, target, timestamp: Date.now() });
            this.isOpen = true;
            this.onResolve = onResolve;

            // Broadcast cho tất cả: có 3 giây để can thiệp
            this.io.to(this.roomCode).emit('stack:windowOpen', {
            stack: this.stack,
            windowMs: this.windowMs,
            message: `${actor.username} vừa dùng ${card.name}! Có ${this.windowMs / 1000} giây để phản đòn.`
            });

            // Đặt timer tự động giải quyết
            this._resetTimer();
        } catch (err) {
            console.error('StackEngine.open lỗi:', err);
        }
    }

    // Opponent push thẻ (+) vào stack để can thiệp
    interrupt(card, actor, target) {
        try {
            if (!this.isOpen) {
            throw new Error('Không trong cửa sổ Stack');
            }
            if (card.timing !== '+') {
            throw new Error('Chỉ thẻ tức thời (+) mới có thể can thiệp');
            }

            // Hủy timer cũ, reset lại 3 giây
            this._resetTimer();

            this.stack.push({ card, actor, target, timestamp: Date.now() });

            this.io.to(this.roomCode).emit('stack:interrupted', {
            stack: this.stack,
            interruptor: actor.username,
            cardName: card.name,
            message: `${actor.username} phản đòn bằng ${card.name}!`
            });
        } catch (err) {
            console.error('StackEngine.interrupt lỗi:', err);
            // Có lỗi vẫn tiếp tục game, chỉ log thôi
        }
    }

    _resetTimer() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
        this._resolve();
        }, this.windowMs);
    }

    // Giải quyết stack theo LIFO (vào sau ra trước)
    _resolve() {
        try {
            this.isOpen = false;
            const resolvedEffects = [];

            const reversed = [...this.stack].reverse();

            for (const entry of reversed) {
            // Guard — kiểm tra entry hợp lệ trước khi xử lý
            if (!entry || !entry.card || !entry.actor) {
                console.warn('StackEngine._resolve: entry không hợp lệ, bỏ qua', entry);
                continue;
            }

            resolvedEffects.push({
                card: entry.card,
                actor: entry.actor.userId,
                target: entry.target?.userId ?? null,
                effect: entry.card.effect
            });
            }

            this.io.to(this.roomCode).emit('stack:resolved', {
            effects: resolvedEffects,
            message: 'Stack giải quyết xong!'
            });

            const callbackEffects = [...resolvedEffects];
            this.stack = [];
            this.timer = null;

            if (this.onResolve) {
            this.onResolve(callbackEffects);
            }

        } catch (err) {
            console.error('StackEngine._resolve lỗi:', err);
            // Reset stack để game tiếp tục
            this.stack = [];
            this.timer = null;
            this.isOpen = false;
            // Báo client stack đã xong dù có lỗi
            try {
            this.io.to(this.roomCode).emit('stack:resolved', {
                effects: [],
                message: 'Stack giải quyết xong!'
            });
            } catch (e) {
            console.error('Không thể emit stack:resolved:', e);
            }
        }
        }
    clear() {
        if (this.timer) clearTimeout(this.timer);
        this.stack = [];
        this.isOpen = false;
        this.timer = null;
    }
}
