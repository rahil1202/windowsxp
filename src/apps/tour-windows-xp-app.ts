import { windowsXpLogoUrl } from "../assets";
import type { AppHostContext, AppInstance } from "../types";

const SLIDES = [
  {
    title: "Welcome to Windows XP",
    body: "Take a quick guided look at the desktop, Start menu, and the classic apps that ship with this XP web desktop."
  },
  {
    title: "A new Start menu",
    body: "The Start menu keeps pinned apps on the left, system shortcuts on the right, and Games below."
  },
  {
    title: "Desktop programs",
    body: "Launch accessories like WordPad, Paint, Character Map, and Remote Desktop Connection from the desktop or Run dialog."
  },
  {
    title: "Classic games",
    body: "Minesweeper, Solitaire, FreeCell, Hearts, Spider Solitaire, Checkers, Reversi, InkBall, and more now live inside XP-style windows."
  }
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  let index = 0;

  host.innerHTML = `
    <section class="tour-app">
      <aside class="tour-app__hero">
        <img src="${windowsXpLogoUrl}" alt="" />
      </aside>
      <main class="tour-app__content">
        <h2 data-tour-title></h2>
        <p data-tour-body></p>
        <div class="tour-app__steps" data-tour-steps></div>
        <footer class="tour-app__actions">
          <button type="button" data-tour-prev>Previous</button>
          <button type="button" data-tour-next>Next</button>
        </footer>
      </main>
    </section>
  `;

  const titleEl = host.querySelector<HTMLElement>("[data-tour-title]");
  const bodyEl = host.querySelector<HTMLElement>("[data-tour-body]");
  const stepsEl = host.querySelector<HTMLElement>("[data-tour-steps]");

  if (!titleEl || !bodyEl || !stepsEl) {
    throw new Error("Tour Windows XP failed to mount");
  }
  const slideTitleEl = titleEl;
  const slideBodyEl = bodyEl;
  const slideStepsEl = stepsEl;

  function render(): void {
    const slide = SLIDES[index] ?? SLIDES[0];
    slideTitleEl.textContent = slide.title;
    slideBodyEl.textContent = slide.body;
    slideStepsEl.innerHTML = SLIDES.map((_, slideIndex) => `<span class="tour-app__step${slideIndex === index ? " is-active" : ""}"></span>`).join("");
    ctx.updateTitle(`${slide.title} - Tour Windows XP`);
  }

  host.addEventListener(
    "click",
    (event) => {
      if ((event.target as HTMLElement | null)?.closest("[data-tour-prev]")) {
        index = (index - 1 + SLIDES.length) % SLIDES.length;
        render();
      } else if ((event.target as HTMLElement | null)?.closest("[data-tour-next]")) {
        index = (index + 1) % SLIDES.length;
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
