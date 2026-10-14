/** Canvas twins of the tokens in src/styles.css. DOM chrome uses the CSS tokens. */
export type ThemeName = "dark" | "light";

export type Palette = {
  canvas: string;
  surface: string;
  raised: string;
  ink: string;
  muted: string;
  signal: string;
  line: string;
  magenta: string;
  violet: string;
  ember: string;
  coral: string;
  success: string;
  black: string;
  inkRgb: string;
  canvasRgb: string;
  signalRgb: string;
  magentaRgb: string;
  mutedRgb: string;
  coralRgb: string;
  shadowRgb: string;
};

export const darkPalette: Palette = {
  canvas: "#090909",
  surface: "#141414",
  raised: "#1c1c1c",
  ink: "#ffffff",
  muted: "#999999",
  signal: "#0099ff",
  line: "#262626",
  magenta: "#d44df0",
  violet: "#6a4cf5",
  ember: "#ff7a3d",
  coral: "#ff5577",
  success: "#22c55e",
  black: "#000000",
  inkRgb: "255,255,255",
  canvasRgb: "9,9,9",
  signalRgb: "0,153,255",
  magentaRgb: "212,77,240",
  mutedRgb: "153,153,153",
  coralRgb: "255,85,119",
  shadowRgb: "0,0,0",
};

export const lightPalette: Palette = {
  canvas: "#e7e0d2",
  surface: "#fbf7f0",
  raised: "#efe8db",
  ink: "#1a1714",
  muted: "#6f675e",
  signal: "#0074c7",
  line: "#d5cdbf",
  magenta: "#b423c8",
  violet: "#5a3ee0",
  ember: "#e25a1c",
  coral: "#e23b5a",
  success: "#17803d",
  black: "#1a1714",
  inkRgb: "26,23,20",
  canvasRgb: "231,224,210",
  signalRgb: "0,116,199",
  magentaRgb: "180,35,200",
  mutedRgb: "111,103,94",
  coralRgb: "226,59,90",
  shadowRgb: "26,23,20",
};

export const palette: Palette = { ...darkPalette };

export type TowerKind = "needle" | "lance" | "bloom" | "drift";
export type EnemyKind = "runner" | "swift" | "plate" | "wisp" | "core";

export const towerColor: Record<TowerKind, string> = {
  needle: palette.ink,
  lance: palette.violet,
  bloom: palette.ember,
  drift: palette.magenta,
};

export const enemyColor: Record<EnemyKind, string> = {
  runner: palette.ink,
  swift: palette.coral,
  plate: palette.muted,
  wisp: palette.violet,
  core: palette.magenta,
};

const THEME_KEY = "hold-theme";

export function readTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function paintRecords() {
  towerColor.needle = palette.ink;
  towerColor.lance = palette.violet;
  towerColor.bloom = palette.ember;
  towerColor.drift = palette.magenta;
  enemyColor.runner = palette.ink;
  enemyColor.swift = palette.coral;
  enemyColor.plate = palette.muted;
  enemyColor.wisp = palette.violet;
  enemyColor.core = palette.magenta;
}

export function applyTheme(theme: ThemeName, persist = false) {
  Object.assign(palette, theme === "light" ? lightPalette : darkPalette);
  paintRecords();
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", palette.canvas);
  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}
