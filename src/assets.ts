import type { AssetManifest, DesktopIconSpec, ToolId } from "./types";

function svg(source: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(source)}`;
}

function cursorSvg(paths: string, fill: string): string {
  return svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">
      <rect x="0" y="0" width="32" height="32" fill="transparent"/>
      <g fill="${fill}" stroke="#0b0b0b" stroke-width="1.6" stroke-linejoin="round">
        ${paths}
      </g>
    </svg>
  `);
}

function assetUrl(path: string): string {
  return `/${path.replace(/^\.\//, "")}`;
}

const toolAssetUrls: Record<ToolId, string> = {
  hammer: assetUrl("./assets/tools/Hammer.png"),
  chainsaw: assetUrl("./assets/tools/Chain-saw.png"),
  machineGun: assetUrl("./assets/tools/Machine-Gun.png"),
  flamethrower: assetUrl("./assets/tools/Flame-Thrower.png"),
  colorThrower: assetUrl("./assets/tools/Color-Thrower.png"),
  phaser: assetUrl("./assets/tools/Phaser.png"),
  stamp: assetUrl("./assets/tools/Stamp.png"),
  termites: assetUrl("./assets/tools/Termite.png"),
  laser: assetUrl("./assets/tools/Laser.png")
};

export const hammerToolIconUrl = toolAssetUrls.hammer;

export const toolOrder: ToolId[] = [
  "hammer",
  "chainsaw",
  "machineGun",
  "flamethrower",
  "colorThrower",
  "phaser",
  "stamp",
  "termites",
  "laser"
];

export const desktopIcons: DesktopIconSpec[] = [
  {
    label: "My Computer",
    imagePath: assetUrl("./assets/icons/my-computer.jpg"),
    x: 20,
    y: 36
  },
  {
    label: "My Documents",
    imagePath: assetUrl("./assets/icons/my-documents.jpg"),
    x: 20,
    y: 122
  },
  {
    label: "Internet Explorer",
    imagePath: assetUrl("./assets/icons/internet-explorer.png"),
    x: 20,
    y: 208
  },
  {
    label: "Recycle Bin",
    imagePath: assetUrl("./assets/icons/recyle-bin.jpg"),
    x: 20,
    y: 294
  }
];

export const systemIconUrls = {
  myComputer: desktopIcons[0].imagePath,
  myDocuments: desktopIcons[1].imagePath,
  internetExplorer: desktopIcons[2].imagePath,
  recycleBin: desktopIcons[3].imagePath
} as const;

export const gameIconUrls = {
  minesweeper: assetUrl("./assets/icons/minesweeper.png"),
  solitaire: assetUrl("./assets/icons/solatire.png"),
  freecell: assetUrl("./assets/icons/freecell.png"),
  hearts: assetUrl("./assets/icons/hearts.png"),
  spiderSolitaire: assetUrl("./assets/icons/spider-solatire.png"),
  checkers: assetUrl("./assets/icons/checkers.png"),
  internetReversi: svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="44" rx="5" fill="#1e7f36" stroke="#0e4f20" stroke-width="2"/>
      <circle cx="25" cy="25" r="9" fill="#151515" stroke="#000" stroke-width="2"/>
      <circle cx="39" cy="39" r="9" fill="#f5f5f5" stroke="#8b8b8b" stroke-width="2"/>
      <circle cx="39" cy="25" r="9" fill="#151515" stroke="#000" stroke-width="2"/>
      <circle cx="25" cy="39" r="9" fill="#f5f5f5" stroke="#8b8b8b" stroke-width="2"/>
    </svg>
  `),
  inkball: svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="10" y="10" width="44" height="44" rx="6" fill="#dff0ff" stroke="#6d87b1" stroke-width="2"/>
      <circle cx="22" cy="24" r="7" fill="#e94a4a" stroke="#8e1616" stroke-width="2"/>
      <circle cx="42" cy="40" r="7" fill="#2d7df0" stroke="#144a97" stroke-width="2"/>
      <path d="M18 42c8-7 16-7 28-20" fill="none" stroke="#7057d9" stroke-width="4" stroke-linecap="round"/>
      <circle cx="18" cy="44" r="4" fill="#ffd87b" stroke="#9d6f13" stroke-width="2"/>
      <circle cx="46" cy="18" r="4" fill="#ffd87b" stroke="#9d6f13" stroke-width="2"/>
    </svg>
  `),
  pinball: assetUrl("./assets/icons/3dpinball.png")
} as const;

