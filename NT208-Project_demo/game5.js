const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 800,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- BIẾN TOÀN CỤC ---
let player;
let playerPos = 0; // Bắt đầu tại Node 0
let isMoving = false;
let mapGraph = {};
let reachableHighlights = [];

// Danh sách tọa độ Node bạn đã cung cấp
const rawNodes = {
    0: { x: 86, y: 52 }, 1: { x: 175, y: 50 }, 2: { x: 261, y: 52 }, 3: { x: 336, y: 50 },
    4: { x: 406, y: 52 }, 5: { x: 474, y: 52 }, 6: { x: 562, y: 50 }, 7: { x: 631, y: 52 },
    8: { x: 717, y: 52 }, 9: { x: 85, y: 121 }, 10: { x: 173, y: 120 }, 11: { x: 262, y: 121 },
    12: { x: 333, y: 120 }, 13: { x: 413, y: 122 }, 14: { x: 475, y: 120 }, 15: { x: 561, y: 118 },
    16: { x: 627, y: 118 }, 17: { x: 715, y: 205 }, 18: { x: 85, y: 257 }, 19: { x: 175, y: 256 },
    20: { x: 259, y: 255 }, 21: { x: 333, y: 257 }, 22: { x: 426, y: 255 }, 23: { x: 511, y: 257 },
    24: { x: 627, y: 249 }, 25: { x: 85, y: 326 }, 26: { x: 258, y: 325 }, 27: { x: 430, y: 323 },
    28: { x: 512, y: 325 }, 29: { x: 628, y: 326 }, 30: { x: 84, y: 388 }, 31: { x: 173, y: 389 },
    32: { x: 260, y: 387 }, 33: { x: 331, y: 362 }, 34: { x: 394, y: 409 }, 35: { x: 473, y: 386 },
    36: { x: 557, y: 389 }, 37: { x: 630, y: 388 }, 38: { x: 719, y: 389 }, 39: { x: 83, y: 452 },
    40: { x: 258, y: 450 }, 41: { x: 329, y: 456 }, 42: { x: 428, y: 457 }, 43: { x: 626, y: 453 },
    44: { x: 84, y: 523 }, 45: { x: 170, y: 526 }, 46: { x: 260, y: 527 }, 47: { x: 334, y: 551 },
    48: { x: 425, y: 552 }, 49: { x: 517, y: 525 }, 50: { x: 626, y: 525 }, 51: { x: 713, y: 525 },
    52: { x: 85, y: 659 }, 53: { x: 173, y: 661 }, 54: { x: 172, y: 728 }, 55: { x: 260, y: 660 },
    56: { x: 258, y: 728 }, 57: { x: 331, y: 658 }, 58: { x: 330, y: 727 }, 59: { x: 428, y: 657 },
    60: { x: 424, y: 730 }, 61: { x: 511, y: 657 }, 62: { x: 482, y: 728 }, 63: { x: 551, y: 726 },
    64: { x: 626, y: 660 }, 65: { x: 626, y: 725 }, 66: { x: 712, y: 729 }, 67: { x: 710, y: 648 }
};

// Các Node hình chữ nhật (vật cản/shop) không được đi xuyên qua
const obstacleIds = [10, 12, 14, 15, 17, 19, 21, 23, 31, 33, 35, 36, 38, 41, 45, 47, 49, 51, 53, 57, 61, 67];

// Các kết nối (Edges) giữa các Node
const edgeConnections = [
    // [0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,8],
    // [0,9], [1,10], [3,12], [5,14], [6,15], [8,17],
    // [9,10], [10,11], [11,12], [12,13], [13,14], [14,22],
    // [9,18], [11,20], [22,27], [24,16],
    // [18,19], [19,20], [20,21], [21,22], [22,23], [23,24],
    // [18,25], [20,26], [22,27], [23,28], [24,29],
    // [25,30], [26,32], [27,34], [28,35], [29,37],
    // [30,31], [31,32], [32,33], [33,34], [34,35], [35,36], [36,37], [37,38],
    // [30,39], [32,40], [34,42], [37,43],
    // [39,44], [40,46], [42,48], [43,50],
    // [44,45], [45,46], [46,47], [47,48], [48,49], [49,50], [50,51],
    // [44,52], [46,55], [48,59], [50,64],
    // [52,53], [53,54], [55,56], [57,58], [59,60], [61,62], [63,64], [64,65], [66,67]
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], 
    [9, 10], [12, 13], [15, 16],
    [18, 19], [19, 20], [21, 22], [23, 24], 
    [25, 26], [26, 27], [27, 28], [28, 29], 
    [30, 31], [31, 32], [27, 33], [34, 35], [36, 37],
    [39, 40], [40, 41], [41, 42], [42, 43], [43, 51], 
    [44, 45], [45, 46], [46, 42], [47, 48], [49, 50], 
    [52, 53], [61, 64], 
    [54, 56], [56, 58], [58, 60], [60, 62], [62, 63], [63, 65], [65, 66],

    [0, 9], [9, 18], [18, 25], [25, 30], 
    [1, 10], [2, 11], [11, 20], [20, 26], [26, 32],
    [3, 12],
    [4, 13], [13, 22], [22, 27], [27, 34],
    [5, 14],
    [7, 16], [16, 24], [24, 29], [29, 37], [37, 43],
    [39, 44], [40, 46], [42, 48], [43, 50], 
    [44, 52], [46, 55], [48, 59], [50, 64], 
    [53, 54], [55, 56], [57, 58], [64, 65], [66, 67]
];

