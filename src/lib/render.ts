/**
 * Pure rendering logic — environment-agnostic.
 *
 * Uses only the standard CanvasRenderingContext2D API so it works
 * identically in Node (@napi-rs/canvas) and browsers.
 *
 * Generation pipeline:
 *   1.  Background — radial gradient from hash-derived dark palette
 *   1b. Layered background — large faint shapes / subtle pattern for depth
 *   2.  Composition mode — hash selects: radial, flow-field, spiral, grid-subdivision, or clustered
 *   3.  Focal points + void zones (negative space)
 *   4.  Flow field seed values
 *   5.  Shape layers — blend modes, render styles, weighted selection,
 *       focal-point placement, atmospheric depth, organic edges
 *   5b. Recursive nesting
 *   6.  Flow-line pass — tapered brush-stroke curves
 *   7.  Noise texture overlay
 *   8.  Organic connecting curves
 */
import {
    SacredColorScheme,
    hexWithAlpha,
    jitterColor,
    desaturate,
    shiftTemperature,
} from "./canvas/colors";
import {
    enhanceShapeGeneration,
    pickBlendMode,
    pickRenderStyle,
} from "./canvas/draw";
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
      const numClusters = 3 + Math.floor(rng() * 3);
      const ci = Math.floor(rng() * numClusters);
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
  const nx = x / width;
  const ny = y / height;
  const posIndex = (nx * 0.6 + ny * 0.4) * (colors.length - 1);
  const baseIdx = Math.floor(posIndex) % colors.length;
  return jitterColor(colors[baseIdx], rng, 0.08);
}

// ── Helper: check if a position is inside a void zone (Feature E) ───

function isInVoidZone(
  x: number,
  y: number,
  voidZones: Array<{ x: number; y: number; radius: number }>,
): boolean {
  for (const zone of voidZones) {
    if (Math.hypot(x - zone.x, y - zone.y) < zone.radius) return true;
  }
  return false;
}

// ── Helper: density check for negative space (Feature E) ────────────

