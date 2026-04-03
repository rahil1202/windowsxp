import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: "red" | "blue";
  settled: boolean;
}

interface Hole {
  x: number;
  y: number;
  radius: number;
  color: "red" | "blue";
}

interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const LEVELS = [
  {
    balls: [
      { x: 90, y: 80, vx: 70, vy: 55, radius: 10, color: "red" as const },
      { x: 250, y: 160, vx: -60, vy: 72, radius: 10, color: "blue" as const }
    ],
    holes: [
      { x: 60, y: 230, radius: 16, color: "red" as const },
      { x: 310, y: 48, radius: 16, color: "blue" as const }
    ]
  },
  {
    balls: [
      { x: 86, y: 78, vx: 84, vy: 60, radius: 10, color: "red" as const },
      { x: 210, y: 92, vx: -72, vy: 76, radius: 10, color: "blue" as const },
      { x: 300, y: 200, vx: -80, vy: -50, radius: 10, color: "red" as const }
    ],
    holes: [
      { x: 48, y: 220, radius: 16, color: "red" as const },
      { x: 312, y: 54, radius: 16, color: "blue" as const },
      { x: 322, y: 242, radius: 16, color: "red" as const }
    ]
  }
];

function distanceToSegment(px: number, py: number, line: LineSegment): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - line.x1) * dx + (py - line.y1) * dy) / lengthSq));
  const projX = line.x1 + t * dx;
  const projY = line.y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "inkball-app",
    menuButtons: [
      { label: "Game", onClick: () => resetLevel() },
      { label: "Level", onClick: () => nextLevel() },
      { label: "Help", onClick: () => shell.setStatus("Draw purple walls to guide each ball into the matching hole.", "InkBall") }
    ],
    toolbarButtons: [
      { label: "Restart", onClick: () => resetLevel() },
      { label: "Next", onClick: () => nextLevel() }
    ],
    statusLeft: "Level 1",
    statusRight: "InkBall"
  });

  shell.body.innerHTML = `
    <section class="inkball-app">
      <canvas class="inkball-app__canvas"></canvas>
    </section>
  `;

  const canvas = shell.body.querySelector<HTMLCanvasElement>(".inkball-app__canvas");
  if (!canvas) {
    throw new Error("InkBall failed to mount");
  }
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("InkBall canvas unavailable");
  }
  const canvasEl = canvas;
  const context2d = context;

  let levelIndex = 0;
  let balls: Ball[] = [];
  let holes: Hole[] = [];
  let lines: LineSegment[] = [];
  let drawing = false;
  let lastPoint: { x: number; y: number } | null = null;
  let animationFrame = 0;
  let lastTime = performance.now();
  let message = "Guide the balls.";

  function loadLevel(index: number): void {
    const level = LEVELS[index] ?? LEVELS[0];
    balls = level.balls.map((ball, ballIndex) => ({ id: ballIndex, ...ball, settled: false }));
    holes = level.holes.map((hole) => ({ ...hole }));
    lines = [];
    message = `Level ${index + 1}`;
    shell.setStatus(`Level ${index + 1}`, `${balls.length} ball(s)`);
    resizeCanvas();
  }

  function resetLevel(): void {
    loadLevel(levelIndex);
  }

  function nextLevel(): void {
    levelIndex = (levelIndex + 1) % LEVELS.length;
    loadLevel(levelIndex);
  }

  function resizeCanvas(): void {
    const bounds = canvasEl.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    canvasEl.width = Math.max(320, Math.floor(bounds.width * dpr));
    canvasEl.height = Math.max(240, Math.floor(bounds.height * dpr));
    context2d.setTransform(1, 0, 0, 1, 0, 0);
    context2d.scale(dpr, dpr);
  }

  function pointFromEvent(event: PointerEvent): { x: number; y: number } {
    const rect = canvasEl.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function reflectBall(ball: Ball, line: LineSegment): void {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
  }

  function update(dt: number): void {
    const width = canvasEl.clientWidth;
    const height = canvasEl.clientHeight;
    for (const ball of balls) {
      if (ball.settled) {
        continue;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.radius < 0 || ball.x + ball.radius > width) {
        ball.vx *= -1;
        ball.x = Math.max(ball.radius, Math.min(width - ball.radius, ball.x));
      }
      if (ball.y - ball.radius < 0 || ball.y + ball.radius > height) {
        ball.vy *= -1;
        ball.y = Math.max(ball.radius, Math.min(height - ball.radius, ball.y));
      }

      for (const line of lines) {
        if (distanceToSegment(ball.x, ball.y, line) <= ball.radius + 2) {
          reflectBall(ball, line);
        }
      }

      for (const hole of holes) {
        const distance = Math.hypot(ball.x - hole.x, ball.y - hole.y);
        if (distance <= hole.radius) {
          if (ball.color === hole.color) {
            ball.settled = true;
            message = `${ball.color} ball scored`;
          } else {
            message = "Wrong hole. Level restarted.";
            resetLevel();
            return;
          }
        }
      }
    }

    if (balls.length > 0 && balls.every((ball) => ball.settled)) {
      message = "Level cleared";
      nextLevel();
    }
  }

  function render(): void {
    const width = canvasEl.clientWidth;
    const height = canvasEl.clientHeight;
    context2d.clearRect(0, 0, width, height);
    context2d.fillStyle = "#f2f6ff";
    context2d.fillRect(0, 0, width, height);

    context2d.strokeStyle = "#7a59d8";
    context2d.lineWidth = 4;
    context2d.lineCap = "round";
    for (const line of lines) {
      context2d.beginPath();
      context2d.moveTo(line.x1, line.y1);
      context2d.lineTo(line.x2, line.y2);
      context2d.stroke();
    }

    for (const hole of holes) {
      context2d.beginPath();
      context2d.fillStyle = hole.color === "red" ? "#ca2e2e" : "#2f6ee5";
      context2d.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
      context2d.fill();
      context2d.beginPath();
      context2d.fillStyle = "#0c1731";
      context2d.arc(hole.x, hole.y, hole.radius * 0.45, 0, Math.PI * 2);
      context2d.fill();
    }

    for (const ball of balls) {
      if (ball.settled) continue;
      context2d.beginPath();
      context2d.fillStyle = ball.color === "red" ? "#ef4a4a" : "#2f7ded";
      context2d.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      context2d.fill();
      context2d.beginPath();
      context2d.fillStyle = "rgba(255,255,255,0.45)";
      context2d.arc(ball.x - 3, ball.y - 3, ball.radius * 0.35, 0, Math.PI * 2);
      context2d.fill();
    }

    shell.setStatus(`Level ${levelIndex + 1}`, message);
  }

  function tick(now: number): void {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    animationFrame = window.requestAnimationFrame(tick);
  }

  canvasEl.addEventListener(
    "pointerdown",
    (event) => {
      drawing = true;
      lastPoint = pointFromEvent(event);
      canvasEl.setPointerCapture(event.pointerId);
    },
    { signal: abortController.signal }
  );

  canvasEl.addEventListener(
    "pointermove",
    (event) => {
      if (!drawing || !lastPoint) return;
      const point = pointFromEvent(event);
      lines.push({ x1: lastPoint.x, y1: lastPoint.y, x2: point.x, y2: point.y });
      lastPoint = point;
    },
    { signal: abortController.signal }
  );

  const stopDrawing = () => {
    drawing = false;
    lastPoint = null;
  };
  canvasEl.addEventListener("pointerup", stopDrawing, { signal: abortController.signal });
  canvasEl.addEventListener("pointercancel", stopDrawing, { signal: abortController.signal });

  resizeCanvas();
  loadLevel(0);
  render();
  animationFrame = window.requestAnimationFrame(tick);

  return {
    unmount() {
      abortController.abort();
      window.cancelAnimationFrame(animationFrame);
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      shell.root.focus();
    },
    onResize() {
      resizeCanvas();
      render();
    }
  };
}
