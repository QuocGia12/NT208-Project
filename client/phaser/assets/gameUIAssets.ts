import * as Phaser from 'phaser';
import { CardType, ZodiacName } from '@/types/game';

type AssetDef = {
  key: string;
  path: string;
};

export const GAME_UI_IMAGE_ASSETS: AssetDef[] = [
  { key: 'ui-background-main', path: '/figma-game-ui/background-main.png' },
  { key: 'ui-button-roll', path: '/game-ui/buttons/button-roll.svg' },
  { key: 'ui-button-skip', path: '/game-ui/buttons/button-skip.svg' },
  { key: 'ui-board-frame', path: '/figma-game-ui/board-main-table.png' },
  { key: 'ui-card-panel-frame', path: '/figma-game-ui/card-panel.png' },
  { key: 'ui-movement-pad', path: '/figma-game-ui/movement-pad.png' },
  { key: 'ui-dice-panel', path: '/figma-game-ui/dice-display.png' },
  { key: 'ui-dice-bg', path: '/game-ui/dice/dice-bg.svg' },
  { key: 'ui-dice-face-6', path: '/game-ui/dice/dice-face-6.svg' },
  { key: 'ui-player-bg-normal', path: '/game-ui/player-panels/panel-normal-background.svg' },
  { key: 'ui-player-wood-normal', path: '/game-ui/player-panels/panel-normal-wood.svg' },
  { key: 'ui-player-frame-normal', path: '/game-ui/player-panels/panel-normal-frame.svg' },
  { key: 'ui-player-icon-normal', path: '/game-ui/player-panels/panel-normal-icon-frame.svg' },
  { key: 'ui-player-bg-selected', path: '/game-ui/player-panels/panel-selected-background.svg' },
  { key: 'ui-player-wood-selected', path: '/game-ui/player-panels/panel-selected-wood.svg' },
  { key: 'ui-player-frame-selected', path: '/game-ui/player-panels/panel-selected-frame.svg' },
  { key: 'ui-player-icon-selected', path: '/game-ui/player-panels/panel-selected-icon-frame.svg' },
  { key: 'ui-player-line-split-team', path: '/game-ui/player-panels/line-split-team.svg' },
  { key: 'ui-card-symmetric-h', path: '/game-ui/cards/card-symmetric-h.svg' },
  { key: 'ui-card-symmetric-v', path: '/game-ui/cards/card-symmetric-v.svg' },
  { key: 'ui-card-corner', path: '/game-ui/cards/card-corner.svg' },
  { key: 'ui-card-extra-turn', path: '/game-ui/cards/card-extra-turn.svg' },
  { key: 'ui-card-swap', path: '/game-ui/cards/card-swap.svg' },
  { key: 'ui-card-change-teammate', path: '/game-ui/cards/card-change-teammate.svg' },
  { key: 'ui-card-zodiac-tys', path: '/game-ui/cards/card-zodiac-tys.svg' },
  { key: 'ui-card-zodiac-suu', path: '/game-ui/cards/card-zodiac-suu.svg' },
  { key: 'ui-card-zodiac-dan', path: '/game-ui/cards/card-zodiac-dan.svg' },
  { key: 'ui-card-zodiac-mao', path: '/game-ui/cards/card-zodiac-mao.svg' },
  { key: 'ui-card-zodiac-thin', path: '/game-ui/cards/card-zodiac-thin.svg' },
  { key: 'ui-card-zodiac-tyj', path: '/game-ui/cards/card-zodiac-tyj.svg' },
  { key: 'ui-card-zodiac-ngo', path: '/game-ui/cards/card-zodiac-ngo.svg' },
  { key: 'ui-card-zodiac-mui', path: '/game-ui/cards/card-zodiac-mui.svg' },
  { key: 'ui-card-zodiac-than', path: '/game-ui/cards/card-zodiac-than.svg' },
  { key: 'ui-card-zodiac-dau', path: '/game-ui/cards/card-zodiac-dau.svg' },
  { key: 'ui-card-zodiac-tuat', path: '/game-ui/cards/card-zodiac-tuat.svg' },
  { key: 'ui-card-zodiac-hoi', path: '/game-ui/cards/card-zodiac-hoi.svg' },
  { key: 'ui-box-add-card', path: '/game-ui/boxes/box-add-card.svg' },
  { key: 'ui-box-thin', path: '/game-ui/boxes/box-thin.svg' },
  { key: 'ui-box-tyj', path: '/game-ui/boxes/box-tyj.svg' },
  { key: 'ui-box-ngo', path: '/game-ui/boxes/box-ngo.svg' },
  { key: 'ui-box-tys', path: '/game-ui/boxes/box-tys.svg' },
  { key: 'ui-box-tuat', path: '/game-ui/boxes/box-tuat.svg' },
  { key: 'ui-box-mui', path: '/game-ui/boxes/box-mui.svg' },
  { key: 'ui-box-dan', path: '/game-ui/boxes/box-dan.svg' },
  { key: 'ui-box-suu', path: '/game-ui/boxes/box-suu.svg' },
  { key: 'ui-box-hoi', path: '/game-ui/boxes/box-hoi.svg' },
  { key: 'ui-box-than', path: '/game-ui/boxes/box-than.svg' },
  { key: 'ui-box-dau', path: '/game-ui/boxes/box-dau.svg' },
  { key: 'ui-box-mao', path: '/game-ui/boxes/box-mao.svg' },
  { key: 'ui-box-blank', path: '/game-ui/boxes/box-blank.svg' },
  { key: 'ui-box-none', path: '/game-ui/boxes/box-none.svg' },
  { key: 'ui-icon-than', path: '/game-ui/zodiac-icons/icon-than.svg' },
  { key: 'ui-icon-tyj', path: '/game-ui/zodiac-icons/icon-tyj.svg' },
  { key: 'ui-icon-tuat', path: '/game-ui/zodiac-icons/icon-tuat.svg' },
  { key: 'ui-icon-hoi', path: '/game-ui/zodiac-icons/icon-hoi.svg' },
  { key: 'ui-icon-thin', path: '/game-ui/zodiac-icons/icon-thin.svg' },
  { key: 'ui-icon-ngo', path: '/game-ui/zodiac-icons/icon-ngo.svg' },
  { key: 'ui-icon-tys', path: '/game-ui/zodiac-icons/icon-tys.svg' },
  { key: 'ui-icon-mui', path: '/game-ui/zodiac-icons/icon-mui.svg' },
  { key: 'ui-icon-dan', path: '/game-ui/zodiac-icons/icon-dan.svg' },
  { key: 'ui-icon-suu', path: '/game-ui/zodiac-icons/icon-suu.svg' },
  { key: 'ui-icon-dau', path: '/game-ui/zodiac-icons/icon-dau.svg' },
  { key: 'ui-icon-mao', path: '/game-ui/zodiac-icons/icon-mao.svg' },
  { key: 'ui-piece-tys', path: '/game-ui/pieces/Piece_Tys.svg' },
  { key: 'ui-piece-suu', path: '/game-ui/pieces/Piece_Suu.svg' },
  { key: 'ui-piece-dan', path: '/game-ui/pieces/Piece_Dan.svg' },
  { key: 'ui-piece-mao', path: '/game-ui/pieces/Piece_Mao.svg' },
  { key: 'ui-piece-thin', path: '/game-ui/pieces/Piece_Thin.svg' },
  { key: 'ui-piece-tyj', path: '/game-ui/pieces/Piece_Tyj.svg' },
  { key: 'ui-piece-ngo', path: '/game-ui/pieces/Piece_Ngo.svg' },
  { key: 'ui-piece-mui', path: '/game-ui/pieces/Piece_Mui.svg' },
  { key: 'ui-piece-than', path: '/game-ui/pieces/Piece_Than.svg' },
  { key: 'ui-piece-dau', path: '/game-ui/pieces/Piece_Dau.svg' },
  { key: 'ui-piece-tuat', path: '/game-ui/pieces/Piece_Tuat.svg' },
  { key: 'ui-piece-hoi', path: '/game-ui/pieces/Piece_Hoi.svg' },
];

