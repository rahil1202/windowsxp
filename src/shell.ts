import { appRegistry, appRegistryById } from "./app-registry";
import {
  githubIconUrl,
  loginProfileAvatarUrls,
  loginUserAvatarUrl,
  rahilVahora,
  restartIconUrl,
  shutdownIconUrl,
  systemIconUrls,
  windowsXpLogoUrl,
  windowsXpShutdownSoundUrl
} from "./assets";
import { loadShellPreferences, saveShellPreferences } from "./storage";
import type {
  AppDefinition,
  AppHostContext,
  AppId,
  AppInstance,
  DesktopIconPosition,
  ScreensaverId,
  ShellPreferences,
  WindowState
} from "./types";

interface ShellCallbacks {
  onLogOff(): void;
  onRestart(): void;
  onPowerOff(): void;
  onSleep(): void;
}

interface ManagedWindow {
  definition: AppDefinition;
  state: WindowState;
  element: HTMLElement;
  titleLabel: HTMLElement;
  content: HTMLElement;
  taskbarButton: HTMLButtonElement;
  instance: AppInstance | null;
  normalRect: WindowState["rect"] | null;
}

interface ManagedOverlayApp {
  definition: AppDefinition;
  host: HTMLElement;
  taskbarButton: HTMLButtonElement;
  instance: AppInstance | null;
  minimized: boolean;
  focused: boolean;
}

interface MenuItem {
  label: string;
  action?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  submenu?: MenuItem[];
  icon?: string;
}

interface IconDragState {
  appId: AppId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  active: boolean;
  element: HTMLElement;
}

interface WindowDragState {
  appId: AppId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRect: WindowState["rect"];
}

interface ShellCommandDetail {
  command: string;
  payload?: Record<string, unknown>;
}

type ThemeName = "luna" | "zune" | "royale";

type DesktopContextMenuTarget = AppId | "desktop";

const DRAG_THRESHOLD = 6;
const DESKTOP_ICON_WIDTH = 92;
const DESKTOP_ICON_HEIGHT = 74;
const DESKTOP_ICON_START_X = 20;
const DESKTOP_ICON_START_Y = 36;
const DESKTOP_ICON_COLUMN_GAP = 106;
const DESKTOP_ICON_ROW_GAP = 86;

export class WindowsXpShell {
  private readonly abortController = new AbortController();
  private readonly windows = new Map<AppId, ManagedWindow>();
  private readonly shellPrefs: ShellPreferences;
  private readonly iconPositions = new Map<AppId, DesktopIconPosition>();
  private readonly rootElement: HTMLElement;
  private readonly desktopAreaElement: HTMLElement;
  private readonly startMenuElement: HTMLElement;
  private readonly allProgramsPanelElement: HTMLElement;
  private readonly shutdownDialogElement: HTMLElement;
  private readonly taskbarAppsElement: HTMLElement;
  private readonly desktopIconsElement: HTMLElement;
  private readonly windowLayerElement: HTMLElement;
  private readonly overlayLayerElement: HTMLElement;
  private readonly screensaverLayerElement: HTMLElement;
  private readonly screensaverCanvasElement: HTMLCanvasElement;
  private readonly bsodElement: HTMLElement;
  private readonly desktopContextMenuElement: HTMLElement;
  private readonly clockTimeElement: HTMLElement;
  private readonly clockDateElement: HTMLElement;
  private readonly startButtonElement: HTMLButtonElement;
  private readonly trayIconsElement: HTMLElement;
  private readonly volumeSliderElement: HTMLInputElement;
  private readonly altTabElement: HTMLElement;
  private readonly notificationLayerElement: HTMLElement;
  private clockTimer = 0;
  private idleTimer = 0;
  private nextWindowNumber = 1;
  private topZIndex = 20;
  private desktopOverlayApp: ManagedOverlayApp | null = null;
  private selectedDesktopIconId: AppId | null = null;
  private iconDragState: IconDragState | null = null;
  private windowDragState: WindowDragState | null = null;
  private screensaverActive = false;
  private screensaverFrame = 0;
  private screensaverStart = 0;
  private screensaverStars: Array<{ x: number; y: number; z: number }> = [];
  private screensaverLogo = new Image();
  private screensaverTextPhase = 0;
  private bsodActive = false;
  private trayIconsVisible = true;
  private altHeld = false;
  private altTabOrder: AppId[] = [];
  private altTabIndex = 0;
  private currentTheme: ThemeName = "luna";

