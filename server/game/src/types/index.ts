// ============================================================
// Shared Types — Logic Game (12 Con Giáp)
// All enums, interfaces, constants, and event payloads.
// Source of truth: GameStateObject.md + SocketEvents.md
// Test 7: 2v2 team mode
// ============================================================

// ─── ENUMS ──────────────────────────────────────────────────

/** Trạng thái phòng chơi */
export enum RoomStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

/** Phase trong 1 lượt */
export enum Phase {
  PICK_SPAWN = -1,
  DRAW_CARD = 0,
  ROLL_DICE = 1,
  MOVE = 2,
  PLAY_CARD = 3,
}

/** Loại ô trên bản đồ */
export enum CellType {
  ZODIAC = 'zodiac',
  DRAW = 'draw',
  WALL = 'wall',
  BLANK = 'blank',  // Test 7: ô trắng — passable, no effect, cannot be claimed
}

/** Loại thẻ bài (15 loại tổng cộng) */
export enum CardType {
  // Nhóm dịch chuyển đặc biệt
  SYMMETRIC_H = 'symmetric_h',
  SYMMETRIC_V = 'symmetric_v',
  CORNER = 'corner',

  // Nhóm đặc biệt
  EXTRA_TURN = 'extra_turn',
  CHANGE_TEAMMATE = 'change_teammate',
  SWAP_TEAMMATE = 'swap_teammate',

  // Nhóm 12 con giáp
  ZODIAC_TY = 'zodiac_ty',
  ZODIAC_SUU = 'zodiac_suu',
  ZODIAC_DAN = 'zodiac_dan',
  ZODIAC_MAO = 'zodiac_mao',
  ZODIAC_THIN = 'zodiac_thin',
  ZODIAC_TI = 'zodiac_ti',
  ZODIAC_NGO = 'zodiac_ngo',
  ZODIAC_MUI = 'zodiac_mui',
  ZODIAC_THAN = 'zodiac_than',
  ZODIAC_DAU = 'zodiac_dau',
  ZODIAC_TUAT = 'zodiac_tuat',
  ZODIAC_HOI = 'zodiac_hoi',
}

/** Hướng di chuyển */
export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

/** Mã lỗi trả về cho client */
export enum ErrorCode {
  // Room errors
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_GAME_STARTED = 'ROOM_GAME_STARTED',
  ROOM_NOT_IN_ROOM = 'ROOM_NOT_IN_ROOM',

  // Turn errors
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  WRONG_PHASE = 'WRONG_PHASE',
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  GAME_ALREADY_OVER = 'GAME_ALREADY_OVER',

  // Move errors
  INVALID_DIRECTION = 'INVALID_DIRECTION',
  MOVE_OUT_OF_BOUNDS = 'MOVE_OUT_OF_BOUNDS',
  MOVE_BLOCKED = 'MOVE_BLOCKED',
  TETHER_VIOLATION = 'TETHER_VIOLATION',  // Test 7

