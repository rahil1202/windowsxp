export interface MenuButtonSpec {
  label: string;
  title?: string;
  onClick: () => void;
}

export interface ToolbarButtonSpec {
  label: string;
  onClick: () => void;
  active?: boolean;
}

export interface XpGameShell {
  root: HTMLElement;
  toolbar: HTMLElement;
  body: HTMLElement;
  statusLeft: HTMLElement;
  statusRight: HTMLElement;
  setToolbar(buttons: ToolbarButtonSpec[]): void;
  setStatus(left: string, right?: string): void;
  destroy(): void;
}

export function createXpGameShell(
  host: HTMLElement,
  options: {
    className: string;
    menuButtons: MenuButtonSpec[];
    toolbarButtons?: ToolbarButtonSpec[];
    statusLeft?: string;
    statusRight?: string;
  }
): XpGameShell {
  host.innerHTML = `
    <section class="xp-game-shell ${options.className}" tabindex="0">
      <div class="xp-game-shell__menu" data-menu></div>
      <div class="xp-game-shell__toolbar" data-toolbar></div>
      <div class="xp-game-shell__body" data-body></div>
      <div class="xp-game-shell__status">
        <span data-status-left>${options.statusLeft ?? "Ready."}</span>
        <span data-status-right>${options.statusRight ?? ""}</span>
      </div>
    </section>
  `;

  const root = host.querySelector<HTMLElement>(".xp-game-shell");
  const menu = host.querySelector<HTMLElement>("[data-menu]");
  const toolbar = host.querySelector<HTMLElement>("[data-toolbar]");
  const body = host.querySelector<HTMLElement>("[data-body]");
  const statusLeft = host.querySelector<HTMLElement>("[data-status-left]");
  const statusRight = host.querySelector<HTMLElement>("[data-status-right]");

  if (!root || !menu || !toolbar || !body || !statusLeft || !statusRight) {
    throw new Error("XP game shell failed to mount");
  }

  const attachMenuButtons = () => {
    menu.innerHTML = "";
    for (const item of options.menuButtons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-game-shell__menu-button";
      button.textContent = item.label;
      if (item.title) {
        button.title = item.title;
      }
      button.addEventListener("click", item.onClick);
      menu.appendChild(button);
    }
  };

  const setToolbar = (buttons: ToolbarButtonSpec[]) => {
    toolbar.innerHTML = "";
    for (const item of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-game-shell__toolbar-button";
      button.textContent = item.label;
      button.addEventListener("click", item.onClick);
      button.classList.toggle("is-active", Boolean(item.active));
      toolbar.appendChild(button);
    }
    toolbar.classList.toggle("is-hidden", buttons.length === 0);
  };

  const setStatus = (left: string, right = statusRight.textContent ?? "") => {
    statusLeft.textContent = left;
    statusRight.textContent = right;
  };

  root.addEventListener("pointerdown", () => root.focus());
  attachMenuButtons();
  setToolbar(options.toolbarButtons ?? []);

  return {
    root,
    toolbar,
    body,
    statusLeft,
    statusRight,
    setToolbar,
    setStatus,
    destroy() {
      host.innerHTML = "";
    }
  };
}
