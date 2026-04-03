import { hammerToolIconUrl, windowsXpLogoUrl } from "../assets";
import { DesktopDestroyerGame } from "../game";
import { loadSettings } from "../storage";
import type { AppHostContext, AppInstance } from "../types";

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  host.innerHTML = `
    <section class="desktop-destroyer-app">
      <div class="desktop-destroyer-app__viewport">
        <img class="desktop-destroyer-app__boot-logo" src="${windowsXpLogoUrl}" alt="" />
        <canvas class="desktop-destroyer__canvas" aria-label="Desktop Destroyer canvas"></canvas>

        <section class="hud">
          <div class="loader is-visible">Loading Desktop Destroyer...</div>

          <div class="top-actions">
            <button type="button" class="action-button" data-action="mute">Mute (M)</button>
            <button type="button" class="action-button" data-action="reset">Reset (R)</button>
            <button type="button" class="action-button" data-action="fullscreen">Fullscreen (F)</button>
          </div>

          <button
            type="button"
            class="mobile-toolbox-button"
            data-mobile-toolbox
            aria-label="Open toolbox"
            aria-expanded="true"
          >
            <span
              class="mobile-toolbox-button__icon"
              data-mobile-toolbox-icon
              style="background-image:url('${hammerToolIconUrl}')"
            ></span>
          </button>

          <aside class="toolbox" aria-label="Toolbox">
            <div class="toolbox__header">
              <strong>Tools</strong>
              <span>F2 show / hide</span>
            </div>
            <div class="tool-list"></div>
            <div class="toolbox__footer">
              <span>1-9 quick select</span>
              <span>Click any icon</span>
            </div>
          </aside>
        </section>
      </div>
    </section>
  `;

  const viewport = host.querySelector<HTMLElement>(".desktop-destroyer-app__viewport");
  const canvas = host.querySelector<HTMLCanvasElement>(".desktop-destroyer__canvas");
  const bootLogo = host.querySelector<HTMLImageElement>(".desktop-destroyer-app__boot-logo");
  const loader = host.querySelector<HTMLElement>(".loader");
  const toolbox = host.querySelector<HTMLElement>(".toolbox");
  const toolList = host.querySelector<HTMLElement>(".tool-list");
  const mobileToolboxButton = host.querySelector<HTMLButtonElement>("[data-mobile-toolbox]");
  const mobileToolboxIcon = host.querySelector<HTMLElement>("[data-mobile-toolbox-icon]");
  const muteButton = host.querySelector<HTMLButtonElement>('[data-action="mute"]');
  const resetButton = host.querySelector<HTMLButtonElement>('[data-action="reset"]');
  const fullscreenButton = host.querySelector<HTMLButtonElement>('[data-action="fullscreen"]');

  if (
    !viewport ||
    !canvas ||
    !bootLogo ||
    !loader ||
    !toolbox ||
    !toolList ||
    !mobileToolboxButton ||
    !mobileToolboxIcon ||
    !muteButton ||
    !resetButton ||
    !fullscreenButton
  ) {
    throw new Error("Desktop Destroyer app shell failed to mount");
  }

    const game = new DesktopDestroyerGame(
      {
        root: viewport,
        canvas,
        bootLogo,
      loader,
      toolbox,
      toolList,
      mobileToolboxButton,
        mobileToolboxIcon,
        muteButton,
        resetButton,
        fullscreenButton,
        embedded: true
      },
      loadSettings()
    );

  ctx.updateTitle("Desktop Destroyer");
  game.start();

  return {
    unmount() {
      game.destroy();
      host.innerHTML = "";
    },
    onDesktopShown() {
      game.onDesktopShown();
    },
    onResize() {
      window.dispatchEvent(new Event("resize"));
    }
  };
}
