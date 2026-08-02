/**
 * Strange-attractor density fields.
 *
 * Every other mark in this library is a *stamp*: a shape from a fixed
 * vocabulary, placed at a position the composition system chose. That is
 * what makes a weak silhouette legible and what caps how complex an image
 * can get — complexity has to be assembled from parts someone drew.
 *
 * An attractor produces form the opposite way. Iterating a two-line map
 * hundreds of thousands of times and accumulating where the orbit lands
 * yields filigree nobody authored: no silhouette to critique, structure
 * far finer than anything the shape layer can build, and an entire family
 * of forms from four numbers.
 *
 * Used here as a *substrate* rather than a subject — it underlays the
 * shape layers and biases where they land, so images keep the project's
 * layered character instead of becoming generic attractor art.
 */

export interface AttractorField {
  /** Density per cell, normalised to 0..1 against the field maximum. */
  density: Float32Array;
  width: number;
  height: number;
  /** Fraction of cells the orbit touched — a proxy for how much it fills. */
  coverage: number;
  name: string;
}

type Step = (x: number, y: number) => [number, number];

const MAPS: Record<
  string,
  (a: number, b: number, c: number, d: number) => Step
> = {
  dejong: (a, b, c, d) => (x, y) => [
    Math.sin(a * y) - Math.cos(b * x),
    Math.sin(c * x) - Math.cos(d * y),
  ],
  clifford: (a, b, c, d) => (x, y) => [
    Math.sin(a * y) + c * Math.cos(a * x),
    Math.sin(b * x) + d * Math.cos(b * y),
  ],
  svensson: (a, b, c, d) => (x, y) => [
    d * Math.sin(a * x) - Math.sin(b * y),
    c * Math.cos(a * x) + Math.cos(b * y),
  ],
};

const MAP_NAMES = Object.keys(MAPS);

/**
 * Iterate a hash-seeded attractor into a density grid.
 *
 * Returns null when the orbit degenerates — most parameter draws collapse
 * to a point, a hairline, or diverge, and those are worse than no
 * substrate at all. Callers are expected to fall back rather than retry,
 * so the RNG stream stays predictable.
 *
 * `zoom` > 1 crops into the orbit so it bleeds past the frame instead of
 * sitting centred in it — the standalone form is always a floating object,
 * which is exactly the centred-blob silhouette the composition system
 * spends its effort avoiding.
 */
export function computeAttractorField(
  rng: () => number,
  width: number,
  height: number,
  iterations: number,
): AttractorField | null {
  const name = MAP_NAMES[Math.floor(rng() * MAP_NAMES.length)];
  const p = () => -3 + rng() * 6;
  const step = MAPS[name](p(), p(), p(), p());

  // Probe pass: find the orbit's extent before committing to a mapping.
  let x = 0.1;
  let y = 0.1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 12000; i++) {
    const next = step(x, y);
    x = next[0];
    y = next[1];
    if (!isFinite(x) || !isFinite(y)) return null;
    if (i > 400) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (!(spanX > 1e-3 && spanY > 1e-3)) return null;

  const zoom = 1 + rng() * 0.9;
  const scale = Math.min(width / spanX, height / spanY) * 0.94 * zoom;
  // Off-centre so the crop is a composition decision, not a centring.
  const driftX = (rng() - 0.5) * width * 0.3 * (zoom - 1);
  const driftY = (rng() - 0.5) * height * 0.3 * (zoom - 1);
  const offX = (width - spanX * scale) / 2 - minX * scale + driftX;
  const offY = (height - spanY * scale) / 2 - minY * scale + driftY;

  const density = new Float32Array(width * height);
  x = 0.1;
  y = 0.1;
  let maxD = 0;
  let occupied = 0;
  for (let i = 0; i < iterations; i++) {
    const next = step(x, y);
    x = next[0];
    y = next[1];
    if (i < 400) continue;
    const px = (x * scale + offX) | 0;
    const py = (y * scale + offY) | 0;
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const k = py * width + px;
    if (density[k] === 0) occupied++;
    const v = ++density[k];
    if (v > maxD) maxD = v;
  }

  const coverage = occupied / (width * height);
  // A bare max-density check passes both a collapsed point and a hairline.
  // Require the trace to occupy real area and not pile into a few cells.
  if (coverage < 0.03 || maxD < 8) return null;
  if (maxD > iterations * 0.02) return null;

  // Normalise logarithmically: linear normalisation crushes everything but
  // the densest spines, losing the thin outer veils that carry the detail.
  const inv = 1 / Math.log(1 + maxD);
  for (let i = 0; i < density.length; i++) {
    if (density[i] > 0) density[i] = Math.log(1 + density[i]) * inv;
  }

  return { density, width, height, coverage, name };
}

/** Sample the field in canvas coordinates, 0..1. */
export function sampleField(
  field: AttractorField,
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
): number {
  const fx = Math.min(
    field.width - 1,
    Math.max(0, ((x / canvasW) * field.width) | 0),
  );
  const fy = Math.min(
    field.height - 1,
    Math.max(0, ((y / canvasH) * field.height) | 0),
  );
  return field.density[fy * field.width + fx];
}

/**
 * Paint a density field as banded, batched fills.
 *
 * Deliberately avoids `putImageData` and any off-screen canvas: this
 * renderer only ever touches the standard 2D context so it runs unchanged
 * in Node and the browser, and `putImageData` would also bypass
 * `globalAlpha` and the layer blend mode, which is precisely how the
 * substrate is meant to sit under everything else.
 *
 * Cells are grouped into a handful of density bands and each band is
 * emitted as ONE path. Occupied cells are typically 5-20% of the grid, so
 * this is a few thousand rects across four or five fill calls rather than
 * a per-pixel loop.
 */
export function paintAttractorField(
  ctx: CanvasRenderingContext2D,
  field: AttractorField,
  canvasW: number,
  canvasH: number,
  bands: Array<{ min: number; max: number; fill: string; alpha: number }>,
): void {
  const cellW = canvasW / field.width;
  const cellH = canvasH / field.height;
  // Overdraw each cell slightly so bands read as continuous filigree
  // rather than a visible grid of tiles.
  const w = cellW * 1.35;
  const h = cellH * 1.35;

  for (const band of bands) {
    ctx.globalAlpha = band.alpha;
    ctx.fillStyle = band.fill;
    ctx.beginPath();
    let any = false;
    for (let fy = 0; fy < field.height; fy++) {
      const rowBase = fy * field.width;
      const py = fy * cellH;
      for (let fx = 0; fx < field.width; fx++) {
        const d = field.density[rowBase + fx];
        if (d < band.min || d >= band.max) continue;
        ctx.rect(fx * cellW, py, w, h);
        any = true;
      }
    }
    if (any) ctx.fill();
  }
  ctx.globalAlpha = 1;
}