function localDensity(
  x: number,
  y: number,
  positions: Array<{ x: number; y: number; size: number }>,
  radius: number,
): number {
  let count = 0;
  for (const p of positions) {
    if (Math.hypot(x - p.x, y - p.y) < radius) count++;
  }
  return count;
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
  const tempMode = colorScheme.getTemperatureMode();
  // Foreground shapes get the opposite temperature for contrast
  const fgTempTarget: "warm" | "cool" | null =
    tempMode === "warm-bg" ? "cool" : tempMode === "cool-bg" ? "warm" : null;

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

  // ── 1b. Layered background (Feature G) ─────────────────────────
  // Draw large, very faint shapes to give the background texture
  const bgShapeCount = 3 + Math.floor(rng() * 4);
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < bgShapeCount; i++) {
    const bx = rng() * width;
    const by = rng() * height;
    const bSize = (width * 0.3 + rng() * width * 0.5);
    const bColor = colors[Math.floor(rng() * colors.length)];
    ctx.globalAlpha = 0.03 + rng() * 0.05;
    ctx.fillStyle = hexWithAlpha(bColor, 0.15);
    ctx.beginPath();
    ctx.arc(bx, by, bSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Subtle concentric rings from center
  const ringCount = 2 + Math.floor(rng() * 3);
  ctx.globalAlpha = 0.02 + rng() * 0.03;
  ctx.strokeStyle = hexWithAlpha(colors[0], 0.1);
  ctx.lineWidth = 1 * scaleFactor;
  for (let i = 1; i <= ringCount; i++) {
    const r = (Math.min(width, height) * 0.15) * i;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // ── 2. Composition mode ────────────────────────────────────────
  const compositionMode =
    COMPOSITION_MODES[Math.floor(rng() * COMPOSITION_MODES.length)];

  // ── 2b. Symmetry mode — ~25% of hashes trigger mirroring ──────
  type SymmetryMode = "none" | "bilateral-x" | "bilateral-y" | "quad";
  const symRoll = rng();
  const symmetryMode: SymmetryMode =
    symRoll < 0.10 ? "bilateral-x" :
    symRoll < 0.20 ? "bilateral-y" :
    symRoll < 0.25 ? "quad" : "none";

  // ── 3. Focal points + void zones ───────────────────────────────
  // Rule-of-thirds intersection points for intentional composition
  const THIRDS_POINTS = [
    { x: 1 / 3, y: 1 / 3 },
    { x: 2 / 3, y: 1 / 3 },
    { x: 1 / 3, y: 2 / 3 },
    { x: 2 / 3, y: 2 / 3 },
  ];
  const numFocal = 1 + Math.floor(rng() * 2);
  const focalPoints: Array<{ x: number; y: number; strength: number }> = [];
  for (let f = 0; f < numFocal; f++) {
    // 70% chance to snap to a rule-of-thirds point, 30% free placement
    if (rng() < 0.7) {
      const tp = THIRDS_POINTS[Math.floor(rng() * THIRDS_POINTS.length)];
      // Small jitter around the thirds point so it's not robotic
      focalPoints.push({
        x: width * (tp.x + (rng() - 0.5) * 0.08),
        y: height * (tp.y + (rng() - 0.5) * 0.08),
        strength: 0.3 + rng() * 0.4,
      });
    } else {
      focalPoints.push({
        x: width * (0.2 + rng() * 0.6),
        y: height * (0.2 + rng() * 0.6),
        strength: 0.3 + rng() * 0.4,
      });
    }
  }

  // Feature E: 1-2 void zones where shapes are sparse (negative space)
  const numVoids = Math.floor(rng() * 2) + 1;
  const voidZones: Array<{ x: number; y: number; radius: number }> = [];
  for (let v = 0; v < numVoids; v++) {
    voidZones.push({
      x: width * (0.15 + rng() * 0.7),
      y: height * (0.15 + rng() * 0.7),
      radius: Math.min(width, height) * (0.06 + rng() * 0.1),
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

  // ── 4. Flow field seed values ──────────────────────────────────
  const fieldAngleBase = rng() * Math.PI * 2;
  const fieldFreq = 0.5 + rng() * 2;

  function flowAngle(x: number, y: number): number {
    return (
      fieldAngleBase +
      Math.sin((x / width) * fieldFreq * Math.PI * 2) * Math.PI * 0.5 +
      Math.cos((y / height) * fieldFreq * Math.PI * 2) * Math.PI * 0.5
    );
  }

  // Track all placed shapes for density checks and connecting curves
  const shapePositions: Array<{ x: number; y: number; size: number }> = [];

  // ── 4b. Hero shape — a dominant focal element ───────────────────
  // ~60% of images get a hero shape anchored at the primary focal point.
  // It's a large sacred/complex shape that gives the composition a center of gravity.
  if (rng() < 0.6) {
    const heroFocal = focalPoints[0];
    const heroPool = [...SACRED_SHAPES, "fibonacciSpiral", "merkaba", "fractal"];
    const heroShape =
      heroPool.filter((s) => shapeNames.includes(s))[
        Math.floor(rng() * heroPool.filter((s) => shapeNames.includes(s)).length)
      ] || shapeNames[Math.floor(rng() * shapeNames.length)];

    const heroSize = adjustedMaxSize * (0.8 + rng() * 0.5);
    const heroRotation = rng() * 360;
    const heroFill = hexWithAlpha(
      jitterColor(colors[Math.floor(rng() * colors.length)], rng, 0.05),
      0.15 + rng() * 0.2,
    );
    const heroStroke = jitterColor(colors[Math.floor(rng() * colors.length)], rng, 0.05);

    ctx.globalAlpha = 0.5 + rng() * 0.2;
    enhanceShapeGeneration(ctx, heroShape, heroFocal.x, heroFocal.y, {
      fillColor: heroFill,
      strokeColor: heroStroke,
      strokeWidth: (1.5 + rng() * 2) * scaleFactor,
      size: heroSize,
      rotation: heroRotation,
      proportionType: "GOLDEN_RATIO",
      glowRadius: (12 + rng() * 20) * scaleFactor,
      glowColor: hexWithAlpha(heroStroke, 0.4),
      gradientFillEnd: jitterColor(colors[Math.floor(rng() * colors.length)], rng, 0.1),
      renderStyle: rng() < 0.4 ? "watercolor" : "fill-and-stroke",
      rng,
    });

    shapePositions.push({ x: heroFocal.x, y: heroFocal.y, size: heroSize });
  }

  // ── 5. Shape layers ────────────────────────────────────────────
  const densityCheckRadius = Math.min(width, height) * 0.08;
  const maxLocalDensity = Math.ceil(finalConfig.shapesPerLayer * 0.15);

  for (let layer = 0; layer < layers; layer++) {
    const layerRatio = layers > 1 ? layer / (layers - 1) : 0;
    const numShapes =
      finalConfig.shapesPerLayer +
      Math.floor(rng() * finalConfig.shapesPerLayer * 0.3);
    const layerOpacity = Math.max(0.15, baseOpacity - layer * opacityReduction);
    const layerSizeScale = 1 - layer * 0.15;

    // Feature B: per-layer blend mode
    const layerBlend = pickBlendMode(rng);
    ctx.globalCompositeOperation = layerBlend;

    // Feature C: per-layer render style bias
    const layerRenderStyle = pickRenderStyle(rng);

    // Feature D: atmospheric desaturation for later layers
    const atmosphericDesat = layerRatio * 0.3; // 0 for first layer, up to 0.3 for last

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

      // Feature E: skip shapes in void zones, reduce in dense areas
      if (isInVoidZone(x, y, voidZones)) {
        // 85% chance to skip — allows a few shapes to bleed in
        if (rng() < 0.85) continue;
      }
      if (localDensity(x, y, shapePositions, densityCheckRadius) > maxLocalDensity) {
        if (rng() < 0.6) continue; // thin out dense areas
      }

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
      let fillBase = getPositionalColor(x, y, width, height, colors, rng);
      const strokeBase = colors[Math.floor(rng() * colors.length)];

      // Feature D: desaturate colors on later layers for depth
      if (atmosphericDesat > 0) {
        fillBase = desaturate(fillBase, atmosphericDesat);
      }

      // Temperature contrast: shift foreground shapes opposite to background
      if (fgTempTarget) {
        fillBase = shiftTemperature(fillBase, fgTempTarget, 0.15 + layerRatio * 0.1);
      }

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

      // Feature C: per-shape render style (70% use layer style, 30% pick their own)
      const shapeRenderStyle =
        rng() < 0.7 ? layerRenderStyle : pickRenderStyle(rng);

      // Feature F: organic edge jitter — applied via watercolor style on ~15% of shapes
      const useOrganicEdges = rng() < 0.15 && shapeRenderStyle === "fill-and-stroke";
      const finalRenderStyle = useOrganicEdges ? "watercolor" : shapeRenderStyle;

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
        renderStyle: finalRenderStyle,
        rng,
      });

      shapePositions.push({ x, y, size });

      // ── 5b. Recursive nesting ──────────────────────────────────
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
              renderStyle: shapeRenderStyle,
              rng,
            },
          );
        }
      }
    }
  }

  // Reset blend mode for post-processing passes
  ctx.globalCompositeOperation = "source-over";

  // ── 6. Flow-line pass (Feature H: tapered brush strokes) ───────
  const numFlowLines = 6 + Math.floor(rng() * 10);
  for (let i = 0; i < numFlowLines; i++) {
    let fx = rng() * width;
    let fy = rng() * height;
    const steps = 30 + Math.floor(rng() * 40);
    const stepLen = (3 + rng() * 5) * scaleFactor;
    const startWidth = (1 + rng() * 3) * scaleFactor;

    const lineColor = hexWithAlpha(
      colors[Math.floor(rng() * colors.length)],
      0.4,
    );
    const lineAlpha = 0.06 + rng() * 0.1;

    // Draw as individual segments with tapering width
    let prevX = fx;
    let prevY = fy;
    for (let s = 0; s < steps; s++) {
      const angle = flowAngle(fx, fy) + (rng() - 0.5) * 0.3;
      fx += Math.cos(angle) * stepLen;
      fy += Math.sin(angle) * stepLen;

      if (fx < 0 || fx > width || fy < 0 || fy > height) break;

      // Taper: thick at start, thin at end
      const taper = 1 - (s / steps) * 0.8;
      ctx.globalAlpha = lineAlpha * taper;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = startWidth * taper;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(fx, fy);
      ctx.stroke();

      prevX = fx;
      prevY = fy;
    }
  }

  // ── 6b. Apply symmetry mirroring ─────────────────────────────────
  // Mirror the rendered content (shapes + flow lines) before post-processing.
  // Uses ctx.canvas which is available in both Node (@napi-rs/canvas) and browsers.
  if (symmetryMode !== "none") {
    const canvas = ctx.canvas;
    ctx.save();
    if (symmetryMode === "bilateral-x" || symmetryMode === "quad") {
      // Mirror left half onto right half
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      // Draw the left half (0 to cx) onto the mirrored right side
      ctx.drawImage(canvas, 0, 0, Math.ceil(cx), height, 0, 0, Math.ceil(cx), height);
      ctx.restore();
    }
    if (symmetryMode === "bilateral-y" || symmetryMode === "quad") {
      // Mirror top half onto bottom half
      ctx.save();
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.drawImage(canvas, 0, 0, width, Math.ceil(cy), 0, 0, width, Math.ceil(cy));
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 7. Noise texture overlay ───────────────────────────────────
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

  // ── 8. Vignette — darken edges to draw the eye inward ───────────
  ctx.globalAlpha = 1;
  const vignetteStrength = 0.25 + rng() * 0.2; // 25-45% edge darkening
  const vigGrad = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.3, cx, cy, bgRadius);
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(0.6, "rgba(0,0,0,0)");
  vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength.toFixed(3)})`);
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, width, height);

  // ── 9. Organic connecting curves ───────────────────────────────
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
