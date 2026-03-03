const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 800,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let players = [];
let currentPlayerIndex = 0; 
let isMoving = false;
let isChoosingAction = false; 
let mapGraph = {};
let reachableHighlights = [];

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

const obstacleIds = [10, 12, 14, 15, 17, 19, 21, 23, 31, 33, 35, 36, 38, 41, 45, 47, 49, 51, 53, 57, 61, 67];
const horseStationIds = [0, 2, 4, 7];

const edgeConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [9, 10], [12, 13], [15, 16],
    [18, 19], [19, 20], [21, 22], [23, 24], [25, 26], [26, 27], [27, 28], [28, 29], [30, 31], [31, 32],
    [27, 33], [34, 35], [36, 37], [39, 40], [40, 41], [41, 42], [42, 43], [43, 51], [44, 45], [45, 46],
    [46, 42], [47, 48], [49, 50], [52, 53], [61, 64], [54, 56], [56, 58], [58, 60], [60, 62], [62, 63],
    [63, 65], [65, 66], [0, 9], [9, 18], [18, 25], [25, 30], [1, 10], [2, 11], [11, 20], [20, 26],
    [26, 32], [3, 12], [4, 13], [13, 22], [22, 27], [27, 34], [5, 14], [7, 16], [16, 24], [24, 29],
    [29, 37], [37, 43], [39, 44], [40, 46], [42, 48], [43, 50], [44, 52], [46, 55], [48, 59], [50, 64],
    [53, 54], [55, 56], [57, 58], [64, 65], [66, 67]
];

