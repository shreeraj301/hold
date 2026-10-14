import { create } from "zustand";
import { EARLY_BONUS, PREP_FIRST, START_GOLD, START_LIVES, WAVES, describeWave } from "./balance";
import type { Snapshot } from "./types";

export const initialSnapshot: Snapshot = {
  phase: "menu",
  gold: START_GOLD,
  lives: START_LIVES,
  wave: 1,
  totalWaves: WAVES.length,
  prepLeft: PREP_FIRST,
  earlyBonus: EARLY_BONUS,
  placing: null,
  speed: 1,
  paused: false,
  sound: true,
  shake: true,
  selected: null,
  hint: "Twelve waves. The slot at the end is the only way through.",
  score: 0,
  bestScore: 0,
  bestWave: 0,
  kills: 0,
  leaks: 0,
  goldEarned: 0,
  cleared: 0,
  creepsLeft: 0,
  spawned: 0,
  spawnTotal: 0,
  nextWave: describeWave(0),
};

export const useHold = create<Snapshot>(() => initialSnapshot);

export function publish(snapshot: Snapshot) {
  useHold.setState(snapshot);
}
