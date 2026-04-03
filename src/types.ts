export type ToolId =
  | "hammer"
  | "chainsaw"
  | "machineGun"
  | "flamethrower"
  | "colorThrower"
  | "phaser"
  | "stamp"
  | "termites"
  | "laser";

export type SoundId =
  | "glass-hit"
  | "impact-low"
  | "machine-gun"
  | "ricochet"
  | "spark"
  | "flame-loop"
  | "chainsaw-loop"
  | "termite"
  | "paint-spray"
  | "phaser-shot"
  | "laser-loop"
  | "stamp-hit"
  | "xp-startup"
  | "xp-shutdown"
  | "app-open"
  | "app-close";

export type DecalType =
  | "crack"
  | "bullet"
  | "scorch"
  | "termite-hole"
  | "chainsaw-gouge"
  | "paint-splat"
  | "phaser-hole"
  | "stamp-mark"
  | "laser-burn";

export type ParticleType =
  | "chip"
  | "spark"
  | "smoke"
  | "ember"
  | "flame"
  | "flash"
  | "paint"
  | "ring"
  | "beam"
  | "plasma";

export interface Point {
  x: number;
  y: number;
}

export interface StorageSchema {
  muted: boolean;
  selectedTool: ToolId;
  showHints: boolean;
}

export type ScreensaverId = "mystify" | "starfield" | "text-3d" | "bouncing-logo";

export interface DesktopIconPosition {
  x: number;
  y: number;
}

export interface ScreensaverPreferences {
  enabled: boolean;
  timeoutMs: number;
  style: ScreensaverId;
}

export interface MinesweeperHighScores {
  beginner: number | null;
  intermediate: number | null;
  expert: number | null;
}

export interface SolitaireStats {
  bestScore: number;
  bestTime: number | null;
  wins: number;
}

export interface MediaPlayerPreferences {
  visualizer: "bars" | "scope" | "pulse";
  miniMode: boolean;
}

export interface ShellPreferences {
  iconPositions: Partial<Record<AppId, DesktopIconPosition>>;
  customDesktopShortcuts: AppId[];
  screensaver: ScreensaverPreferences;
  minesweeperBestTimes: MinesweeperHighScores;
  solitaireStats: SolitaireStats;
  mediaPlayer: MediaPlayerPreferences;
}

export interface AssetManifest {
  icons: Record<ToolId, string>;
  cursors: Record<ToolId, string>;
  sounds: Record<
    SoundId,
    {
      label: string;
      loop: boolean;
      src?: string;
    }
  >;
}

export interface GameSettings extends StorageSchema {}

export interface Decal {
  id: number;
  type: DecalType;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  radius: number;
  createdAt: number;
  tint?: string;
}

export interface Particle {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  ttl: number;
  age: number;
  size: number;
  rotation: number;
  spin: number;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  tint?: string;
}

export interface CrawlerEntity {
  id: number;
  x: number;
  y: number;
  direction: number;
  speed: number;
  hunger: number;
  damageRadius: number;
  cooldown: number;
  turnTimer: number;
}

export interface CameraShake {
  strength: number;
  decay: number;
  x: number;
  y: number;
}

export interface PointerState {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  dx: number;
  dy: number;
  down: boolean;
  active: boolean;
  touchMode: boolean;
}

export interface GameState {
  width: number;
  height: number;
  selectedTool: ToolId;
  decals: Decal[];
  particles: Particle[];
  entities: CrawlerEntity[];
  cameraShake: CameraShake;
  settings: GameSettings;
  pointer: PointerState;
  toolboxOpen: boolean;
  audioUnlocked: boolean;
  lastToolUse: Partial<Record<ToolId, number>>;
}

export interface ToolContext {
  state: GameState;
  timestamp: number;
  spawnDecal: (
    partial: Omit<Decal, "id" | "createdAt"> & Partial<Pick<Decal, "createdAt">>
  ) => Decal;
  spawnParticle: (partial: Omit<Particle, "id" | "age">) => Particle;
  spawnCrawler: (point: Point, count: number) => void;
  damageCrawlers: (point: Point, radius: number, limit?: number) => number;
  addShake: (strength: number, decay?: number) => void;
  playSound: (soundId: SoundId) => void;
  startLoop: (soundId: SoundId) => void;
  stopLoop: (soundId: SoundId) => void;
  random: (min: number, max: number) => number;
}

export interface ToolDefinition {
  id: ToolId;
  label: string;
  hotkey: string;
  iconPath: string;
  cursorPath: string;
  soundIds: SoundId[];
  hint: string;
  onPress: (ctx: ToolContext, point: Point) => void;
  onMove: (ctx: ToolContext, point: Point) => void;
  onRelease: (ctx: ToolContext, point: Point) => void;
  update?: (ctx: ToolContext, dt: number) => void;
}

export interface DesktopIconSpec {
  label: string;
  imagePath: string;
  x: number;
  y: number;
}

export type AppId =
  | "desktop-destroyer"
  | "folder"
  | "desktop-shortcuts"
  | "display-properties"
  | "accessibility-tools"
  | "help-support"
  | "notepad"
  | "wordpad"
  | "calculator"
  | "paint"
  | "run"
  | "control-panel"
  | "windows-media-player"
  | "outlook-express"
  | "windows-messenger"
  | "character-map"
  | "remote-desktop-connection"
  | "tour-windows-xp"
  | "task-manager"
  | "minesweeper"
  | "solitaire"
  | "freecell"
  | "hearts"
  | "spider-solitaire"
  | "checkers"
  | "internet-reversi"
  | "inkball"
  | "pinball"
  | "my-computer"
  | "my-documents"
  | "recycle-bin"
  | "internet-explorer"
  | "user-profile-doc";

export interface AppHostContext {
  requestFocus(): void;
  updateTitle(title: string): void;
  close(): void;
  minimize(): void;
  maximize(): void;
  isMobile: boolean;
}

export interface AppInstance {
  unmount(): void;
  onFocus?(): void;
  onBlur?(): void;
  onDesktopShown?(): void;
  onResize?(size: { width: number; height: number; maximized: boolean }): void;
}

export interface AppDefinition {
  id: AppId;
  title: string;
  icon: string;
  singleInstance: true;
  launchMode: "window" | "overlay";
  defaultWindow: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
  desktopShortcut?: {
    x: number;
    y: number;
    label?: string;
  };
  startMenu?: {
    section: "pinned" | "games" | "system";
    order: number;
  };
  load: () => Promise<{ mount(host: HTMLElement, ctx: AppHostContext): AppInstance }>;
}

export interface IframeGameConfig {
  appId: AppId;
  title: string;
  icon: string;
  src: string;
  defaultWindow: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
}

export interface WindowState {
  windowId: string;
  appId: AppId;
  title: string;
  minimized: boolean;
  maximized: boolean;
  focused: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zIndex: number;
}
