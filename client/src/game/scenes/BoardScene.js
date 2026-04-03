import Phaser from 'phaser';
import { CELL_TYPES } from '../../../../shared/constants/CELL_TYPES.js';

// Màu sắc từng loại ô
const CELL_COLORS = {
    [CELL_TYPES.SHOP]: 0x378ADD,
    [CELL_TYPES.SCHOOL]: 0x1D9E75,
    [CELL_TYPES.GRADUATION]: 0xEF9F27,
    [CELL_TYPES.STATION]: 0xD85A30,
    [CELL_TYPES.MONSTER_EVENT]: 0xE24B4A,
    [CELL_TYPES.CARD_DRAW]: 0x7F77DD,
    [CELL_TYPES.BLANK]: 0x888780,
    };

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
        this._drawBoard();
        this._drawTokens();
        this._setupClickHandlers();
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

        const color = CELL_COLORS[cell.type] ?? 0x888780;

        const rect = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, color)
            .setOrigin(0, 0)
            .setInteractive({ cursor: 'pointer' });

        // Label loại ô
        const label = cell.type === CELL_TYPES.SHOP
            ? `S${cell.food ?? 0}`
            : cell.type.substring(0, 3).toUpperCase();

        this.add.text(x + CELL_SIZE / 2, y + CELL_SIZE / 2, label, {
            fontSize: '10px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Lưu để update sau
        rect.cellId = cell.id;
        this.cellObjects[cell.id] = { rect, x, y };
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