export const preloadGameUIAssets = (scene: Phaser.Scene): void => {
  GAME_UI_IMAGE_ASSETS.forEach((asset) => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.path);
    }
  });
};

const normalizeZodiacName = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const trimmedValue = value.trim();
  const explicitSlugMap: Record<string, string> = {
    'Tý': 'ty',
    'Tỵ': 'ti',
    'Sửu': 'suu',
    'Dần': 'dan',
    'Mão': 'mao',
    'Thìn': 'thin',
    'Ngọ': 'ngo',
    'Mùi': 'mui',
    'Thân': 'than',
    'Dậu': 'dau',
    'Tuất': 'tuat',
    'Hợi': 'hoi',
    // Handle existing mojibake variants that may already be flowing through local client types.
    'TÃ½': 'ty',
    'Tá»µ': 'ti',
    'Sá»­u': 'suu',
    'Dáº§n': 'dan',
    'MÃ£o': 'mao',
    'ThÃ¬n': 'thin',
    'Ngá»': 'ngo',
    'MÃ¹i': 'mui',
    'ThÃ¢n': 'than',
    'Dáº­u': 'dau',
    'Tuáº¥t': 'tuat',
    'Há»£i': 'hoi',
  };

  const explicitSlug = explicitSlugMap[trimmedValue];
  if (explicitSlug) {
    return explicitSlug;
  }

  return trimmedValue
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

