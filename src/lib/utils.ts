import { shapes } from "./canvas/shapes";

export function gitHashToSeed(gitHash: string): number {
  return parseInt(gitHash.slice(0, 8), 16);
}

export function getRandomFromHash(
  hash: string,
  index: number,
  min: number,
  max: number,
): number {
  const hexPair = hash.substr((index * 2) % hash.length, 2);
  const decimal = parseInt(hexPair, 16);
  return min + (decimal / 255) * (max - min);
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
  config: any; // You might want to define a more specific type for config
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
