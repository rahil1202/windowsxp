import {
  assetManifest,
  desktopIcons,
  desktopWallpaperUrl,
  toolOrder,
  windowsXpLogoUrl
} from "./assets";
import { AudioEngine } from "./audio";
import { saveSettings } from "./storage";
import { createTools } from "./tools";
import type {
  AssetManifest,
  CameraShake,
  CrawlerEntity,
  Decal,
  GameSettings,
  GameState,
  Particle,
  Point,
  ToolContext,
  ToolDefinition,
  ToolId
} from "./types";

const MAX_PARTICLES = 1400;
const MAX_TERMITES = 64;

interface GameElements {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  bootLogo: HTMLImageElement;
  loader: HTMLElement;
  toolbox: HTMLElement;
  toolList: HTMLElement;
  mobileToolboxButton: HTMLButtonElement;
  mobileToolboxIcon: HTMLElement;
  muteButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
  embedded?: boolean;
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void>;
  }
}

export class DesktopDestroyerGame {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio = new AudioEngine(assetManifest);
  private readonly abortController = new AbortController();
  private readonly embeddedMode: boolean;
  private readonly tools: Record<ToolId, ToolDefinition>;
  private readonly toolButtons = new Map<ToolId, HTMLButtonElement>();
  private readonly toolIconImages = new Map<ToolId, HTMLImageElement>();
  private readonly toolIconSpriteCanvases = new Map<ToolId, HTMLCanvasElement>();
  private readonly toolIconSprites = new Map<ToolId, string>();
  private readonly toolCursorSprites = new Map<ToolId, string>();
  private readonly backgroundImage = new Image();
  private readonly desktopIconImages = new Map<string, HTMLImageElement>();
  private readonly desktopIconSprites = new Map<string, HTMLCanvasElement>();
  private readonly windowsLogoImage = new Image();
  private windowsLogoSprite: HTMLCanvasElement | null = null;
  private readonly state: GameState;
  private readonly assetManifest: AssetManifest = assetManifest;
  private readonly readyPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;

  private animationFrame = 0;
  private lastFrameTime = 0;
  private nextId = 1;
  private toolboxWasAutoOpened = false;
  private deterministicAdvance = false;
  private toolFocusIndex = 0;

