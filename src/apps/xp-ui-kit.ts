import {
  desktopWallpaperUrl,
  hammerToolIconUrl,
  systemIconUrls,
  windowsXpLogoUrl
} from "../assets";

interface SidebarSection {
  title: string;
  items: string[];
}

interface ExplorerItem {
  title: string;
  meta?: string;
  icon?: string;
}

export interface ExplorerMockConfig {
  kind: "explorer";
  title: string;
  address: string;
  caption: string;
  sidebar: SidebarSection[];
  groups: Array<{
    title: string;
    items: ExplorerItem[];
  }>;
  status: string;
}

export interface BrowserMockConfig {
  kind: "browser";
  title: string;
  address: string;
  heading: string;
  body: string;
  links: string[];
  status: string;
}

export type XpMockConfig = ExplorerMockConfig | BrowserMockConfig;

function toolbarButton(label: string, className = ""): string {
  const classes = ["xp-ui-toolbar__button", className].filter(Boolean).join(" ");
  return `
    <button type="button" class="${classes}" aria-hidden="true">
      <span class="xp-ui-toolbar__button-icon"></span>
      <span class="xp-ui-toolbar__button-label">${label}</span>
    </button>
  `;
}

function renderMenuBar(items: string[]): string {
  return `<div class="xp-ui-menubar">${items
    .map((item) => `<button type="button" class="xp-ui-menubar__item" aria-hidden="true">${item}</button>`)
    .join("")}</div>`;
}

function renderToolbarRow(address: string, title: string): string {
  return `
    <div class="xp-ui-toolbar">
      <div class="xp-ui-toolbar__cluster">
        ${toolbarButton("Back", "xp-ui-toolbar__button--back")}
        ${toolbarButton("Forward", "xp-ui-toolbar__button--forward is-disabled")}
        ${toolbarButton("Up", "xp-ui-toolbar__button--up")}
        ${toolbarButton("Search", "xp-ui-toolbar__button--search")}
        ${toolbarButton("Folders", "xp-ui-toolbar__button--folders")}
      </div>
      <div class="xp-ui-toolbar__cluster xp-ui-toolbar__cluster--address">
        <label class="xp-ui-toolbar__label">Address</label>
        <div class="xp-ui-addressbar">
          <span class="xp-ui-addressbar__icon" style="background-image:url('${windowsXpLogoUrl}')"></span>
          <span class="xp-ui-addressbar__value">${address}</span>
        </div>
        <button type="button" class="xp-ui-toolbar__go" aria-hidden="true">▶</button>
      </div>
      <div class="xp-ui-toolbar__caption">${title}</div>
    </div>
  `;
}

function renderSidebar(sections: SidebarSection[]): string {
  return `
    <aside class="xp-ui-sidebar">
      ${sections
        .map(
          (section) => `
            <section class="xp-ui-sidebar__group">
              <h3>${section.title}</h3>
              <ul>
                ${section.items.map((item) => `<li>${item}</li>`).join("")}
              </ul>
            </section>
          `
        )
        .join("")}
    </aside>
  `;
}

function renderExplorerGroups(groups: ExplorerMockConfig["groups"]): string {
  return `
    <div class="xp-ui-explorer__groups">
      ${groups
        .map(
          (group) => `
            <section class="xp-ui-explorer__group">
              <h2>${group.title}</h2>
              <div class="xp-ui-explorer__grid">
                ${group.items
                  .map(
                    (item) => `
                      <article class="xp-ui-item">
                        <span class="xp-ui-item__icon" style="background-image:url('${item.icon ?? systemIconUrls.myDocuments}')"></span>
                        <span class="xp-ui-item__copy">
                          <strong>${item.title}</strong>
                          ${item.meta ? `<em>${item.meta}</em>` : ""}
                        </span>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderBrowserSurface(config: BrowserMockConfig): string {
  return `
    <div class="xp-ui-browser">
      <div class="xp-ui-browser__hero">
        <div class="xp-ui-browser__hero-copy">
          <img src="${windowsXpLogoUrl}" alt="" />
          <div>
            <h2>${config.heading}</h2>
            <p>${config.body}</p>
          </div>
        </div>
      </div>
      <div class="xp-ui-browser__canvas">
        <div class="xp-ui-browser__paper">
          <h3>${config.title}</h3>
          <p>Address: ${config.address}</p>
          <ul>
            ${config.links.map((link) => `<li>${link}</li>`).join("")}
          </ul>
        </div>
      </div>
    </div>
  `;
}

export function renderXpMock(config: XpMockConfig): string {
  if (config.kind === "browser") {
    return `
      <div class="xp-ui-app xp-ui-app--browser">
        ${renderMenuBar(["File", "Edit", "View", "Favorites", "Tools", "Help"])}
        ${renderToolbarRow(config.address, config.title)}
        <div class="xp-ui-app__surface">
          ${renderBrowserSurface(config)}
        </div>
        <div class="xp-ui-statusbar">
          <span>${config.status}</span>
          <span>Internet | Protected Mode: Off</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="xp-ui-app xp-ui-app--explorer">
      ${renderMenuBar(["File", "Edit", "View", "Favorites", "Tools", "Help"])}
      ${renderToolbarRow(config.address, config.title)}
      <div class="xp-ui-app__surface xp-ui-app__surface--split">
        ${renderSidebar(config.sidebar)}
        <main class="xp-ui-main">
          <header class="xp-ui-main__banner">
            <div>
              <h1>${config.title}</h1>
              <p>${config.caption}</p>
            </div>
            <img src="${desktopWallpaperUrl}" alt="" />
          </header>
          ${renderExplorerGroups(config.groups)}
        </main>
      </div>
      <div class="xp-ui-statusbar">
        <span>${config.status}</span>
        <span>My Computer</span>
      </div>
    </div>
  `;
}

export const xpMockIcons = {
  folder: systemIconUrls.myDocuments,
  computer: systemIconUrls.myComputer,
  browser: systemIconUrls.internetExplorer,
  recycle: systemIconUrls.recycleBin,
  game: hammerToolIconUrl,
  logo: windowsXpLogoUrl
} as const;
