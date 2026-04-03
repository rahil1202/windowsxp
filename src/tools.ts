import type { Point, ToolContext, ToolDefinition, ToolId } from "./types";

const paintPalette = ["#f54e43", "#ffdc46", "#47d95e", "#2cc8ff", "#336cff", "#f55cff"];
const stampPalette = ["#ffd548", "#ff9e2c", "#ff5f46"];

function emitHammerBurst(ctx: ToolContext, x: number, y: number): void {
  ctx.spawnDecal({
    type: "crack",
    x,
    y,
    rotation: ctx.random(-0.4, 0.4),
    scale: ctx.random(0.85, 1.2),
    opacity: ctx.random(0.8, 1),
    zIndex: 2,
    radius: ctx.random(38, 56)
  });
  for (let i = 0; i < 14; i++) {
    const angle = ctx.random(0, Math.PI * 2);
    const speed = ctx.random(40, 170);
    ctx.spawnParticle({
      type: "chip",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      ax: 0,
      ay: 220,
      ttl: ctx.random(0.25, 0.5),
      size: ctx.random(2, 6),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-6, 6),
      opacity: 0.7,
      blendMode: "source-over"
    });
  }
  ctx.playSound("glass-hit");
  ctx.addShake(10, 12);
  ctx.damageCrawlers({ x, y }, 42);
}

function emitBulletBurst(ctx: ToolContext, x: number, y: number, burst = false): void {
  ctx.spawnDecal({
    type: "bullet",
    x,
    y,
    rotation: ctx.random(0, Math.PI * 2),
    scale: burst ? ctx.random(0.7, 1.2) : ctx.random(0.8, 1.1),
    opacity: 0.9,
    zIndex: 3,
    radius: ctx.random(12, 20)
  });
  for (let i = 0; i < (burst ? 12 : 7); i++) {
    const angle = ctx.random(-0.55, 0.55);
    ctx.spawnParticle({
      type: i < 3 ? "flash" : "spark",
      x: x - ctx.random(20, 34),
      y: y + ctx.random(-5, 5),
      vx: Math.cos(angle) * ctx.random(160, 320),
      vy: Math.sin(angle) * ctx.random(20, 110),
      ax: 0,
      ay: 120,
      ttl: ctx.random(0.04, 0.16),
      size: i < 3 ? ctx.random(8, 16) : ctx.random(2, 4),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-12, 12),
      opacity: 1,
      blendMode: "screen"
    });
  }
  ctx.playSound("machine-gun");
  ctx.addShake(burst ? 6 : 4, 11);
  ctx.damageCrawlers({ x, y }, burst ? 22 : 18, 1);
}

function emitFlame(ctx: ToolContext, x: number, y: number): void {
  for (let i = 0; i < 4; i++) {
    const spread = ctx.random(-0.8, 0.8);
    const speed = ctx.random(120, 240);
    ctx.spawnParticle({
      type: i < 3 ? "flame" : "smoke",
      x,
      y,
      vx: speed * Math.cos(spread),
      vy: speed * Math.sin(spread) - ctx.random(20, 60),
      ax: -35,
      ay: i < 3 ? -40 : -12,
      ttl: i < 3 ? ctx.random(0.25, 0.45) : ctx.random(0.35, 0.6),
      size: i < 3 ? ctx.random(8, 16) : ctx.random(10, 18),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-4, 4),
      opacity: i < 3 ? 0.95 : 0.45,
      blendMode: i < 3 ? "screen" : "source-over"
    });
  }
  if (Math.random() > 0.62) {
    ctx.spawnDecal({
      type: "scorch",
      x: x + ctx.random(-12, 12),
      y: y + ctx.random(-10, 10),
      rotation: ctx.random(0, Math.PI * 2),
      scale: ctx.random(0.6, 1.05),
      opacity: ctx.random(0.15, 0.25),
      zIndex: 1,
      radius: ctx.random(20, 34)
    });
  }
  ctx.damageCrawlers({ x, y }, 26, 2);
}

