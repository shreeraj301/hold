export type Cell = { c: number; r: number };

export type PathGeom = {
  cells: Cell[];
  pts: { x: number; y: number }[];
  segLen: number[];
  cum: number[];
  total: number;
  set: Set<string>;
};

function pushLine(into: Cell[], c0: number, r0: number, c1: number, r1: number, skipStart: boolean) {
  const dc = Math.sign(c1 - c0);
  const dr = Math.sign(r1 - r0);
  let c = c0;
  let r = r0;
  if (!skipStart) into.push({ c, r });
  while (c !== c1 || r !== r1) {
    c += dc;
    r += dr;
    into.push({ c, r });
  }
}

export function makePath(): PathGeom {
  const cells: Cell[] = [];
  const lines: [number, number, number, number][] = [
    [0, 1, 12, 1],
    [12, 1, 12, 4],
    [12, 4, 3, 4],
    [3, 4, 3, 7],
    [3, 7, 15, 7],
  ];
  lines.forEach(([c0, r0, c1, r1], i) => pushLine(cells, c0, r0, c1, r1, i > 0));
  const pts = cells.map((cell) => ({ x: cell.c + 0.5, y: cell.r + 0.5 }));
  const segLen: number[] = [];
  const cum: number[] = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLen.push(len);
    cum.push(cum[i] + len);
  }
  return {
    cells,
    pts,
    segLen,
    cum,
    total: cum[cum.length - 1] ?? 0,
    set: new Set(cells.map((cell) => `${cell.c},${cell.r}`)),
  };
}

export function samplePath(path: PathGeom, dist: number): { x: number; y: number; ang: number } {
  const d = Math.max(0, Math.min(path.total - 1e-4, dist));
  let i = 0;
  const last = path.segLen.length - 1;
  while (i < last && path.cum[i + 1] < d) i++;
  const len = path.segLen[i] || 1;
  const u = (d - path.cum[i]) / len;
  const a = path.pts[i];
  const b = path.pts[i + 1] ?? a;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { x: a.x + dx * u, y: a.y + dy * u, ang: Math.atan2(dy, dx) };
}

export function aimAtPath(path: PathGeom, x: number, y: number): number {
  let best = Infinity;
  let ang = 0;
  const step = 0.5;
  for (let s = 0; s <= path.total; s += step) {
    const p = samplePath(path, Math.min(s, path.total - 1e-4));
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) {
      best = d;
      ang = Math.atan2(p.y - y, p.x - x);
    }
  }
  return ang;
}

export function cellKey(c: number, r: number): string {
  return `${c},${r}`;
}
