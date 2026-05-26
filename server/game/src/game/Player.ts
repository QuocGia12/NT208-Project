// ============================================================
// Player — State of a single player in a game session.
// Test 7: Added teamId for 2v2 team mode.
// ============================================================

import {
  ZodiacName, Position, PlayerState, PublicPlayerState, MAP,
} from '../types';
import { Card } from './Card';
import { Board } from './Board';

export class Player {
  public id: string;
  public socketId: string;
  public name: string;
  public zodiac: ZodiacName;
  public position: Position;
  public hand: Card[];
  public handSize: number;
  public claimedCount: number;
  public eliminated: boolean;
  public connected: boolean;
  public turnIndex: number;
  public hasSpawned: boolean;
  public teamId: string;      // Test 7: 'team1' | 'team2'
  public isLocked: boolean;   // Locked for next turn skip
  public skipNextTurn: boolean; // Internal flag to skip exactly one turn

  constructor(
    id: string,
    socketId: string,
    name: string,
    zodiac: ZodiacName,
    turnIndex: number,
    teamId: string = '',  // Test 7
  ) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.zodiac = zodiac;
    this.turnIndex = turnIndex;
    this.teamId = teamId;

    // Defaults — Test 6: players start off-board
    this.position = { x: -1, y: -1 };
    this.hand = [];
    this.handSize = 0;
    this.claimedCount = 0;
    this.eliminated = false;
    this.connected = true;
    this.hasSpawned = false;
    this.isLocked = false;
    this.skipNextTurn = false;
  }

  /** Add a card to the player's hand */
  addCard(card: Card): void {
    this.hand.push(card);
    this.handSize = this.hand.length;
  }

  /** Remove a card from the player's hand by cardId. Returns the card or null. */
  removeCard(cardId: string): Card | null {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    const [card] = this.hand.splice(index, 1);
    this.handSize = this.hand.length;
    return card;
  }

  /** Find a card in hand by cardId */
  getCard(cardId: string): Card | undefined {
    return this.hand.find(c => c.id === cardId);
  }

  /**
   * Is this player stuck (cannot move in any direction)?
   * A player is stuck if ALL 4 adjacent cells are either:
   *   - Out of bounds (edge/corner of map)
   *   - Blocked (claimed by another player, or WALL)
   *   - Occupied by another player
   */
  isStuck(board: Board, occupiedPositions: Position[] = []): boolean {
    const adjacentPositions = board.getAdjacentPositions(this.position.x, this.position.y);
    const occupiedSet = new Set(occupiedPositions.map(pos => `${pos.x},${pos.y}`));

    for (const pos of adjacentPositions) {
      const cell = board.getCell(pos.x, pos.y);
      if (cell && !cell.isBlockedFor(this.id) && !occupiedSet.has(`${pos.x},${pos.y}`)) {
        return false; // At least one valid direction exists
      }
    }

    return true; // All directions blocked or out of bounds
  }

  /** Serialize to PublicPlayerState — NO hand, YES handSize */
  toPublicJSON(): PublicPlayerState {
    return {
      id: this.id,
      name: this.name,
      zodiac: this.zodiac,
      position: { x: this.position.x, y: this.position.y },
      handSize: this.handSize,
      claimedCount: this.claimedCount,
      eliminated: this.eliminated,
        connected: this.connected,
        turnIndex: this.turnIndex,
        hasSpawned: this.hasSpawned,
        teamId: this.teamId,
        isLocked: this.isLocked,
        skipNextTurn: this.skipNextTurn,
      };
  }

  /** Serialize to full PlayerState — includes hand as CardState[] */
  toPrivateJSON(): PlayerState {
    return {
      id: this.id,
      socketId: this.socketId,
      name: this.name,
      zodiac: this.zodiac,
      position: { x: this.position.x, y: this.position.y },
      hand: this.hand.map(c => c.toJSON()),
      handSize: this.handSize,
      claimedCount: this.claimedCount,
      eliminated: this.eliminated,
        connected: this.connected,
        turnIndex: this.turnIndex,
        hasSpawned: this.hasSpawned,
        teamId: this.teamId,
        isLocked: this.isLocked,
        skipNextTurn: this.skipNextTurn,
      };
  }
}
