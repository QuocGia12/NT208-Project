import { MovementValidator } from './src/game/MovementValidator';
import { WinLossChecker } from './src/game/WinLossChecker';
import { Board } from './src/game/Board';
import { Player } from './src/game/Player';
import { Direction, ZodiacName, CellType } from './src/types';

function testMovementAndWinLoss(): void {
  console.log('=== MovementValidator & WinLossChecker Tests ===\n');

  const activeZodiacs: ZodiacName[] = ['Tý', 'Dần', 'Ngọ', 'Tuất'];
  const board = Board.generate(activeZodiacs);

  // Force test cells to be ZODIAC so random WALL placements don't break deterministic tests
  const testPositions = [
    {x:3,y:4}, {x:3,y:3}, {x:3,y:5}, {x:2,y:4}, {x:4,y:4}, // center cross
    {x:0,y:0}, {x:1,y:0}, {x:0,y:1}, // top-left
    {x:6,y:8}, {x:5,y:8}, {x:6,y:7}, // bottom-right
    {x:3,y:0}, {x:2,y:0}, {x:4,y:0}, {x:3,y:1}, // top edge + neighbours
  ];
  for (const p of testPositions) {
    const c = board.getCell(p.x, p.y)!;
    c.type = CellType.ZODIAC;
    c.zodiac = activeZodiacs[0];
    c.claimedBy = null;
  }

  // ── directionToPosition ──
  console.log('--- directionToPosition ---');
  const origin = { x: 3, y: 4 };
  const up = MovementValidator.directionToPosition(origin, Direction.UP);
  const down = MovementValidator.directionToPosition(origin, Direction.DOWN);
  const left = MovementValidator.directionToPosition(origin, Direction.LEFT);
  const right = MovementValidator.directionToPosition(origin, Direction.RIGHT);
  console.log(`[${up.x === 3 && up.y === 3 ? '✅' : '❌'}] UP: (3,4) → (3,3)`);
  console.log(`[${down.x === 3 && down.y === 5 ? '✅' : '❌'}] DOWN: (3,4) → (3,5)`);
  console.log(`[${left.x === 2 && left.y === 4 ? '✅' : '❌'}] LEFT: (3,4) → (2,4)`);
  console.log(`[${right.x === 4 && right.y === 4 ? '✅' : '❌'}] RIGHT: (3,4) → (4,4)`);

  // ── getValidDirections — center (no prevPos) ──
  console.log('\n--- getValidDirections ---');
  const centerDirs = MovementValidator.getValidDirections(board, origin, 'p1', null);
  console.log(`[${centerDirs.length === 4 ? '✅' : '❌'}] Center (3,4), no prev: ${centerDirs.length} dirs (expected 4)`);

  // ── Boundary check — top-left corner ──
  const cornerDirs = MovementValidator.getValidDirections(board, { x: 0, y: 0 }, 'p1', null);
  console.log(`[${cornerDirs.length === 2 ? '✅' : '❌'}] Corner (0,0): ${cornerDirs.length} dirs (expected 2: DOWN, RIGHT)`);
  console.log(`[${cornerDirs.includes(Direction.DOWN) ? '✅' : '❌'}] Corner (0,0) includes DOWN`);
  console.log(`[${cornerDirs.includes(Direction.RIGHT) ? '✅' : '❌'}] Corner (0,0) includes RIGHT`);
  console.log(`[${!cornerDirs.includes(Direction.UP) ? '✅' : '❌'}] Corner (0,0) excludes UP (OOB)`);
  console.log(`[${!cornerDirs.includes(Direction.LEFT) ? '✅' : '❌'}] Corner (0,0) excludes LEFT (OOB)`);

  // ── Edge check — bottom-right corner ──
  const brDirs = MovementValidator.getValidDirections(board, { x: 6, y: 8 }, 'p1', null);
  console.log(`[${brDirs.length === 2 ? '✅' : '❌'}] Corner (6,8): ${brDirs.length} dirs (expected 2: UP, LEFT)`);

  // ── Edge check — top edge ──
  const topEdge = MovementValidator.getValidDirections(board, { x: 3, y: 0 }, 'p1', null);
  console.log(`[${topEdge.length === 3 ? '✅' : '❌'}] Top edge (3,0): ${topEdge.length} dirs (expected 3)`);
  console.log(`[${!topEdge.includes(Direction.UP) ? '✅' : '❌'}] Top edge excludes UP (OOB)`);

  // ── Anti-backtrack ──
  console.log('\n--- Anti-backtrack ---');
  const prevPos = { x: 3, y: 3 }; // came from above
  const withPrev = MovementValidator.getValidDirections(board, origin, 'p1', prevPos);
  console.log(`[${!withPrev.includes(Direction.UP) ? '✅' : '❌'}] From center, prev=(3,3): UP blocked (anti-backtrack)`);
  console.log(`[${withPrev.includes(Direction.DOWN) ? '✅' : '❌'}] DOWN still valid`);
  console.log(`[${withPrev.includes(Direction.LEFT) ? '✅' : '❌'}] LEFT still valid`);
  console.log(`[${withPrev.includes(Direction.RIGHT) ? '✅' : '❌'}] RIGHT still valid`);
  console.log(`[${withPrev.length === 3 ? '✅' : '❌'}] Total: ${withPrev.length} dirs (expected 3)`);

  // ── Blocked cells ──
  console.log('\n--- Blocked cells ---');
  // Block cell to the right of center (4,4)
  const rightCell = board.getCell(4, 4)!;
  rightCell.claimedBy = 'otherPlayer';
  const blockedDirs = MovementValidator.getValidDirections(board, origin, 'p1', null);
  console.log(`[${!blockedDirs.includes(Direction.RIGHT) ? '✅' : '❌'}] RIGHT blocked by other player's cell`);
  console.log(`[${blockedDirs.length === 3 ? '✅' : '❌'}] 3 dirs remaining (expected 3)`);

  // Own claimed cell is NOT blocked
  rightCell.claimedBy = 'p1';
  const ownDirs = MovementValidator.getValidDirections(board, origin, 'p1', null);
  console.log(`[${ownDirs.includes(Direction.RIGHT) ? '✅' : '❌'}] RIGHT OK — own claimed cell is not blocked`);
  console.log(`[${ownDirs.length === 4 ? '✅' : '❌'}] All 4 dirs valid when own cell claimed`);
  rightCell.claimedBy = null; // reset

  // Occupied by another player is also blocked (Test3)
  const occupiedDirs = MovementValidator.getValidDirections(
    board,
    origin,
    'p1',
    null,
    [{ x: 4, y: 4 }]
  );
  console.log(`[${!occupiedDirs.includes(Direction.RIGHT) ? '✅' : '❌'}] RIGHT blocked by other player's standing position`);

  // ── Combined: backtrack + blocked ──
  console.log('\n--- Combined: backtrack + blocked ---');
  const aboveCell = board.getCell(3, 3)!;
  const belowCell = board.getCell(3, 5)!;
  aboveCell.claimedBy = 'otherPlayer';
  belowCell.claimedBy = 'otherPlayer';
  const prevLeft = { x: 2, y: 4 };
  const combinedDirs = MovementValidator.getValidDirections(board, origin, 'p1', prevLeft);
  // UP blocked (other player), DOWN blocked (other player), LEFT blocked (backtrack), RIGHT open
  console.log(`[${combinedDirs.length === 1 ? '✅' : '❌'}] Combined: ${combinedDirs.length} dir (expected 1: RIGHT only)`);
  console.log(`[${combinedDirs[0] === Direction.RIGHT ? '✅' : '❌'}] Only direction = RIGHT`);
  aboveCell.claimedBy = null;
  belowCell.claimedBy = null;

  // ── getHighlightPositions ──
  console.log('\n--- getHighlightPositions ---');
  const highlights = MovementValidator.getHighlightPositions(board, origin, 'p1', null);
  console.log(`[${highlights.length === 4 ? '✅' : '❌'}] Center: ${highlights.length} highlight positions`);
  const hasUp = highlights.some(p => p.x === 3 && p.y === 3);
  const hasDown = highlights.some(p => p.x === 3 && p.y === 5);
  const hasLeft = highlights.some(p => p.x === 2 && p.y === 4);
  const hasRight = highlights.some(p => p.x === 4 && p.y === 4);
  console.log(`[${hasUp && hasDown && hasLeft && hasRight ? '✅' : '❌'}] Correct positions: (3,3), (3,5), (2,4), (4,4)`);

  const occupiedHighlights = MovementValidator.getHighlightPositions(
    board,
    origin,
    'p1',
    null,
    [{ x: 4, y: 4 }]
  );
  const blockedRightHighlight = occupiedHighlights.some(p => p.x === 4 && p.y === 4);
  console.log(`[${!blockedRightHighlight ? '✅' : '❌'}] Highlight excludes occupied destination (4,4)`);

  // ══════════════════════════════════════════════════════════

  console.log('\n--- WinLossChecker ---');

  // ── checkWin — no winner ──
  const players = [
    new Player('p1', 's1', 'Alice', 'Tý', 0),
    new Player('p2', 's2', 'Bob', 'Dần', 1),
    new Player('p3', 's3', 'Charlie', 'Ngọ', 2),
    new Player('p4', 's4', 'Diana', 'Tuất', 3),
  ];

  console.log(`[${WinLossChecker.checkWin(players) === null ? '✅' : '❌'}] No winner initially (all 0 claims)`);

  // ── checkWin — player reaches 9 ──
  players[1].claimedCount = 9;
  console.log(`[${WinLossChecker.checkWin(players) === 'p2' ? '✅' : '❌'}] p2 wins with 9 claims`);

  // ── checkWin — eliminated flag does not override claimedCount === 9 ──
  players[1].eliminated = true;
  console.log(`[${WinLossChecker.checkWin(players) === 'p2' ? '✅' : '❌'}] p2 still wins with claimedCount === 9`);
  players[1].eliminated = false;
  players[1].claimedCount = 6;

  // ── checkWin — first with 9 wins ──
  players[0].claimedCount = 9;
  players[2].claimedCount = 9;
  console.log(`[${WinLossChecker.checkWin(players) === 'p1' ? '✅' : '❌'}] First player (p1) found wins when multiple have 9`);
  players[0].claimedCount = 0;
  players[2].claimedCount = 0;

  // ── checkElimination — no one stuck ──
  console.log('\n--- checkElimination ---');
  // Reset all to center where they have 4 open directions
  for (const p of players) {
    p.position = { x: 3, y: 4 };
    p.eliminated = false;
    p.hasSpawned = true; // Required for Test 6 update
  }
  const noElim = WinLossChecker.checkElimination(players, board, []);
  console.log(`[${noElim.length === 0 ? '✅' : '❌'}] No eliminations at center`);

  // ── checkElimination — player stuck in corner ──
  players[0].position = { x: 0, y: 0 };
  board.getCell(1, 0)!.claimedBy = 'p2';
  board.getCell(0, 1)!.claimedBy = 'p3';
  const stuck = WinLossChecker.checkElimination(players, board, []);
  console.log(`[${stuck.length === 1 ? '✅' : '❌'}] 1 player eliminated`);
  console.log(`[${stuck[0] === 'p1' ? '✅' : '❌'}] p1 stuck at corner (0,0)`);
  board.getCell(1, 0)!.claimedBy = null;
  board.getCell(0, 1)!.claimedBy = null;

  // ── checkElimination — already eliminated players skipped ──
  players[0].position = { x: 0, y: 0 };
  board.getCell(1, 0)!.claimedBy = 'p2';
  board.getCell(0, 1)!.claimedBy = 'p3';
  const skipElim = WinLossChecker.checkElimination(players, board, ['p1']);
  console.log(`[${skipElim.length === 0 ? '✅' : '❌'}] Already eliminated p1 is skipped`);
  board.getCell(1, 0)!.claimedBy = null;
  board.getCell(0, 1)!.claimedBy = null;

  // ── checkElimination — multiple stuck ──
  players[0].position = { x: 0, y: 0 };
  players[3].position = { x: 6, y: 8 };
  board.getCell(1, 0)!.claimedBy = 'p2';
  board.getCell(0, 1)!.claimedBy = 'p2';
  board.getCell(5, 8)!.claimedBy = 'p2';
  board.getCell(6, 7)!.claimedBy = 'p2';
  const multiStuck = WinLossChecker.checkElimination(players, board, []);
  console.log(`[${multiStuck.length === 2 ? '✅' : '❌'}] 2 players eliminated (p1 & p4 stuck in corners)`);
  console.log(`[${multiStuck.includes('p1') && multiStuck.includes('p4') ? '✅' : '❌'}] Both p1 and p4 in result`);
  board.getCell(1, 0)!.claimedBy = null;
  board.getCell(0, 1)!.claimedBy = null;
  board.getCell(5, 8)!.claimedBy = null;
  board.getCell(6, 7)!.claimedBy = null;

  // ── Player marked eliminated + flag ──
  players[0].eliminated = true;
  players[0].position = { x: 0, y: 0 };
  board.getCell(1, 0)!.claimedBy = 'p2';
  board.getCell(0, 1)!.claimedBy = 'p2';
  const flagElim = WinLossChecker.checkElimination(players, board, []);
  console.log(`[${!flagElim.includes('p1') ? '✅' : '❌'}] Player with eliminated=true flag is skipped`);
  board.getCell(1, 0)!.claimedBy = null;
  board.getCell(0, 1)!.claimedBy = null;
  players[0].eliminated = false;

  // ── checkElimination — blocked by adjacent standing players (Test3) ──
  players[0].position = { x: 3, y: 4 };
  players[1].position = { x: 3, y: 3 };
  players[2].position = { x: 3, y: 5 };
  players[3].position = { x: 2, y: 4 };
  board.getCell(4, 4)!.claimedBy = 'p2';
  const occupiedStuck = WinLossChecker.checkElimination(players, board, []);
  console.log(`[${occupiedStuck.includes('p1') ? '✅' : '❌'}] p1 eliminated when all adjacent cells are blocked (including by player positions)`);
  board.getCell(4, 4)!.claimedBy = null;

  console.log('\n=== MovementValidator & WinLossChecker Tests Complete ===');
}

testMovementAndWinLoss();