  // Card errors
  CARD_NOT_IN_HAND = 'CARD_NOT_IN_HAND',
  CARD_NOT_PLAYABLE = 'CARD_NOT_PLAYABLE',
  CARD_INVALID_TARGET = 'CARD_INVALID_TARGET',
  CARD_TARGET_REQUIRED = 'CARD_TARGET_REQUIRED',
  CARD_TARGET_NOT_NEEDED = 'CARD_TARGET_NOT_NEEDED',
  CARD_LINKED_CARD_REQUIRED = 'CARD_LINKED_CARD_REQUIRED',
  CARD_LINKED_CARD_INVALID = 'CARD_LINKED_CARD_INVALID',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

// ─── TYPES ──────────────────────────────────────────────────

/** Tên 12 con giáp */
export type ZodiacName =
  | 'Tý' | 'Sửu' | 'Dần' | 'Mão' | 'Thìn' | 'Tỵ'
  | 'Ngọ' | 'Mùi' | 'Thân' | 'Dậu' | 'Tuất' | 'Hợi';

/** Team and slot helpers for deterministic matchmaking starts. */
export type TeamId = 'team1' | 'team2';
export type TeamSlot = 0 | 1;
export type TeamSlotId =
  | 'team1-slot0'
  | 'team1-slot1'
  | 'team2-slot0'
  | 'team2-slot1';

export interface PlayerWithTeamInput {
  id: string;
  socketId: string;
  name: string;
  avatar?: string | null;
  elo?: number;
  teamId: TeamId;
  teamSlot: TeamSlot;
}

export type MatchmakingPartyMode = 'party2' | 'party4';
export type MatchmakingPartyStatus = 'waiting' | 'queued' | 'matched';

export interface MatchmakingPlayerPayload {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
}

export interface MatchmakingQuickJoinPayload {
  player: MatchmakingPlayerPayload;
  authToken?: string;
}

export interface PartyCreatePayload {
  mode: MatchmakingPartyMode;
  player: MatchmakingPlayerPayload;
  authToken?: string;
}

export interface PartyJoinPayload {
  code: string;
  player: MatchmakingPlayerPayload;
  authToken?: string;
}

export interface PartySwitchSlotPayload {
  slotId: TeamSlotId;
}

export interface PartyReadyPayload {
  ready: boolean;
}

export interface PartyUpdateSlot {
  slotId: TeamSlotId;
  teamId: TeamId;
  teamSlot: TeamSlot;
  player: (MatchmakingPlayerPayload & { ready: boolean }) | null;
}

export interface PartyUpdateData {
  partyId: string;
  code: string;
  mode: MatchmakingPartyMode;
  status: MatchmakingPartyStatus;
  slots: PartyUpdateSlot[];
  hostId: string;
}

export interface MatchFoundPlayerData extends MatchmakingPlayerPayload {
  teamId: TeamId;
  teamSlot: TeamSlot;
  turnSlot: 0 | 1 | 2 | 3;
}

export interface MatchFoundData {
  roomId: string;
  players: MatchFoundPlayerData[];
  yourPlayerId: string;
}

/** Full list of the 12 zodiacs. */
export const ALL_ZODIACS: ZodiacName[] = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
];

// ─── CONSTANTS ──────────────────────────────────────────────

/** Thời gian cố định (ms) */
export const TIMINGS = {
  PUBLIC_REVEAL_MS: 3000,
  DICE_ROLL_MS: 3000,
  CARD_PHASE_BASE_MS: 60000,
  CARD_PHASE_BONUS_MS: 10000,
  DISCARD_DECISION_MS: 10000,
} as const;

/** Hằng số bản đồ */
export const MAP = {
  COLS: 7,
  ROWS: 9,
  TOTAL_CELLS: 63,
  DRAW_CELLS: 13,   // Test 7: 11 + 2 new = 13
  WALL_CELLS: 0,    // Test 11: all previous walls converted to blank
  BLANK_CELLS: 30,  // Test 11: 20 + 10 converted walls
  ACTIVE_CELLS_PER_ZODIAC: 5,  // Test 7: 5 instead of 9
  /* TEST7_DISABLED: SPAWN_POSITIONS removed — spawn is pick-based */
  CENTER: { x: 3, y: 4 } as Position,
  CORNERS: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 0, y: 8 },
    { x: 6, y: 8 },
  ] as Position[],
} as const;

/** Test 7: Initial tether length between teammates */
export const TETHER_INITIAL_LENGTH = 7;

/** Test 7: Number of cells to unclaim on stuck/respawn */
export const RESPAWN_PENALTY_CELLS = 2;

/** Test 7: Win condition — total cells team must claim */
export const TEAM_WIN_CELL_COUNT = 10; // 5 per player × 2 players

