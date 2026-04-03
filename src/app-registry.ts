import {
  gameIconUrls,
  hammerToolIconUrl,
  systemIconUrls,
  utilityIconUrls,
  rahilVahora,
} from "./assets";
import type { AppDefinition, AppId } from "./types";

const appDefinitions: AppDefinition[] = [
  {
    id: "desktop-destroyer",
    title: "Desktop Destroyer",
    icon: hammerToolIconUrl,
    singleInstance: true,
    launchMode: "overlay",
    defaultWindow: {
      width: 980,
      height: 640,
      minWidth: 560,
      minHeight: 420
    },
    desktopShortcut: {
      x: 20,
      y: 380,
      label: "Desktop Destroyer"
    },
    startMenu: {
      section: "pinned",
      order: 1
    },
    load: () => import("./apps/desktop-destroyer-app")
  },
  {
    id: "user-profile-doc",
    title: "Rahil Vahora",
    icon: rahilVahora,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 560,
      minWidth: 460,
      minHeight: 320
    },
    startMenu: {
      section: "system",
      order: 10
    },
    load: () => import("./apps/user-profile-doc-app")
  },
  {
    id: "internet-explorer",
    title: "Internet Explorer",
    icon: systemIconUrls.internetExplorer,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 520,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 20,
      y: 208
    },
    startMenu: {
      section: "pinned",
      order: 2
    },
    load: () => import("./apps/internet-explorer-app")
  },
  {
    id: "notepad",
    title: "Notepad",
    icon: utilityIconUrls.notepad,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 720,
      height: 520,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 338,
      y: 36
    },
    startMenu: {
      section: "pinned",
      order: 3
    },
    load: () => import("./apps/notepad-app")
  },
  {
    id: "wordpad",
    title: "WordPad",
    icon: utilityIconUrls.wordpad,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 820,
      height: 620,
      minWidth: 460,
      minHeight: 340
    },
    desktopShortcut: {
      x: 550,
      y: 36
    },
    startMenu: {
      section: "pinned",
      order: 7
    },
    load: () => import("./apps/wordpad-app")
  },
  {
    id: "calculator",
    title: "Calculator",
    icon: utilityIconUrls.calculator,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 340,
      height: 470,
      minWidth: 300,
      minHeight: 360
    },
    desktopShortcut: {
      x: 338,
      y: 122
    },
    startMenu: {
      section: "pinned",
      order: 4
    },
    load: () => import("./apps/calculator-app")
  },
  {
    id: "paint",
    title: "Paint",
    icon: utilityIconUrls.paint,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 840,
      height: 620,
      minWidth: 480,
      minHeight: 360
    },
    desktopShortcut: {
      x: 338,
      y: 208
    },
    startMenu: {
      section: "pinned",
      order: 5
    },
    load: () => import("./apps/paint-app")
  },
  {
    id: "windows-messenger",
    title: "Windows Messenger",
    icon: utilityIconUrls.windowsMessenger,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 540,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 550,
      y: 122
    },
    startMenu: {
      section: "pinned",
      order: 8
    },
    load: () => import("./apps/windows-messenger-app")
  },
  {
    id: "outlook-express",
    title: "Outlook Express",
    icon: utilityIconUrls.outlookExpress,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 920,
      height: 600,
      minWidth: 520,
      minHeight: 360
    },
    desktopShortcut: {
      x: 550,
      y: 208
    },
    startMenu: {
      section: "pinned",
      order: 9
    },
    load: () => import("./apps/outlook-express-app")
  },
  {
    id: "windows-media-player",
    title: "Windows Media Player",
    icon: utilityIconUrls.windowsMediaPlayer,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 860,
      height: 560,
      minWidth: 520,
      minHeight: 360
    },
    desktopShortcut: {
      x: 444,
      y: 36
    },
    startMenu: {
      section: "pinned",
      order: 6
    },
    load: () => import("./apps/windows-media-player-app")
  },
  {
    id: "character-map",
    title: "Character Map",
    icon: utilityIconUrls.characterMap,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 520,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 550,
      y: 294
    },
    startMenu: {
      section: "system",
      order: 6
    },
    load: () => import("./apps/character-map-app")
  },
  {
    id: "remote-desktop-connection",
    title: "Remote Desktop Connection",
    icon: utilityIconUrls.remoteDesktop,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 520,
      height: 360,
      minWidth: 360,
      minHeight: 240
    },
    desktopShortcut: {
      x: 550,
      y: 380
    },
    startMenu: {
      section: "system",
      order: 7
    },
    load: () => import("./apps/remote-desktop-app")
  },
  {
    id: "tour-windows-xp",
    title: "Tour Windows XP",
    icon: utilityIconUrls.tourWindowsXp,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 500,
      minWidth: 420,
      minHeight: 300
    },
    desktopShortcut: {
      x: 550,
      y: 466
    },
    startMenu: {
      section: "system",
      order: 8
    },
    load: () => import("./apps/tour-windows-xp-app")
  },
  {
    id: "task-manager",
    title: "Task Manager",
    icon: utilityIconUrls.controlPanel,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 680,
      height: 480,
      minWidth: 480,
      minHeight: 320
    },
    startMenu: {
      section: "system",
      order: 3
    },
    load: () => import("./apps/task-manager-app")
  },
  {
    id: "display-properties",
    title: "Display Properties",
    icon: utilityIconUrls.controlPanel,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 520,
      height: 390,
      minWidth: 420,
      minHeight: 300
    },
    startMenu: {
      section: "system",
      order: 11
    },
    load: () => import("./apps/display-properties-app")
  },
  {
    id: "accessibility-tools",
    title: "Accessibility Tools",
    icon: utilityIconUrls.characterMap,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 560,
      height: 420,
      minWidth: 420,
      minHeight: 300
    },
    startMenu: {
      section: "system",
      order: 12
    },
    load: () => import("./apps/accessibility-tools-app")
  },
  {
    id: "help-support",
    title: "Help and Support",
    icon: utilityIconUrls.tourWindowsXp,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 540,
      minWidth: 520,
      minHeight: 360
    },
    startMenu: {
      section: "system",
      order: 13
    },
    load: () => import("./apps/help-support-app")
  },
  {
    id: "folder",
    title: "New Folder",
    icon: systemIconUrls.myDocuments,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 520,
      height: 420,
      minWidth: 360,
      minHeight: 260
    },
    load: () => import("./apps/folder-app")
  },
  {
    id: "desktop-shortcuts",
    title: "Desktop Shortcuts",
    icon: systemIconUrls.myComputer,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 520,
      height: 400,
      minWidth: 360,
      minHeight: 260
    },
    load: () => import("./apps/desktop-shortcuts-app")
  },
  {
    id: "control-panel",
    title: "Control Panel",
    icon: utilityIconUrls.controlPanel,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 860,
      height: 560,
      minWidth: 520,
      minHeight: 360
    },
    desktopShortcut: {
      x: 338,
      y: 380
    },
    startMenu: {
      section: "system",
      order: 4
    },
    load: () => import("./apps/control-panel-app")
  },
  {
    id: "run",
    title: "Run",
    icon: utilityIconUrls.run,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 420,
      height: 210,
      minWidth: 320,
      minHeight: 180
    },
    desktopShortcut: {
      x: 338,
      y: 294
    },
    startMenu: {
      section: "system",
      order: 5
    },
    load: () => import("./apps/run-dialog-app")
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    icon: gameIconUrls.minesweeper,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 680,
      height: 560,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 126,
      y: 36
    },
    startMenu: {
      section: "games",
      order: 1
    },
    load: () => import("./apps/minesweeper-app")
  },
  {
    id: "solitaire",
    title: "Solitaire",
    icon: gameIconUrls.solitaire,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 980,
      height: 700,
      minWidth: 560,
      minHeight: 420
    },
    desktopShortcut: {
      x: 126,
      y: 122
    },
    startMenu: {
      section: "games",
      order: 2
    },
    load: () => import("./apps/solitaire-app")
  },
  {
    id: "freecell",
    title: "FreeCell",
    icon: gameIconUrls.freecell,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 980,
      height: 700,
      minWidth: 560,
      minHeight: 420
    },
    desktopShortcut: {
      x: 126,
      y: 208
    },
    startMenu: {
      section: "games",
      order: 3
    },
    load: () => import("./apps/freecell-app")
  },
  {
    id: "hearts",
    title: "Hearts",
    icon: gameIconUrls.hearts,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 820,
      height: 640,
      minWidth: 520,
      minHeight: 360
    },
    desktopShortcut: {
      x: 126,
      y: 294
    },
    startMenu: {
      section: "games",
      order: 4
    },
    load: () => import("./apps/hearts-app")
  },
  {
    id: "spider-solitaire",
    title: "Spider Solitaire",
    icon: gameIconUrls.spiderSolitaire,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 980,
      height: 720,
      minWidth: 600,
      minHeight: 420
    },
    desktopShortcut: {
      x: 232,
      y: 36
    },
    startMenu: {
      section: "games",
      order: 5
    },
    load: () => import("./apps/spider-solitaire-app")
  },
  {
    id: "checkers",
    title: "Checkers",
    icon: gameIconUrls.checkers,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 720,
      minWidth: 520,
      minHeight: 420
    },
    desktopShortcut: {
      x: 232,
      y: 122
    },
    startMenu: {
      section: "games",
      order: 6
    },
    load: () => import("./apps/checkers-app")
  },
  {
    id: "internet-reversi",
    title: "Internet Reversi",
    icon: gameIconUrls.internetReversi,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 700,
      height: 620,
      minWidth: 420,
      minHeight: 340
    },
    desktopShortcut: {
      x: 126,
      y: 466
    },
    startMenu: {
      section: "games",
      order: 8
    },
    load: () => import("./apps/reversi-app")
  },
  {
    id: "inkball",
    title: "InkBall",
    icon: gameIconUrls.inkball,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 760,
      height: 620,
      minWidth: 460,
      minHeight: 340
    },
    desktopShortcut: {
      x: 126,
      y: 552
    },
    startMenu: {
      section: "games",
      order: 9
    },
    load: () => import("./apps/inkball-app")
  },
  {
    id: "pinball",
    title: "3D Pinball",
    icon: gameIconUrls.pinball,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 820,
      height: 760,
      minWidth: 520,
      minHeight: 420
    },
    desktopShortcut: {
      x: 126,
      y: 380
    },
    startMenu: {
      section: "games",
      order: 7
    },
    load: () =>
      import("./apps/iframe-game-app").then((module) =>
        module.openGameWindow({
          appId: "pinball",
          title: "3D Pinball",
          icon: gameIconUrls.pinball,
          src: "/games/pinball/index.html",
          defaultWindow: {
            width: 820,
            height: 760,
            minWidth: 520,
            minHeight: 420
          }
        })
      )
  },
  {
    id: "my-documents",
    title: "My Documents",
    icon: systemIconUrls.myDocuments,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 620,
      height: 460,
      minWidth: 380,
      minHeight: 280
    },
    desktopShortcut: {
      x: 20,
      y: 122
    },
    startMenu: {
      section: "system",
      order: 1
    },
    load: () =>
      import("./apps/placeholder-app").then((module) =>
        module.createPlaceholderModule({
          kind: "explorer",
          title: "My Documents",
          address: "My Documents",
          caption: "These files are stored in this folder.",
          sidebar: [
            {
              title: "File and Folder Tasks",
              items: ["Make a new folder", "Publish this folder to the Web", "Share this folder"]
            },
            {
              title: "Other Places",
              items: ["Desktop", "Shared Documents", "My Computer"]
            },
            {
              title: "Details",
              items: ["Name: My Documents", "Type: File Folder"]
            }
          ],
          groups: [
            {
              title: "Files Stored in This Folder",
              items: [
                { title: "Taxes", meta: "File folder", icon: systemIconUrls.myDocuments },
                { title: "Images", meta: "File folder", icon: systemIconUrls.myDocuments },
                { title: "Projects", meta: "File folder", icon: systemIconUrls.myDocuments },
                { title: "WINDOWS XP", meta: "Text Document", icon: systemIconUrls.myDocuments }
              ]
            }
          ],
          status: "4 object(s)"
        })
      )
  },
  {
    id: "my-computer",
    title: "My Computer",
    icon: systemIconUrls.myComputer,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 680,
      height: 500,
      minWidth: 420,
      minHeight: 320
    },
    desktopShortcut: {
      x: 20,
      y: 36
    },
    startMenu: {
      section: "system",
      order: 2
    },
    load: () =>
      import("./apps/placeholder-app").then((module) =>
        module.createPlaceholderModule({
          kind: "explorer",
          title: "My Computer",
          address: "My Computer",
          caption: "Select an item to view its description.",
          sidebar: [
            {
              title: "System Tasks",
              items: ["View system information", "Add or remove programs", "Change a setting"]
            },
            {
              title: "Other Places",
              items: ["My Network Places", "My Documents", "Control Panel"]
            },
            {
              title: "Details",
              items: ["Name: My Computer", "Type: System Folder"]
            }
          ],
          groups: [
            {
              title: "System Tasks",
              items: [
                { title: "Shared Documents", meta: "Folder", icon: systemIconUrls.myDocuments },
                { title: "My Documents", meta: "Folder", icon: systemIconUrls.myDocuments }
              ]
            },
            {
              title: "Hard Disk Drives",
              items: [
                { title: "Local Disk (C:)", meta: "20.1 GB free of 60.0 GB", icon: systemIconUrls.myComputer },
                { title: "Games Drive (D:)", meta: "12.4 GB free of 80.0 GB", icon: hammerToolIconUrl }
              ]
            },
            {
              title: "Files Stored on This Computer",
              items: [
                { title: "Control Panel", meta: "System folder", icon: systemIconUrls.myComputer },
                { title: "Internet Explorer", meta: "Application", icon: systemIconUrls.internetExplorer }
              ]
            }
          ],
          status: "6 object(s)"
        })
      )
  },
  {
    id: "recycle-bin",
    title: "Recycle Bin",
    icon: systemIconUrls.recycleBin,
    singleInstance: true,
    launchMode: "window",
    defaultWindow: {
      width: 520,
      height: 400,
      minWidth: 320,
      minHeight: 260
    },
    desktopShortcut: {
      x: 20,
      y: 294
    },
    startMenu: {
      section: "system",
      order: 3
    },
    load: () =>
      import("./apps/placeholder-app").then((module) =>
        module.createPlaceholderModule({
          kind: "explorer",
          title: "Recycle Bin",
          address: "Recycle Bin",
          caption: "This folder contains files and folders you have deleted.",
          sidebar: [
            {
              title: "Recycle Bin Tasks",
              items: ["Empty the Recycle Bin", "Restore all items"]
            },
            {
              title: "Other Places",
              items: ["Desktop", "My Computer", "My Documents"]
            },
            {
              title: "Details",
              items: ["Size: 0 bytes", "Contains: 0 items"]
            }
          ],
          groups: [
            {
              title: "No files in the Recycle Bin",
              items: [
                { title: "The Recycle Bin is empty.", meta: "Nothing to restore right now.", icon: systemIconUrls.recycleBin }
              ]
            }
          ],
          status: "0 object(s)"
        })
      )
  }
];

export const appRegistry = appDefinitions;
export const appRegistryById = new Map<AppId, AppDefinition>(
  appDefinitions.map((definition) => [definition.id, definition])
);
