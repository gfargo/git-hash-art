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
  | "watercolor"       // multiple offset passes at low opacity
  | "hatched"          // cross-hatch texture fill
  | "incomplete";      // draw only 60-85% of the stroke path

const RENDER_STYLES: RenderStyle[] = [
  "fill-and-stroke",
  "fill-and-stroke",  // weighted: appears twice for higher probability
  "fill-only",
  "stroke-only",
  "double-stroke",
  "dashed",
  "watercolor",
  "hatched",
  "incomplete",
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
      // Improved watercolor: edge darkening + radial bleed + layered washes
      const passes = 4 + (rng ? Math.floor(rng() * 2) : 0);
      const savedAlpha = ctx.globalAlpha;

      // Pass 1: Base wash — large, soft fill at low opacity
      ctx.globalAlpha = savedAlpha * 0.15;
      ctx.save();
      const baseScale = 1.08 + (rng ? rng() * 0.04 : 0);
      ctx.scale(baseScale, baseScale);
      ctx.fill();
      ctx.restore();

      // Pass 2: Multiple offset washes with radial displacement
      ctx.globalAlpha = savedAlpha * (0.25 / passes * 2);
      for (let p = 0; p < passes; p++) {
        // Radial outward displacement (not uniform) for organic bleed
        const angle = rng ? rng() * Math.PI * 2 : p * Math.PI / 2;
        const dist = rng ? rng() * size * 0.05 : size * 0.02;
        const jx = Math.cos(angle) * dist;
        const jy = Math.sin(angle) * dist;
        ctx.save();
        ctx.translate(jx, jy);
        ctx.fill();
        ctx.restore();
      }

      // Pass 3: Edge darkening — draw a slightly smaller shape with lighter fill
      // to simulate pigment pooling at boundaries
      ctx.globalAlpha = savedAlpha * 0.35;
      ctx.save();
      const innerScale = 0.85 + (rng ? rng() * 0.08 : 0);
      ctx.scale(innerScale, innerScale);
      // Lighten the fill for the inner area
      const origFill = ctx.fillStyle;
      if (typeof fillColor === "string") {
        ctx.fillStyle = fillColor.replace(/[\d.]+\)$/, (m) => {
          const v = parseFloat(m);
          return Math.min(1, v * 1.4).toFixed(2) + ")";
        });
      }
      ctx.fill();
      ctx.fillStyle = origFill;
      ctx.restore();

      ctx.globalAlpha = savedAlpha;
      // Soft stroke on top — thinner than normal for delicacy
      ctx.globalAlpha *= 0.25;
      ctx.lineWidth = strokeWidth * 0.6;
      ctx.stroke();
      ctx.globalAlpha /= 0.25;
      break;
    }

    case "hatched": {
      // Fill normally at reduced opacity, then overlay cross-hatch lines
      const savedAlphaH = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaH * 0.3;
      ctx.fill();
      ctx.globalAlpha = savedAlphaH;

      // Clip to shape, then draw hatch lines
      ctx.save();
      ctx.clip();
      const hatchSpacing = Math.max(3, size * 0.06);
      const hatchAngle = rng ? rng() * Math.PI : Math.PI / 4;
      ctx.lineWidth = Math.max(0.5, strokeWidth * 0.4);
      ctx.globalAlpha = savedAlphaH * 0.6;

      // Draw parallel lines across the bounding box
      const extent = size * 0.8;
      const cos = Math.cos(hatchAngle);
      const sin = Math.sin(hatchAngle);
      for (let d = -extent; d <= extent; d += hatchSpacing) {
        ctx.beginPath();
        ctx.moveTo(d * cos - extent * sin, d * sin + extent * cos);
        ctx.lineTo(d * cos + extent * sin, d * sin - extent * cos);
        ctx.stroke();
      }
      // Second pass at perpendicular angle for cross-hatch (~50% chance)
      if (!rng || rng() < 0.5) {
        const crossAngle = hatchAngle + Math.PI / 2;
        const cos2 = Math.cos(crossAngle);
        const sin2 = Math.sin(crossAngle);
        ctx.globalAlpha = savedAlphaH * 0.35;
        for (let d = -extent; d <= extent; d += hatchSpacing * 1.4) {
          ctx.beginPath();
          ctx.moveTo(d * cos2 - extent * sin2, d * sin2 + extent * cos2);
          ctx.lineTo(d * cos2 + extent * sin2, d * sin2 - extent * cos2);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = savedAlphaH;
      // Outline stroke
      ctx.globalAlpha *= 0.5;
      ctx.stroke();
      ctx.globalAlpha /= 0.5;
      break;
    }

    case "incomplete": {
      // Draw the fill at low opacity, then a dashed stroke that
      // simulates drawing only part of the outline
      const savedAlphaI = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaI * 0.25;
      ctx.fill();
      ctx.globalAlpha = savedAlphaI;

      // Use a long dash pattern where gaps create the "incomplete" look
      const completeness = rng ? 0.6 + rng() * 0.25 : 0.7; // 60-85%
      const segLen = size * 0.12;
      const gapLen = segLen * ((1 - completeness) / completeness);
      ctx.setLineDash([segLen, gapLen]);
      // Offset the dash so each shape starts at a different point
      ctx.lineDashOffset = rng ? rng() * segLen * 4 : 0;
      // Slightly thicker stroke for hand-drawn feel
      ctx.lineWidth = strokeWidth * 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
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
    drawFunction(ctx, size, { rng });
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
