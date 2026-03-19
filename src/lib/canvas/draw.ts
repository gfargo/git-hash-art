import { PatternCombiner, ProportionType } from "../utils";
import { shapes } from "./shapes";

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
 * Enhanced shape drawing with glow, gradient fills, and pattern layering.
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
    ctx.fill();
    ctx.stroke();
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
