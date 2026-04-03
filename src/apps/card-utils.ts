export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

export interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

export type FoundationState = Record<Suit, Card[]>;

const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        faceUp: false
      });
    }
  }
  return deck;
}

export function createDeckCopies(copies: number, suitOverride?: Suit): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < copies; copy += 1) {
    for (const suit of suits) {
      const nextSuit = suitOverride ?? suit;
      if (suitOverride && suit !== "spades") {
        continue;
      }
      for (let rank = 1; rank <= 13; rank += 1) {
        deck.push({
          id: `${nextSuit}-${rank}-${copy}-${suit}`,
          suit: nextSuit,
          rank,
          faceUp: false
        });
      }
    }
  }
  return deck;
}

export function createFoundations(): FoundationState {
  return {
    clubs: [],
    diamonds: [],
    hearts: [],
    spades: []
  };
}

export function shuffleDeck(source: Card[], seed = Date.now()): Card[] {
  const deck = source.map((card) => ({ ...card }));
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function rankLabel(rank: number): string {
  return ["?", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][rank] ?? "?";
}

export function suitSymbol(suit: Suit): string {
  return {
    clubs: "♣",
    diamonds: "♦",
    hearts: "♥",
    spades: "♠"
  }[suit];
}

export function suitColor(suit: Suit): "red" | "black" {
  return suit === "diamonds" || suit === "hearts" ? "red" : "black";
}

export function canMoveToFoundation(card: Card, foundation: Card[]): boolean {
  if (foundation.length === 0) {
    return card.rank === 1;
  }

  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canStackDescending(source: Card, target: Card | null): boolean {
  if (!target) {
    return source.rank === 13;
  }

  return suitColor(source.suit) !== suitColor(target.suit) && source.rank === target.rank - 1;
}

export function isOrderedRun(cards: Card[]): boolean {
  if (cards.length <= 1) {
    return true;
  }

  for (let index = 0; index < cards.length - 1; index += 1) {
    if (!canStackDescending(cards[index + 1], cards[index])) {
      return false;
    }
  }

  return true;
}

export function movableFreeCellRunLimit(emptyCells: number, emptyCascades: number): number {
  return (emptyCells + 1) * (2 ** emptyCascades);
}

export function canStackByRank(source: Card, target: Card | null): boolean {
  if (!target) {
    return true;
  }
  return source.rank === target.rank - 1;
}
