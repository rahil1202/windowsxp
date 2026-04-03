import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type PieceColor = "red" | "black";

interface Piece {
  id: string;
  color: PieceColor;
  king: boolean;
}

interface CheckersMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  captures: Array<{ row: number; col: number }>;
}

interface CheckersState {
  board: Array<Array<Piece | null>>;
  currentTurn: PieceColor;
  selected: { row: number; col: number } | null;
  legalMoves: CheckersMove[];
  winner: PieceColor | "draw" | null;
  status: string;
  noCaptureTurns: number;
}

const BOARD_SIZE = 8;

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "checkers-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => newGame() },
      { label: "Help", title: "Checkers", onClick: () => setHint("Red moves first. Captures are mandatory. Click a piece, then a highlighted square.") }
    ],
    statusLeft: "Checkers",
    statusRight: "Windows XP Checkers"
  });

  const board = document.createElement("div");
  board.className = "checkers-app__root";
  shell.body.appendChild(board);

  const hint = document.createElement("div");
  hint.className = "card-game__hint";
  shell.body.appendChild(hint);

  let state = createState();

  function updateToolbar(): void {
    shell.setToolbar([{ label: "New Game", onClick: () => newGame() }]);
  }

  function createState(): CheckersState {
    const boardData: Array<Array<Piece | null>> = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
    let nextId = 1;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if ((row + col) % 2 === 1) {
          boardData[row][col] = { id: `black-${nextId++}`, color: "black", king: false };
        }
      }
    }
    for (let row = 5; row < 8; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if ((row + col) % 2 === 1) {
          boardData[row][col] = { id: `red-${nextId++}`, color: "red", king: false };
        }
      }
    }
    return {
      board: boardData,
      currentTurn: "red",
      selected: null,
      legalMoves: [],
      winner: null,
      status: "Your move.",
      noCaptureTurns: 0
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

  function newGame(): void {
    state = createState();
    updateToolbar();
    shell.setStatus("Red to move", "Mandatory captures enabled");
    render();
  }

  function insideBoard(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function directionsFor(piece: Piece): Array<[number, number]> {
    if (piece.king) {
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ];
    }
    return piece.color === "red"
      ? [
          [-1, -1],
          [-1, 1]
        ]
      : [
          [1, -1],
          [1, 1]
        ];
  }

  function cloneBoard(boardData: Array<Array<Piece | null>>): Array<Array<Piece | null>> {
    return boardData.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function captureSequences(
    boardData: Array<Array<Piece | null>>,
    row: number,
    col: number,
    piece: Piece,
    origin: { row: number; col: number },
    captured: Array<{ row: number; col: number }> = []
  ): CheckersMove[] {
    const sequences: CheckersMove[] = [];
    let extended = false;
    for (const [dirRow, dirCol] of directionsFor(piece)) {
      const enemyRow = row + dirRow;
      const enemyCol = col + dirCol;
      const landingRow = row + dirRow * 2;
      const landingCol = col + dirCol * 2;
      if (!insideBoard(enemyRow, enemyCol) || !insideBoard(landingRow, landingCol)) {
        continue;
      }
      const enemy = boardData[enemyRow][enemyCol];
      if (!enemy || enemy.color === piece.color || boardData[landingRow][landingCol] !== null) {
        continue;
      }

      extended = true;
      const nextBoard = cloneBoard(boardData);
      const movingPiece = nextBoard[row][col];
      nextBoard[row][col] = null;
      nextBoard[enemyRow][enemyCol] = null;
      if (!movingPiece) {
        continue;
      }
      const promoted =
        !movingPiece.king &&
        ((movingPiece.color === "red" && landingRow === 0) ||
          (movingPiece.color === "black" && landingRow === BOARD_SIZE - 1));
      nextBoard[landingRow][landingCol] = { ...movingPiece, king: movingPiece.king || promoted };

      const continuations = captureSequences(
        nextBoard,
        landingRow,
        landingCol,
        nextBoard[landingRow][landingCol]!,
        origin,
        [...captured, { row: enemyRow, col: enemyCol }]
      );
      if (continuations.length > 0) {
        sequences.push(...continuations);
      } else {
        sequences.push({
          fromRow: origin.row,
          fromCol: origin.col,
          toRow: landingRow,
          toCol: landingCol,
          captures: [...captured, { row: enemyRow, col: enemyCol }]
        });
      }
    }

    if (!extended && captured.length > 0) {
      return [
        {
          fromRow: origin.row,
          fromCol: origin.col,
          toRow: row,
          toCol: col,
          captures: [...captured]
        }
      ];
    }

    return sequences;
  }

  function generateMoves(color: PieceColor): CheckersMove[] {
    const captures: CheckersMove[] = [];
    const simple: CheckersMove[] = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const piece = state.board[row][col];
        if (!piece || piece.color !== color) {
          continue;
        }

        const pieceCaptures = captureSequences(state.board, row, col, piece, { row, col }).filter(
          (move) => move.captures.length > 0
        );
        captures.push(...pieceCaptures);

        if (pieceCaptures.length === 0) {
          for (const [dirRow, dirCol] of directionsFor(piece)) {
            const nextRow = row + dirRow;
            const nextCol = col + dirCol;
            if (!insideBoard(nextRow, nextCol) || state.board[nextRow][nextCol] !== null) {
              continue;
            }
            simple.push({
              fromRow: row,
              fromCol: col,
              toRow: nextRow,
              toCol: nextCol,
              captures: []
            });
          }
        }
      }
    }

    return captures.length > 0 ? captures : simple;
  }

  function applyMove(move: CheckersMove): void {
    const piece = state.board[move.fromRow][move.fromCol];
    if (!piece) {
      return;
    }
    state.board[move.fromRow][move.fromCol] = null;
    for (const capture of move.captures) {
      state.board[capture.row][capture.col] = null;
    }
    const promoted =
      !piece.king &&
      ((piece.color === "red" && move.toRow === 0) ||
        (piece.color === "black" && move.toRow === BOARD_SIZE - 1));
    state.board[move.toRow][move.toCol] = { ...piece, king: piece.king || promoted };

    state.noCaptureTurns = move.captures.length > 0 ? 0 : state.noCaptureTurns + 1;
    const nextTurn: PieceColor = piece.color === "red" ? "black" : "red";
    const nextMoves = generateMoves(nextTurn);
    if (nextMoves.length === 0) {
      state.winner = piece.color;
      state.status = `${piece.color === "red" ? "You" : "Black"} win.`;
      state.selected = null;
      state.legalMoves = [];
      updateToolbar();
      render();
      return;
    }
    if (state.noCaptureTurns >= 40) {
      state.winner = "draw";
      state.status = "Draw game.";
      state.selected = null;
      state.legalMoves = [];
      updateToolbar();
      render();
      return;
    }

    state.currentTurn = nextTurn;
    state.selected = null;
    state.legalMoves = [];
    state.status = nextTurn === "red" ? "Your move." : "Black is thinking...";
    shell.setStatus(nextTurn === "red" ? "Red to move" : "Black to move", move.captures.length > 0 ? "Capture made" : "Quiet move");
    render();

    if (nextTurn === "black") {
      runAiTurn();
    }
  }

  function runAiTurn(): void {
    if (state.winner || state.currentTurn !== "black") {
      return;
    }
    const moves = generateMoves("black");
    if (moves.length === 0) {
      state.winner = "red";
      state.status = "You win.";
      render();
      return;
    }
    const ranked = [...moves].sort((left, right) => {
      if (right.captures.length !== left.captures.length) {
        return right.captures.length - left.captures.length;
      }
      const leftPromote = left.toRow === BOARD_SIZE - 1 ? 1 : 0;
      const rightPromote = right.toRow === BOARD_SIZE - 1 ? 1 : 0;
      return rightPromote - leftPromote;
    });
    applyMove(ranked[0]);
  }

  function render(): void {
    const availableMoves = state.currentTurn === "red" && !state.winner ? generateMoves("red") : [];
    const selectedMoves = state.selected
      ? availableMoves.filter((move) => move.fromRow === state.selected!.row && move.fromCol === state.selected!.col)
      : [];
    board.innerHTML = `
      <div class="checkers-app__header">
        <div>
          <strong>${state.status}</strong>
          <span>Mandatory captures are ${availableMoves.some((move) => move.captures.length > 0) ? "active" : "clear"}.</span>
        </div>
        <button type="button" data-checkers-new>New Game</button>
      </div>
      <div class="checkers-app__board">
        ${state.board
          .map((row, rowIndex) =>
            row
              .map((piece, colIndex) => {
                const dark = (rowIndex + colIndex) % 2 === 1;
                const isSelected = state.selected?.row === rowIndex && state.selected?.col === colIndex;
                const targetMove = selectedMoves.find((move) => move.toRow === rowIndex && move.toCol === colIndex);
                return `
                  <button
                    type="button"
                    class="checkers-app__square${dark ? " is-dark" : ""}${isSelected ? " is-selected" : ""}${targetMove ? " is-target" : ""}"
                    data-checkers-row="${rowIndex}"
                    data-checkers-col="${colIndex}"
                  >
                    ${
                      piece
                        ? `<span class="checkers-app__piece checkers-app__piece--${piece.color}${piece.king ? " is-king" : ""}"></span>`
                        : targetMove
                          ? '<span class="checkers-app__target-dot"></span>'
                          : ""
                    }
                  </button>
                `;
              })
              .join("")
          )
          .join("")}
      </div>
    `;
  }

  board.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest("[data-checkers-new]")) {
      newGame();
      return;
    }
    if (state.currentTurn !== "red" || state.winner) {
      return;
    }

    const square = target.closest<HTMLElement>("[data-checkers-row]");
    if (!square) {
      return;
    }
    const row = Number(square.dataset.checkersRow);
    const col = Number(square.dataset.checkersCol);
    const piece = state.board[row][col];
    const moves = generateMoves("red");

    if (piece?.color === "red") {
      const pieceMoves = moves.filter((move) => move.fromRow === row && move.fromCol === col);
      if (pieceMoves.length > 0) {
        state.selected = { row, col };
        state.legalMoves = pieceMoves;
        render();
      }
      return;
    }

    if (state.selected) {
      const move = moves.find(
        (candidate) =>
          candidate.fromRow === state.selected!.row &&
          candidate.fromCol === state.selected!.col &&
          candidate.toRow === row &&
          candidate.toCol === col
      );
      if (move) {
        applyMove(move);
      }
    }
  }, { signal: abortController.signal });

  newGame();

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
