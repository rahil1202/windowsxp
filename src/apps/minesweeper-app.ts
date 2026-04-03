import { loadShellPreferences, saveShellPreferences } from "../storage";
import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type DifficultyPreset = "beginner" | "intermediate" | "expert";
type CellMark = "blank" | "flag" | "question";

interface DifficultyConfig {
  cols: number;
  rows: number;
  mines: number;
}

interface CellState {
  mine: boolean;
  revealed: boolean;
  adjacent: number;
  mark: CellMark;
}

interface MinesweeperState {
  difficulty: DifficultyPreset;
  config: DifficultyConfig;
  board: CellState[][];
  generated: boolean;
  face: "smile" | "shock" | "lose" | "win";
  status: "idle" | "playing" | "lost" | "won";
  elapsed: number;
  minesLeft: number;
}

const DIFFICULTY_CONFIGS: Record<DifficultyPreset, DifficultyConfig> = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 }
};

const ADJACENT_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1]
] as const;

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const shellPrefs = loadShellPreferences();
  const shell = createXpGameShell(host, {
    className: "minesweeper-app",
    menuButtons: [
      { label: "Game", title: "New Game", onClick: () => restart(state.difficulty) },
      { label: "Help", title: "Minesweeper", onClick: () => showHint("Clear every safe square. Right-click cycles flag and question marks.") }
    ],
    statusLeft: "Ready",
    statusRight: "Classic XP Minesweeper"
  });

  const boardWrapper = document.createElement("div");
  boardWrapper.className = "minesweeper";
  shell.body.appendChild(boardWrapper);

  const statusHint = document.createElement("div");
  statusHint.className = "minesweeper__hint";
  shell.body.appendChild(statusHint);

  const bestTimes = document.createElement("div");
  bestTimes.className = "minesweeper__scores";
  shell.body.appendChild(bestTimes);

  let timerId = 0;
  let state = createState("beginner");

  function createState(difficulty: DifficultyPreset): MinesweeperState {
    const config = DIFFICULTY_CONFIGS[difficulty];
    return {
      difficulty,
      config,
      board: createBlankBoard(config),
      generated: false,
      face: "smile",
      status: "idle",
      elapsed: 0,
      minesLeft: config.mines
    };
  }

  function createBlankBoard(config: DifficultyConfig): CellState[][] {
    return Array.from({ length: config.rows }, () =>
      Array.from({ length: config.cols }, () => ({
        mine: false,
        revealed: false,
        adjacent: 0,
        mark: "blank"
      }))
    );
  }

  function showHint(message: string): void {
    statusHint.textContent = message;
    window.clearTimeout(Number(statusHint.dataset.timerId ?? "0"));
    const timeout = window.setTimeout(() => {
      statusHint.textContent = "";
    }, 2600);
    statusHint.dataset.timerId = String(timeout);
  }

  function restart(difficulty: DifficultyPreset): void {
    window.clearInterval(timerId);
    state = createState(difficulty);
    shell.setToolbar([
      { label: "Beginner", onClick: () => restart("beginner"), active: difficulty === "beginner" },
      { label: "Intermediate", onClick: () => restart("intermediate"), active: difficulty === "intermediate" },
      { label: "Expert", onClick: () => restart("expert"), active: difficulty === "expert" },
      { label: "Hint", onClick: () => revealSafeCell() },
      { label: "Flag Mine", onClick: () => flagLikelyMine() }
    ]);
    shell.setStatus("Ready", `${DIFFICULTY_CONFIGS[difficulty].mines} mines`);
    render();
  }

  function startTimer(): void {
    if (timerId !== 0) {
      return;
    }
    timerId = window.setInterval(() => {
      state.elapsed += 1;
      renderHeader();
    }, 1000);
  }

  function stopTimer(): void {
    window.clearInterval(timerId);
    timerId = 0;
  }

  function generateBoard(firstCol: number, firstRow: number): void {
    const positions: Array<[number, number]> = [];
    for (let row = 0; row < state.config.rows; row += 1) {
      for (let col = 0; col < state.config.cols; col += 1) {
        if (Math.abs(col - firstCol) <= 1 && Math.abs(row - firstRow) <= 1) {
          continue;
        }
        positions.push([col, row]);
      }
    }
    for (let index = positions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = positions[index];
      positions[index] = positions[swapIndex];
      positions[swapIndex] = temp;
    }
    for (let mineIndex = 0; mineIndex < state.config.mines; mineIndex += 1) {
      const position = positions[mineIndex];
      if (!position) {
        continue;
      }
      const [col, row] = position;
      state.board[row][col].mine = true;
    }
    for (let row = 0; row < state.config.rows; row += 1) {
      for (let col = 0; col < state.config.cols; col += 1) {
        const cell = state.board[row][col];
        cell.adjacent = countAdjacentMines(col, row);
      }
    }
    state.generated = true;
  }

  function countAdjacentMines(col: number, row: number): number {
    let total = 0;
    for (const [offsetX, offsetY] of ADJACENT_OFFSETS) {
      const target = state.board[row + offsetY]?.[col + offsetX];
      if (target?.mine) {
        total += 1;
      }
    }
    return total;
  }

  function revealCell(col: number, row: number): void {
    if (state.status === "lost" || state.status === "won") {
      return;
    }
    const cell = state.board[row]?.[col];
    if (!cell || cell.revealed || cell.mark === "flag") {
      return;
    }

    if (!state.generated) {
      generateBoard(col, row);
      state.status = "playing";
      startTimer();
    }

    cell.revealed = true;
    cell.mark = "blank";
    state.face = "smile";

    if (cell.mine) {
      state.status = "lost";
      state.face = "lose";
      revealAllMines();
      stopTimer();
      shell.setStatus("Boom", "Game Over");
      render();
      return;
    }

    if (cell.adjacent === 0) {
      const queue: Array<[number, number]> = [[col, row]];
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) {
          continue;
        }
        const [nextCol, nextRow] = next;
        for (const [offsetX, offsetY] of ADJACENT_OFFSETS) {
          const targetCol = nextCol + offsetX;
          const targetRow = nextRow + offsetY;
          const target = state.board[targetRow]?.[targetCol];
          if (!target || target.revealed || target.mark === "flag") {
            continue;
          }
          target.revealed = true;
          target.mark = "blank";
          if (!target.mine && target.adjacent === 0) {
            queue.push([targetCol, targetRow]);
          }
        }
      }
    }

    if (checkWin()) {
      state.status = "won";
      state.face = "win";
      state.minesLeft = 0;
      stopTimer();
      flagHiddenMines();
      updateBestTimes();
      shell.setStatus("You won", "All mines found");
    } else {
      shell.setStatus("Sweeping", `${state.minesLeft} mines left`);
    }
    render();
  }

  function revealAllMines(): void {
    for (const row of state.board) {
      for (const cell of row) {
        if (cell.mine) {
          cell.revealed = true;
        }
      }
    }
  }

  function flagHiddenMines(): void {
    for (const row of state.board) {
      for (const cell of row) {
        if (cell.mine && !cell.revealed) {
          cell.mark = "flag";
        }
      }
    }
  }

  function revealSafeCell(): void {
    const candidates: Array<[number, number]> = [];
    for (let row = 0; row < state.config.rows; row += 1) {
      for (let col = 0; col < state.config.cols; col += 1) {
        const cell = state.board[row][col];
        if (!cell.mine && !cell.revealed && cell.mark !== "flag") {
          candidates.push([col, row]);
        }
      }
    }
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (!choice) {
      showHint("No safe-cell hint available.");
      return;
    }
    revealCell(choice[0], choice[1]);
    showHint("Cheat used: one safe square revealed.");
  }

  function flagLikelyMine(): void {
    if (!state.generated) {
      showHint("Start the game before using the mine flag helper.");
      return;
    }
    const candidates: Array<[number, number]> = [];
    for (let row = 0; row < state.config.rows; row += 1) {
      for (let col = 0; col < state.config.cols; col += 1) {
        const cell = state.board[row][col];
        if (cell.mine && !cell.revealed && cell.mark !== "flag") {
          candidates.push([col, row]);
        }
      }
    }
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    if (!choice) {
      showHint("No hidden mine left to flag.");
      return;
    }
    cycleMark(choice[0], choice[1]);
    showHint("Cheat used: one hidden mine flagged.");
  }

  function checkWin(): boolean {
    let revealedSafeCells = 0;
    for (const row of state.board) {
      for (const cell of row) {
        if (!cell.mine && cell.revealed) {
          revealedSafeCells += 1;
        }
      }
    }
    return revealedSafeCells === state.config.cols * state.config.rows - state.config.mines;
  }

  function cycleMark(col: number, row: number): void {
    if (state.status === "lost" || state.status === "won") {
      return;
    }
    const cell = state.board[row]?.[col];
    if (!cell || cell.revealed) {
      return;
    }
    if (cell.mark === "blank") {
      cell.mark = "flag";
      state.minesLeft -= 1;
    } else if (cell.mark === "flag") {
      cell.mark = "question";
      state.minesLeft += 1;
    } else {
      cell.mark = "blank";
    }
    shell.setStatus("Marking", `${state.minesLeft} mines left`);
    render();
  }

  function renderHeader(): void {
    const counter = boardWrapper.querySelector<HTMLElement>("[data-mines-counter]");
    const timer = boardWrapper.querySelector<HTMLElement>("[data-timer-counter]");
    const face = boardWrapper.querySelector<HTMLElement>("[data-face-button]");
    if (counter) {
      counter.textContent = String(Math.max(-99, state.minesLeft)).padStart(3, "0");
    }
    if (timer) {
      timer.textContent = String(Math.min(999, state.elapsed)).padStart(3, "0");
    }
    if (face) {
      face.textContent = state.face === "win" ? "😎" : state.face === "lose" ? "😵" : state.face === "shock" ? "😮" : "🙂";
    }
  }

  function render(): void {
    boardWrapper.innerHTML = `
      <div class="minesweeper__panel">
        <div class="minesweeper__header">
          <span class="minesweeper__digits" data-mines-counter>${String(Math.max(-99, state.minesLeft)).padStart(3, "0")}</span>
          <button type="button" class="minesweeper__face" data-face-button>${state.face === "win" ? "😎" : state.face === "lose" ? "😵" : state.face === "shock" ? "😮" : "🙂"}</button>
          <span class="minesweeper__digits" data-timer-counter>${String(Math.min(999, state.elapsed)).padStart(3, "0")}</span>
        </div>
        <div
          class="minesweeper__board"
          style="grid-template-columns:repeat(${state.config.cols}, minmax(16px, 1fr))"
        >
          ${state.board
            .flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => renderCell(cell, colIndex, rowIndex))
            )
            .join("")}
        </div>
      </div>
    `;

    renderHeader();
    renderBestTimes();
  }

  function renderBestTimes(): void {
    const scores = shellPrefs.minesweeperBestTimes;
    bestTimes.innerHTML = `
      <strong>Best Times</strong>
      <span>Beginner: ${scores.beginner ?? "--"}s</span>
      <span>Intermediate: ${scores.intermediate ?? "--"}s</span>
      <span>Expert: ${scores.expert ?? "--"}s</span>
    `;
  }

  function updateBestTimes(): void {
    const currentBest = shellPrefs.minesweeperBestTimes[state.difficulty];
    if (currentBest === null || state.elapsed < currentBest) {
      shellPrefs.minesweeperBestTimes[state.difficulty] = state.elapsed;
      saveShellPreferences(shellPrefs);
      showHint(`New ${state.difficulty} best time: ${state.elapsed}s`);
    }
  }

  function renderCell(cell: CellState, col: number, row: number): string {
    const classes = ["minesweeper__cell"];
    if (cell.revealed) {
      classes.push("is-revealed");
    }
    if (cell.mine && cell.revealed) {
      classes.push("is-mine");
    }
    const content = cell.revealed
      ? cell.mine
        ? "✹"
        : cell.adjacent > 0
          ? String(cell.adjacent)
          : ""
      : cell.mark === "flag"
        ? "⚑"
        : cell.mark === "question"
          ? "?"
          : "";

    return `
      <button
        type="button"
        class="${classes.join(" ")}"
        data-col="${col}"
        data-row="${row}"
        data-adjacent="${cell.adjacent}"
      >
        <span>${content}</span>
      </button>
    `;
  }

  function onBoardPointerDown(event: PointerEvent): void {
    const cellButton = (event.target as HTMLElement | null)?.closest<HTMLElement>(".minesweeper__cell");
    if (!cellButton) {
      return;
    }
    state.face = "shock";
    renderHeader();
    const col = Number(cellButton.dataset.col);
    const row = Number(cellButton.dataset.row);
    if (event.button === 2) {
      event.preventDefault();
      cycleMark(col, row);
      return;
    }
    revealCell(col, row);
  }

  function onBoardPointerUp(): void {
    if (state.status === "idle") {
      state.face = "smile";
      renderHeader();
    }
  }

  boardWrapper.addEventListener("pointerdown", onBoardPointerDown);
  boardWrapper.addEventListener("pointerup", onBoardPointerUp);
  boardWrapper.addEventListener("contextmenu", (event) => event.preventDefault());
  boardWrapper.addEventListener("click", (event) => {
    const faceButton = (event.target as HTMLElement | null)?.closest("[data-face-button]");
    if (faceButton) {
      restart(state.difficulty);
    }
  });

  restart("beginner");

  return {
    unmount() {
      stopTimer();
      boardWrapper.removeEventListener("pointerdown", onBoardPointerDown);
      boardWrapper.removeEventListener("pointerup", onBoardPointerUp);
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
