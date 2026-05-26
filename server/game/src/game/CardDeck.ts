// ============================================================
// CardDeck — Random-with-replacement deck.
// Draw picks a random card type from a fixed pool and DOES NOT
// remove it from the pool.
// ============================================================

import { CardType, CardState, ZodiacName, ZODIAC_TO_CARD_TYPE } from '../types';
import { Card } from './Card';

export class CardDeck {
  private pool: Card[];

  constructor(cards: Card[], _discardPile: Card[] = []) {
    this.pool = cards;
  }

  /**
 * Build a dynamic random pool based on active zodiacs and shuffle it.
 * Composition:
 * - 3x SYMMETRIC_H, 3x SYMMETRIC_V
 * - 3x CORNER
 * - 2x EXTRA_TURN
 * - 3x CHANGE_TEAMMATE (Test 9)
 * - 2x SWAP_TEAMMATE (Test 10)
 * - 2x per active zodiac (4 active zodiacs * 2 = 8 cards)
 * -> total 24 cards in pool
   */
  static build(activeZodiacs: ZodiacName[]): CardDeck {
    const cards = CardDeck.createCardsForActiveZodiacs(activeZodiacs);
    CardDeck.fisherYatesShuffle(cards);
    return new CardDeck(cards);
  }

  /**
   * Draw a random card from pool (with replacement).
   * The source pool is never reduced.
   */
  draw(): Card | null {
    if (this.pool.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.pool.length);
    const picked = this.pool[randomIndex];
    // Return a fresh instance so drawn card has unique runtime identity/id.
    return new Card(picked.type);
  }

  /** Compatibility no-op: deck is with replacement, so discard is unused. */
  discard(card: Card): void {
    void card;
  }

  /** Size of the random pool (constant for the match) */
  getRemaining(): number {
    return this.pool.length;
  }

  /** Public JSON — pool size */
  toJSON(): { remaining: number } {
    return { remaining: this.pool.length };
  }

  /** Full JSON — includes pool cards; discard stays empty for compatibility. */
  toFullJSON(): { cards: CardState[]; remaining: number; discardPile: CardState[] } {
    return {
      cards: this.pool.map(c => c.toJSON()),
      remaining: this.pool.length,
      discardPile: [],
    };
  }

  private static createCardsForActiveZodiacs(activeZodiacs: ZodiacName[]): Card[] {
    const cards: Card[] = [];

    const coreComposition: [CardType, number][] = [
      [CardType.SYMMETRIC_H, 3],
      [CardType.SYMMETRIC_V, 3],
      [CardType.CORNER, 3],
      [CardType.EXTRA_TURN, 2],
      [CardType.CHANGE_TEAMMATE, 3],
      [CardType.SWAP_TEAMMATE, 2],
    ];

    for (const [type, count] of coreComposition) {
      for (let i = 0; i < count; i++) {
        cards.push(new Card(type));
      }
    }

    for (const zodiac of activeZodiacs) {
      const type = ZODIAC_TO_CARD_TYPE[zodiac];
      cards.push(new Card(type));
      cards.push(new Card(type));
    }

    return cards;
  }

  /** Fisher-Yates (Knuth) shuffle — in-place */
  private static fisherYatesShuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