function preload() {
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('map', 'assets/map.jpg');
}

function create() {
    // 1. Vẽ Map và Khởi tạo Graph
    this.add.image(400, 400, 'map');
    
    Object.keys(rawNodes).forEach(id => {
        mapGraph[id] = {
            ...rawNodes[id],
            isObstacle: obstacleIds.includes(parseInt(id)),
            neighbors: []
        };
    });

    edgeConnections.forEach(([u, v]) => {
        mapGraph[u].neighbors.push(v);
        mapGraph[v].neighbors.push(u);
    });

    // Vẽ Debug (Có thể comment lại khi game hoàn thiện)
    let graphics = this.add.graphics();
    graphics.lineStyle(1, 0x00ff00, 0.2);
    for (let id in mapGraph) {
        let node = mapGraph[id];
        node.neighbors.forEach(nId => graphics.lineBetween(node.x, node.y, mapGraph[nId].x, mapGraph[nId].y));
        let color = node.isObstacle ? 0xff0000 : 0xffffff;
        this.add.circle(node.x, node.y, 5, color, 0.5);
    }

    // 2. Nhân vật
    player = this.add.sprite(mapGraph[playerPos].x, mapGraph[playerPos].y, 'player').setDepth(2);

    // 3. UI Xúc xắc
    const rollBtn = this.add.text(680, 50, '🎲 ROLL', { 
        fontSize: '24px', backgroundColor: '#e74c3c', padding: 10 
    }).setInteractive({ useHandCursor: true });

    this.diceResultText = this.add.text(680, 110, 'Dice: -', { fontSize: '20px' });

    rollBtn.on('pointerdown', () => {
        if (!isMoving) {
            let dice = Phaser.Math.Between(1, 6);
            this.diceResultText.setText('Dice: ' + dice);
            showValidMoves(this, dice);
        }
    });
}

// --- LOGIC BFS: TÌM ĐƯỜNG ĐI TRÁNH VẬT CẢN ---
function showValidMoves(scene, steps) {
    clearHighlights();
    
    let queue = [{ id: playerPos, dist: 0 }];
    let visited = new Map();
    visited.set(playerPos, { dist: 0, parent: null });

    let validTargets = [];

    while (queue.length > 0) {
        let { id, dist } = queue.shift();

        if (dist === steps) {
            if (!mapGraph[id].isObstacle) validTargets.push(id);
            continue;
        }

        mapGraph[id].neighbors.forEach(nId => {
            // Không được đi xuyên qua vật cản (isObstacle)
            if (!visited.has(nId) && !mapGraph[nId].isObstacle) {
                visited.set(nId, { dist: dist + 1, parent: id });
                queue.push({ id: nId, dist: dist + 1 });
            }
        });
    }

    // Vẽ các ô hợp lệ để người chơi click
    validTargets.forEach(targetId => {
        let node = mapGraph[targetId];
        let h = scene.add.circle(node.x, node.y, 25, 0xffff00, 0.6).setInteractive();
        
        scene.tweens.add({ targets: h, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

        h.on('pointerdown', () => movePlayerPath(scene, targetId, visited));
        reachableHighlights.push(h);
    });
}

// --- LOGIC DI CHUYỂN TỪNG BƯỚC THEO ĐƯỜNG DẪN ---
function movePlayerPath(scene, targetId, visitedMap) {
    isMoving = true;
    clearHighlights();

    // Lần ngược đường đi từ Đích về Đầu
    let path = [];
    let curr = targetId;
    while (curr !== null) {
        path.push(curr);
        curr = visitedMap.get(curr).parent;
    }
    path.reverse(); // Đổi lại thứ tự Đầu -> Đích

    // Tạo chuỗi Tweens để nhân vật chạy mượt mà qua từng Node
    let tweensArray = path.map(nodeId => ({
        targets: player,
        x: mapGraph[nodeId].x,
        y: mapGraph[nodeId].y,
        duration: 300,
        ease: 'Linear'
    }));

    scene.tweens.chain({
        tweens: tweensArray,
        onComplete: () => {
            isMoving = false;
            playerPos = targetId;
            console.log("Đã tới ô: " + playerPos);
        }
    });
}

function clearHighlights() {
    reachableHighlights.forEach(h => h.destroy());
    reachableHighlights = [];
}

function update() {}