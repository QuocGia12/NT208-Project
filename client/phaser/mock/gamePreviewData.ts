import {
  ALL_ZODIACS,
  CARD_TYPE_TO_DISPLAY_NAME,
  CardState,
  CardType,
  CellState,
  CellType,
  Direction,
  MAP,
  Phase,
  PublicGameState,
  PublicPlayerState,
  RoomStatus,
  TeamInfo,
  ZodiacName,
} from '@/types/game';

export type GamePreviewScenario = 'move' | 'cards' | 'spawn';

export type PreviewPrivateState = {
  playerId: string;
  myHand: CardState[];
  myPlayableCards: string[];
};

export type PreviewPayload = {
  state: PublicGameState;
  privateState: PreviewPrivateState;
};

const createCard = (id: string, type: CardType): CardState => ({
  id,
  type,
  displayName: CARD_TYPE_TO_DISPLAY_NAME[type],
});

const createBoardCells = (players: PublicPlayerState[]): CellState[] => {
  const drawCells = new Set(['1,1', '3,1', '5,1', '0,4', '2,4', '4,4', '6,4', '1,7', '3,7', '5,7']);
  const claimedCells = new Map<string, string>([
    ['0,0', players[0]?.id ?? 'p1'],
    ['6,0', players[1]?.id ?? 'p2'],
    ['0,8', players[2]?.id ?? 'p3'],
    ['6,8', players[3]?.id ?? 'p4'],
    ['2,2', players[0]?.id ?? 'p1'],
    ['4,2', players[1]?.id ?? 'p2'],
    ['2,6', players[2]?.id ?? 'p3'],
    ['4,6', players[3]?.id ?? 'p4'],
  ]);

  const zodiacPool: ZodiacName[] = [...ALL_ZODIACS];
  let zodiacIndex = 0;

  const cells: CellState[] = [];
  for (let y = 0; y < MAP.ROWS; y += 1) {
    for (let x = 0; x < MAP.COLS; x += 1) {
      const key = `${x},${y}`;
      const type = drawCells.has(key) ? CellType.DRAW : CellType.ZODIAC;
      const zodiac = type === CellType.ZODIAC ? zodiacPool[zodiacIndex % zodiacPool.length] : null;
      zodiacIndex += type === CellType.ZODIAC ? 1 : 0;

      cells.push({
        x,
        y,
        type,
        zodiac,
        claimedBy: claimedCells.get(key) ?? null,
      });
    }
  }

  return cells;
};

const createPlayers = (): PublicPlayerState[] => [
  {
    id: 'preview-p1',
    name: 'Astra',
    zodiac: ALL_ZODIACS[0],
    position: { x: 3, y: 4 },
    handSize: 5,
    claimedCount: 2,
    eliminated: false,
    connected: true,
    turnIndex: 0,
    hasSpawned: true,
    teamId: 'team1',
    isLocked: false,
    skipNextTurn: false,
  },
  {
    id: 'preview-p2',
    name: 'Beryl',
    zodiac: ALL_ZODIACS[1],
    position: { x: 5, y: 2 },
    handSize: 4,
    claimedCount: 2,
    eliminated: false,
    connected: true,
    turnIndex: 1,
    hasSpawned: true,
    teamId: 'team2',
    isLocked: false,
    skipNextTurn: false,
  },
  {
    id: 'preview-p3',
    name: 'Cyra',
    zodiac: ALL_ZODIACS[2],
    position: { x: 1, y: 6 },
    handSize: 3,
    claimedCount: 1,
    eliminated: false,
    connected: true,
    turnIndex: 2,
    hasSpawned: true,
    teamId: 'team1',
    isLocked: false,
    skipNextTurn: false,
  },
  {
    id: 'preview-p4',
    name: 'Drake',
    zodiac: ALL_ZODIACS[3],
    position: { x: 4, y: 7 },
    handSize: 6,
    claimedCount: 3,
    eliminated: false,
    connected: false,
    turnIndex: 3,
    hasSpawned: true,
    teamId: 'team2',
    isLocked: true,
    skipNextTurn: true,
  },
];

const createTeams = (): TeamInfo[] => [
  {
    teamId: 'team1',
    playerIds: ['preview-p1', 'preview-p3'],
    zodiacs: [ALL_ZODIACS[0], ALL_ZODIACS[2]],
    tetherLength: 7,
    totalClaimed: 3,
  },
  {
    teamId: 'team2',
    playerIds: ['preview-p2', 'preview-p4'],
    zodiacs: [ALL_ZODIACS[1], ALL_ZODIACS[3]],
    tetherLength: 6,
    totalClaimed: 5,
  },
];

export const createPreviewPayload = (scenario: GamePreviewScenario): PreviewPayload => {
  const players = createPlayers();
  const teams = createTeams();
  const myHand = [
    createCard('card-1', CardType.SYMMETRIC_H),
    createCard('card-2', CardType.CORNER),
    createCard('card-3', CardType.EXTRA_TURN),
    createCard('card-4', CardType.ZODIAC_TY),
    createCard('card-5', CardType.CHANGE_TEAMMATE),
  ];

  const baseState: PublicGameState = {
    roomId: 'preview-room',
    status: RoomStatus.PLAYING,
    board: {
      cells: createBoardCells(players),
      activeZodiacs: ALL_ZODIACS.slice(0, 6),
    },
    players,
    deck: { remaining: 24 },
    teams,
    turnOrder: players.map((player) => player.id),
    currentPlayerIndex: 0,
    turnNumber: 7,
    currentPhase: Phase.MOVE,
    phaseContext: {
      phase: 3,
      diceResult: 4,
      stepsRemaining: 2,
      prevPosition: { x: 2, y: 4 },
      validDirections: [Direction.UP, Direction.LEFT, Direction.RIGHT],
    },
    publicReveal: null,
    winner: null,
    eliminatedPlayers: [],
    updatedAt: Date.now(),
  };

  if (scenario === 'cards') {
    return {
      state: {
        ...baseState,
        currentPhase: Phase.PLAY_CARD,
        phaseContext: {
          phase: 2,
          timerExpiresAt: Date.now() + 45000,
          playableCards: ['card-1', 'card-2', 'card-3', 'card-5'],
        },
      },
      privateState: {
        playerId: 'preview-p1',
        myHand,
        myPlayableCards: ['card-1', 'card-2', 'card-3', 'card-5'],
      },
    };
  }

  if (scenario === 'spawn') {
    const spawnPlayers = players.map((player, index) => ({
      ...player,
      hasSpawned: false,
      position: { x: 3, y: 4 },
      handSize: index === 0 ? 5 : 4,
    }));

    return {
      state: {
        ...baseState,
        players: spawnPlayers,
        currentPhase: Phase.PICK_SPAWN,
        phaseContext: {
          phase: -1,
          availablePositions: [
            { x: 2, y: 4 },
            { x: 3, y: 4 },
            { x: 4, y: 4 },
            { x: 3, y: 3 },
            { x: 3, y: 5 },
          ],
        },
      },
      privateState: {
        playerId: 'preview-p1',
        myHand,
        myPlayableCards: [],
      },
    };
  }

  return {
    state: baseState,
    privateState: {
      playerId: 'preview-p1',
      myHand,
      myPlayableCards: ['card-1', 'card-2', 'card-3'],
    },
  };
};
