import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type ThemeName = "luna" | "zune" | "royale";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const noop = () => {};

  const shell = createXpGameShell(host, {
    className: "display-properties-app",
    menuButtons: [{ label: "File", onClick: noop }, { label: "View", onClick: noop }, { label: "Help", onClick: noop }],
    toolbarButtons: [{ label: "Apply Theme", onClick: noop }],
    statusLeft: "Display Properties",
    statusRight: "Appearance"
  });

  host.dataset.appClass = "display-properties-app";
  shell.body.innerHTML = `
    <section class="display-properties-app__root">
      <h2>Theme Customization</h2>
      <label>Color Scheme
        <select data-theme-select>
          <option value="luna">Luna</option>
          <option value="zune">Zune</option>
          <option value="royale">Royale</option>
        </select>
      </label>
      <label>Font Size
        <select data-font-size>
          <option value="small">Small</option>
          <option value="normal" selected>Normal</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label>Accent Color
        <input type="color" value="#2f8be7" data-accent-color />
      </label>
      <button type="button" class="display-properties-app__apply">Apply</button>
    </section>
  `;

  shell.body.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".display-properties-app__apply")) return;
      const themeSelect = shell.body.querySelector<HTMLSelectElement>("[data-theme-select]");
      const fontSelect = shell.body.querySelector<HTMLSelectElement>("[data-font-size]");
      const accentInput = shell.body.querySelector<HTMLInputElement>("[data-accent-color]");
      const theme = (themeSelect?.value ?? "luna") as ThemeName;
      const fontSize = fontSelect?.value ?? "normal";
      const accent = accentInput?.value ?? "#2f8be7";
      window.dispatchEvent(new CustomEvent("xp-shell-command", { detail: { command: "set-theme", payload: { theme, fontSize, accent } } }));
      shell.setStatus(`Theme: ${theme}`, `Font: ${fontSize}`);
    },
    { signal: abortController.signal }
  );

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
