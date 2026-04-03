import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type PaintTool = "pencil" | "brush" | "eraser";

interface PaintState {
  tool: PaintTool;
  color: string;
  drawing: boolean;
  lastX: number;
  lastY: number;
}

const PALETTE = [
  "#000000",
  "#ffffff",
  "#c63a3a",
  "#3b7d2f",
  "#2c5fd3",
  "#ffd33d",
  "#7b42d6",
  "#1ba7b5",
  "#e58f2a",
  "#7a7a7a"
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "paint-app",
    menuButtons: [
      { label: "File", title: "Clear", onClick: () => clearCanvas() },
      { label: "Edit", title: "Canvas", onClick: () => shell.setStatus("Canvas ready", "MS Paint") },
      { label: "View", title: "Palette", onClick: () => shell.setStatus("Color Box", "MS Paint") },
      { label: "Image", title: "Brush", onClick: () => setTool("brush") },
      { label: "Help", title: "Paint", onClick: () => shell.setStatus("For Help, click Help Topics on the Help Menu.", "MS Paint") }
    ],
    statusLeft: "Pencil",
    statusRight: "MS Paint"
  });

  shell.body.innerHTML = `
    <section class="paint-app__root">
      <div class="paint-app__tools">
        <button type="button" class="paint-app__tool" data-paint-tool="pencil" aria-label="Pencil">✎</button>
        <button type="button" class="paint-app__tool" data-paint-tool="brush" aria-label="Brush">🖌</button>
        <button type="button" class="paint-app__tool" data-paint-tool="eraser" aria-label="Eraser">⌫</button>
        <button type="button" class="paint-app__tool paint-app__tool--clear" data-paint-clear aria-label="Clear">✕</button>
      </div>
      <div class="paint-app__workspace">
        <div class="paint-app__surface">
          <canvas class="paint-app__canvas"></canvas>
        </div>
        <div class="paint-app__palette">
        ${PALETTE.map(
          (color) => `
            <button
              type="button"
              class="paint-app__swatch"
              data-paint-color="${color}"
              style="background:${color}"
              aria-label="Use ${color}"
            ></button>
          `
        ).join("")}
        </div>
      </div>
    </section>
  `;

  const canvas = shell.body.querySelector<HTMLCanvasElement>(".paint-app__canvas");
  const surface = shell.body.querySelector<HTMLElement>(".paint-app__surface");
  if (!canvas || !surface) {
    throw new Error("Paint canvas failed to mount");
  }
  const canvasElement = canvas;
  const surfaceElement = surface;

  const context = canvasElement.getContext("2d");
  if (!context) {
    throw new Error("Paint context failed to mount");
  }
  const drawingContext = context;

  const state: PaintState = {
    tool: "pencil",
    color: "#000000",
    drawing: false,
    lastX: 0,
    lastY: 0
  };

  function setTool(tool: PaintTool): void {
    state.tool = tool;
    shell.setToolbar([
      { label: "Pencil", onClick: () => setTool("pencil"), active: tool === "pencil" },
      { label: "Brush", onClick: () => setTool("brush"), active: tool === "brush" },
      { label: "Eraser", onClick: () => setTool("eraser"), active: tool === "eraser" }
    ]);
    shell.body
      .querySelectorAll<HTMLElement>("[data-paint-tool]")
      .forEach((button) => button.classList.toggle("is-active", button.dataset.paintTool === tool));
    shell.setStatus(`${tool[0].toUpperCase()}${tool.slice(1)} · ${state.color}`, "MS Paint");
  }

  function resizeCanvas(): void {
    const bounds = surfaceElement.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const width = Math.max(200, Math.floor(bounds.width));
    const height = Math.max(160, Math.floor(bounds.height));

    const snapshot = document.createElement("canvas");
    snapshot.width = canvasElement.width;
    snapshot.height = canvasElement.height;
    const snapshotContext = snapshot.getContext("2d");
    if (snapshotContext) {
      snapshotContext.drawImage(canvasElement, 0, 0);
    }

    canvasElement.width = Math.floor(width * dpr);
    canvasElement.height = Math.floor(height * dpr);
    canvasElement.style.width = `${width}px`;
    canvasElement.style.height = `${height}px`;

    drawingContext.setTransform(1, 0, 0, 1, 0, 0);
    drawingContext.scale(dpr, dpr);
    drawingContext.fillStyle = "#ffffff";
    drawingContext.fillRect(0, 0, width, height);
    if (snapshot.width > 0 && snapshot.height > 0) {
      drawingContext.drawImage(snapshot, 0, 0, width, height);
    }
  }

  function clearCanvas(): void {
    const width = parseFloat(canvasElement.style.width || "0");
    const height = parseFloat(canvasElement.style.height || "0");
    drawingContext.fillStyle = "#ffffff";
    drawingContext.fillRect(0, 0, width, height);
  }

  function strokeWidth(): number {
    if (state.tool === "brush") {
      return 4;
    }
    if (state.tool === "eraser") {
      return 12;
    }
    return 1.5;
  }

  function strokeColor(): string {
    return state.tool === "eraser" ? "#ffffff" : state.color;
  }

  function pointFromEvent(event: PointerEvent): { x: number; y: number } {
    const rect = canvasElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function drawLine(fromX: number, fromY: number, toX: number, toY: number): void {
    drawingContext.strokeStyle = strokeColor();
    drawingContext.lineWidth = strokeWidth();
    drawingContext.lineCap = "round";
    drawingContext.lineJoin = "round";
    drawingContext.beginPath();
    drawingContext.moveTo(fromX, fromY);
    drawingContext.lineTo(toX, toY);
    drawingContext.stroke();
  }

  canvasElement.addEventListener(
    "pointerdown",
    (event) => {
      const point = pointFromEvent(event);
      state.drawing = true;
      state.lastX = point.x;
      state.lastY = point.y;
      drawLine(point.x, point.y, point.x, point.y);
      canvasElement.setPointerCapture(event.pointerId);
    },
    { signal: abortController.signal }
  );

  canvasElement.addEventListener(
    "pointermove",
    (event) => {
      if (!state.drawing) {
        return;
      }
      const point = pointFromEvent(event);
      drawLine(state.lastX, state.lastY, point.x, point.y);
      state.lastX = point.x;
      state.lastY = point.y;
    },
    { signal: abortController.signal }
  );

  const stopDrawing = () => {
    state.drawing = false;
  };

  canvasElement.addEventListener("pointerup", stopDrawing, { signal: abortController.signal });
  canvasElement.addEventListener("pointercancel", stopDrawing, { signal: abortController.signal });

  shell.body.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-paint-color]");
      const toolButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-paint-tool]");
      const clearButton = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-paint-clear]");
      if (button) {
        state.color = button.dataset.paintColor ?? state.color;
        shell.setStatus(`${state.tool[0].toUpperCase()}${state.tool.slice(1)} · ${state.color}`, "MS Paint");
      } else if (toolButton?.dataset.paintTool) {
        setTool(toolButton.dataset.paintTool as PaintTool);
      } else if (clearButton) {
        clearCanvas();
      }
    },
    { signal: abortController.signal }
  );

  setTool("pencil");
  resizeCanvas();
  clearCanvas();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      shell.root.focus();
    },
    onResize() {
      resizeCanvas();
    }
  };
}
