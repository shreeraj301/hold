import { COLS, ROWS, TOWERS } from "./balance";
import { enemyColor, palette, towerColor } from "./palette";
import { samplePath, type PathGeom } from "./path";
import type { Enemy, Floater, Ghost, Particle, Phase, Shot, Tower } from "./types";
import type { TowerKind } from "./palette";

export type View = {
  cell: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
};

export type DrawModel = {
  view: View;
  phase: Phase;
  present: number;
  banner: number;
  waveLabel: string;
  gateFlash: number;
  trauma: number;
  hover: { c: number; r: number } | null;
  placing: TowerKind | null;
  placeOk: boolean;
  selectedId: number | null;
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  particles: Particle[];
  floaters: Floater[];
  ghosts: Ghost[];
  paused: boolean;
  path: PathGeom;
  reduceMotion: boolean;
  rangeOf: (tower: Tower) => number;
  readyOf: (tower: Tower) => number;
};

let pathCache: Path2D | null = null;
let pathKey = "";

function rgba(rgb: string, alpha: number) {
  return `rgba(${rgb},${alpha})`;
}

function idlePhase(phase: Phase) {
  return phase === "menu" || phase === "victory" || phase === "defeat" || phase === "ended";
}

function boardPath(view: View, path: PathGeom): Path2D {
  const key = `${view.cell.toFixed(3)}|${view.ox.toFixed(2)}|${view.oy.toFixed(2)}|${path.pts.length}`;
  if (pathCache && key === pathKey) return pathCache;
  const d = new Path2D();
  path.pts.forEach((pt, i) => {
    const x = view.ox + pt.x * view.cell;
    const y = view.oy + pt.y * view.cell;
    if (i === 0) d.moveTo(x, y);
    else d.lineTo(x, y);
  });
  pathCache = d;
  pathKey = key;
  return d;
}

function px(view: View, x: number) {
  return view.ox + x * view.cell;
}
function py(view: View, y: number) {
  return view.oy + y * view.cell;
}