function emitChainsaw(ctx: ToolContext, x: number, y: number, intense: boolean): void {
  ctx.spawnDecal({
    type: "chainsaw-gouge",
    x,
    y,
    rotation: ctx.random(-1, 1),
    scale: intense ? ctx.random(1, 1.35) : ctx.random(0.7, 1.05),
    opacity: intense ? 0.86 : 0.72,
    zIndex: 2,
    radius: intense ? ctx.random(26, 40) : ctx.random(18, 28)
  });
  for (let i = 0; i < (intense ? 18 : 10); i++) {
    const angle = ctx.random(-1.6, 1.6);
    const speed = ctx.random(80, 260);
    ctx.spawnParticle({
      type: i % 4 === 0 ? "chip" : "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      ax: 0,
      ay: 180,
      ttl: ctx.random(0.12, 0.36),
      size: i % 4 === 0 ? ctx.random(3, 6) : ctx.random(2, 4),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-12, 12),
      opacity: 0.9,
      blendMode: i % 4 === 0 ? "source-over" : "screen"
    });
  }
  ctx.addShake(intense ? 12 : 8, 14);
  ctx.damageCrawlers({ x, y }, intense ? 34 : 26, intense ? 3 : 2);
}

function emitColorThrow(ctx: ToolContext, x: number, y: number): void {
  const tint = paintPalette[Math.floor(ctx.random(0, paintPalette.length))];
  for (let i = 0; i < 6; i++) {
    const angle = ctx.random(-0.8, 0.8);
    const speed = ctx.random(70, 190);
    ctx.spawnParticle({
      type: "paint",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - ctx.random(10, 35),
      ax: 0,
      ay: 210,
      ttl: ctx.random(0.22, 0.46),
      size: ctx.random(4, 10),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-8, 8),
      opacity: 0.96,
      blendMode: "source-over",
      tint
    });
  }
  if (Math.random() > 0.48) {
    ctx.spawnDecal({
      type: "paint-splat",
      x: x + ctx.random(-10, 10),
      y: y + ctx.random(-10, 10),
      rotation: ctx.random(0, Math.PI * 2),
      scale: ctx.random(0.7, 1.3),
      opacity: 0.88,
      zIndex: 2,
      radius: ctx.random(14, 26),
      tint
    });
  }
  if (Math.random() > 0.75) {
    ctx.playSound("paint-spray");
  }
}

function emitPhaser(ctx: ToolContext, x: number, y: number): void {
  ctx.spawnDecal({
    type: "phaser-hole",
    x,
    y,
    rotation: ctx.random(0, Math.PI * 2),
    scale: ctx.random(0.85, 1.15),
    opacity: 0.92,
    zIndex: 3,
    radius: ctx.random(15, 26),
    tint: "#8a7cff"
  });
  for (let i = 0; i < 3; i++) {
    ctx.spawnParticle({
      type: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      ttl: ctx.random(0.14, 0.26),
      size: ctx.random(12, 22) + i * 5,
      rotation: 0,
      spin: 0,
      opacity: 0.95,
      blendMode: "screen",
      tint: i % 2 === 0 ? "#82f1ff" : "#9d7dff"
    });
  }
  for (let i = 0; i < 8; i++) {
    const angle = ctx.random(0, Math.PI * 2);
    const speed = ctx.random(80, 180);
    ctx.spawnParticle({
      type: "plasma",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ax: 0,
      ay: 30,
      ttl: ctx.random(0.18, 0.34),
      size: ctx.random(4, 9),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-6, 6),
      opacity: 0.96,
      blendMode: "screen",
      tint: i % 2 === 0 ? "#7cf5ff" : "#a37dff"
    });
  }
  ctx.playSound("phaser-shot");
  ctx.addShake(4, 18);
  ctx.damageCrawlers({ x, y }, 28, 3);
}

function emitStamp(ctx: ToolContext, x: number, y: number): void {
  const tint = stampPalette[Math.floor(ctx.random(0, stampPalette.length))];
  ctx.spawnDecal({
    type: "stamp-mark",
    x,
    y,
    rotation: ctx.random(-0.25, 0.25),
    scale: ctx.random(0.9, 1.25),
    opacity: 0.9,
    zIndex: 2,
    radius: ctx.random(18, 26),
    tint
  });
  for (let i = 0; i < 10; i++) {
    const angle = ctx.random(0, Math.PI * 2);
    const speed = ctx.random(20, 90);
    ctx.spawnParticle({
      type: "chip",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 10,
      ax: 0,
      ay: 160,
      ttl: ctx.random(0.14, 0.28),
      size: ctx.random(2, 4),
      rotation: ctx.random(0, Math.PI * 2),
      spin: ctx.random(-6, 6),
      opacity: 0.55,
      blendMode: "source-over",
      tint
    });
  }
  ctx.playSound("stamp-hit");
  ctx.addShake(7, 16);
}

