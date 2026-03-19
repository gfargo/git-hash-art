/**
 * Pure rendering logic — environment-agnostic.
 *
 * Uses only the standard CanvasRenderingContext2D API so it works
 * identically in Node (@napi-rs/canvas) and browsers.
 *
 * Generation pipeline:
 *   1. Background — radial gradient from hash-derived dark palette
 *   2. Composition mode — hash selects: radial, flow-field, spiral, grid-subdivision, or clustered
 *   3. Color field — smooth positional color blending across the canvas
 *   4. Shape layers — weighted selection, focal-point placement, transparency, glow, gradients, jitter
 *   5. Recursive nesting — some shapes contain smaller shapes inside
 *   6. Flow-line pass — bezier curves following a hash-derived vector field
 *   7. Noise texture overlay — subtle grain for organic feel
 *   8. Organic connecting curves — beziers between nearby shapes
 */
import { SacredColorScheme, hexWithAlpha, jitterColor } from "./canvas/colors";
import { enhanceShapeGeneration } from "./canvas/draw";
import { shapes } from "./canvas/shapes";
import { createRng, seedFromHash } from "./utils";
import { DEFAULT_CONFIG, type GenerationConfig } from "../types";

// ── Shape categories for weighted selection ─────────────────────────

const BASIC_SHAPES = [
  "circle",
  "square",
  "triangle",
  "hexagon",
  "diamond",
  "cube",
];
const COMPLEX_SHAPES = [
  "star",
  "jacked-star",
  "heart",
  "platonicSolid",
  "fibonacciSpiral",
  "islamicPattern",
  "celticKnot",
  "merkaba",
  "fractal",
];
const SACRED_SHAPES = [
  "mandala",
  "flowerOfLife",
  "treeOfLife",
  "metatronsCube",
  "sriYantra",
  "seedOfLife",
  "vesicaPiscis",
  "torus",
  "eggOfLife",
];

// ── Composition modes ───────────────────────────────────────────────

type CompositionMode =
  | "radial"
  | "flow-field"
  | "spiral"
  | "grid-subdivision"
  | "clustered";

const COMPOSITION_MODES: CompositionMode[] = [
  "radial",
  "flow-field",
  "spiral",
  "grid-subdivision",
  "clustered",
];

// ── Helper: pick shape with layer-aware weighting ───────────────────

function pickShape(
  rng: () => number,
  layerRatio: number,
  shapeNames: string[],
): string {
  const basicW = 1 - layerRatio * 0.6;
  const complexW = 0.3 + layerRatio * 0.3;
  const sacredW = 0.1 + layerRatio * 0.4;
  const total = basicW + complexW + sacredW;
  const roll = rng() * total;

  let pool: string[];
  if (roll < basicW) pool = BASIC_SHAPES;
  else if (roll < basicW + complexW) pool = COMPLEX_SHAPES;
  else pool = SACRED_SHAPES;

  const available = pool.filter((s) => shapeNames.includes(s));
  if (available.length === 0) {
    return shapeNames[Math.floor(rng() * shapeNames.length)];
  }
  return available[Math.floor(rng() * available.length)];
}

// ── Helper: simple 2D value noise (hash-seeded) ─────────────────────

function valueNoise(
  x: number,
  y: number,
  scale: number,
  rng: () => number,
): number {
  // Cheap pseudo-noise: combine sin waves at different frequencies
  const nx = x / scale;
  const ny = y / scale;
  return (
    (Math.sin(nx * 1.7 + ny * 2.3 + rng() * 0.001) * 0.5 +
      Math.sin(nx * 3.1 - ny * 1.9 + rng() * 0.001) * 0.3 +
      Math.sin(nx * 5.3 + ny * 4.7 + rng() * 0.001) * 0.2) *
      0.5 +
    0.5
  );
}

// ── Helper: get position based on composition mode ──────────────────

function getCompositionPosition(
  mode: CompositionMode,
  rng: () => number,
  width: number,
  height: number,
  shapeIndex: number,
  totalShapes: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  switch (mode) {
    case "radial": {
      const angle = rng() * Math.PI * 2;
      const maxR = Math.min(width, height) * 0.45;
      const r = Math.pow(rng(), 0.7) * maxR;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }
    case "spiral": {
      const t = shapeIndex / totalShapes;
      const turns = 3 + rng() * 2;
      const angle = t * Math.PI * 2 * turns;
      const maxR = Math.min(width, height) * 0.42;
      const r = t * maxR + (rng() - 0.5) * maxR * 0.15;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }
    case "grid-subdivision": {
      const cells = 3 + Math.floor(rng() * 3);
      const cellW = width / cells;
      const cellH = height / cells;
      const gx = Math.floor(rng() * cells);
      const gy = Math.floor(rng() * cells);
      return {
        x: gx * cellW + rng() * cellW,
        y: gy * cellH + rng() * cellH,
      };
    }
    case "clustered": {
      // Pick one of 3-5 cluster centers, then scatter around it
      const numClusters = 3 + Math.floor(rng() * 3);
      const ci = Math.floor(rng() * numClusters);
      // Deterministic cluster center from index
      const clusterRng = createRng(seedFromHash(String(ci), 999));
      const clx = width * (0.15 + clusterRng() * 0.7);
      const cly = height * (0.15 + clusterRng() * 0.7);
      const spread = Math.min(width, height) * 0.18;
      return {
        x: clx + (rng() - 0.5) * spread * 2,
        y: cly + (rng() - 0.5) * spread * 2,
      };
    }
    case "flow-field":
    default: {
      // Random position, will be adjusted by flow field direction later
      return { x: rng() * width, y: rng() * height };
    }
  }
}

