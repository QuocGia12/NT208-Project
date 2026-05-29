export const GAME_CANVAS = {
  width: 1280,
  height: 720,
} as const;

const FIGMA_FRAME = {
  width: 1920,
  height: 1080,
  originX: -1434,
  originY: 152,
} as const;

const scaleX = GAME_CANVAS.width / FIGMA_FRAME.width;
const scaleY = GAME_CANVAS.height / FIGMA_FRAME.height;

type FigmaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const toSlot = (rect: FigmaRect) => {
  const localX = rect.x - FIGMA_FRAME.originX;
  const localY = rect.y - FIGMA_FRAME.originY;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;

  return {
    x: localX * scaleX,
    y: localY * scaleY,
    width,
    height,
    centerX: localX * scaleX + width / 2,
    centerY: localY * scaleY + height / 2,
  };
};

export const GAME_UI_LAYOUT = {
  dice: toSlot({ x: 122, y: 239, width: 247, height: 236 }),
  rollButton: toSlot({ x: 116, y: 525, width: 266, height: 72 }),
  waitButton: toSlot({ x: 116, y: 628, width: 266, height: 72 }),
  movementPad: toSlot({ x: 84, y: 817, width: 325, height: 320.9205322265625 }),
  cardPanel: toSlot({ x: -880, y: 1029, width: 849.7188110351562, height: 219.59400939941406 }),
  playerInfo: toSlot({ x: -1349, y: 254, width: 413, height: 901 }),
  boardTable: toSlot({ x: -766, y: 222, width: 622, height: 776 }),
  board: toSlot({ x: -756, y: 235, width: 601, height: 750.9934692382812 }),
} as const;
