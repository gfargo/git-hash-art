import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { SacredColorScheme } from "./lib/canvas/colors";
import { enhanceShapeGeneration } from "./lib/canvas/draw";
import { shapes } from "./lib/canvas/shapes";
import { PatternPresets } from "./lib/constants";
import { getRandomFromHash } from "./lib/utils";

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

/**
 * Generate an abstract art image from a git hash with custom configuration
 * @param {string} gitHash - The git hash to use as a seed
 * @param {string} [label=''] - Label for the output file
 * @param {ArtConfig} [config={}] - Configuration options
 * @returns {Buffer} PNG buffer of the generated image
 */
function generateImageFromHash(gitHash, label = "", config = {}) {
  // Default configuration
  const defaultConfig = {
    width: 2048,
    height: 2048,
    gridSize: 12,
    layers: 2,
    minShapeSize: 20,
    maxShapeSize: 600,
    baseOpacity: 0.8,
    opacityReduction: 0.4,
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
  
  const colorScheme = new SacredColorScheme(gitHash);
  const colors = colorScheme.getColorPalette("chakra");

  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorScheme.baseScheme[0]);
  gradient.addColorStop(1, colorScheme.baseScheme[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const shapeNames = Object.keys(shapes);

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
        shapeNames[
          Math.floor(
            getRandomFromHash(
              gitHash,
              layer * numShapes + i * 3,
              0,
              shapeNames.length
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
      // drawShape(
      //   ctx,
      //   shape,
      //   x,
      //   y,
      //   colors[fillColorIndex],
      //   colors[strokeColorIndex],
      //   2 * scaleFactor,
      //   size,
      //   rotation
      // );
      enhanceShapeGeneration(ctx, shape, x, y, {
        fillColor: colors[fillColorIndex],
        strokeColor: colors[strokeColorIndex],
        strokeWidth: 1.5 * scaleFactor,
        size,
        rotation,
        // Optionally add pattern combinations
        // patterns:
        //   Math.random() > 0.7 ? PatternPresets.cosmicTree(size) : [],
        proportionType: "GOLDEN_RATIO",
      });
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
function saveImageToFile(imageBuffer, outputDir, gitHash, label = "", width, height) {
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

// Export the main functions
export { generateImageFromHash, saveImageToFile };

// Usage example:
/*
import { generateImageFromHash, saveImageToFile } from 'git-hash-art';

const gitHash = '1234567890abcdef1234567890abcdef12345678';
const imageBuffer = generateImageFromHash(gitHash, 'example', { width: 1024, height: 1024 });
const savedImagePath = saveImageToFile(imageBuffer, './output', gitHash, 'example', 1024, 1024);
console.log(`Image saved to: ${savedImagePath}`);
*/