const ZODIAC_ICON_KEYS_BY_SLUG: Record<string, string> = {
  ty: 'ui-icon-tys',
  suu: 'ui-icon-suu',
  dan: 'ui-icon-dan',
  mao: 'ui-icon-mao',
  thin: 'ui-icon-thin',
  ti: 'ui-icon-tyj',
  ngo: 'ui-icon-ngo',
  mui: 'ui-icon-mui',
  than: 'ui-icon-than',
  dau: 'ui-icon-dau',
  tuat: 'ui-icon-tuat',
  hoi: 'ui-icon-hoi',
};

const ZODIAC_PIECE_KEYS_BY_SLUG: Record<string, string> = {
  ty: 'ui-piece-tys',
  suu: 'ui-piece-suu',
  dan: 'ui-piece-dan',
  mao: 'ui-piece-mao',
  thin: 'ui-piece-thin',
  ti: 'ui-piece-tyj',
  ngo: 'ui-piece-ngo',
  mui: 'ui-piece-mui',
  than: 'ui-piece-than',
  dau: 'ui-piece-dau',
  tuat: 'ui-piece-tuat',
  hoi: 'ui-piece-hoi',
};

export const getZodiacIconKey = (zodiac: ZodiacName | null | undefined): string | null => {
  return ZODIAC_ICON_KEYS_BY_SLUG[normalizeZodiacName(zodiac)] ?? null;
};

export const getZodiacPieceKey = (zodiac: ZodiacName | null | undefined): string => {
  return ZODIAC_PIECE_KEYS_BY_SLUG[normalizeZodiacName(zodiac)] ?? 'ui-piece-tys';
};

export const CARD_TEXTURE_KEYS: Partial<Record<CardType, string>> = {
  [CardType.SYMMETRIC_H]: 'ui-card-symmetric-h',
  [CardType.SYMMETRIC_V]: 'ui-card-symmetric-v',
  [CardType.CORNER]: 'ui-card-corner',
  [CardType.EXTRA_TURN]: 'ui-card-extra-turn',
  [CardType.CHANGE_TEAMMATE]: 'ui-card-change-teammate',
  [CardType.SWAP_TEAMMATE]: 'ui-card-swap',
  [CardType.ZODIAC_TY]: 'ui-card-zodiac-tys',
  [CardType.ZODIAC_SUU]: 'ui-card-zodiac-suu',
  [CardType.ZODIAC_DAN]: 'ui-card-zodiac-dan',
  [CardType.ZODIAC_MAO]: 'ui-card-zodiac-mao',
  [CardType.ZODIAC_THIN]: 'ui-card-zodiac-thin',
  [CardType.ZODIAC_TI]: 'ui-card-zodiac-tyj',
  [CardType.ZODIAC_NGO]: 'ui-card-zodiac-ngo',
  [CardType.ZODIAC_MUI]: 'ui-card-zodiac-mui',
  [CardType.ZODIAC_THAN]: 'ui-card-zodiac-than',
  [CardType.ZODIAC_DAU]: 'ui-card-zodiac-dau',
  [CardType.ZODIAC_TUAT]: 'ui-card-zodiac-tuat',
  [CardType.ZODIAC_HOI]: 'ui-card-zodiac-hoi',
};

export const getCardTextureKey = (type: CardType | null | undefined): string => {
  if (!type) {
    return 'ui-card-zodiac-tys';
  }

  return CARD_TEXTURE_KEYS[type] ?? 'ui-card-zodiac-tys';
};

export const BOARD_BOX_TEXTURE_KEYS = {
  addCard: 'ui-box-add-card',
  blank: 'ui-box-blank',
  none: 'ui-box-none',
  zodiacBySlug: {
    ty: 'ui-box-tys',
    suu: 'ui-box-suu',
    dan: 'ui-box-dan',
    mao: 'ui-box-mao',
    thin: 'ui-box-thin',
    ti: 'ui-box-tyj',
    ngo: 'ui-box-ngo',
    mui: 'ui-box-mui',
    than: 'ui-box-than',
    dau: 'ui-box-dau',
    tuat: 'ui-box-tuat',
    hoi: 'ui-box-hoi',
  } as const,
} as const;

export const getBoardZodiacBoxKey = (zodiac: ZodiacName | null | undefined): string => {
  return BOARD_BOX_TEXTURE_KEYS.zodiacBySlug[normalizeZodiacName(zodiac) as keyof typeof BOARD_BOX_TEXTURE_KEYS.zodiacBySlug]
    ?? BOARD_BOX_TEXTURE_KEYS.blank;
};

