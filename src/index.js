import { createCanvas } from "canvas";
import ColorScheme from "color-scheme";
import fs from "fs";
import path from "path";
import { PRESETS } from "./constants";
import { shapes } from "./shapes";

const OUTPUT_DIR = "examples";
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// Configuration type definition (for documentation)
/**
 * @typedef {Object} ArtConfig
 * @property {number} width - Canvas width in pixels
 * @property {number} height - Canvas height in pixels
 * @property {number} [gridSize=4] - Number of grid cells (gridSize x gridSize)
 * @property {number} [layers=5] - Number of layers to generate
 * @property {number} [shapesPerLayer] - Base number of shapes per layer (defaults to grid cells * 1.5)
 * @property {number} [minShapeSize=20] - Minimum shape size
 * @property {number} [maxShapeSize=180] - Maximum shape size
 * @property {number} [baseOpacity=0.6] - Starting opacity for first layer
 * @property {number} [opacityReduction=0.1] - How much to reduce opacity per layer
 */

function gitHashToSeed(gitHash) {
  return parseInt(gitHash.slice(0, 8), 16);
}

function getRandomFromHash(hash, index, min, max) {
  const hexPair = hash.substr((index * 2) % hash.length, 2);
  const decimal = parseInt(hexPair, 16);
  return min + (decimal / 255) * (max - min);
}

function generateColorScheme(gitHash) {
  const seed = gitHashToSeed(gitHash);
  const scheme = new ColorScheme();
  scheme
    .from_hue(seed % 360)
    .scheme("analogic")
    .variation("soft");

  let colors = scheme.colors().map((hex) => `#${hex}`);

  const contrastingHue = (seed + 180) % 360;
  const contrastingScheme = new ColorScheme();
  contrastingScheme.from_hue(contrastingHue).scheme("mono").variation("soft");
  colors.push(`#${contrastingScheme.colors()[0]}`);

  return colors;
}

function drawShape(
  ctx,
  shape,
  x,
  y,
  fillColor,
  strokeColor,
  strokeWidth,
  size,
  rotation
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const drawFunction = shapes[shape];
  if (drawFunction) {
    drawFunction(ctx, size);
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Generate an abstract art image from a git hash with custom configuration
 * @param {string} gitHash - The git hash to use as a seed
 * @param {string} [label=''] - Label for the output file
 * @param {ArtConfig} [config={}] - Configuration options
 * @returns {string} Path to the generated image
 */
function generateImageFromHash(gitHash, label = "", config = {}) {
  // Default configuration
  const defaultConfig = {
    width: 1024,
    height: 1024,
    gridSize: 4,
    layers: 5,
    minShapeSize: 20,
    maxShapeSize: 360,
    baseOpacity: 0.6,
    opacityReduction: 0.1,
  };

  // Merge provided config with defaults
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

  // Calculate shapes per layer based on grid size if not provided
  finalConfig.shapesPerLayer =
    finalConfig.shapesPerLayer || Math.floor(gridSize * gridSize * 1.5);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const colors = generateColorScheme(gitHash);

  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const shapes = [
    "circle",
    "square",
    "triangle",
    "hexagon",
    "star",
    "jacked-star",
    "heart",
    "diamond",
    "cube",
  ];

  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  // Scale shape sizes based on canvas dimensions
  const scaleFactor = Math.min(width, height) / 1024;
  const adjustedMinSize = minShapeSize * scaleFactor;
  const adjustedMaxSize = maxShapeSize * scaleFactor;

  for (let layer = 0; layer < layers; layer++) {
    const numShapes =
      finalConfig.shapesPerLayer +
      Math.floor(
        getRandomFromHash(gitHash, layer, 0, finalConfig.shapesPerLayer / 2)
      );
    const layerOpacity = baseOpacity - layer * opacityReduction;

    for (let i = 0; i < numShapes; i++) {
      const gridX = Math.floor(i / gridSize);
      const gridY = i % gridSize;

      const cellOffsetX = getRandomFromHash(
        gitHash,
        layer * numShapes + i * 2,
        0,
        cellWidth
      );
      const cellOffsetY = getRandomFromHash(
        gitHash,
        layer * numShapes + i * 2 + 1,
        0,
        cellHeight
      );

      const x = gridX * cellWidth + cellOffsetX;
      const y = gridY * cellHeight + cellOffsetY;

      const shape =
        shapes[
          Math.floor(
            getRandomFromHash(
              gitHash,
              layer * numShapes + i * 3,
              0,
              shapes.length
            )
          )
        ];
      const size =
        adjustedMinSize +
        getRandomFromHash(
          gitHash,
          layer * numShapes + i * 4,
          0,
          adjustedMaxSize - adjustedMinSize
        );
      const rotation = getRandomFromHash(
        gitHash,
        layer * numShapes + i * 5,
        0,
        360
      );

      const fillColorIndex = Math.floor(
        getRandomFromHash(gitHash, layer * numShapes + i * 6, 0, colors.length)
      );
      const strokeColorIndex = Math.floor(
        getRandomFromHash(gitHash, layer * numShapes + i * 7, 0, colors.length)
      );

      ctx.globalAlpha = layerOpacity;
      drawShape(
        ctx,
        shape,
        x,
        y,
        colors[fillColorIndex],
        colors[strokeColorIndex],
        2 * scaleFactor,
        size,
        rotation
      );
    }

    // Add connecting lines scaled to canvas size
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = colors[colors.length - 1];
    ctx.lineWidth = 1 * scaleFactor;

    const numLines = Math.floor((15 * (width * height)) / (1024 * 1024));
    for (let i = 0; i < numLines; i++) {
      const x1 = getRandomFromHash(gitHash, i * 4, 0, width);
      const y1 = getRandomFromHash(gitHash, i * 4 + 1, 0, height);
      const x2 = getRandomFromHash(gitHash, i * 4 + 2, 0, width);
      const y2 = getRandomFromHash(gitHash, i * 4 + 3, 0, height);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  const filename = label
    ? `${label}-${width}x${height}-${gitHash.slice(0, 8)}.png`
    : `${gitHash.slice(0, 8)}-${width}x${height}.png`;

  const outputPath = path.join(OUTPUT_DIR, filename);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath}`);

  return outputPath;
}

function generateTestCases() {
  console.log("Generating test cases...");
  console.log("Output directory:", path.resolve(OUTPUT_DIR));

  const results = [];
  for (const [label, testCase] of Object.entries(PRESETS)) {
    try {
      const outputPath = generateImageFromHash(testCase.hash, label, {
        width: testCase.width,
        height: testCase.height,
      });
      results.push({ label, hash: testCase.hash, outputPath, success: true });
    } catch (error) {
      console.error(`Failed to generate image for ${label}:`, error);
      results.push({
        label,
        hash: testCase.hash,
        success: false,
        error: error.message,
      });
    }
  }

  console.log("\nGeneration Summary:");
  console.log("------------------");
  results.forEach(({ label, success, outputPath, error }) => {
    if (success) {
      console.log(`✓ ${label}: ${outputPath}`);
    } else {
      console.log(`✗ ${label}: Failed - ${error}`);
    }
  });
}

generateTestCases();

export { generateImageFromHash, generateTestCases };
