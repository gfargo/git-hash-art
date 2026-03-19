/**
 * Procedural shape generators — hash-derived shapes that are unique
 * per generation. Unlike the fixed shape library, these produce geometry
 * that doesn't repeat across hashes.
 *
 * All draw functions accept an RNG via the config parameter so the
 * shapes are deterministic from the hash.
 */

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config?: any,
) => void;

// ── Blob: organic closed curve via cubic bezier ─────────────────────
// Generates 5-9 control points around a circle with hash-derived
// radius jitter, then connects them with smooth cubic beziers.

export const drawBlob: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const numPoints = 5 + Math.floor(rng() * 5); // 5-9 lobes
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const jitter = 0.5 + rng() * 0.5; // radius varies 50-100%
    points.push({
      x: Math.cos(angle) * r * jitter,
      y: Math.sin(angle) * r * jitter,
    });
  }

  ctx.beginPath();
  // Start at midpoint between last and first point
  const last = points[points.length - 1];
  const first = points[0];
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);

  for (let i = 0; i < numPoints; i++) {
    const curr = points[i];
    const next = points[(i + 1) % numPoints];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
  }
  ctx.closePath();
};

// ── Ngon: irregular polygon with hash-controlled vertices ───────────
// Vertex count 3-12, each vertex has independent radius jitter
// producing irregular, organic polygons.

export const drawNgon: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const sides = 3 + Math.floor(rng() * 10); // 3-12 sides
  const jitterAmount = 0.1 + rng() * 0.4; // 10-50% vertex displacement

  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const radiusJitter = 1 - jitterAmount + rng() * jitterAmount * 2;
    const x = Math.cos(angle) * r * radiusJitter;
    const y = Math.sin(angle) * r * radiusJitter;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Lissajous: parametric curves with hash-derived frequency ratios ─
// Produces figure-8s, knots, and complex looping curves.

export const drawLissajous: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  // Frequency ratios — small integers produce recognizable patterns
  const freqA = 1 + Math.floor(rng() * 5); // 1-5
  const freqB = 1 + Math.floor(rng() * 5); // 1-5
  const phase = rng() * Math.PI; // phase offset
  const steps = 120;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.sin(freqA * t + phase) * r;
    const y = Math.sin(freqB * t) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Superellipse: |x|^n + |y|^n = 1 with hash-derived exponent ─────
// n=2 is circle, n>2 is squircle, n<1 is astroid/star-like.

export const drawSuperellipse: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  // Exponent range: 0.3 (spiky astroid) to 5 (rounded rectangle)
  const n = 0.3 + rng() * 4.7;
  const steps = 120;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    // Superellipse parametric form
    const x = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n) * r;
    const y = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Spirograph: hypotrochoid curves ─────────────────────────────────
// Inner/outer radius ratios from hash produce unique looping patterns.

export const drawSpirograph: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const scale = size / 2;
  // R = outer radius, r = inner radius, d = pen distance from inner center
  const R = 1;
  const r = 0.2 + rng() * 0.6; // 0.2-0.8
  const d = 0.3 + rng() * 0.7; // 0.3-1.0
  // Number of full rotations needed to close the curve
  const gcd = (a: number, b: number): number => {
    const ai = Math.round(a * 1000);
    const bi = Math.round(b * 1000);
    const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
    return g(ai, bi) / 1000;
  };
  const period = r / gcd(R, r);
  const maxT = Math.min(period, 10) * Math.PI * 2; // cap at 10 rotations
  const steps = Math.min(600, Math.floor(maxT * 20));

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * maxT;
    const x = ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)) * scale / (1 + d);
    const y = ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)) * scale / (1 + d);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Wave ring: concentric ring with sinusoidal displacement ─────────
// Hash controls frequency, amplitude, and number of rings.

export const drawWaveRing: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const rings = 2 + Math.floor(rng() * 4); // 2-5 rings
  const freq = 3 + Math.floor(rng() * 12); // 3-14 waves per ring
  const amp = 0.05 + rng() * 0.15; // 5-20% of radius

  ctx.beginPath();
  for (let ring = 0; ring < rings; ring++) {
    const baseR = r * (0.3 + (ring / rings) * 0.7);
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const wave = Math.sin(t * freq + ring * 1.5) * baseR * amp;
      const x = Math.cos(t) * (baseR + wave);
      const y = Math.sin(t) * (baseR + wave);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
};

// ── Rose curve: polar rose r = cos(k*theta) ────────────────────────
// k determines petal count. Integer k = k petals (odd) or 2k petals (even).

export const drawRose: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const k = 2 + Math.floor(rng() * 6); // 2-7 petal parameter
  const steps = 200;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2 * (k % 2 === 0 ? 1 : 2);
    const rr = Math.cos(k * theta) * r;
    const x = rr * Math.cos(theta);
    const y = rr * Math.sin(theta);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};


// ── Shape registry ──────────────────────────────────────────────────

export const proceduralShapes: Record<string, DrawFunction> = {
  blob: drawBlob,
  ngon: drawNgon,
  lissajous: drawLissajous,
  superellipse: drawSuperellipse,
  spirograph: drawSpirograph,
  waveRing: drawWaveRing,
  rose: drawRose,
};
