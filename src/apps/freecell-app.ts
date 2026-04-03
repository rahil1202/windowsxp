import type { AppHostContext, AppInstance } from "../types";
import {
  canMoveToFoundation,
  canStackDescending,
  createDeck,
  createFoundations,
  movableFreeCellRunLimit,
  rankLabel,
  shuffleDeck,
  suitColor,
  suitSymbol,
  type Card,
  type FoundationState,
  type Suit
} from "./card-utils";
import { createXpGameShell } from "./xp-game-shell";

type FreeCellSource =
  | { type: "freeCell"; index: number }
  | { type: "cascade"; column: number; startIndex: number };

interface FreeCellState {
  freeCells: Array<Card | null>;
  foundations: FoundationState;
  cascades: Card[][];
}

interface DragState {
  source: FreeCellSource;
  cards: Card[];
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "freecell-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => newGame() },
      { label: "Help", title: "FreeCell", onClick: () => setHint("Use free cells as temporary storage and build same-suit foundations from Ace to King.") }
    ],
    statusLeft: "FreeCell",
    statusRight: "Windows XP FreeCell"
  });

  const board = document.createElement("div");
  board.className = "card-game card-game--freecell";
  shell.body.appendChild(board);

  const hint = document.createElement("div");
  hint.className = "card-game__hint";
  shell.body.appendChild(hint);

  let state = createState();
  let dragging: DragState | null = null;

  function createState(): FreeCellState {
    const deck = shuffleDeck(createDeck());
    const cascades = Array.from({ length: 8 }, () => [] as Card[]);
    deck.forEach((card, index) => {
      card.faceUp = true;
      cascades[index % 8].push(card);
    });
    return {
      freeCells: [null, null, null, null],
      foundations: createFoundations(),
      cascades
    };
  }

  function setHint(message: string): void {
    hint.textContent = message;
    window.clearTimeout(Number(hint.dataset.timerId ?? "0"));
    const timeout = window.setTimeout(() => {
      hint.textContent = "";
    }, 2600);
    hint.dataset.timerId = String(timeout);
  }

  function newGame(): void {
    state = createState();
    shell.setToolbar([{ label: "New Game", onClick: () => newGame() }]);
    shell.setStatus("FreeCell", `${countEmptyFreeCells()} free cells open`);
    render();
  }

  function countEmptyFreeCells(): number {
    return state.freeCells.filter((card) => card === null).length;
  }

  function countEmptyCascades(excludeColumn: number | null = null): number {
    return state.cascades.filter((pile, index) => index !== excludeColumn && pile.length === 0).length;
  }

  function getCascadeRun(column: number, startIndex: number): Card[] | null {
    const pile = state.cascades[column];
    if (!pile) {
      return null;
    }
    const run = pile.slice(startIndex);
    if (run.length === 0) {
      return null;
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      if (!canStackDescending(run[index + 1], run[index])) {
        return null;
      }
    }
    const limit = movableFreeCellRunLimit(countEmptyFreeCells(), countEmptyCascades(column));
    return run.length <= limit ? run : null;
  }

  function removeFromSource(source: FreeCellSource): Card[] {
    if (source.type === "freeCell") {
      const card = state.freeCells[source.index];
      state.freeCells[source.index] = null;
      return card ? [card] : [];
    }
    return state.cascades[source.column].splice(source.startIndex);
  }

  function restoreToSource(source: FreeCellSource, cards: Card[]): void {
    if (source.type === "freeCell") {
      state.freeCells[source.index] = cards[0] ?? null;
      return;
    }
    state.cascades[source.column].push(...cards);
  }

  function startDrag(cardId: string, event: PointerEvent): void {
    state.freeCells.forEach((card, index) => {
      if (card?.id === cardId) {
        createDrag({ type: "freeCell", index }, [card], event);
      }
    });
    if (dragging) {
      return;
    }
    for (let column = 0; column < state.cascades.length; column += 1) {
      const startIndex = state.cascades[column].findIndex((card) => card.id === cardId);
      if (startIndex === -1) {
        continue;
      }
      const run = getCascadeRun(column, startIndex);
      if (!run) {
        return;
      }
      createDrag({ type: "cascade", column, startIndex }, run, event);
      return;
    }
  }

  function createDrag(source: FreeCellSource, cards: Card[], event: PointerEvent): void {
    const targetCard = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    if (!targetCard) {
      return;
    }
    const rect = targetCard.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "card-game__drag-ghost";
    ghost.innerHTML = cards
      .map(
        (card, index) => `
          <div class="xp-card xp-card--drag ${cardClassName(card)}" style="top:${index * 24}px">
            <span class="xp-card__corner">${rankLabel(card.rank)}${suitSymbol(card.suit)}</span>
            <span class="xp-card__center">${suitSymbol(card.suit)}</span>
          </div>
        `
      )
      .join("");
    document.body.appendChild(ghost);
    dragging = {
      source,
      cards,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    updateGhost(event.clientX, event.clientY);
    render();
  }

  function updateGhost(clientX: number, clientY: number): void {
    if (!dragging) {
      return;
    }
    dragging.ghost.style.left = `${clientX - dragging.offsetX}px`;
    dragging.ghost.style.top = `${clientY - dragging.offsetY}px`;
  }

  function finishDrag(clientX: number, clientY: number): void {
    if (!dragging) {
      return;
    }
    const activeDrag = dragging;
    dragging = null;
    activeDrag.ghost.remove();
    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const slot = target?.closest<HTMLElement>("[data-freecell-slot]");
    if (!slot) {
      render();
      return;
    }
    const moved = removeFromSource(activeDrag.source);
    if (moved.length === 0) {
      render();
      return;
    }
    const applied = applyDrop(slot, moved, activeDrag.source);
    if (!applied) {
      restoreToSource(activeDrag.source, moved);
    } else {
      shell.setStatus("FreeCell", `${countEmptyFreeCells()} free cells open`);
    }
    render();
  }

  function applyDrop(slot: HTMLElement, cards: Card[], source: FreeCellSource): boolean {
    const slotType = slot.dataset.slotType;
    const firstCard = cards[0];
    if (!firstCard) {
      return false;
    }

    if (slotType === "freeCell") {
      if (cards.length !== 1) {
        return false;
      }
      const index = Number(slot.dataset.slotIndex ?? "-1");
      if (state.freeCells[index] !== null) {
        return false;
      }
      state.freeCells[index] = firstCard;
      return true;
    }

    if (slotType === "foundation") {
      if (cards.length !== 1) {
        return false;
      }
      const suit = slot.dataset.suit as Suit | undefined;
      if (!suit || !canMoveToFoundation(firstCard, state.foundations[suit])) {
        return false;
      }
      state.foundations[suit].push(firstCard);
      return true;
    }

    if (slotType === "cascade") {
      const column = Number(slot.dataset.slotIndex ?? "-1");
      const pile = state.cascades[column];
      if (!pile) {
        return false;
      }
      const maxRun = movableFreeCellRunLimit(
        countEmptyFreeCells() + (source.type === "freeCell" ? 1 : 0),
        countEmptyCascades(source.type === "cascade" ? source.column : null) + (pile.length === 0 ? 1 : 0)
      );
      if (cards.length > maxRun) {
        return false;
      }
      const topCard = pile[pile.length - 1];
      if (!topCard) {
        pile.push(...cards);
        return true;
      }
      if (!canStackDescending(firstCard, topCard)) {
        return false;
      }
      pile.push(...cards);
      return true;
    }

    return false;
  }

  function cardClassName(card: Card): string {
    return suitColor(card.suit) === "red" ? "xp-card--red" : "xp-card--black";
  }

  function renderCard(card: Card, offset: number): string {
    return `
      <button
        type="button"
        class="xp-card ${cardClassName(card)}"
        data-card-id="${card.id}"
        style="top:${offset}px"
      >
        <span class="xp-card__corner">${rankLabel(card.rank)}${suitSymbol(card.suit)}</span>
        <span class="xp-card__center">${suitSymbol(card.suit)}</span>
      </button>
    `;
  }

  function tryAutoFoundation(cardId: string): void {
    state.freeCells.forEach((card, index) => {
      if (card?.id === cardId && canMoveToFoundation(card, state.foundations[card.suit])) {
        state.freeCells[index] = null;
        state.foundations[card.suit].push(card);
      }
    });
    for (let column = 0; column < state.cascades.length; column += 1) {
      const pile = state.cascades[column];
      const card = pile[pile.length - 1];
      if (card?.id === cardId && canMoveToFoundation(card, state.foundations[card.suit])) {
        pile.pop();
        state.foundations[card.suit].push(card);
      }
    }
    shell.setStatus("FreeCell", `${countEmptyFreeCells()} free cells open`);
    render();
  }

  function render(): void {
    const draggingIds = new Set(dragging?.cards.map((card) => card.id) ?? []);
    board.innerHTML = `
      <div class="card-game__top-row">
        <div class="card-game__freecells">
          ${state.freeCells
            .map((card, index) => `
              <div class="card-game__slot" data-freecell-slot data-slot-type="freeCell" data-slot-index="${index}">
                ${card ? renderCard(card, 0) : `<span class="card-game__empty">Free</span>`}
              </div>
            `)
            .join("")}
        </div>
        <div class="card-game__foundation-row">
          ${(["clubs", "diamonds", "hearts", "spades"] as const)
            .map((suit) => {
              const pile = state.foundations[suit];
              const topCard = pile[pile.length - 1];
              return `
                <div class="card-game__slot" data-freecell-slot data-slot-type="foundation" data-suit="${suit}">
                  ${topCard ? renderCard(topCard, 0) : `<span class="card-game__empty">${suitSymbol(suit)}</span>`}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="card-game__tableau-row card-game__tableau-row--freecell">
        ${state.cascades
          .map((pile, column) => `
            <div class="card-game__slot card-game__slot--tableau" data-freecell-slot data-slot-type="cascade" data-slot-index="${column}">
              ${pile
                .map((card, index) =>
                  draggingIds.has(card.id)
                    ? `<span class="xp-card xp-card--placeholder" style="top:${index * 24}px"></span>`
                    : renderCard(card, index * 24)
                )
                .join("")}
            </div>
          `)
          .join("")}
      </div>
    `;
  }

  board.addEventListener("dblclick", (event) => {
    const cardButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    const cardId = cardButton?.dataset.cardId;
    if (!cardId) {
      return;
    }
    tryAutoFoundation(cardId);
  }, { signal: abortController.signal });

  board.addEventListener("pointerdown", (event) => {
    const cardButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    const cardId = cardButton?.dataset.cardId;
    if (!cardId || event.button !== 0) {
      return;
    }
    startDrag(cardId, event);
  }, { signal: abortController.signal });

  window.addEventListener("pointermove", (event) => {
    updateGhost(event.clientX, event.clientY);
  }, { signal: abortController.signal });

  window.addEventListener("pointerup", (event) => {
    finishDrag(event.clientX, event.clientY);
  }, { signal: abortController.signal });

  newGame();

  return {
    unmount() {
      abortController.abort();
      dragging?.ghost.remove();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
