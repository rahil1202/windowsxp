import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const noop = () => {};
  const shell = createXpGameShell(host, {
    className: "desktop-shortcuts-app",
    menuButtons: [{ label: "File", onClick: noop }, { label: "Edit", onClick: noop }, { label: "Help", onClick: noop }],
    toolbarButtons: [{ label: "New Shortcut", onClick: noop }, { label: "Delete", onClick: noop }],
    statusLeft: "Desktop Shortcuts",
    statusRight: "Configured"
  });

  host.dataset.appClass = "desktop-shortcuts-app";
  shell.body.innerHTML = `
    <section class="desktop-shortcuts-app__root">
      <h2>Desktop Shortcut Wizard</h2>
      <p>Use desktop right click > New > Shortcut to add quick access items.</p>
      <ol>
        <li>Right click on desktop</li>
        <li>Choose New > Shortcut</li>
        <li>Pick an app destination</li>
      </ol>
    </section>
  `;

  return {
    unmount() {
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
