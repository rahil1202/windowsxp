import { requestLaunchApp, resolveRunCommand } from "../app-launch";
import type { AppHostContext, AppInstance } from "../types";

interface RunCommandSpec {
  value: string;
  error: string;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const state: RunCommandSpec = {
    value: "",
    error: ""
  };

  host.innerHTML = `
    <section class="run-app" tabindex="0">
      <div class="run-app__intro">
        <div class="run-app__icon"></div>
        <p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p>
      </div>
      <label class="run-app__label">
        <span>Open:</span>
        <input class="run-app__input" type="text" name="run-command" autocomplete="off" spellcheck="false" />
      </label>
      <div class="run-app__error" aria-live="polite"></div>
      <div class="run-app__actions">
        <button type="button" data-run-action="ok">OK</button>
        <button type="button" data-run-action="cancel">Cancel</button>
        <button type="button" data-run-action="browse">Browse...</button>
      </div>
    </section>
  `;

  const root = host.querySelector<HTMLElement>(".run-app");
  const input = host.querySelector<HTMLInputElement>(".run-app__input");
  const error = host.querySelector<HTMLElement>(".run-app__error");
  if (!root || !input || !error) {
    throw new Error("Run dialog failed to mount");
  }
  const inputElement = input;
  const errorElement = error;

  function renderError(): void {
    errorElement.textContent = state.error;
  }

  function launchCurrent(): void {
    state.value = inputElement.value;
    const appId = resolveRunCommand(state.value);
    if (!appId) {
      state.error = `Cannot find '${state.value || "that command"}'. Try notepad, calc, mspaint, control, or wmplayer.`;
      renderError();
      inputElement.focus();
      inputElement.select();
      return;
    }
    requestLaunchApp(appId);
    ctx.close();
  }

  root.addEventListener(
    "click",
    (event) => {
      const action = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-run-action]")?.dataset
        .runAction;
      if (!action) {
        return;
      }
      if (action === "ok") {
        launchCurrent();
      } else if (action === "cancel") {
        ctx.close();
      } else if (action === "browse") {
        requestLaunchApp("my-computer");
        ctx.close();
      }
    },
    { signal: abortController.signal }
  );

  inputElement.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        launchCurrent();
      } else if (event.key === "Escape") {
        event.preventDefault();
        ctx.close();
      }
    },
    { signal: abortController.signal }
  );

  inputElement.addEventListener(
    "input",
    () => {
      state.error = "";
      renderError();
    },
    { signal: abortController.signal }
  );

  return {
    unmount() {
      abortController.abort();
      host.innerHTML = "";
    },
    onFocus() {
      ctx.requestFocus();
      inputElement.focus();
      inputElement.select();
    }
  };
}