// ── Helper: positional color blending ───────────────────────────────

function getPositionalColor(
  x: number,
  y: number,
  width: number,
  height: number,
  colors: string[],
  rng: () => number,
): string {
  // Blend between palette colors based on position
  const nx = x / width;
  const ny = y / height;
  // Use position to bias which palette color is chosen
  const posIndex = (nx * 0.6 + ny * 0.4) * (colors.length - 1);
  const baseIdx = Math.floor(posIndex) % colors.length;
  // Then jitter it slightly
  return jitterColor(colors[baseIdx], rng, 0.08);
}

// ── Main render function ────────────────────────────────────────────

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

  const colorScheme = new SacredColorScheme(gitHash);
  const colors = colorScheme.getColors();
  const [bgStart, bgEnd] = colorScheme.getBackgroundColors();

  const shapeNames = Object.keys(shapes);
  const scaleFactor = Math.min(width, height) / 1024;
  const adjustedMinSize = minShapeSize * scaleFactor;
  const adjustedMaxSize = maxShapeSize * scaleFactor;

  const rng = createRng(seedFromHash(gitHash));
  const cx = width / 2;
  const cy = height / 2;

  // ── 1. Background ──────────────────────────────────────────────
  const bgRadius = Math.hypot(cx, cy);
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgRadius);
  bgGrad.addColorStop(0, bgStart);
  bgGrad.addColorStop(1, bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // ── 2. Composition mode ────────────────────────────────────────
  const compositionMode =
    COMPOSITION_MODES[Math.floor(rng() * COMPOSITION_MODES.length)];

  // ── 3. Focal points ────────────────────────────────────────────
  const numFocal = 1 + Math.floor(rng() * 2);
  const focalPoints: Array<{ x: number; y: number; strength: number }> = [];
  for (let f = 0; f < numFocal; f++) {
    focalPoints.push({
      x: width * (0.2 + rng() * 0.6),
      y: height * (0.2 + rng() * 0.6),
      strength: 0.3 + rng() * 0.4,
    });
  }

  function applyFocalBias(rx: number, ry: number): [number, number] {
    let nearest = focalPoints[0];
    let minDist = Infinity;
    for (const fp of focalPoints) {
      const d = Math.hypot(rx - fp.x, ry - fp.y);
      if (d < minDist) {
        minDist = d;
        nearest = fp;
      }
    }
    const pull = nearest.strength * rng() * 0.5;
    return [rx + (nearest.x - rx) * pull, ry + (nearest.y - ry) * pull];
  }

  // ── 4. Flow field seed values (for flow-field mode & line pass) ─
  const fieldAngleBase = rng() * Math.PI * 2;
  const fieldFreq = 0.5 + rng() * 2;

  function flowAngle(x: number, y: number): number {
    return (
      fieldAngleBase +
      Math.sin((x / width) * fieldFreq * Math.PI * 2) * Math.PI * 0.5 +
      Math.cos((y / height) * fieldFreq * Math.PI * 2) * Math.PI * 0.5
    );
  }

  // ── 5. Shape layers ────────────────────────────────────────────
  const shapePositions: Array<{ x: number; y: number; size: number }> = [];

  for (let layer = 0; layer < layers; layer++) {
    const layerRatio = layers > 1 ? layer / (layers - 1) : 0;
    const numShapes =
      finalConfig.shapesPerLayer +
      Math.floor(rng() * finalConfig.shapesPerLayer * 0.3);
    const layerOpacity = Math.max(0.15, baseOpacity - layer * opacityReduction);
    const layerSizeScale = 1 - layer * 0.15;

    for (let i = 0; i < numShapes; i++) {
      // Position from composition mode, then focal bias
      const rawPos = getCompositionPosition(
        compositionMode,
        rng,
        width,
        height,
        i,
        numShapes,
        cx,
        cy,
      );
      const [x, y] = applyFocalBias(rawPos.x, rawPos.y);

      // Weighted shape selection
      const shape = pickShape(rng, layerRatio, shapeNames);

      // Power distribution for size
      const sizeT = Math.pow(rng(), 1.8);
      const size =
        (adjustedMinSize + sizeT * (adjustedMaxSize - adjustedMinSize)) *
        layerSizeScale;

      // Flow-field rotation in flow-field mode, random otherwise
      const rotation =
        compositionMode === "flow-field"
          ? (flowAngle(x, y) * 180) / Math.PI + (rng() - 0.5) * 30
          : rng() * 360;

      // Positional color blending + jitter
      const fillBase = getPositionalColor(x, y, width, height, colors, rng);
      const strokeBase = colors[Math.floor(rng() * colors.length)];
      const fillColor = jitterColor(fillBase, rng, 0.06);
      const strokeColor = jitterColor(strokeBase, rng, 0.05);

      // Semi-transparent fill
      const fillAlpha = 0.2 + rng() * 0.5;
      const transparentFill = hexWithAlpha(fillColor, fillAlpha);

      const strokeWidth = (0.5 + rng() * 2.0) * scaleFactor;

      ctx.globalAlpha = layerOpacity * (0.5 + rng() * 0.5);

      // Glow on sacred shapes more often
      const isSacred = SACRED_SHAPES.includes(shape);
      const glowChance = isSacred ? 0.45 : 0.2;
      const hasGlow = rng() < glowChance;
      const glowRadius = hasGlow ? (8 + rng() * 20) * scaleFactor : 0;

      // Gradient fill on ~30%
      const hasGradient = rng() < 0.3;
      const gradientEnd = hasGradient
        ? jitterColor(colors[Math.floor(rng() * colors.length)], rng, 0.1)
        : undefined;

      enhanceShapeGeneration(ctx, shape, x, y, {
        fillColor: transparentFill,
        strokeColor,
        strokeWidth,
        size,
        rotation,
        proportionType: "GOLDEN_RATIO",
        glowRadius,
        glowColor: hasGlow ? hexWithAlpha(fillColor, 0.6) : undefined,
        gradientFillEnd: gradientEnd,
      });

      shapePositions.push({ x, y, size });

      // ── 5b. Recursive nesting: ~15% of larger shapes get inner shapes ──
      if (size > adjustedMaxSize * 0.4 && rng() < 0.15) {
        const innerCount = 1 + Math.floor(rng() * 3);
        for (let n = 0; n < innerCount; n++) {
          const innerShape = pickShape(
            rng,
            Math.min(1, layerRatio + 0.3),
            shapeNames,
          );
          const innerSize = size * (0.15 + rng() * 0.25);
          const innerOffX = (rng() - 0.5) * size * 0.4;
          const innerOffY = (rng() - 0.5) * size * 0.4;
          const innerRot = rng() * 360;
          const innerFill = hexWithAlpha(
            jitterColor(colors[Math.floor(rng() * colors.length)], rng, 0.1),
            0.3 + rng() * 0.4,
          );

          ctx.globalAlpha = layerOpacity * 0.7;
          enhanceShapeGeneration(
            ctx,
            innerShape,
            x + innerOffX,
            y + innerOffY,
            {
              fillColor: innerFill,
              strokeColor: hexWithAlpha(strokeColor, 0.5),
              strokeWidth: strokeWidth * 0.6,
              size: innerSize,
              rotation: innerRot,
              proportionType: "GOLDEN_RATIO",
            },
          );
        }
      }
    }
  }

  // ── 6. Flow-line pass ──────────────────────────────────────────
  // Draw flowing curves that follow the hash-derived vector field
  const numFlowLines = 6 + Math.floor(rng() * 10);
  for (let i = 0; i < numFlowLines; i++) {
    let fx = rng() * width;
    let fy = rng() * height;
    const steps = 30 + Math.floor(rng() * 40);
    const stepLen = (3 + rng() * 5) * scaleFactor;

    ctx.globalAlpha = 0.06 + rng() * 0.1;
    ctx.strokeStyle = hexWithAlpha(
      colors[Math.floor(rng() * colors.length)],
      0.4,
    );
    ctx.lineWidth = (0.5 + rng() * 1.5) * scaleFactor;

    ctx.beginPath();
    ctx.moveTo(fx, fy);

    for (let s = 0; s < steps; s++) {
      const angle = flowAngle(fx, fy) + (rng() - 0.5) * 0.3;
      fx += Math.cos(angle) * stepLen;
      fy += Math.sin(angle) * stepLen;

      // Stay in bounds
      if (fx < 0 || fx > width || fy < 0 || fy > height) break;
      ctx.lineTo(fx, fy);
    }
    ctx.stroke();
  }

  // ── 7. Noise texture overlay ───────────────────────────────────
  // Subtle grain rendered as tiny semi-transparent dots
  const noiseRng = createRng(seedFromHash(gitHash, 777));
  const noiseDensity = Math.floor((width * height) / 800);
  for (let i = 0; i < noiseDensity; i++) {
    const nx = noiseRng() * width;
    const ny = noiseRng() * height;
    const brightness = noiseRng() > 0.5 ? 255 : 0;
    const alpha = 0.01 + noiseRng() * 0.03;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},1)`;
    ctx.fillRect(nx, ny, 1 * scaleFactor, 1 * scaleFactor);
  }

  // ── 8. Organic connecting curves ───────────────────────────────
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

      ctx.globalAlpha = 0.06 + rng() * 0.1;
      ctx.strokeStyle = hexWithAlpha(
        colors[Math.floor(rng() * colors.length)],
        0.3,
      );

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}
