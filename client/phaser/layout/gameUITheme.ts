import * as Phaser from 'phaser';

export const GAME_UI_THEME = {
  ink: 0x201205,
  gold: 0xe8c76a,
  goldSoft: 0xf4de9a,
  goldDark: 0x7a541e,
  wood: 0x6d4220,
  woodDark: 0x40200f,
  woodLight: 0x9f6a35,
  slate: 0x172436,
  slateDark: 0x0d1726,
  slateLight: 0x29435f,
  panelFill: 0x112033,
  panelFillAlt: 0x18293f,
  success: 0x45d483,
  danger: 0xdb5f5f,
} as const;

export const drawOrnatePanel = (
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 16,
): void => {
  graphics.clear();

  graphics.fillStyle(GAME_UI_THEME.woodDark, 0.96);
  graphics.fillRoundedRect(x, y, width, height, radius + 2);

  graphics.fillStyle(GAME_UI_THEME.panelFill, 0.95);
  graphics.fillRoundedRect(x + 7, y + 7, width - 14, height - 14, radius);

  graphics.lineStyle(5, GAME_UI_THEME.goldDark, 0.95);
  graphics.strokeRoundedRect(x + 1.5, y + 1.5, width - 3, height - 3, radius + 1);

  graphics.lineStyle(2.2, GAME_UI_THEME.gold, 0.96);
  graphics.strokeRoundedRect(x + 8, y + 8, width - 16, height - 16, radius - 2);

  graphics.lineStyle(1.2, GAME_UI_THEME.goldSoft, 0.95);
  graphics.strokeRoundedRect(x + 13, y + 13, width - 26, height - 26, Math.max(6, radius - 6));
};

export const drawActionButtonFace = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  active: boolean = false,
): void => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const fillTop = active ? 0xa9681f : GAME_UI_THEME.woodLight;
  const fillBottom = active ? 0x6e3e14 : GAME_UI_THEME.wood;

  graphics.clear();
  graphics.fillStyle(GAME_UI_THEME.goldDark, 0.98);
  graphics.fillRoundedRect(-halfWidth, -halfHeight, width, height, 14);

  graphics.fillStyle(fillTop, 1);
  graphics.fillRoundedRect(-halfWidth + 4, -halfHeight + 4, width - 8, height / 2, 11);

  graphics.fillStyle(fillBottom, 1);
  graphics.fillRoundedRect(-halfWidth + 4, -2, width - 8, halfHeight - 2, 11);

  graphics.lineStyle(2.5, GAME_UI_THEME.goldSoft, 0.95);
  graphics.strokeRoundedRect(-halfWidth + 4, -halfHeight + 4, width - 8, height - 8, 11);

  graphics.lineStyle(1.2, 0xfff4cf, 0.6);
  graphics.strokeRoundedRect(-halfWidth + 10, -halfHeight + 10, width - 20, height - 20, 8);
};
