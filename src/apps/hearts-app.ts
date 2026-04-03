import type { AppHostContext, AppInstance } from "../types";
import {
  createDeck,
  rankLabel,
  shuffleDeck,
  suitColor,
  suitSymbol,
  type Card,
  type Suit
} from "./card-utils";
import { createXpGameShell } from "./xp-game-shell";

type HeartsPassDirection = "left" | "right" | "across" | "hold";
type HeartsPhase = "passing" | "playing" | "round-end" | "game-over";

interface HeartsPlayer {
  id: number;
  name: string;
  isHuman: boolean;
  hand: Card[];
  captured: Card[];
}

interface HeartsTrickCard {
  playerIndex: number;
  card: Card;
}

interface HeartsState {
  roundNumber: number;
  phase: HeartsPhase;
  passDirection: HeartsPassDirection;
  players: HeartsPlayer[];
  currentPlayer: number;
  leadSuit: Suit | null;
  trick: HeartsTrickCard[];
  heartsBroken: boolean;
  scores: number[];
  roundPoints: number[];
  selectedPassIds: string[];
  statusMessage: string;
}

const PASS_ROTATION: HeartsPassDirection[] = ["left", "right", "across", "hold"];
const SUIT_ORDER: Suit[] = ["clubs", "diamonds", "spades", "hearts"];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "hearts-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => resetMatch() },
      { label: "Round", title: "New Round", onClick: () => startRound(state.roundNumber) },
      { label: "Help", title: "Hearts", onClick: () => setHint("Avoid hearts and the queen of spades unless you can safely shoot the moon.") }
    ],
    statusLeft: "Hearts",
    statusRight: "Windows XP Hearts"
  });

  const board = document.createElement("div");
  board.className = "hearts-table";
  shell.body.appendChild(board);

  const hint = document.createElement("div");
  hint.className = "card-game__hint";
  shell.body.appendChild(hint);

  let state = createInitialState();

  function createInitialState(): HeartsState {
    return {
      roundNumber: 0,
      phase: "passing",
      passDirection: "left",
      players: [],
      currentPlayer: 0,
      leadSuit: null,
      trick: [],
      heartsBroken: false,
      scores: [0, 0, 0, 0],
      roundPoints: [0, 0, 0, 0],
      selectedPassIds: [],
      statusMessage: "Prepare to pass cards."
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

  function sortHand(cards: Card[]): Card[] {
    return [...cards].sort((left, right) => {
      const suitDelta = SUIT_ORDER.indexOf(left.suit) - SUIT_ORDER.indexOf(right.suit);
      if (suitDelta !== 0) {
        return suitDelta;
      }
      return left.rank - right.rank;
    });
  }

  function getPassDirection(roundNumber: number): HeartsPassDirection {
    return PASS_ROTATION[(roundNumber - 1) % PASS_ROTATION.length] ?? "left";
  }

  function dealPlayers(roundNumber: number, scores: number[]): HeartsState {
    const deck = shuffleDeck(createDeck());
    const players: HeartsPlayer[] = [
      { id: 0, name: "You", isHuman: true, hand: [], captured: [] },
      { id: 1, name: "North", isHuman: false, hand: [], captured: [] },
      { id: 2, name: "East", isHuman: false, hand: [], captured: [] },
      { id: 3, name: "West", isHuman: false, hand: [], captured: [] }
    ];

    deck.forEach((card, index) => {
      card.faceUp = players[index % 4].isHuman;
      players[index % 4].hand.push(card);
    });
    for (const player of players) {
      player.hand = sortHand(player.hand);
    }

    const currentPlayer = players.findIndex((player) =>
      player.hand.some((card) => card.suit === "clubs" && card.rank === 2)
    );
    const passDirection = getPassDirection(roundNumber);

    return {
      roundNumber,
      phase: passDirection === "hold" ? "playing" : "passing",
      passDirection,
      players,
      currentPlayer: Math.max(0, currentPlayer),
      leadSuit: null,
      trick: [],
      heartsBroken: false,
      scores: [...scores],
      roundPoints: [0, 0, 0, 0],
      selectedPassIds: [],
      statusMessage:
        passDirection === "hold"
          ? "Hold round. Two of clubs leads."
          : `Select 3 cards to pass ${passDirection}.`
    };
  }

  function resetMatch(): void {
    state = createInitialState();
    startRound(1);
  }

  function startRound(roundNumber: number): void {
    state = dealPlayers(roundNumber, state.scores);
    updateToolbar();
    render();
    if (state.phase === "passing") {
      applyAiPassSelections();
    } else {
      playAiTurns();
    }
  }

  function updateToolbar(): void {
    shell.setToolbar([
      { label: "New Game", onClick: () => resetMatch() },
      {
        label:
          state.phase === "passing"
            ? `Pass ${state.selectedPassIds.length}/3`
            : state.phase === "round-end"
              ? "Next Round"
              : "Scores",
        onClick: () => {
          if (state.phase === "passing" && state.selectedPassIds.length === 3) {
            resolvePassPhase();
          } else if (state.phase === "round-end") {
            startRound(state.roundNumber + 1);
          } else if (state.phase === "game-over") {
            resetMatch();
          }
        },
        active:
          (state.phase === "passing" && state.selectedPassIds.length === 3) ||
          state.phase === "round-end" ||
          state.phase === "game-over"
      }
    ]);
    shell.setStatus(state.statusMessage, `Round ${state.roundNumber} · ${state.passDirection}`);
  }

  function passTarget(from: number, direction: HeartsPassDirection): number {
    if (direction === "left") {
      return (from + 3) % 4;
    }
    if (direction === "right") {
      return (from + 1) % 4;
    }
    if (direction === "across") {
      return (from + 2) % 4;
    }
    return from;
  }

  function applyAiPassSelections(): void {
    if (state.phase !== "passing") {
      return;
    }
    for (const player of state.players) {
      if (player.isHuman) {
        continue;
      }
      (player as HeartsPlayer & { pendingPass?: string[] }).pendingPass = choosePassCards(player.hand).map((card) => card.id);
    }
  }

  function choosePassCards(hand: Card[]): Card[] {
    return [...hand]
      .sort((left, right) => {
        const leftScore = (left.suit === "spades" && left.rank === 12 ? 50 : 0) + (left.suit === "hearts" ? 20 : 0) + left.rank;
        const rightScore = (right.suit === "spades" && right.rank === 12 ? 50 : 0) + (right.suit === "hearts" ? 20 : 0) + right.rank;
        return rightScore - leftScore;
      })
      .slice(0, 3);
  }

  function resolvePassPhase(): void {
    if (state.phase !== "passing" || state.selectedPassIds.length !== 3) {
      return;
    }
    const pendingByPlayer = new Map<number, Card[]>();
    for (const player of state.players) {
      const ids = player.isHuman
        ? state.selectedPassIds
        : ((player as HeartsPlayer & { pendingPass?: string[] }).pendingPass ?? []);
      pendingByPlayer.set(
        player.id,
        ids
          .map((id) => player.hand.find((card) => card.id === id))
          .filter((card): card is Card => Boolean(card))
      );
      player.hand = player.hand.filter((card) => !ids.includes(card.id));
    }

    for (const player of state.players) {
      const passed = pendingByPlayer.get(player.id) ?? [];
      const target = state.players[passTarget(player.id, state.passDirection)];
      target.hand.push(...passed.map((card) => ({ ...card, faceUp: target.isHuman })));
      target.hand = sortHand(target.hand);
      delete (player as HeartsPlayer & { pendingPass?: string[] }).pendingPass;
    }

    state.phase = "playing";
    state.selectedPassIds = [];
    state.statusMessage = "Pass complete. Two of clubs leads.";
    updateToolbar();
    render();
    playAiTurns();
  }

  function getLegalCards(playerIndex: number): Card[] {
    const player = state.players[playerIndex];
    const hand = player.hand;
    if (hand.length === 0) {
      return [];
    }
    const isFirstTrick = hand.length === 13 && state.trick.length === 0;
    if (state.trick.length === 0) {
      if (isFirstTrick) {
        return hand.filter((card) => card.suit === "clubs" && card.rank === 2);
      }
      const nonHearts = hand.filter((card) => card.suit !== "hearts");
      if (!state.heartsBroken && nonHearts.length > 0) {
        return nonHearts;
      }
      return hand;
    }

    const leadSuit = state.leadSuit;
    const matchingSuit = hand.filter((card) => card.suit === leadSuit);
    if (matchingSuit.length > 0) {
      return matchingSuit;
    }
    if (isFirstTrick) {
      const safe = hand.filter((card) => card.suit !== "hearts" && !(card.suit === "spades" && card.rank === 12));
      if (safe.length > 0) {
        return safe;
      }
    }
    return hand;
  }

  function playCard(playerIndex: number, cardId: string): void {
    const player = state.players[playerIndex];
    const legalCards = getLegalCards(playerIndex);
    const card = player.hand.find((item) => item.id === cardId);
    if (!card || !legalCards.some((item) => item.id === cardId)) {
      return;
    }

    player.hand = player.hand.filter((item) => item.id !== cardId);
    player.hand = sortHand(player.hand);
    state.trick.push({ playerIndex, card: { ...card, faceUp: true } });

    if (state.trick.length === 1) {
      state.leadSuit = card.suit;
    }
    if (card.suit === "hearts") {
      state.heartsBroken = true;
    }

    if (state.trick.length === 4) {
      resolveTrick();
    } else {
      state.currentPlayer = (playerIndex + 1) % 4;
      state.statusMessage = state.players[state.currentPlayer].isHuman
        ? "Your turn."
        : `${state.players[state.currentPlayer].name} is thinking...`;
    }

    updateToolbar();
    render();
  }

  function resolveTrick(): void {
    const leadSuit = state.leadSuit;
    const leadCards = state.trick.filter((entry) => entry.card.suit === leadSuit);
    const winner = leadCards.reduce((best, current) => (current.card.rank > best.card.rank ? current : best));
    state.players[winner.playerIndex].captured.push(...state.trick.map((entry) => entry.card));
    state.currentPlayer = winner.playerIndex;
    state.trick = [];
    state.leadSuit = null;
    state.statusMessage = `${state.players[winner.playerIndex].name} took the trick.`;

    if (state.players.every((player) => player.hand.length === 0)) {
      finishRound();
    }
  }

  function scoreCaptured(cards: Card[]): number {
    return cards.reduce((total, card) => {
      if (card.suit === "hearts") {
        return total + 1;
      }
      if (card.suit === "spades" && card.rank === 12) {
        return total + 13;
      }
      return total;
    }, 0);
  }

  function finishRound(): void {
    state.roundPoints = state.players.map((player) => scoreCaptured(player.captured));
    const moonShooter = state.roundPoints.findIndex((points) => points === 26);
    if (moonShooter >= 0) {
      state.scores = state.scores.map((score, index) => (index === moonShooter ? score : score + 26));
      state.statusMessage = `${state.players[moonShooter].name} shot the moon.`;
    } else {
      state.scores = state.scores.map((score, index) => score + state.roundPoints[index]);
      state.statusMessage = `Round ${state.roundNumber} complete.`;
    }
    state.phase = state.scores.some((score) => score >= 100) ? "game-over" : "round-end";
    if (state.phase === "game-over") {
      const winnerIndex = state.scores.reduce((best, score, index, scores) => (score < scores[best] ? index : best), 0);
      state.statusMessage = `${state.players[winnerIndex].name} wins the match.`;
    }
    updateToolbar();
    render();
  }

  function pickAiCard(playerIndex: number): Card | null {
    const legalCards = getLegalCards(playerIndex);
    if (legalCards.length === 0) {
      return null;
    }

    if (state.trick.length === 0) {
      const safeLead = legalCards.filter((card) => card.suit !== "hearts");
      return safeLead[0] ?? legalCards[0];
    }

    const leadSuit = state.leadSuit;
    const trickLeadCards = state.trick.filter((entry) => entry.card.suit === leadSuit);
    const highestRank = trickLeadCards.reduce((best, entry) => Math.max(best, entry.card.rank), 0);
    const suitCards = legalCards.filter((card) => card.suit === leadSuit);
    if (suitCards.length > 0) {
      const lower = suitCards.filter((card) => card.rank < highestRank);
      return lower.sort((left, right) => right.rank - left.rank)[0] ?? suitCards[0];
    }

    return [...legalCards].sort((left, right) => {
      const leftPenalty = (left.suit === "spades" && left.rank === 12 ? 40 : 0) + (left.suit === "hearts" ? 10 : 0) + left.rank / 14;
      const rightPenalty = (right.suit === "spades" && right.rank === 12 ? 40 : 0) + (right.suit === "hearts" ? 10 : 0) + right.rank / 14;
      return rightPenalty - leftPenalty;
    })[0];
  }

  function playAiTurns(): void {
    while (state.phase === "playing" && !state.players[state.currentPlayer].isHuman) {
      const choice = pickAiCard(state.currentPlayer);
      if (!choice) {
        break;
      }
      playCard(state.currentPlayer, choice.id);
      if (state.phase !== "playing") {
        return;
      }
    }
    updateToolbar();
    render();
  }

  function renderOpponentFan(count: number): string {
    const cards = Array.from({ length: count }, (_, index) => `<span class="hearts-table__fan-card" style="left:${index * 10}px"></span>`).join("");
    return `<div class="hearts-table__fan" style="width:${Math.max(40, count * 10 + 42)}px">${cards}</div>`;
  }

  function renderHumanCard(card: Card, playable: boolean, selected: boolean): string {
    return `
      <button
        type="button"
        class="xp-card ${suitColor(card.suit) === "red" ? "xp-card--red" : "xp-card--black"} hearts-card${playable ? " is-playable" : ""}${selected ? " is-selected" : ""}"
        data-hearts-card="${card.id}"
      >
        <span class="xp-card__corner">${rankLabel(card.rank)}${suitSymbol(card.suit)}</span>
        <span class="xp-card__center">${suitSymbol(card.suit)}</span>
      </button>
    `;
  }

  function render(): void {
    const humanLegal = state.phase === "playing" && state.players[state.currentPlayer].isHuman
      ? new Set(getLegalCards(0).map((card) => card.id))
      : new Set<string>();
    board.innerHTML = `
      <div class="hearts-table__scoreboard">
        ${state.players
          .map(
            (player, index) => `
              <div class="hearts-table__score${state.currentPlayer === index && state.phase === "playing" ? " is-active" : ""}">
                <strong>${player.name}</strong>
                <span>${state.scores[index]} pts</span>
                <em>Round ${state.roundPoints[index]} · Tricks ${player.captured.length / 4}</em>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="hearts-table__layout">
        <div class="hearts-table__north">
          <strong>North</strong>
          ${renderOpponentFan(state.players[1]?.hand.length ?? 0)}
        </div>
        <div class="hearts-table__west">
          <strong>West</strong>
          <span>${state.players[3]?.hand.length ?? 0} cards</span>
        </div>
        <div class="hearts-table__center">
          <div class="hearts-table__trick">
            ${state.trick
              .map(
                (entry) => `
                  <div class="hearts-table__trick-card hearts-table__trick-card--${entry.playerIndex}">
                    <div class="xp-card ${suitColor(entry.card.suit) === "red" ? "xp-card--red" : "xp-card--black"}">
                      <span class="xp-card__corner">${rankLabel(entry.card.rank)}${suitSymbol(entry.card.suit)}</span>
                      <span class="xp-card__center">${suitSymbol(entry.card.suit)}</span>
                    </div>
                    <span>${state.players[entry.playerIndex].name}</span>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="hearts-table__meta">
            <span>${state.statusMessage}</span>
            <span>${state.heartsBroken ? "Hearts broken" : "Hearts closed"} · Pass ${state.passDirection}</span>
          </div>
        </div>
        <div class="hearts-table__east">
          <strong>East</strong>
          <span>${state.players[2]?.hand.length ?? 0} cards</span>
        </div>
        <div class="hearts-table__south">
          <div class="hearts-table__hand">
            ${state.players[0]?.hand
              .map((card) =>
                renderHumanCard(
                  card,
                  humanLegal.has(card.id) || (state.phase === "passing" && state.players[0].hand.length > 0),
                  state.selectedPassIds.includes(card.id)
                )
              )
              .join("")}
          </div>
          <div class="hearts-table__controls">
            ${
              state.phase === "passing"
                ? `<button type="button" data-hearts-pass ${state.selectedPassIds.length === 3 ? "" : "disabled"}>Pass 3 Cards</button>`
                : state.phase === "round-end"
                  ? `<button type="button" data-hearts-next-round>Start Next Round</button>`
                  : state.phase === "game-over"
                    ? `<button type="button" data-hearts-new-game>New Match</button>`
                    : `<span>${state.players[state.currentPlayer].isHuman ? "Your move" : "Waiting..."}</span>`
            }
          </div>
        </div>
      </div>
    `;
  }

  board.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest("[data-hearts-pass]")) {
      resolvePassPhase();
      return;
    }
    if (target.closest("[data-hearts-next-round]")) {
      startRound(state.roundNumber + 1);
      return;
    }
    if (target.closest("[data-hearts-new-game]")) {
      resetMatch();
      return;
    }

    const cardButton = target.closest<HTMLElement>("[data-hearts-card]");
    const cardId = cardButton?.dataset.heartsCard;
    if (!cardId) {
      return;
    }

    if (state.phase === "passing") {
      const alreadySelected = state.selectedPassIds.includes(cardId);
      if (alreadySelected) {
        state.selectedPassIds = state.selectedPassIds.filter((id) => id !== cardId);
      } else if (state.selectedPassIds.length < 3) {
        state.selectedPassIds = [...state.selectedPassIds, cardId];
      }
      state.statusMessage = `Select 3 cards to pass ${state.passDirection}.`;
      updateToolbar();
      render();
      return;
    }

    if (state.phase === "playing" && state.players[state.currentPlayer].isHuman) {
      playCard(0, cardId);
      if (state.phase === "playing") {
        playAiTurns();
      }
    }
  }, { signal: abortController.signal });

  startRound(1);

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
