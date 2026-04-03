import type { AppHostContext, AppInstance } from "../types";

interface Buddy {
  id: string;
  name: string;
  status: string;
  online: boolean;
  messages: string[];
}

const BUDDIES: Buddy[] = [
  { id: "amy", name: "Amy", status: "Online", online: true, messages: ["Hey, are you trying the XP desktop again?"] },
  { id: "sam", name: "Sam", status: "Away", online: true, messages: ["I left a playlist in Media Player."] },
  { id: "chris", name: "Chris", status: "Busy", online: true, messages: ["Paint still works better than I remember."] },
  { id: "dana", name: "Dana", status: "Offline", online: false, messages: ["Offline. Messages will be delivered later."] }
];

const AUTO_REPLIES = [
  "Classic XP vibes confirmed.",
  "That app opens fast on this desktop.",
  "Try the Games section from Start next.",
  "This shell feels very 2004."
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  let selectedBuddyId = BUDDIES[0].id;
  const chatLog = new Map(BUDDIES.map((buddy) => [buddy.id, [...buddy.messages]]));

  host.innerHTML = `
    <section class="messenger-app">
      <header class="messenger-app__header">
        <strong>Windows Messenger</strong>
        <span>Signed in as User</span>
      </header>
      <div class="messenger-app__body">
        <aside class="messenger-app__sidebar">
          <h3>Contacts</h3>
          <div class="messenger-app__buddies"></div>
        </aside>
        <main class="messenger-app__chat">
          <div class="messenger-app__chat-header">
            <strong data-buddy-name></strong>
            <span data-buddy-status></span>
          </div>
          <div class="messenger-app__messages" data-messages></div>
          <div class="messenger-app__composer">
            <label class="sr-only" for="messenger-compose">Type a message</label>
            <input type="text" id="messenger-compose" name="messenger-compose" class="messenger-app__input" placeholder="Type a message…" autocomplete="off" />
            <button type="button" data-send-message>Send</button>
          </div>
        </main>
      </div>
    </section>
  `;

  const buddiesEl = host.querySelector<HTMLElement>(".messenger-app__buddies");
  const messagesEl = host.querySelector<HTMLElement>("[data-messages]");
  const nameEl = host.querySelector<HTMLElement>("[data-buddy-name]");
  const statusEl = host.querySelector<HTMLElement>("[data-buddy-status]");
  const inputEl = host.querySelector<HTMLInputElement>(".messenger-app__input");

  if (!buddiesEl || !messagesEl || !nameEl || !statusEl || !inputEl) {
    throw new Error("Windows Messenger failed to mount");
  }
  const buddiesRoot = buddiesEl;
  const messagesRoot = messagesEl;
  const buddyNameEl = nameEl;
  const buddyStatusEl = statusEl;
  const composerInput = inputEl;

  function currentBuddy(): Buddy {
    return BUDDIES.find((buddy) => buddy.id === selectedBuddyId) ?? BUDDIES[0];
  }

  function render(): void {
    buddiesRoot.innerHTML = BUDDIES.map(
      (buddy) => `
        <button type="button" class="messenger-app__buddy${buddy.id === selectedBuddyId ? " is-active" : ""}" data-buddy-id="${buddy.id}">
          <span class="messenger-app__presence ${buddy.online ? "is-online" : "is-offline"}"></span>
          <span class="messenger-app__buddy-copy">
            <strong>${buddy.name}</strong>
            <em>${buddy.status}</em>
          </span>
        </button>
      `
    ).join("");

    const buddy = currentBuddy();
    buddyNameEl.textContent = buddy.name;
    buddyStatusEl.textContent = buddy.status;
    messagesRoot.innerHTML = (chatLog.get(buddy.id) ?? [])
      .map((message, index) => `<div class="messenger-app__message ${index % 2 === 0 ? "is-them" : "is-you"}">${message}</div>`)
      .join("");
    messagesRoot.scrollTop = messagesRoot.scrollHeight;
    ctx.updateTitle(`${buddy.name} - Windows Messenger`);
  }

  function sendMessage(): void {
    const value = composerInput.value.trim();
    if (!value) {
      return;
    }
    const thread = chatLog.get(selectedBuddyId) ?? [];
    thread.push(value);
    chatLog.set(selectedBuddyId, thread);
    composerInput.value = "";
    render();

    const buddy = currentBuddy();
    if (!buddy.online) {
      return;
    }

    window.setTimeout(() => {
      const updatedThread = chatLog.get(selectedBuddyId) ?? [];
      updatedThread.push(AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)] ?? "Sounds good.");
      chatLog.set(selectedBuddyId, updatedThread);
      render();
    }, 500);
  }

  host.addEventListener(
    "click",
    (event) => {
      const buddyId = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-buddy-id]")?.dataset.buddyId;
      if (buddyId) {
        selectedBuddyId = buddyId;
        render();
        return;
      }
      if ((event.target as HTMLElement | null)?.closest("[data-send-message]")) {
        sendMessage();
      }
    },
    { signal: abortController.signal }
  );

  composerInput.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
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
      composerInput.focus();
    }
  };
}
