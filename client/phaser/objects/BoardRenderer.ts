import * as Phaser from 'phaser';
import {
  BoardState,
  CellState,
  CellType,
  MAP,
  Position,
  PublicPlayerState,
} from '../../types/game';
import { BOARD_BOX_TEXTURE_KEYS, getBoardZodiacBoxKey } from '../assets/gameUIAssets';
import { GAME_UI_LAYOUT } from '../layout/gameUILayout';

type CellVisual = {
  sprite: Phaser.GameObjects.Image;
  claimMarker: Phaser.GameObjects.Graphics;
  signature: string;
};

export class BoardRenderer {
  public static readonly PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];

  public scene: Phaser.Scene;
  public cellSize = 54;
  public offsetX: number;
  public offsetY: number;
  public cellGraphics: Map<string, CellVisual>;

  private highlightGraphics: Phaser.GameObjects.Graphics[];
  private highlightTween: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cellGraphics = new Map<string, CellVisual>();
    this.highlightGraphics = [];
    this.highlightTween = null;

    const boardWidth = MAP.COLS * this.cellSize;
    const boardHeight = MAP.ROWS * this.cellSize;
    this.offsetX = Math.floor(GAME_UI_LAYOUT.board.centerX - boardWidth / 2);
    this.offsetY = Math.floor(GAME_UI_LAYOUT.board.centerY - boardHeight / 2);
  }

  init(boardState: BoardState, players: PublicPlayerState[]): void {
    this.destroyBoard();
    const playerColorMap = this.getPlayerColorMap(players);

    for (const cell of boardState.cells) {
      const key = this.cellKey(cell.x, cell.y);
      const { worldX, worldY } = this.getCellWorldPos(cell.x, cell.y);
      const sprite = this.scene.add.image(worldX, worldY, this.getCellTextureKey(cell));
      sprite.setDisplaySize(this.cellSize - 2, this.cellSize - 2);
      sprite.setDepth(1);

      const claimMarker = this.scene.add.graphics();
      claimMarker.setDepth(2);

      const visual: CellVisual = {
        sprite,
        claimMarker,
        signature: '',
      };
      this.cellGraphics.set(key, visual);

      const signature = this.buildCellSignature(cell, boardState, playerColorMap);
      this.drawCell(cell, playerColorMap, visual);
      visual.signature = signature;
    }
  }

  update(boardState: BoardState, players: PublicPlayerState[]): void {
    const playerColorMap = this.getPlayerColorMap(players);

    for (const cell of boardState.cells) {
      const key = this.cellKey(cell.x, cell.y);
      const visual = this.cellGraphics.get(key);
      if (!visual) continue;

      const nextSignature = this.buildCellSignature(cell, boardState, playerColorMap);
      if (visual.signature === nextSignature) continue;

      this.drawCell(cell, playerColorMap, visual);
      visual.signature = nextSignature;
    }
  }

  highlightCells(positions: Position[], color: number = 0x00ff00): void {
    this.clearHighlights();
    if (positions.length === 0) return;

    for (const pos of positions) {
      const { worldX, worldY } = this.getCellWorldPos(pos.x, pos.y);
      const half = this.cellSize / 2;
      const highlight = this.scene.add.graphics();
      highlight.setDepth(30);
      highlight.lineStyle(4, color, 0.95);
      highlight.strokeRoundedRect(worldX - half + 4, worldY - half + 4, this.cellSize - 8, this.cellSize - 8, 10);
      highlight.alpha = 0.95;
      this.highlightGraphics.push(highlight);
    }

    this.highlightTween = this.scene.tweens.add({
      targets: this.highlightGraphics,
      alpha: { from: 0.95, to: 0.35 },
      duration: 430,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  clearHighlights(): void {
    if (this.highlightTween) {
      this.highlightTween.stop();
      this.highlightTween = null;
    }

    this.highlightGraphics.forEach((graphics) => graphics.destroy());
    this.highlightGraphics = [];
  }

  getCellWorldPos(x: number, y: number): { worldX: number; worldY: number } {
    return {
      worldX: this.offsetX + x * this.cellSize + this.cellSize / 2,
      worldY: this.offsetY + y * this.cellSize + this.cellSize / 2,
    };
  }

  getCellAtWorldPos(worldX: number, worldY: number): Position | null {
    const gridX = Math.floor((worldX - this.offsetX) / this.cellSize);
    const gridY = Math.floor((worldY - this.offsetY) / this.cellSize);

    if (gridX < 0 || gridX >= MAP.COLS || gridY < 0 || gridY >= MAP.ROWS) {
      return null;
    }

    return { x: gridX, y: gridY };
  }

  private drawCell(
    cell: CellState,
    playerColorMap: Map<string, number>,
    visual: CellVisual,
  ): void {
    visual.sprite.setTexture(this.getCellTextureKey(cell));
    visual.sprite.clearTint();
    visual.sprite.setAlpha(1);
    visual.claimMarker.clear();

    if (!cell.claimedBy) return;

    const { worldX, worldY } = this.getCellWorldPos(cell.x, cell.y);
    const color = playerColorMap.get(cell.claimedBy) ?? 0xffffff;
    visual.claimMarker.lineStyle(4, 0x1b0f08, 0.5);
    visual.claimMarker.strokeCircle(worldX, worldY, 15);
    visual.claimMarker.fillStyle(color, 0.9);
    visual.claimMarker.fillCircle(worldX, worldY, 12);
    visual.claimMarker.lineStyle(2, 0xfff4d5, 0.8);
    visual.claimMarker.strokeCircle(worldX, worldY, 12);
  }

  private getCellTextureKey(cell: CellState): string {
    if (cell.type === CellType.WALL) {
      return BOARD_BOX_TEXTURE_KEYS.none;
    }
    if (cell.type === CellType.BLANK) {
      return BOARD_BOX_TEXTURE_KEYS.blank;
    }
    if (cell.type === CellType.DRAW) {
      return BOARD_BOX_TEXTURE_KEYS.addCard;
    }
    return getBoardZodiacBoxKey(cell.zodiac);
  }

  private buildCellSignature(
    cell: CellState,
    boardState: BoardState,
    playerColorMap: Map<string, number>,
  ): string {
    const claimedColor = cell.claimedBy ? playerColorMap.get(cell.claimedBy) ?? -1 : -1;
    const active = cell.zodiac ? boardState.activeZodiacs.includes(cell.zodiac) : true;
    return [cell.type, cell.zodiac ?? '', cell.claimedBy ?? '', claimedColor.toString(), active ? '1' : '0'].join('|');
  }

  private getPlayerColorMap(players: PublicPlayerState[]): Map<string, number> {
    const sortedPlayers = [...players].sort((a, b) => a.turnIndex - b.turnIndex);
    const colorMap = new Map<string, number>();
    sortedPlayers.forEach((player, index) => {
      colorMap.set(player.id, BoardRenderer.PLAYER_COLORS[index % BoardRenderer.PLAYER_COLORS.length]);
    });
    return colorMap;
  }

  private destroyBoard(): void {
    this.clearHighlights();
    this.cellGraphics.forEach((visual) => {
      visual.sprite.destroy();
      visual.claimMarker.destroy();
    });
    this.cellGraphics.clear();
  }

  private cellKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
