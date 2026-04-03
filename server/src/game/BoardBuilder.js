import { CELL_TYPES } from '../../../shared/constants/CELL_TYPES.js';

export function buildBoard() {
    // Bàn cờ 48 ô theo thiết kế bản đồ
    // Mỗi ô có: id, type, linkedCells (các ô kề), foodCount
    const cells = [];

    const layout = [
        // id, type, linkedCells, foodCount
        { id: 0,  type: CELL_TYPES.GRADUATION, linked: [1],        food: 0 },
        { id: 1,  type: CELL_TYPES.BLANK,      linked: [0, 2],     food: 0 },
        { id: 2,  type: CELL_TYPES.SHOP,       linked: [1, 3],     food: 3 },
        { id: 3,  type: CELL_TYPES.BLANK,      linked: [2, 4],     food: 0 },
        { id: 4,  type: CELL_TYPES.STATION,    linked: [3, 5, 20], food: 0 },
        { id: 5,  type: CELL_TYPES.SHOP,       linked: [4, 6],     food: 3 },
        { id: 6,  type: CELL_TYPES.BLANK,      linked: [5, 7],     food: 0 },
        { id: 7,  type: CELL_TYPES.SHOP,       linked: [6, 8],     food: 2 },
        { id: 8,  type: CELL_TYPES.CARD_DRAW,  linked: [7, 9],     food: 0 },
        { id: 9,  type: CELL_TYPES.SHOP,       linked: [8, 10],    food: 3 },
        { id: 10, type: CELL_TYPES.BLANK,      linked: [9, 11],    food: 0 },
        { id: 11, type: CELL_TYPES.STATION,    linked: [10, 12, 30], food: 0 },
        { id: 12, type: CELL_TYPES.SHOP,       linked: [11, 13],   food: 2 },
        { id: 13, type: CELL_TYPES.BLANK,      linked: [12, 14],   food: 0 },
        { id: 14, type: CELL_TYPES.MONSTER_EVENT, linked: [13, 15], food: 0 },
        { id: 15, type: CELL_TYPES.SHOP,       linked: [14, 16],   food: 3 },
        { id: 16, type: CELL_TYPES.BLANK,      linked: [15, 17],   food: 0 },
        { id: 17, type: CELL_TYPES.SCHOOL,     linked: [16, 18],   food: 0 },
        { id: 18, type: CELL_TYPES.SHOP,       linked: [17, 19],   food: 2 },
        { id: 19, type: CELL_TYPES.BLANK,      linked: [18, 20],   food: 0 },
        { id: 20, type: CELL_TYPES.STATION,    linked: [19, 21, 4], food: 0 },
        { id: 21, type: CELL_TYPES.SHOP,       linked: [20, 22],   food: 3 },
        { id: 22, type: CELL_TYPES.BLANK,      linked: [21, 23],   food: 0 },
        { id: 23, type: CELL_TYPES.SHOP,       linked: [22, 24],   food: 2 },
        { id: 24, type: CELL_TYPES.CARD_DRAW,  linked: [23, 25],   food: 0 },
        { id: 25, type: CELL_TYPES.SHOP,       linked: [24, 26],   food: 3 },
        { id: 26, type: CELL_TYPES.BLANK,      linked: [25, 27],   food: 0 },
        { id: 27, type: CELL_TYPES.MONSTER_EVENT, linked: [26, 28], food: 0 },
        { id: 28, type: CELL_TYPES.SHOP,       linked: [27, 29],   food: 2 },
        { id: 29, type: CELL_TYPES.BLANK,      linked: [28, 30],   food: 0 },
        { id: 30, type: CELL_TYPES.STATION,    linked: [29, 31, 11], food: 0 },
        { id: 31, type: CELL_TYPES.SHOP,       linked: [30, 32],   food: 3 },
        { id: 32, type: CELL_TYPES.BLANK,      linked: [31, 33],   food: 0 },
        { id: 33, type: CELL_TYPES.SHOP,       linked: [32, 34],   food: 2 },
        { id: 34, type: CELL_TYPES.BLANK,      linked: [33, 35],   food: 0 },
        { id: 35, type: CELL_TYPES.SHOP,       linked: [34, 36],   food: 3 },
        { id: 36, type: CELL_TYPES.CARD_DRAW,  linked: [35, 37],   food: 0 },
        { id: 37, type: CELL_TYPES.SHOP,       linked: [36, 38],   food: 2 },
        { id: 38, type: CELL_TYPES.BLANK,      linked: [37, 39],   food: 0 },
        { id: 39, type: CELL_TYPES.MONSTER_EVENT, linked: [38, 40], food: 0 },
        { id: 40, type: CELL_TYPES.SHOP,       linked: [39, 41],   food: 3 },
        { id: 41, type: CELL_TYPES.BLANK,      linked: [40, 42],   food: 0 },
        { id: 42, type: CELL_TYPES.SHOP,       linked: [41, 43],   food: 2 },
        { id: 43, type: CELL_TYPES.BLANK,      linked: [42, 44],   food: 0 },
        { id: 44, type: CELL_TYPES.STATION,    linked: [43, 45, 20], food: 0 },
        { id: 45, type: CELL_TYPES.SHOP,       linked: [44, 46],   food: 3 },
        { id: 46, type: CELL_TYPES.BLANK,      linked: [45, 47],   food: 0 },
        { id: 47, type: CELL_TYPES.BLANK,      linked: [46, 0],    food: 0 },
    ];

    return layout.map(c => ({
        ...c,
        occupants: [],
        isDestroyed: false
    }));
}

export function getTotalFood(cells) {
    return cells.reduce((sum, c) => sum + (c.food || 0), 0);
}

export function getAllShops(cells) {
    return cells.filter(c => c.type === 'shop' && !c.isDestroyed);
}
