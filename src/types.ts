/**
 * Draw function signature for custom shapes.
 * The function should build a canvas path (moveTo/lineTo/arc/etc.)
 * centered at the origin. The pipeline handles translate, rotate,
 * fill, and stroke — your function just defines the geometry.
 *
 * @param ctx  - Canvas 2D rendering context (already translated to shape center)
 * @param size - Bounding size in pixels
 * @param rng  - Deterministic RNG seeded from the git hash — use this instead of Math.random()
 */
export type CustomDrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
) => void;

/**
 * Definition for a user-provided custom shape.
 */
export interface CustomShapeDefinition {
  /** The draw function that builds the shape path */
  draw: CustomDrawFunction;
  /**
   * Optional shape profile for the affinity system.
   * Controls how the shape is selected and composed with others.
   * Sensible defaults are applied for any omitted fields.
   */
  profile?: {
    /** Visual quality tier: 1 = always good, 2 = usually good, 3 = situational (default: 2) */
    tier?: 1 | 2 | 3;
    /** Minimum size as fraction of maxShapeSize (default: 0.05) */
    minSizeFraction?: number;
    /** Maximum size as fraction of maxShapeSize (default: 1.0) */
    maxSizeFraction?: number;
    /** Names of shapes this composes well with (default: ["circle", "square"]) */
    affinities?: string[];
    /** Whether this shape works as a hero/focal element (default: false) */
    heroCandidate?: boolean;
    /** Best render styles (default: ["fill-and-stroke", "watercolor"]) */
    bestStyles?: string[];
  };
}

/**
 * Configuration options for image generation.
 */
export interface GenerationConfig {
  /** Canvas width in pixels (default: 2048) */
  width: number;
  /** Canvas height in pixels (default: 2048) */
  height: number;
  /** Controls base shape count per layer — gridSize² × 1.5 (default: 5) */
  gridSize: number;
  /** Number of layers to generate (default: 4) */
  layers: number;
  /** Minimum shape size in pixels, scaled to canvas (default: 30) */
  minShapeSize: number;
  /** Maximum shape size in pixels, scaled to canvas (default: 400) */
  maxShapeSize: number;
  /** Starting opacity for the first layer (default: 0.7) */
  baseOpacity: number;
  /** Opacity reduction per layer (default: 0.12) */
  opacityReduction: number;
  /** Base shapes per layer — defaults to gridSize² × 1.5 when 0 */
  shapesPerLayer: number;
  /**
   * Custom shapes to include in the generation.
   * Keys are shape names, values are CustomShapeDefinition objects.
   * Custom shapes are merged with built-in shapes and participate
   * in palette selection, affinity matching, and all render styles.
   */
  customShapes?: Record<string, CustomShapeDefinition>;
  /** Internal: collect per-phase timing data when set (not part of public API) */
  _debugTiming?: { phases: Record<string, number>; shapeCount: number; extraCount: number };
}

export const DEFAULT_CONFIG: GenerationConfig = {
  width: 2048,
  height: 2048,
  gridSize: 5,
  layers: 4,
  minShapeSize: 30,
  maxShapeSize: 400,
  baseOpacity: 0.7,
  opacityReduction: 0.12,
  shapesPerLayer: 0,
};
