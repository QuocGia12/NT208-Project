// ============================================================
// Client Types — Logic Game (12 Con Giáp)
// Mirror of server/src/types/index.ts — kept independent.
// Test 7: 2v2 team mode types
// ============================================================

// ─── ENUMS ──────────────────────────────────────────────────

export enum RoomStatus {
  WAITING  = 'waiting',
  PLAYING  = 'playing',
  FINISHED = 'finished',
}

export enum Phase {
  PICK_SPAWN = -1,
  DRAW_CARD  = 0,
  ROLL_DICE  = 1,
  MOVE       = 2,
  PLAY_CARD  = 3,
}

export enum CellType {
  ZODIAC = 'zodiac',
  DRAW   = 'draw',
  WALL   = 'wall',
  BLANK  = 'blank',  // Test 7: ô trắng
}

export enum CardType {
  SYMMETRIC_H = 'symmetric_h',
  SYMMETRIC_V = 'symmetric_v',
  CORNER      = 'corner',
  EXTRA_TURN = 'extra_turn',
  CHANGE_TEAMMATE = 'change_teammate',
  SWAP_TEAMMATE = 'swap_teammate',
  ZODIAC_TY   = 'zodiac_ty',
  ZODIAC_SUU  = 'zodiac_suu',
  ZODIAC_DAN  = 'zodiac_dan',
  ZODIAC_MAO  = 'zodiac_mao',
  ZODIAC_THIN = 'zodiac_thin',
  ZODIAC_TI   = 'zodiac_ti',
  ZODIAC_NGO  = 'zodiac_ngo',
  ZODIAC_MUI  = 'zodiac_mui',
  ZODIAC_THAN = 'zodiac_than',
  ZODIAC_DAU  = 'zodiac_dau',
  ZODIAC_TUAT = 'zodiac_tuat',
  ZODIAC_HOI  = 'zodiac_hoi',
}

export enum Direction {
  UP    = 'up',
  DOWN  = 'down',
  LEFT  = 'left',
  RIGHT = 'right',
}

export enum ErrorCode {
  ROOM_NOT_FOUND      = 'ROOM_NOT_FOUND',
  ROOM_FULL           = 'ROOM_FULL',
  ROOM_GAME_STARTED   = 'ROOM_GAME_STARTED',
  ROOM_NOT_IN_ROOM    = 'ROOM_NOT_IN_ROOM',
  NOT_YOUR_TURN       = 'NOT_YOUR_TURN',
  WRONG_PHASE         = 'WRONG_PHASE',
  GAME_NOT_STARTED    = 'GAME_NOT_STARTED',
  GAME_ALREADY_OVER   = 'GAME_ALREADY_OVER',
  INVALID_DIRECTION   = 'INVALID_DIRECTION',
  MOVE_OUT_OF_BOUNDS  = 'MOVE_OUT_OF_BOUNDS',
  MOVE_BLOCKED        = 'MOVE_BLOCKED',
  TETHER_VIOLATION    = 'TETHER_VIOLATION',
  CARD_NOT_IN_HAND       = 'CARD_NOT_IN_HAND',
  CARD_NOT_PLAYABLE      = 'CARD_NOT_PLAYABLE',
  CARD_INVALID_TARGET    = 'CARD_INVALID_TARGET',
  CARD_TARGET_REQUIRED   = 'CARD_TARGET_REQUIRED',
  CARD_TARGET_NOT_NEEDED = 'CARD_TARGET_NOT_NEEDED',
  CARD_LINKED_CARD_REQUIRED = 'CARD_LINKED_CARD_REQUIRED',
  CARD_LINKED_CARD_INVALID = 'CARD_LINKED_CARD_INVALID',
  INTERNAL_ERROR  = 'INTERNAL_ERROR',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

// ─── TYPES ──────────────────────────────────────────────────

export type ZodiacName =
  | 'Tý' | 'Sửu' | 'Dần' | 'Mão' | 'Thìn' | 'Tỵ'
  | 'Ngọ' | 'Mùi' | 'Thân' | 'Dậu' | 'Tuất' | 'Hợi';

export const ALL_ZODIACS: ZodiacName[] = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
];

// ─── CONSTANTS ──────────────────────────────────────────────

export const TIMINGS = {
  PUBLIC_REVEAL_MS: 3000,
  DICE_ROLL_MS:    3000,
  CARD_PHASE_BASE_MS:  60000,
  CARD_PHASE_BONUS_MS: 10000,
  DISCARD_DECISION_MS: 10000,
} as const;

export const MAP = {
  COLS:        7,
  ROWS:        9,
  TOTAL_CELLS: 63,
  DRAW_CELLS:  13,
  WALL_CELLS:  0,   // Test 11: all previous walls converted to blank
  BLANK_CELLS: 30,  // Test 11: 20 + 10 converted walls
  ACTIVE_CELLS_PER_ZODIAC: 5,
  CENTER:      { x: 3, y: 4 } as Position,
  CORNERS:     [
    { x: 0,  y: 0 },
    { x: 6, y: 0 },
    { x: 0,  y: 8 },
    { x: 6, y: 8 },
  ] as Position[],
} as const;

