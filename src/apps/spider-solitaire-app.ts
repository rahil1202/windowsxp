import type { AppHostContext, AppInstance } from "../types";
import {
  canStackByRank,
  createDeckCopies,
  rankLabel,
  shuffleDeck,
  suitColor,
  suitSymbol,
  type Card
} from "./card-utils";
import { createXpGameShell } from "./xp-game-shell";

type SpiderSource = { column: number; startIndex: number };

interface SpiderState {
  tableau: Card[][];
  stockDeals: Card[][];
  completedRuns: number;
}

interface DragState {
  source: SpiderSource;
  cards: Card[];
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "spider-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => newGame() },
      { label: "Deal", title: "Deal new row", onClick: () => dealStockRow() },
      { label: "Help", title: "Spider Solitaire", onClick: () => setHint("Build descending runs from King to Ace, then clear complete sequences.") }
    ],
    statusLeft: "Spider Solitaire",
    statusRight: "One Suit"
  });

  const board = document.createElement("div");
  board.className = "card-game card-game--spider";
  shell.body.appendChild(board);

  const hint = document.createElement("div");
  hint.className = "card-game__hint";
  shell.body.appendChild(hint);

  let state = createState();
  let dragging: DragState | null = null;

  function createState(): SpiderState {
    const deck = shuffleDeck(createDeckCopies(8, "spades"));
    const tableau: Card[][] = Array.from({ length: 10 }, () => []);
    for (let column = 0; column < 10; column += 1) {
      const cardsToDeal = column < 4 ? 6 : 5;
      for (let index = 0; index < cardsToDeal; index += 1) {
        const card = deck.shift();
        if (!card) {
          continue;
        }
        card.faceUp = index === cardsToDeal - 1;
        tableau[column].push(card);
      }
    }

    const stockDeals: Card[][] = [];
    while (deck.length > 0) {
      stockDeals.push(
        deck.splice(0, 10).map((card) => ({
          ...card,
          faceUp: true
        }))
      );
    }

    return {
      tableau,
      stockDeals,
      completedRuns: 0
    };
  }

  function setHint(message: string): void {
    hint.textContent = message;
    window.clearTimeout(Number(hint.dataset.timerId ?? "0"));
    const timer = window.setTimeout(() => {
      hint.textContent = "";
    }, 2600);
    hint.dataset.timerId = String(timer);
  }

  function updateToolbar(): void {
    shell.setToolbar([
      { label: "New Game", onClick: () => newGame() },
      { label: `Deals ${state.stockDeals.length}`, onClick: () => dealStockRow(), active: state.stockDeals.length > 0 }
    ]);
    shell.setStatus(`Spider · Completed ${state.completedRuns}/8`, `${state.stockDeals.length} deal(s) left`);
  }

  function newGame(): void {
    state = createState();
    updateToolbar();
    render();
  }

  function getRun(column: number, startIndex: number): Card[] | null {
    const pile = state.tableau[column];
    if (!pile) {
      return null;
    }
    const run = pile.slice(startIndex);
    if (run.length === 0 || !run[0].faceUp) {
      return null;
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      if (!run[index].faceUp || !run[index + 1].faceUp || run[index + 1].rank !== run[index].rank - 1) {
        return null;
      }
    }
    return run;
  }

  function revealTopCard(column: number): void {
    const pile = state.tableau[column];
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) {
      top.faceUp = true;
    }
  }

  function checkCompletedRun(column: number): void {
    const pile = state.tableau[column];
    if (pile.length < 13) {
      return;
    }
    const tail = pile.slice(-13);
    const isComplete = tail.every((card, index) => card.faceUp && card.rank === 13 - index);
    if (!isComplete) {
      return;
    }
    state.tableau[column] = pile.slice(0, -13);
    state.completedRuns += 1;
    revealTopCard(column);
  }

  function dealStockRow(): void {
    if (state.stockDeals.length === 0) {
      return;
    }
    if (state.tableau.some((pile) => pile.length === 0)) {
      setHint("Fill every column before dealing a new row.");
      return;
    }
    const nextDeal = state.stockDeals.shift();
    if (!nextDeal) {
      return;
    }
    nextDeal.forEach((card, index) => {
      state.tableau[index].push(card);
    });
    updateToolbar();
    render();
  }

  function createDrag(source: SpiderSource, cards: Card[], event: PointerEvent): void {
    const targetCard = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-spider-card]");
    if (!targetCard) {
      return;
    }
    const rect = targetCard.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "card-game__drag-ghost";
    ghost.innerHTML = cards
      .map(
        (card, index) => `
          <div class="xp-card xp-card--drag ${suitColor(card.suit) === "red" ? "xp-card--red" : "xp-card--black"}" style="top:${index * 16}px">
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

  function startDrag(cardId: string, event: PointerEvent): void {
    for (let column = 0; column < state.tableau.length; column += 1) {
      const startIndex = state.tableau[column].findIndex((card) => card.id === cardId);
      if (startIndex === -1) {
        continue;
      }
      const run = getRun(column, startIndex);
      if (!run) {
        return;
      }
      createDrag({ column, startIndex }, run, event);
      return;
    }
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
    const slot = target?.closest<HTMLElement>("[data-spider-slot]");
    if (!slot) {
      render();
      return;
    }

    const sourcePile = state.tableau[activeDrag.source.column];
    const moving = sourcePile.splice(activeDrag.source.startIndex);
    const applied = applyDrop(slot, moving);
    if (!applied) {
      sourcePile.push(...moving);
      render();
      return;
    }
    revealTopCard(activeDrag.source.column);
    checkCompletedRun(Number(slot.dataset.slotIndex ?? "-1"));
    updateToolbar();
    render();
  }

  function applyDrop(slot: HTMLElement, cards: Card[]): boolean {
    const column = Number(slot.dataset.slotIndex ?? "-1");
    const pile = state.tableau[column];
    if (!pile || cards.length === 0) {
      return false;
    }
    const target = pile[pile.length - 1] ?? null;
    if (!canStackByRank(cards[0], target)) {
      return false;
    }
    pile.push(...cards);
    return true;
  }

  function renderCard(card: Card, offset: number): string {
    return `
      <button
        type="button"
        class="xp-card ${suitColor(card.suit) === "red" ? "xp-card--red" : "xp-card--black"}"
        data-spider-card="${card.id}"
        style="top:${offset}px"
      >
        <span class="xp-card__corner">${rankLabel(card.rank)}${suitSymbol(card.suit)}</span>
        <span class="xp-card__center">${suitSymbol(card.suit)}</span>
      </button>
    `;
  }

  function render(): void {
    const draggingIds = new Set(dragging?.cards.map((card) => card.id) ?? []);
    board.innerHTML = `
      <div class="card-game__top-row">
        <div class="spider-app__completed">
          ${Array.from({ length: 8 }, (_, index) => `
            <div class="card-game__slot spider-app__complete-slot">
              ${index < state.completedRuns ? '<span class="card-game__empty">Done</span>' : ""}
            </div>
          `).join("")}
        </div>
        <button type="button" class="card-game__slot card-game__slot--stock" data-spider-deal>
          ${state.stockDeals.length > 0 ? `<span class="xp-card xp-card--back"></span>` : `<span class="card-game__empty">Empty</span>`}
        </button>
      </div>
      <div class="card-game__tableau-row card-game__tableau-row--spider">
        ${state.tableau.map((pile, column) => `
          <div class="card-game__slot card-game__slot--tableau" data-spider-slot data-slot-index="${column}">
            ${pile.map((card, index) => {
              const offset = index * (card.faceUp ? 18 : 11);
              if (draggingIds.has(card.id)) {
                return `<span class="xp-card xp-card--placeholder" style="top:${offset}px"></span>`;
              }
              return card.faceUp ? renderCard(card, offset) : `<span class="xp-card xp-card--back" style="top:${offset}px"></span>`;
            }).join("")}
          </div>
        `).join("")}
      </div>
    `;
  }

  board.addEventListener("click", (event) => {
    const dealButton = (event.target as HTMLElement | null)?.closest("[data-spider-deal]");
    if (dealButton) {
      dealStockRow();
    }
  }, { signal: abortController.signal });

  board.addEventListener("pointerdown", (event) => {
    const cardButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-spider-card]");
    const cardId = cardButton?.dataset.spiderCard;
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
