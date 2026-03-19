import { PatternCombiner, ProportionType } from "../utils";
import { shapes } from "./shapes";

// ── Blend modes for layer-level compositing (Feature B) ─────────────
// These are all standard Canvas 2D globalCompositeOperation values,
// safe in both Node (@napi-rs/canvas) and browsers.

export const BLEND_MODES: GlobalCompositeOperation[] = [
  "source-over", // default — safe fallback
  "screen",
  "multiply",
  "overlay",
  "soft-light",
  "color-dodge",
  "color-burn",
  "lighter",
];

/**
 * Pick a blend mode deterministically from the RNG.
 * ~40% chance of default source-over to keep some images clean.
 */
export function pickBlendMode(rng: () => number): GlobalCompositeOperation {
  if (rng() < 0.4) return "source-over";
  return BLEND_MODES[1 + Math.floor(rng() * (BLEND_MODES.length - 1))];
}

// ── Shape rendering styles (Feature C) ──────────────────────────────

export type RenderStyle =
  | "fill-and-stroke"  // classic (current behavior)
  | "fill-only"        // soft, no outline
  | "stroke-only"      // wireframe
  | "double-stroke"    // inner + outer stroke
  | "dashed"           // dashed outline
  | "watercolor";      // multiple offset passes at low opacity

const RENDER_STYLES: RenderStyle[] = [
  "fill-and-stroke",
  "fill-and-stroke",  // weighted: appears twice for higher probability
  "fill-only",
  "stroke-only",
  "double-stroke",
  "dashed",
  "watercolor",
];

export function pickRenderStyle(rng: () => number): RenderStyle {
  return RENDER_STYLES[Math.floor(rng() * RENDER_STYLES.length)];
}

// ── Config interfaces ───────────────────────────────────────────────

interface DrawShapeConfig {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  size: number;
  rotation: number;
}

interface EnhanceShapeConfig extends DrawShapeConfig {
  patterns?: Array<{ type: string; config: any }>;
  proportionType?: ProportionType;
  baseOpacity?: number;
  opacityReduction?: number;
  /** If provided, applies a glow (shadowBlur) effect. */
  glowRadius?: number;
  glowColor?: string;
  /** If provided, fills with a radial gradient between two colors. */
  gradientFillEnd?: string;
  /** Rendering style — controls fill/stroke treatment. */
  renderStyle?: RenderStyle;
  /** RNG for watercolor jitter (required for "watercolor" style). */
  rng?: () => number;
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  config: DrawShapeConfig,
) {
  const { fillColor, strokeColor, strokeWidth, size, rotation } = config;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const drawFunction = shapes[shape];
  if (drawFunction) {
    drawFunction(ctx, size);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Apply the chosen render style to the current path.
 */
function applyRenderStyle(
  ctx: CanvasRenderingContext2D,
  style: RenderStyle,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  size: number,
  rng?: () => number,
): void {
  switch (style) {
    case "fill-only":
      ctx.fill();
      break;

    case "stroke-only":
      ctx.fill(); // transparent fill to define the path
      ctx.globalAlpha *= 0.3; // ghost fill
      ctx.fill();
      ctx.globalAlpha /= 0.3;
      ctx.stroke();
      break;

    case "double-stroke": {
      ctx.fill();
      // Outer stroke
      ctx.lineWidth = strokeWidth * 2;
      ctx.globalAlpha *= 0.5;
      ctx.stroke();
      ctx.globalAlpha /= 0.5;
      // Inner stroke
      ctx.lineWidth = strokeWidth * 0.5;
      ctx.strokeStyle = fillColor;
      ctx.stroke();
      break;
    }

    case "dashed":
      ctx.fill();
      ctx.setLineDash([size * 0.05, size * 0.03]);
      ctx.stroke();
      ctx.setLineDash([]);
      break;

    case "watercolor": {
      // Draw 3-4 slightly offset passes at low opacity for a bleed effect
      const passes = 3 + (rng ? Math.floor(rng() * 2) : 0);
      const savedAlpha = ctx.globalAlpha;
      ctx.globalAlpha = savedAlpha * (0.3 / passes * 2);
      for (let p = 0; p < passes; p++) {
        const jx = rng ? (rng() - 0.5) * size * 0.06 : 0;
        const jy = rng ? (rng() - 0.5) * size * 0.06 : 0;
        ctx.save();
        ctx.translate(jx, jy);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = savedAlpha;
      // Light stroke on top
      ctx.globalAlpha *= 0.4;
      ctx.stroke();
      ctx.globalAlpha /= 0.4;
      break;
    }

    case "fill-and-stroke":
    default:
      ctx.fill();
      ctx.stroke();
      break;
  }
}

/**
 * Enhanced shape drawing with glow, gradient fills, blend modes,
 * render style variety, and pattern layering.
 */
export function enhanceShapeGeneration(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  config: EnhanceShapeConfig,
) {
  const {
    fillColor,
    strokeColor,
    strokeWidth,
    size,
    rotation,
    patterns = [],
    proportionType = "GOLDEN_RATIO",
    baseOpacity = 0.6,
    opacityReduction = 0.1,
    glowRadius = 0,
    glowColor,
    gradientFillEnd,
    renderStyle = "fill-and-stroke",
    rng,
  } = config;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  // Glow / shadow effect
  if (glowRadius > 0) {
    ctx.shadowBlur = glowRadius;
    ctx.shadowColor = glowColor || fillColor;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Gradient fill or flat fill
  if (gradientFillEnd) {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, gradientFillEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = fillColor;
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const drawFunction = shapes[shape];
  if (drawFunction) {
    drawFunction(ctx, size);
    applyRenderStyle(ctx, renderStyle, fillColor, strokeColor, strokeWidth, size, rng);
  }

  // Reset shadow so patterns aren't double-glowed
  if (glowRadius > 0) {
    ctx.shadowBlur = 0;
  }

  // Layer additional patterns if specified
  if (patterns.length > 0) {
    PatternCombiner.layerPatterns(ctx, patterns, {
      baseSize: size,
      baseOpacity,
      opacityReduction,
      proportionType,
    });
  }

  ctx.restore();
}
