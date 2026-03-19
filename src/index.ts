import { createCanvas } from "@napi-rs/canvas";
import {
  SacredColorScheme,
  hexWithAlpha,
  jitterColor,
} from "./lib/canvas/colors";
import { enhanceShapeGeneration } from "./lib/canvas/draw";
import { shapes } from "./lib/canvas/shapes";
import { createRng, seedFromHash } from "./lib/utils";

// Shape categories for weighted selection per layer
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

/**
 * Pick a shape name using layer-weighted selection.
 * Early layers favor basic shapes; later layers favor complex/sacred.
 */
function pickShape(
  rng: () => number,
  layerRatio: number,
  shapeNames: string[],
): string {
  // layerRatio: 0 = first layer, 1 = last layer
  const basicWeight = 1 - layerRatio * 0.6;
  const complexWeight = 0.3 + layerRatio * 0.3;
  const sacredWeight = 0.1 + layerRatio * 0.4;
  const total = basicWeight + complexWeight + sacredWeight;

  const roll = rng() * total;
  let pool: string[];
  if (roll < basicWeight) {
    pool = BASIC_SHAPES;
  } else if (roll < basicWeight + complexWeight) {
    pool = COMPLEX_SHAPES;
  } else {
    pool = SACRED_SHAPES;
  }

  // Filter to shapes that actually exist in the registry
  const available = pool.filter((s) => shapeNames.includes(s));
  if (available.length === 0) {
    return shapeNames[Math.floor(rng() * shapeNames.length)];
  }
  return available[Math.floor(rng() * available.length)];
}

/**
 * Generate an abstract art image from a git hash with custom configuration
 * @param {string} gitHash - The git hash to use as a seed
 * @param {object} [config={}] - Configuration options
 * @returns {Buffer} PNG buffer of the generated image
 */
function generateImageFromHash(gitHash: string, config = {}) {
  const defaultConfig = {
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

  const finalConfig = { ...defaultConfig, ...config };
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

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

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

  // One master RNG seeded from the full hash
  const rng = createRng(seedFromHash(gitHash));

  // --- Focal points: 1-3 hash-derived attractors that bias shape placement ---
  const numFocal = 1 + Math.floor(rng() * 2); // 1-2 focal points
  const focalPoints: Array<{ x: number; y: number; strength: number }> = [];
  for (let f = 0; f < numFocal; f++) {
    focalPoints.push({
      x: width * (0.2 + rng() * 0.6), // keep away from edges
      y: height * (0.2 + rng() * 0.6),
      strength: 0.3 + rng() * 0.4,
    });
  }

  /**
   * Bias a position toward the nearest focal point.
   * Returns a blended position between the random point and the focal point.
   */
  function applyFocalBias(rx: number, ry: number): [number, number] {
    // Find nearest focal point
    let nearest = focalPoints[0];
    let minDist = Infinity;
    for (const fp of focalPoints) {
      const d = Math.hypot(rx - fp.x, ry - fp.y);
      if (d < minDist) {
        minDist = d;
        nearest = fp;
      }
    }
    // Blend toward focal point based on strength and a random factor
    const pull = nearest.strength * rng() * 0.5;
    return [rx + (nearest.x - rx) * pull, ry + (nearest.y - ry) * pull];
  }

  const shapePositions: Array<{ x: number; y: number }> = [];

  for (let layer = 0; layer < layers; layer++) {
    const layerRatio = layers > 1 ? layer / (layers - 1) : 0;
    const numShapes =
      finalConfig.shapesPerLayer +
      Math.floor(rng() * finalConfig.shapesPerLayer * 0.3);

    const layerOpacity = Math.max(0.15, baseOpacity - layer * opacityReduction);
    const layerSizeScale = 1 - layer * 0.15;

    for (let i = 0; i < numShapes; i++) {
      // Random position biased toward focal points
      const rawX = rng() * width;
      const rawY = rng() * height;
      const [x, y] = applyFocalBias(rawX, rawY);

      // Weighted shape selection: basic early, complex/sacred later
      const shape = pickShape(rng, layerRatio, shapeNames);

      const sizeT = Math.pow(rng(), 1.8);
      const size =
        (adjustedMinSize + sizeT * (adjustedMaxSize - adjustedMinSize)) *
        layerSizeScale;

      const rotation = rng() * 360;

      // Color jitter: slight variation on each pick for organic feel
      const baseFill = colors[Math.floor(rng() * colors.length)];
      const baseStroke = colors[Math.floor(rng() * colors.length)];
      const fillColor = jitterColor(baseFill, rng, 0.08);
      const strokeColor = jitterColor(baseStroke, rng, 0.06);

      // Semi-transparent fill for watercolor layering effect
      const fillAlpha = 0.25 + rng() * 0.5;
      const transparentFill = hexWithAlpha(fillColor, fillAlpha);

      const strokeWidth = (0.5 + rng() * 2.0) * scaleFactor;

      ctx.globalAlpha = layerOpacity * (0.5 + rng() * 0.5);

      // Glow: ~25% of shapes get a soft glow, more likely on sacred shapes
      const isSacred = SACRED_SHAPES.includes(shape);
      const glowChance = isSacred ? 0.45 : 0.2;
      const hasGlow = rng() < glowChance;
      const glowRadius = hasGlow ? (8 + rng() * 20) * scaleFactor : 0;

      // Gradient fill: ~30% of shapes get a radial gradient
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
  return canvas.toBuffer("image/png");
}

/**
 * Save the generated image to a file
 */
function saveImageToFile(
  imageBuffer: string,
  outputDir: string,
  gitHash: string | any[],
  label = "",
  width: any,
  height: any,
) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = label
    ? `${label}-${width}x${height}-${gitHash.slice(0, 8)}.png`
    : `${gitHash.slice(0, 8)}-${width}x${height}.png`;

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`Generated: ${outputPath}`);

  return outputPath;
}

export { generateImageFromHash, saveImageToFile };