/** CardType → Tên hiển thị tiếng Việt */
export const CARD_TYPE_TO_DISPLAY_NAME: Record<CardType, string> = {
  [CardType.SYMMETRIC_H]: 'Đối xứng ngang',
  [CardType.SYMMETRIC_V]: 'Đối xứng dọc',
  [CardType.CORNER]: 'Góc',
  [CardType.EXTRA_TURN]: 'Thêm lượt',
  [CardType.CHANGE_TEAMMATE]: 'Đổi vị trí đồng đội',
  [CardType.SWAP_TEAMMATE]: 'Swap',
  [CardType.ZODIAC_TY]: 'Tý',
  [CardType.ZODIAC_SUU]: 'Sửu',
  [CardType.ZODIAC_DAN]: 'Dần',
  [CardType.ZODIAC_MAO]: 'Mão',
  [CardType.ZODIAC_THIN]: 'Thìn',
  [CardType.ZODIAC_TI]: 'Tỵ',
  [CardType.ZODIAC_NGO]: 'Ngọ',
  [CardType.ZODIAC_MUI]: 'Mùi',
  [CardType.ZODIAC_THAN]: 'Thân',
  [CardType.ZODIAC_DAU]: 'Dậu',
  [CardType.ZODIAC_TUAT]: 'Tuất',
  [CardType.ZODIAC_HOI]: 'Hợi',
};

/** CardType (zodiac only) → ZodiacName */
export const CARD_TYPE_TO_ZODIAC: Partial<Record<CardType, ZodiacName>> = {
  [CardType.ZODIAC_TY]: 'Tý',
  [CardType.ZODIAC_SUU]: 'Sửu',
  [CardType.ZODIAC_DAN]: 'Dần',
  [CardType.ZODIAC_MAO]: 'Mão',
  [CardType.ZODIAC_THIN]: 'Thìn',
  [CardType.ZODIAC_TI]: 'Tỵ',
  [CardType.ZODIAC_NGO]: 'Ngọ',
  [CardType.ZODIAC_MUI]: 'Mùi',
  [CardType.ZODIAC_THAN]: 'Thân',
  [CardType.ZODIAC_DAU]: 'Dậu',
  [CardType.ZODIAC_TUAT]: 'Tuất',
  [CardType.ZODIAC_HOI]: 'Hợi',
};

/** ZodiacName → CardType (reverse lookup) */
export const ZODIAC_TO_CARD_TYPE: Record<ZodiacName, CardType> = {
  'Tý': CardType.ZODIAC_TY,
  'Sửu': CardType.ZODIAC_SUU,
  'Dần': CardType.ZODIAC_DAN,
  'Mão': CardType.ZODIAC_MAO,
  'Thìn': CardType.ZODIAC_THIN,
  'Tỵ': CardType.ZODIAC_TI,
  'Ngọ': CardType.ZODIAC_NGO,
  'Mùi': CardType.ZODIAC_MUI,
  'Thân': CardType.ZODIAC_THAN,
  'Dậu': CardType.ZODIAC_DAU,
  'Tuất': CardType.ZODIAC_TUAT,
  'Hợi': CardType.ZODIAC_HOI,
};

// ─── CORE INTERFACES ────────────────────────────────────────

/** Tọa độ trên bản đồ */
export interface Position {
  x: number; // 0–6
  y: number; // 0–8
}

/** Trạng thái 1 ô trên bản đồ */
export interface CellState {
  x: number;
  y: number;
  type: CellType;
  zodiac: ZodiacName | null;
  claimedBy: string | null; // playerId
}

/** Trạng thái bản đồ */
export interface BoardState {
  cells: CellState[]; // flat array, length = 63, index = y * COLS + x
  activeZodiacs: ZodiacName[];
}

/** Trạng thái 1 thẻ bài */
export interface CardState {
  id: string; // UUID
  type: CardType;
  displayName: string;
}

/** Test 7: Team info */
export interface TeamInfo {
  teamId: string;        // 'team1' | 'team2'
  playerIds: string[];      // 2 player IDs
  zodiacs: ZodiacName[];  // 2 zodiacs belonging to this team
  tetherLength: number;        // starts at TETHER_INITIAL_LENGTH
  totalClaimed: number;        // total cells claimed by both players in team
}

