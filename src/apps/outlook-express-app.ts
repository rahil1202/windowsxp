import type { AppHostContext, AppInstance } from "../types";

interface MailMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
}

const FOLDERS = ["Inbox", "Outbox", "Sent Items", "Deleted Items", "Drafts"];

const MESSAGES: MailMessage[] = [
  {
    id: "welcome",
    from: "Microsoft Tour",
    subject: "Welcome to Windows XP",
    preview: "Take a quick tour of the new XP desktop and Start menu.",
    body: "Welcome to Windows XP.\n\nUse the Tour app to explore the desktop, Start menu, and entertainment features."
  },
  {
    id: "playlist",
    from: "Amy",
    subject: "Playlist for tonight",
    preview: "I left a few tracks in Windows Media Player.",
    body: "Hi,\n\nI left a few demo tracks in Windows Media Player.\n\nAmy"
  },
  {
    id: "paint",
    from: "Chris",
    subject: "Paint mock looks good",
    preview: "The new tool palette feels very close to XP.",
    body: "Paint is looking much closer to the original now.\n\nThe left toolbar and bottom color box really help."
  }
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  let selectedFolder = "Inbox";
  let selectedMessage = MESSAGES[0].id;

  host.innerHTML = `
    <section class="outlook-app">
      <header class="outlook-app__header">
        <div class="outlook-app__toolbar">
          <button type="button">Create Mail</button>
          <button type="button">Reply</button>
          <button type="button">Forward</button>
          <button type="button">Send/Recv</button>
        </div>
      </header>
      <div class="outlook-app__body">
        <aside class="outlook-app__folders"></aside>
        <section class="outlook-app__content">
          <div class="outlook-app__list"></div>
          <article class="outlook-app__preview"></article>
        </section>
      </div>
    </section>
  `;

  const foldersEl = host.querySelector<HTMLElement>(".outlook-app__folders");
  const listEl = host.querySelector<HTMLElement>(".outlook-app__list");
  const previewEl = host.querySelector<HTMLElement>(".outlook-app__preview");

  if (!foldersEl || !listEl || !previewEl) {
    throw new Error("Outlook Express failed to mount");
  }
  const foldersRoot = foldersEl;
  const listRoot = listEl;
  const previewRoot = previewEl;

  function render(): void {
    foldersRoot.innerHTML = FOLDERS.map(
      (folder) => `
        <button type="button" class="outlook-app__folder${folder === selectedFolder ? " is-active" : ""}" data-folder="${folder}">
          ${folder}
        </button>
      `
    ).join("");

    listRoot.innerHTML = MESSAGES.map(
      (message) => `
        <button type="button" class="outlook-app__message${message.id === selectedMessage ? " is-active" : ""}" data-message-id="${message.id}">
          <strong>${message.from}</strong>
          <span>${message.subject}</span>
          <em>${message.preview}</em>
        </button>
      `
    ).join("");

    const message = MESSAGES.find((entry) => entry.id === selectedMessage) ?? MESSAGES[0];
    previewRoot.innerHTML = `
      <header class="outlook-app__preview-header">
        <strong>${message.subject}</strong>
        <span>From: ${message.from}</span>
      </header>
      <pre>${message.body}</pre>
    `;
    ctx.updateTitle(`${selectedFolder} - Outlook Express`);
  }

  host.addEventListener(
    "click",
    (event) => {
      const folder = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-folder]")?.dataset.folder;
      const messageId = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-message-id]")?.dataset.messageId;
      if (folder) {
        selectedFolder = folder;
        render();
      } else if (messageId) {
        selectedMessage = messageId;
        render();
      }
    },
    { signal: abortController.signal }
  );

  render();

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
