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
  | "incomplete"       // draw only 60-85% of the stroke path
  | "stipple"          // dot-fill texture
  | "stencil"          // negative-space cutout effect
  | "noise-grain"      // procedural noise grain texture clipped to shape
  | "wood-grain"       // parallel wavy lines simulating wood
  | "marble-vein"      // branching vein lines on a soft fill
  | "fabric-weave"     // interlocking horizontal/vertical threads
  | "hand-drawn";      // wobbly hand-drawn edge treatment

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
  "stipple",
  "stencil",
  "noise-grain",
  "wood-grain",
  "marble-vein",
  "fabric-weave",
  "hand-drawn",
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
  /** Light direction angle in radians — used for shadow & highlight. */
  lightAngle?: number;
  /** Scale factor for resolution-independent sizing. */
  scaleFactor?: number;
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

      // Pass 4: Organic edge erosion — irregular bites along the boundary
      if (rng && size > 20) {
        const erosionBites = 6 + Math.floor(rng() * 8);
        const edgeRadius = size * 0.45;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.6 + rng() * 0.3;
        for (let eb = 0; eb < erosionBites; eb++) {
          const biteAngle = rng() * Math.PI * 2;
          const biteDist = edgeRadius * (0.85 + rng() * 0.25);
          const biteR = size * (0.02 + rng() * 0.04);
          ctx.beginPath();
          ctx.arc(
            Math.cos(biteAngle) * biteDist,
            Math.sin(biteAngle) * biteDist,
            biteR, 0, Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.restore();
      }

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

    case "stipple": {
      // Dot-fill texture — clip to shape, then scatter dots
      const savedAlphaS = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaS * 0.15;
      ctx.fill(); // ghost fill
      ctx.globalAlpha = savedAlphaS;

      ctx.save();
      ctx.clip();
      const dotSpacing = Math.max(2, size * 0.03);
      const extent = size * 0.55;
      ctx.globalAlpha = savedAlphaS * 0.7;
      for (let dx = -extent; dx <= extent; dx += dotSpacing) {
        for (let dy = -extent; dy <= extent; dy += dotSpacing) {
          // Jitter each dot position for organic feel
          const jx = rng ? (rng() - 0.5) * dotSpacing * 0.6 : 0;
          const jy = rng ? (rng() - 0.5) * dotSpacing * 0.6 : 0;
          const dotR = rng ? dotSpacing * (0.15 + rng() * 0.2) : dotSpacing * 0.2;
          ctx.beginPath();
          ctx.arc(dx + jx, dy + jy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = savedAlphaS;
      // Outline
      ctx.globalAlpha *= 0.4;
      ctx.stroke();
      ctx.globalAlpha /= 0.4;
      break;
    }

    case "stencil": {
      // Negative-space cutout — fill a rectangle, then erase the shape
      const savedAlphaSt = ctx.globalAlpha;
      // Fill a bounding area with the stroke color
      ctx.globalAlpha = savedAlphaSt * 0.5;
      ctx.fillStyle = strokeColor;
      ctx.fillRect(-size * 0.6, -size * 0.6, size * 1.2, size * 1.2);
      // Cut out the shape using destination-out
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = savedAlphaSt;
      // Subtle outline of the cutout
      ctx.globalAlpha *= 0.3;
      ctx.stroke();
      ctx.globalAlpha /= 0.3;
      break;
    }

    case "noise-grain": {
      // Procedural noise grain texture clipped to shape boundary
      const savedAlphaN = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaN * 0.25;
      ctx.fill(); // base tint
      ctx.globalAlpha = savedAlphaN;

      ctx.save();
      ctx.clip();
      const grainSpacing = Math.max(1.5, size * 0.015);
      const extentN = size * 0.55;
      ctx.globalAlpha = savedAlphaN * 0.6;
      for (let gx = -extentN; gx <= extentN; gx += grainSpacing) {
        for (let gy = -extentN; gy <= extentN; gy += grainSpacing) {
          if (!rng) break;
          const jx = (rng() - 0.5) * grainSpacing * 1.2;
          const jy = (rng() - 0.5) * grainSpacing * 1.2;
          const brightness = rng() > 0.5 ? 255 : 0;
          const dotAlpha = 0.15 + rng() * 0.35;
          ctx.globalAlpha = savedAlphaN * dotAlpha;
          ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},1)`;
          const dotSize = grainSpacing * (0.3 + rng() * 0.5);
          ctx.fillRect(gx + jx, gy + jy, dotSize, dotSize);
        }
      }
      ctx.restore();
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = savedAlphaN;
      ctx.globalAlpha *= 0.4;
      ctx.stroke();
      ctx.globalAlpha /= 0.4;
      break;
    }

    case "wood-grain": {
      // Parallel wavy lines simulating wood grain, clipped to shape
      const savedAlphaW = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaW * 0.2;
      ctx.fill(); // base tint
      ctx.globalAlpha = savedAlphaW;

      ctx.save();
      ctx.clip();
      const grainLineSpacing = Math.max(2, size * 0.035);
      const extentW = size * 0.55;
      const waveFreq = rng ? 3 + rng() * 5 : 5;
      const waveAmp = rng ? size * (0.01 + rng() * 0.03) : size * 0.02;
      const grainAngle = rng ? rng() * Math.PI : Math.PI * 0.25;
      ctx.lineWidth = Math.max(0.5, strokeWidth * 0.3);
      ctx.globalAlpha = savedAlphaW * 0.5;

      const cosG = Math.cos(grainAngle);
      const sinG = Math.sin(grainAngle);
      for (let d = -extentW; d <= extentW; d += grainLineSpacing) {
        ctx.beginPath();
        for (let t = -extentW; t <= extentW; t += 2) {
          const wave = Math.sin((t / extentW) * waveFreq * Math.PI) * waveAmp;
          const px = t * cosG - (d + wave) * sinG;
          const py = t * sinG + (d + wave) * cosG;
          if (t === -extentW) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = savedAlphaW;
      ctx.globalAlpha *= 0.35;
      ctx.stroke();
      ctx.globalAlpha /= 0.35;
      break;
    }

    case "marble-vein": {
      // Branching vein lines on a soft fill, clipped to shape
      const savedAlphaM = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaM * 0.35;
      ctx.fill(); // soft base
      ctx.globalAlpha = savedAlphaM;

      ctx.save();
      ctx.clip();
      const veinCount = rng ? 2 + Math.floor(rng() * 3) : 3;
      const extentM = size * 0.45;
      ctx.lineWidth = Math.max(0.5, strokeWidth * 0.5);
      ctx.globalAlpha = savedAlphaM * 0.4;

      for (let v = 0; v < veinCount; v++) {
        const startX = rng ? (rng() - 0.5) * extentM * 2 : 0;
        const startY = rng ? -extentM + rng() * extentM * 0.5 : -extentM;
        let vx = startX;
        let vy = startY;
        const steps = 15 + (rng ? Math.floor(rng() * 15) : 10);
        const stepLen = size * 0.04;

        ctx.beginPath();
        ctx.moveTo(vx, vy);
        for (let s = 0; s < steps; s++) {
          const drift = rng ? (rng() - 0.5) * stepLen * 1.5 : 0;
          vx += drift;
          vy += stepLen;
          ctx.lineTo(vx, vy);
          // Branch ~20% of the time
          if (rng && rng() < 0.2 && s > 2 && s < steps - 3) {
            const branchDir = rng() < 0.5 ? -1 : 1;
            let bx = vx;
            let by = vy;
            const bSteps = 3 + Math.floor(rng() * 5);
            ctx.moveTo(bx, by);
            for (let bs = 0; bs < bSteps; bs++) {
              bx += branchDir * stepLen * (0.5 + rng() * 0.5);
              by += stepLen * 0.6;
              ctx.lineTo(bx, by);
            }
            ctx.moveTo(vx, vy); // return to main vein
          }
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = savedAlphaM;
      ctx.globalAlpha *= 0.3;
      ctx.stroke();
      ctx.globalAlpha /= 0.3;
      break;
    }

    case "fabric-weave": {
      // Interlocking horizontal/vertical threads clipped to shape
      const savedAlphaF = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaF * 0.15;
      ctx.fill(); // ghost base
      ctx.globalAlpha = savedAlphaF;

      ctx.save();
      ctx.clip();
      const threadSpacing = Math.max(2, size * 0.04);
      const extentF = size * 0.55;
      ctx.lineWidth = Math.max(0.8, threadSpacing * 0.5);
      ctx.globalAlpha = savedAlphaF * 0.55;

      // Horizontal threads
      for (let y = -extentF; y <= extentF; y += threadSpacing * 2) {
        ctx.beginPath();
        ctx.moveTo(-extentF, y);
        ctx.lineTo(extentF, y);
        ctx.stroke();
      }
      // Vertical threads (offset by half spacing for weave effect)
      ctx.globalAlpha = savedAlphaF * 0.45;
      ctx.strokeStyle = fillColor;
      for (let x = -extentF; x <= extentF; x += threadSpacing * 2) {
        ctx.beginPath();
        for (let y = -extentF; y <= extentF; y += threadSpacing * 2) {
          // Over-under: draw segment, skip segment
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + threadSpacing);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = strokeColor;
      ctx.restore();
      ctx.globalAlpha = savedAlphaF;
      ctx.globalAlpha *= 0.3;
      ctx.stroke();
      ctx.globalAlpha /= 0.3;
      break;
    }

    case "hand-drawn": {
      // Wobbly hand-drawn edge treatment — fill normally, then redraw
      // the outline with perturbed control points for a sketchy feel
      const savedAlphaHD = ctx.globalAlpha;
      ctx.globalAlpha = savedAlphaHD * 0.85;
      ctx.fill();
      ctx.globalAlpha = savedAlphaHD;

      // Draw 2-3 slightly offset wobbly strokes for a sketchy look
      const wobblePasses = 2 + (rng ? Math.floor(rng() * 2) : 0);
      ctx.lineWidth = strokeWidth * 0.8;
      for (let wp = 0; wp < wobblePasses; wp++) {
        ctx.globalAlpha = savedAlphaHD * (0.4 - wp * 0.1);
        ctx.save();
        // Slight random offset per pass
        const wobbleX = rng ? (rng() - 0.5) * size * 0.02 : 0;
        const wobbleY = rng ? (rng() - 0.5) * size * 0.02 : 0;
        ctx.translate(wobbleX, wobbleY);
        // Slightly different scale per pass for edge variation
        const wobbleScale = 1 + (rng ? (rng() - 0.5) * 0.03 : 0);
        ctx.scale(wobbleScale, wobbleScale);
        ctx.stroke();
        ctx.restore();
      }

      // Organic edge erosion — small irregular bites for rough paper feel
      if (rng && size > 20) {
        const erosionBites = 4 + Math.floor(rng() * 6);
        const edgeRadius = size * 0.42;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.5 + rng() * 0.3;
        for (let eb = 0; eb < erosionBites; eb++) {
          const biteAngle = rng() * Math.PI * 2;
          const biteDist = edgeRadius * (0.9 + rng() * 0.2);
          const biteR = size * (0.015 + rng() * 0.03);
          ctx.beginPath();
          ctx.arc(
            Math.cos(biteAngle) * biteDist,
            Math.sin(biteAngle) * biteDist,
            biteR, 0, Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.globalAlpha = savedAlphaHD;
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
    lightAngle,
    scaleFactor = 1,
  } = config;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);

  // ── Drop shadow — soft colored shadow offset along light direction ──
  if (lightAngle !== undefined && size > 10) {
    const shadowDist = size * 0.035;
    const shadowBlurR = size * 0.06;
    ctx.shadowOffsetX = Math.cos(lightAngle + Math.PI) * shadowDist;
    ctx.shadowOffsetY = Math.sin(lightAngle + Math.PI) * shadowDist;
    ctx.shadowBlur = shadowBlurR;
    ctx.shadowColor = "rgba(0,0,0,0.12)";
  } else if (glowRadius > 0) {
    // Glow / shadow effect (legacy path)
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

  // Reset shadow so patterns and highlight aren't double-shadowed
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = "transparent";

  // ── Specular highlight — bright arc on the light-facing side ──
  if (lightAngle !== undefined && size > 15 && rng) {
    const hlRadius = size * 0.35;
    const hlDist = size * 0.15;
    const hlX = Math.cos(lightAngle) * hlDist;
    const hlY = Math.sin(lightAngle) * hlDist;
    const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlRadius);
    hlGrad.addColorStop(0, "rgba(255,255,255,0.18)");
    hlGrad.addColorStop(0.5, "rgba(255,255,255,0.05)");
    hlGrad.addColorStop(1, "rgba(255,255,255,0)");
    const savedOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(hlX, hlY, hlRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = savedOp;
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

// ── Shape mirroring effect ──────────────────────────────────────────
// Draws a shape and its mirror (reflected across an axis) for visual
// symmetry. Works especially well with basic shapes like triangles,
// crescents, and penrose tiles.

export type MirrorAxis = "horizontal" | "vertical" | "diagonal" | "radial-4";

/**
 * Draw a shape with a mirrored reflection.
 * The mirror is drawn at reduced opacity with optional offset.
 */
export function drawMirroredShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  config: EnhanceShapeConfig & { mirrorAxis?: MirrorAxis; mirrorGap?: number },
): void {
  const { mirrorAxis = "horizontal", mirrorGap = 0 } = config;

  // Draw the primary shape
  enhanceShapeGeneration(ctx, shape, x, y, config);

  // Draw the mirrored copy
  ctx.save();
  const savedAlpha = ctx.globalAlpha;
  ctx.globalAlpha = savedAlpha * 0.7; // mirror is slightly softer

  switch (mirrorAxis) {
    case "horizontal":
      // Reflect across vertical axis at shape position
      enhanceShapeGeneration(ctx, shape, x, y + mirrorGap, {
        ...config,
        rotation: -(config.rotation || 0),
        size: config.size * 0.95,
      });
      break;
    case "vertical":
      enhanceShapeGeneration(ctx, shape, x + mirrorGap, y, {
        ...config,
        rotation: 180 - (config.rotation || 0),
        size: config.size * 0.95,
      });
      break;
    case "diagonal":
      // Reflect across 45° axis
      enhanceShapeGeneration(ctx, shape, x + mirrorGap * 0.7, y + mirrorGap * 0.7, {
        ...config,
        rotation: 90 - (config.rotation || 0),
        size: config.size * 0.9,
      });
      break;
    case "radial-4":
      // Four-way radial mirror
      for (let i = 1; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const mx = x + Math.cos(angle) * mirrorGap;
        const my = y + Math.sin(angle) * mirrorGap;
        ctx.globalAlpha = savedAlpha * (0.7 - i * 0.1);
        enhanceShapeGeneration(ctx, shape, mx, my, {
          ...config,
          rotation: (config.rotation || 0) + i * 90,
          size: config.size * (0.95 - i * 0.05),
        });
      }
      break;
  }

  ctx.globalAlpha = savedAlpha;
  ctx.restore();
}

/**
 * Pick a mirror axis deterministically.
 * Returns null ~60% of the time (no mirroring).
 */
export function pickMirrorAxis(rng: () => number): MirrorAxis | null {
  const roll = rng();
  if (roll < 0.60) return null;
  if (roll < 0.75) return "horizontal";
  if (roll < 0.87) return "vertical";
  if (roll < 0.95) return "diagonal";
  return "radial-4";
}
