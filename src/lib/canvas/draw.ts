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
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Integration with existing generation logic
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
  } = config;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  // Draw base shape
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const drawFunction = shapes[shape];
  if (drawFunction) {
    drawFunction(ctx, size);
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

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
