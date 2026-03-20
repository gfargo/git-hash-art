import { createCanvas } from "@napi-rs/canvas";
import * as fs from "fs";
import * as path from "path";
import { renderHashArt } from "./lib/render";
import type { GenerationConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Generate an abstract art PNG buffer from a git hash (Node.js only).
 *
 * Uses @napi-rs/canvas under the hood to create an off-screen canvas,
 * renders the hash-derived art, and returns the result as a PNG Buffer.
 *
 * @param gitHash - Hex hash string used as the deterministic seed
 * @param config  - Partial generation config (merged with defaults)
 * @returns PNG buffer of the generated image
 */
function generateImageFromHash(
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): Buffer {
  const finalConfig: GenerationConfig = { ...DEFAULT_CONFIG, ...config };
  const { width, height } = finalConfig;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  renderHashArt(ctx, gitHash, finalConfig);

  return canvas.toBuffer("image/png");
}

/**
 * Save the generated image to a file (Node.js only).
 *
 * @param imageBuffer - The PNG buffer of the generated image
 * @param outputDir   - The directory to save the image
 * @param gitHash     - The git hash used to generate the image
 * @param label       - Optional label for the output filename
 * @param width       - The width of the generated image
 * @param height      - The height of the generated image
 * @returns Path to the saved image
 */
function saveImageToFile(
  imageBuffer: Buffer,
  outputDir: string,
  gitHash: string,
  label = "",
  width: number,
  height: number,
): string {
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

export { generateImageFromHash, saveImageToFile, renderHashArt };
export { PRESETS } from "./lib/constants";
export type { GenerationConfig, CustomShapeDefinition, CustomDrawFunction } from "./types";
export { DEFAULT_CONFIG } from "./types";