  constructor(
    private readonly elements: GameElements,
    settings: GameSettings
  ) {
    const context = elements.canvas.getContext("2d", {
      alpha: false
    });
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.embeddedMode = Boolean(elements.embedded);

    this.state = {
      width: 0,
      height: 0,
      selectedTool: settings.selectedTool,
      decals: [],
      particles: [],
      entities: [],
      cameraShake: {
        strength: 0,
        decay: 12,
        x: 0,
        y: 0
      },
      settings,
      pointer: {
        x: 0,
        y: 0,
        worldX: 0,
        worldY: 0,
        dx: 0,
        dy: 0,
        down: false,
        active: false,
        touchMode: false
      },
      toolboxOpen: true,
      audioUnlocked: false,
      lastToolUse: {}
    };

    const registry = createTools(this.assetManifest.icons, this.assetManifest.cursors);
    this.tools = Object.fromEntries(
      registry.map((tool) => [tool.id, tool] as const)
    ) as Record<ToolId, ToolDefinition>;

    this.installUi();
    this.readyPromise = this.prepareImages();
    this.attachEvents();
    this.audio.preload();
    this.audio.setMuted(settings.muted);
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.elements.root);
    }
    this.setToolboxOpen(this.state.toolboxOpen);
    this.updateButtonLabels();
    this.updateToolSelection(this.state.selectedTool, false);
    this.installTestingHooks();
    this.render();
  }

  start(): void {
    this.elements.loader.classList.add("is-visible");
    this.elements.loader.textContent =
      "Press F2 to toggle the tool picker. On mobile, tap the floating hammer button. Use keys 1-9 to switch tools.";
    this.lastFrameTime = performance.now();
    this.animationFrame = window.requestAnimationFrame(this.onFrame);
  }

  async primeAudio(): Promise<void> {
    await this.unlockAudio();
  }

  onDesktopShown(): void {
    // this.playStartupSoundIfReady();
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationFrame);
    this.abortController.abort();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.audio.stopAllLoops();
    window.render_game_to_text = undefined;
    window.advanceTime = undefined;
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  private installUi(): void {
    this.elements.toolList.innerHTML = "";
    for (const toolId of toolOrder) {
      const tool = this.tools[toolId];
      const button = document.createElement("button");
      button.className = "tool-button";
      button.type = "button";
      button.dataset.tool = tool.id;
      button.innerHTML = `
        <span class="tool-button__icon" data-tool-icon="${tool.id}" style="background-image:url('${tool.iconPath}')"></span>
        <span class="tool-button__meta">
          <strong>${tool.hotkey}: ${tool.label}</strong>
          <span>Click to equip</span>
        </span>
      `;
      button.addEventListener("click", () => {
        void this.unlockAudio();
        this.updateToolSelection(tool.id);
      });
      this.elements.toolList.appendChild(button);
      this.toolButtons.set(tool.id, button);
    }
  }

  private prepareImages(): Promise<void> {
    const imagePromises: Promise<void>[] = [];
    this.backgroundImage.src = desktopWallpaperUrl;
    this.backgroundImage.decoding = "async";
    this.backgroundImage.addEventListener("load", () => this.render());
    imagePromises.push(this.waitForImage(this.backgroundImage));

    for (const icon of desktopIcons) {
      const image = new Image();
      image.src = icon.imagePath;
      image.decoding = "async";
      image.addEventListener("load", () => {
        this.desktopIconSprites.set(icon.label, this.createTransparentSprite(image));
        this.render();
      });
      this.desktopIconImages.set(icon.label, image);
      imagePromises.push(this.waitForImage(image));
    }

    this.windowsLogoImage.src = windowsXpLogoUrl;
    this.windowsLogoImage.decoding = "async";
    this.windowsLogoImage.addEventListener("load", () => {
      this.windowsLogoSprite = this.createTransparentSprite(this.windowsLogoImage);
      this.elements.bootLogo.src = this.windowsLogoSprite.toDataURL("image/png");
      this.render();
    });
    imagePromises.push(this.waitForImage(this.windowsLogoImage));

    for (const toolId of toolOrder) {
      const image = new Image();
      image.src = this.tools[toolId].iconPath;
        image.decoding = "async";
        image.addEventListener("load", () => {
          const sprite = this.createTransparentSprite(image);
          this.toolIconSpriteCanvases.set(toolId, sprite);
          this.toolIconSprites.set(toolId, sprite.toDataURL("image/png"));
          this.toolCursorSprites.set(toolId, this.createCursorSprite(sprite));
          if (toolId === "hammer") {
            this.elements.mobileToolboxIcon.style.backgroundImage = `url("${sprite.toDataURL("image/png")}")`;
          }
          this.updateToolButtonIcon(toolId);
          if (this.state.selectedTool === toolId) {
            this.updateCanvasCursor(toolId);
          }
        });
        this.toolIconImages.set(toolId, image);
        imagePromises.push(this.waitForImage(image));
      }

    return Promise.all(imagePromises).then(() => undefined);
  }

  private waitForImage(image: HTMLImageElement): Promise<void> {
    if (image.complete) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const finish = () => {
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  }

  private createTransparentSprite(image: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return canvas;
    }

    context.drawImage(image, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const { data } = frame;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];
    const cornerSamples = [
      this.readPixel(data, width, 0, 0),
      this.readPixel(data, width, width - 1, 0),
      this.readPixel(data, width, 0, height - 1),
      this.readPixel(data, width, width - 1, height - 1)
    ];

    const shouldClear = (x: number, y: number): boolean => {
      const pixel = this.readPixel(data, width, x, y);
      if (pixel.a < 8) {
        return true;
      }
      return cornerSamples.some((sample) => {
        const distance =
          Math.abs(pixel.r - sample.r) +
          Math.abs(pixel.g - sample.g) +
          Math.abs(pixel.b - sample.b);
        return distance <= 54;
      });
    };

    const push = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
      }
      const index = y * width + x;
      if (visited[index] === 1 || !shouldClear(x, y)) {
        return;
      }
      visited[index] = 1;
      queue.push(index);
    };

    for (let x = 0; x < width; x++) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      push(0, y);
      push(width - 1, y);
    }

    while (queue.length > 0) {
      const index = queue.pop()!;
      const x = index % width;
      const y = Math.floor(index / width);
      data[index * 4 + 3] = 0;
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
    }

    context.clearRect(0, 0, width, height);
    context.putImageData(frame, 0, 0);
    return canvas;
  }

  private createCursorSprite(source: HTMLCanvasElement): string {
    const scale = Math.min(1, 48 / Math.max(source.width, source.height));
    const cursorCanvas = document.createElement("canvas");
    cursorCanvas.width = Math.max(24, Math.round(source.width * scale));
    cursorCanvas.height = Math.max(24, Math.round(source.height * scale));
    const context = cursorCanvas.getContext("2d");
    if (!context) {
      return source.toDataURL("image/png");
    }
    context.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    context.drawImage(source, 0, 0, cursorCanvas.width, cursorCanvas.height);
    return cursorCanvas.toDataURL("image/png");
  }

  private readPixel(
    data: Uint8ClampedArray,
    width: number,
    x: number,
    y: number
  ): { r: number; g: number; b: number; a: number } {
    const offset = (y * width + x) * 4;
    return {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
      a: data[offset + 3]
    };
  }

  private updateToolButtonIcon(toolId: ToolId): void {
    const button = this.toolButtons.get(toolId);
    const iconUrl = this.toolIconSprites.get(toolId);
    if (!button || !iconUrl) {
      return;
    }
    const icon = button.querySelector<HTMLElement>("[data-tool-icon]");
    if (icon) {
      icon.style.backgroundImage = `url("${iconUrl}")`;
    }
  }

  private attachEvents(): void {
    const listenerOptions = { signal: this.abortController.signal };
    window.addEventListener("resize", this.resize, listenerOptions);
    document.addEventListener("visibilitychange", this.onVisibilityChange, listenerOptions);
    document.addEventListener("fullscreenchange", this.onFullscreenChange, listenerOptions);

    const canvas = this.elements.canvas;
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.toggleToolbox();
    }, listenerOptions);

    canvas.addEventListener("pointerdown", (event) => {
      void this.unlockAudio();
      this.updatePointer(event);
      if (event.button === 2) {
        this.toggleToolbox();
        return;
      }
      if (event.button !== 0) {
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      this.state.pointer.down = true;
      this.state.pointer.touchMode = event.pointerType === "touch";
      this.getSelectedTool().onPress(this.makeToolContext(), this.pointerPoint());
      if (!this.toolboxWasAutoOpened) {
        this.toolboxWasAutoOpened = true;
        window.setTimeout(() => {
          this.elements.loader.classList.remove("is-visible");
        }, 1200);
      }
    }, listenerOptions);

    canvas.addEventListener("pointermove", (event) => {
      this.updatePointer(event);
      if (this.state.pointer.down) {
        this.getSelectedTool().onMove(this.makeToolContext(), this.pointerPoint());
      }
    }, listenerOptions);

    const finishPointer = (event: PointerEvent) => {
      this.updatePointer(event);
      if (!this.state.pointer.down) {
        return;
      }
      this.state.pointer.down = false;
      this.getSelectedTool().onRelease(this.makeToolContext(), this.pointerPoint());
    };

    canvas.addEventListener("pointerup", finishPointer, listenerOptions);
    canvas.addEventListener("pointercancel", finishPointer, listenerOptions);
    canvas.addEventListener("pointerleave", (event) => {
      this.state.pointer.active = false;
      finishPointer(event);
    }, listenerOptions);

    window.addEventListener("keydown", (event) => {
      if (event.repeat) {
        return;
      }
      if (event.key === "F2" || event.key.toLowerCase() === "b") {
        event.preventDefault();
        this.toggleToolbox();
        return;
      }
      if (this.state.toolboxOpen && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        this.moveToolFocus(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (this.state.toolboxOpen && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        this.updateToolSelection(toolOrder[this.toolFocusIndex]);
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void this.toggleFullscreen();
        return;
      }
      if (event.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        this.toggleMute();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        this.reset();
        return;
      }

      const tool = Object.values(this.tools).find(
        (candidate) => candidate.hotkey === event.key
      );
      if (tool) {
        event.preventDefault();
        this.updateToolSelection(tool.id);
      }
    }, listenerOptions);

    this.elements.muteButton.addEventListener("click", () => {
      void this.unlockAudio();
      this.toggleMute();
    }, listenerOptions);
    this.elements.resetButton.addEventListener("click", () => {
      void this.unlockAudio();
      this.reset();
    }, listenerOptions);
    this.elements.fullscreenButton.addEventListener("click", () => {
      void this.unlockAudio();
      void this.toggleFullscreen();
    }, listenerOptions);
    this.elements.mobileToolboxButton.addEventListener("click", () => {
      void this.unlockAudio();
      this.toggleToolbox();
    }, listenerOptions);
  }

  private installTestingHooks(): void {
    window.render_game_to_text = () => {
      return JSON.stringify(
        {
          coordinateSystem: {
            origin: "top-left",
            xAxis: "right",
            yAxis: "down"
          },
          selectedTool: this.state.selectedTool,
          pointer: {
            x: Math.round(this.state.pointer.worldX),
            y: Math.round(this.state.pointer.worldY),
            down: this.state.pointer.down
          },
          counts: {
            decals: this.state.decals.length,
            particles: this.state.particles.length,
            termites: this.state.entities.length
          },
          decals: this.state.decals.slice(-8).map((decal) => ({
            type: decal.type,
            x: Math.round(decal.x),
            y: Math.round(decal.y),
            radius: Math.round(decal.radius)
          })),
          termites: this.state.entities.slice(0, 12).map((entity) => ({
            x: Math.round(entity.x),
            y: Math.round(entity.y),
            hunger: Number(entity.hunger.toFixed(2))
          })),
          toolboxOpen: this.state.toolboxOpen,
          audioUnlocked: this.state.audioUnlocked,
          muted: this.state.settings.muted
        },
        null,
        2
      );
    };

    window.advanceTime = async (ms: number) => {
      this.deterministicAdvance = true;
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i++) {
        this.update(1 / 60);
      }
      this.render();
      this.lastFrameTime = performance.now();
      this.deterministicAdvance = false;
    };
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.state.pointer.down = false;
      this.audio.stopAllLoops();
    }
  };

  private onFullscreenChange = (): void => {
    this.updateButtonLabels();
    this.resize();
  };

  private onFrame = (timestamp: number): void => {
    const dt = Math.max(0, Math.min(1 / 20, (timestamp - this.lastFrameTime) / 1000));
    this.lastFrameTime = timestamp;
    if (!this.deterministicAdvance) {
      this.update(dt);
    }
    this.render();
    this.animationFrame = window.requestAnimationFrame(this.onFrame);
  };

  private resize = (): void => {
    const bounds = this.elements.root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width || window.innerWidth));
    const height = Math.max(1, Math.floor(bounds.height || window.innerHeight));
    const dpi = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1)));
    this.state.width = width;
    this.state.height = height;
    this.elements.canvas.width = Math.floor(width * dpi);
    this.elements.canvas.height = Math.floor(height * dpi);
    this.elements.canvas.style.width = `${width}px`;
    this.elements.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  };

  private update(dt: number): void {
    this.updateShake(dt);
    this.updateParticles(dt);
    this.updateTermites(dt);

    const currentTool = this.getSelectedTool();
    currentTool.update?.(this.makeToolContext(), dt);
    this.trimCollections();
    this.updateStatusText();
  }

  private updateShake(dt: number): void {
    const shake = this.state.cameraShake;
    if (shake.strength <= 0.01) {
      shake.strength = 0;
      shake.x = 0;
      shake.y = 0;
      return;
    }
    shake.strength = Math.max(0, shake.strength - shake.decay * dt);
    shake.x = this.random(-shake.strength, shake.strength);
    shake.y = this.random(-shake.strength, shake.strength);
  }

  private updateParticles(dt: number): void {
    this.state.particles = this.state.particles.filter((particle) => {
      particle.age += dt;
      if (particle.age >= particle.ttl) {
        return false;
      }
      particle.vx += particle.ax * dt;
      particle.vy += particle.ay * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      particle.opacity = Math.max(0, 1 - particle.age / particle.ttl);
      return true;
    });
  }

  private updateTermites(dt: number): void {
    const boundsPadding = 24;
    for (const termite of this.state.entities) {
      termite.turnTimer -= dt;
      termite.cooldown -= dt;
      termite.hunger += dt * 0.18;

      if (termite.turnTimer <= 0) {
        termite.direction += this.random(-0.9, 0.9);
        termite.turnTimer = this.random(0.18, 0.9);
      }

      termite.x += Math.cos(termite.direction) * termite.speed * dt;
      termite.y += Math.sin(termite.direction) * termite.speed * dt;

      if (termite.x < boundsPadding || termite.x > this.state.width - boundsPadding) {
        termite.direction = Math.PI - termite.direction;
        termite.x = Math.max(boundsPadding, Math.min(this.state.width - boundsPadding, termite.x));
      }
      if (termite.y < boundsPadding || termite.y > this.state.height - boundsPadding) {
        termite.direction = -termite.direction;
        termite.y = Math.max(boundsPadding, Math.min(this.state.height - boundsPadding, termite.y));
      }

      if (termite.cooldown <= 0) {
        termite.cooldown = this.random(0.18, 0.48);
        this.spawnDecal({
          type: "termite-hole",
          x: termite.x + this.random(-6, 6),
          y: termite.y + this.random(-6, 6),
          rotation: this.random(0, Math.PI * 2),
          scale: this.random(0.3, 0.75),
          opacity: 0.88,
          zIndex: 0,
          radius: termite.damageRadius * this.random(0.8, 1.25)
        });
        if (Math.random() > 0.65) {
          this.audio.play("termite");
        }
        if (Math.random() > 0.7) {
          this.spawnParticle({
            type: "chip",
            x: termite.x,
            y: termite.y,
            vx: this.random(-24, 24),
            vy: this.random(-30, -8),
            ax: 0,
            ay: 80,
            ttl: this.random(0.16, 0.32),
            size: this.random(2, 4),
            rotation: this.random(0, Math.PI * 2),
            spin: this.random(-5, 5),
            opacity: 0.6,
            blendMode: "source-over"
          });
        }
      }
    }
  }

  private updateCanvasCursor(toolId: ToolId): void {
    const selected = this.tools[toolId];
    const cursorUrl =
      this.toolCursorSprites.get(toolId) ??
      this.toolIconSprites.get(toolId) ??
      selected.cursorPath;
    this.elements.canvas.style.cursor = `url("${cursorUrl}") 8 8, crosshair`;
  }

  private render(): void {
    const dpi = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1)));
    this.ctx.save();
    this.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    this.ctx.clearRect(0, 0, this.state.width, this.state.height);
    this.ctx.translate(this.state.cameraShake.x, this.state.cameraShake.y);
    this.drawDesktopBackground();
    this.drawDecals();
    this.drawTermites();
    this.drawParticles();
    this.ctx.restore();
    this.drawScreenFx();
  }

  private drawDesktopBackground(): void {
    const { width, height } = this.state;
    if (this.embeddedMode) {
      if (this.backgroundImage.complete && this.backgroundImage.naturalWidth > 0) {
        this.drawCoverImage(this.backgroundImage, 0, 0, width, height);
      } else {
        const fallback = this.ctx.createLinearGradient(0, 0, 0, height);
        fallback.addColorStop(0, "#97ccff");
        fallback.addColorStop(0.5, "#6baefe");
        fallback.addColorStop(1, "#2a78cf");
        this.ctx.fillStyle = fallback;
        this.ctx.fillRect(0, 0, width, height);
      }

      const overlay = this.ctx.createLinearGradient(0, 0, 0, height);
      overlay.addColorStop(0, "rgba(255,255,255,0.08)");
      overlay.addColorStop(0.4, "rgba(255,255,255,0.02)");
      overlay.addColorStop(1, "rgba(0,0,0,0.06)");
      this.ctx.fillStyle = overlay;
      this.ctx.fillRect(0, 0, width, height);
      return;
    }

    if (this.backgroundImage.complete && this.backgroundImage.naturalWidth > 0) {
      this.drawCoverImage(this.backgroundImage, 0, 0, width, height);
    } else {
      const fallback = this.ctx.createLinearGradient(0, 0, 0, height);
      fallback.addColorStop(0, "#97ccff");
      fallback.addColorStop(0.5, "#6baefe");
      fallback.addColorStop(1, "#2a78cf");
      this.ctx.fillStyle = fallback;
      this.ctx.fillRect(0, 0, width, height);
    }

    const overlay = this.ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, "rgba(255,255,255,0.10)");
    overlay.addColorStop(0.4, "rgba(255,255,255,0.02)");
    overlay.addColorStop(1, "rgba(0,0,0,0.08)");
    this.ctx.fillStyle = overlay;
    this.ctx.fillRect(0, 0, width, height);

    this.drawDesktopIcons();
    this.drawTaskbar();
  }

  private drawDesktopIcons(): void {
    const compact = this.state.width < 700;
    const iconScale = compact ? Math.max(0.68, Math.min(0.9, this.state.width / 700)) : 1;
    const size = Math.round(48 * iconScale);
    const labelFont = compact ? 10 : 12;
    const verticalOffset = compact ? 18 : 0;
    this.ctx.font = `${labelFont}px Tahoma, Verdana, sans-serif`;
    this.ctx.textAlign = "center";
    for (const icon of desktopIcons) {
      const sprite = this.desktopIconSprites.get(icon.label);
      const image = this.desktopIconImages.get(icon.label);
      const x = Math.round(icon.x * iconScale);
      const y = Math.round(icon.y * iconScale + verticalOffset);
      if (sprite) {
        this.ctx.drawImage(sprite, x, y, size, size);
      } else if (image && image.complete && image.naturalWidth > 0) {
        this.ctx.drawImage(image, x, y, size, size);
      } else {
        this.ctx.fillStyle = "rgba(232, 239, 248, 0.82)";
        this.ctx.fillRect(x + Math.round(6 * iconScale), y + Math.round(6 * iconScale), size - 12, size - 12);
      }

      const labelY = y + size + Math.round(14 * iconScale);
      const labelWidth = Math.max(Math.round(58 * iconScale), this.ctx.measureText(icon.label).width + 14);
      this.ctx.fillStyle = "rgba(16, 51, 111, 0.34)";
      this.ctx.fillRect(x - (labelWidth - size) / 2, labelY - labelFont, labelWidth, labelFont + 6);
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillText(icon.label, x + size / 2, labelY);
    }
  }

  private drawTaskbar(): void {
    const compact = this.state.width < 700;
    const tiny = this.state.width < 460;
    const barHeight = tiny ? 34 : compact ? 36 : 40;
    const top = this.state.height - barHeight;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const dateLabel = now.toLocaleDateString([], {
      month: "numeric",
      day: "numeric",
      year: "2-digit"
    });

    const barGradient = this.ctx.createLinearGradient(0, top, 0, top + barHeight);
    barGradient.addColorStop(0, "#3f86ff");
    barGradient.addColorStop(0.08, "#2c74ef");
    barGradient.addColorStop(0.55, "#1d4fc8");
    barGradient.addColorStop(1, "#173aa8");
    this.ctx.fillStyle = barGradient;
    this.ctx.fillRect(0, top, this.state.width, barHeight);

    this.ctx.fillStyle = "rgba(255,255,255,0.42)";
    this.ctx.fillRect(0, top, this.state.width, 1);
    this.ctx.fillStyle = "rgba(10, 27, 88, 0.65)";
    this.ctx.fillRect(0, top + barHeight - 1, this.state.width, 1);

    const startX = 4;
    const startY = top + 3;
    const startW = tiny ? 76 : compact ? 86 : 96;
    const startH = barHeight - 8;
    this.drawRoundedRect(startX, startY, startW, startH, 11);
    const startGradient = this.ctx.createLinearGradient(0, startY, 0, startY + startH);
    startGradient.addColorStop(0, "#48b443");
    startGradient.addColorStop(0.45, "#339432");
    startGradient.addColorStop(1, "#24721f");
    this.ctx.fillStyle = startGradient;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255,255,255,0.32)";
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.save();
    this.ctx.beginPath();
    this.drawRoundedRect(startX + 1.5, startY + 1.5, startW - 3, startH * 0.45, 10);
    this.ctx.clip();
    const startGloss = this.ctx.createLinearGradient(0, startY, 0, startY + startH * 0.55);
    startGloss.addColorStop(0, "rgba(255,255,255,0.45)");
    startGloss.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = startGloss;
    this.ctx.fillRect(startX + 1.5, startY + 1.5, startW - 3, startH * 0.55);
    this.ctx.restore();
    const logoSize = tiny ? 16 : 20;
    if (this.windowsLogoSprite) {
      this.ctx.drawImage(this.windowsLogoSprite, startX + 8, startY + (startH - logoSize) / 2, logoSize, logoSize);
    } else if (this.windowsLogoImage.complete && this.windowsLogoImage.naturalWidth > 0) {
      this.ctx.drawImage(this.windowsLogoImage, startX + 8, startY + (startH - logoSize) / 2, logoSize, logoSize);
    }
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = tiny
      ? "italic bold 13px Tahoma, Verdana, sans-serif"
      : compact
        ? "italic bold 14px Tahoma, Verdana, sans-serif"
        : "italic bold 16px Tahoma, Verdana, sans-serif";
    this.ctx.textAlign = "left";
    if (!tiny) {
      this.ctx.fillText("start", startX + 34, startY + startH / 2 + 5);
    }

    this.ctx.strokeStyle = "rgba(9, 33, 96, 0.6)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(startX + startW + 5, top + 5);
    this.ctx.lineTo(startX + startW + 5, top + barHeight - 5);
    this.ctx.stroke();

    const taskX = startX + startW + 13;
    const taskY = top + 5;
    const trayW = tiny ? 90 : compact ? 116 : 144;
    const trayX = this.state.width - trayW - 6;
    const taskW = Math.max(tiny ? 48 : 88, Math.min(compact ? 156 : 214, Math.max(0, trayX - taskX - 8)));
    const taskH = barHeight - 12;
    this.drawRoundedRect(taskX, taskY, taskW, taskH, 4);
    const taskGradient = this.ctx.createLinearGradient(0, taskY, 0, taskY + taskH);
    taskGradient.addColorStop(0, "#4e89f9");
    taskGradient.addColorStop(0.58, "#2c63d9");
    taskGradient.addColorStop(1, "#1c49be");
    this.ctx.fillStyle = taskGradient;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(193, 221, 255, 0.85)";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.fillStyle = "rgba(255,255,255,0.24)";
    this.ctx.fillRect(taskX + 1, taskY + 1, taskW - 2, Math.max(5, Math.round(taskH * 0.26)));
    if (taskW > 70) {
      const badgeSize = tiny ? 10 : 14;
      const hammerIcon = this.toolIconSpriteCanvases.get("hammer");
      if (hammerIcon) {
        this.ctx.drawImage(hammerIcon, taskX + 6, taskY + (taskH - badgeSize) / 2, badgeSize + 4, badgeSize + 4);
      } else {
        this.ctx.fillStyle = "#f5fbff";
        this.ctx.fillRect(taskX + 8, taskY + (taskH - badgeSize) / 2, badgeSize, badgeSize);
        this.ctx.fillStyle = "#1b4aa8";
        this.ctx.font = tiny ? "bold 8px Tahoma, Verdana, sans-serif" : "bold 10px Tahoma, Verdana, sans-serif";
        this.ctx.fillText("DD", taskX + 9.5, taskY + taskH / 2 + 4);
      }
    }
    if (taskW > 118) {
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = compact ? "bold 10px Tahoma, Verdana, sans-serif" : "bold 12px Tahoma, Verdana, sans-serif";
      this.ctx.fillText("Desktop Destroyer", taskX + (tiny ? 24 : 28), taskY + taskH / 2 + 4);
    }

    const trayY = top + 3;
    const trayH = barHeight - 7;
    this.drawRoundedRect(trayX, trayY, trayW, trayH, 5);
    const trayGradient = this.ctx.createLinearGradient(0, trayY, 0, trayY + trayH);
    trayGradient.addColorStop(0, "#2a67da");
    trayGradient.addColorStop(1, "#1742ad");
    this.ctx.fillStyle = trayGradient;
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(173, 212, 255, 0.55)";
    this.ctx.stroke();
    this.ctx.fillStyle = "rgba(255,255,255,0.2)";
    this.ctx.fillRect(trayX + 1, trayY + 1, trayW - 2, 6);

    this.drawTrayIconNetwork(trayX + (tiny ? 11 : 14), trayY + trayH / 2);
    if (!tiny) {
      this.drawTrayIconShield(trayX + (compact ? 30 : 35), trayY + trayH / 2);
    }
    this.drawTrayIconVolume(trayX + (tiny ? 29 : compact ? 50 : 58), trayY + trayH / 2);

    this.ctx.textAlign = "right";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = compact ? "bold 10px Tahoma, Verdana, sans-serif" : "bold 11px Tahoma, Verdana, sans-serif";
    this.ctx.fillText(timeLabel, trayX + trayW - 8, tiny ? trayY + trayH / 2 + 4 : trayY + 13);
    if (!tiny) {
      this.ctx.font = compact ? "9px Tahoma, Verdana, sans-serif" : "10px Tahoma, Verdana, sans-serif";
      this.ctx.fillText(dateLabel, trayX + trayW - 8, trayY + 24);
    }
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  private drawTrayIconNetwork(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.strokeStyle = "#d8f0ff";
    this.ctx.lineWidth = 1.4;
    this.ctx.beginPath();
    this.ctx.moveTo(-5, 5);
    this.ctx.lineTo(-1, 1);
    this.ctx.lineTo(2, 3);
    this.ctx.lineTo(6, -2);
    this.ctx.stroke();
    this.ctx.fillStyle = "#f5fbff";
    this.ctx.beginPath();
    this.ctx.arc(-5, 5, 1.3, 0, Math.PI * 2);
    this.ctx.arc(-1, 1, 1.3, 0, Math.PI * 2);
    this.ctx.arc(2, 3, 1.3, 0, Math.PI * 2);
    this.ctx.arc(6, -2, 1.3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTrayIconShield(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = "#ffe05d";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -7);
    this.ctx.lineTo(6, -4);
    this.ctx.lineTo(5, 3);
    this.ctx.lineTo(0, 7);
    this.ctx.lineTo(-5, 3);
    this.ctx.lineTo(-6, -4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = "#37b94e";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -6);
    this.ctx.lineTo(5, -3.5);
    this.ctx.lineTo(4.2, 2.5);
    this.ctx.lineTo(0, 6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTrayIconVolume(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.moveTo(-6, -3);
    this.ctx.lineTo(-2, -3);
    this.ctx.lineTo(1, -6);
    this.ctx.lineTo(1, 6);
    this.ctx.lineTo(-2, 3);
    this.ctx.lineTo(-6, 3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = "#d8f0ff";
    this.ctx.lineWidth = 1.1;
    this.ctx.beginPath();
    this.ctx.arc(1, 0, 5, -0.8, 0.8);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(1, 0, 8, -0.8, 0.8);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawDecals(): void {
    const sorted = [...this.state.decals].sort((a, b) => a.zIndex - b.zIndex);
    for (const decal of sorted) {
      this.ctx.save();
      this.ctx.translate(decal.x, decal.y);
      this.ctx.rotate(decal.rotation);
      this.ctx.globalAlpha = decal.opacity;
      switch (decal.type) {
        case "crack":
          this.drawCrack(decal.radius, decal.scale);
          break;
        case "bullet":
          this.drawBulletHole(decal.radius, decal.scale);
          break;
        case "scorch":
          this.drawScorch(decal.radius, decal.scale);
          break;
        case "termite-hole":
          this.drawTermiteHole(decal.radius, decal.scale);
          break;
        case "chainsaw-gouge":
          this.drawChainsawGouge(decal.radius, decal.scale);
          break;
        case "paint-splat":
          this.drawPaintSplat(decal.radius, decal.scale, decal.tint ?? "#ff4c46");
          break;
        case "phaser-hole":
          this.drawPhaserHole(decal.radius, decal.scale, decal.tint ?? "#89f0ff");
          break;
        case "stamp-mark":
          this.drawStampMark(decal.radius, decal.scale, decal.tint ?? "#ffb53a");
          break;
        case "laser-burn":
          this.drawLaserBurn(decal.radius, decal.scale, decal.tint ?? "#6cf9ff");
          break;
      }
      this.ctx.restore();
    }
  }

  private drawCrack(radius: number, scale: number): void {
    const r = radius * scale;
    this.ctx.strokeStyle = "rgba(20, 27, 34, 0.85)";
    this.ctx.lineWidth = 2;
    for (let branch = 0; branch < 8; branch++) {
      const angle = (Math.PI * 2 * branch) / 8;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      this.ctx.stroke();
    }
    this.ctx.lineWidth = 1;
    for (let branch = 0; branch < 8; branch++) {
      const angle = (Math.PI * 2 * branch) / 8;
      const wobble = branch % 2 === 0 ? 0.22 : -0.18;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
      this.ctx.lineTo(
        Math.cos(angle + wobble) * r * 0.68,
        Math.sin(angle + wobble) * r * 0.68
      );
      this.ctx.stroke();
    }
    this.ctx.fillStyle = "rgba(230, 240, 255, 0.34)";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawBulletHole(radius: number, scale: number): void {
    const r = radius * scale;
    this.ctx.fillStyle = "rgba(15, 15, 16, 0.92)";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(225, 230, 240, 0.5)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.strokeStyle = "rgba(40, 40, 43, 0.8)";
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * r * 0.38, Math.sin(angle) * r * 0.38);
      this.ctx.lineTo(Math.cos(angle) * r * 1.1, Math.sin(angle) * r * 1.1);
      this.ctx.stroke();
    }
  }

  private drawScorch(radius: number, scale: number): void {
    const r = radius * scale;
    const gradient = this.ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    gradient.addColorStop(0, "rgba(30, 22, 20, 0.55)");
    gradient.addColorStop(0.6, "rgba(78, 46, 28, 0.34)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r * 1.15, r * 0.78, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawTermiteHole(radius: number, scale: number): void {
    const r = radius * scale;
    this.ctx.fillStyle = "rgba(20, 15, 10, 0.9)";
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(92, 58, 31, 0.7)";
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();
  }

  private drawChainsawGouge(radius: number, scale: number): void {
    const r = radius * scale;
    this.ctx.fillStyle = "rgba(20, 20, 24, 0.18)";
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r * 1.15, r * 0.42, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(34, 34, 38, 0.88)";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(-r, -r * 0.18);
    this.ctx.lineTo(r, r * 0.18);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(-r * 0.86, -r * 0.04);
    this.ctx.lineTo(r * 0.86, r * 0.28);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(-r * 0.72, -r * 0.26);
    this.ctx.lineTo(r * 0.72, r * 0.04);
    this.ctx.stroke();
    this.ctx.strokeStyle = "rgba(242, 244, 250, 0.5)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(-r * 0.8, -r * 0.12);
    this.ctx.lineTo(r * 0.8, r * 0.12);
    this.ctx.stroke();
  }

  private drawPaintSplat(radius: number, scale: number, tint: string): void {
    const r = radius * scale;
    this.ctx.fillStyle = tint;
    this.ctx.beginPath();
    this.ctx.moveTo(-r * 0.8, -r * 0.1);
    this.ctx.bezierCurveTo(-r * 1.1, -r * 0.8, -r * 0.3, -r * 1.2, r * 0.1, -r * 0.6);
    this.ctx.bezierCurveTo(r * 0.9, -r, r * 1.2, -r * 0.2, r * 0.8, r * 0.3);
    this.ctx.bezierCurveTo(r * 0.5, r * 1.1, -r * 0.2, r * 1.1, -r * 0.6, r * 0.7);
    this.ctx.bezierCurveTo(-r * 1.15, r * 0.3, -r * 1.2, 0, -r * 0.8, -r * 0.1);
    this.ctx.fill();
    this.ctx.globalAlpha *= 0.35;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(-r * 0.15, -r * 0.22, r * 0.22, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPhaserHole(radius: number, scale: number, tint: string): void {
    const r = radius * scale;
    const gradient = this.ctx.createRadialGradient(0, 0, r * 0.18, 0, 0, r);
    gradient.addColorStop(0, "rgba(6, 8, 22, 0.96)");
    gradient.addColorStop(0.38, "rgba(18, 22, 48, 0.92)");
    gradient.addColorStop(0.62, tint);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(216, 242, 255, 0.7)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawStampMark(radius: number, scale: number, tint: string): void {
    const r = radius * scale;
    this.ctx.strokeStyle = tint;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const pointRadius = i % 2 === 0 ? r : r * 0.46;
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.globalAlpha *= 0.4;
    this.ctx.fillStyle = tint;
    this.ctx.fill();
  }

  private drawLaserBurn(radius: number, scale: number, tint: string): void {
    const r = radius * scale;
    const gradient = this.ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
    gradient.addColorStop(0, tint);
    gradient.addColorStop(0.2, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.44, "rgba(27, 31, 43, 0.9)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawParticles(): void {
    for (const particle of this.state.particles) {
      this.ctx.save();
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate(particle.rotation);
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.globalCompositeOperation = particle.blendMode;
      switch (particle.type) {
        case "chip":
          this.ctx.fillStyle = "#d6dde7";
          this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
          break;
        case "spark":
          this.ctx.fillStyle = "#ffe68a";
          this.ctx.fillRect(-particle.size / 2, -1, particle.size, 2);
          this.ctx.fillRect(-1, -particle.size / 2, 2, particle.size);
          break;
        case "smoke":
          this.ctx.fillStyle = "rgba(38, 34, 32, 0.8)";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case "ember":
        case "flame":
          this.ctx.fillStyle = particle.type === "flame" ? "#ff9a3d" : "#ffda6e";
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, particle.size, particle.size * 0.6, 0, 0, Math.PI * 2);
          this.ctx.fill();
          if (particle.type === "flame") {
            this.ctx.fillStyle = "#ffe36d";
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, particle.size * 0.48, particle.size * 0.32, 0, 0, Math.PI * 2);
            this.ctx.fill();
          }
          break;
        case "flash":
          this.ctx.fillStyle = "#fff6ca";
          this.ctx.beginPath();
          this.ctx.moveTo(-particle.size, 0);
          this.ctx.lineTo(0, -particle.size * 0.38);
          this.ctx.lineTo(particle.size, 0);
          this.ctx.lineTo(0, particle.size * 0.38);
          this.ctx.closePath();
          this.ctx.fill();
          break;
        case "paint":
          this.ctx.fillStyle = particle.tint ?? "#ff5c48";
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, particle.size, particle.size * 0.72, 0, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        case "ring":
          this.ctx.strokeStyle = particle.tint ?? "#82f4ff";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          this.ctx.stroke();
          break;
        case "beam":
          this.ctx.fillStyle = particle.tint ?? "#77faff";
          this.ctx.fillRect(-particle.size * 0.5, -2, particle.size, 4);
          this.ctx.fillStyle = "rgba(255,255,255,0.9)";
          this.ctx.fillRect(-particle.size * 0.36, -1, particle.size * 0.72, 2);
          break;
        case "plasma":
          this.ctx.fillStyle = particle.tint ?? "#88f6ff";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.globalAlpha *= 0.4;
          this.ctx.fillStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(-particle.size * 0.24, -particle.size * 0.24, particle.size * 0.32, 0, Math.PI * 2);
          this.ctx.fill();
          break;
      }
      this.ctx.restore();
    }
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1;
  }

  private drawTermites(): void {
    for (const termite of this.state.entities) {
      this.ctx.save();
      this.ctx.translate(termite.x, termite.y);
      this.ctx.rotate(termite.direction);
      this.ctx.fillStyle = "#8c6036";
      this.ctx.beginPath();
      this.ctx.ellipse(-4, 0, 6, 4, 0, 0, Math.PI * 2);
      this.ctx.ellipse(4, 0, 5, 3.5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#5f3b1f";
      this.ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(-2, i * 2);
        this.ctx.lineTo(-8, i * 4);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(2, i * 2);
        this.ctx.lineTo(8, i * 4);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
  }

  private drawScreenFx(): void {
    const { width, height } = this.state;
    this.ctx.save();
    const dpi = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1)));
    this.ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    for (let y = 0; y < height; y += 4) {
      this.ctx.fillRect(0, y, width, 1);
    }

    this.ctx.fillStyle = "rgba(8, 12, 18, 0.03)";
    for (let i = 0; i < 220; i++) {
      this.ctx.fillRect(
        (i * 67 + Math.sin(i * 0.31) * 20 + performance.now() * 0.02) % width,
        (i * 43 + Math.cos(i * 0.17) * 16) % height,
        1,
        1
      );
    }

    const vignette = this.ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.28,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.82
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.32)");
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.restore();
  }

  private drawCoverImage(
    image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const sourceWidth = "naturalWidth" in image && image.naturalWidth ? image.naturalWidth : image.width ?? width;
    const sourceHeight =
      "naturalHeight" in image && image.naturalHeight ? image.naturalHeight : image.height ?? height;
    const sourceAspect = sourceWidth / sourceHeight;
    const destAspect = width / height;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceAspect > destAspect) {
      sw = sourceHeight * destAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / destAspect;
      sy = (sourceHeight - sh) / 2;
    }

    this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  private makeToolContext(): ToolContext {
    return {
      state: this.state,
      timestamp: performance.now(),
      spawnDecal: (partial) => this.spawnDecal(partial),
      spawnParticle: (partial) => this.spawnParticle(partial),
      spawnCrawler: (point, count) => this.spawnCrawler(point, count),
      damageCrawlers: (point, radius, limit) => this.damageCrawlers(point, radius, limit),
      addShake: (strength, decay = 12) => this.addShake(strength, decay),
      playSound: (soundId) => this.audio.play(soundId),
      startLoop: (soundId) => this.audio.startLoop(soundId),
      stopLoop: (soundId) => this.audio.stopLoop(soundId),
      random: (min, max) => this.random(min, max)
    };
  }

  private spawnDecal(
    partial: Omit<Decal, "id" | "createdAt"> & Partial<Pick<Decal, "createdAt">>
  ): Decal {
    const decal: Decal = {
      id: this.nextId++,
      createdAt: partial.createdAt ?? performance.now(),
      ...partial
    };
    this.state.decals.push(decal);
    return decal;
  }

  private spawnParticle(partial: Omit<Particle, "id" | "age">): Particle {
    const particle: Particle = {
      id: this.nextId++,
      age: 0,
      ...partial
    };
    this.state.particles.push(particle);
    return particle;
  }

  private spawnCrawler(point: Point, count: number): void {
    const remaining = Math.max(0, MAX_TERMITES - this.state.entities.length);
    for (let i = 0; i < Math.min(count, remaining); i++) {
      const entity: CrawlerEntity = {
        id: this.nextId++,
        x: point.x + this.random(-18, 18),
        y: point.y + this.random(-18, 18),
        direction: this.random(0, Math.PI * 2),
        speed: this.random(18, 46),
        hunger: 0,
        damageRadius: this.random(4, 9),
        cooldown: this.random(0.15, 0.5),
        turnTimer: this.random(0.1, 0.6)
      };
      this.state.entities.push(entity);
    }
  }

  private damageCrawlers(point: Point, radius: number, limit = Number.POSITIVE_INFINITY): number {
    if (this.state.entities.length === 0) {
      return 0;
    }

    let killed = 0;
    const radiusSq = radius * radius;

    for (let index = this.state.entities.length - 1; index >= 0; index--) {
      if (killed >= limit) {
        break;
      }
      const entity = this.state.entities[index];
      const dx = entity.x - point.x;
      const dy = entity.y - point.y;
      if (dx * dx + dy * dy > radiusSq) {
        continue;
      }

      this.state.entities.splice(index, 1);
      killed += 1;
      this.spawnDecal({
        type: "termite-hole",
        x: entity.x,
        y: entity.y,
        rotation: this.random(0, Math.PI * 2),
        scale: this.random(0.45, 0.82),
        opacity: 0.92,
        zIndex: 1,
        radius: entity.damageRadius * this.random(1, 1.5)
      });
      for (let i = 0; i < 7; i++) {
        const angle = this.random(0, Math.PI * 2);
        const speed = this.random(30, 120);
        this.spawnParticle({
          type: i % 2 === 0 ? "chip" : "spark",
          x: entity.x,
          y: entity.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 10,
          ax: 0,
          ay: 140,
          ttl: this.random(0.1, 0.24),
          size: i % 2 === 0 ? this.random(2, 4) : this.random(1.5, 3),
          rotation: this.random(0, Math.PI * 2),
          spin: this.random(-10, 10),
          opacity: 0.8,
          blendMode: i % 2 === 0 ? "source-over" : "screen"
        });
      }
    }

    if (killed > 0) {
      this.audio.play("termite");
    }

    return killed;
  }

  private addShake(strength: number, decay = 12): void {
    const shake = this.state.cameraShake as CameraShake;
    shake.strength = Math.max(shake.strength, strength);
    shake.decay = decay;
  }

  private trimCollections(): void {
    if (this.state.particles.length > MAX_PARTICLES) {
      this.state.particles.splice(0, this.state.particles.length - MAX_PARTICLES);
    }
    if (this.state.entities.length > MAX_TERMITES) {
      this.state.entities.splice(0, this.state.entities.length - MAX_TERMITES);
    }
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.elements.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.state.pointer.dx = x - this.state.pointer.x;
    this.state.pointer.dy = y - this.state.pointer.y;
    this.state.pointer.x = x;
    this.state.pointer.y = y;
    this.state.pointer.worldX = x - this.state.cameraShake.x;
    this.state.pointer.worldY = y - this.state.cameraShake.y;
    this.state.pointer.active = true;
  }

  private pointerPoint(): Point {
    return {
      x: this.state.pointer.worldX,
      y: this.state.pointer.worldY
    };
  }

  private getSelectedTool(): ToolDefinition {
    return this.tools[this.state.selectedTool];
  }

  private updateToolSelection(toolId: ToolId, closeToolbox = true): void {
    this.state.selectedTool = toolId;
    this.state.settings.selectedTool = toolId;
    this.toolFocusIndex = Math.max(0, toolOrder.indexOf(toolId));
    this.state.pointer.down = false;
    this.audio.stopAllLoops();
    if (closeToolbox && this.state.toolboxOpen) {
      this.setToolboxOpen(false);
    }
    for (const [id, button] of this.toolButtons.entries()) {
      button.classList.toggle("is-active", id === toolId);
      button.classList.toggle(
        "is-focus",
        id === toolOrder[this.toolFocusIndex] && this.state.toolboxOpen
      );
    }
    this.updateCanvasCursor(toolId);
    saveSettings(this.state.settings);
    this.updateStatusText();
    this.refreshToolFocusStyles();
  }

  private updateButtonLabels(): void {
    this.elements.muteButton.textContent = this.state.settings.muted
      ? "Unmute (M)"
      : "Mute (M)";
    this.elements.fullscreenButton.textContent = document.fullscreenElement
      ? "Exit Fullscreen"
      : "Fullscreen (F)";
  }

  private updateStatusText(): void {
    const tool = this.getSelectedTool();
    const counts = `decals ${this.state.decals.length} | particles ${this.state.particles.length} | termites ${this.state.entities.length}`;
    this.elements.loader.textContent = `${tool.label} [${tool.hotkey}] ready. ${counts}.`;
  }

  private toggleToolbox(): void {
    this.setToolboxOpen(!this.state.toolboxOpen);
    this.refreshToolFocusStyles();
  }

  private setToolboxOpen(open: boolean): void {
    this.state.toolboxOpen = open;
    this.elements.toolbox.classList.toggle("is-open", open);
    this.elements.mobileToolboxButton.classList.toggle("is-open", open);
    this.elements.mobileToolboxButton.setAttribute(
      "aria-label",
      open ? "Hide toolbox" : "Open toolbox"
    );
    this.elements.mobileToolboxButton.setAttribute("aria-expanded", String(open));
  }

  private moveToolFocus(direction: number): void {
    const nextIndex = (this.toolFocusIndex + direction + toolOrder.length) % toolOrder.length;
    this.toolFocusIndex = nextIndex;
    this.refreshToolFocusStyles();
  }

  private refreshToolFocusStyles(): void {
    for (const [id, button] of this.toolButtons.entries()) {
      button.classList.toggle(
        "is-focus",
        this.state.toolboxOpen && id === toolOrder[this.toolFocusIndex]
      );
    }
  }

  private async unlockAudio(): Promise<void> {
    if (this.state.audioUnlocked) {
      // this.playStartupSoundIfReady();
      return;
    }
    this.state.audioUnlocked = await this.audio.unlock();
    if (this.state.audioUnlocked) {
      this.elements.loader.textContent =
        "Sound unlocked. Left click destroys. Keys 1-9 switch tools. F2 or the mobile hammer button toggles the selector.";
      // this.playStartupSoundIfReady();
    }
  }

  // private playStartupSoundIfReady(): void {
  //   if (
  //     this.startupSoundPlayed ||
  //     (!this.desktopShown && !this.startupSoundPending) ||
  //     this.state.settings.muted
  //   ) {
  //     return;
  //   }
  //   if (!this.state.audioUnlocked) {
  //     this.startupSoundPending = false;
  //     return;
  //   }
  //   this.audio.play("xp-startup");
  //   this.startupSoundPlayed = false;
  //   this.startupSoundPending = false;
  //   this.desktopShown = false;
  // }

  private toggleMute(): void {
    this.state.settings.muted = !this.state.settings.muted;
    this.audio.setMuted(this.state.settings.muted);
    saveSettings(this.state.settings);
    this.updateButtonLabels();
    this.updateStatusText();
  }

  private reset(): void {
    this.state.decals = [];
    this.state.particles = [];
    this.state.entities = [];
    this.state.cameraShake.strength = 0;
    this.audio.stopAllLoops();
    this.elements.loader.classList.add("is-visible");
    this.elements.loader.textContent = "Desktop reset. Pick a tool and break it again.";
    window.setTimeout(() => {
      this.elements.loader.classList.remove("is-visible");
    }, 1200);
    this.updateStatusText();
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await this.elements.root.requestFullscreen();
    }
    this.updateButtonLabels();
  }

  private random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