export const TETHER_INITIAL_LENGTH = 7;
export const TEAM_WIN_CELL_COUNT = 10;

export const CARD_TYPE_TO_DISPLAY_NAME: Record<CardType, string> = {
  [CardType.SYMMETRIC_H]: 'Đối xứng ngang',
  [CardType.SYMMETRIC_V]: 'Đối xứng dọc',
  [CardType.CORNER]:      'Góc',
  [CardType.EXTRA_TURN]:  'Thêm lượt',
  [CardType.CHANGE_TEAMMATE]: 'Đổi vị trí đồng đội',
  [CardType.SWAP_TEAMMATE]: 'Swap',
  [CardType.ZODIAC_TY]:   'Tý',
  [CardType.ZODIAC_SUU]:  'Sửu',
  [CardType.ZODIAC_DAN]:  'Dần',
  [CardType.ZODIAC_MAO]:  'Mão',
  [CardType.ZODIAC_THIN]: 'Thìn',
  [CardType.ZODIAC_TI]:   'Tỵ',
  [CardType.ZODIAC_NGO]:  'Ngọ',
  [CardType.ZODIAC_MUI]:  'Mùi',
  [CardType.ZODIAC_THAN]: 'Thân',
  [CardType.ZODIAC_DAU]:  'Dậu',
  [CardType.ZODIAC_TUAT]: 'Tuất',
  [CardType.ZODIAC_HOI]:  'Hợi',
};

export const CARD_TYPE_TO_ZODIAC: Partial<Record<CardType, ZodiacName>> = {
  [CardType.ZODIAC_TY]:   'Tý',
  [CardType.ZODIAC_SUU]:  'Sửu',
  [CardType.ZODIAC_DAN]:  'Dần',
  [CardType.ZODIAC_MAO]:  'Mão',
  [CardType.ZODIAC_THIN]: 'Thìn',
  [CardType.ZODIAC_TI]:   'Tỵ',
  [CardType.ZODIAC_NGO]:  'Ngọ',
  [CardType.ZODIAC_MUI]:  'Mùi',
  [CardType.ZODIAC_THAN]: 'Thân',
  [CardType.ZODIAC_DAU]:  'Dậu',
  [CardType.ZODIAC_TUAT]: 'Tuất',
  [CardType.ZODIAC_HOI]:  'Hợi',
};

export const ZODIAC_TO_CARD_TYPE: Record<ZodiacName, CardType> = {
  'Tý':   CardType.ZODIAC_TY,
  'Sửu':  CardType.ZODIAC_SUU,
  'Dần':  CardType.ZODIAC_DAN,
  'Mão':  CardType.ZODIAC_MAO,
  'Thìn': CardType.ZODIAC_THIN,
  'Tỵ':   CardType.ZODIAC_TI,
  'Ngọ':  CardType.ZODIAC_NGO,
  'Mùi':  CardType.ZODIAC_MUI,
  'Thân': CardType.ZODIAC_THAN,
  'Dậu':  CardType.ZODIAC_DAU,
  'Tuất': CardType.ZODIAC_TUAT,
  'Hợi':  CardType.ZODIAC_HOI,
};

// ─── CORE INTERFACES ────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

export interface CellState {
  x:         number;
  y:         number;
  type:      CellType;
  zodiac:    ZodiacName | null;
  claimedBy: string | null;
}

export interface BoardState {
  cells:         CellState[];
  activeZodiacs: ZodiacName[];
}

export interface CardState {
  id:          string;
  type:        CardType;
  displayName: string;
}

export interface TeamInfo {
  teamId:       string;
  playerIds:    string[];
  zodiacs:      ZodiacName[];
  tetherLength: number;
  totalClaimed: number;
}

export interface PlayerState {
  id:           string;
  socketId:     string;
  name:         string;
  zodiac:       ZodiacName;
  position:     Position;
  hand:         CardState[];
  handSize:     number;
  claimedCount: number;
  eliminated:   boolean;
  connected:    boolean;
  turnIndex:    number;
  hasSpawned:   boolean;
  teamId:       string;
  isLocked:     boolean;
  skipNextTurn: boolean;
}

export interface PublicPlayerState {
  id:           string;
  name:         string;
  zodiac:       ZodiacName;
  position:     Position;
  handSize:     number;
  claimedCount: number;
  eliminated:   boolean;
  connected:    boolean;
  turnIndex:    number;
  hasSpawned:   boolean;
  teamId:       string;
  isLocked:     boolean;
  skipNextTurn: boolean;
}

export interface DeckState {
  cards:       CardState[];
  remaining:   number;
  discardPile: CardState[];
}

