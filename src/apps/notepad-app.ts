import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

interface NotepadState {
  text: string;
  wrap: boolean;
}

const DEMO_TEXT = `Windows XP Notepad

This is a lightweight custom Notepad app running inside your XP desktop shell.

- Edit text directly
- Clear the page
- Reload this demo file

Use it as a scratch pad while you explore the desktop.`;

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "notepad-app",
    menuButtons: [
      { label: "File", title: "New", onClick: () => resetDocument() },
      { label: "Edit", title: "Select All", onClick: () => selectAll() },
      { label: "Format", title: "Word Wrap", onClick: () => toggleWrap() },
      { label: "View", title: "Open demo", onClick: () => openDemo() },
      { label: "Help", title: "About", onClick: () => shell.setStatus("Windows XP Notepad", "ANSI") }
    ],
    statusLeft: "Ln 1, Col 1",
    statusRight: "Windows (CRLF)"
  });

  const state: NotepadState = {
    text: DEMO_TEXT,
    wrap: false
  };

  shell.body.innerHTML = `
    <section class="notepad-app__root">
      <label class="sr-only" for="notepad-editor">Notepad editor</label>
      <textarea id="notepad-editor" class="notepad-app__editor" name="notepad-editor" spellcheck="false"></textarea>
    </section>
  `;

  const editor = shell.body.querySelector<HTMLTextAreaElement>(".notepad-app__editor");
  if (!editor) {
    throw new Error("Notepad editor failed to mount");
  }
  const editorElement = editor;

  function updateStatus(): void {
    const text = editorElement.value;
    const characters = text.length;
    const selection = editorElement.selectionStart ?? 0;
    const beforeCaret = text.slice(0, selection);
    const line = beforeCaret.split("\n").length;
    const lastLine = beforeCaret.split("\n").at(-1) ?? "";
    const column = lastLine.length + 1;
    shell.setStatus(`Ln ${line}, Col ${column}`, `${characters} char(s)`);
    ctx.updateTitle(characters > 0 ? "Untitled - Notepad" : "Notepad");
  }

  function syncState(): void {
    state.text = editorElement.value;
    updateStatus();
  }

  function resetDocument(): void {
    editorElement.value = "";
    syncState();
    editorElement.focus();
  }

  function openDemo(): void {
    editorElement.value = DEMO_TEXT;
    syncState();
    editorElement.focus();
  }

  function selectAll(): void {
    editorElement.focus();
    editorElement.select();
    updateStatus();
  }

  function toggleWrap(): void {
    state.wrap = !state.wrap;
    editorElement.wrap = state.wrap ? "soft" : "off";
    editorElement.classList.toggle("is-wrapped", state.wrap);
    shell.setStatus(`Word Wrap ${state.wrap ? "On" : "Off"}`, `${editorElement.value.length} char(s)`);
    editorElement.focus();
  }

  editorElement.value = state.text;
  editorElement.wrap = "off";
  updateStatus();

  editorElement.addEventListener(
    "input",
    () => {
      syncState();
    },
    { signal: abortController.signal }
  );

  editorElement.addEventListener(
    "click",
    () => {
      updateStatus();
    },
    { signal: abortController.signal }
  );

  editorElement.addEventListener(
    "keyup",
    () => {
      updateStatus();
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
      editorElement.focus();
    }
  };
}