  constructor(
    root: HTMLElement,
    private readonly callbacks: ShellCallbacks
  ) {
    this.rootElement = root;
    this.shellPrefs = loadShellPreferences();
    this.hydrateCustomDesktopShortcuts();
    this.hydrateIconPositions();
    const startMenuAvatar =
      loginProfileAvatarUrls[Math.floor(Math.random() * loginProfileAvatarUrls.length)] ??
      loginUserAvatarUrl;

    this.rootElement.innerHTML = `
      <section class="xp-shell">
        <div class="xp-shell__desktop" data-desktop-area>
          <div class="xp-shell__background-app" data-desktop-background></div>
          <div class="xp-shell__profile-stack">
            <button type="button" class="xp-shell__user-shortcut" data-open-user-profile aria-label="Open user profile">
              <span class="xp-shell__user-shortcut-avatar"><img src="${rahilVahora}" alt="Rahil Vahora" /></span>
            </button>
            <button type="button" class="xp-shell__github-shortcut" data-open-github aria-label="Open project GitHub">
              <span class="xp-shell__github-shortcut-icon" style="background-image:url('${githubIconUrl}')"></span>
            </button>
          </div>
          <div class="xp-shell__icon-layer" data-desktop-icons></div>
          <div class="xp-shell__window-layer" data-window-layer></div>
          <div class="xp-shell__overlay-layer" data-overlay-layer></div>
          <section class="xp-desktop-context-menu" data-desktop-context-menu aria-hidden="true"></section>
        </div>
        <section id="xp-start-menu" class="xp-start-menu" data-start-menu aria-hidden="true">
          <div class="xp-start-menu__top">
            <div class="xp-start-menu__user">
              <span class="xp-start-menu__user-avatar"><img src="${startMenuAvatar}" alt="" /></span>
              <strong>User</strong>
            </div>
          </div>
          <div class="xp-start-menu__body">
            <div class="xp-start-menu__column xp-start-menu__column--pinned">
              <div class="xp-start-menu__section" data-start-pinned></div>
              <div class="xp-start-menu__section xp-start-menu__section--games">
                <h3 class="xp-start-menu__section-title">Games</h3>
                <div data-start-games></div>
              </div>
              <button type="button" class="xp-start-menu__all-programs" data-open-all-programs aria-expanded="false" aria-controls="xp-all-programs-panel">
                <span>All Programs</span>
                <strong>▶</strong>
              </button>
            </div>
            <div class="xp-start-menu__column xp-start-menu__column--system" data-start-system></div>
          </div>
          <section id="xp-all-programs-panel" class="xp-start-menu__all-programs-panel" data-all-programs-panel aria-hidden="true">
            <button type="button" class="xp-start-menu__all-programs-back" data-close-all-programs>
              <strong>◀</strong><span>Back</span>
            </button>
            <div class="xp-start-menu__all-programs-groups" data-all-programs-groups></div>
          </section>
          <div class="xp-start-menu__footer">
            <button type="button" class="xp-start-menu__footer-action xp-start-menu__footer-action--logoff" data-log-off><span></span><strong>Log Off</strong></button>
            <button type="button" class="xp-start-menu__footer-action xp-start-menu__footer-action--power" data-open-shutdown>
              <span style="background-image:url('${shutdownIconUrl}')"></span>
              <strong>Turn Off Computer</strong>
            </button>
          </div>
        </section>
        <section class="xp-shutdown-dialog" data-shutdown-dialog aria-hidden="true">
          <div class="xp-shutdown-dialog__panel">
            <h2>Turn off computer</h2>
            <p>What do you want the computer to do?</p>
            <div class="xp-shutdown-dialog__actions">
              <button type="button" data-shutdown-action="sleep">Stand By</button>
              <button type="button" data-shutdown-action="turn-off">
                <span class="xp-shutdown-dialog__action-icon" style="background-image:url('${shutdownIconUrl}')"></span>
                <span>Turn Off</span>
              </button>
              <button type="button" data-shutdown-action="restart">
                <span class="xp-shutdown-dialog__action-icon" style="background-image:url('${restartIconUrl}')"></span>
                <span>Restart</span>
              </button>
              <button type="button" data-shutdown-action="cancel">Cancel</button>
            </div>
          </div>
        </section>
        <section class="xp-shell__screensaver" data-screensaver aria-hidden="true">
          <canvas class="xp-shell__screensaver-canvas" data-screensaver-canvas></canvas>
        </section>
        <section class="xp-shell__bsod" data-bsod aria-hidden="true">
          <div class="xp-shell__bsod-copy">
            <p>A problem has been detected and Windows has been shut down to prevent damage to your computer.</p>
            <h2>RETRO_DESKTOP_FAILURE</h2>
            <p>If this is the first time you've seen this Stop error screen, restart your computer.</p>
            <p>Technical information:</p>
            <p>*** STOP: 0x0000007B (0xF86B5AFC, 0xC0000034, 0x00000000, 0x00000000)</p>
            <button type="button" class="xp-shell__bsod-button" data-bsod-restart>Restart Computer</button>
          </div>
        </section>
        <footer class="xp-taskbar" data-taskbar>
          <button type="button" class="xp-taskbar__start" data-start-button aria-expanded="false" aria-controls="xp-start-menu" aria-label="Open Start menu">
            <img src="${windowsXpLogoUrl}" alt="" /><span>start</span>
          </button>
          <div class="xp-taskbar__quicklaunch" aria-hidden="true">
            <button type="button" class="xp-taskbar__quicklaunch-btn" style="background-image:url('${systemIconUrls.internetExplorer}')" data-launch-app="internet-explorer"></button>
            <button type="button" class="xp-taskbar__quicklaunch-btn" style="background-image:url('${systemIconUrls.myDocuments}')" data-launch-app="my-documents"></button>
          </div>
          <div class="xp-taskbar__apps" data-taskbar-apps></div>
          <div class="xp-taskbar__tray">
            <span class="xp-taskbar__tray-icons" data-tray-icons>
              <button type="button" class="xp-taskbar__tray-btn" data-tray-action="volume" aria-label="Volume">🔊</button>
              <button type="button" class="xp-taskbar__tray-btn" data-tray-action="network" aria-label="Network">📶</button>
              <button type="button" class="xp-taskbar__tray-btn" data-tray-action="battery" aria-label="Battery">🔋</button>
            </span>
            <div class="xp-taskbar__clock"><strong data-clock-time></strong><span data-clock-date></span></div>
            <div class="xp-taskbar__volume-popup" data-volume-popup hidden>
              <label>Volume</label>
              <input type="range" min="0" max="100" value="72" data-volume-slider />
            </div>
          </div>
        </footer>
        <div class="xp-shell__notifications" data-notification-layer></div>
        <section class="xp-shell__alt-tab" data-alt-tab aria-hidden="true"></section>
      </section>
    `;

    this.desktopAreaElement = this.query("[data-desktop-area]");
    this.startMenuElement = this.query("[data-start-menu]");
    this.allProgramsPanelElement = this.query("[data-all-programs-panel]");
    this.shutdownDialogElement = this.query("[data-shutdown-dialog]");
    this.taskbarAppsElement = this.query("[data-taskbar-apps]");
    this.desktopIconsElement = this.query("[data-desktop-icons]");
    this.windowLayerElement = this.query("[data-window-layer]");
    this.overlayLayerElement = this.query("[data-overlay-layer]");
    this.screensaverLayerElement = this.query("[data-screensaver]");
    this.screensaverCanvasElement = this.query("[data-screensaver-canvas]");
    this.bsodElement = this.query("[data-bsod]");
    this.desktopContextMenuElement = this.query("[data-desktop-context-menu]");
    this.clockTimeElement = this.query("[data-clock-time]");
    this.clockDateElement = this.query("[data-clock-date]");
    this.startButtonElement = this.query("[data-start-button]");
    this.trayIconsElement = this.query("[data-tray-icons]");
    this.volumeSliderElement = this.query("[data-volume-slider]");
    this.altTabElement = this.query("[data-alt-tab]");
    this.notificationLayerElement = this.query("[data-notification-layer]");
    this.screensaverLogo.src = windowsXpLogoUrl;
    this.applyTheme({ theme: this.currentTheme, notify: false });

    this.arrangeDesktopIcons("registry");
    this.renderDesktopIcons();
    this.renderStartMenuColumns();
    this.attachEvents();
    this.updateClock();
    this.resetIdleTimer();
    this.clockTimer = window.setInterval(() => this.updateClock(), 1000);
  }

  destroy(): void {
    this.abortController.abort();
    window.clearInterval(this.clockTimer);
    window.clearTimeout(this.idleTimer);
    window.cancelAnimationFrame(this.screensaverFrame);
    for (const windowItem of this.windows.values()) {
      windowItem.instance?.unmount();
    }
    this.windows.clear();
    this.closeOverlayApp();
    this.rootElement.innerHTML = "";
  }