/** Trạng thái người chơi (đầy đủ, server-side) */
export interface PlayerState {
  id: string;
  socketId: string;
  name: string;
  zodiac: ZodiacName;
  position: Position;
  hand: CardState[];  // PRIVATE — không gửi cho client khác
  handSize: number;       // = hand.length (public)
  claimedCount: number;       // 0–5 (Test 7: max 5 per player)
  eliminated: boolean;      // Test 7: temporary flag during respawn processing
  connected: boolean;
  turnIndex: number;       // 0–3, cố định
  hasSpawned: boolean;      // Test 6: false until player picks spawn
  teamId: string;       // Test 7: 'team1' | 'team2'
  isLocked: boolean;    // Skip-next-turn lock marker (visible on UI)
  skipNextTurn: boolean; // Internal skip flag persisted in state
}

/** Trạng thái người chơi công khai (ẩn hand) */
export interface PublicPlayerState {
  id: string;
  name: string;
  zodiac: ZodiacName;
  position: Position;
  handSize: number;
  claimedCount: number;
  eliminated: boolean;
  connected: boolean;
  turnIndex: number;
  hasSpawned: boolean;
  teamId: string;       // Test 7
  isLocked: boolean;    // Visible lock marker for next-turn skip
  skipNextTurn: boolean;
}

/** Trạng thái bộ bài chung */
export interface DeckState {
  cards: CardState[]; // SERVER-ONLY, không gửi client
  remaining: number;
  discardPile: CardState[]; // SERVER-ONLY, bài đã dùng chờ xào lại
}

/** Bài đang được hiển thị công khai (3 giây) */
export interface PublicReveal {
  playerId: string;
  card: CardState;
  source: 'phase0' | 'phase2c' | 'phase3';
  expiresAt: number; // Unix timestamp (ms)
}

// ─── PHASE CONTEXT (union type) ─────────────────────────────

export interface Phase0Context {
  phase: 0;
}

export interface Phase1Context {
  phase: 1;
  diceResult: number | null; // null = đang roll, 1–6 = đã có
  rollEndAt: number;        // Unix timestamp
}

export interface Phase2Context {
  phase: 3;
  diceResult: number;
  stepsRemaining: number;
  prevPosition: Position | null; // null = chưa di chuyển bước nào
  validDirections: Direction[];
}

export interface Phase3Context {
  phase: 2 | 4;
  timerExpiresAt: number;   // Unix timestamp
  playableCards: string[]; // cardId[]
}

export interface PickSpawnContext {
  phase: -1;
  availablePositions: Position[];  // ô "Rút bài" đang trống
}

export type PhaseContext =
  | PickSpawnContext
  | Phase0Context
  | Phase1Context
  | Phase2Context
  | Phase3Context;

// ─── ROOT GAME STATE ────────────────────────────────────────

/** Full game state — lưu trong Redis. KHÔNG gửi trực tiếp cho client. */
export interface GameStateData {
  roomId: string;
  status: RoomStatus;

  board: BoardState;
  players: PlayerState[];
  deck: DeckState;
  teams: TeamInfo[];    // Test 7: 2 teams

  turnOrder: string[];     // [playerId, ...] — T1P1→T2P1→T1P2→T2P2
  currentPlayerIndex: number;       // index trong turnOrder
  turnNumber: number;

  currentPhase: Phase;
  phaseContext: PhaseContext;

  publicReveal: PublicReveal | null;

  winner: string | null;        // Test 7: winning teamId
  /* TEST7_DISABLED: eliminatedPlayers not used for permanent elimination */
  eliminatedPlayers: string[];             // kept for compatibility but always empty

  createdAt: number; // Unix timestamp (ms)
  updatedAt: number;
}

// ─── BROADCAST VARIANTS ─────────────────────────────────────

