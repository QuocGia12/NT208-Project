import { CELL_TYPES } from '../../../shared/constants/CELL_TYPES.js';

export class MovementEngine {
    constructor(gameState) {
        this.gs = gameState;
    }

    roll() {
        const result = Math.floor(Math.random() * 6) + 1;
        this.gs.lastDiceRoll = result;
        this.gs.phase = 'move';
        return result;
    }

    // Tính các ô có thể đến với số bước cho trước
    // Trả về mảng path (từng ô đi qua) để animate
    getPath(fromId, steps) {
        const cell = this.gs.board[fromId];
        if (!cell) return [];

        // BFS tìm tất cả path độ dài = steps
        const paths = [];
        this._dfs(fromId, steps, [fromId], paths);
        return paths;
    }

    _dfs(currentId, remaining, currentPath, results) {
        if (remaining === 0) {
        results.push([...currentPath]);
        return;
        }
        const cell = this.gs.board[currentId];
        for (const nextId of cell.linked) {
        // Không đi ngược lại bước vừa rồi (trừ khi chỉ có 1 hướng)
        if (currentPath.length > 1 && nextId === currentPath[currentPath.length - 2]) {
            continue;
        }
        currentPath.push(nextId);
        this._dfs(nextId, remaining - 1, currentPath, results);
        currentPath.pop();
        }
    }

    executeMove(player, targetCellId) {
        const fromCell = this.gs.board[player.position];
        const toCell = this.gs.board[targetCellId];

        if (!toCell) throw new Error('Ô không tồn tại');

        // Rời ô cũ
        fromCell.occupants = fromCell.occupants.filter(id => id !== player.userId);

        // Đến ô mới
        player.position = targetCellId;
        toCell.occupants.push(player.userId);

        this.gs.phase = 'interact';
        return toCell;
    }

    handleStation(player, cell) {
        if (cell.type !== CELL_TYPES.STATION) return null;

        // Tìm tất cả Trạm Ngựa khác
        const otherStations = this.gs.board.filter(
        c => c.type === CELL_TYPES.STATION && c.id !== cell.id
        );

        // Trả về danh sách để client cho player chọn
        return otherStations.map(s => ({ id: s.id }));
    }

    teleportTo(player, targetCellId) {
        const fromCell = this.gs.board[player.position];
        const toCell = this.gs.board[targetCellId];

        fromCell.occupants = fromCell.occupants.filter(id => id !== player.userId);
        player.position = targetCellId;
        toCell.occupants.push(player.userId);

        return toCell;
    }
}