export interface PublicReveal {
  playerId:  string;
  card:      CardState;
  source:    'phase0' | 'phase2c' | 'phase3';
  expiresAt: number;
}

// ─── PHASE CONTEXT ──────────────────────────────────────────

export interface Phase0Context { phase: 0; }
export interface Phase1Context { phase: 1; diceResult: number | null; rollEndAt: number; }
export interface Phase2Context { phase: 3; diceResult: number; stepsRemaining: number; prevPosition: Position | null; validDirections: Direction[]; }
export interface Phase3Context { phase: 2 | 4; timerExpiresAt: number; playableCards: string[]; }
export interface PickSpawnContext { phase: -1; availablePositions: Position[]; }

export type PhaseContext = PickSpawnContext | Phase0Context | Phase1Context | Phase2Context | Phase3Context;

// ─── ROOT GAME STATE ────────────────────────────────────────

export interface GameStateData {
  roomId: string;
  status: RoomStatus;
  board: BoardState;
  players: PlayerState[];
  deck: DeckState;
  teams: TeamInfo[];
  turnOrder: string[];
  currentPlayerIndex: number;
  turnNumber: number;
  currentPhase: Phase;
  phaseContext: PhaseContext;
  publicReveal: PublicReveal | null;
  winner: string | null;
  eliminatedPlayers: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PublicGameState {
  roomId: string;
  status: RoomStatus;
  board: BoardState;
  players: PublicPlayerState[];
  deck: { remaining: number };
  teams: TeamInfo[];
  turnOrder: string[];
  currentPlayerIndex: number;
  turnNumber: number;
  currentPhase: Phase;
  phaseContext: PhaseContext;
  publicReveal: PublicReveal | null;
  winner: string | null;
  eliminatedPlayers: string[];
  updatedAt: number;
}

export interface PrivateGameState extends PublicGameState {
  myHand: CardState[];
  myPlayableCards: string[];
}

export interface ApplyResult {
  newPosition: Position;
  extraTurn: boolean;
}

// ─── SOCKET EVENT PAYLOADS ──────────────────────────────────

export interface RoomCreatePayload { playerName: string; }
export interface RoomJoinPayload { roomId: string; playerName: string; playerId?: string; }
export interface PlayerMovePayload { direction: Direction; roomId?: string; }
export interface PlayerPlayCardPayload { cardId: string; roomId?: string; targetPos?: Position; helperCardId?: string; }
export interface PlayerEndCardPhasePayload { roomId?: string; }
export interface PlayerDiscardCardsPayload { cardIds: string[]; roomId?: string; }
export interface PlayerRequestStatePayload { roomId: string; }

export interface RoomCreatedData { roomId: string; joinCode: string; }
export interface RoomJoinedData { roomId: string; yourPlayerId: string; yourTurnIndex: number; currentPlayers: PublicPlayerState[]; status: RoomStatus; }
export interface RoomPlayerJoinedData { player: PublicPlayerState; totalPlayers: number; }
export interface RoomPlayerLeftData { playerId: string; playerName: string; totalPlayers: number; }
export interface RoomGameStartingData { startsAt: number; players: PublicPlayerState[]; }
export interface GameStateUpdateData { state: PublicGameState; }
export interface GamePrivateUpdateData { playerId: string; myHand: CardState[]; myPlayableCards: string[]; }
export interface GameCardPublicRevealData { playerId: string; playerName: string; card: CardState; source: 'phase0' | 'phase2c' | 'phase3'; expiresAt: number; }
export interface GameCardRevealEndedData { playerId: string; }
export interface GameDiscardRequiredData {
  playerId: string;
  requiredCount: number;
  handLimit: number;
  expiresAt: number;
}
export interface GameDiscardResolvedData {
  playerId: string;
  discardedCardIds: string[];
  auto: boolean;
}

export interface GamePlayerRespawnData {
  playerId: string;
  playerName: string;
  teamId: string;
  reason: 'stuck';
  respawnPosition: Position;
  cellsLost: number;
  newTetherLength: number;
  newTeamClaimed: number;
}

export interface GameOverData {
  winner: {
    teamId: string;
    playerIds: string[];
    playerNames: string[];
    zodiacs: ZodiacName[];
  };
  reason: 'team_claimed_all';
  finalState: PublicGameState;
  stats: {
    totalTurns: number;
    claimedByPlayer: Record<string, number>;
    claimedByTeam: Record<string, number>;
  };
}

export interface GameErrorData { code: ErrorCode; message: string; context?: Record<string, unknown>; }
export interface ServerPlayerDisconnectedData { playerId: string; playerName: string; }
export interface ServerPlayerReconnectedData { playerId: string; playerName: string; }

export interface ServerPayload<T> { ok: true; data: T; }
export interface ServerError { ok: false; code: ErrorCode; message: string; }
export interface ClientPayload<T> { data: T; }
