import type { EnemyKind, TowerKind } from "./palette";

export const COLS = 16;
export const ROWS = 10;
export const START_GOLD = 125;
export const START_LIVES = 18;
export const EARLY_BONUS = 15;
export const PREP_FIRST = 18;
export const PREP_LATER = 12;
export const SELL_RATIO = 0.6;
export const MAX_RANK = 3;

export type TargetMode = "first" | "last" | "near" | "strong";

export type TowerSpec = {
  name: string;
  cost: number;
  range: number;
  damage: number;
  rate: number;
  shotSpeed: number;
  splash: number;
  pierce: boolean;
  slow: number;
  blurb: string;
};

export const TOWERS: Record<TowerKind, TowerSpec> = {
  needle: {
    name: "Needle",
    cost: 50,
    range: 2.05,
    damage: 8,
    rate: 2.5,
    shotSpeed: 11,
    splash: 0,
    pierce: false,
    slow: 1,
    blurb: "Rapid single shots. Short reach.",
  },
  lance: {
    name: "Lance",
    cost: 120,
    range: 4.35,
    damage: 48,
    rate: 0.52,
    shotSpeed: 16,
    splash: 0,
    pierce: true,
    slow: 1,
    blurb: "Long reach. Ignores armor.",
  },
  bloom: {
    name: "Bloom",
    cost: 110,
    range: 2.6,
    damage: 20,
    rate: 0.72,
    shotSpeed: 6,
    splash: 1.05,
    pierce: false,
    slow: 1,
    blurb: "A charge that breaks a pack.",
  },
  drift: {
    name: "Drift",
    cost: 75,
    range: 1.85,
    damage: 2,
    rate: 1.7,
    shotSpeed: 0,
    splash: 0,
    pierce: false,
    slow: 0.6,
    blurb: "Aura that drags the line down.",
  },
};

export const TOWER_ORDER: TowerKind[] = ["needle", "lance", "bloom", "drift"];

export type EnemySpec = {
  name: string;
  hp: number;
  speed: number;
  gold: number;
  leak: number;
  armor: number;
  radius: number;
};

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  runner: { name: "runner", hp: 58, speed: 1.38, gold: 7, leak: 1, armor: 1, radius: 0.22 },
  swift: { name: "swift", hp: 26, speed: 2.3, gold: 5, leak: 1, armor: 1, radius: 0.15 },
  plate: { name: "plate", hp: 155, speed: 0.7, gold: 16, leak: 1, armor: 0.32, radius: 0.32 },
  wisp: { name: "wisp", hp: 16, speed: 1.8, gold: 4, leak: 1, armor: 1, radius: 0.13 },
  core: { name: "core", hp: 1100, speed: 0.46, gold: 80, leak: 6, armor: 0.55, radius: 0.5 },
};

export type WaveGroup = {
  kind: EnemyKind;
  count: number;
  interval: number;
  delay: number;
};

export const WAVES: WaveGroup[][] = [
  [{ kind: "runner", count: 8, interval: 1.2, delay: 0 }],
  [{ kind: "runner", count: 12, interval: 0.7, delay: 0 }],
  [
    { kind: "runner", count: 6, interval: 0.8, delay: 0 },
    { kind: "swift", count: 8, interval: 0.46, delay: 2.2 },
  ],
  [
    { kind: "plate", count: 5, interval: 1.35, delay: 0 },
    { kind: "runner", count: 6, interval: 0.65, delay: 1.2 },
  ],
  [{ kind: "swift", count: 16, interval: 0.34, delay: 0 }],
  [
    { kind: "plate", count: 6, interval: 1.05, delay: 0 },
    { kind: "swift", count: 6, interval: 0.45, delay: 2 },
  ],
  [
    { kind: "wisp", count: 14, interval: 0.34, delay: 0 },
    { kind: "runner", count: 5, interval: 0.65, delay: 1.4 },
  ],
  [
    { kind: "plate", count: 8, interval: 0.9, delay: 0 },
    { kind: "wisp", count: 14, interval: 0.3, delay: 2.4 },
  ],
  [
    { kind: "swift", count: 10, interval: 0.32, delay: 0 },
    { kind: "runner", count: 10, interval: 0.45, delay: 0.8 },
    { kind: "plate", count: 6, interval: 0.95, delay: 1.6 },
  ],
  [
    { kind: "wisp", count: 18, interval: 0.24, delay: 0 },
    { kind: "plate", count: 8, interval: 0.8, delay: 2 },
  ],
  [
    { kind: "runner", count: 10, interval: 0.4, delay: 0 },
    { kind: "swift", count: 12, interval: 0.3, delay: 1.6 },
    { kind: "plate", count: 8, interval: 0.72, delay: 2.2 },
  ],
  [
    { kind: "plate", count: 4, interval: 0.85, delay: 0 },
    { kind: "core", count: 1, interval: 1, delay: 2.4 },
    { kind: "swift", count: 10, interval: 0.34, delay: 5 },
    { kind: "wisp", count: 12, interval: 0.26, delay: 6.2 },
  ],
];

export function waveScale(waveIndex: number): number {
  return 1 + waveIndex * 0.06;
}

export function scaledHp(base: number, waveIndex: number): number {
  return Math.round(base * waveScale(waveIndex));
}

export function scaledSpeed(base: number, waveIndex: number): number {
  return base * (1 + waveIndex * 0.025);
}

export function scaledGold(base: number, waveIndex: number): number {
  return Math.round(base * (1 + waveIndex * 0.03));
}

export function rankDamage(kind: TowerKind, rank: number): number {
  return TOWERS[kind].damage * (1 + rank * 0.42);
}

export function rankRate(kind: TowerKind, rank: number): number {
  return TOWERS[kind].rate * (1 + rank * 0.28);
}

export function upgradeCost(baseCost: number, currentRank: number): number {
  return Math.round(baseCost * (0.65 + currentRank * 0.42));
}

export function describeWave(index: number): string {
  const wave = WAVES[index];
  if (!wave) return "";
  return wave
    .map((group) => {
      const name = ENEMIES[group.kind].name;
      const label = group.count === 1 ? name : `${name}s`;
      return `${group.count} ${label}`;
    })
    .join(" · ");
}

export function padWave(n: number): string {
  return String(n).padStart(2, "0");
}