  openApp(appId: AppId): void {
    if (this.bsodActive) {
      return;
    }
    this.markUserActivity();
    this.setStartMenuOpen(false);
    this.hideDesktopContextMenu();
    const definition = appRegistryById.get(appId);
    if (!definition) {
      return;
    }
    if (definition.launchMode === "overlay") {
      void this.mountOverlayApp(definition);
      return;
    }
    const existing = this.windows.get(appId);
    if (existing) {
      existing.state.minimized = false;
      this.focusWindow(appId);
      this.layoutWindow(existing);
      return;
    }
    const state: WindowState = {
      windowId: `${definition.id}-${this.nextWindowNumber++}`,
      appId: definition.id,
      title: definition.title,
      minimized: false,
      maximized: this.isMobileViewport(),
      focused: false,
      rect: this.createInitialRect(definition),
      zIndex: ++this.topZIndex
    };
    const windowItem = this.createWindow(definition, state);
    this.windows.set(appId, windowItem);
    this.windowLayerElement.appendChild(windowItem.element);
    this.taskbarAppsElement.appendChild(windowItem.taskbarButton);
    this.focusWindow(appId);
    this.layoutWindow(windowItem);
    this.setBusyCursor(true);
    void this.mountWindow(windowItem);
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.rootElement.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing shell element: ${selector}`);
    }
    return element;
  }

  private hydrateIconPositions(): void {
    for (const definition of appRegistry) {
      if (!definition.desktopShortcut) {
        continue;
      }
      const saved = this.shellPrefs.iconPositions[definition.id];
      this.iconPositions.set(definition.id, saved ?? { x: definition.desktopShortcut.x, y: definition.desktopShortcut.y });
    }
  }

  private hydrateCustomDesktopShortcuts(): void {
    for (const appId of this.shellPrefs.customDesktopShortcuts) {
      const definition = appRegistryById.get(appId);
      if (!definition || definition.desktopShortcut) {
        continue;
      }
      definition.desktopShortcut = {
        x: DESKTOP_ICON_START_X,
        y: DESKTOP_ICON_START_Y,
        label: definition.title
      };
    }
  }

  private saveShellPrefs(): void {
    this.shellPrefs.iconPositions = Object.fromEntries(this.iconPositions.entries()) as ShellPreferences["iconPositions"];
    saveShellPreferences(this.shellPrefs);
  }

  private renderDesktopIcons(): void {
    this.desktopIconsElement.innerHTML = appRegistry
      .filter((definition) => definition.desktopShortcut)
      .map((definition) => {
        const position = this.iconPositions.get(definition.id) ?? {
          x: definition.desktopShortcut!.x,
          y: definition.desktopShortcut!.y
        };
        const label = definition.desktopShortcut?.label ?? definition.title;
        return `
          <button
            type="button"
            class="xp-desktop-icon${this.selectedDesktopIconId === definition.id ? " is-selected" : ""}"
            data-desktop-icon="${definition.id}"
            style="left:${position.x}px;top:${position.y}px"
          >
            <span class="xp-desktop-icon__image" style="background-image:url('${definition.icon}')"></span>
            <span class="xp-desktop-icon__label">${label}</span>
          </button>
        `;
      })
      .join("");
    this.syncDesktopIconSelection();
  }

  private syncDesktopIconSelection(): void {
    const selectedId = this.selectedDesktopIconId;
    for (const icon of this.desktopIconsElement.querySelectorAll<HTMLElement>("[data-desktop-icon]")) {
      icon.classList.toggle("is-selected", icon.dataset.desktopIcon === selectedId);
    }
  }

  private renderStartMenuColumns(): void {
    const pinned = this.query<HTMLElement>("[data-start-pinned]");
    const games = this.query<HTMLElement>("[data-start-games]");
    const system = this.query<HTMLElement>("[data-start-system]");
    const allPrograms = this.query<HTMLElement>("[data-all-programs-groups]");

    const renderItems = (section: NonNullable<AppDefinition["startMenu"]>["section"], systemMode = false) =>
      appRegistry
        .filter((definition) => definition.startMenu?.section === section)
        .sort((left, right) => (left.startMenu?.order ?? 0) - (right.startMenu?.order ?? 0))
        .map(
          (definition) => `
            <button
              type="button"
              class="xp-start-menu__item${systemMode ? " xp-start-menu__item--system" : ""}"
              data-launch-app="${definition.id}"
            >
              <span class="xp-start-menu__item-icon" style="background-image:url('${definition.icon}')"></span>
              <span class="xp-start-menu__item-copy">
                <strong>${definition.title}</strong>
                <em>${definition.launchMode === "overlay" ? "Shell overlay" : "Classic app"}</em>
              </span>
            </button>
          `
        )
        .join("");

    pinned.innerHTML = renderItems("pinned");
    games.innerHTML = renderItems("games");
    system.innerHTML = renderItems("system", true);

    allPrograms.innerHTML = [
      { label: "Accessories", items: renderItems("pinned") + renderItems("system", true) },
      { label: "Games", items: renderItems("games") }
    ]
      .map(
        (group) => `
          <section class="xp-start-menu__section">
            <h3 class="xp-start-menu__section-title">${group.label}</h3>
            <div>${group.items}</div>
          </section>
        `
      )
      .join("");
  }

  private attachEvents(): void {
    const signal = this.abortController.signal;

    window.addEventListener(
      "xp-launch-app",
      (event: Event) => {
        const detail = (event as CustomEvent<{ appId: AppId }>).detail;
        if (detail?.appId) {
          this.openApp(detail.appId);
        }
      },
      { signal }
    );

    window.addEventListener(
      "xp-shell-command",
      (event: Event) => {
        const detail = (event as CustomEvent<ShellCommandDetail>).detail;
        this.handleShellCommand(detail);
      },
      { signal }
    );

    window.addEventListener(
      "resize",
      () => {
        this.resizeScreensaverCanvas();
        for (const windowItem of this.windows.values()) {
          if (windowItem.state.maximized) {
            this.layoutWindow(windowItem);
          }
        }
        if (!this.isMobileViewport()) {
          this.arrangeDesktopIcons("registry");
          this.renderDesktopIcons();
        }
      },
      { signal }
    );

    for (const eventName of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
      window.addEventListener(
        eventName,
        () => this.markUserActivity(),
        { signal, passive: eventName !== "keydown" }
      );
    }

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Tab" || !event.altKey) {
          return;
        }
        event.preventDefault();
        this.altHeld = true;
        const direction: 1 | -1 = event.shiftKey ? -1 : 1;
        this.cycleAltTab(direction);
      },
      { signal }
    );

    window.addEventListener(
      "keyup",
      (event) => {
        if (event.key !== "Alt") {
          return;
        }
        this.altHeld = false;
        this.commitAltTabSelection();
      },
      { signal }
    );

    this.startButtonElement.addEventListener("click", () => {
      this.markUserActivity();
      this.setStartMenuOpen(this.startMenuElement.getAttribute("aria-hidden") !== "false");
      this.hideDesktopContextMenu();
    }, { signal });

    this.trayIconsElement.addEventListener(
      "click",
      (event) => {
        const action = (event.target as HTMLElement).closest<HTMLElement>("[data-tray-action]")?.dataset.trayAction;
        if (!action) {
          return;
        }
        if (action === "volume") {
          const popup = this.rootElement.querySelector<HTMLElement>("[data-volume-popup]");
          if (popup) {
            popup.hidden = !popup.hidden;
          }
          return;
        }
        if (action === "network") {
          this.showNotification("Network connected: 100 Mbps");
          return;
        }
        if (action === "battery") {
          this.showNotification("Battery: 78% remaining");
        }
      },
      { signal }
    );

    this.volumeSliderElement.addEventListener(
      "input",
      () => {
        this.showNotification(`Volume ${this.volumeSliderElement.value}%`);
      },
      { signal }
    );

    this.rootElement.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement | null;
        const launchButton = target?.closest<HTMLElement>("[data-launch-app]");
        if (launchButton?.dataset.launchApp) {
          this.openApp(launchButton.dataset.launchApp as AppId);
          return;
        }

        if (target?.closest("[data-open-all-programs]")) {
          this.setAllProgramsOpen(true);
          return;
        }
        if (target?.closest("[data-close-all-programs]")) {
          this.setAllProgramsOpen(false);
          return;
        }
        if (target?.closest("[data-log-off]")) {
          this.callbacks.onLogOff();
          return;
        }
        if (target?.closest("[data-open-shutdown]")) {
          this.setShutdownDialogOpen(true);
          return;
        }

        if (target?.closest("[data-open-user-profile]")) {
          this.openApp("user-profile-doc");
          return;
        }

        if (target?.closest("[data-open-github]")) {
          window.open("https://github.com/rahil1202/windowsxp", "_blank", "noopener,noreferrer");
          this.showNotification("Opened GitHub repository");
          return;
        }

        const shutdownAction = target?.closest<HTMLElement>("[data-shutdown-action]")?.dataset.shutdownAction;
        if (shutdownAction) {
          this.handleShutdownAction(shutdownAction);
          return;
        }

        const menuAction = target?.closest<HTMLElement>("[data-menu-action]")?.dataset.menuAction;
        if (menuAction) {
          this.handleMenuAction(menuAction);
        }
      },
      { signal }
    );

    this.rootElement.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target as HTMLElement | null;
        const icon = target?.closest<HTMLElement>("[data-desktop-icon]");

        if (this.screensaverActive) {
          this.stopScreensaver();
          return;
        }

        if (!icon && !target?.closest(".xp-desktop-context-menu")) {
          this.hideDesktopContextMenu();
        }
        if (!icon && !target?.closest(".xp-start-menu") && !target?.closest("[data-start-button]")) {
          this.setStartMenuOpen(false);
        }
        if (!target?.closest(".xp-shutdown-dialog") && !target?.closest("[data-open-shutdown]")) {
          this.setShutdownDialogOpen(false);
        }
        if (!icon && !target?.closest(".xp-window") && !target?.closest(".xp-shell__overlay-app-host")) {
          this.selectedDesktopIconId = null;
          this.syncDesktopIconSelection();
        }
      },
      { signal }
    );

    this.desktopAreaElement.addEventListener(
      "contextmenu",
      (event) => {
        const icon = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-desktop-icon]");
        event.preventDefault();
        const appId = icon?.dataset.desktopIcon as AppId | undefined;
        if (appId) {
          this.selectedDesktopIconId = appId;
          this.syncDesktopIconSelection();
          this.showDesktopContextMenu(event.clientX, event.clientY, appId);
        } else {
          this.selectedDesktopIconId = null;
          this.syncDesktopIconSelection();
          this.showDesktopContextMenu(event.clientX, event.clientY, "desktop");
        }
      },
      { signal }
    );

    this.desktopIconsElement.addEventListener(
      "pointerdown",
      (event) => {
        const icon = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-desktop-icon]");
        if (!icon || event.button !== 0) {
          return;
        }
        const appId = icon.dataset.desktopIcon as AppId;
        const position = this.iconPositions.get(appId);
        if (!position) {
          return;
        }
        this.selectedDesktopIconId = appId;
        this.syncDesktopIconSelection();
        this.iconDragState = {
          appId,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startX: position.x,
          startY: position.y,
          active: false,
          element: icon
        };
        icon.setPointerCapture(event.pointerId);
      },
      { signal }
    );

    this.desktopIconsElement.addEventListener(
      "pointermove",
      (event) => {
        if (!this.iconDragState || this.iconDragState.pointerId !== event.pointerId) {
          return;
        }
        const dx = event.clientX - this.iconDragState.startClientX;
        const dy = event.clientY - this.iconDragState.startClientY;
        if (!this.iconDragState.active && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          this.iconDragState.active = true;
          this.iconDragState.element.classList.add("is-dragging");
        }
        if (!this.iconDragState.active) {
          return;
        }
        const nextPosition = this.clampIconPosition({
          x: this.iconDragState.startX + dx,
          y: this.iconDragState.startY + dy
        });
        this.iconPositions.set(this.iconDragState.appId, nextPosition);
        this.iconDragState.element.style.left = `${nextPosition.x}px`;
        this.iconDragState.element.style.top = `${nextPosition.y}px`;
      },
      { signal }
    );

    this.desktopIconsElement.addEventListener(
      "pointerup",
      (event) => {
        if (!this.iconDragState || this.iconDragState.pointerId !== event.pointerId) {
          return;
        }
        const dragState = this.iconDragState;
        dragState.element.releasePointerCapture(event.pointerId);
        dragState.element.classList.remove("is-dragging");
        if (dragState.active) {
          this.saveShellPrefs();
        }
        this.iconDragState = null;
      },
      { signal }
    );

    this.desktopIconsElement.addEventListener(
      "pointercancel",
      (event) => {
        if (!this.iconDragState || this.iconDragState.pointerId !== event.pointerId) {
          return;
        }
        const dragState = this.iconDragState;
        if (dragState.element.hasPointerCapture(event.pointerId)) {
          dragState.element.releasePointerCapture(event.pointerId);
        }
        dragState.element.classList.remove("is-dragging");
        this.iconDragState = null;
        this.syncDesktopIconSelection();
      },
      { signal }
    );

    this.desktopIconsElement.addEventListener(
      "dblclick",
      (event) => {
        const icon = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-desktop-icon]");
        if (!icon) {
          return;
        }
        this.openApp(icon.dataset.desktopIcon as AppId);
      },
      { signal }
    );

    this.query<HTMLElement>("[data-bsod-restart]").addEventListener(
      "click",
      () => this.callbacks.onRestart(),
      { signal }
    );
  }

  private handleShellCommand(detail: ShellCommandDetail | undefined): void {
    if (!detail?.command) {
      return;
    }
    switch (detail.command) {
      case "trigger-bsod":
        this.triggerBsod(typeof detail.payload?.reason === "string" ? detail.payload.reason : undefined);
        break;
      case "open-screensaver":
        this.startScreensaver(typeof detail.payload?.style === "string" ? (detail.payload.style as ScreensaverId) : undefined);
        break;
      case "set-screensaver-style":
        if (typeof detail.payload?.style === "string") {
          this.shellPrefs.screensaver.style = detail.payload.style as ScreensaverId;
          this.saveShellPrefs();
        }
        break;
      case "set-theme":
        this.applyTheme({
          theme: typeof detail.payload?.theme === "string" ? (detail.payload.theme as ThemeName) : this.currentTheme,
          accent: typeof detail.payload?.accent === "string" ? detail.payload.accent : undefined,
          fontSize: typeof detail.payload?.fontSize === "string" ? detail.payload.fontSize : undefined,
          highContrast: typeof detail.payload?.highContrast === "boolean" ? detail.payload.highContrast : undefined
        });
        break;
      case "set-magnifier":
        this.rootElement.classList.toggle("is-magnified", Boolean(detail.payload?.enabled));
        break;
      default:
        break;
    }
  }

  private handleShutdownAction(action: string): void {
    this.setShutdownDialogOpen(false);
    if (action === "cancel") {
      return;
    }
    if (action === "sleep") {
      this.callbacks.onSleep();
    } else if (action === "turn-off") {
      const shutdownAudio = new Audio(windowsXpShutdownSoundUrl);
      shutdownAudio.volume = 0.8;
      shutdownAudio.play().catch(() => {});
      this.callbacks.onPowerOff();
    } else if (action === "restart") {
      const shutdownAudio = new Audio(windowsXpShutdownSoundUrl);
      shutdownAudio.volume = 0.8;
      shutdownAudio.play().catch(() => {});
      this.callbacks.onRestart();
    }
  }

  private getDesktopMenuItems(target: DesktopContextMenuTarget): MenuItem[] {
    if (target === "desktop") {
      return [
        {
          label: "View",
          submenu: [
            { label: "Thumbnails", disabled: true },
            { label: "Tiles", disabled: true },
            { label: "Icons", action: "desktop-view-icons" },
            { label: "List", disabled: true },
            { label: "Details", disabled: true }
          ]
        },
        {
          label: "Sort By",
          submenu: [
            { label: "Name", action: "desktop-sort-name" },
            { label: "Type", disabled: true },
            { label: "Size", disabled: true }
          ]
        },
        {
          label: "Arrange Windows",
          submenu: [{ label: "Cascade", action: "windows-cascade" }, { label: "Tile", action: "windows-tile" }]
        },
        { label: "Refresh", action: "desktop-refresh" },
        { label: "New", submenu: [{ label: "Folder", action: "desktop-new-folder" }, { label: "Shortcut", action: "desktop-new-shortcut" }] },
        {
          label: "System Tray",
          submenu: [{ label: this.trayIconsVisible ? "Hide Tray Icons" : "Show Tray Icons", action: "tray-toggle-icons" }]
        },
        { label: "Properties", separatorBefore: true, action: "desktop-properties" }
      ];
    }

    return [
      { label: "Open", action: `icon-open:${target}` },
      { label: "Explore", action: `icon-open:${target}` },
      { label: "Cut", separatorBefore: true, disabled: true },
      { label: "Copy", disabled: true },
      { label: "Create Shortcut", separatorBefore: true, disabled: true },
      { label: "Delete", disabled: true },
      { label: "Rename", disabled: true },
      { label: "Properties", separatorBefore: true, action: `icon-properties:${target}` }
    ];
  }

  private showDesktopContextMenu(x: number, y: number, target: DesktopContextMenuTarget): void {
    this.desktopContextMenuElement.innerHTML = this.renderMenuItems(this.getDesktopMenuItems(target), true);
    const areaRect = this.desktopAreaElement.getBoundingClientRect();
    const left = Math.min(Math.max(0, x - areaRect.left), Math.max(0, areaRect.width - 220));
    const top = Math.min(Math.max(0, y - areaRect.top), Math.max(0, areaRect.height - 280));
    this.desktopContextMenuElement.style.left = `${left}px`;
    this.desktopContextMenuElement.style.top = `${top}px`;
    this.desktopContextMenuElement.classList.add("is-open");
    this.desktopContextMenuElement.setAttribute("aria-hidden", "false");
  }

  private renderMenuItems(items: MenuItem[], root = false): string {
    const markup = items
      .map((item) => {
        const classes = ["xp-desktop-context-menu__item"];
        if (item.disabled) {
          classes.push("xp-desktop-context-menu__item--disabled");
        }
        if (item.submenu) {
          classes.push("xp-desktop-context-menu__item--submenu");
        }
        const separator = item.separatorBefore ? `<div class="xp-desktop-context-menu__separator"></div>` : "";
        const submenu = item.submenu
          ? `<div class="xp-desktop-context-menu__submenu">${this.renderMenuItems(item.submenu)}</div>`
          : "";
        return `
          ${separator}
          <div class="${classes.join(" ")}">
            <button
              type="button"
              class="xp-desktop-context-menu__button"
              ${item.disabled ? "disabled" : ""}
              ${item.action ? `data-menu-action="${item.action}"` : ""}
            >
              <span class="xp-desktop-context-menu__gutter">${item.icon ? `<img src="${item.icon}" alt="" />` : ""}</span>
              <span class="xp-desktop-context-menu__label">${item.label}</span>
              ${item.submenu ? `<span class="xp-desktop-context-menu__arrow">▶</span>` : ""}
            </button>
            ${submenu}
          </div>
        `;
      })
      .join("");
    return root ? `<div class="xp-desktop-context-menu__menu">${markup}</div>` : markup;
  }

  private handleMenuAction(action: string): void {
    this.hideDesktopContextMenu();
    if (action === "desktop-refresh" || action === "desktop-view-icons") {
      this.renderDesktopIcons();
      return;
    }
    if (action === "desktop-sort-name") {
      this.arrangeDesktopIcons("title");
      this.saveShellPrefs();
      this.renderDesktopIcons();
      return;
    }
    if (action === "desktop-properties") {
      this.openApp("display-properties");
      return;
    }
    if (action === "desktop-new-folder") {
      this.ensureDesktopShortcut("folder");
      this.showNotification("New folder created on desktop");
      return;
    }
    if (action === "desktop-new-shortcut") {
      this.ensureDesktopShortcut("desktop-shortcuts");
      this.showNotification("Shortcut created on desktop");
      return;
    }
    if (action === "tray-toggle-icons") {
      this.trayIconsVisible = !this.trayIconsVisible;
      this.trayIconsElement.classList.toggle("is-hidden", !this.trayIconsVisible);
      return;
    }
    if (action === "windows-cascade") {
      this.cascadeWindows();
      return;
    }
    if (action === "windows-tile") {
      this.tileWindows();
      return;
    }
    if (action.startsWith("icon-open:")) {
      this.openApp(action.slice("icon-open:".length) as AppId);
      return;
    }
    if (action.startsWith("icon-properties:")) {
      this.openApp("control-panel");
    }
  }

  private hideDesktopContextMenu(): void {
    this.desktopContextMenuElement.classList.remove("is-open");
    this.desktopContextMenuElement.setAttribute("aria-hidden", "true");
  }

  private setStartMenuOpen(open: boolean): void {
    this.startMenuElement.setAttribute("aria-hidden", String(!open));
    this.startButtonElement.setAttribute("aria-expanded", String(open));
    this.startMenuElement.classList.toggle("is-open", open);
    if (!open) {
      this.setAllProgramsOpen(false);
    }
  }

  private setAllProgramsOpen(open: boolean): void {
    this.allProgramsPanelElement.setAttribute("aria-hidden", String(!open));
    this.allProgramsPanelElement.classList.toggle("is-open", open);
    const button = this.query<HTMLElement>("[data-open-all-programs]");
    button.setAttribute("aria-expanded", String(open));
  }

  private setShutdownDialogOpen(open: boolean): void {
    this.shutdownDialogElement.setAttribute("aria-hidden", String(!open));
    this.shutdownDialogElement.classList.toggle("is-open", open);
  }

  private createInitialRect(definition: AppDefinition): WindowState["rect"] {
    const desktopRect = this.desktopAreaElement.getBoundingClientRect();
    const offset = this.windows.size * 26;
    const width = Math.min(definition.defaultWindow.width, Math.max(320, desktopRect.width - 48));
    const height = Math.min(definition.defaultWindow.height, Math.max(220, desktopRect.height - 64));
    return {
      x: Math.max(8, (desktopRect.width - width) / 2 + offset),
      y: Math.max(8, 48 + offset),
      width,
      height
    };
  }

  private createWindow(definition: AppDefinition, state: WindowState): ManagedWindow {
    const element = document.createElement("section");
    element.className = "xp-window";
    element.dataset.appId = definition.id;
    element.innerHTML = `
      <div class="xp-window__titlebar" data-window-drag>
        <div class="xp-window__title">
          <span class="xp-window__title-icon" style="background-image:url('${definition.icon}')"></span>
          <span>${state.title}</span>
        </div>
        <div class="xp-window__controls">
          <button type="button" data-window-action="minimize" aria-label="Minimize">_</button>
          <button type="button" data-window-action="maximize" aria-label="Maximize">□</button>
          <button type="button" data-window-action="close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="xp-window__content" data-app-id="${definition.id}">
        <div class="xp-window__loading">Loading ${definition.title}...</div>
      </div>
    `;

    const titleLabel = element.querySelector<HTMLElement>(".xp-window__title span:last-child");
    const content = element.querySelector<HTMLElement>(".xp-window__content");
    if (!titleLabel || !content) {
      throw new Error(`Failed to build window shell for ${definition.id}`);
    }

    const taskbarButton = this.createTaskbarButton(definition);

    element.addEventListener("pointerdown", () => {
      this.focusWindow(definition.id);
    });

    const titlebar = element.querySelector<HTMLElement>("[data-window-drag]");
    titlebar?.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (event.button !== 0 || state.maximized || target?.closest("[data-window-action]")) {
        return;
      }
      const current = this.windows.get(definition.id);
      if (!current) {
        return;
      }
      this.focusWindow(definition.id);
      titlebar.setPointerCapture(event.pointerId);
      this.windowDragState = {
        appId: definition.id,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: { ...current.state.rect }
      };
    });

    titlebar?.addEventListener("pointermove", (event) => {
      if (!this.windowDragState || this.windowDragState.appId !== definition.id || this.windowDragState.pointerId !== event.pointerId) {
        return;
      }
      const windowItem = this.windows.get(definition.id);
      if (!windowItem) {
        return;
      }
      const desktopRect = this.desktopAreaElement.getBoundingClientRect();
      const dx = event.clientX - this.windowDragState.startClientX;
      const dy = event.clientY - this.windowDragState.startClientY;
      windowItem.state.rect.x = Math.min(
        Math.max(0, this.windowDragState.startRect.x + dx),
        Math.max(0, desktopRect.width - windowItem.state.rect.width)
      );
      windowItem.state.rect.y = Math.min(
        Math.max(0, this.windowDragState.startRect.y + dy),
        Math.max(0, desktopRect.height - 64)
      );
      this.layoutWindow(windowItem);
    });

    titlebar?.addEventListener("pointerup", (event) => {
      if (this.windowDragState?.pointerId === event.pointerId) {
        const windowItem = this.windows.get(definition.id);
        if (windowItem) {
          this.snapWindowPosition(windowItem);
          this.layoutWindow(windowItem);
        }
        titlebar.releasePointerCapture(event.pointerId);
        this.windowDragState = null;
      }
    });

    element.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-window-action]")?.dataset.windowAction;
      if (!action) {
        return;
      }
      if (action === "minimize") {
        this.minimizeWindow(definition.id);
      } else if (action === "maximize") {
        this.toggleMaximizeWindow(definition.id);
      } else if (action === "close") {
        this.closeWindow(definition.id);
      }
    });

    taskbarButton.addEventListener("click", () => {
      this.toggleTaskbarWindow(definition.id);
    });

    return {
      definition,
      state,
      element,
      titleLabel,
      content,
      taskbarButton,
      instance: null,
      normalRect: null
    };
  }

  private createTaskbarButton(definition: AppDefinition): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xp-taskbar__app";
    button.dataset.appId = definition.id;
    button.innerHTML = `
      <span class="xp-taskbar__app-icon" style="background-image:url('${definition.icon}')"></span>
      <span>${definition.title}</span>
    `;
    return button;
  }

  private async mountWindow(windowItem: ManagedWindow): Promise<void> {
    const module = await windowItem.definition.load();
    if (!this.windows.has(windowItem.definition.id)) {
      this.setBusyCursor(false);
      return;
    }
    const ctx: AppHostContext = {
      requestFocus: () => this.focusWindow(windowItem.definition.id),
      updateTitle: (title: string) => {
        windowItem.state.title = title;
        windowItem.titleLabel.textContent = title;
        const taskbarLabel = windowItem.taskbarButton.querySelector("span:last-child");
        if (taskbarLabel) {
          taskbarLabel.textContent = title;
        }
      },
      close: () => this.closeWindow(windowItem.definition.id),
      minimize: () => this.minimizeWindow(windowItem.definition.id),
      maximize: () => this.toggleMaximizeWindow(windowItem.definition.id),
      isMobile: this.isMobileViewport()
    };
    windowItem.content.innerHTML = "";
    windowItem.instance = module.mount(windowItem.content, ctx);
    this.notifyWindowResize(windowItem);
    windowItem.instance.onFocus?.();
    this.setBusyCursor(false);
    this.flashTaskbarButton(windowItem.definition.id);
    this.showNotification(`${windowItem.definition.title} opened`);
  }

  private focusWindow(appId: AppId): void {
    for (const windowItem of this.windows.values()) {
      const focused = windowItem.definition.id === appId && !windowItem.state.minimized;
      if (windowItem.state.focused !== focused) {
        if (focused) {
          windowItem.instance?.onFocus?.();
        } else if (windowItem.state.focused) {
          windowItem.instance?.onBlur?.();
        }
      }
      windowItem.state.focused = focused;
      if (focused) {
        windowItem.state.zIndex = ++this.topZIndex;
      }
      windowItem.element.classList.toggle("is-focused", focused);
      windowItem.taskbarButton.classList.toggle("is-focused", focused && !windowItem.state.minimized);
      this.layoutWindow(windowItem);
    }

    if (this.desktopOverlayApp) {
      const focused = this.desktopOverlayApp.definition.id === appId && !this.desktopOverlayApp.minimized;
      this.desktopOverlayApp.focused = focused;
      this.desktopOverlayApp.taskbarButton.classList.toggle("is-focused", focused);
      if (focused) {
        this.desktopOverlayApp.instance?.onFocus?.();
      } else {
        this.desktopOverlayApp.instance?.onBlur?.();
      }
    }
  }

  private layoutWindow(windowItem: ManagedWindow): void {
    const { element, state } = windowItem;
    element.style.zIndex = String(state.zIndex);
    element.classList.toggle("is-focused", state.focused);
    element.style.display = state.minimized ? "none" : "block";

    if (state.maximized || this.isMobileViewport()) {
      element.style.left = "0px";
      element.style.top = "0px";
      element.style.width = "100%";
      element.style.height = "100%";
    } else {
      element.style.left = `${state.rect.x}px`;
      element.style.top = `${state.rect.y}px`;
      element.style.width = `${state.rect.width}px`;
      element.style.height = `${state.rect.height}px`;
    }
  }

  private minimizeWindow(appId: AppId): void {
    const windowItem = this.windows.get(appId);
    if (!windowItem) {
      return;
    }
    windowItem.element.classList.add("is-minimizing");
    window.setTimeout(() => windowItem.element.classList.remove("is-minimizing"), 220);
    windowItem.state.minimized = true;
    windowItem.state.focused = false;
    windowItem.instance?.onBlur?.();
    this.layoutWindow(windowItem);
    windowItem.taskbarButton.classList.remove("is-focused");
  }

  private toggleMaximizeWindow(appId: AppId): void {
    const windowItem = this.windows.get(appId);
    if (!windowItem) {
      return;
    }
    windowItem.element.classList.add("is-scaling");
    window.setTimeout(() => windowItem.element.classList.remove("is-scaling"), 240);
    if (!windowItem.state.maximized) {
      windowItem.normalRect = { ...windowItem.state.rect };
      windowItem.state.maximized = true;
    } else {
      windowItem.state.maximized = false;
      if (windowItem.normalRect) {
        windowItem.state.rect = { ...windowItem.normalRect };
      }
    }
    this.layoutWindow(windowItem);
    this.notifyWindowResize(windowItem);
  }

  private closeWindow(appId: AppId): void {
    const windowItem = this.windows.get(appId);
    if (!windowItem) {
      return;
    }
    windowItem.instance?.unmount();
    windowItem.taskbarButton.remove();
    windowItem.element.remove();
    this.windows.delete(appId);
    this.showNotification(`${windowItem.definition.title} closed`);
  }

  private toggleTaskbarWindow(appId: AppId): void {
    const windowItem = this.windows.get(appId);
    if (windowItem) {
      if (windowItem.state.minimized) {
        windowItem.state.minimized = false;
        this.focusWindow(appId);
      } else if (windowItem.state.focused) {
        this.minimizeWindow(appId);
      } else {
        this.focusWindow(appId);
      }
      this.layoutWindow(windowItem);
      return;
    }

    if (this.desktopOverlayApp?.definition.id === appId) {
      if (this.desktopOverlayApp.minimized) {
        this.desktopOverlayApp.minimized = false;
        this.desktopOverlayApp.focused = true;
        this.desktopOverlayApp.host.style.display = "block";
        this.desktopOverlayApp.taskbarButton.classList.add("is-focused");
        this.desktopOverlayApp.instance?.onDesktopShown?.();
        this.desktopOverlayApp.instance?.onFocus?.();
      } else if (this.desktopOverlayApp.focused) {
        this.desktopOverlayApp.minimized = true;
        this.desktopOverlayApp.focused = false;
        this.desktopOverlayApp.host.style.display = "none";
        this.desktopOverlayApp.taskbarButton.classList.remove("is-focused");
        this.desktopOverlayApp.instance?.onBlur?.();
      } else {
        this.desktopOverlayApp.focused = true;
        this.desktopOverlayApp.taskbarButton.classList.add("is-focused");
        this.desktopOverlayApp.instance?.onFocus?.();
      }
    }
  }

  private async mountOverlayApp(definition: AppDefinition): Promise<void> {
    if (this.desktopOverlayApp && this.desktopOverlayApp.definition.id === definition.id) {
      this.desktopOverlayApp.minimized = false;
      this.desktopOverlayApp.focused = true;
      this.desktopOverlayApp.host.style.display = "block";
      this.desktopOverlayApp.taskbarButton.classList.add("is-focused");
      this.desktopOverlayApp.instance?.onDesktopShown?.();
      this.desktopOverlayApp.instance?.onFocus?.();
      return;
    }

    this.closeOverlayApp();
    const host = document.createElement("section");
    host.className = "xp-shell__overlay-app-host";
    host.dataset.appId = definition.id;
    this.overlayLayerElement.appendChild(host);
    const taskbarButton = this.createTaskbarButton(definition);
    this.taskbarAppsElement.appendChild(taskbarButton);

    const overlayApp: ManagedOverlayApp = {
      definition,
      host,
      taskbarButton,
      instance: null,
      minimized: false,
      focused: true
    };
    this.desktopOverlayApp = overlayApp;

    taskbarButton.addEventListener("click", () => {
      this.toggleTaskbarWindow(definition.id);
    });

    const module = await definition.load();
    if (!this.desktopOverlayApp || this.desktopOverlayApp.definition.id !== definition.id) {
      return;
    }
    const ctx: AppHostContext = {
      requestFocus: () => {
        if (this.desktopOverlayApp) {
          this.desktopOverlayApp.focused = true;
          this.desktopOverlayApp.taskbarButton.classList.add("is-focused");
        }
      },
      updateTitle: (title: string) => {
        const taskbarLabel = taskbarButton.querySelector("span:last-child");
        if (taskbarLabel) {
          taskbarLabel.textContent = title;
        }
      },
      close: () => this.closeOverlayApp(),
      minimize: () => this.toggleTaskbarWindow(definition.id),
      maximize: () => {
        if (this.desktopOverlayApp) {
          this.desktopOverlayApp.minimized = false;
          this.desktopOverlayApp.host.style.display = "block";
        }
      },
      isMobile: this.isMobileViewport()
    };
    overlayApp.instance = module.mount(host, ctx);
    overlayApp.taskbarButton.classList.add("is-focused");
    overlayApp.instance.onDesktopShown?.();
    overlayApp.instance.onFocus?.();
  }

  private closeOverlayApp(): void {
    if (!this.desktopOverlayApp) {
      return;
    }
    this.desktopOverlayApp.instance?.unmount();
    this.desktopOverlayApp.taskbarButton.remove();
    this.desktopOverlayApp.host.remove();
    this.desktopOverlayApp = null;
  }

  private notifyWindowResize(windowItem: ManagedWindow): void {
    const size = windowItem.state.maximized || this.isMobileViewport()
      ? this.desktopAreaElement.getBoundingClientRect()
      : { width: windowItem.state.rect.width, height: windowItem.state.rect.height };
    windowItem.instance?.onResize?.({
      width: Math.round(size.width),
      height: Math.round(size.height - 29),
      maximized: windowItem.state.maximized || this.isMobileViewport()
    });
  }

  private updateClock(): void {
    const now = new Date();
    this.clockTimeElement.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    this.clockDateElement.textContent = now.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
  }

  private setBusyCursor(active: boolean): void {
    this.rootElement.classList.toggle("is-busy", active);
  }

  private showNotification(message: string): void {
    const toast = document.createElement("div");
    toast.className = "xp-toast";
    toast.textContent = message;
    this.notificationLayerElement.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  private flashTaskbarButton(appId: AppId): void {
    const windowItem = this.windows.get(appId);
    if (!windowItem || windowItem.state.focused) {
      return;
    }
    windowItem.taskbarButton.classList.add("is-attention");
    window.setTimeout(() => windowItem.taskbarButton.classList.remove("is-attention"), 1200);
  }

  private ensureDesktopShortcut(appId: AppId): void {
    const definition = appRegistryById.get(appId);
    if (!definition) {
      return;
    }
    if (!definition.desktopShortcut) {
      definition.desktopShortcut = { x: DESKTOP_ICON_START_X, y: DESKTOP_ICON_START_Y };
    }
    if (!this.iconPositions.has(appId)) {
      const desktopRect = this.desktopAreaElement.getBoundingClientRect();
      this.iconPositions.set(appId, this.clampIconPosition({
        x: Math.min(desktopRect.width - DESKTOP_ICON_WIDTH, DESKTOP_ICON_START_X + 420),
        y: Math.min(desktopRect.height - DESKTOP_ICON_HEIGHT - 36, DESKTOP_ICON_START_Y + 240)
      }));
    }
    if (!this.shellPrefs.customDesktopShortcuts.includes(appId)) {
      this.shellPrefs.customDesktopShortcuts.push(appId);
    }
    this.saveShellPrefs();
    this.renderDesktopIcons();
  }

  private cascadeWindows(): void {
    let offset = 0;
    for (const windowItem of this.windows.values()) {
      if (windowItem.state.minimized) {
        continue;
      }
      windowItem.state.maximized = false;
      windowItem.state.rect.x = 32 + offset;
      windowItem.state.rect.y = 48 + offset;
      this.layoutWindow(windowItem);
      offset += 28;
    }
  }

  private tileWindows(): void {
    const visible = [...this.windows.values()].filter((item) => !item.state.minimized);
    if (visible.length === 0) {
      return;
    }
    const desktopRect = this.desktopAreaElement.getBoundingClientRect();
    const columns = Math.ceil(Math.sqrt(visible.length));
    const rows = Math.ceil(visible.length / columns);
    const width = Math.floor(desktopRect.width / columns);
    const height = Math.floor(desktopRect.height / rows);
    visible.forEach((windowItem, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      windowItem.state.maximized = false;
      windowItem.state.rect = {
        x: col * width,
        y: row * height,
        width: Math.max(320, width),
        height: Math.max(220, height)
      };
      this.layoutWindow(windowItem);
      this.notifyWindowResize(windowItem);
    });
  }

  private snapWindowPosition(windowItem: ManagedWindow): void {
    const desktopRect = this.desktopAreaElement.getBoundingClientRect();
    const grid = 16;
    const snappedX = Math.round(windowItem.state.rect.x / grid) * grid;
    const snappedY = Math.round(windowItem.state.rect.y / grid) * grid;

    if (windowItem.state.rect.x <= 24) {
      windowItem.state.rect.x = 0;
      windowItem.state.rect.y = 0;
      windowItem.state.rect.width = Math.floor(desktopRect.width / 2);
      windowItem.state.rect.height = desktopRect.height;
      return;
    }
    if (windowItem.state.rect.x + windowItem.state.rect.width >= desktopRect.width - 24) {
      windowItem.state.rect.x = Math.floor(desktopRect.width / 2);
      windowItem.state.rect.y = 0;
      windowItem.state.rect.width = Math.floor(desktopRect.width / 2);
      windowItem.state.rect.height = desktopRect.height;
      return;
    }

    windowItem.state.rect.x = Math.max(0, Math.min(snappedX, desktopRect.width - windowItem.state.rect.width));
    windowItem.state.rect.y = Math.max(0, Math.min(snappedY, desktopRect.height - windowItem.state.rect.height));
  }

  private cycleAltTab(direction: 1 | -1): void {
    this.altTabOrder = [...this.windows.values()]
      .filter((item) => !item.state.minimized)
      .sort((a, b) => b.state.zIndex - a.state.zIndex)
      .map((item) => item.definition.id);
    if (this.altTabOrder.length === 0) {
      return;
    }
    this.altTabIndex = (this.altTabIndex + direction + this.altTabOrder.length) % this.altTabOrder.length;
    this.renderAltTabOverlay();
  }

  private renderAltTabOverlay(): void {
    if (!this.altHeld || this.altTabOrder.length === 0) {
      this.altTabElement.setAttribute("aria-hidden", "true");
      this.altTabElement.classList.remove("is-visible");
      this.altTabElement.innerHTML = "";
      return;
    }
    this.altTabElement.classList.add("is-visible");
    this.altTabElement.setAttribute("aria-hidden", "false");
    const selectedAppId = this.altTabOrder[this.altTabIndex];
    const selectedWindow = selectedAppId ? this.windows.get(selectedAppId) : null;
    const selectedExcerpt = selectedWindow
      ? (selectedWindow.content.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 220)
      : "";
    this.altTabElement.innerHTML = `
      <div class="xp-shell__alt-tab-panel">
        <div class="xp-shell__alt-tab-preview">
          <h3>${selectedWindow?.definition.title ?? "Window Switcher"}</h3>
          <p>${selectedExcerpt || "Live preview unavailable for this window."}</p>
        </div>
        ${this.altTabOrder
          .map((appId, index) => {
            const app = appRegistryById.get(appId);
            const windowItem = this.windows.get(appId);
            const excerpt = windowItem
              ? (windowItem.content.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 72)
              : "";
            if (!app) return "";
            return `<button type="button" class="xp-shell__alt-tab-item${index === this.altTabIndex ? " is-selected" : ""}">
              <span style="background-image:url('${app.icon}')"></span>
              <strong>${app.title}</strong>
              <em>${excerpt || "App window"}</em>
            </button>`;
          })
          .join("")}
      </div>
    `;
  }

  private commitAltTabSelection(): void {
    if (this.altTabOrder.length > 0) {
      const target = this.altTabOrder[this.altTabIndex] as AppId;
      this.focusWindow(target);
      const windowItem = this.windows.get(target);
      if (windowItem) {
        windowItem.state.minimized = false;
        this.layoutWindow(windowItem);
      }
    }
    this.altTabOrder = [];
    this.altTabIndex = 0;
    this.renderAltTabOverlay();
  }

  private applyTheme(options: {
    theme: ThemeName;
    accent?: string;
    fontSize?: string;
    highContrast?: boolean;
    notify?: boolean;
  }): void {
    this.currentTheme = options.theme;
    this.rootElement.dataset.theme = options.theme;
    if (options.accent) {
      this.rootElement.style.setProperty("--xp-accent", options.accent);
    }
    if (options.fontSize) {
      const size = options.fontSize === "small" ? "11px" : options.fontSize === "large" ? "14px" : "12px";
      this.rootElement.style.setProperty("--xp-font-size", size);
    }
    if (typeof options.highContrast === "boolean") {
      this.rootElement.classList.toggle("is-high-contrast", options.highContrast);
    }
    if (options.notify !== false) {
      this.showNotification(`Theme set to ${options.theme}`);
    }
  }

  private isMobileViewport(): boolean {
    return window.innerWidth <= 900;
  }

  private clampIconPosition(position: DesktopIconPosition): DesktopIconPosition {
    const rect = this.desktopAreaElement.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, position.x), Math.max(0, rect.width - DESKTOP_ICON_WIDTH)),
      y: Math.min(Math.max(0, position.y), Math.max(0, rect.height - DESKTOP_ICON_HEIGHT - 36))
    };
  }

  private arrangeDesktopIcons(mode: "registry" | "title"): void {
    const desktopShortcuts = appRegistry.filter((definition) => definition.desktopShortcut);
    const ordered = mode === "title"
      ? [...desktopShortcuts].sort((left, right) => left.title.localeCompare(right.title))
      : desktopShortcuts;

    const desktopRect = this.desktopAreaElement.getBoundingClientRect();
    const maxRows = Math.max(
      1,
      Math.floor((desktopRect.height - DESKTOP_ICON_START_Y - 52) / DESKTOP_ICON_ROW_GAP) + 1
    );

    ordered.forEach((definition, index) => {
      const column = Math.floor(index / maxRows);
      const row = index % maxRows;
      const snappedPosition = this.clampIconPosition({
        x: DESKTOP_ICON_START_X + column * DESKTOP_ICON_COLUMN_GAP,
        y: DESKTOP_ICON_START_Y + row * DESKTOP_ICON_ROW_GAP
      });
      this.iconPositions.set(definition.id, snappedPosition);
    });
  }

  private markUserActivity(): void {
    if (this.bsodActive) {
      return;
    }
    if (this.screensaverActive) {
      this.stopScreensaver(true);
      return;
    }
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    window.clearTimeout(this.idleTimer);
    if (!this.shellPrefs.screensaver.enabled || this.screensaverActive) {
      return;
    }
    this.idleTimer = window.setTimeout(() => {
      this.startScreensaver();
    }, this.shellPrefs.screensaver.timeoutMs);
  }

  private resizeScreensaverCanvas(): void {
    const shellSurface = this.rootElement.querySelector<HTMLElement>(".xp-shell") ?? this.rootElement;
    const rect = shellSurface.getBoundingClientRect();
    this.screensaverCanvasElement.width = Math.max(1, Math.floor(rect.width));
    this.screensaverCanvasElement.height = Math.max(1, Math.floor(rect.height));
  }

  private startScreensaver(style = this.shellPrefs.screensaver.style): void {
    if (this.bsodActive) {
      return;
    }
    this.shellPrefs.screensaver.style = style;
    this.saveShellPrefs();
    this.resizeScreensaverCanvas();
    this.screensaverStart = performance.now();
    this.screensaverTextPhase = 0;
    if (style === "starfield") {
      this.screensaverStars = Array.from({ length: 120 }, () => ({
        x: Math.random() * this.screensaverCanvasElement.width - this.screensaverCanvasElement.width / 2,
        y: Math.random() * this.screensaverCanvasElement.height - this.screensaverCanvasElement.height / 2,
        z: Math.random() * this.screensaverCanvasElement.width
      }));
    }
    this.screensaverLayerElement.classList.add("is-active");
    this.screensaverLayerElement.setAttribute("aria-hidden", "false");
    this.screensaverActive = true;
    this.animateScreensaver();
  }

  private stopScreensaver(logOffAfterWake = false): void {
    if (!this.screensaverActive) {
      return;
    }
    this.screensaverActive = false;
    this.screensaverLayerElement.classList.remove("is-active");
    this.screensaverLayerElement.setAttribute("aria-hidden", "true");
    window.cancelAnimationFrame(this.screensaverFrame);
    if (logOffAfterWake) {
      this.callbacks.onLogOff();
      return;
    }
    this.resetIdleTimer();
  }

  private animateScreensaver(): void {
    if (!this.screensaverActive) {
      return;
    }
    const context = this.screensaverCanvasElement.getContext("2d");
    if (!context) {
      return;
    }
    const width = this.screensaverCanvasElement.width;
    const height = this.screensaverCanvasElement.height;
    const elapsed = (performance.now() - this.screensaverStart) / 1000;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);

    switch (this.shellPrefs.screensaver.style) {
      case "mystify":
        this.drawMystify(context, width, height, elapsed);
        break;
      case "starfield":
        this.drawStarfield(context, width, height);
        break;
      case "text-3d":
        this.drawTextSaver(context, width, height, elapsed);
        break;
      case "bouncing-logo":
        this.drawBouncingLogo(context, width, height, elapsed);
        break;
    }

    this.screensaverFrame = window.requestAnimationFrame(() => this.animateScreensaver());
  }

  private drawMystify(context: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
    for (let index = 0; index < 4; index += 1) {
      context.strokeStyle = `hsla(${(elapsed * 50 + index * 90) % 360} 100% 60% / 0.86)`;
      context.lineWidth = 2;
      context.beginPath();
      for (let point = 0; point < 5; point += 1) {
        const x = width / 2 + Math.sin(elapsed * (0.7 + point * 0.12) + index) * width * (0.1 + point * 0.09);
        const y = height / 2 + Math.cos(elapsed * (0.9 + point * 0.1) + index * 1.4) * height * (0.08 + point * 0.09);
        if (point === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
      context.stroke();
    }
  }

  private drawStarfield(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.translate(width / 2, height / 2);
    for (const star of this.screensaverStars) {
      star.z -= 10;
      if (star.z <= 1) {
        star.x = Math.random() * width - width / 2;
        star.y = Math.random() * height - height / 2;
        star.z = width;
      }
      const sx = (star.x / star.z) * width;
      const sy = (star.y / star.z) * height;
      const radius = (1 - star.z / width) * 3;
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(sx, sy, Math.max(0.7, radius), 0, Math.PI * 2);
      context.fill();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawTextSaver(context: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
    const words = ["Windows XP", "Professional", "Now Playing"];
    this.screensaverTextPhase = (this.screensaverTextPhase + 0.02) % words.length;
    const word = words[Math.floor(this.screensaverTextPhase)];
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.font = "bold 72px Tahoma";
    context.textAlign = "center";
    context.fillText(word, width / 2 + Math.sin(elapsed) * 80, height / 2 + Math.cos(elapsed * 1.4) * 60);
    context.fillStyle = "#6ec8ff";
    context.fillText(word, width / 2, height / 2);
  }

  private drawBouncingLogo(context: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
    const size = Math.min(180, width * 0.25);
    const x = ((elapsed * 120) % Math.max(1, width - size)) + 10;
    const y = ((elapsed * 96) % Math.max(1, height - size * 0.52)) + 10;
    context.drawImage(this.screensaverLogo, x, y, size, size * 0.52);
  }

  private triggerBsod(_reason?: string): void {
    if (this.bsodActive) {
      return;
    }
    this.stopScreensaver(false);
    this.hideDesktopContextMenu();
    this.setStartMenuOpen(false);
    this.setShutdownDialogOpen(false);
    this.bsodActive = true;
    this.bsodElement.classList.add("is-active");
    this.bsodElement.setAttribute("aria-hidden", "false");
  }
}
