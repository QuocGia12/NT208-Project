import Phaser from 'phaser';
import { CELL_TYPES } from '../../../../shared/constants/CELL_TYPES.js';

// Màu sắc từng loại ô
    const CELL_COLORS = {
    shop:          0x378ADD,  // xanh dương — nơi có lương thực
    school:        0x1D9E75,  // xanh lá — khu an toàn
    graduation:    0xEF9F27,  // cam vàng — điểm xuất phát
    station:       0xD85A30,  // cam đậm — trạm ngựa
    monster_event: 0xE24B4A,  // đỏ — nguy hiểm
    card_draw:     0x7F77DD,  // tím — rút thẻ
    blank:         0x444455,  // xám tối — ô trống
};

function getCellLabel(cell) {
    switch (cell.type) {
        case 'shop':
        return cell.isDestroyed ? '💀' : `${cell.food ?? 0}`;
        case 'school':        return '🏫';
        case 'graduation':    return '🎓';
        case 'station':       return '🚉';
        case 'monster_event': return '👹';
        case 'card_draw':     return 'CARD';
        case 'blank':         return '';
        default:              return '';
    }
}

const CELL_SIZE = 52;
const CELL_GAP = 8;
const COLS = 8;

export default class BoardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BoardScene' });
        this.cellObjects = {};   // id → Phaser GameObject
        this.tokenObjects = {};  // userId → Phaser GameObject
    }

    init(data) {
        this.gameState = data.gameState;
        this.myUserId = data.myUserId;
        this.socketHandlers = data.socketHandlers; // callback lên React
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        if (!this.gameState?.board) return;

        this.cellTextObjects = {}; // ← thêm — lưu reference đến text objects
        this.cellRectObjects = {}; // ← thêm — lưu reference đến rect objects

        this._drawBoard();
        this._drawTokens();
        this._setupClickHandlers();
        this.game.events.emit('sceneReady', this);
        }

        _drawBoard() {
        const board = this.gameState.board;
        const startX = 40;
        const startY = 40;

        board.forEach((cell, idx) => {
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);
            const x = startX + col * (CELL_SIZE + CELL_GAP);
            const y = startY + row * (CELL_SIZE + CELL_GAP);

            const color = cell.isDestroyed
            ? 0x5a2c2c  // shop bị phá hủy màu đỏ tối
            : (CELL_COLORS[cell.type] ?? 0x444455);

            const rect = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, color)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

            rect.cellId = cell.id;

            const label = getCellLabel(cell);
            const text = this.add.text(
            x + CELL_SIZE / 2,
            y + CELL_SIZE / 2,
            label,
            {
                fontSize: '18px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }
            ).setOrigin(0.5);

            // Lưu reference để update sau
            this.cellRectObjects[cell.id] = { rect, x, y };
            this.cellTextObjects[cell.id] = text;
            this.cellObjects[cell.id] = { x, y, rect }; // ← thêm dòng này
        });
        }

        // Gọi method này mỗi khi gameState thay đổi
        updateBoard(newGameState) {
        this.gameState = newGameState;
        const board = newGameState.board;

        board.forEach(cell => {
            const rectObj = this.cellRectObjects[cell.id];
            const textObj = this.cellTextObjects[cell.id];
            if (!rectObj || !textObj) return;

            // Cập nhật màu nếu shop bị phá hủy — thành màu đỏ tối
            const color = cell.isDestroyed
            ? 0x5a2c2c
            : (CELL_COLORS[cell.type] ?? 0x444455);
            rectObj.rect.setFillStyle(color);

            // Cập nhật label — quan trọng nhất là food count
            textObj.setText(getCellLabel(cell));
        });

        // Cập nhật vị trí token
        this._updateTokenPositions(newGameState.players);
        }

        _updateTokenPositions(players) {
        players.forEach(player => {
            const tokenData = this.tokenObjects[player.userId];
            if (!tokenData) return;

            const cellObj = this.cellRectObjects[player.position];
            if (!cellObj) return;

            const targetX = cellObj.x + 10 + tokenData.offsetX;
            const targetY = cellObj.y + 10 + tokenData.offsetY;

            // Chỉ update nếu vị trí khác — không animate ở đây vì đã có animateMove
            tokenData.token.setPosition(targetX, targetY);
        });
        }

    _drawTokens() {
        const colors = [0xFFD700, 0xFF6B6B, 0x6BCB77, 0x4ECDC4];
        this.gameState.players.forEach((player, idx) => {
        const cell = this.cellObjects[player.position];
        if (!cell) return;

        const offsetX = (idx % 2) * 14;
        const offsetY = Math.floor(idx / 2) * 14;

        const token = this.add.circle(
            cell.x + 10 + offsetX,
            cell.y + 10 + offsetY,
            10,
            colors[idx]
        );

        this.add.text(
            cell.x + 10 + offsetX,
            cell.y + 10 + offsetY,
            player.username.substring(0, 1).toUpperCase(),
            { fontSize: '9px', color: '#000' }
        ).setOrigin(0.5);

        token.userId = player.userId;
        this.tokenObjects[player.userId] = {
            token,
            currentCell: player.position,
            offsetX,
            offsetY
        };
        });
    }

    _setupClickHandlers() {
        this.input.on('gameobjectdown', (pointer, obj) => {
        if (obj.cellId !== undefined && this.highlightedCells?.includes(obj.cellId)) {
            this.socketHandlers.onCellClick(obj.cellId);
            this._clearHighlights();
        }
        });
    }

    // Highlight các ô có thể đi đến
    highlightPaths(paths) {
        this._clearHighlights();
        const targets = [...new Set(paths.map(p => p[p.length - 1]))];
        this.highlightedCells = targets;

        targets.forEach(cellId => {
        const cellObj = this.cellObjects[cellId];
        if (!cellObj) return;

        const highlight = this.add.rectangle(
            cellObj.x, cellObj.y,
            CELL_SIZE, CELL_SIZE,
            0xFFFF00, 0.4
        ).setOrigin(0, 0);

        cellObj.highlight = highlight;
        });
    }

    _clearHighlights() {
        if (!this.highlightedCells) return;
        this.highlightedCells.forEach(cellId => {
        const cellObj = this.cellObjects[cellId];
        if (cellObj?.highlight) {
            cellObj.highlight.destroy();
            cellObj.highlight = null;
        }
        });
        this.highlightedCells = [];
    }

    // Animate token di chuyển từng ô theo path
    async animateMove(userId, path) {
        return new Promise((resolve) => {
        const tokenData = this.tokenObjects[userId];
        if (!tokenData) return resolve();

        let stepIndex = 0;

        const moveNextStep = () => {
            if (stepIndex >= path.length) {
            tokenData.currentCell = path[path.length - 1];
            return resolve();
            }

            const cellId = path[stepIndex];
            const cellObj = this.cellObjects[cellId];
            if (!cellObj) { stepIndex++; return moveNextStep(); }

            const targetX = cellObj.x + 10 + tokenData.offsetX;
            const targetY = cellObj.y + 10 + tokenData.offsetY;

            this.tweens.add({
            targets: tokenData.token,
            x: targetX,
            y: targetY,
            duration: 180,
            ease: 'Power1',
            onComplete: () => {
                stepIndex++;
                moveNextStep();
            }
            });
        };

        moveNextStep();
        });
    }

    // Cập nhật food count trên ô
    updateCellFood(cellId) {
        const cellObj = this.cellObjects[cellId];
        if (!cellObj) return;
        // Re-render label — đơn giản nhất là destroy và tạo lại
        // TODO: giữ reference đến text object để update
    }
    
}