function preload() {
    this.load.image('map', 'assets/map.jpg');
    this.load.image('p1', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('p2', 'https://labs.phaser.io/assets/sprites/phaser-dude.png'); 
}

function create() {
    if (this.textures.exists('map')) {
        this.add.image(400, 400, 'map');
    }

    // 2. Khởi tạo Graph
    Object.keys(rawNodes).forEach(id => {
        const isObstacle = obstacleIds.includes(parseInt(id));
        const initialFood = isObstacle ? 3 : 0;
        
        mapGraph[id] = {
            ...rawNodes[id],
            isObstacle: isObstacle,
            neighbors: [],
            foodValue: initialFood,
            isHorseStation: horseStationIds.includes(parseInt(id))
        };

        // HIỂN THỊ SỐ FOOD CÒN LẠI TRÊN SHOP
        if (isObstacle) {
            mapGraph[id].foodTextDisplay = this.add.text(rawNodes[id].x, rawNodes[id].y, initialFood, {
                fontSize: '16px',
                fill: '#f1c40f',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(5);
        }
    });

    edgeConnections.forEach(([u, v]) => {
        if (mapGraph[u] && mapGraph[v]) {
            mapGraph[u].neighbors.push(v);
            mapGraph[v].neighbors.push(u);
        }
    });

    // Vẽ đánh dấu Trạm ngựa
    let graphics = this.add.graphics();
    horseStationIds.forEach(id => {
        graphics.lineStyle(3, 0x00aaff, 1);
        graphics.strokeCircle(mapGraph[id].x, mapGraph[id].y, 20);
    });

    players = [
        {
            id: 0, pos: 0, food: 0,
            sprite: this.add.sprite(mapGraph[0].x, mapGraph[0].y, 'p1').setDepth(2),
            ui: this.add.text(20, 20, 'P1 Food: 0', { fontSize: '18px', fill: '#0f0', backgroundColor: '#000' }).setDepth(10)
        },
        {
            id: 1, pos: 8, food: 0,
            sprite: this.add.sprite(mapGraph[8].x, mapGraph[8].y, 'p2').setDepth(2).setTint(0xffaa00),
            ui: this.add.text(20, 50, 'P2 Food: 0', { fontSize: '18px', fill: '#fa0', backgroundColor: '#000' }).setDepth(10)
        }
    ];

    this.turnText = this.add.text(400, 30, "Lượt: P1", { fontSize: '26px', fill: '#000' }).setOrigin(0.5).setDepth(10);
    this.diceText = this.add.text(700, 110, 'Dice: -', { fontSize: '20px', fill: '#000'}).setDepth(10);

    const rollBtn = this.add.text(680, 50, '🎲 ROLL', { fontSize: '24px', backgroundColor: '#e74c3c', padding: 10 }).setInteractive({ useHandCursor: true }).setDepth(10);
    
    rollBtn.on('pointerdown', () => {
        if (!isMoving && !isChoosingAction) {
            let dice = Phaser.Math.Between(1, 6);
            this.diceText.setText('Dice: ' + dice);
            showValidMoves(this, dice);
        }
    });
}

function showValidMoves(scene, steps) {
    clearHighlights();
    let p = players[currentPlayerIndex];
    let queue = [{ id: p.pos, dist: 0 }];
    let visited = new Map();
    visited.set(p.pos, { dist: 0, parent: null });
    let validTargets = [];

    while (queue.length > 0) {
        let { id, dist } = queue.shift();
        if (dist === steps) {
            if (!mapGraph[id].isObstacle) validTargets.push(id);
            continue;
        }
        mapGraph[id].neighbors.forEach(nId => {
            if (!visited.has(nId) && !mapGraph[nId].isObstacle) {
                visited.set(nId, { dist: dist + 1, parent: id });
                queue.push({ id: nId, dist: dist + 1 });
            }
        });
    }

    validTargets.forEach(targetId => {
        let node = mapGraph[targetId];
        let h = scene.add.circle(node.x, node.y, 25, 0xffff00, 0.6).setInteractive().setDepth(1);
        scene.tweens.add({ targets: h, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
        h.on('pointerdown', () => movePlayerPath(scene, targetId, visited));
        reachableHighlights.push(h);
    });
}

function movePlayerPath(scene, targetId, visitedMap) {
    isMoving = true;
    clearHighlights();
    let p = players[currentPlayerIndex];

    let path = [];
    let curr = targetId;
    while (curr !== null) {
        path.push(curr);
        let data = visitedMap.get(curr);
        curr = data ? data.parent : null;
    }
    path.reverse();

    let tweens = path.map(nodeId => ({ targets: p.sprite, x: mapGraph[nodeId].x, y: mapGraph[nodeId].y, duration: 250 }));

    scene.tweens.chain({
        tweens: tweens,
        onComplete: () => {
            p.pos = targetId;
            checkNearbyShops(scene, p.pos, p);
            
            checkAndHandleCollision(scene, p, () => {
                if (mapGraph[p.pos].isHorseStation) {
                    startTeleportChoice(scene, p);
                } else {
                    endTurn(scene);
                }
            });
        }
    });
}

function checkAndHandleCollision(scene, attacker, nextStepFunction) {
    let victim = players.find(v => v.id !== attacker.id && v.pos === attacker.pos);
    if (victim) {
        startKnockbackChoice(scene, attacker, victim, nextStepFunction);
    } else {
        nextStepFunction();
    }
}

function startTeleportChoice(scene, player) {
    isChoosingAction = true;
    scene.turnText.setText("DỊCH CHUYỂN?");

    horseStationIds.forEach(id => {
        if (id === player.pos) return;
        let node = mapGraph[id];
        let h = scene.add.circle(node.x, node.y, 30, 0x00aaff, 0.7).setInteractive().setDepth(5);
        h.on('pointerdown', () => executeTeleport(scene, player, id));
        reachableHighlights.push(h);
    });

    let skipBtn = scene.add.text(400, 100, "BỎ QUA", { backgroundColor: '#333', padding: 10 }).setOrigin(0.5).setInteractive().setDepth(10);
    skipBtn.on('pointerdown', () => {
        skipBtn.destroy();
        clearHighlights();
        isChoosingAction = false;
        endTurn(scene);
    });
    reachableHighlights.push(skipBtn);
}

function executeTeleport(scene, player, targetId) {
    clearHighlights();
    player.pos = targetId; 

    scene.tweens.add({
        targets: player.sprite,
        x: mapGraph[targetId].x,
        y: mapGraph[targetId].y,
        duration: 400,
        onComplete: () => {
            checkNearbyShops(scene, player.pos, player);
            checkAndHandleCollision(scene, player, () => {
                isChoosingAction = false;
                endTurn(scene);
            });
        }
    });
}

function startKnockbackChoice(scene, attacker, victim, onFinish) {
    isChoosingAction = true;
    scene.turnText.setText("HÚC ĐỐI THỦ!");
    let escapeOptions = mapGraph[attacker.pos].neighbors.filter(nId => !mapGraph[nId].isObstacle);
    
    escapeOptions.forEach(nodeId => {
        let node = mapGraph[nodeId];
        let h = scene.add.circle(node.x, node.y, 30, 0xff0000, 0.8).setInteractive().setDepth(5);
        h.on('pointerdown', () => executeKnockback(scene, attacker, victim, nodeId, onFinish));
        reachableHighlights.push(h);
    });
}

function executeKnockback(scene, attacker, victim, targetNodeId, onFinish) {
    clearHighlights();
    if (victim.food >= 1) {
        victim.food--; attacker.food++;
        attacker.ui.setText(`P${attacker.id+1} Food: ${attacker.food}`);
        victim.ui.setText(`P${victim.id+1} Food: ${victim.food}`);
    }
    victim.pos = targetNodeId;
    scene.tweens.add({
        targets: victim.sprite,
        x: mapGraph[targetNodeId].x,
        y: mapGraph[targetNodeId].y,
        duration: 500,
        ease: 'Bounce.easeOut',
        onComplete: () => {
            checkNearbyShops(scene, victim.pos, victim);
            onFinish();
        }
    });
}

function checkNearbyShops(scene, currentIdx, p) {
    mapGraph[currentIdx].neighbors.forEach(nId => {
        let node = mapGraph[nId];
        if (node.isObstacle && node.foodValue > 0) {
            p.food++; 
            node.foodValue--;

            // CẬP NHẬT TEXT HIỂN THỊ TRÊN SHOP
            if (node.foodTextDisplay) {
                node.foodTextDisplay.setText(node.foodValue);
                if (node.foodValue === 0) {
                    node.foodTextDisplay.setFill('#7f8c8d'); // Màu xám khi hết food
                }
            }

            p.ui.setText(`P${p.id + 1} Food: ${p.food}`);
            showPopText(scene, node.x, node.y, "+1 🌾", "#f1c40f");
        }
    });
}

function endTurn(scene) {
    currentPlayerIndex = (currentPlayerIndex === 0) ? 1 : 0;
    scene.turnText.setText("Lượt: P" + (currentPlayerIndex + 1));
    isMoving = false;
    isChoosingAction = false;
}

function showPopText(scene, x, y, msg, color) {
    let t = scene.add.text(x, y - 30, msg, { fontSize: '22px', fill: color }).setDepth(20);
    scene.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
}

function clearHighlights() {
    reachableHighlights.forEach(h => h.destroy());
    reachableHighlights = [];
}
function update() {}