import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type Disc = "black" | "white" | null;
type Player = "black" | "white";

interface Move {
  row: number;
  col: number;
  flips: Array<{ row: number; col: number }>;
}

const SIZE = 8;
const OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
] as const;

function createBoard(): Disc[][] {
  const board = Array.from({ length: SIZE }, () => Array<Disc>(SIZE).fill(null));
  board[3][3] = "white";
  board[3][4] = "black";
  board[4][3] = "black";
  board[4][4] = "white";
  return board;
}

function getValidMoves(board: Disc[][], player: Player): Move[] {
  const enemy: Player = player === "black" ? "white" : "black";
  const moves: Move[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }
      const flips: Move["flips"] = [];
      for (const [dr, dc] of OFFSETS) {
        let nextRow = row + dr;
        let nextCol = col + dc;
        const line: Move["flips"] = [];
        while (board[nextRow]?.[nextCol] === enemy) {
          line.push({ row: nextRow, col: nextCol });
          nextRow += dr;
          nextCol += dc;
        }
        if (line.length > 0 && board[nextRow]?.[nextCol] === player) {
          flips.push(...line);
        }
      }
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }
  return moves;
}

function countDiscs(board: Disc[][]): Record<Player, number> {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === "black") black += 1;
      if (cell === "white") white += 1;
    }
  }
  return { black, white };
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "reversi-app",
    menuButtons: [
      { label: "Game", onClick: () => reset() },
      { label: "Help", onClick: () => shell.setStatus("Place a black disc to trap white discs between your pieces.", "Internet Reversi") }
    ],
    toolbarButtons: [
      { label: "New Game", onClick: () => reset() }
    ],
    statusLeft: "Your turn",
    statusRight: "Internet Reversi"
  });

  let board = createBoard();
  let current: Player = "black";
  let winner: string | null = null;

  shell.body.innerHTML = `
    <section class="reversi-app">
      <div class="reversi-app__score" data-score></div>
      <div class="reversi-app__board" data-board></div>
    </section>
  `;

  const scoreEl = shell.body.querySelector<HTMLElement>("[data-score]");
  const boardEl = shell.body.querySelector<HTMLElement>("[data-board]");
  if (!scoreEl || !boardEl) {
    throw new Error("Reversi failed to mount");
  }
  const scoreRoot = scoreEl;
  const boardRoot = boardEl;

  function reset(): void {
    board = createBoard();
    current = "black";
    winner = null;
    render();
  }

  function applyMove(move: Move, player: Player): void {
    board[move.row][move.col] = player;
    for (const flip of move.flips) {
      board[flip.row][flip.col] = player;
    }
  }

  function pickAiMove(moves: Move[]): Move {
    const corners = moves.filter((move) =>
      (move.row === 0 || move.row === SIZE - 1) && (move.col === 0 || move.col === SIZE - 1)
    );
    if (corners.length > 0) {
      return corners[0];
    }
    return [...moves].sort((left, right) => right.flips.length - left.flips.length)[0];
  }

  function stepTurn(): void {
    const currentMoves = getValidMoves(board, current);
    const other: Player = current === "black" ? "white" : "black";
    const otherMoves = getValidMoves(board, other);

    if (currentMoves.length === 0 && otherMoves.length === 0) {
      const score = countDiscs(board);
      winner =
        score.black === score.white ? "Draw game" : score.black > score.white ? "Black wins" : "White wins";
      shell.setStatus(winner, `${score.black} - ${score.white}`);
      render();
      return;
    }

    if (currentMoves.length === 0) {
      current = other;
      shell.setStatus(`${other === "black" ? "Your" : "Computer"} turn`, "Pass");
      render();
      if (current === "white") {
        window.setTimeout(aiMove, 450);
      }
      return;
    }

    if (current === "white") {
      window.setTimeout(aiMove, 450);
    }
  }

  function aiMove(): void {
    if (winner || current !== "white") {
      return;
    }
    const moves = getValidMoves(board, "white");
    if (moves.length === 0) {
      current = "black";
      stepTurn();
      return;
    }
    applyMove(pickAiMove(moves), "white");
    current = "black";
    render();
    stepTurn();
  }

  function render(): void {
    const score = countDiscs(board);
    const validMoves = winner || current !== "black" ? [] : getValidMoves(board, "black");
    scoreRoot.innerHTML = `
      <div><strong>Black</strong><span>${score.black}</span></div>
      <div><strong>White</strong><span>${score.white}</span></div>
      <div><strong>Status</strong><span>${winner ?? (current === "black" ? "Your turn" : "Computer thinking...")}</span></div>
    `;
    boardRoot.innerHTML = board
      .map(
        (row, rowIndex) =>
          row
            .map((cell, colIndex) => {
              const isMove = validMoves.some((move) => move.row === rowIndex && move.col === colIndex);
              return `
                <button type="button" class="reversi-app__cell" data-row="${rowIndex}" data-col="${colIndex}">
                  ${cell ? `<span class="reversi-app__disc is-${cell}"></span>` : ""}
                  ${!cell && isMove ? '<span class="reversi-app__hint-disc"></span>' : ""}
                </button>
              `;
            })
            .join("")
      )
      .join("");
    ctx.updateTitle(winner ? `${winner} - Internet Reversi` : "Internet Reversi");
  }

  boardRoot.addEventListener(
    "click",
    (event) => {
      if (winner || current !== "black") {
        return;
      }
      const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-row][data-col]");
      if (!cell) {
        return;
      }
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const move = getValidMoves(board, "black").find((entry) => entry.row === row && entry.col === col);
      if (!move) {
        return;
      }
      applyMove(move, "black");
      current = "white";
      render();
      stepTurn();
    },
    { signal: abortController.signal }
  );

  render();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      shell.root.focus();
    }
  };
}
