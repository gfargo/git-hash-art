/**
 * Noise-field organic silhouettes — freeform shapes contoured out of
 * layered simplex noise via marching squares.
 *
 * Unlike every other entry in the shape registry, these have no fixed
 * silhouette: the form is an iso-contour of a hash-seeded noise field,
 * so every draw produces a genuinely novel organic outline (islands,
 * cells, puddles — sometimes with satellite islets) rather than a
 * parameterized variation of a known figure.
 */
import { createSimplexNoise, createFBM } from "../../utils";

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config?: { rng?: () => number },
) => void;

interface Pt {
  x: number;
  y: number;
}

/**
 * Sample a radially-attenuated FBM field on an (N+1)×(N+1) grid.
 * Positive inside the form, strictly negative at the grid boundary so
 * every contour is guaranteed to close within the cell lattice.
 */
function sampleField(rng: () => number, N: number, size: number): number[][] {
  const noise = createSimplexNoise(rng);
  // Single octave — at contour-grid resolution the second octave's
  // detail is invisible but doubles the sampling cost
  const fbm = createFBM(noise, 1, 2.0, 0.5);
  const R = size / 2;
  const cell = size / N;
  const freq = 1.4 + rng() * 1.8;
  const phase = rng() * 10;
  const field: number[][] = [];
  for (let j = 0; j <= N; j++) {
    const row: number[] = [];
    const y = -R + j * cell;
    for (let i = 0; i <= N; i++) {
      const x = -R + i * cell;
      const r = Math.hypot(x, y) / R;
      row.push(
        fbm((x / size) * freq + phase, (y / size) * freq + phase) * 0.75 +
          1.05 -
          r * 1.9,
      );
    }
    field.push(row);
  }
  return field;
}

/**
 * Marching squares: trace closed iso-contour loops of `field` at the
 * given iso level. Returns loops in canvas coordinates centered on 0,0.
 */
function traceContours(
  field: number[][],
  N: number,
  size: number,
  iso: number,
): Pt[][] {
  const cell = size / N;
  const R = size / 2;

  // Edge keys: horizontal edge between grid nodes (i,j)-(i+1,j) → "h,i,j"
  // vertical edge between (i,j)-(i,j+1) → "v,i,j".
  const points = new Map<string, Pt>();
  const adjacency = new Map<string, string[]>();

  const edgePoint = (key: string): Pt => points.get(key)!;

  function interp(
    key: string,
    x0: number,
    y0: number,
    v0: number,
    x1: number,
    y1: number,
    v1: number,
  ): void {
    if (points.has(key)) return;
    const t = (iso - v0) / (v1 - v0 || 1e-9);
    points.set(key, { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
  }

  function link(a: string, b: string): void {
    const la = adjacency.get(a);
    if (la) la.push(b);
    else adjacency.set(a, [b]);
    const lb = adjacency.get(b);
    if (lb) lb.push(a);
    else adjacency.set(b, [a]);
  }

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = -R + i * cell;
      const y0 = -R + j * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      const tl = field[j][i];
      const tr = field[j][i + 1];
      const br = field[j + 1][i + 1];
      const bl = field[j + 1][i];

      const caseIdx =
        (tl > iso ? 8 : 0) |
        (tr > iso ? 4 : 0) |
        (br > iso ? 2 : 0) |
        (bl > iso ? 1 : 0);
      if (caseIdx === 0 || caseIdx === 15) continue;

      const top = `h,${i},${j}`;
      const bottom = `h,${i},${j + 1}`;
      const left = `v,${i},${j}`;
      const right = `v,${i + 1},${j}`;

      // Lazily create the crossing point for each edge we might touch
      const touch = (key: string): string => {
        if (!points.has(key)) {
          if (key === top) interp(key, x0, y0, tl, x1, y0, tr);
          else if (key === bottom) interp(key, x0, y1, bl, x1, y1, br);
          else if (key === left) interp(key, x0, y0, tl, x0, y1, bl);
          else interp(key, x1, y0, tr, x1, y1, br);
        }
        return key;
      };

      // Segment table (pairs of edges the contour connects per case)
      let segs: Array<[string, string]>;
      switch (caseIdx) {
        case 1:
        case 14:
          segs = [[left, bottom]];
          break;
        case 2:
        case 13:
          segs = [[bottom, right]];
          break;
        case 3:
        case 12:
          segs = [[left, right]];
          break;
        case 4:
        case 11:
          segs = [[top, right]];
          break;
        case 6:
        case 9:
          segs = [[top, bottom]];
          break;
        case 7:
        case 8:
          segs = [[left, top]];
          break;
        case 5: {
          // Saddle — resolve with the cell-center sample
          const center = (tl + tr + br + bl) / 4;
          segs =
            center > iso
              ? [
                  [left, top],
                  [bottom, right],
                ]
              : [
                  [left, bottom],
                  [top, right],
                ];
          break;
        }
        case 10: {
          const center = (tl + tr + br + bl) / 4;
          segs =
            center > iso
              ? [
                  [top, right],
                  [left, bottom],
                ]
              : [
                  [left, top],
                  [bottom, right],
                ];
          break;
        }
        default:
          continue;
      }
      for (const [a, b] of segs) link(touch(a), touch(b));
    }
  }

  // Walk the adjacency graph into closed loops
  const visited = new Set<string>();
  const loops: Pt[][] = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop: Pt[] = [];
    let current = start;
    let previous: string | null = null;
    while (true) {
      visited.add(current);
      loop.push(edgePoint(current));
      const nexts = adjacency.get(current) ?? [];
      let next: string | null = null;
      for (const n of nexts) {
        if (n !== previous && !visited.has(n)) {
          next = n;
          break;
        }
      }
      if (next === null) break;
      previous = current;
      current = next;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/** Append smoothed closed loops to the current path. */
function pathLoops(ctx: CanvasRenderingContext2D, loops: Pt[][]): void {
  for (const loop of loops) {
    const n = loop.length;
    const mid = (a: Pt, b: Pt): Pt => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });
    let m = mid(loop[0], loop[1]);
    ctx.moveTo(m.x, m.y);
    for (let i = 1; i <= n; i++) {
      const p = loop[i % n];
      const next = loop[(i + 1) % n];
      m = mid(p, next);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    }
    ctx.closePath();
  }
}