function emitLaser(ctx: ToolContext, x: number, y: number): void {
  ctx.spawnDecal({
    type: "laser-burn",
    x,
    y,
    rotation: ctx.random(0, Math.PI * 2),
    scale: ctx.random(0.75, 1.2),
    opacity: 0.82,
    zIndex: 2,
    radius: ctx.random(16, 28),
    tint: "#69f3ff"
  });
  for (let i = 0; i < 6; i++) {
    ctx.spawnParticle({
      type: "beam",
      x: x - ctx.random(6, 14),
      y,
      vx: ctx.random(180, 320),
      vy: ctx.random(-18, 18),
      ax: 0,
      ay: 0,
      ttl: ctx.random(0.05, 0.12),
      size: ctx.random(18, 34),
      rotation: ctx.random(-0.12, 0.12),
      spin: 0,
      opacity: 0.95,
      blendMode: "screen",
      tint: i % 2 === 0 ? "#7bf7ff" : "#2fc7ff"
    });
  }
  if (Math.random() > 0.55) {
    ctx.spawnParticle({
      type: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      ttl: 0.16,
      size: ctx.random(12, 20),
      rotation: 0,
      spin: 0,
      opacity: 0.8,
      blendMode: "screen",
      tint: "#84fbff"
    });
  }
  ctx.addShake(3, 22);
  ctx.damageCrawlers({ x, y }, 24, 2);
}

