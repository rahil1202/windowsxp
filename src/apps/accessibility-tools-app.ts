import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const noop = () => {};

  const shell = createXpGameShell(host, {
    className: "accessibility-app",
    menuButtons: [{ label: "File", onClick: noop }, { label: "Options", onClick: noop }, { label: "Help", onClick: noop }],
    toolbarButtons: [{ label: "Apply", onClick: noop }],
    statusLeft: "Accessibility Options",
    statusRight: "Ready"
  });

  host.dataset.appClass = "accessibility-app";
  shell.body.innerHTML = `
    <section class="accessibility-app__root">
      <h2>Accessibility Tools</h2>
      <label><input type="checkbox" data-toggle="contrast" /> High Contrast Mode</label>
      <label><input type="checkbox" data-toggle="magnifier" /> Magnifier (125%)</label>
      <label><input type="checkbox" data-toggle="keyboard" /> On-Screen Keyboard</label>
      <button type="button" class="accessibility-app__narrator">Test Narrator</button>
      <div class="accessibility-app__keyboard" data-osk hidden>
        ${"1234567890QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((k) => `<button type=\"button\">${k}</button>`).join("")}
        <button type="button" class="wide">Space</button>
      </div>
    </section>
  `;

  const keyboard = shell.body.querySelector<HTMLElement>("[data-osk]");

  shell.body.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.matches("[data-toggle]")) return;
      const mode = target.dataset.toggle;
      if (mode === "contrast") {
        window.dispatchEvent(new CustomEvent("xp-shell-command", { detail: { command: "set-theme", payload: { highContrast: target.checked } } }));
      }
      if (mode === "magnifier") {
        window.dispatchEvent(new CustomEvent("xp-shell-command", { detail: { command: "set-magnifier", payload: { enabled: target.checked } } }));
      }
      if (mode === "keyboard" && keyboard) {
        keyboard.hidden = !target.checked;
      }
    },
    { signal: abortController.signal }
  );

  shell.body.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".accessibility-app__narrator")) {
        const text = "Welcome to Windows XP accessibility center.";
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        }
      }
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