/** Fallback if tracing produced nothing: a radial-noise blob. */
function fallbackBlob(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
): void {
  const R = size / 2;
  const steps = 32;
  const wobble = 0.25 + rng() * 0.2;
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = R * (0.75 + Math.sin(a * 3 + phase) * wobble * 0.5);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * noiseForm — a single freeform organic silhouette (iso 0 of the field).
 * Occasionally produces satellite islets around the main mass, which is
 * exactly the kind of accident that makes it feel hand-made.
 */
export const drawNoiseForm: DrawFunction = (ctx, size, config) => {
  const rng = config?.rng ?? Math.random;
  const N = 14;
  const field = sampleField(rng, N, size);
  const loops = traceContours(field, N, size, 0);
  ctx.beginPath();
  if (loops.length === 0) fallbackBlob(ctx, size, rng);
  else pathLoops(ctx, loops);
};

/**
 * contourField — the same organic field rendered as nested topographic
 * rings. Inner iso levels are self-stroked (inheriting the caller's
 * stroke state, like the complex shapes); the outermost level is left
 * as the active path for the render-style system to fill/stroke.
 */
export const drawContourField: DrawFunction = (ctx, size, config) => {
  const rng = config?.rng ?? Math.random;
  const N = 14;
  const field = sampleField(rng, N, size);

  // Inner topo rings at rising iso levels — finer, quieter lines
  const savedWidth = ctx.lineWidth;
  const savedAlpha = ctx.globalAlpha;
  ctx.lineWidth = Math.max(0.4, savedWidth * 0.5);
  ctx.globalAlpha = savedAlpha * 0.55;
  for (const iso of [0.3, 0.65]) {
    const rings = traceContours(field, N, size, iso);
    if (rings.length === 0) continue;
    ctx.beginPath();
    pathLoops(ctx, rings);
    ctx.stroke();
  }
  ctx.lineWidth = savedWidth;
  ctx.globalAlpha = savedAlpha;

  // Outermost silhouette for the style system
  const outer = traceContours(field, N, size, 0);
  ctx.beginPath();
  if (outer.length === 0) fallbackBlob(ctx, size, rng);
  else pathLoops(ctx, outer);
};

export const organicShapes: Record<string, DrawFunction> = {
  noiseForm: drawNoiseForm,
  contourField: drawContourField,
};
