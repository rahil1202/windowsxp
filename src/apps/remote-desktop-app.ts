import type { AppHostContext, AppInstance } from "../types";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  let connected = false;
  let computer = "RETRO-PC";

  host.innerHTML = `
    <section class="remote-desktop-app">
      <div class="remote-desktop-app__card">
        <h2>Remote Desktop Connection</h2>
        <label>
          <span>Computer:</span>
          <input type="text" name="remote-computer" autocomplete="off" data-rdc-computer value="${computer}" />
        </label>
        <label>
          <span>User name:</span>
          <input type="text" name="remote-user" autocomplete="username" data-rdc-user value="Administrator" />
        </label>
        <div class="remote-desktop-app__actions">
          <button type="button" data-rdc-connect>Connect</button>
          <button type="button" data-rdc-disconnect>Cancel</button>
        </div>
      </div>
      <div class="remote-desktop-app__session" hidden>
        <header>
          <strong data-rdc-session-title></strong>
          <button type="button" data-rdc-disconnect>Disconnect</button>
        </header>
        <div class="remote-desktop-app__session-screen">
          <span>Remote session active</span>
        </div>
      </div>
    </section>
  `;

  const computerInput = host.querySelector<HTMLInputElement>("[data-rdc-computer]");
  const card = host.querySelector<HTMLElement>(".remote-desktop-app__card");
  const session = host.querySelector<HTMLElement>(".remote-desktop-app__session");
  const sessionTitle = host.querySelector<HTMLElement>("[data-rdc-session-title]");

  if (!computerInput || !card || !session || !sessionTitle) {
    throw new Error("Remote Desktop Connection failed to mount");
  }
  const cardEl = card;
  const sessionEl = session;
  const sessionTitleEl = sessionTitle;

  function render(): void {
    cardEl.hidden = connected;
    sessionEl.hidden = !connected;
    sessionTitleEl.textContent = connected ? `${computer} - Remote Desktop` : "";
    ctx.updateTitle(connected ? `${computer} - Remote Desktop Connection` : "Remote Desktop Connection");
  }

  host.addEventListener(
    "click",
    (event) => {
      if ((event.target as HTMLElement | null)?.closest("[data-rdc-connect]")) {
        computer = computerInput.value.trim() || "RETRO-PC";
        connected = true;
        render();
      } else if ((event.target as HTMLElement | null)?.closest("[data-rdc-disconnect]")) {
        if (connected) {
          connected = false;
          render();
        } else {
          ctx.close();
        }
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
      if (!connected) {
        computerInput.focus();
      }
    }
  };
}
