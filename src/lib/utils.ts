export function gitHashToSeed(gitHash: string): number {
  return parseInt(gitHash.slice(0, 8), 16);
}

/**
 * Mulberry32 — a fast, high-quality 32-bit seeded PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a deterministic seed from a hash string and an extra index
 * so each call-site gets its own independent stream.
 */
export function seedFromHash(hash: string, offset = 0): number {
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = (Math.imul(31, h) + hash.charCodeAt(i)) | 0;
  }
  return (h + offset) | 0;
}

/**
 * Legacy helper kept for backward compat — now backed by mulberry32.
 * Prefer createRng() + rng() for new code.
 */
export function getRandomFromHash(
  hash: string,
  index: number,
  min: number,
  max: number,
): number {
  const rng = createRng(seedFromHash(hash, index));
  return min + rng() * (max - min);
}

// Golden ratio and other important proportions
export const Proportions = {
  GOLDEN_RATIO: 1.618034,
  SQUARE_ROOT_2: Math.sqrt(2),
  SQUARE_ROOT_3: Math.sqrt(3),
  SQUARE_ROOT_5: Math.sqrt(5),
  PI: Math.PI,
  PHI: (1 + Math.sqrt(5)) / 2,
};

export type ProportionType = keyof typeof Proportions;

// ── Deterministic 2D Simplex Noise ──────────────────────────────────
// A compact implementation seeded from the RNG so every hash produces
// a unique noise field without external dependencies.

/**
 * Create a seeded 2D simplex noise function.
 * Returns noise(x, y) → float in approximately [-1, 1].
 */
export function createSimplexNoise(rng: () => number): (x: number, y: number) => number {
  // Build a deterministic permutation table (256 entries, doubled)
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with our seeded RNG
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  // 12 gradient vectors for 2D simplex
  const GRAD2 = [
    [1,1],[-1,1],[1,-1],[-1,-1],
    [1,0],[-1,0],[0,1],[0,-1],
    [1,1],[-1,1],[1,-1],[-1,-1],
  ];

  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  function dot2(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  return function noise2D(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = perm[ii + perm[jj]] % 12;
      n0 = t0 * t0 * dot2(GRAD2[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
      n1 = t1 * t1 * dot2(GRAD2[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
      n2 = t2 * t2 * dot2(GRAD2[gi2], x2, y2);
    }

    // Scale to approximately [-1, 1]
    return 70 * (n0 + n1 + n2);
  };
}

/**
 * Fractal Brownian Motion — layer multiple octaves of noise for richer fields.
 * Returns a function (x, y) → float in approximately [-1, 1].
 */
export function createFBM(
  noise: (x: number, y: number) => number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5,
): (x: number, y: number) => number {
  return function fbm(x: number, y: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      value += noise(x * frequency, y * frequency) * amplitude;
      maxAmp += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxAmp;
  };
}

interface Pattern {
  type: string;
  config: any;
}

interface LayerConfig {
  baseSize: number;
  baseOpacity?: number;
  opacityReduction?: number;
  rotationOffset?: number;
  proportionType?: ProportionType;
}

// Pattern combination utilities
export class PatternCombiner {
  static getProportionalSize(baseSize: number, proportion: number): number {
    return baseSize * proportion;
  }

  static centerPattern(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    ctx.translate(width / 2, height / 2);
  }

  // Combines sacred geometry patterns with proper proportions
  static layerPatterns(
    ctx: CanvasRenderingContext2D,
    patterns: Pattern[],
    config: LayerConfig,
  ): void {
    const {
      baseSize,
      baseOpacity = 0.6,
      opacityReduction = 0.1,
      rotationOffset = 0,
      proportionType = "GOLDEN_RATIO",
    } = config;

    patterns.forEach((pattern, index) => {
      const size = this.getProportionalSize(
        baseSize,
        Math.pow(Proportions[proportionType], index),
      );
      const opacity = Math.max(0.1, baseOpacity - index * opacityReduction);
      const rotation = rotationOffset * index;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.rotate((rotation * Math.PI) / 180);

      shapes[pattern.type](ctx, size, pattern.config);
      ctx.restore();
    });
  }
}
