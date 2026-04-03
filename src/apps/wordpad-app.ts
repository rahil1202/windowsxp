import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const DEFAULT_HTML = `
  <p><strong>WordPad</strong></p>
  <p>This is a richer writing surface for your Windows XP desktop.</p>
  <p>You can apply <strong>bold</strong>, <em>italic</em>, and <u>underline</u>, then keep typing.</p>
`;

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "wordpad-app",
    menuButtons: [
      { label: "File", onClick: () => resetDocument() },
      { label: "Edit", onClick: () => selectAll() },
      { label: "View", onClick: () => shell.setStatus("Print Layout", "WordPad") },
      { label: "Insert", onClick: () => insertDate() },
      { label: "Format", onClick: () => shell.setStatus("Formatting toolbar ready", "WordPad") },
      { label: "Help", onClick: () => shell.setStatus("WordPad help is not installed.", "WordPad") }
    ],
    toolbarButtons: [
      { label: "Bold", onClick: () => format("bold") },
      { label: "Italic", onClick: () => format("italic") },
      { label: "Underline", onClick: () => format("underline") },
      { label: "Left", onClick: () => format("justifyLeft") },
      { label: "Center", onClick: () => format("justifyCenter") },
      { label: "Right", onClick: () => format("justifyRight") }
    ],
    statusLeft: "Ready",
    statusRight: "WordPad"
  });

  host.dataset.appClass = "wordpad-app";
  shell.body.innerHTML = `
    <section class="wordpad-app__root">
      <div class="wordpad-app__ruler" aria-hidden="true"></div>
      <div class="wordpad-app__paper-wrap">
        <article class="wordpad-app__paper" contenteditable="true" spellcheck="false"></article>
      </div>
    </section>
  `;

  const editor = shell.body.querySelector<HTMLElement>(".wordpad-app__paper");
  if (!editor) {
    throw new Error("WordPad failed to mount");
  }
  const editorEl = editor;

  editorEl.innerHTML = DEFAULT_HTML;

  function updateStatus(): void {
    const text = editorEl.innerText;
    const selection = window.getSelection();
    const anchorOffset = selection?.anchorOffset ?? 0;
    shell.setStatus(`${text.trim().split(/\s+/).filter(Boolean).length} word(s)`, `Ln 1, Col ${anchorOffset + 1}`);
    ctx.updateTitle(text.trim().length > 0 ? "Document - WordPad" : "WordPad");
  }

  function format(command: string): void {
    document.execCommand(command);
    editorEl.focus();
    updateStatus();
  }

  function resetDocument(): void {
    editorEl.innerHTML = DEFAULT_HTML;
    editorEl.focus();
    updateStatus();
  }

  function selectAll(): void {
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorEl.focus();
    updateStatus();
  }

  function insertDate(): void {
    document.execCommand("insertText", false, new Date().toLocaleString());
    editorEl.focus();
    updateStatus();
  }

  editorEl.addEventListener("input", updateStatus, { signal: abortController.signal });
  editorEl.addEventListener("keyup", updateStatus, { signal: abortController.signal });
  editorEl.addEventListener("mouseup", updateStatus, { signal: abortController.signal });

  updateStatus();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      editorEl.focus();
    }
  };
}
