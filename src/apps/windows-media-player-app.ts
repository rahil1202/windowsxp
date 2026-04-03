import { assetManifest, utilityIconUrls } from "../assets";
import { loadShellPreferences, saveShellPreferences } from "../storage";
import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

const TRACKS = [
  {
    title: "Windows XP Startup",
    artist: "System Sounds",
    album: "Boot Sequence",
    src: assetManifest.sounds["xp-startup"].src ?? ""
  },
  {
    title: "Hammer Hit",
    artist: "Desktop Destroyer FX",
    album: "Impact Pack",
    src: assetManifest.sounds["glass-hit"].src ?? ""
  },
  {
    title: "Stamp Hit",
    artist: "Desktop Destroyer FX",
    album: "Impact Pack",
    src: assetManifest.sounds["stamp-hit"].src ?? ""
  }
].filter((track) => track.src.length > 0);

type VisualizerMode = "bars" | "scope" | "pulse";

function formatTime(value: number): string {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shellPrefs = loadShellPreferences();
  const shell = createXpGameShell(host, {
    className: "media-player-app",
    menuButtons: [
      { label: "File", title: "Stop", onClick: () => stopPlayback() },
      { label: "View", title: "Toggle mini mode", onClick: () => toggleMiniMode() },
      { label: "Play", title: "Play", onClick: () => void togglePlay() },
      { label: "Help", title: "Windows Media Player", onClick: () => shell.setStatus("Now Playing", "Windows Media Player") }
    ],
    statusLeft: "Ready",
    statusRight: "Windows Media Player"
  });

  let currentIndex = 0;
  let activeLibrary: "playlist" | "artists" | "albums" = "playlist";
  let visualizerMode: VisualizerMode = shellPrefs.mediaPlayer.visualizer;
  let miniMode = shellPrefs.mediaPlayer.miniMode;
  let visualizerTimer = 0;
  const audio = new Audio(TRACKS[0]?.src ?? "");
  audio.preload = "auto";

  shell.body.innerHTML = `
    <section class="media-player-app__root${miniMode ? " is-mini" : ""}">
      <aside class="media-player-app__sidebar">
        <div class="media-player-app__sidebar-title">Media Library</div>
        <div class="media-player-app__library-tabs">
          <button type="button" data-library="playlist">Playlist</button>
          <button type="button" data-library="artists">Artists</button>
          <button type="button" data-library="albums">Albums</button>
        </div>
        <div class="media-player-app__playlist"></div>
      </aside>
      <main class="media-player-app__main">
        <div class="media-player-app__hero">
          <span class="media-player-app__disc" style="background-image:url('${utilityIconUrls.windowsMediaPlayer}')"></span>
          <div>
            <strong data-track-title>Windows Media Player</strong>
            <span data-track-artist>Demo playlist</span>
          </div>
          <button type="button" class="media-player-app__mini-toggle" data-player-action="mini">Mini mode</button>
        </div>
        <div class="media-player-app__seek">
          <span data-track-current>0:00</span>
          <input type="range" min="0" max="100" value="0" aria-label="Seek track" data-track-range />
          <span data-track-duration>0:00</span>
        </div>
        <div class="media-player-app__controls">
          <button type="button" data-player-action="prev">⏮</button>
          <button type="button" data-player-action="play">Play</button>
          <button type="button" data-player-action="stop">Stop</button>
          <button type="button" data-player-action="next">⏭</button>
        </div>
        <div class="media-player-app__visualizer-toolbar">
          <button type="button" data-visualizer="bars">Bars</button>
          <button type="button" data-visualizer="scope">Scope</button>
          <button type="button" data-visualizer="pulse">Pulse</button>
        </div>
        <div class="media-player-app__visualizer" data-visualizer-surface>
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </main>
    </section>
  `;

  const root = shell.body.querySelector<HTMLElement>(".media-player-app__root");
  const playlist = shell.body.querySelector<HTMLElement>(".media-player-app__playlist");
  const title = shell.body.querySelector<HTMLElement>("[data-track-title]");
  const artist = shell.body.querySelector<HTMLElement>("[data-track-artist]");
  const current = shell.body.querySelector<HTMLElement>("[data-track-current]");
  const duration = shell.body.querySelector<HTMLElement>("[data-track-duration]");
  const range = shell.body.querySelector<HTMLInputElement>("[data-track-range]");
  const visualizerSurface = shell.body.querySelector<HTMLElement>("[data-visualizer-surface]");
  if (!root || !playlist || !title || !artist || !current || !duration || !range || !visualizerSurface) {
    throw new Error("Windows Media Player failed to mount");
  }
  const rootElement = root;
  const playlistElement = playlist;
  const titleElement = title;
  const artistElement = artist;
  const currentElement = current;
  const durationElement = duration;
  const rangeElement = range;
  const visualizerElement = visualizerSurface;

  function persistPrefs(): void {
    shellPrefs.mediaPlayer.visualizer = visualizerMode;
    shellPrefs.mediaPlayer.miniMode = miniMode;
    saveShellPreferences(shellPrefs);
  }

  function renderLibrary(): void {
    const libraryMarkup =
      activeLibrary === "playlist"
        ? TRACKS.map(
            (track, index) => `
              <button type="button" class="media-player-app__track${index === currentIndex ? " is-active" : ""}" data-track-index="${index}">
                <span class="media-player-app__track-icon"></span>
                <span class="media-player-app__track-copy">
                  <strong>${track.title}</strong>
                  <em>${track.artist}</em>
                </span>
              </button>
            `
          ).join("")
        : [...new Set(TRACKS.map((track) => (activeLibrary === "artists" ? track.artist : track.album)))]
            .map(
              (entry) => `
                <div class="media-player-app__library-row">
                  <strong>${entry}</strong>
                </div>
              `
            )
            .join("");
    playlistElement.innerHTML = libraryMarkup;

    shell.body.querySelectorAll<HTMLElement>("[data-library]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.library === activeLibrary);
    });
  }

  function renderVisualizer(): void {
    visualizerElement.dataset.mode = visualizerMode;
    shell.body.querySelectorAll<HTMLElement>("[data-visualizer]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.visualizer === visualizerMode);
    });
  }

  function renderMiniMode(): void {
    rootElement.classList.toggle("is-mini", miniMode);
  }

  function loadTrack(index: number): void {
    if (!TRACKS[index]) {
      return;
    }
    currentIndex = index;
    audio.src = TRACKS[index].src;
    audio.currentTime = 0;
    titleElement.textContent = TRACKS[index].title;
    artistElement.textContent = `${TRACKS[index].artist} • ${TRACKS[index].album}`;
    shell.setStatus(`Loaded ${TRACKS[index].title}`, "Now Playing");
    renderLibrary();
  }

  async function togglePlay(): Promise<void> {
    if (!audio.src) {
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        shell.setStatus(`Playing ${TRACKS[currentIndex]?.title ?? "track"}`, "Now Playing");
      } catch {
        shell.setStatus("Playback blocked by browser autoplay", "Now Playing");
      }
    } else {
      audio.pause();
      shell.setStatus(`Paused ${TRACKS[currentIndex]?.title ?? "track"}`, "Now Playing");
    }
  }

  function stopPlayback(): void {
    audio.pause();
    audio.currentTime = 0;
    rangeElement.value = "0";
    currentElement.textContent = "0:00";
    shell.setStatus("Stopped", "Now Playing");
  }

  function changeTrack(delta: number): void {
    if (TRACKS.length === 0) {
      return;
    }
    loadTrack((currentIndex + delta + TRACKS.length) % TRACKS.length);
  }

  function toggleMiniMode(): void {
    miniMode = !miniMode;
    renderMiniMode();
    persistPrefs();
  }

  function startVisualizerLoop(): void {
    window.clearInterval(visualizerTimer);
    visualizerTimer = window.setInterval(() => {
      visualizerElement.querySelectorAll("span").forEach((bar, index) => {
        const seed = performance.now() / 260 + index * 0.7;
        const next = visualizerMode === "pulse"
          ? 24 + Math.abs(Math.sin(seed)) * 84
          : visualizerMode === "scope"
            ? 18 + (Math.sin(seed) + 1) * 44
            : 12 + Math.abs(Math.cos(seed)) * 76;
        (bar as HTMLElement).style.height = `${next}%`;
      });
    }, 120);
  }

  shell.setToolbar([
    { label: "Previous", onClick: () => changeTrack(-1) },
    { label: "Play / Pause", onClick: () => void togglePlay() },
    { label: "Next", onClick: () => changeTrack(1) },
    { label: "Mini Player", onClick: () => toggleMiniMode(), active: miniMode }
  ]);

  shell.body.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLElement>("[data-player-action]")?.dataset.playerAction;
      const trackIndex = target?.closest<HTMLElement>("[data-track-index]")?.dataset.trackIndex;
      const library = target?.closest<HTMLElement>("[data-library]")?.dataset.library;
      const visualizer = target?.closest<HTMLElement>("[data-visualizer]")?.dataset.visualizer as VisualizerMode | undefined;

      if (library === "playlist" || library === "artists" || library === "albums") {
        activeLibrary = library;
        renderLibrary();
        return;
      }

      if (visualizer) {
        visualizerMode = visualizer;
        renderVisualizer();
        persistPrefs();
        return;
      }

      if (trackIndex) {
        loadTrack(Number(trackIndex));
        void togglePlay();
        return;
      }

      if (action === "prev") {
        changeTrack(-1);
      } else if (action === "play") {
        void togglePlay();
      } else if (action === "stop") {
        stopPlayback();
      } else if (action === "next") {
        changeTrack(1);
      } else if (action === "mini") {
        toggleMiniMode();
      }
    },
    { signal: abortController.signal }
  );

  rangeElement.addEventListener(
    "input",
    () => {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = (Number(rangeElement.value) / 100) * audio.duration;
      }
    },
    { signal: abortController.signal }
  );

  audio.addEventListener("timeupdate", () => {
    currentElement.textContent = formatTime(audio.currentTime);
    durationElement.textContent = formatTime(audio.duration);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      rangeElement.value = String((audio.currentTime / audio.duration) * 100);
    }
  });

  audio.addEventListener("ended", () => {
    changeTrack(1);
    void togglePlay();
  });

  renderLibrary();
  renderVisualizer();
  renderMiniMode();
  startVisualizerLoop();
  loadTrack(0);

  return {
    unmount() {
      abortController.abort();
      audio.pause();
      audio.src = "";
      window.clearInterval(visualizerTimer);
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
