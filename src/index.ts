import { createCanvas } from "@napi-rs/canvas";
import { SacredColorScheme } from "./lib/canvas/colors";
import { enhanceShapeGeneration } from "./lib/canvas/draw";
import { shapes } from "./lib/canvas/shapes";
import { createRng, seedFromHash } from "./lib/utils";

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
      // True random placement across the full canvas
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

      // Vary stroke width by shape size for visual interest
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
      // Pick a nearby shape (within the next few indices for locality)
      const offset =
        1 + Math.floor(rng() * Math.min(5, shapePositions.length - 1));
      const idxB = (idxA + offset) % shapePositions.length;

      const a = shapePositions[idxA];
      const b = shapePositions[idxB];

      // Bezier control points offset perpendicular to the line
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
  return canvas.toBuffer("image/png");
}

/**
 * Save the generated image to a file
 * @param {Buffer} imageBuffer - The PNG buffer of the generated image
 * @param {string} outputDir - The directory to save the image
 * @param {string} gitHash - The git hash used to generate the image
 * @param {string} [label=''] - Label for the output file
 * @param {number} width - The width of the generated image
 * @param {number} height - The height of the generated image
 * @returns {string} Path to the saved image
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
