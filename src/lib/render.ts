/**
 * Pure rendering logic — environment-agnostic.
 *
 * This module only uses the standard CanvasRenderingContext2D API,
 * so it works identically in Node (@napi-rs/canvas) and browsers
 * (HTMLCanvasElement).
 */
import { SacredColorScheme } from "./canvas/colors";
import { enhanceShapeGeneration } from "./canvas/draw";
import { shapes } from "./canvas/shapes";
import { createRng, seedFromHash } from "./utils";
import { DEFAULT_CONFIG, type GenerationConfig } from "../types";

/**
 * Render hash-derived art onto an existing CanvasRenderingContext2D.
 *
 * This is the environment-agnostic core — it never creates a canvas or
 * produces a buffer. Call it from Node or browser wrappers that supply
 * the context.
 *
 * @param ctx  - A 2D rendering context (browser or Node canvas)
 * @param gitHash - Hex hash string used as the deterministic seed
 * @param config  - Partial generation config (merged with defaults)
 */
export function renderHashArt(
  ctx: CanvasRenderingContext2D,
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): void {
  const finalConfig: GenerationConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    width,
    height,
    gridSize,
    layers,
    minShapeSize,
    maxShapeSize,
    baseOpacity,
    opacityReduction,
  } = finalConfig;

  finalConfig.shapesPerLayer =
    finalConfig.shapesPerLayer || Math.floor(gridSize * gridSize * 1.5);

  // --- Color scheme derived from hash ---
  const colorScheme = new SacredColorScheme(gitHash);
  const colors = colorScheme.getColors();
  const [bgStart, bgEnd] = colorScheme.getBackgroundColors();

  // --- Radial gradient background for depth ---
  const cx = width / 2;
  const cy = height / 2;
  const bgRadius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgRadius);
  gradient.addColorStop(0, bgStart);
  gradient.addColorStop(1, bgEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const shapeNames = Object.keys(shapes);
  const scaleFactor = Math.min(width, height) / 1024;
  const adjustedMinSize = minShapeSize * scaleFactor;
  const adjustedMaxSize = maxShapeSize * scaleFactor;

  // One master RNG seeded from the full hash — all randomness flows from here
  const rng = createRng(seedFromHash(gitHash));

  // Track shape positions for organic connecting curves later
  const shapePositions: Array<{ x: number; y: number }> = [];

  for (let layer = 0; layer < layers; layer++) {
    const numShapes =
      finalConfig.shapesPerLayer +
      Math.floor(rng() * finalConfig.shapesPerLayer * 0.3);

    // Layer opacity decays gently so all layers remain visible
    const layerOpacity = Math.max(0.15, baseOpacity - layer * opacityReduction);

    // Later layers use smaller shapes for depth
    const layerSizeScale = 1 - layer * 0.15;

    for (let i = 0; i < numShapes; i++) {
      const x = rng() * width;
      const y = rng() * height;

      const shapeIdx = Math.floor(rng() * shapeNames.length);
      const shape = shapeNames[shapeIdx];

      // Shape size follows a power distribution — many small, few large
      const sizeT = Math.pow(rng(), 1.8);
      const size =
        (adjustedMinSize + sizeT * (adjustedMaxSize - adjustedMinSize)) *
        layerSizeScale;

      const rotation = rng() * 360;

      const fillColor = colors[Math.floor(rng() * colors.length)];
      const strokeColor = colors[Math.floor(rng() * colors.length)];

      const strokeWidth = (0.5 + rng() * 2.0) * scaleFactor;

      ctx.globalAlpha = layerOpacity * (0.5 + rng() * 0.5);

      enhanceShapeGeneration(ctx, shape, x, y, {
        fillColor,
        strokeColor,
        strokeWidth,
        size,
        rotation,
        proportionType: "GOLDEN_RATIO",
      });

      shapePositions.push({ x, y });
    }
  }

  // --- Organic connecting curves between nearby shapes ---
  if (shapePositions.length > 1) {
    const numCurves = Math.floor((8 * (width * height)) / (1024 * 1024));
    ctx.lineWidth = 0.8 * scaleFactor;

    for (let i = 0; i < numCurves; i++) {
      const idxA = Math.floor(rng() * shapePositions.length);
      const offset =
        1 + Math.floor(rng() * Math.min(5, shapePositions.length - 1));
      const idxB = (idxA + offset) % shapePositions.length;

      const a = shapePositions[idxA];
      const b = shapePositions[idxB];

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const bulge = (rng() - 0.5) * dist * 0.4;

      const cpx = mx + (-dy / (dist || 1)) * bulge;
      const cpy = my + (dx / (dist || 1)) * bulge;

      ctx.globalAlpha = 0.08 + rng() * 0.12;
      ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}
