import Phaser from 'phaser';
import {
  ALL_ZODIACS,
  BoardState,
  CellState,
  CellType,
  MAP,
  Position,
  PublicPlayerState,
  ZodiacName,
} from '../../types/game';

type CellVisual = {
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  signature: string;
};

export class BoardRenderer {
  public static readonly PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];

  public scene: Phaser.Scene;
  public cellSize = 52;
  public offsetX: number;
  public offsetY: number;
  public cellGraphics: Map<string, CellVisual>;

  private zodiacColorMap: Map<ZodiacName, number>;
  private highlightGraphics: Phaser.GameObjects.Graphics[];
  private highlightTween: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cellGraphics = new Map<string, CellVisual>();
    this.zodiacColorMap = new Map<ZodiacName, number>();
    this.highlightGraphics = [];
    this.highlightTween = null;

    const boardWidth = MAP.COLS * this.cellSize;
    const boardHeight = MAP.ROWS * this.cellSize;
    this.offsetX = Math.floor((this.scene.scale.width - boardWidth) / 2);
    this.offsetY = Math.floor((this.scene.scale.height - boardHeight) / 2);

    this.buildZodiacPalette();
  }

  init(boardState: BoardState, players: PublicPlayerState[]): void {
    this.destroyBoard();

    const playerColorMap = this.getPlayerColorMap(players);
    for (const cell of boardState.cells) {
      const key = this.cellKey(cell.x, cell.y);
      const { worldX, worldY } = this.getCellWorldPos(cell.x, cell.y);

      const graphics = this.scene.add.graphics();
      graphics.setDepth(1);

      const label = this.scene.add.text(worldX, worldY, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b1020',
        strokeThickness: 2,
      });
      label.setOrigin(0.5);
      label.setDepth(2);

      const signature = this.buildCellSignature(cell, boardState, playerColorMap);
      const visual: CellVisual = { graphics, label, signature: '' };
      this.cellGraphics.set(key, visual);

      this.drawCell(cell, boardState, playerColorMap, visual);
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

      this.drawCell(cell, boardState, playerColorMap, visual);
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
      highlight.strokeRoundedRect(
        worldX - half + 3,
        worldY - half + 3,
        this.cellSize - 6,
        this.cellSize - 6,
        8
      );
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

    for (const graphics of this.highlightGraphics) {
      graphics.destroy();
    }
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
    boardState: BoardState,
    playerColorMap: Map<string, number>,
    visual: CellVisual
  ): void {
    const { graphics, label } = visual;
    graphics.clear();

    const { worldX, worldY } = this.getCellWorldPos(cell.x, cell.y);
    const half = this.cellSize / 2;
    const left = worldX - half + 1;
    const top = worldY - half + 1;
    const size = this.cellSize - 2;

    let fill = 0x3f4b67;
    let labelText = '';
    let labelColor = '#e8efff';

    if (cell.type === CellType.WALL) {
      fill = 0x222633; // Dark wall color
      labelText = '';
      labelColor = '#4a5369';
    } else if (cell.type === CellType.BLANK) {
      // Test 7: Blank cell — pure white for highest visibility
      fill = 0xffffff;
      labelText = '';
      labelColor = '#000000';
    } else if (cell.type === CellType.DRAW) {
      fill = 0xffd700;
      labelText = '';
      labelColor = '#3d2f00';
    } else if (cell.zodiac) {
      labelText = cell.zodiac.charAt(0).toUpperCase();
      const zodiacBaseColor = this.zodiacColorMap.get(cell.zodiac) ?? 0x8f8f8f;
      fill = this.lightenColor(zodiacBaseColor, 0.35);

      if (cell.claimedBy) {
        fill = playerColorMap.get(cell.claimedBy) ?? 0xffffff;
        labelColor = '#111111';
      }
    }

    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(left, top, size, size, 8);
    graphics.lineStyle(1.5, 0x12192b, 0.9);
    graphics.strokeRoundedRect(left, top, size, size, 8);

    if (cell.type === CellType.DRAW) {
      this.drawCardIcon(graphics, worldX, worldY);
    }

    if (cell.claimedBy) {
      this.drawClaimedMarker(graphics, left, top, size);
    }

    // Spawn tile marker is shown as a white dot for orientation.
    if (cell.x === MAP.CENTER.x && cell.y === MAP.CENTER.y) {
      graphics.fillStyle(0xffffff, 0.98);
      graphics.fillCircle(worldX, worldY, 5);
      graphics.lineStyle(1, 0x111111, 0.9);
      graphics.strokeCircle(worldX, worldY, 5);
    }

    label.setText(labelText);
    label.setColor(labelColor);
    label.setVisible(labelText.length > 0);
  }

  private drawCardIcon(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const r = 9;

    graphics.fillStyle(0xfff4bc, 0.95);
    graphics.lineStyle(1.5, 0x8b6900, 1);
    graphics.beginPath();
    graphics.moveTo(x, y - r);
    graphics.lineTo(x + r, y);
    graphics.lineTo(x, y + r);
    graphics.lineTo(x - r, y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    graphics.lineStyle(1, 0x8b6900, 0.9);
    graphics.strokeLineShape(new Phaser.Geom.Line(x - 5, y, x + 5, y));
  }

  private drawClaimedMarker(
    graphics: Phaser.GameObjects.Graphics,
    left: number,
    top: number,
    size: number
  ): void {
    const margin = 10;
    const x1 = left + margin;
    const y1 = top + margin;
    const x2 = left + size - margin;
    const y2 = top + size - margin;

    // Outer dark stroke for contrast on bright colors.
    graphics.lineStyle(6, 0x121212, 0.45);
    graphics.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
    graphics.strokeLineShape(new Phaser.Geom.Line(x1, y2, x2, y1));

    // Inner light stroke to make the X clearly visible.
    graphics.lineStyle(3, 0xffffff, 0.92);
    graphics.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
    graphics.strokeLineShape(new Phaser.Geom.Line(x1, y2, x2, y1));
  }

  private buildCellSignature(
    cell: CellState,
    boardState: BoardState,
    playerColorMap: Map<string, number>
  ): string {
    const isActive = cell.zodiac ? boardState.activeZodiacs.includes(cell.zodiac) : true;
    const claimedColor = cell.claimedBy ? playerColorMap.get(cell.claimedBy) ?? -1 : -1;
    return [
      cell.type,
      cell.zodiac ?? '',
      cell.claimedBy ?? '',
      isActive ? '1' : '0',
      claimedColor.toString(),
    ].join('|');
  }

  private getPlayerColorMap(players: PublicPlayerState[]): Map<string, number> {
    const sortedPlayers = [...players].sort((a, b) => a.turnIndex - b.turnIndex);
    const colorMap = new Map<string, number>();

    sortedPlayers.forEach((player, index) => {
      colorMap.set(player.id, BoardRenderer.PLAYER_COLORS[index % BoardRenderer.PLAYER_COLORS.length]);
    });

    return colorMap;
  }

  private buildZodiacPalette(): void {
    ALL_ZODIACS.forEach((zodiac, index) => {
      const color = Phaser.Display.Color.HSVToRGB(
        index / ALL_ZODIACS.length,
        0.62,
        0.88
      ).color;
      this.zodiacColorMap.set(zodiac, color);
    });
  }

  private lightenColor(color: number, amount: number): number {
    const rgb = Phaser.Display.Color.IntegerToRGB(color);
    const nextR = Math.round(rgb.r + (255 - rgb.r) * amount);
    const nextG = Math.round(rgb.g + (255 - rgb.g) * amount);
    const nextB = Math.round(rgb.b + (255 - rgb.b) * amount);
    return Phaser.Display.Color.GetColor(nextR, nextG, nextB);
  }

  private destroyBoard(): void {
    this.clearHighlights();

    for (const visual of this.cellGraphics.values()) {
      visual.graphics.destroy();
      visual.label.destroy();
    }
    this.cellGraphics.clear();
  }

  private cellKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