export const utilityIconUrls = {
  notepad: assetUrl("./assets/icons/note-pad.png"),
  calculator: assetUrl("./assets/icons/calculator.png"),
  paint: assetUrl("./assets/icons/paint.png"),
  run: assetUrl("./assets/icons/run.png"),
  controlPanel: assetUrl("./assets/icons/control-panel.png"),
  windowsMediaPlayer: assetUrl("./assets/icons/media-player.png"),
  wordpad: assetUrl("./assets/icons/wordpad.png"),
  outlookExpress: assetUrl("./assets/icons/outlook.png"),
  windowsMessenger: assetUrl("./assets/icons/messanger.png"),
  characterMap: svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="12" y="12" width="40" height="40" rx="4" fill="#f7f3e8" stroke="#7a86a0" stroke-width="2"/>
      <g fill="#304c86" font-family="Times New Roman" font-size="12" text-anchor="middle">
        <text x="22" y="27">A</text>
        <text x="32" y="27">ß</text>
        <text x="42" y="27">Ω</text>
        <text x="22" y="41">©</text>
        <text x="32" y="41">π</text>
        <text x="42" y="41">✓</text>
      </g>
    </svg>
  `),
  remoteDesktop: svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="10" y="14" width="20" height="16" rx="2" fill="#dce9fb" stroke="#607a9d" stroke-width="2"/>
      <rect x="34" y="26" width="20" height="16" rx="2" fill="#dce9fb" stroke="#607a9d" stroke-width="2"/>
      <path d="M26 24h10M36 20l4 4-4 4" fill="none" stroke="#43a047" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `),
  tourWindowsXp: svg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="20" fill="#ffdd76" stroke="#b67c17" stroke-width="2"/>
      <path d="M32 18v14l10 6" fill="none" stroke="#7b5110" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 19l6 6M45 19l-6 6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `)
} as const;

export const desktopWallpaperUrl = assetUrl("./assets/windows-xp-wallpaper.jpg");
export const windowsXpLogoUrl = assetUrl("./assets/windows-xp-logo.png");
export const loginUserAvatarUrl = assetUrl("./assets/icons/windows-xp.png");
export const rahilVahora = assetUrl("./assets/rahil-vahora.jpg");
export const githubIconUrl = assetUrl("./assets/icons/github.png");
export const loginProfileAvatarUrls = [
  assetUrl("./assets/pp/airplane-pp.jpg"),
  assetUrl("./assets/pp/astronaut-pp.jpg"),
  assetUrl("./assets/pp/cat-pp.jpg"),
  assetUrl("./assets/pp/chess-pp.jpg"),
  assetUrl("./assets/pp/duck-pp.jpg"),
  assetUrl("./assets/pp/flower-pp.jpg"),
  assetUrl("./assets/pp/frog-pp.jpg")
];
const hammerSoundUrl = assetUrl("./assets/sounds/hammer.mp3");
const chainsawSoundUrl = assetUrl("./assets/sounds/chainsaw.mp3");
const machineGunSoundUrl = assetUrl("./assets/sounds/machinegun.mp3");
const flamethrowerSoundUrl = assetUrl("./assets/sounds/flamethrower.mp3");
const colorThrowerSoundUrl = assetUrl("./assets/sounds/colorthrower.mp3");
const laserSoundUrl = assetUrl("./assets/sounds/laser.mp3");
const stampSoundUrl = assetUrl("./assets/sounds/stamp.mp3");
const windowsXpStartupSoundUrl = assetUrl("./assets/sounds/windows-xp-startup.mp3");
const windowsXpShutdownSoundUrl = assetUrl("./assets/sounds/windows_xp_shutdown.mp3");
export { windowsXpStartupSoundUrl, windowsXpShutdownSoundUrl };

// System event sounds (use existing game sounds for app events)
export const appOpenSoundUrl = hammerSoundUrl; // Quick percussion sound for app open
export const appCloseSoundUrl = laserSoundUrl; // Soft sound for app close

export const assetManifest: AssetManifest = {
  icons: toolAssetUrls,
  cursors: {
    hammer: cursorSvg(
      `
      <path d="M6 7h11v5H6z" />
      <path d="M16 11l7 7-2 2-7-7z" fill="#6e431d"/>
      <path d="M20 19l4 4-2 2-4-4z" fill="#c49663"/>
      `,
      "#9aa3b3"
    ),
    chainsaw: cursorSvg(
      `
      <path d="M5 12h10v8H5z"/>
      <path d="M15 13h10v6H15z" fill="#d8dadf"/>
      <path d="M25 13h3v6h-3z" fill="#b2b5bc"/>
      <path d="M8 20h4v4H8z" fill="#2e2e2e"/>
      `,
      "#f33a27"
    ),
    machineGun: cursorSvg(
      `
      <path d="M6 11h13l5 3v4H6z"/>
      <path d="M11 18h6v5h-4l-2-2z" fill="#3d4048"/>
      <path d="M24 13h3v3h-3z" fill="#ffe37a"/>
      `,
      "#7b808d"
    ),
    flamethrower: cursorSvg(
      `
      <path d="M6 11h14v5H6z"/>
      <path d="M20 12h6v3h-6z" fill="#585858"/>
      <path d="M24 11c4 2 4 8 0 10 3-1 5-4 5-5s-2-4-5-5z" fill="#ff972a"/>
      <path d="M25 13c2 1 2 4 0 6 2-1 3-3 3-3s-1-2-3-3z" fill="#ffe26c"/>
      `,
      "#8d989f"
    ),
    colorThrower: cursorSvg(
      `
      <path d="M6 10h14v4H6z"/>
      <rect x="13" y="8" width="4" height="8" rx="2" fill="#ef3a2d"/>
      <rect x="17" y="8" width="4" height="8" rx="2" fill="#3bc34b"/>
      <rect x="21" y="8" width="4" height="8" rx="2" fill="#2e74ff"/>
      <path d="M24 10c4 2 4 8 0 10" fill="#ffcf4f"/>
      `,
      "#a9b0ba"
    ),
    phaser: cursorSvg(
      `
      <path d="M5 12h15v7H5z"/>
      <path d="M20 13h6v5h-6z" fill="#9f5dff"/>
      <path d="M24 12c3 2 3 8 0 10" fill="#5bf3ff"/>
      `,
      "#6d45cf"
    ),
    stamp: cursorSvg(
      `
      <circle cx="13" cy="10" r="4"/>
      <rect x="11" y="14" width="4" height="5" rx="1" fill="#ffd764"/>
      <ellipse cx="13" cy="22" rx="7" ry="3"/>
      `,
      "#f2b921"
    ),
    termites: cursorSvg(
      `
      <ellipse cx="12" cy="14" rx="6" ry="4"/>
      <ellipse cx="20" cy="18" rx="6" ry="4"/>
      <circle cx="10" cy="13" r="1" fill="#111"/>
      <circle cx="18" cy="17" r="1" fill="#111"/>
      <path d="M7 12l-3-2M7 16l-3 2M17 16l-3 2M17 12l-3-2" stroke="#6e4c27" stroke-width="1.4"/>
      `,
      "#9a6b38"
    ),
    laser: cursorSvg(
      `
      <path d="M6 11h14v6H6z"/>
      <path d="M20 12h6v4h-6z" fill="#1cd6ff"/>
      <path d="M24 11c4 2 4 8 0 10" fill="#7ef8ff"/>
      `,
      "#3db6ea"
    )
  },
  sounds: {
    "glass-hit": {
      label: "Glass Hit",
      loop: false,
      src: hammerSoundUrl
    },
    "impact-low": {
      label: "Impact",
      loop: false
    },
    "machine-gun": {
      label: "Machine Gun",
      loop: false,
      src: machineGunSoundUrl
    },
    ricochet: {
      label: "Ricochet",
      loop: false
    },
    spark: {
      label: "Spark",
      loop: false
    },
    "flame-loop": {
      label: "Flame Loop",
      loop: true,
      src: flamethrowerSoundUrl
    },
    "chainsaw-loop": {
      label: "Chainsaw Loop",
      loop: true,
      src: chainsawSoundUrl
    },
    termite: {
      label: "Termite Tick",
      loop: false
    },
    "paint-spray": {
      label: "Paint Spray",
      loop: false,
      src: colorThrowerSoundUrl
    },
    "phaser-shot": {
      label: "Phaser Shot",
      loop: false
    },
    "laser-loop": {
      label: "Laser Loop",
      loop: true,
      src: laserSoundUrl
    },
    "stamp-hit": {
      label: "Stamp Hit",
      loop: false,
      src: stampSoundUrl
    },
    "xp-startup": {
      label: "XP Startup",
      loop: false,
      src: windowsXpStartupSoundUrl
    },
    "xp-shutdown": {
      label: "XP Shutdown",
      loop: false,
      src: windowsXpShutdownSoundUrl
    },
    "app-open": {
      label: "App Open",
      loop: false,
      src: appOpenSoundUrl
    },
    "app-close": {
      label: "App Close",
      loop: false,
      src: appCloseSoundUrl
    }
  }
};
