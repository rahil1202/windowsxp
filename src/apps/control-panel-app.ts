import { requestLaunchApp, requestShellCommand } from "../app-launch";
import { utilityIconUrls, windowsXpLogoUrl } from "../assets";
import type { AppHostContext, AppInstance } from "../types";

const CONTROL_ITEMS = [
  {
    title: "Writing Tools",
    description: "Open Notepad for quick editing and notes.",
    icon: utilityIconUrls.notepad,
    appId: "notepad" as const
  },
  {
    title: "Calculator",
    description: "Launch the classic XP calculator.",
    icon: utilityIconUrls.calculator,
    appId: "calculator" as const
  },
  {
    title: "Paint",
    description: "Draw with the built-in paint surface.",
    icon: utilityIconUrls.paint,
    appId: "paint" as const
  },
  {
    title: "Run Commands",
    description: "Open programs by typing command aliases.",
    icon: utilityIconUrls.run,
    appId: "run" as const
  },
  {
    title: "Media Player",
    description: "Play bundled XP-style demo media.",
    icon: utilityIconUrls.windowsMediaPlayer,
    appId: "windows-media-player" as const
  },
  {
    title: "My Computer",
    description: "Browse drives and system folders.",
    icon: windowsXpLogoUrl,
    appId: "my-computer" as const
  },
  {
    title: "Screensaver",
    description: "Launch a classic XP-style screensaver immediately.",
    icon: windowsXpLogoUrl,
    shellCommand: "open-screensaver" as const,
    payload: { style: "mystify" }
  },
  {
    title: "Crash Test",
    description: "Trigger the fake blue screen and restart flow.",
    icon: windowsXpLogoUrl,
    shellCommand: "trigger-bsod" as const,
    payload: { reason: "control-panel" }
  }
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();

  host.innerHTML = `
    <section class="xp-ui-app xp-ui-app--control-panel">
      <div class="xp-ui-menubar">
        <button type="button" class="xp-ui-menubar__item">File</button>
        <button type="button" class="xp-ui-menubar__item">Edit</button>
        <button type="button" class="xp-ui-menubar__item">View</button>
        <button type="button" class="xp-ui-menubar__item">Help</button>
      </div>
      <div class="xp-ui-toolbar">
        <div class="xp-ui-toolbar__cluster">
          <button type="button" class="xp-ui-toolbar__button">Back</button>
          <button type="button" class="xp-ui-toolbar__button is-disabled">Forward</button>
          <button type="button" class="xp-ui-toolbar__button">Search</button>
        </div>
        <div class="xp-ui-toolbar__cluster xp-ui-toolbar__cluster--address">
          <label class="xp-ui-toolbar__label">Address</label>
          <div class="xp-ui-addressbar">
            <span class="xp-ui-addressbar__icon" style="background-image:url('${utilityIconUrls.controlPanel}')"></span>
            <span class="xp-ui-addressbar__value">Control Panel</span>
          </div>
        </div>
      </div>
      <div class="xp-ui-app__surface xp-ui-app__surface--split">
        <aside class="xp-ui-sidebar">
          <section class="xp-ui-sidebar__group">
            <h3>Control Panel</h3>
            <ul>
              <li>Switch to classic view</li>
            </ul>
          </section>
          <section class="xp-ui-sidebar__group">
            <h3>See also</h3>
            <ul>
              <li>My Computer</li>
              <li>Help and Support</li>
              <li>Performance and Maintenance</li>
            </ul>
          </section>
        </aside>
        <main class="xp-ui-main xp-ui-main--control-panel">
          <header class="xp-ui-main__banner">
            <div>
              <h1>Control Panel</h1>
              <p>Pick a category to open a classic Windows XP tool.</p>
            </div>
            <img src="${windowsXpLogoUrl}" alt="" />
          </header>
          <section class="control-panel-app__grid">
            ${CONTROL_ITEMS.map(
              (item) => `
                <button
                  type="button"
                  class="control-panel-app__tile"
                  ${"appId" in item ? `data-control-launch="${item.appId}"` : ""}
                  ${"shellCommand" in item ? `data-shell-command="${item.shellCommand}"` : ""}
                >
                  <span class="control-panel-app__tile-icon" style="background-image:url('${item.icon}')"></span>
                  <span class="control-panel-app__tile-copy">
                    <strong>${item.title}</strong>
                    <em>${item.description}</em>
                  </span>
                </button>
              `
            ).join("")}
          </section>
        </main>
      </div>
      <div class="xp-ui-statusbar">
        <span>6 item(s)</span>
        <span>Category View</span>
      </div>
    </section>
  `;

  host.addEventListener(
    "click",
    (event) => {
      const appId = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-control-launch]")?.dataset
        .controlLaunch;
      if (appId) {
        requestLaunchApp(appId as "paint" | "notepad" | "calculator" | "run" | "windows-media-player" | "my-computer");
        return;
      }

      const shellCommand = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-shell-command]")?.dataset
        .shellCommand;
      if (!shellCommand) {
        return;
      }
      const selected = CONTROL_ITEMS.find(
        (item) => "shellCommand" in item && item.shellCommand === shellCommand
      );
      requestShellCommand(shellCommand, selected && "payload" in selected ? selected.payload : undefined);
    },
    { signal: abortController.signal }
  );

  return {
    unmount() {
      abortController.abort();
      host.innerHTML = "";
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
