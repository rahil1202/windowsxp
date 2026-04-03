import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const noop = () => {};
  const shell = createXpGameShell(host, {
    className: "folder-app",
    menuButtons: [{ label: "File", onClick: noop }, { label: "Edit", onClick: noop }, { label: "View", onClick: noop }, { label: "Help", onClick: noop }],
    toolbarButtons: [{ label: "Up", onClick: noop }, { label: "Search", onClick: noop }, { label: "Folders", onClick: noop }],
    statusLeft: "Folder",
    statusRight: "Ready"
  });

  host.dataset.appClass = "folder-app";
  shell.body.innerHTML = `
    <section class="folder-app__root">
      <h2>New Folder</h2>
      <p>This folder was created from the desktop context menu.</p>
      <ul>
        <li>Readme.txt</li>
        <li>Shortcut to My Documents</li>
        <li>Shortcut to Internet Explorer</li>
      </ul>
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
