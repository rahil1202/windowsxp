import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const TOPICS = [
  { q: "No sound from speakers", a: "Open Volume Control in system tray and unmute Wave output." },
  { q: "Desktop icons moved", a: "Right click desktop, choose Sort By > Name, then Refresh." },
  { q: "Slow performance", a: "Open Task Manager and close high CPU processes." },
  { q: "Network disconnected", a: "Check tray network icon. Reconnect adapter from Control Panel." },
  { q: "Blue screen appears", a: "Use Restart Computer button and run disk diagnostics." }
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const noop = () => {};

  const shell = createXpGameShell(host, {
    className: "help-support-app",
    menuButtons: [{ label: "File", onClick: noop }, { label: "View", onClick: noop }, { label: "Help", onClick: noop }],
    toolbarButtons: [{ label: "Back", onClick: noop }, { label: "Forward", onClick: noop }, { label: "Print", onClick: noop }],
    statusLeft: "Help and Support Center",
    statusRight: "Local"
  });

  host.dataset.appClass = "help-support-app";
  shell.body.innerHTML = `
    <section class="help-support-app__root">
      <header class="help-support-app__header">
        <h1>Help and Support Center</h1>
        <input type="search" class="help-support-app__search" placeholder="Search help topics" />
      </header>
      <div class="help-support-app__body">
        <section>
          <h2>Troubleshooting</h2>
          <ul class="help-support-app__topics" data-help-topics>
            ${TOPICS.map((t) => `<li><button type=\"button\" data-topic=\"${t.q}\">${t.q}</button></li>`).join("")}
          </ul>
        </section>
        <section class="help-support-app__detail" data-help-detail>
          <h2>System Information</h2>
          <p>OS: Windows XP Professional (Simulated)</p>
          <p>CPU: x86 Compatible</p>
          <p>RAM: 512 MB</p>
          <p>Build: 2600.xpsp_sp3</p>
          <p>Select a topic to see guided steps.</p>
        </section>
      </div>
    </section>
  `;

  const searchInput = shell.body.querySelector<HTMLInputElement>(".help-support-app__search");
  const topicsHost = shell.body.querySelector<HTMLElement>("[data-help-topics]");
  const detailHost = shell.body.querySelector<HTMLElement>("[data-help-detail]");

  function renderTopics(query = ""): void {
    if (!topicsHost) return;
    const q = query.trim().toLowerCase();
    const filtered = TOPICS.filter((t) => !q || t.q.toLowerCase().includes(q) || t.a.toLowerCase().includes(q));
    topicsHost.innerHTML = filtered.map((t) => `<li><button type=\"button\" data-topic=\"${t.q}\">${t.q}</button></li>`).join("");
    shell.setStatus(`${filtered.length} topic(s)`, q ? "Filtered" : "All topics");
  }

  shell.body.addEventListener(
    "click",
    (event) => {
      const topicButton = (event.target as HTMLElement).closest<HTMLElement>("[data-topic]");
      if (!topicButton?.dataset.topic || !detailHost) return;
      const topic = TOPICS.find((t) => t.q === topicButton.dataset.topic);
      if (!topic) return;
      detailHost.innerHTML = `<h2>${topic.q}</h2><p>${topic.a}</p><ol><li>Open Start menu</li><li>Go to Control Panel</li><li>Apply the suggested fix</li></ol>`;
    },
    { signal: abortController.signal }
  );

  searchInput?.addEventListener(
    "input",
    () => renderTopics(searchInput.value),
    { signal: abortController.signal }
  );

  renderTopics();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
