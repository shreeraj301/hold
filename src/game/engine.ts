import { createAudio, type AudioBus } from "./audio";
import {
  COLS,
  EARLY_BONUS,
  ENEMIES,
  MAX_RANK,
  PREP_FIRST,
  PREP_LATER,
  ROWS,
  SELL_RATIO,
  START_GOLD,
  START_LIVES,
  TOWERS,
  WAVES,
  describeWave,
  padWave,
  rankDamage,
  rankRate,
  scaledGold,
  scaledHp,
  scaledSpeed,
  upgradeCost,
  type TargetMode,
} from "./balance";
import { drawFrame, type View } from "./draw";
import { enemyColor, palette, type EnemyKind, type TowerKind } from "./palette";
import { aimAtPath, cellKey, makePath, samplePath, type Cell, type PathGeom } from "./path";
import { publish } from "./store";
import type { Enemy, Floater, Ghost, Particle, Phase, Shot, Snapshot, Tower } from "./types";

const SAVE_KEY = "hold-save-v2";
const STEP = 1 / 60;

type Save = { version: 1; bestScore: number; bestWave: number };

type SpawnItem = { kind: EnemyKind; at: number };

export type GameApi = {
  destroy: () => void;
  begin: () => void;
  restart: () => void;
  menu: () => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  toggleSound: () => void;
  toggleSpeed: () => void;
  toggleShake: () => void;
  end: () => void;
  setPlacing: (kind: TowerKind | null) => void;
  sendWave: () => void;
  upgrade: (track: "damage" | "rate") => void;
  sell: () => void;
  setTargeting: (mode: TargetMode) => void;
  key: (event: KeyboardEvent) => void;
  pointerDown: (clientX: number, clientY: number) => void;
  pointerMove: (clientX: number, clientY: number) => void;
  pointerUp: (clientX: number, clientY: number) => void;
  pointerLeave: () => void;
  resize: () => void;
};

type DebugApi = {
  get: () => Snapshot & { towers: number; enemies: number };
  begin: () => void;
  place: (kind: TowerKind, c: number, r: number) => boolean;
  send: () => void;
  fast: (seconds: number) => void;
  upgrade: (track: "damage" | "rate") => void;
  selectCell: (c: number, r: number) => void;
};

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { version: 1, bestScore: 0, bestWave: 0 };
    const parsed = JSON.parse(raw) as Partial<Save>;
    return {
      version: 1,
      bestScore: typeof parsed.bestScore === "number" ? parsed.bestScore : 0,
      bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
    };
  } catch {
    return { version: 1, bestScore: 0, bestWave: 0 };
  }
}

function writeSave(save: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}