export function drawFrame(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  const shake = model.reduceMotion ? 0 : model.trauma * model.trauma;
  const t = model.present;
  const ox = shake ? Math.sin(t * 47) * shake * view.cell * 0.18 : 0;
  const oy = shake ? Math.cos(t * 39) * shake * view.cell * 0.12 : 0;
  const rot = shake ? Math.sin(t * 33) * shake * 0.012 : 0;
  const bx = view.ox + (COLS * view.cell) / 2;
  const by = view.oy + (ROWS * view.cell) / 2;

  ctx.clearRect(0, 0, view.w, view.h);
  ctx.fillStyle = palette.canvas;
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.translate(bx, by);
  ctx.rotate(rot);
  ctx.translate(-bx, -by);

  drawArtboard(ctx, view);
  drawGrid(ctx, model);
  drawRoute(ctx, model);
  drawMotes(ctx, model);
  drawPulses(ctx, model);
  drawGate(ctx, model);
  drawHover(ctx, model);
  drawRanges(ctx, model);
  drawGhostPlace(ctx, model);
  drawShots(ctx, model);
  drawTowers(ctx, model);
  drawEnemies(ctx, model);
  drawGhosts(ctx, model);
  drawParticles(ctx, model);
  drawFloaters(ctx, model);
  drawBanner(ctx, model);

  if (model.paused && model.phase !== "menu") {
    ctx.fillStyle = rgba(palette.canvasRgb, 0.55);
    ctx.fillRect(view.ox, view.oy, COLS * view.cell, ROWS * view.cell);
    ctx.fillStyle = palette.ink;
    ctx.font = `500 ${Math.max(18, view.cell * 0.55)}px "Mona Sans Variable", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Paused", view.ox + (COLS * view.cell) / 2, view.oy + (ROWS * view.cell) / 2);
  }

  ctx.restore();
  drawVignette(ctx, model);
}

function drawArtboard(ctx: CanvasRenderingContext2D, view: View) {
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(view.ox + 0.5, view.oy + 0.5, COLS * view.cell - 1, ROWS * view.cell - 1);
}

function drawGrid(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view, path } = model;
  ctx.fillStyle = palette.line;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (path.set.has(`${c},${r}`)) continue;
      const x = px(view, c + 0.5);
      const y = py(view, r + 0.5);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
}

function drawRoute(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view, path } = model;
  const d = boardPath(view, path);
  const motion = model.reduceMotion ? 0 : model.present;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(palette.inkRgb, 0.06);
  ctx.lineWidth = view.cell * 0.92;
  ctx.stroke(d);
  ctx.strokeStyle = palette.raised;
  ctx.lineWidth = view.cell * 0.58;
  ctx.stroke(d);
  ctx.strokeStyle = rgba(palette.inkRgb, 0.16);
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 12]);
  ctx.lineDashOffset = -motion * 28;
  ctx.stroke(d);
  ctx.setLineDash([]);

  ctx.strokeStyle = rgba(palette.inkRgb, 0.28);
  ctx.lineWidth = 1.25;
  ctx.lineCap = "butt";
  const gap = 1.7;
  const start = model.reduceMotion ? 0.4 : (motion * 0.85) % gap;
  for (let s = start; s < path.total; s += gap) {
    const p = samplePath(path, s);
    const x = px(view, p.x);
    const y = py(view, p.y);
    const len = view.cell * 0.16;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(p.ang) * len, y - Math.sin(p.ang) * len);
    ctx.lineTo(x + Math.cos(p.ang) * len * 0.15, y + Math.sin(p.ang) * len * 0.15);
    ctx.stroke();
  }
}

function drawMotes(ctx: CanvasRenderingContext2D, model: DrawModel) {
  if (model.reduceMotion) return;
  const { view } = model;
  ctx.fillStyle = rgba(palette.inkRgb, model.phase === "menu" ? 0.2 : 0.1);
  for (let i = 0; i < 14; i++) {
    const col = (i * 3.1 + model.present * (0.12 + (i % 4) * 0.035)) % COLS;
    const row = (i * 1.7 + Math.sin(model.present * 0.35 + i) * 0.7 + ROWS) % ROWS;
    ctx.beginPath();
    ctx.arc(px(view, col), py(view, row), i % 3 === 0 ? 1.7 : 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPulses(ctx: CanvasRenderingContext2D, model: DrawModel) {
  if (model.reduceMotion) return;
  const { view, path } = model;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const s = (model.present * (1.15 + i * 0.08) + (path.total / 3) * i) % path.total;
    const p = samplePath(path, s);
    const x = px(view, p.x);
    const y = py(view, p.y);
    const rad = view.cell * (0.07 + 0.015 * Math.sin(model.present * 3 + i));
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = palette.signal;
    ctx.beginPath();
    ctx.arc(x, y, rad * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view, path } = model;
  const end = path.pts[path.pts.length - 1];
  const start = path.pts[0];
  if (!end || !start) return;
  const flash = model.gateFlash;
  if (flash > 0) {
    ctx.beginPath();
    ctx.fillStyle = rgba(palette.coralRgb, 0.22 * flash);
    ctx.arc(px(view, end.x), py(view, end.y), view.cell * (0.55 + (1 - flash) * 0.85), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(px(view, end.x), py(view, end.y));
  ctx.fillStyle = flash > 0.2 ? palette.coral : palette.ink;
  ctx.globalAlpha = flash > 0.2 ? 1 : 0.92;
  const w = view.cell * 0.12;
  const h = view.cell * 0.72;
  round(ctx, view.cell * 0.18, -h / 2, w, h, w);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.muted;
  ctx.font = `500 ${Math.max(10, view.cell * 0.22)}px "Inter Variable", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("OUT", px(view, end.x), py(view, end.y) + view.cell * 0.42);
  ctx.textBaseline = "bottom";
  ctx.fillText("IN", px(view, start.x), py(view, start.y) - view.cell * 0.38);
}

function drawHover(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const cell = model.hover;
  if (!cell || idlePhase(model.phase)) return;
  const { view } = model;
  const x = px(view, cell.c) + 3;
  const y = py(view, cell.r) + 3;
  const s = view.cell - 6;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, 8);
  ctx.fillStyle = model.placing
    ? model.placeOk
      ? rgba(palette.signalRgb, 0.08)
      : rgba(palette.inkRgb, 0.03)
    : rgba(palette.inkRgb, 0.04);
  ctx.fill();
  ctx.strokeStyle = model.placing && model.placeOk ? rgba(palette.signalRgb, 0.9) : palette.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawRanges(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  for (const tower of model.towers) {
    const selected = tower.id === model.selectedId;
    const hovered = model.hover && model.hover.c === tower.c && model.hover.r === tower.r && !model.placing;
    if (!selected && !hovered) continue;
    const rad = model.rangeOf(tower) * view.cell;
    ctx.beginPath();
    ctx.arc(px(view, tower.x), py(view, tower.y), rad, 0, Math.PI * 2);
    if (selected) {
      ctx.fillStyle = rgba(palette.signalRgb, 0.08);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.signalRgb, 0.9);
      if (!model.reduceMotion) {
        ctx.setLineDash([4, 7]);
        ctx.lineDashOffset = -model.present * 18;
      }
    } else {
      ctx.strokeStyle = rgba(palette.inkRgb, 0.28);
    }
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawGhostPlace(ctx: CanvasRenderingContext2D, model: DrawModel) {
  if (!model.placing || !model.hover || model.phase === "menu") return;
  const { view, hover, placing } = model;
  const x = hover.c + 0.5;
  const y = hover.r + 0.5;
  const range = rangeForKind(placing) * view.cell;
  const pulse = model.reduceMotion ? 1 : 0.85 + Math.sin(model.present * 5) * 0.15;
  ctx.beginPath();
  ctx.arc(px(view, x), py(view, y), range, 0, Math.PI * 2);
  ctx.strokeStyle = model.placeOk ? rgba(palette.inkRgb, 0.35 * pulse) : rgba(palette.mutedRgb, 0.28);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.lineDashOffset = model.reduceMotion ? 0 : -model.present * 16;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.globalAlpha = model.placeOk ? 0.85 : 0.35;
  paintTower(ctx, view, placing, x, y, aimToward(model, x, y), 0, 1, false, model.present, model.reduceMotion);
  ctx.restore();
}

function rangeForKind(kind: TowerKind): number {
  return TOWERS[kind].range;
}

function aimToward(model: DrawModel, x: number, y: number) {
  const end = model.path.pts[Math.floor(model.path.pts.length * 0.45)] ?? { x, y };
  return Math.atan2(end.y - y, end.x - x);
}

function drawTowers(ctx: CanvasRenderingContext2D, model: DrawModel) {
  for (const tower of model.towers) {
    const ready = model.readyOf(tower);
    paintTower(
      ctx,
      model.view,
      tower.kind,
      tower.x,
      tower.y,
      tower.aim,
      tower.recoil,
      ready,
      tower.id === model.selectedId,
      model.present,
      model.reduceMotion,
    );
    if (tower.pulse > 0 && tower.kind === "drift") {
      ctx.beginPath();
      ctx.arc(
        px(model.view, tower.x),
        py(model.view, tower.y),
        (0.4 + (1 - tower.pulse) * towerRange(tower)) * model.view.cell,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = rgba(palette.magentaRgb, 0.5 * tower.pulse);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function towerRange(tower: Tower) {
  return rangeForKind(tower.kind);
}

function paintTower(
  ctx: CanvasRenderingContext2D,
  view: View,
  kind: TowerKind,
  x: number,
  y: number,
  aim: number,
  recoil: number,
  ready: number,
  selected: boolean,
  spin: number,
  still: boolean,
) {
  const cx = px(view, x);
  const cy = py(view, y);
  const cell = view.cell;
  const color = towerColor[kind];
  const breathe = still ? 1 : 1 + Math.sin(spin * 2.1 + x * 3) * 0.035;
  const base = cell * (kind === "lance" ? 0.2 : 0.26) * breathe;
  const barrel = cell * (kind === "lance" ? 0.62 : kind === "bloom" ? 0.34 : 0.46);

  ctx.beginPath();
  ctx.arc(cx, cy, base, 0, Math.PI * 2);
  ctx.fillStyle = palette.raised;
  ctx.fill();
  ctx.lineWidth = selected ? 1.75 : 1.25;
  ctx.strokeStyle = selected ? palette.signal : color;
  ctx.stroke();

  if (kind !== "drift") {
    const pull = recoil * cell * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim);
    ctx.translate(-pull, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = kind === "lance" ? 1.6 : kind === "bloom" ? 4 : 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(base * 0.3, 0);
    ctx.lineTo(barrel, 0);
    ctx.stroke();
    if (kind === "bloom") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(barrel, 0, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    if (recoil > 0.15) {
      ctx.globalAlpha = Math.min(1, recoil);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(barrel + cell * 0.04, 0, cell * 0.055 * (0.5 + recoil), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(still ? 0.6 : spin * 0.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, base * 0.55, 0.2, Math.PI * 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, base * 0.55, Math.PI + 0.2, Math.PI * 2.15);
    ctx.stroke();
    ctx.restore();
  }

  const sweep = Math.max(0, Math.min(1, ready)) * Math.PI * 2;
  if (sweep > 0.05) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.arc(cx, cy, base + 4, -Math.PI / 2, -Math.PI / 2 + sweep);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, model: DrawModel) {
  for (const enemy of model.enemies) {
    if (!enemy.alive) continue;
    paintEnemy(ctx, model, enemy);
  }
}

function paintEnemy(ctx: CanvasRenderingContext2D, model: DrawModel, enemy: Enemy) {
  const { view } = model;
  const x = px(view, enemy.x);
  const y = py(view, enemy.y);
  const cell = view.cell;
  const pop = enemy.born > 0 ? 1 - enemy.born * 2.2 : 1;
  const scale = Math.max(0.4, pop);
  const showSlow = enemy.slowMul < 0.99;

  ctx.save();
  ctx.translate(x, y + cell * enemy.radius * 0.2);
  ctx.scale(1, 0.38);
  ctx.fillStyle = rgba(palette.shadowRgb, 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, cell * Math.max(0.16, enemy.radius) * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(enemy.kind === "core" ? model.present * 0.4 : enemy.ang);
  ctx.scale(scale, scale);
  if (enemy.flash > 0.02) {
    const squash = 1 + enemy.flash * 2.4;
    ctx.scale(squash, 1 / squash);
  }

  const color = enemy.flash > 0.04 ? palette.ink : enemyColor[enemy.kind];
  if (enemy.kind === "runner") {
    const s = cell * 0.34;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-s / 2, -s * 0.38, s, s * 0.76, 3);
    ctx.fill();
  } else if (enemy.kind === "swift") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cell * 0.26, 0);
    ctx.lineTo(-cell * 0.16, cell * 0.12);
    ctx.lineTo(-cell * 0.08, 0);
    ctx.lineTo(-cell * 0.16, -cell * 0.12);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "plate") {
    const r = cell * 0.32;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const hx = Math.cos(a) * r;
      const hy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fillStyle = palette.raised;
    ctx.fill();
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else if (enemy.kind === "wisp") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-cell * 0.08, 0);
    ctx.lineTo(-cell * 0.28, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    const spin = model.reduceMotion ? 0 : model.present;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.18, spin, spin + Math.PI * 1.35);
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (enemy.flash > 0) {
    const k = enemy.flash / 0.08;
    ctx.beginPath();
    ctx.strokeStyle = palette.ink;
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, cell * (enemy.radius + 0.18 + (1 - k) * 0.28), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (showSlow) {
    ctx.beginPath();
    ctx.strokeStyle = rgba(palette.magentaRgb, 0.8);
    ctx.lineWidth = 1;
    ctx.arc(x, y, cell * (enemy.radius + 0.12), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.hp < enemy.maxHp || enemy.kind === "core" || enemy.kind === "plate") {
    const bw = cell * (enemy.kind === "core" ? 0.9 : 0.62);
    const bh = 2;
    const bx = x - bw / 2;
    const by = y - cell * (enemy.radius + 0.28);
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = palette.line;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = ratio < 0.35 ? palette.coral : palette.ink;
    ctx.fillRect(bx, by, bw * ratio, bh);
  }
}

function drawGhosts(ctx: CanvasRenderingContext2D, model: DrawModel) {
  if (model.ghosts.length === 0) return;
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (const ghost of model.ghosts) {
    paintEnemy(ctx, model, {
      id: -1,
      kind: ghost.kind,
      alive: true,
      x: ghost.x,
      y: ghost.y,
      ang: ghost.ang,
      s: 0,
      hp: 1,
      maxHp: 1,
      speed: 0,
      gold: 0,
      leak: 0,
      armor: 1,
      radius: 0.2,
      slowMul: 1,
      slowUntil: 0,
      flash: 0,
      born: 0,
    });
  }
  ctx.restore();
}

function drawShots(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  for (const shot of model.shots) {
    if (!shot.alive) continue;
    const x = px(view, shot.x);
    const y = py(view, shot.y);
    const ang = Math.atan2(shot.vy, shot.vx);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    if (shot.kind === "bloom") {
      ctx.fillStyle = rgba(palette.coralRgb, 0.28);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(7, view.cell * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.ember;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, view.cell * 0.09), 0, Math.PI * 2);
      ctx.fill();
    } else if (shot.kind === "lance") {
      ctx.save();
      ctx.strokeStyle = palette.violet;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - cos * view.cell * 0.42, y - sin * view.cell * 0.42);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - cos * view.cell * 0.34, y - sin * view.cell * 0.34);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = palette.ink;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - cos * view.cell * 0.28, y - sin * view.cell * 0.28);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.ink;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, view.cell * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  for (const p of model.particles) {
    const alpha = Math.max(0, p.life / p.max);
    const x = px(view, p.x);
    const y = py(view, p.y);
    ctx.globalAlpha = alpha;
    if (p.ring) {
      const k = 1 - alpha;
      ctx.beginPath();
      ctx.arc(x, y, (0.18 + k * 1.25) * view.cell, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = p.color;
    const s = p.r * view.cell * (0.45 + alpha);
    if (p.square) ctx.fillRect(x - s / 2, y - s / 2, s, s);
    else {
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of model.floaters) {
    const k = Math.max(0, f.life / f.max);
    const pop = k > 0.72 ? 1 + (1 - (k - 0.72) / 0.28) * 0.18 : 1;
    ctx.globalAlpha = k;
    ctx.fillStyle = f.color;
    ctx.font = `500 ${Math.max(11, view.cell * 0.26) * pop}px "Inter Variable", sans-serif`;
    ctx.fillText(f.text, px(view, f.x), py(view, f.y));
  }
  ctx.globalAlpha = 1;
}

function drawBanner(ctx: CanvasRenderingContext2D, model: DrawModel) {
  if (model.banner <= 0 || model.phase === "menu") return;
  const alpha = Math.min(1, model.banner / 0.35) * Math.min(1, model.banner);
  const { view } = model;
  const cx = view.ox + (COLS * view.cell) / 2;
  const cy = view.oy + (ROWS * view.cell) / 2;
  const scale = 0.9 + 0.1 * Math.min(1, model.banner / 1.2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.max(42, view.cell * 1.5)}px "Mona Sans Variable", sans-serif`;
  ctx.fillText(model.waveLabel, 0, 0);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, model: DrawModel) {
  const { view } = model;
  const cx = view.w / 2;
  const cy = view.h / 2;
  const r = Math.max(view.w, view.h) * 0.72;
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  if (model.phase === "victory") g.addColorStop(1, "rgba(23,128,61,0.16)");
  else if (model.phase === "defeat") g.addColorStop(1, rgba(palette.coralRgb, 0.16));
  else if (model.phase === "ended") g.addColorStop(1, rgba(palette.inkRgb, 0.08));
  else g.addColorStop(1, rgba(palette.shadowRgb, model.phase === "menu" ? 0.18 : 0.28));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
