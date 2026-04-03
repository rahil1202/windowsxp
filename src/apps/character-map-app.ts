import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const CHARS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."©®™✓★☆♪♫∞≈≠≤≥¿¡ÆæØøßΩπ∆♥♦♣♠"
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "character-map-app",
    menuButtons: [
      { label: "File", onClick: () => clearSelection() },
      { label: "Select", onClick: () => appendSelection() },
      { label: "Help", onClick: () => shell.setStatus("Select characters, then copy them.", "Character Map") }
    ],
    statusLeft: "Ready",
    statusRight: "Character Map"
  });

  let selected = "A";
  let composed = "";

  shell.body.innerHTML = `
    <section class="character-map-app">
      <div class="character-map-app__grid"></div>
      <div class="character-map-app__footer">
        <div class="character-map-app__selected">
          <strong data-selected-char></strong>
          <span data-selected-code></span>
        </div>
        <label class="character-map-app__copybox">
          <span>Characters to copy:</span>
          <input type="text" name="character-map-copy" autocomplete="off" data-copy-target />
        </label>
        <div class="character-map-app__actions">
          <button type="button" data-append-char>Select</button>
          <button type="button" data-copy-all>Copy</button>
        </div>
      </div>
    </section>
  `;

  const grid = shell.body.querySelector<HTMLElement>(".character-map-app__grid");
  const selectedChar = shell.body.querySelector<HTMLElement>("[data-selected-char]");
  const selectedCode = shell.body.querySelector<HTMLElement>("[data-selected-code]");
  const copyTarget = shell.body.querySelector<HTMLInputElement>("[data-copy-target]");

  if (!grid || !selectedChar || !selectedCode || !copyTarget) {
    throw new Error("Character Map failed to mount");
  }
  const gridEl = grid;
  const selectedCharEl = selectedChar;
  const selectedCodeEl = selectedCode;
  const copyInput = copyTarget;

  function render(): void {
    gridEl.innerHTML = CHARS.map(
      (char) => `<button type="button" class="character-map-app__cell${char === selected ? " is-active" : ""}" data-char="${encodeURIComponent(char)}">${char}</button>`
    ).join("");
    selectedCharEl.textContent = selected;
    selectedCodeEl.textContent = `U+${selected.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
    copyInput.value = composed;
    shell.setStatus(`Selected ${selected}`, `${composed.length} char(s)`);
  }

  function appendSelection(): void {
    composed += selected;
    render();
  }

  async function copySelection(): Promise<void> {
    copyInput.select();
    try {
      await navigator.clipboard.writeText(composed);
      shell.setStatus("Copied to clipboard", `${composed.length} char(s)`);
    } catch {
      shell.setStatus("Press Ctrl+C to copy", `${composed.length} char(s)`);
    }
  }

  function clearSelection(): void {
    composed = "";
    render();
  }

  shell.body.addEventListener(
    "click",
    (event) => {
      const char = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-char]")?.dataset.char;
      if (char) {
        selected = decodeURIComponent(char);
        render();
        return;
      }
      if ((event.target as HTMLElement | null)?.closest("[data-append-char]")) {
        appendSelection();
      } else if ((event.target as HTMLElement | null)?.closest("[data-copy-all]")) {
        void copySelection();
      }
    },
    { signal: abortController.signal }
  );

  render();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      copyInput.focus();
    }
  };
}
