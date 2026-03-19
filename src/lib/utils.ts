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
