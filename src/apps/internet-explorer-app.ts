import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const HOME_LINKS = [
  { label: "MSN", url: "https://windowsxp.example/msn" },
  { label: "Windows Update", url: "https://windowsxp.example/update" },
  { label: "Hotmail", url: "https://windowsxp.example/mail" },
  { label: "Control Panel", url: "app://control-panel" }
];

const IE_SESSION_KEY = "xp:ie:session:v2";
const IE_HISTORY_KEY = "xp:ie:history:v2";
const IE_FAVORITES_KEY = "xp:ie:favorites:v2";

interface HistoryEntry {
  url: string;
  title: string;
  visits: number;
  lastVisited: number;
}

interface FavoriteEntry {
  url: string;
  title: string;
  pinned: boolean;
  addedAt: number;
}

interface TabSession {
  id: string;
  title: string;
  url: string;
  navHistory: string[];
  navIndex: number;
  privateMode: boolean;
}

interface IeSession {
  activeTabId: string;
  tabs: TabSession[];
}

function createTab(url = "https://windowsxp.example/home", privateMode = false): TabSession {
  return {
    id: `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: "New Tab",
    url,
    navHistory: [url],
    navIndex: 0,
    privateMode
  };
}

function titleFromUrl(url: string): string {
  if (url.startsWith("app://")) {
    return url.replace("app://", "").replace(/-/g, " ");
  }
  const part = url.split("/").filter(Boolean).pop() || "home";
  return part.replace(/[-_]/g, " ");
}

function formatRelativeTime(value: number): string {
  const diff = Date.now() - value;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return `${Math.floor(diff / 86_400_000)} day ago`;
}

function dayBucketLabel(ts: number): "today" | "yesterday" | "older" {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  if (ts >= startToday) return "today";
  if (ts >= startYesterday) return "yesterday";
  return "older";
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const noop = () => {};
  const history = loadJson<HistoryEntry[]>(IE_HISTORY_KEY, []);
  const favorites = loadJson<FavoriteEntry[]>(IE_FAVORITES_KEY, [
    { url: "https://windowsxp.example/home", title: "Home", pinned: true, addedAt: Date.now() },
    { url: "https://windowsxp.example/msn", title: "MSN", pinned: false, addedAt: Date.now() }
  ]);

  const loadedSession = loadJson<IeSession>(IE_SESSION_KEY, {
    activeTabId: "",
    tabs: []
  });

  const session: IeSession = {
    activeTabId: loadedSession.activeTabId,
    tabs:
      loadedSession.tabs.length > 0
        ? loadedSession.tabs.map((tab) => ({ ...tab, privateMode: Boolean(tab.privateMode) }))
        : [createTab()]
  };
  if (!session.tabs.some((tab) => tab.id === session.activeTabId)) {
    session.activeTabId = session.tabs[0]?.id ?? createTab().id;
  }

  const saveSession = (): void => {
    const persistedTabs = session.tabs.filter((tab) => !tab.privateMode);
    const safeActiveTabId = persistedTabs.some((tab) => tab.id === session.activeTabId)
      ? session.activeTabId
      : persistedTabs[0]?.id ?? "";
    saveJson(IE_SESSION_KEY, {
      activeTabId: safeActiveTabId,
      tabs: persistedTabs
    } satisfies IeSession);
  };

  const getActiveTab = (): TabSession => {
    let tab = session.tabs.find((item) => item.id === session.activeTabId);
    if (!tab) {
      tab = session.tabs[0] ?? createTab();
      if (session.tabs.length === 0) {
        session.tabs.push(tab);
      }
      session.activeTabId = tab.id;
    }
    return tab;
  };

  let navigateBack = noop;
  let navigateForward = noop;
  let navigateHome = noop;
  let refreshCurrent = noop;
  let addFavorite = noop;
  let newTab = noop;
  let newPrivateTab = noop;
  let exportFavorites = noop;
  let importFavorites = noop;

  const shell = createXpGameShell(host, {
    className: "ie-app",
    menuButtons: [
      { label: "File", onClick: noop },
      { label: "Edit", onClick: noop },
      { label: "View", onClick: noop },
      { label: "Favorites", onClick: noop },
      { label: "Tools", onClick: noop },
      { label: "Help", onClick: noop }
    ],
    toolbarButtons: [
      { label: "Back", onClick: () => navigateBack() },
      { label: "Forward", onClick: () => navigateForward() },
      { label: "Home", onClick: () => navigateHome() },
      { label: "Refresh", onClick: () => refreshCurrent() },
      { label: "Add Favorite", onClick: () => addFavorite() },
      { label: "New Tab", onClick: () => newTab() },
      { label: "Private Tab", onClick: () => newPrivateTab() },
      { label: "Export Fav", onClick: () => exportFavorites() },
      { label: "Import Fav", onClick: () => importFavorites() }
    ],
    statusLeft: "Internet",
    statusRight: "Protected Mode: Off"
  });

  host.dataset.appClass = "ie-app";
  shell.body.innerHTML = `
    <section class="ie-app__root">
      <div class="ie-app__session-tabs" data-session-tabs></div>
      <input type="file" accept="application/json" data-import-favorites hidden />
      <header class="ie-app__bar">
        <label>Address</label>
        <input type="text" class="ie-app__address" value="" list="ie-autocomplete" />
        <button type="button" class="ie-app__go">Go</button>
      </header>
      <datalist id="ie-autocomplete">
        <option value="https://windowsxp.example/home"></option>
        <option value="https://windowsxp.example/msn"></option>
        <option value="https://windowsxp.example/update"></option>
        <option value="https://windowsxp.example/mail"></option>
      </datalist>
      <div class="ie-app__tabs">
        <button type="button" class="is-active" data-ie-tab="home">Home</button>
        <button type="button" data-ie-tab="history">History</button>
        <button type="button" data-ie-tab="favorites">Favorites</button>
        <button type="button" data-ie-tab="security">Security</button>
      </div>
      <main class="ie-app__content">
        <section class="ie-app__panel is-visible" data-ie-panel="home">
          <h1>Welcome to Windows XP Internet Explorer</h1>
          <p data-page-url></p>
          <div class="ie-app__links">
            ${HOME_LINKS.map((link) => `<button type="button" data-url="${link.url}">${link.label}</button>`).join("")}
          </div>
        </section>
        <section class="ie-app__panel" data-ie-panel="history">
          <h2>Browsing History</h2>
          <div class="ie-app__history-actions">
            <button type="button" data-clear-history>Clear History</button>
          </div>
          <div class="ie-app__history-groups" data-history-list></div>
        </section>
        <section class="ie-app__panel" data-ie-panel="favorites">
          <h2>Favorites</h2>
          <div class="ie-app__history-actions">
            <button type="button" data-sort-favorites>Sort by Name</button>
            <button type="button" data-export-favorites>Export JSON</button>
            <button type="button" data-import-favorites-button>Import JSON</button>
          </div>
          <ul class="ie-app__list" data-favorites-list></ul>
        </section>
        <section class="ie-app__panel" data-ie-panel="security">
          <h2>Privacy & Security</h2>
          <p>Pop-up blocker: Enabled</p>
          <p>Security level: Medium</p>
          <p>Cookies: Prompt</p>
        </section>
      </main>
    </section>
  `;

  const historyList = shell.body.querySelector<HTMLElement>("[data-history-list]");
  const favoritesList = shell.body.querySelector<HTMLElement>("[data-favorites-list]");
  const addressInput = shell.body.querySelector<HTMLInputElement>(".ie-app__address");
  const pageUrl = shell.body.querySelector<HTMLElement>("[data-page-url]");
  const sessionTabs = shell.body.querySelector<HTMLElement>("[data-session-tabs]");
  const importInput = shell.body.querySelector<HTMLInputElement>("[data-import-favorites]");

  function renderHistory(): void {
    if (!historyList) return;
    const sorted = [...history].sort((a, b) => b.lastVisited - a.lastVisited);
    const groups: Record<"today" | "yesterday" | "older", HistoryEntry[]> = {
      today: [],
      yesterday: [],
      older: []
    };
    for (const item of sorted) {
      groups[dayBucketLabel(item.lastVisited)].push(item);
    }

    const renderGroup = (label: string, items: HistoryEntry[]): string => {
      if (items.length === 0) return "";
      return `
        <section class="ie-app__history-group">
          <h3>${label}</h3>
          <ul class="ie-app__list">
            ${items
              .map(
                (item) => `<li>
                  <button type="button" class="ie-app__favorite-link" data-url="${item.url}">${item.title} (${item.url})</button>
                  <small>${item.visits} visit(s) • ${formatRelativeTime(item.lastVisited)}</small>
                </li>`
              )
              .join("")}
          </ul>
        </section>
      `;
    };

    historyList.innerHTML = [
      renderGroup("Today", groups.today),
      renderGroup("Yesterday", groups.yesterday),
      renderGroup("Older", groups.older)
    ].join("");
  }

  function renderFavorites(): void {
    if (!favoritesList) return;
    favoritesList.innerHTML = favorites
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title))
      .map(
        (item) => `<li>
          <button type="button" class="ie-app__favorite-link" data-url="${item.url}">${item.pinned ? "★" : "☆"} ${item.title}</button>
          <div class="ie-app__favorite-actions">
            <button type="button" data-fav-pin="${item.url}">${item.pinned ? "Unpin" : "Pin"}</button>
            <button type="button" data-fav-remove="${item.url}">Remove</button>
          </div>
        </li>`
      )
      .join("");
  }

  function renderSessionTabs(): void {
    if (!sessionTabs) return;
    sessionTabs.innerHTML = `${session.tabs
      .map(
        (tab) => `<button type="button" class="ie-app__session-tab${tab.id === session.activeTabId ? " is-active" : ""}" data-tab-id="${tab.id}">
            <strong>${tab.privateMode ? "[Private] " : ""}${tab.title}</strong>
            <span>${tab.url}</span>
            <em data-close-tab="${tab.id}">×</em>
          </button>`
      )
      .join("")}
      <button type="button" class="ie-app__session-tab ie-app__session-tab--new" data-new-tab>+</button>
      <button type="button" class="ie-app__session-tab ie-app__session-tab--private" data-new-private-tab>P</button>`;
  }

  function updateAddressFromActiveTab(): void {
    const tab = getActiveTab();
    if (addressInput) {
      addressInput.value = tab.url;
    }
    if (pageUrl) {
      pageUrl.textContent = `Current page: ${tab.url}`;
    }
    shell.setStatus(tab.url, `${session.tabs.length} tab(s)`);
  }

  function upsertHistory(url: string): void {
    const activeTab = getActiveTab();
    if (activeTab.privateMode) {
      return;
    }
    const existing = history.find((entry) => entry.url === url);
    if (existing) {
      existing.visits += 1;
      existing.lastVisited = Date.now();
      existing.title = titleFromUrl(url);
    } else {
      history.push({
        url,
        title: titleFromUrl(url),
        visits: 1,
        lastVisited: Date.now()
      });
    }
    if (history.length > 120) {
      history.sort((a, b) => b.lastVisited - a.lastVisited);
      history.length = 120;
    }
    saveJson(IE_HISTORY_KEY, history);
    renderHistory();
  }

  function pushTabHistory(tab: TabSession, url: string): void {
    if (tab.navIndex < tab.navHistory.length - 1) {
      tab.navHistory = tab.navHistory.slice(0, tab.navIndex + 1);
    }
    tab.navHistory.push(url);
    tab.navIndex = tab.navHistory.length - 1;
  }

  function openUrl(url: string): void {
    const tab = getActiveTab();
    tab.url = url;
    tab.title = titleFromUrl(url);
    pushTabHistory(tab, url);
    upsertHistory(url);
    updateAddressFromActiveTab();
    renderSessionTabs();
    saveSession();
    if (url.startsWith("app://")) {
      const appId = url.replace("app://", "");
      window.dispatchEvent(new CustomEvent("xp-launch-app", { detail: { appId } }));
    }
  }

  navigateBack = () => {
    const tab = getActiveTab();
    if (tab.navIndex <= 0) return;
    tab.navIndex -= 1;
    tab.url = tab.navHistory[tab.navIndex] ?? tab.url;
    tab.title = titleFromUrl(tab.url);
    updateAddressFromActiveTab();
    renderSessionTabs();
    saveSession();
  };

  navigateForward = () => {
    const tab = getActiveTab();
    if (tab.navIndex >= tab.navHistory.length - 1) return;
    tab.navIndex += 1;
    tab.url = tab.navHistory[tab.navIndex] ?? tab.url;
    tab.title = titleFromUrl(tab.url);
    updateAddressFromActiveTab();
    renderSessionTabs();
    saveSession();
  };

  navigateHome = () => {
    openUrl("https://windowsxp.example/home");
  };

  refreshCurrent = () => {
    const tab = getActiveTab();
    upsertHistory(tab.url);
    shell.setStatus(tab.url, "Refreshed");
  };

  addFavorite = () => {
    const tab = getActiveTab();
    if (favorites.some((item) => item.url === tab.url)) {
      return;
    }
    favorites.unshift({
      url: tab.url,
      title: tab.title,
      pinned: false,
      addedAt: Date.now()
    });
    if (favorites.length > 80) {
      favorites.length = 80;
    }
    saveJson(IE_FAVORITES_KEY, favorites);
    renderFavorites();
  };

  newTab = () => {
    const tab = createTab();
    session.tabs.push(tab);
    session.activeTabId = tab.id;
    renderSessionTabs();
    updateAddressFromActiveTab();
    saveSession();
  };

  newPrivateTab = () => {
    const tab = createTab("https://windowsxp.example/home", true);
    session.tabs.push(tab);
    session.activeTabId = tab.id;
    renderSessionTabs();
    updateAddressFromActiveTab();
  };

  exportFavorites = () => {
    const blob = new Blob([JSON.stringify(favorites, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ie-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  importFavorites = () => {
    importInput?.click();
  };

  shell.body.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const tabButton = target.closest<HTMLElement>("[data-ie-tab]");
      if (tabButton) {
        const tab = tabButton.dataset.ieTab;
        shell.body.querySelectorAll<HTMLElement>("[data-ie-tab]").forEach((btn) => btn.classList.remove("is-active"));
        tabButton.classList.add("is-active");
        shell.body.querySelectorAll<HTMLElement>("[data-ie-panel]").forEach((panel) => {
          panel.classList.toggle("is-visible", panel.dataset.iePanel === tab);
        });
        return;
      }

      const linkButton = target.closest<HTMLElement>("[data-url]");
      if (linkButton?.dataset.url) {
        openUrl(linkButton.dataset.url);
        return;
      }

      if (target.closest(".ie-app__go") && addressInput?.value) {
        openUrl(addressInput.value.trim());
      }

      const favoriteLink = target.closest<HTMLElement>(".ie-app__favorite-link");
      if (favoriteLink?.dataset.url) {
        openUrl(favoriteLink.dataset.url);
        return;
      }

      const pinButton = target.closest<HTMLElement>("[data-fav-pin]");
      if (pinButton?.dataset.favPin) {
        const favorite = favorites.find((item) => item.url === pinButton.dataset.favPin);
        if (favorite) {
          favorite.pinned = !favorite.pinned;
          saveJson(IE_FAVORITES_KEY, favorites);
          renderFavorites();
        }
        return;
      }

      const removeButton = target.closest<HTMLElement>("[data-fav-remove]");
      if (removeButton?.dataset.favRemove) {
        const index = favorites.findIndex((item) => item.url === removeButton.dataset.favRemove);
        if (index >= 0) {
          favorites.splice(index, 1);
          saveJson(IE_FAVORITES_KEY, favorites);
          renderFavorites();
        }
        return;
      }

      if (target.closest("[data-clear-history]")) {
        history.length = 0;
        saveJson(IE_HISTORY_KEY, history);
        renderHistory();
        return;
      }

      if (target.closest("[data-sort-favorites]")) {
        favorites.sort((a, b) => a.title.localeCompare(b.title));
        saveJson(IE_FAVORITES_KEY, favorites);
        renderFavorites();
        return;
      }

      if (target.closest("[data-export-favorites]")) {
        exportFavorites();
        return;
      }

      if (target.closest("[data-import-favorites-button]")) {
        importFavorites();
        return;
      }

      const sessionTabButton = target.closest<HTMLElement>("[data-tab-id]");
      if (sessionTabButton?.dataset.tabId) {
        session.activeTabId = sessionTabButton.dataset.tabId;
        renderSessionTabs();
        updateAddressFromActiveTab();
        saveSession();
        return;
      }

      const closeTabButton = target.closest<HTMLElement>("[data-close-tab]");
      if (closeTabButton?.dataset.closeTab) {
        const id = closeTabButton.dataset.closeTab;
        const index = session.tabs.findIndex((tab) => tab.id === id);
        if (index >= 0) {
          session.tabs.splice(index, 1);
          if (session.tabs.length === 0) {
            session.tabs.push(createTab());
          }
          if (session.activeTabId === id) {
            session.activeTabId = session.tabs[Math.max(0, index - 1)]?.id ?? session.tabs[0].id;
          }
          renderSessionTabs();
          updateAddressFromActiveTab();
          saveSession();
        }
        return;
      }

      if (target.closest("[data-new-tab]")) {
        newTab();
        return;
      }

      if (target.closest("[data-new-private-tab]")) {
        newPrivateTab();
      }
    },
    { signal: abortController.signal }
  );

  importInput?.addEventListener(
    "change",
    async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as FavoriteEntry[];
        if (!Array.isArray(parsed)) {
          return;
        }
        const normalized = parsed
          .filter((item) => typeof item?.url === "string" && typeof item?.title === "string")
          .map((item) => ({
            url: item.url,
            title: item.title,
            pinned: Boolean(item.pinned),
            addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now()
          }));
        favorites.length = 0;
        favorites.push(...normalized.slice(0, 120));
        saveJson(IE_FAVORITES_KEY, favorites);
        renderFavorites();
      } catch {
        // Ignore malformed JSON.
      } finally {
        importInput.value = "";
      }
    },
    { signal: abortController.signal }
  );

  addressInput?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const value = addressInput.value.trim();
        if (value) {
          openUrl(value);
        }
      }
    },
    { signal: abortController.signal }
  );

  renderSessionTabs();
  updateAddressFromActiveTab();
  renderHistory();
  renderFavorites();
  saveSession();

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