export function createTools(
  icons: Record<ToolId, string>,
  cursors: Record<ToolId, string>
): ToolDefinition[] {
  let flameAccumulator = 0;
  let sawAccumulator = 0;
  let machineGunAccumulator = 0;
  let colorAccumulator = 0;
  let laserAccumulator = 0;
  let lastSawPoint: Point = { x: 0, y: 0 };

  return [
    {
      id: "hammer",
      label: "Hammer",
      hotkey: "1",
      iconPath: icons.hammer,
      cursorPath: cursors.hammer,
      soundIds: ["glass-hit", "impact-low"],
      hint: "One sharp hit. Big cracks and chunky shake.",
      onPress: (ctx, point) => emitHammerBurst(ctx, point.x, point.y),
      onMove: () => {},
      onRelease: () => {}
    },
    {
      id: "chainsaw",
      label: "Chain-Saw",
      hotkey: "2",
      iconPath: icons.chainsaw,
      cursorPath: cursors.chainsaw,
      soundIds: ["chainsaw-loop", "spark"],
      hint: "Hold and drag to carve gouges and kick sparks.",
      onPress: (ctx, point) => {
        sawAccumulator = 0;
        lastSawPoint = point;
        emitChainsaw(ctx, point.x, point.y, true);
        ctx.startLoop("chainsaw-loop");
      },
      onMove: (ctx, point) => {
        const distance = Math.hypot(point.x - lastSawPoint.x, point.y - lastSawPoint.y);
        if (distance > 12) {
          emitChainsaw(ctx, point.x, point.y, distance > 26);
          lastSawPoint = point;
        }
      },
      onRelease: (ctx) => {
        sawAccumulator = 0;
        ctx.stopLoop("chainsaw-loop");
      },
      update: (ctx, dt) => {
        if (!ctx.state.pointer.down) {
          return;
        }
        sawAccumulator += dt;
        if (sawAccumulator >= 0.045) {
          sawAccumulator = 0;
          emitChainsaw(
            ctx,
            ctx.state.pointer.worldX,
            ctx.state.pointer.worldY,
            Math.hypot(ctx.state.pointer.dx, ctx.state.pointer.dy) > 3
          );
        }
      }
    },
    {
      id: "machineGun",
      label: "Machine Gun",
      hotkey: "3",
      iconPath: icons.machineGun,
      cursorPath: cursors.machineGun,
      soundIds: ["machine-gun", "ricochet"],
      hint: "Hold to rattle off rapid-fire shots across the desktop.",
      onPress: (ctx, point) => {
        machineGunAccumulator = 0;
        emitBulletBurst(ctx, point.x, point.y, true);
      },
      onMove: () => {},
      onRelease: () => {
        machineGunAccumulator = 0;
      },
      update: (ctx, dt) => {
        if (!ctx.state.pointer.down) {
          return;
        }
        machineGunAccumulator += dt;
        while (machineGunAccumulator >= 0.08) {
          machineGunAccumulator -= 0.08;
          emitBulletBurst(ctx, ctx.state.pointer.worldX, ctx.state.pointer.worldY, false);
        }
      }
    },
    {
      id: "flamethrower",
      label: "Flame-Thrower",
      hotkey: "4",
      iconPath: icons.flamethrower,
      cursorPath: cursors.flamethrower,
      soundIds: ["flame-loop"],
      hint: "Hold and drag to spray fire and leave scorch marks.",
      onPress: (ctx, point) => {
        flameAccumulator = 0;
        emitFlame(ctx, point.x, point.y);
        ctx.startLoop("flame-loop");
      },
      onMove: (ctx, point) => emitFlame(ctx, point.x, point.y),
      onRelease: (ctx) => {
        flameAccumulator = 0;
        ctx.stopLoop("flame-loop");
      },
      update: (ctx, dt) => {
        if (!ctx.state.pointer.down) {
          return;
        }
        flameAccumulator += dt;
        while (flameAccumulator >= 0.03) {
          flameAccumulator -= 0.03;
          emitFlame(ctx, ctx.state.pointer.worldX, ctx.state.pointer.worldY);
        }
      }
    },
    {
      id: "colorThrower",
      label: "Color Thrower",
      hotkey: "5",
      iconPath: icons.colorThrower,
      cursorPath: cursors.colorThrower,
      soundIds: ["paint-spray"],
      hint: "Sprays bright paint splats that stick until reset.",
      onPress: (ctx, point) => {
        colorAccumulator = 0;
        emitColorThrow(ctx, point.x, point.y);
      },
      onMove: (ctx, point) => emitColorThrow(ctx, point.x, point.y),
      onRelease: () => {
        colorAccumulator = 0;
      },
      update: (ctx, dt) => {
        if (!ctx.state.pointer.down) {
          return;
        }
        colorAccumulator += dt;
        while (colorAccumulator >= 0.05) {
          colorAccumulator -= 0.05;
          emitColorThrow(ctx, ctx.state.pointer.worldX, ctx.state.pointer.worldY);
        }
      }
    },
    {
      id: "phaser",
      label: "Phaser",
      hotkey: "6",
      iconPath: icons.phaser,
      cursorPath: cursors.phaser,
      soundIds: ["phaser-shot"],
      hint: "Fires a sci-fi pulse with plasma rings and burn marks.",
      onPress: (ctx, point) => emitPhaser(ctx, point.x, point.y),
      onMove: () => {},
      onRelease: () => {}
    },
    {
      id: "stamp",
      label: "Stamp",
      hotkey: "7",
      iconPath: icons.stamp,
      cursorPath: cursors.stamp,
      soundIds: ["stamp-hit"],
      hint: "Drops a heavy cartoon stamp mark with a thick thud.",
      onPress: (ctx, point) => emitStamp(ctx, point.x, point.y),
      onMove: () => {},
      onRelease: () => {}
    },
    {
      id: "termites",
      label: "Termites",
      hotkey: "8",
      iconPath: icons.termites,
      cursorPath: cursors.termites,
      soundIds: ["termite"],
      hint: "Click to spawn hungry termites that chew over time.",
      onPress: (ctx, point) => {
        ctx.spawnCrawler(point, 4);
        ctx.playSound("termite");
      },
      onMove: () => {},
      onRelease: () => {}
    },
    {
      id: "laser",
      label: "Laser",
      hotkey: "9",
      iconPath: icons.laser,
      cursorPath: cursors.laser,
      soundIds: ["laser-loop"],
      hint: "Cuts with a hot cyan beam and leaves glowing burns.",
      onPress: (ctx, point) => {
        laserAccumulator = 0;
        emitLaser(ctx, point.x, point.y);
        ctx.startLoop("laser-loop");
      },
      onMove: (ctx, point) => emitLaser(ctx, point.x, point.y),
      onRelease: (ctx) => {
        laserAccumulator = 0;
        ctx.stopLoop("laser-loop");
      },
      update: (ctx, dt) => {
        if (!ctx.state.pointer.down) {
          return;
        }
        laserAccumulator += dt;
        while (laserAccumulator >= 0.04) {
          laserAccumulator -= 0.04;
          emitLaser(ctx, ctx.state.pointer.worldX, ctx.state.pointer.worldY);
        }
      }
    }
  ];
}
