/**
 * Browser entry point for git-hash-art.
 *
 * This module has zero Node.js dependencies — it works with a standard
 * HTMLCanvasElement or OffscreenCanvas and the native Canvas 2D API.
 */
import { renderHashArt } from "./lib/render";
import type { GenerationConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Render hash-derived art directly onto an HTMLCanvasElement.
 *
 * The canvas should already have the desired width/height set.
 * Config width/height will be inferred from the canvas if not provided.
 *
 * @param canvas  - An HTMLCanvasElement (or OffscreenCanvas)
 * @param gitHash - Hex hash string used as the deterministic seed
 * @param config  - Partial generation config (merged with defaults)
 */
function renderToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): void {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error("Failed to get 2D rendering context from canvas");
  }

  const finalConfig: Partial<GenerationConfig> = {
    width: canvas.width,
    height: canvas.height,
    ...config,
  };

  renderHashArt(ctx, gitHash, finalConfig);
}

/**
 * Render hash-derived art and return it as a Blob (browser-native).
 *
 * @param gitHash - Hex hash string used as the deterministic seed
 * @param config  - Partial generation config (merged with defaults)
 * @returns A Promise that resolves to a PNG Blob
 */
async function generateImageBlob(
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): Promise<Blob> {
  const finalConfig: GenerationConfig = { ...DEFAULT_CONFIG, ...config };
  const { width, height } = finalConfig;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  if (!ctx) {
    throw new Error("Failed to get 2D rendering context from OffscreenCanvas");
  }

  renderHashArt(
    ctx as unknown as CanvasRenderingContext2D,
    gitHash,
    finalConfig,
  );

  return canvas.convertToBlob({ type: "image/png" });
}

/**
 * Render hash-derived art and return it as a data URL string.
 *
 * @param gitHash - Hex hash string used as the deterministic seed
 * @param config  - Partial generation config (merged with defaults)
 * @returns A data:image/png;base64,… string
 */
function generateDataURL(
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): string {
  const finalConfig: GenerationConfig = { ...DEFAULT_CONFIG, ...config };
  const { width, height } = finalConfig;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D rendering context");
  }

  renderHashArt(ctx, gitHash, finalConfig);

  return canvas.toDataURL("image/png");
}

export { renderToCanvas, generateImageBlob, generateDataURL, renderHashArt };
export { PRESETS } from "./lib/constants";
export type { GenerationConfig } from "./types";
export { DEFAULT_CONFIG } from "./types";
