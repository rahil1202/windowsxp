import type {
  AppId,
  DesktopIconPosition,
  MediaPlayerPreferences,
  MinesweeperHighScores,
  ScreensaverPreferences,
  ShellPreferences,
  SolitaireStats,
  StorageSchema
} from "./types";

const STORAGE_KEY = "desktop-destroyer-web:v1";
const SHELL_STORAGE_KEY = "desktop-destroyer-web:shell:v2";
const validTools = new Set([
  "hammer",
  "chainsaw",
  "machineGun",
  "flamethrower",
  "colorThrower",
  "phaser",
  "stamp",
  "termites",
  "laser"
]);

export const defaultSettings: StorageSchema = {
  muted: false,
  selectedTool: "hammer",
  showHints: true
};

export const defaultScreensaverPreferences: ScreensaverPreferences = {
  enabled: true,
  timeoutMs: 45000,
  style: "mystify"
};

export const defaultMinesweeperHighScores: MinesweeperHighScores = {
  beginner: null,
  intermediate: null,
  expert: null
};

export const defaultSolitaireStats: SolitaireStats = {
  bestScore: 0,
  bestTime: null,
  wins: 0
};

export const defaultMediaPlayerPreferences: MediaPlayerPreferences = {
  visualizer: "bars",
  miniMode: false
};

export const defaultShellPreferences: ShellPreferences = {
  iconPositions: {},
  customDesktopShortcuts: [],
  screensaver: defaultScreensaverPreferences,
  minesweeperBestTimes: defaultMinesweeperHighScores,
  solitaireStats: defaultSolitaireStats,
  mediaPlayer: defaultMediaPlayerPreferences
};

export function loadSettings(): StorageSchema {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultSettings };
    }
    const parsed = JSON.parse(raw) as Partial<StorageSchema>;
    return {
      muted: typeof parsed.muted === "boolean" ? parsed.muted : defaultSettings.muted,
      selectedTool:
        parsed.selectedTool && validTools.has(parsed.selectedTool)
          ? parsed.selectedTool
          : defaultSettings.selectedTool,
      showHints:
        typeof parsed.showHints === "boolean"
          ? parsed.showHints
          : defaultSettings.showHints
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: StorageSchema): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

function isValidIconPosition(value: unknown): value is DesktopIconPosition {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as DesktopIconPosition).x === "number" &&
      typeof (value as DesktopIconPosition).y === "number"
  );
}

export function loadShellPreferences(): ShellPreferences {
  try {
    const raw = window.localStorage.getItem(SHELL_STORAGE_KEY);
    if (!raw) {
      return { ...defaultShellPreferences, iconPositions: {} };
    }
    const parsed = JSON.parse(raw) as Partial<ShellPreferences>;
    const iconPositions = Object.fromEntries(
      Object.entries(parsed.iconPositions ?? {}).filter(
        (entry): entry is [AppId, DesktopIconPosition] => isValidIconPosition(entry[1])
      )
    ) as Partial<Record<AppId, DesktopIconPosition>>;

    const customDesktopShortcuts = Array.isArray(parsed.customDesktopShortcuts)
      ? parsed.customDesktopShortcuts.filter((item): item is AppId => typeof item === "string")
      : [];

    return {
      iconPositions,
      customDesktopShortcuts,
      screensaver: {
        enabled:
          typeof parsed.screensaver?.enabled === "boolean"
            ? parsed.screensaver.enabled
            : defaultScreensaverPreferences.enabled,
        timeoutMs:
          typeof parsed.screensaver?.timeoutMs === "number"
            ? parsed.screensaver.timeoutMs
            : defaultScreensaverPreferences.timeoutMs,
        style: parsed.screensaver?.style ?? defaultScreensaverPreferences.style
      },
      minesweeperBestTimes: {
        beginner: parsed.minesweeperBestTimes?.beginner ?? defaultMinesweeperHighScores.beginner,
        intermediate:
          parsed.minesweeperBestTimes?.intermediate ?? defaultMinesweeperHighScores.intermediate,
        expert: parsed.minesweeperBestTimes?.expert ?? defaultMinesweeperHighScores.expert
      },
      solitaireStats: {
        bestScore: parsed.solitaireStats?.bestScore ?? defaultSolitaireStats.bestScore,
        bestTime: parsed.solitaireStats?.bestTime ?? defaultSolitaireStats.bestTime,
        wins: parsed.solitaireStats?.wins ?? defaultSolitaireStats.wins
      },
      mediaPlayer: {
        visualizer: parsed.mediaPlayer?.visualizer ?? defaultMediaPlayerPreferences.visualizer,
        miniMode: parsed.mediaPlayer?.miniMode ?? defaultMediaPlayerPreferences.miniMode
      }
    };
  } catch {
    return { ...defaultShellPreferences, iconPositions: {}, customDesktopShortcuts: [] };
  }
}

export function saveShellPreferences(settings: ShellPreferences): void {
  try {
    window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}
