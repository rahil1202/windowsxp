import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const PROFILE_TEMPLATE = `
  <h1>Rahil Vahora</h1>
  <p><strong>Title:</strong> Full Stack Developer</p>
  <p><strong>Location:</strong> Gujarat, India</p>
  <p><strong>Summary:</strong> Full Stack Developer with hands-on experience building performant MERN and Next.js products, shipping responsive interfaces, and delivering backend APIs that scale. Strong focus on product impact through automation, performance optimization, and clean developer workflows.</p>
  <p><strong>Links:</strong> linkedin.com/in/rahil-vahora | github.com/rahil1202 | terminal.rahil.pro |  | </p>
  <p><strong>Key Skills:</strong> React, Next.js, TypeScript, JavaScript, Node.js, Express.js, Prisma, PostgreSQL, MongoDB, Tailwind CSS, Redux, AWS</p>
  <hr />
  <p><strong>Achievements:</strong> LeetCode 1859 (Top 5%), GeeksforGeeks 2000+ (Top 7%), Coding Ninja Grandmaster (Institute Rank 1)</p>
  <p><strong>Education:</strong> B.Tech in Computer Engineering, A.D. Patel Institute of Technology (2020-2024)</p>
`;

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();

  const shell = createXpGameShell(host, {
    className: "wordpad-app",
    menuButtons: [
      { label: "File", onClick: () => resetProfile() },
      { label: "Edit", onClick: () => selectAll() },
      { label: "View", onClick: () => shell.setStatus("Profile document view", "User Profile") },
      { label: "Insert", onClick: () => insertTimestamp() },
      { label: "Help", onClick: () => shell.setStatus("Type your details in this document.", "User Profile") }
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
    statusRight: "User Profile"
  });

  host.dataset.appClass = "user-profile-doc-app";
  shell.body.innerHTML = `
    <section class="wordpad-app__root user-profile-doc-app">
      <div class="wordpad-app__ruler" aria-hidden="true"></div>
      <div class="wordpad-app__paper-wrap">
        <article class="wordpad-app__paper" contenteditable="true" spellcheck="false"></article>
      </div>
    </section>
  `;

  const editor = shell.body.querySelector<HTMLElement>(".wordpad-app__paper");
  if (!editor) {
    throw new Error("User profile app failed to mount");
  }

  const editorEl = editor;
  editorEl.innerHTML = PROFILE_TEMPLATE;

  function updateStatus(): void {
    const text = editorEl.innerText.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const selection = window.getSelection();
    const column = (selection?.anchorOffset ?? 0) + 1;
    shell.setStatus(`${words} word(s)`, `Ln 1, Col ${column}`);
    ctx.updateTitle(text.length > 0 ? "Profile Notes - User Profile" : "User Profile");
  }

  function format(command: string): void {
    document.execCommand(command);
    editorEl.focus();
    updateStatus();
  }

  function resetProfile(): void {
    editorEl.innerHTML = PROFILE_TEMPLATE;
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

  function insertTimestamp(): void {
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
