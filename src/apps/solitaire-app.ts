import type { AppHostContext, AppInstance } from "../types";
import { loadShellPreferences, saveShellPreferences } from "../storage";
import {
  canMoveToFoundation,
  canStackDescending,
  createDeck,
  createFoundations,
  rankLabel,
  shuffleDeck,
  suitColor,
  suitSymbol,
  type Card,
  type FoundationState,
  type Suit
} from "./card-utils";
import { createXpGameShell } from "./xp-game-shell";

type DragSource =
  | { type: "waste" }
  | { type: "tableau"; column: number; startIndex: number };

interface KlondikeState {
  drawCount: 1 | 3;
  stock: Card[];
  waste: Card[];
  tableau: Card[][];
  foundations: FoundationState;
  elapsed: number;
  score: number;
  won: boolean;
}

interface DragState {
  source: DragSource;
  cards: Card[];
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shellPrefs = loadShellPreferences();
  const shell = createXpGameShell(host, {
    className: "solitaire-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => newGame() },
      { label: "Deal", title: "Draw cards", onClick: () => drawFromStock() },
      { label: "Help", title: "Klondike", onClick: () => setHint("Build alternating descending columns and move aces to the top foundations.") }
    ],
    statusLeft: "Klondike Draw 3",
    statusRight: "Windows XP Solitaire"
  });

  const board = document.createElement("div");
  board.className = "card-game card-game--solitaire";
  shell.body.appendChild(board);

  const hint = document.createElement("div");
  hint.className = "card-game__hint";
  shell.body.appendChild(hint);

  const stats = document.createElement("div");
  stats.className = "solitaire__stats";
  shell.body.appendChild(stats);

  let state = createState(3);
  let dragging: DragState | null = null;
  let timerId = 0;

  function createState(drawCount: 1 | 3): KlondikeState {
    const deck = shuffleDeck(createDeck());
    const tableau: Card[][] = Array.from({ length: 7 }, () => []);
    for (let column = 0; column < 7; column += 1) {
      for (let row = 0; row <= column; row += 1) {
        const card = deck.shift();
        if (!card) {
          continue;
        }
        card.faceUp = row === column;
        tableau[column].push(card);
      }
    }
    for (const card of deck) {
      card.faceUp = false;
    }
    return {
      drawCount,
      stock: deck,
      waste: [],
      tableau,
      foundations: createFoundations(),
      elapsed: 0,
      score: 0,
      won: false
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

  function updateToolbar(): void {
    shell.setToolbar([
      { label: "New Game", onClick: () => newGame() },
      { label: "Draw 1", onClick: () => setDrawMode(1), active: state.drawCount === 1 },
      { label: "Draw 3", onClick: () => setDrawMode(3), active: state.drawCount === 3 },
      { label: "Auto Finish", onClick: () => autoFinish() }
    ]);
    shell.setStatus(`Klondike Draw ${state.drawCount}`, `${state.stock.length} cards in stock`);
    renderStats();
  }

  function setDrawMode(drawCount: 1 | 3): void {
    if (state.drawCount === drawCount) {
      return;
    }
    state = createState(drawCount);
    updateToolbar();
    render();
  }

  function newGame(): void {
    window.clearInterval(timerId);
    state = createState(state.drawCount);
    startTimer();
    updateToolbar();
    render();
  }

  function startTimer(): void {
    window.clearInterval(timerId);
    timerId = window.setInterval(() => {
      state.elapsed += 1;
      renderStats();
    }, 1000);
  }

  function getTableauRun(column: number, startIndex: number): Card[] | null {
    const pile = state.tableau[column];
    if (!pile) {
      return null;
    }
    const run = pile.slice(startIndex);
    if (run.length === 0 || !run[0].faceUp) {
      return null;
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      if (!run[index].faceUp || !run[index + 1].faceUp || !canStackDescending(run[index + 1], run[index])) {
        return null;
      }
    }
    return run;
  }

  function removeCardsFromSource(source: DragSource): Card[] {
    if (source.type === "waste") {
      const card = state.waste.pop();
      return card ? [card] : [];
    }
    return state.tableau[source.column].splice(source.startIndex);
  }

  function restoreCardsToSource(source: DragSource, cards: Card[]): void {
    if (source.type === "waste") {
      state.waste.push(...cards);
      return;
    }
    state.tableau[source.column].push(...cards);
  }

  function finalizeSourceReveal(source: DragSource): void {
    if (source.type !== "tableau") {
      return;
    }
    const newTop = state.tableau[source.column][state.tableau[source.column].length - 1];
    if (newTop && !newTop.faceUp) {
      newTop.faceUp = true;
    }
  }

  function drawFromStock(): void {
    if (state.stock.length === 0) {
      state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      state.waste = [];
      render();
      return;
    }
    const batch = state.stock.splice(Math.max(0, state.stock.length - state.drawCount));
    for (const card of batch) {
      card.faceUp = true;
      state.waste.push(card);
    }
    updateToolbar();
    render();
  }

  function autoMoveToFoundation(card: Card, source: DragSource): boolean {
    if (!canMoveToFoundation(card, state.foundations[card.suit])) {
      return false;
    }
    const moved = removeCardsFromSource(source);
    const nextCard = moved[0];
    if (!nextCard) {
      return false;
    }
    state.foundations[nextCard.suit].push(nextCard);
    state.score += 10;
    finalizeSourceReveal(source);
    maybeHandleWin();
    updateToolbar();
    render();
    return true;
  }

  function getWasteCard(): Card | null {
    return state.waste[state.waste.length - 1] ?? null;
  }

  function startDrag(cardId: string, event: PointerEvent): void {
    const wasteCard = getWasteCard();
    if (wasteCard?.id === cardId) {
      createDrag({ type: "waste" }, [wasteCard], event);
      return;
    }

    for (let column = 0; column < state.tableau.length; column += 1) {
      const startIndex = state.tableau[column].findIndex((card) => card.id === cardId);
      if (startIndex === -1) {
        continue;
      }
      const run = getTableauRun(column, startIndex);
      if (!run) {
        return;
      }
      createDrag({ type: "tableau", column, startIndex }, run, event);
      return;
    }
  }

  function createDrag(source: DragSource, cards: Card[], event: PointerEvent): void {
    const targetCard = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    if (!targetCard) {
      return;
    }
    const rect = targetCard.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "card-game__drag-ghost";
    ghost.style.left = `${event.clientX - (event.clientX - rect.left)}px`;
    ghost.style.top = `${event.clientY - (event.clientY - rect.top)}px`;
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
    updateGhostPosition(event.clientX, event.clientY);
    render();
  }

  function updateGhostPosition(clientX: number, clientY: number): void {
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
    const slot = target?.closest<HTMLElement>("[data-solitaire-slot]");
    if (!slot) {
      render();
      return;
    }

    const moved = removeCardsFromSource(activeDrag.source);
    if (moved.length === 0) {
      render();
      return;
    }

    const applied = applyDrop(slot, moved);
    if (!applied) {
      restoreCardsToSource(activeDrag.source, moved);
    } else {
      finalizeSourceReveal(activeDrag.source);
      updateToolbar();
    }
    render();
  }

  function applyDrop(slot: HTMLElement, cards: Card[]): boolean {
    const slotType = slot.dataset.slotType;
    const pileIndex = Number(slot.dataset.slotIndex ?? "-1");
    const firstCard = cards[0];
    if (!firstCard) {
      return false;
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
      state.score += 10;
      maybeHandleWin();
      return true;
    }

    if (slotType === "tableau") {
      const pile = state.tableau[pileIndex];
      if (!pile) {
        return false;
      }
      const topCard = pile[pile.length - 1];
      if (!topCard) {
        if (firstCard.rank !== 13) {
          return false;
        }
      } else if (!canStackDescending(firstCard, topCard)) {
        return false;
      }
      pile.push(...cards);
      state.score += 5;
      return true;
    }

    return false;
  }

  function cardClassName(card: Card): string {
    return suitColor(card.suit) === "red" ? "xp-card--red" : "xp-card--black";
  }

  function renderTopCard(card: Card | undefined, offset = 0): string {
    if (!card) {
      return "";
    }
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

  function render(): void {
    const draggingIds = new Set(dragging?.cards.map((card) => card.id) ?? []);
    board.innerHTML = `
      ${state.won ? `<div class="solitaire__banner">You win! Auto-finish complete.</div>` : ""}
      <div class="card-game__top-row">
        <button type="button" class="card-game__slot card-game__slot--stock" data-solitaire-stock>
          ${state.stock.length > 0 ? `<span class="xp-card xp-card--back"></span>` : `<span class="card-game__empty">↺</span>`}
        </button>
        <div class="card-game__slot card-game__slot--waste" data-solitaire-slot data-slot-type="waste">
          ${renderTopCard(getWasteCard() ?? undefined)}
        </div>
        <div class="card-game__foundation-row">
          ${(["clubs", "diamonds", "hearts", "spades"] as const)
            .map((suit) => {
              const pile = state.foundations[suit];
              const topCard = pile[pile.length - 1];
              return `
                <div class="card-game__slot" data-solitaire-slot data-slot-type="foundation" data-suit="${suit}">
                  ${topCard ? renderTopCard(topCard) : `<span class="card-game__empty">${suitSymbol(suit)}</span>`}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="card-game__tableau-row">
        ${state.tableau
          .map((pile, column) => `
            <div class="card-game__slot card-game__slot--tableau" data-solitaire-slot data-slot-type="tableau" data-slot-index="${column}">
              ${pile
                .map((card, index) => {
                  if (draggingIds.has(card.id)) {
                    return `<span class="xp-card xp-card--placeholder" style="top:${index * (card.faceUp ? 24 : 14)}px"></span>`;
                  }
                  return card.faceUp
                    ? `
                      <button
                        type="button"
                        class="xp-card ${cardClassName(card)}"
                        data-card-id="${card.id}"
                        style="top:${index * 24}px"
                      >
                        <span class="xp-card__corner">${rankLabel(card.rank)}${suitSymbol(card.suit)}</span>
                        <span class="xp-card__center">${suitSymbol(card.suit)}</span>
                      </button>
                    `
                    : `<span class="xp-card xp-card--back" style="top:${index * 14}px"></span>`;
                })
                .join("")}
            </div>
          `)
          .join("")}
      </div>
    `;
    renderStats();
  }

  function renderStats(): void {
    stats.innerHTML = `
      <strong>Score ${state.score}</strong>
      <span>Time ${state.elapsed}s</span>
      <span>Best ${shellPrefs.solitaireStats.bestScore}</span>
      <span>Wins ${shellPrefs.solitaireStats.wins}</span>
    `;
  }

  function maybeHandleWin(): void {
    const completed = Object.values(state.foundations).every((pile) => pile.length === 13);
    if (!completed || state.won) {
      return;
    }
    state.won = true;
    window.clearInterval(timerId);
    if (state.score > shellPrefs.solitaireStats.bestScore) {
      shellPrefs.solitaireStats.bestScore = state.score;
    }
    if (shellPrefs.solitaireStats.bestTime === null || state.elapsed < shellPrefs.solitaireStats.bestTime) {
      shellPrefs.solitaireStats.bestTime = state.elapsed;
    }
    shellPrefs.solitaireStats.wins += 1;
    saveShellPreferences(shellPrefs);
    setHint(`Klondike complete in ${state.elapsed}s.`);
  }

  function autoFinish(): void {
    let moved = false;
    for (let column = 0; column < state.tableau.length; column += 1) {
      let searching = true;
      while (searching) {
        searching = false;
        for (let index = state.tableau[column].length - 1; index >= 0; index -= 1) {
          const card = state.tableau[column][index];
          if (!card?.faceUp) {
            continue;
          }
          if (autoMoveToFoundation(card, { type: "tableau", column, startIndex: index })) {
            moved = true;
            searching = true;
            break;
          }
        }
      }
    }
    const wasteCard = getWasteCard();
    if (wasteCard) {
      moved = autoMoveToFoundation(wasteCard, { type: "waste" }) || moved;
    }
    if (!moved) {
      setHint("No auto-finish move available.");
    }
  }

  board.addEventListener("click", (event) => {
    const stockButton = (event.target as HTMLElement | null)?.closest("[data-solitaire-stock]");
    if (stockButton) {
      drawFromStock();
      return;
    }
  }, { signal: abortController.signal });

  board.addEventListener("dblclick", (event) => {
    const cardButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    if (!cardButton) {
      return;
    }
    const cardId = cardButton.dataset.cardId;
    if (!cardId) {
      return;
    }
    const wasteCard = getWasteCard();
    if (wasteCard?.id === cardId) {
      void autoMoveToFoundation(wasteCard, { type: "waste" });
      return;
    }
    for (let column = 0; column < state.tableau.length; column += 1) {
      const index = state.tableau[column].findIndex((card) => card.id === cardId);
      if (index === -1) {
        continue;
      }
      const card = state.tableau[column][index];
      if (!card?.faceUp) {
        return;
      }
      void autoMoveToFoundation(card, { type: "tableau", column, startIndex: index });
      return;
    }
  }, { signal: abortController.signal });

  board.addEventListener("pointerdown", (event) => {
    const cardButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-id]");
    if (!cardButton || event.button !== 0) {
      return;
    }
    const cardId = cardButton.dataset.cardId;
    if (!cardId) {
      return;
    }
    startDrag(cardId, event);
  }, { signal: abortController.signal });

  window.addEventListener("pointermove", (event) => {
    updateGhostPosition(event.clientX, event.clientY);
  }, { signal: abortController.signal });

  window.addEventListener("pointerup", (event) => {
    finishDrag(event.clientX, event.clientY);
  }, { signal: abortController.signal });

  updateToolbar();
  startTimer();
  render();

  return {
    unmount() {
      abortController.abort();
      dragging?.ghost.remove();
      window.clearInterval(timerId);
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