/** Gửi cho TẤT CẢ clients (ẩn hand, ẩn deck cards) */
export interface PublicGameState {
  roomId: string;
  status: RoomStatus;
  board: BoardState;
  players: PublicPlayerState[];
  deck: { remaining: number };
  teams: TeamInfo[];    // Test 7
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

/** Gửi RIÊNG cho từng player — thêm hand cá nhân */
export interface PrivateGameState extends PublicGameState {
  myHand: CardState[];
  myPlayableCards: string[]; // cardId[]
}

/** Kết quả áp dụng bài */
export interface ApplyResult {
  newPosition: Position;
  extraTurn: boolean;
}

// ─── SOCKET EVENT PAYLOADS ──────────────────────────────────

// === Client → Server ===

export interface RoomCreatePayload {
  playerName: string;
}

export interface RoomJoinPayload {
  roomId: string;
  playerName: string;
  playerId?: string; // reconnect
}

export interface PlayerMovePayload {
  direction: Direction;
  roomId?: string;
  playerId?: string;
}

export interface PlayerPlayCardPayload {
  cardId: string;
  roomId?: string;
  playerId?: string;
  targetPos?: Position;
  helperCardId?: string;
}

export interface PlayerEndCardPhasePayload {
  roomId?: string;
  playerId?: string;
}

export interface PlayerDiscardCardsPayload {
  cardIds: string[];
  roomId?: string;
  playerId?: string;
}

export interface PlayerRequestStatePayload {
  roomId: string;
  playerId?: string;
}

// === Server → Client ===

export interface RoomCreatedData {
  roomId: string;
  joinCode: string;
}

export interface RoomJoinedData {
  roomId: string;
  yourPlayerId: string;
  yourTurnIndex: number;
  currentPlayers: PublicPlayerState[];
  status: RoomStatus;
}

export interface RoomPlayerJoinedData {
  player: PublicPlayerState;
  totalPlayers: number;
}

export interface RoomPlayerLeftData {
  playerId: string;
  playerName: string;
  totalPlayers: number;
}

export interface RoomGameStartingData {
  startsAt: number; // Unix timestamp
  players: PublicPlayerState[];
}

export interface GameStateUpdateData {
  state: PublicGameState;
}

export interface GamePrivateUpdateData {
  playerId: string;
  myHand: CardState[];
  myPlayableCards: string[];
}

export interface GameCardPublicRevealData {
  playerId: string;
  playerName: string;
  card: CardState;
  source: 'phase0' | 'phase2c' | 'phase3';
  expiresAt: number;
}

export interface GameCardRevealEndedData {
  playerId: string;
}

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

/** Test 7: Player stuck → respawn event */
export interface GamePlayerRespawnData {
  playerId: string;
  playerName: string;
  teamId: string;
  reason: 'stuck';
  respawnPosition: Position;
  cellsLost: number;       // 0, 1, or 2
  newTetherLength: number;
  newTeamClaimed: number;
}

/* TEST7_DISABLED: GamePlayerEliminatedData — permanent elimination no longer used
export interface GamePlayerEliminatedData {
  playerId:     string;
  playerName:   string;
  zodiac:       ZodiacName;
  reason:       'stuck';
  eliminatedAt: number;
  surviving:    number;
}
*/

export interface GameOverData {
  winner: {
    teamId: string;     // Test 7: winning team
    playerIds: string[];   // both players
    playerNames: string[];
    zodiacs: ZodiacName[];
  };
  reason: 'team_claimed_all';
  finalState: PublicGameState;
  stats: {
    totalTurns: number;
    claimedByPlayer: Record<string, number>;
    claimedByTeam: Record<string, number>;  // Test 7
  };
}

export interface GameErrorData {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
}

export interface ServerPlayerDisconnectedData {
  playerId: string;
  playerName: string;
}

export interface ServerPlayerReconnectedData {
  playerId: string;
  playerName: string;
}

// === Generic wrappers ===

export interface ServerPayload<T> {
  ok: true;
  data: T;
}

export interface ServerError {
  ok: false;
  code: ErrorCode;
  message: string;
}

export interface ClientPayload<T> {
  data: T;
}
