import type { AppHostContext, AppInstance, IframeGameConfig } from "../types";

export function openGameWindow(config: IframeGameConfig): {
  mount(host: HTMLElement, ctx: AppHostContext): AppInstance;
} {
  return {
    mount(host, ctx) {
      host.innerHTML = "";
      host.classList.add("iframe-game-host");

      const frame = document.createElement("iframe");
      frame.className = "iframe-game-host__frame";
      frame.src = config.src;
      frame.title = config.title;
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
      frame.setAttribute("allow", "autoplay; fullscreen; gamepad");

      const onPointerDown = () => {
        ctx.requestFocus();
      };

      frame.addEventListener("load", onPointerDown, { once: true });
      host.addEventListener("pointerdown", onPointerDown);
      host.appendChild(frame);
      ctx.updateTitle(config.title);

      return {
        unmount() {
          host.removeEventListener("pointerdown", onPointerDown);
          frame.src = "about:blank";
          frame.remove();
          host.classList.remove("iframe-game-host");
          host.innerHTML = "";
        }
      };
    }
  };
}
