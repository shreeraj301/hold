import type { EnemyKind, TowerKind } from "./palette";
import type { TargetMode } from "./balance";

export type Phase = "menu" | "prep" | "wave" | "victory" | "defeat" | "ended";

export type Tower = {
  id: number;
  kind: TowerKind;
  c: number;
  r: number;
  x: number;
  y: number;
  aim: number;
  cooldown: number;
  recoil: number;
  pulse: number;
  dmgRank: number;
  rateRank: number;
  targeting: TargetMode;
  invested: number;
};

export type Enemy = {
  id: number;
  kind: EnemyKind;
  alive: boolean;
  x: number;
  y: number;
  ang: number;
  s: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  leak: number;
  armor: number;
  radius: number;
  slowMul: number;
  slowUntil: number;
  flash: number;
  born: number;
};

export type Shot = {
  alive: boolean;
  kind: TowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  splash: number;
  pierce: boolean;
  ttl: number;
  homing: boolean;
  targetId: number;
  destX: number;
  destY: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  square: boolean;
  ring?: boolean;
};

export type Floater = {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
};

export type Ghost = {
  x: number;
  y: number;
  ang: number;
  kind: EnemyKind;
};

export type SelectedInfo = {
  id: number;
  kind: TowerKind;
  damage: number;
  rate: number;
  dps: number;
  range: number;
  dmgRank: number;
  rateRank: number;
  dmgCost: number;
  rateCost: number;
  sell: number;
  invested: number;
  targeting: TargetMode;
};

export type Snapshot = {
  phase: Phase;
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  prepLeft: number;
  earlyBonus: number;
  placing: TowerKind | null;
  speed: 1 | 2;
  paused: boolean;
  sound: boolean;
  shake: boolean;
  selected: SelectedInfo | null;
  hint: string;
  score: number;
  bestScore: number;
  bestWave: number;
  kills: number;
  leaks: number;
  goldEarned: number;
  cleared: number;
  creepsLeft: number;
  spawned: number;
  spawnTotal: number;
  nextWave: string;
};
