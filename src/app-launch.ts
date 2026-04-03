import type { AppId } from "./types";

export const runCommandAliases: Record<string, AppId> = {
  calc: "calculator",
  calculator: "calculator",
  charmap: "character-map",
  checkers: "checkers",
  control: "control-panel",
  "control-panel": "control-panel",
  dd: "desktop-destroyer",
  "desktop-destroyer": "desktop-destroyer",
  explorer: "my-computer",
  freecell: "freecell",
  hearts: "hearts",
  inkball: "inkball",
  iexplore: "internet-explorer",
  messenger: "windows-messenger",
  mspaint: "paint",
  minesweeper: "minesweeper",
  notepad: "notepad",
  outlook: "outlook-express",
  paint: "paint",
  pinball: "pinball",
  recycle: "recycle-bin",
  reversi: "internet-reversi",
  rdc: "remote-desktop-connection",
  remote: "remote-desktop-connection",
  run: "run",
  solitaire: "solitaire",
  spider: "spider-solitaire",
  "spider-solitaire": "spider-solitaire",
  tour: "tour-windows-xp",
  wordpad: "wordpad",
  wmplayer: "windows-media-player",
  wmp: "windows-media-player"
};

export function normalizeRunCommand(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

export function resolveRunCommand(input: string): AppId | null {
  const direct = runCommandAliases[normalizeRunCommand(input)];
  return direct ?? null;
}

export function requestLaunchApp(appId: AppId): void {
  window.dispatchEvent(
    new CustomEvent<{ appId: AppId }>("xp-launch-app", {
      detail: { appId }
    })
  );
}

export function requestShellCommand(
  command: string,
  payload?: Record<string, unknown>
): void {
  window.dispatchEvent(
    new CustomEvent<{ command: string; payload?: Record<string, unknown> }>("xp-shell-command", {
      detail: { command, payload }
    })
  );
}
