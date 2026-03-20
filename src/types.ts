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