export function createGame(canvas: HTMLCanvasElement): GameApi {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const path: PathGeom = makePath();
  const audio: AudioBus = createAudio();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let save = loadSave();

  let phase: Phase = "menu";
  let gold = START_GOLD;
  let lives = START_LIVES;
  let waveIndex = 0;
  let simTime = 0;
  let prepEndsAt = PREP_FIRST;
  let speed: 1 | 2 = 1;
  let paused = false;
  let sound = true;
  let shake = !reduceMotion;
  let placing: TowerKind | null = null;
  let selectedId: number | null = null;
  let hover: Cell | null = null;
  let placeOk = false;
  let kills = 0;
  let leaks = 0;
  let goldEarned = 0;
  let cleared = 0;
  let score = 0;
  let banner = 0;
  let gateFlash = 0;
  let trauma = 0;
  let hitstop = 0;
  let present = 0;
  let pubAcc = 0;
  let nextId = 1;
  let quiet = false;

  const towers: Tower[] = [];
  const enemies: Enemy[] = [];
  const shots: Shot[] = [];
  const particles: Particle[] = [];
  const floaters: Floater[] = [];
  let queue: SpawnItem[] = [];
  let qIndex = 0;

  const view: View = { cell: 48, ox: 0, oy: 0, w: 1, h: 1 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 18;
    const cell = Math.max(8, Math.min((w - pad * 2) / COLS, (h - pad * 2) / ROWS));
    view.cell = cell;
    view.w = w;
    view.h = h;
    view.ox = (w - cell * COLS) / 2;
    view.oy = (h - cell * ROWS) / 2;
  };

  const point = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const p = point(clientX, clientY);
    const c = Math.floor((p.x - view.ox) / view.cell);
    const r = Math.floor((p.y - view.oy) / view.cell);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return { c, r };
  };

  const playing = () => phase === "prep" || phase === "wave";

  const towerAt = (cell: Cell) => towers.find((tower) => tower.c === cell.c && tower.r === cell.r);

  const placeBlock = (cell: Cell): string | null => {
    if (path.set.has(cellKey(cell.c, cell.r))) return "The route is closed.";
    if (towerAt(cell)) return "Something is already planted there.";
    if (!placing) return null;
    if (gold < TOWERS[placing].cost) return "Not enough gold.";
    return null;
  };

  const hint = (): string => {
    if (phase === "menu") return "Twelve waves. The slot at the end is the only way through.";
    if (phase === "victory") return "Nothing crossed.";
    if (phase === "defeat") return "The route gave.";
    if (phase === "ended") return "You closed the field.";
    if (placing) {
      if (!hover) return "Aim at an open cell, then release.";
      return placeBlock(hover) ?? `Release to plant ${TOWERS[placing].name}.`;
    }
    if (selectedId) return "Raise damage or fire rate. Sell returns sixty percent.";
    if (phase === "prep" && towers.length === 0) return "Pick an instrument, then plant it off the route.";
    if (phase === "prep" && towers.length < 2) return "Stack a second one on the same stretch. One rarely finishes the job.";
    if (phase === "prep") return "Send early for a rush bonus, or let the clock run.";
    return "First hits the front. Strong hunts the core.";
  };

  const creepCount = () => enemies.reduce((n, enemy) => n + (enemy.alive ? 1 : 0), 0);

  const snapshot = (): Snapshot => {
    const selected = towers.find((tower) => tower.id === selectedId) ?? null;
    const spec = selected ? TOWERS[selected.kind] : null;
    const prepLeft = phase === "prep" ? Math.max(0, prepEndsAt - simTime) : 0;
    return {
      phase,
      gold,
      lives,
      wave: waveIndex + 1,
      totalWaves: WAVES.length,
      prepLeft,
      earlyBonus: EARLY_BONUS,
      placing,
      speed,
      paused,
      sound,
      shake,
      selected: selected && spec
        ? {
            id: selected.id,
            kind: selected.kind,
            damage: rankDamage(selected.kind, selected.dmgRank),
            rate: rankRate(selected.kind, selected.rateRank),
            dps: rankDamage(selected.kind, selected.dmgRank) * rankRate(selected.kind, selected.rateRank),
            range: spec.range,
            dmgRank: selected.dmgRank,
            rateRank: selected.rateRank,
            dmgCost: selected.dmgRank >= MAX_RANK ? 0 : upgradeCost(spec.cost, selected.dmgRank),
            rateCost: selected.rateRank >= MAX_RANK ? 0 : upgradeCost(spec.cost, selected.rateRank),
            sell: Math.floor(selected.invested * SELL_RATIO),
            invested: selected.invested,
            targeting: selected.targeting,
          }
        : null,
      hint: hint(),
      score,
      bestScore: save.bestScore,
      bestWave: save.bestWave,
      kills,
      leaks,
      goldEarned,
      cleared,
      creepsLeft: creepCount() + Math.max(0, queue.length - qIndex),
      spawned: qIndex,
      spawnTotal: queue.length,
      nextWave: describeWave(Math.min(waveIndex, WAVES.length - 1)),
    };
  };

  const push = (force = false) => {
    if (!force && pubAcc < 0.12) return;
    pubAcc = 0;
    publish(snapshot());
  };

  const burst = (x: number, y: number, n: number, color: string, speed = 1.6) => {
    if (quiet) return;
    for (let i = 0; i < n; i++) {
      if (particles.length > 180) particles.shift();
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random()) * speed;
      const life = 0.28 + Math.random() * 0.35;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        r: 0.05 + Math.random() * 0.06,
        color,
        square: true,
      });
    }
  };

  const floatText = (x: number, y: number, text: string, color: string) => {
    if (quiet) return;
    if (floaters.length > 36) floaters.shift();
    floaters.push({ x, y, text, color, life: 0.7, max: 0.7 });
  };

  const finish = () => {
    score = cleared * 1000 + kills * 8 + gold + lives * 30;
    if (score > save.bestScore) save.bestScore = score;
    if (cleared > save.bestWave) save.bestWave = cleared;
    writeSave(save);
    audio.bed(false);
  };

  const punch = (amount: number) => {
    if (reduceMotion) return;
    hitstop = Math.min(0.09, Math.max(hitstop, amount));
  };

  const resetBoard = () => {
    towers.length = 0;
    enemies.length = 0;
    shots.length = 0;
    particles.length = 0;
    floaters.length = 0;
    queue = [];
    qIndex = 0;
    gold = START_GOLD;
    lives = START_LIVES;
    waveIndex = 0;
    simTime = 0;
    kills = 0;
    leaks = 0;
    goldEarned = 0;
    cleared = 0;
    score = 0;
    banner = 0;
    gateFlash = 0;
    trauma = 0;
    hitstop = 0;
    selectedId = null;
    placing = null;
    hover = null;
    paused = false;
    speed = 1;
  };

  const killEnemy = (enemy: Enemy) => {
    if (!enemy.alive) return;
    enemy.alive = false;
    gold += enemy.gold;
    goldEarned += enemy.gold;
    kills += 1;
    floatText(enemy.x, enemy.y - 0.25, `+${enemy.gold}`, palette.success);
    burst(enemy.x, enemy.y, enemy.kind === "core" ? 22 : 8, enemyColor[enemy.kind], enemy.kind === "core" ? 2.4 : 1.5);
    audio.kill(enemy.kind === "core");
    trauma = Math.min(1, trauma + (enemy.kind === "core" ? 0.55 : 0.07));
    punch(enemy.kind === "core" ? 0.08 : 0.032);
  };

  const hurt = (enemy: Enemy, raw: number, pierce: boolean, silent = false) => {
    if (!enemy.alive) return;
    const amount = raw * (pierce ? 1 : enemy.armor);
    enemy.hp -= amount;
    enemy.flash = 0.08;
    if (!silent && amount >= 1) floatText(enemy.x, enemy.y - 0.15, String(Math.max(1, Math.round(amount))), palette.ink);
    if (enemy.hp <= 0) killEnemy(enemy);
  };

  const leak = (enemy: Enemy): boolean => {
    if (!enemy.alive) return false;
    enemy.alive = false;
    lives -= enemy.leak;
    leaks += 1;
    gateFlash = 1;
    trauma = Math.min(1, trauma + (enemy.kind === "core" ? 0.85 : 0.42));
    audio.leak();
    if (lives <= 0) {
      lives = 0;
      phase = "defeat";
      paused = false;
      finish();
      audio.lose();
      push(true);
      return true;
    }
    return false;
  };

  const pickTarget = (tower: Tower): Enemy | null => {
    const range = TOWERS[tower.kind].range;
    const range2 = range * range;
    let best: Enemy | null = null;
    let bestScore = 0;
    let seeded = false;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
      if (d2 > range2) continue;
      let score = 0;
      if (tower.targeting === "first") score = enemy.s;
      else if (tower.targeting === "last") score = -enemy.s;
      else if (tower.targeting === "near") score = -d2;
      else score = enemy.hp;
      if (!seeded || score > bestScore) {
        seeded = true;
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  };

  const fire = (tower: Tower, target: Enemy) => {
    const spec = TOWERS[tower.kind];
    const damage = rankDamage(tower.kind, tower.dmgRank);
    const speedShot = spec.shotSpeed;
    let tx = target.x;
    let ty = target.y;
    if (tower.kind === "lance") {
      const dist = Math.hypot(target.x - tower.x, target.y - tower.y);
      const travel = dist / speedShot;
      const slow = simTime < target.slowUntil ? target.slowMul : 1;
      const future = samplePath(path, target.s + target.speed * slow * travel);
      tx = future.x;
      ty = future.y;
    }
    const dx = tx - tower.x;
    const dy = ty - tower.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    shots.push({
      alive: true,
      kind: tower.kind,
      x: tower.x,
      y: tower.y,
      vx: (dx / dist) * speedShot,
      vy: (dy / dist) * speedShot,
      damage,
      splash: spec.splash,
      pierce: spec.pierce,
      ttl: 1.8,
      homing: tower.kind !== "bloom",
      targetId: target.id,
      destX: tx,
      destY: ty,
    });
    tower.recoil = 1;
    audio.shot(tower.kind);
  };

  const explode = (shot: Shot) => {
    shot.alive = false;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d2 = (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2;
      if (d2 <= shot.splash * shot.splash) hurt(enemy, shot.damage, false);
    }
    burst(shot.x, shot.y, 14, palette.ember, 2.1);
    if (particles.length < 180) {
      const life = 0.4;
      particles.push({
        x: shot.x,
        y: shot.y,
        vx: 0,
        vy: 0,
        life,
        max: life,
        r: 0.2,
        color: palette.ember,
        square: false,
        ring: true,
      });
    }
    trauma = Math.min(1, trauma + (shake ? 0.16 : 0));
    punch(0.045);
    audio.explode();
  };

  const sweepHit = (x0: number, y0: number, x1: number, y1: number, enemy: Enemy) => {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const wx = enemy.x - x0;
    const wy = enemy.y - y0;
    const len2 = vx * vx + vy * vy || 1e-6;
    let t = (wx * vx + wy * vy) / len2;
    if (t < 0 || t > 1) return null;
    t = Math.max(0, Math.min(1, t));
    const dx = enemy.x - (x0 + vx * t);
    const dy = enemy.y - (y0 + vy * t);
    const rr = 0.16 + enemy.radius * 0.35;
    if (dx * dx + dy * dy > rr * rr) return null;
    return t;
  };

  const driftTick = (tower: Tower) => {
    const spec = TOWERS.drift;
    const damage = rankDamage("drift", tower.dmgRank);
    const range2 = spec.range * spec.range;
    let hits = 0;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
      if (d2 > range2) continue;
      enemy.slowMul = spec.slow;
      enemy.slowUntil = simTime + 0.62;
      enemy.hp -= damage * enemy.armor;
      enemy.flash = Math.max(enemy.flash, 0.04);
      hits += 1;
      if (enemy.hp <= 0) killEnemy(enemy);
    }
    if (hits > 0) {
      tower.pulse = 1;
      audio.shot("drift");
    }
    return hits;
  };

  const beginWave = (early: boolean) => {
    if (phase !== "prep") return;
    if (early && prepEndsAt - simTime > 0.35) gold += EARLY_BONUS;
    const groups = WAVES[waveIndex] ?? [];
    queue = [];
    for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
        queue.push({ kind: group.kind, at: simTime + group.delay + i * group.interval });
      }
    }
    queue.sort((a, b) => a.at - b.at);
    qIndex = 0;
    phase = "wave";
    banner = 1.45;
    audio.wave();
    push(true);
  };

  const spawn = (kind: EnemyKind) => {
    const spec = ENEMIES[kind];
    const at = samplePath(path, 0);
    const hp = scaledHp(spec.hp, waveIndex);
    enemies.push({
      id: nextId++,
      kind,
      alive: true,
      x: at.x,
      y: at.y,
      ang: at.ang,
      s: 0,
      hp,
      maxHp: hp,
      speed: scaledSpeed(spec.speed, waveIndex),
      gold: scaledGold(spec.gold, waveIndex),
      leak: spec.leak,
      armor: spec.armor,
      radius: spec.radius,
      slowMul: 1,
      slowUntil: 0,
      flash: 0,
      born: 0.18,
    });
  };

  const onCleared = () => {
    cleared = waveIndex + 1;
    if (waveIndex >= WAVES.length - 1) {
      phase = "victory";
      paused = false;
      finish();
      audio.win();
      push(true);
      return;
    }
    waveIndex += 1;
    phase = "prep";
    prepEndsAt = simTime + PREP_LATER;
    push(true);
  };

  const tryPlace = (cell: Cell) => {
    if (!placing || !playing()) return false;
    if (placeBlock(cell)) {
      push(true);
      return false;
    }
    const spec = TOWERS[placing];
    gold -= spec.cost;
    const x = cell.c + 0.5;
    const y = cell.r + 0.5;
    towers.push({
      id: nextId++,
      kind: placing,
      c: cell.c,
      r: cell.r,
      x,
      y,
      aim: aimAtPath(path, x, y),
      cooldown: 0.15,
      recoil: 0,
      pulse: 0,
      dmgRank: 0,
      rateRank: 0,
      targeting: "first",
      invested: spec.cost,
    });
    burst(x, y, 8, palette.ink, 1.1);
    audio.place();
    push(true);
    return true;
  };

  const selectCell = (cell: Cell | null) => {
    if (!cell) {
      selectedId = null;
      push(true);
      return;
    }
    const tower = towerAt(cell);
    if (tower) {
      selectedId = tower.id;
      if (placing) placing = null;
    } else if (placing) {
      tryPlace(cell);
      return;
    } else {
      selectedId = null;
    }
    push(true);
  };

  const step = (dt: number) => {
    simTime += dt;
    if (phase === "prep" && simTime >= prepEndsAt) beginWave(false);
    if (phase === "wave") {
      while (qIndex < queue.length && queue[qIndex].at <= simTime) {
        spawn(queue[qIndex].kind);
        qIndex += 1;
      }
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (simTime >= enemy.slowUntil) enemy.slowMul = 1;
        const slow = enemy.slowMul;
        enemy.s += enemy.speed * slow * dt;
        enemy.flash = Math.max(0, enemy.flash - dt);
        enemy.born = Math.max(0, enemy.born - dt);
        if (enemy.s >= path.total) {
          if (leak(enemy)) return;
          continue;
        }
        const at = samplePath(path, enemy.s);
        enemy.x = at.x;
        enemy.y = at.y;
        enemy.ang = at.ang;
      }
      if (phase !== "wave") return;
      for (const tower of towers) {
        const rate = rankRate(tower.kind, tower.rateRank);
        const interval = 1 / rate;
        tower.cooldown -= dt;
        tower.recoil *= Math.exp(-10 * dt);
        tower.pulse = Math.max(0, tower.pulse - dt * 1.6);
        const target = tower.kind === "drift" ? null : pickTarget(tower);
        if (target) {
          const ang = Math.atan2(target.y - tower.y, target.x - tower.x);
          tower.aim = lerpAngle(tower.aim, ang, 1 - Math.exp(-12 * dt));
        }
        if (tower.cooldown > 0) continue;
        if (tower.kind === "drift") {
          if (driftTick(tower) > 0) tower.cooldown += interval;
        } else if (target) {
          fire(tower, target);
          tower.cooldown += interval;
          if (tower.cooldown < 0) tower.cooldown = 0;
        }
      }
      for (const shot of shots) {
        if (!shot.alive) continue;
        if (shot.homing) {
          const target = enemies.find((enemy) => enemy.id === shot.targetId && enemy.alive);
          if (target) {
            const ang = Math.atan2(target.y - shot.y, target.x - shot.x);
            const spd = Math.hypot(shot.vx, shot.vy);
            const cur = Math.atan2(shot.vy, shot.vx);
            const next = lerpAngle(cur, ang, 1 - Math.exp(-9 * dt));
            shot.vx = Math.cos(next) * spd;
            shot.vy = Math.sin(next) * spd;
          }
        }
        const x0 = shot.x;
        const y0 = shot.y;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.ttl -= dt;
        if (shot.splash > 0) {
          const dx = shot.destX - shot.x;
          const dy = shot.destY - shot.y;
          const passing = dx * shot.vx + dy * shot.vy < 0;
          if (passing || dx * dx + dy * dy < 0.03 || shot.ttl <= 0) {
            shot.x = shot.destX;
            shot.y = shot.destY;
            explode(shot);
          }
          continue;
        }
        let best: Enemy | null = null;
        let bestT = 2;
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const hit = sweepHit(x0, y0, shot.x, shot.y, enemy);
          if (hit !== null && hit < bestT) {
            bestT = hit;
            best = enemy;
          }
        }
        if (best) {
          shot.alive = false;
          hurt(best, shot.damage, shot.pierce);
          burst(best.x, best.y, 4, shot.kind === "lance" ? palette.violet : palette.ink, 1);
        } else if (shot.ttl <= 0) shot.alive = false;
      }
      if (phase === "wave" && qIndex >= queue.length && creepCount() === 0) onCleared();
    }

    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-2.2 * dt);
      particle.vy *= Math.exp(-2.2 * dt);
    }
    for (const floater of floaters) {
      floater.life -= dt;
      floater.y -= dt * 0.55;
    }
    banner = Math.max(0, banner - dt);
    gateFlash = Math.max(0, gateFlash - dt * 1.4);
    if (shake) trauma = Math.max(0, trauma - dt * 1.7);
    else trauma = 0;

    compact(enemies, (enemy) => enemy.alive);
    compact(shots, (shot) => shot.alive);
    compact(particles, (particle) => particle.life > 0);
    compact(floaters, (floater) => floater.life > 0);
  };

  const ghosts = (): Ghost[] => {
    if (phase !== "menu") return [];
    const kinds: EnemyKind[] = ["runner", "swift", "plate"];
    return kinds.map((kind, i) => {
      const s = (present * (0.9 + i * 0.15) + (path.total / 3) * i) % path.total;
      const at = samplePath(path, s);
      return { x: at.x, y: at.y, ang: at.ang, kind };
    });
  };

  const render = () => {
    if (placing && hover) placeOk = placeBlock(hover) === null;
    else placeOk = false;
    drawFrame(ctx, {
      view,
      phase,
      present,
      banner,
      waveLabel: padWave(waveIndex + 1),
      gateFlash,
      trauma: shake ? trauma : 0,
      hover,
      placing,
      placeOk,
      selectedId,
      towers,
      enemies,
      shots,
      particles,
      floaters,
      ghosts: ghosts(),
      paused,
      path,
      reduceMotion,
      rangeOf: (tower) => TOWERS[tower.kind].range,
      readyOf: (tower) => {
        const interval = 1 / rankRate(tower.kind, tower.rateRank);
        return 1 - Math.max(0, Math.min(1, tower.cooldown / interval));
      },
    });
  };

  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let dead = false;

  const frame = (now: number) => {
    if (dead) return;
    const raw = Math.min(0.1, (now - last) / 1000);
    last = now;
    present += raw;
    pubAcc += raw;
    const live = phase === "prep" || phase === "wave";
    if (hitstop > 0 && !paused && live) {
      hitstop = Math.max(0, hitstop - raw);
      for (const particle of particles) {
        particle.life -= raw;
        particle.x += particle.vx * raw;
        particle.y += particle.vy * raw;
      }
      for (const floater of floaters) floater.life -= raw;
      compact(particles, (particle) => particle.life > 0);
      compact(floaters, (floater) => floater.life > 0);
    } else if (!paused && live) {
      acc += raw * speed;
      let guard = 0;
      while (acc >= STEP && guard < 6) {
        step(STEP);
        acc -= STEP;
        guard += 1;
        if (phase !== "prep" && phase !== "wave") break;
      }
    } else {
      acc = 0;
      trauma = Math.max(0, trauma - raw * 1.7);
      banner = Math.max(0, banner - raw);
      gateFlash = Math.max(0, gateFlash - raw * 1.4);
      for (const particle of particles) particle.life -= raw;
      for (const floater of floaters) {
        floater.life -= raw;
        floater.y -= raw * 0.4;
      }
    }
    render();
    if ((phase === "prep" || phase === "wave") && !paused) push(false);
    raf = requestAnimationFrame(frame);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") {
      audio.resume();
      last = performance.now();
    }
  };

  resize();
  push(true);
  raf = requestAnimationFrame(frame);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVis);
  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  const api: GameApi = {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      audio.stop();
      delete window.__hold;
    },
    begin() {
      audio.unlock();
      resetBoard();
      phase = "prep";
      prepEndsAt = simTime + PREP_FIRST;
      audio.bed(true);
      audio.ui();
      push(true);
    },
    restart() {
      audio.unlock();
      resetBoard();
      phase = "prep";
      prepEndsAt = PREP_FIRST;
      audio.bed(true);
      audio.ui();
      push(true);
    },
    menu() {
      resetBoard();
      phase = "menu";
      audio.bed(false);
      audio.ui();
      push(true);
    },
    togglePause() {
      if (!playing()) return;
      paused = !paused;
      audio.ui();
      push(true);
    },
    setPaused(next) {
      if (!playing()) return;
      paused = next;
      push(true);
    },
    toggleSound() {
      audio.unlock();
      sound = !sound;
      audio.setMuted(!sound);
      push(true);
    },
    toggleSpeed() {
      if (!playing()) return;
      speed = speed === 1 ? 2 : 1;
      audio.ui();
      push(true);
    },
    toggleShake() {
      shake = !shake;
      if (!shake) trauma = 0;
      push(true);
    },
    end() {
      audio.unlock();
      if (!playing()) return;
      phase = "ended";
      paused = false;
      finish();
      audio.close();
      push(true);
    },
    setPlacing(kind) {
      if (!playing()) return;
      audio.unlock();
      placing = placing === kind ? null : kind;
      if (placing) selectedId = null;
      audio.ui();
      push(true);
    },
    sendWave() {
      audio.unlock();
      if (phase === "victory" || phase === "defeat" || phase === "ended") {
        api.restart();
        return;
      }
      beginWave(true);
    },
    upgrade(track) {
      if (!playing()) return;
      const tower = towers.find((item) => item.id === selectedId);
      if (!tower) return;
      const spec = TOWERS[tower.kind];
      if (track === "damage") {
        if (tower.dmgRank >= MAX_RANK) return;
        const cost = upgradeCost(spec.cost, tower.dmgRank);
        if (gold < cost) return;
        gold -= cost;
        tower.invested += cost;
        tower.dmgRank += 1;
      } else {
        if (tower.rateRank >= MAX_RANK) return;
        const cost = upgradeCost(spec.cost, tower.rateRank);
        if (gold < cost) return;
        gold -= cost;
        tower.invested += cost;
        tower.rateRank += 1;
      }
      audio.place();
      push(true);
    },
    sell() {
      if (!playing()) return;
      const index = towers.findIndex((tower) => tower.id === selectedId);
      if (index < 0) return;
      const tower = towers[index];
      gold += Math.floor(tower.invested * SELL_RATIO);
      burst(tower.x, tower.y, 6, palette.muted, 1);
      towers.splice(index, 1);
      selectedId = null;
      audio.ui();
      push(true);
    },
    setTargeting(mode) {
      const tower = towers.find((item) => item.id === selectedId);
      if (!tower || !playing()) return;
      tower.targeting = mode;
      audio.ui();
      push(true);
    },
    key(event) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (phase === "menu") api.begin();
        else if (phase === "prep") api.sendWave();
        else if (phase === "wave") api.togglePause();
        else if (phase === "victory" || phase === "defeat" || phase === "ended") api.restart();
        return;
      }
      if (event.key === "Escape") {
        placing = null;
        selectedId = null;
        push(true);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        api.sell();
        return;
      }
      const map: Record<string, TowerKind> = { "1": "needle", "2": "lance", "3": "bloom", "4": "drift" };
      const kind = map[event.key];
      if (kind) api.setPlacing(kind);
    },
    pointerDown() {
      audio.unlock();
    },
    pointerMove(clientX, clientY) {
      hover = playing() ? cellAt(clientX, clientY) : null;
    },
    pointerUp(clientX, clientY) {
      if (!playing()) return;
      hover = cellAt(clientX, clientY);
      selectCell(hover);
    },
    pointerLeave() {
      hover = null;
    },
    resize,
  };

  const debug: DebugApi = {
    get: () => ({ ...snapshot(), towers: towers.length, enemies: creepCount() }),
    begin: () => api.begin(),
    place: (kind, c, r) => {
      placing = kind;
      return tryPlace({ c, r });
    },
    send: () => beginWave(true),
    fast: (seconds) => {
      quiet = true;
      audio.setMuted(true);
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        if (phase !== "prep" && phase !== "wave") break;
        if (!paused) step(STEP);
      }
      quiet = false;
      audio.setMuted(!sound);
      push(true);
    },
    upgrade: (track) => api.upgrade(track),
    selectCell: (c, r) => selectCell({ c, r }),
  };

  window.__hold = debug;
  return api;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function compact<T>(list: T[], keep: (item: T) => boolean) {
  let write = 0;
  for (let i = 0; i < list.length; i++) {
    if (keep(list[i])) list[write++] = list[i];
  }
  list.length = write;
}

declare global {
  interface Window {
    __hold?: DebugApi;
  }
}
