/**
 * Pure rendering logic — environment-agnostic.
 *
 * Uses only the standard CanvasRenderingContext2D API so it works
 * identically in Node (@napi-rs/canvas) and browsers.
 *
 * Generation pipeline:
 *   0.  Archetype selection + shape palette + color hierarchy
 *   1.  Background — style from archetype, gradient mesh for depth
 *   1b. Layered background — archetype-coherent shapes
 *   2.  Composition mode + symmetry
 *   3.  Focal points + void zones + hero avoidance field
 *   4.  Flow field
 *   4b. Hero shape
 *   5.  Shape layers — palette-driven selection, affinity-aware styles,
 *       size echo, tangent placement, atmospheric depth
 *   5b. Recursive nesting
 *   6.  Flow lines — variable color, branching, pressure simulation
 *   6b. Symmetry mirroring
 *   7.  Noise texture
 *   8.  Vignette
 *   9.  Organic connecting curves
 *   10. Post-processing — color grading, chromatic aberration, bloom
 */
import {
    SacredColorScheme,
    hexWithAlpha, jitterColorHSL,
    desaturate,
    shiftTemperature,
    luminance,
    enforceContrast,
    buildColorHierarchy,
    pickHierarchyColor, pickColorGrade,
    type ColorHierarchy
} from "./canvas/colors";
import {
    enhanceShapeGeneration,
    drawMirroredShape,
    pickMirrorAxis,
    pickBlendMode,
    pickRenderStyle,
    type RenderStyle
} from "./canvas/draw";
import { shapes } from "./canvas/shapes";
import {
    buildShapePalette,
    pickShapeFromPalette,
    pickStyleForShape,
    SHAPE_PROFILES
} from "./canvas/shapes/affinity";
import { createRng, seedFromHash } from "./utils";
import { DEFAULT_CONFIG, type GenerationConfig } from "../types";
import { selectArchetype, type BackgroundStyle } from "./archetypes";


// ── Shape categories for weighted selection (legacy fallback) ───────

const SACRED_SHAPES = [
  "mandala",
  "flowerOfLife",
  "treeOfLife",
  "metatronsCube",
  "sriYantra",
  "seedOfLife",
  "vesicaPiscis",
  "torus",
  "eggOfLife",
];

// ── Composition modes ───────────────────────────────────────────────

type CompositionMode =
  | "radial"
  | "flow-field"
  | "spiral"
  | "grid-subdivision"
  | "clustered";

const COMPOSITION_MODES: CompositionMode[] = [
  "radial",
  "flow-field",
  "spiral",
  "grid-subdivision",
  "clustered",
];

// ── Helper: get position based on composition mode ──────────────────

function getCompositionPosition(
  mode: CompositionMode,
  rng: () => number,
  width: number,
  height: number,
  shapeIndex: number,
  totalShapes: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  switch (mode) {
    case "radial": {
      const angle = rng() * Math.PI * 2;
      const maxR = Math.min(width, height) * 0.45;
      const r = Math.pow(rng(), 0.7) * maxR;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }
    case "spiral": {
      const t = shapeIndex / totalShapes;
      const turns = 3 + rng() * 2;
      const angle = t * Math.PI * 2 * turns;
      const maxR = Math.min(width, height) * 0.42;
      const r = t * maxR + (rng() - 0.5) * maxR * 0.15;
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }
    case "grid-subdivision": {
      const cells = 3 + Math.floor(rng() * 3);
      const cellW = width / cells;
      const cellH = height / cells;
      const gx = Math.floor(rng() * cells);
      const gy = Math.floor(rng() * cells);
      return {
        x: gx * cellW + rng() * cellW,
        y: gy * cellH + rng() * cellH,
      };
    }
    case "clustered": {
      const numClusters = 3 + Math.floor(rng() * 3);
      const ci = Math.floor(rng() * numClusters);
      const clusterRng = createRng(seedFromHash(String(ci), 999));
      const clx = width * (0.15 + clusterRng() * 0.7);
      const cly = height * (0.15 + clusterRng() * 0.7);
      const spread = Math.min(width, height) * 0.18;
      return {
        x: clx + (rng() - 0.5) * spread * 2,
        y: cly + (rng() - 0.5) * spread * 2,
      };
    }
    case "flow-field":
    default: {
      return { x: rng() * width, y: rng() * height };
    }
  }
}

// ── Helper: positional color from hierarchy ─────────────────────────

function getPositionalColor(
  x: number,
  y: number,
  width: number,
  height: number,
  hierarchy: ColorHierarchy,
  rng: () => number,
): string {
  // Blend position into color selection — shapes near center lean dominant
  const distFromCenter = Math.hypot(x - width / 2, y - height / 2) /
    Math.hypot(width / 2, height / 2);
  // Center = more dominant, edges = more accent
  if (distFromCenter < 0.35) {
    return jitterColorHSL(hierarchy.dominant, rng, 10, 0.08);
  } else if (distFromCenter < 0.7) {
    return jitterColorHSL(pickHierarchyColor(hierarchy, rng), rng, 8, 0.06);
  } else {
    // Edges: bias toward secondary/accent
    const roll = rng();
    const color = roll < 0.4 ? hierarchy.secondary : roll < 0.75 ? hierarchy.accent : hierarchy.dominant;
    return jitterColorHSL(color, rng, 12, 0.08);
  }
}

// ── Helper: check if a position is inside a void zone ───────────────

function isInVoidZone(
  x: number,
  y: number,
  voidZones: Array<{ x: number; y: number; radius: number }>,
): boolean {
  for (const zone of voidZones) {
    if (Math.hypot(x - zone.x, y - zone.y) < zone.radius) return true;
  }
  return false;
}

// ── Helper: density check ───────────────────────────────────────────

function localDensity(
  x: number,
  y: number,
  positions: Array<{ x: number; y: number; size: number }>,
  radius: number,
): number {
  let count = 0;
  for (const p of positions) {
    if (Math.hypot(x - p.x, y - p.y) < radius) count++;
  }
  return count;
}

// ── Helper: draw background based on archetype style ────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  style: BackgroundStyle,
  bgStart: string,
  bgEnd: string,
  width: number,
  height: number,
  cx: number,
  cy: number,
  bgRadius: number,
  rng: () => number,
  colors: string[],
): void {
  switch (style) {
    case "radial-light": {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgRadius);
      grad.addColorStop(0, "#f0ece4");
      grad.addColorStop(1, bgStart);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "linear-horizontal": {
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, bgStart);
      grad.addColorStop(1, bgEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "linear-diagonal": {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, bgStart);
      grad.addColorStop(0.5, bgEnd);
      grad.addColorStop(1, bgStart);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "solid-dark": {
      ctx.fillStyle = bgStart;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "solid-light": {
      ctx.fillStyle = "#f5f2eb";
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "multi-stop": {
      const grad = ctx.createLinearGradient(0, 0, width * 0.7, height);
      grad.addColorStop(0, bgStart);
      grad.addColorStop(0.33, bgEnd);
      if (colors.length > 0) {
        const midColor = hexWithAlpha(colors[0], 1).replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, (_, r, g, b) => {
          const darken = (v: string) => Math.round(parseInt(v) * 0.4).toString(16).padStart(2, "0");
          return `#${darken(r)}${darken(g)}${darken(b)}`;
        });
        grad.addColorStop(0.66, midColor);
      }
      grad.addColorStop(1, bgStart);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case "radial-dark":
    default: {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgRadius);
      grad.addColorStop(0, bgStart);
      grad.addColorStop(1, bgEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }
}

// ── Shape constellations — pre-composed groups of shapes ────────

interface ConstellationDef {
  name: string;
  /** Generate member positions/shapes relative to center */
  build: (rng: () => number, baseSize: number) => Array<{
    dx: number; dy: number; shape: string; size: number; rotation: number;
  }>;
}

const CONSTELLATIONS: ConstellationDef[] = [
  {
    name: "flanked-triangle",
    build: (rng, baseSize) => {
      const gap = baseSize * (0.6 + rng() * 0.3);
      return [
        { dx: 0, dy: 0, shape: "triangle", size: baseSize, rotation: rng() * 360 },
        { dx: -gap, dy: gap * 0.3, shape: "circle", size: baseSize * 0.35, rotation: 0 },
        { dx: gap, dy: gap * 0.3, shape: "circle", size: baseSize * 0.35, rotation: 0 },
      ];
    },
  },
  {
    name: "hexagon-ring",
    build: (rng, baseSize) => {
      const members: Array<{ dx: number; dy: number; shape: string; size: number; rotation: number }> = [];
      const count = 5 + Math.floor(rng() * 2);
      const ringR = baseSize * 0.6;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        members.push({
          dx: Math.cos(angle) * ringR,
          dy: Math.sin(angle) * ringR,
          shape: "hexagon",
          size: baseSize * (0.25 + rng() * 0.1),
          rotation: (angle * 180) / Math.PI,
        });
      }
      return members;
    },
  },
  {
    name: "spiral-dots",
    build: (rng, baseSize) => {
      const members: Array<{ dx: number; dy: number; shape: string; size: number; rotation: number }> = [];
      const count = 7 + Math.floor(rng() * 5);
      const turns = 1.5 + rng();
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 2 * turns;
        const r = t * baseSize * 0.7;
        members.push({
          dx: Math.cos(angle) * r,
          dy: Math.sin(angle) * r,
          shape: "circle",
          size: baseSize * (0.08 + (1 - t) * 0.12),
          rotation: 0,
        });
      }
      return members;
    },
  },
  {
    name: "diamond-cluster",
    build: (rng, baseSize) => {
      const gap = baseSize * 0.45;
      return [
        { dx: 0, dy: -gap, shape: "diamond", size: baseSize * 0.4, rotation: 0 },
        { dx: gap, dy: 0, shape: "diamond", size: baseSize * 0.35, rotation: 15 },
        { dx: 0, dy: gap, shape: "diamond", size: baseSize * 0.3, rotation: 30 },
        { dx: -gap, dy: 0, shape: "diamond", size: baseSize * 0.35, rotation: -15 },
      ];
    },
  },
  {
    name: "crescent-pair",
    build: (rng, baseSize) => {
      const gap = baseSize * 0.5;
      return [
        { dx: -gap * 0.4, dy: 0, shape: "crescent", size: baseSize * 0.5, rotation: rng() * 30 },
        { dx: gap * 0.4, dy: 0, shape: "crescent", size: baseSize * 0.45, rotation: 180 + rng() * 30 },
      ];
    },
  },
];

// ── Main render function ────────────────────────────────────────────

export function renderHashArt(
  ctx: CanvasRenderingContext2D,
  gitHash: string,
  config: Partial<GenerationConfig> = {},
): void {
  const finalConfig: GenerationConfig = { ...DEFAULT_CONFIG, ...config };

  const rng = createRng(seedFromHash(gitHash));

  // ── 0. Select archetype — fundamentally different visual personality ──
  const archetype = selectArchetype(rng);

  // Archetype overrides defaults, but explicit user config wins
  const {
    width,
    height,
  } = finalConfig;
  const gridSize = config.gridSize ?? archetype.gridSize;
  const layers = config.layers ?? archetype.layers;
  const minShapeSize = config.minShapeSize ?? archetype.minShapeSize;
  const maxShapeSize = config.maxShapeSize ?? archetype.maxShapeSize;
  const baseOpacity = config.baseOpacity ?? archetype.baseOpacity;
  const opacityReduction = config.opacityReduction ?? archetype.opacityReduction;

  const shapesPerLayer =
    finalConfig.shapesPerLayer || Math.floor(gridSize * gridSize * 1.5);

  const colorScheme = new SacredColorScheme(gitHash);
  const colors = colorScheme.getColorsByMode(archetype.paletteMode);
  const [bgStart, bgEnd] = colorScheme.getBackgroundColorsByMode(archetype.paletteMode);
  const tempMode = colorScheme.getTemperatureMode();
  const fgTempTarget: "warm" | "cool" | null =
    tempMode === "warm-bg" ? "cool" : tempMode === "cool-bg" ? "warm" : null;

  // ── 0b. Color hierarchy — dominant/secondary/accent weighting ──
  const colorHierarchy = buildColorHierarchy(colors, rng);

  // ── 0c. Shape palette — curated shapes that work well together ──
  const shapeNames = Object.keys(shapes);
  const shapePalette = buildShapePalette(rng, shapeNames, archetype.name);

  // ── 0d. Color grading — unified tone for the whole image ───────
  const colorGrade = pickColorGrade(rng);

  // ── 0e. Light direction — consistent shadow angle ──────────────
  const lightAngle = rng() * Math.PI * 2;

  const scaleFactor = Math.min(width, height) / 1024;
  const adjustedMinSize = minShapeSize * scaleFactor;
  const adjustedMaxSize = maxShapeSize * scaleFactor;

  const cx = width / 2;
  const cy = height / 2;

  // ── 1. Background ──────────────────────────────────────────────
  const bgRadius = Math.hypot(cx, cy);
  drawBackground(ctx, archetype.backgroundStyle, bgStart, bgEnd, width, height, cx, cy, bgRadius, rng, colors);

  // Gradient mesh overlay — 3-4 color control points for richer backgrounds
  const meshPoints = 3 + Math.floor(rng() * 2);
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < meshPoints; i++) {
    const mx = rng() * width;
    const my = rng() * height;
    const mRadius = Math.min(width, height) * (0.3 + rng() * 0.4);
    const mColor = pickHierarchyColor(colorHierarchy, rng);
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, mRadius);
    grad.addColorStop(0, hexWithAlpha(mColor, 0.08 + rng() * 0.06));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";

  // Compute average background luminance for contrast enforcement
  const bgLum = (luminance(bgStart) + luminance(bgEnd)) / 2;

  // ── 1b. Layered background — archetype-coherent shapes ─────────
  const bgShapeCount = 3 + Math.floor(rng() * 4);
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < bgShapeCount; i++) {
    const bx = rng() * width;
    const by = rng() * height;
    const bSize = (width * 0.3 + rng() * width * 0.5);
    const bColor = pickHierarchyColor(colorHierarchy, rng);
    ctx.globalAlpha = 0.03 + rng() * 0.05;
    ctx.fillStyle = hexWithAlpha(bColor, 0.15);
    ctx.beginPath();
    // Use archetype-appropriate background shapes
    if (archetype.name === "geometric-precision" || archetype.name === "op-art") {
      // Rectangular shapes for geometric archetypes
      ctx.rect(bx - bSize / 2, by - bSize / 2, bSize, bSize * (0.5 + rng() * 0.5));
    } else {
      ctx.arc(bx, by, bSize / 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // Subtle concentric rings from center
  const ringCount = 2 + Math.floor(rng() * 3);
  ctx.globalAlpha = 0.02 + rng() * 0.03;
  ctx.strokeStyle = hexWithAlpha(colorHierarchy.dominant, 0.1);
  ctx.lineWidth = 1 * scaleFactor;
  for (let i = 1; i <= ringCount; i++) {
    const r = (Math.min(width, height) * 0.15) * i;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // ── 1c. Background pattern layer — subtle textured paper ───────
  const bgPatternRoll = rng();
  if (bgPatternRoll < 0.6) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const patternOpacity = 0.02 + rng() * 0.04;
    const patternColor = hexWithAlpha(colorHierarchy.dominant, 0.15);

    if (bgPatternRoll < 0.2) {
      // Dot grid
      const dotSpacing = Math.max(8, Math.min(width, height) * (0.015 + rng() * 0.015));
      const dotR = dotSpacing * 0.08;
      ctx.globalAlpha = patternOpacity;
      ctx.fillStyle = patternColor;
      for (let px = 0; px < width; px += dotSpacing) {
        for (let py = 0; py < height; py += dotSpacing) {
          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (bgPatternRoll < 0.4) {
      // Diagonal lines
      const lineSpacing = Math.max(6, Math.min(width, height) * (0.02 + rng() * 0.02));
      ctx.globalAlpha = patternOpacity;
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 0.5 * scaleFactor;
      const diag = Math.hypot(width, height);
      for (let d = -diag; d < diag; d += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + height, height);
        ctx.stroke();
      }
    } else {
      // Tessellation — hexagonal grid of tiny shapes
      const tessSize = Math.max(10, Math.min(width, height) * (0.025 + rng() * 0.02));
      const tessH = tessSize * Math.sqrt(3);
      ctx.globalAlpha = patternOpacity * 0.7;
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 0.4 * scaleFactor;
      for (let row = 0; row * tessH < height + tessH; row++) {
        const offsetX = (row % 2) * tessSize * 0.75;
        for (let col = 0; col * tessSize * 1.5 < width + tessSize * 1.5; col++) {
          const hx = col * tessSize * 1.5 + offsetX;
          const hy = row * tessH;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const angle = (Math.PI / 3) * s - Math.PI / 6;
            const vx = hx + Math.cos(angle) * tessSize * 0.5;
            const vy = hy + Math.sin(angle) * tessSize * 0.5;
            if (s === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";

  // ── 2. Composition mode ────────────────────────────────────────
  const compositionMode =
    COMPOSITION_MODES[Math.floor(rng() * COMPOSITION_MODES.length)];

  // ── 2b. Symmetry mode — ~25% of hashes trigger mirroring ──────
  type SymmetryMode = "none" | "bilateral-x" | "bilateral-y" | "quad";
  const symRoll = rng();
  const symmetryMode: SymmetryMode =
    symRoll < 0.10 ? "bilateral-x" :
    symRoll < 0.20 ? "bilateral-y" :
    symRoll < 0.25 ? "quad" : "none";

  // ── 3. Focal points + void zones ───────────────────────────────
  const THIRDS_POINTS = [
    { x: 1 / 3, y: 1 / 3 },
    { x: 2 / 3, y: 1 / 3 },
    { x: 1 / 3, y: 2 / 3 },
    { x: 2 / 3, y: 2 / 3 },
  ];
  const numFocal = 1 + Math.floor(rng() * 2);
  const focalPoints: Array<{ x: number; y: number; strength: number }> = [];
  for (let f = 0; f < numFocal; f++) {
    if (rng() < 0.7) {
      const tp = THIRDS_POINTS[Math.floor(rng() * THIRDS_POINTS.length)];
      focalPoints.push({
        x: width * (tp.x + (rng() - 0.5) * 0.08),
        y: height * (tp.y + (rng() - 0.5) * 0.08),
        strength: 0.3 + rng() * 0.4,
      });
    } else {
      focalPoints.push({
        x: width * (0.2 + rng() * 0.6),
        y: height * (0.2 + rng() * 0.6),
        strength: 0.3 + rng() * 0.4,
      });
    }
  }

  const numVoids = Math.floor(rng() * 2) + 1;
  const voidZones: Array<{ x: number; y: number; radius: number }> = [];
  for (let v = 0; v < numVoids; v++) {
    voidZones.push({
      x: width * (0.15 + rng() * 0.7),
      y: height * (0.15 + rng() * 0.7),
      radius: Math.min(width, height) * (0.06 + rng() * 0.1),
    });
  }

  function applyFocalBias(rx: number, ry: number): [number, number] {
    let nearest = focalPoints[0];
    let minDist = Infinity;
    for (const fp of focalPoints) {
      const d = Math.hypot(rx - fp.x, ry - fp.y);
      if (d < minDist) {
        minDist = d;
        nearest = fp;
      }
    }
    const pull = nearest.strength * rng() * 0.5;
    return [rx + (nearest.x - rx) * pull, ry + (nearest.y - ry) * pull];
  }

  // ── 4. Flow field seed values ──────────────────────────────────
  const fieldAngleBase = rng() * Math.PI * 2;
  const fieldFreq = 0.5 + rng() * 2;

  function flowAngle(x: number, y: number): number {
    return (
      fieldAngleBase +
      Math.sin((x / width) * fieldFreq * Math.PI * 2) * Math.PI * 0.5 +
      Math.cos((y / height) * fieldFreq * Math.PI * 2) * Math.PI * 0.5
    );
  }

  // Track all placed shapes for density checks and connecting curves
  const shapePositions: Array<{ x: number; y: number; size: number; shape: string }> = [];

  // Hero avoidance radius — shapes near the hero orient toward it
  let heroCenter: { x: number; y: number; size: number } | null = null;

  // ── 4b. Hero shape — a dominant focal element ───────────────────
  if (archetype.heroShape && rng() < 0.6) {
    const heroFocal = focalPoints[0];
    // Use shape palette hero candidates
    const heroPool = [...shapePalette.primary, ...shapePalette.supporting]
      .filter((s) => SHAPE_PROFILES[s]?.heroCandidate && shapeNames.includes(s));
    const heroShape = heroPool.length > 0
      ? heroPool[Math.floor(rng() * heroPool.length)]
      : shapeNames[Math.floor(rng() * shapeNames.length)];

    const heroSize = adjustedMaxSize * (0.8 + rng() * 0.5);
    const heroRotation = rng() * 360;
    const heroFill = hexWithAlpha(
      enforceContrast(jitterColorHSL(colorHierarchy.dominant, rng, 6, 0.05), bgLum),
      0.15 + rng() * 0.2,
    );
    const heroStroke = enforceContrast(jitterColorHSL(colorHierarchy.accent, rng, 6, 0.05), bgLum);

    // Get best style for this hero shape
    const heroProfile = SHAPE_PROFILES[heroShape];
    const heroStyle: RenderStyle = heroProfile
      ? (heroProfile.bestStyles[Math.floor(rng() * heroProfile.bestStyles.length)] as RenderStyle)
      : (rng() < 0.4 ? "watercolor" : "fill-and-stroke");

    ctx.globalAlpha = 0.5 + rng() * 0.2;
    enhanceShapeGeneration(ctx, heroShape, heroFocal.x, heroFocal.y, {
      fillColor: heroFill,
      strokeColor: heroStroke,
      strokeWidth: (1.5 + rng() * 2) * scaleFactor,
      size: heroSize,
      rotation: heroRotation,
      proportionType: "GOLDEN_RATIO",
      glowRadius: (12 + rng() * 20) * scaleFactor,
      glowColor: hexWithAlpha(heroStroke, 0.4),
      gradientFillEnd: jitterColorHSL(colorHierarchy.secondary, rng, 10, 0.1),
      renderStyle: heroStyle,
      rng,
    });

    heroCenter = { x: heroFocal.x, y: heroFocal.y, size: heroSize };
    shapePositions.push({ x: heroFocal.x, y: heroFocal.y, size: heroSize, shape: heroShape });
  }


  // ── 5. Shape layers ────────────────────────────────────────────
  const densityCheckRadius = Math.min(width, height) * 0.08;
  const maxLocalDensity = Math.ceil(shapesPerLayer * 0.15);

  for (let layer = 0; layer < layers; layer++) {
    const layerRatio = layers > 1 ? layer / (layers - 1) : 0;
    const numShapes =
      shapesPerLayer +
      Math.floor(rng() * shapesPerLayer * 0.3);
    const layerOpacity = Math.max(0.15, baseOpacity - layer * opacityReduction);
    const layerSizeScale = 1 - layer * 0.15;

    // Per-layer blend mode
    const layerBlend = pickBlendMode(rng);
    ctx.globalCompositeOperation = layerBlend;

    // Per-layer render style bias — prefer archetype styles
    const layerRenderStyle: RenderStyle = rng() < 0.6
      ? archetype.preferredStyles[Math.floor(rng() * archetype.preferredStyles.length)]
      : pickRenderStyle(rng);

    // Atmospheric desaturation for later layers
    const atmosphericDesat = layerRatio * 0.3;

    // Depth-of-field simulation — later layers are "further away"
    // Reduce stroke widths and shift colors toward the background
    const dofFactor = 1 - layerRatio * 0.5; // 1.0 for front layer, 0.5 for back
    const dofStrokeScale = 0.4 + dofFactor * 0.6; // strokes thin out with depth
    const dofContrastReduction = layerRatio * 0.2; // colors fade toward bg

    for (let i = 0; i < numShapes; i++) {
      // Position from composition mode, then focal bias
      const rawPos = getCompositionPosition(
        compositionMode,
        rng,
        width,
        height,
        i,
        numShapes,
        cx,
        cy,
      );
      const [x, y] = applyFocalBias(rawPos.x, rawPos.y);

      // Skip shapes in void zones, reduce in dense areas
      if (isInVoidZone(x, y, voidZones)) {
        if (rng() < 0.85) continue;
      }
      if (localDensity(x, y, shapePositions, densityCheckRadius) > maxLocalDensity) {
        if (rng() < 0.6) continue;
      }

      // Power distribution for size — archetype controls the curve
      const sizeT = Math.pow(rng(), archetype.sizePower);
      const size =
        (adjustedMinSize + sizeT * (adjustedMaxSize - adjustedMinSize)) *
        layerSizeScale;

      // Size fraction for affinity-aware shape selection
      const sizeFraction = size / adjustedMaxSize;

      // Palette-driven shape selection (replaces naive pickShape)
      const shape = pickShapeFromPalette(shapePalette, rng, sizeFraction);

      // Flow-field rotation in flow-field mode, random otherwise
      let rotation =
        compositionMode === "flow-field"
          ? (flowAngle(x, y) * 180) / Math.PI + (rng() - 0.5) * 30
          : rng() * 360;

      // Hero avoidance: shapes near the hero orient toward it
      if (heroCenter) {
        const distToHero = Math.hypot(x - heroCenter.x, y - heroCenter.y);
        const heroInfluence = heroCenter.size * 1.5;
        if (distToHero < heroInfluence && distToHero > 0) {
          const angleToHero = Math.atan2(heroCenter.y - y, heroCenter.x - x) * 180 / Math.PI;
          const blendFactor = 1 - (distToHero / heroInfluence);
          rotation = rotation + (angleToHero - rotation) * blendFactor * 0.4;
        }
      }

      // Positional color from hierarchy + jitter
      let fillBase = getPositionalColor(x, y, width, height, colorHierarchy, rng);
      const strokeBase = pickHierarchyColor(colorHierarchy, rng);

      // Desaturate colors on later layers for depth
      if (atmosphericDesat > 0) {
        fillBase = desaturate(fillBase, atmosphericDesat);
      }

      // Temperature contrast: shift foreground shapes opposite to background
      if (fgTempTarget) {
        fillBase = shiftTemperature(fillBase, fgTempTarget, 0.15 + layerRatio * 0.1);
      }

      const fillColor = enforceContrast(jitterColorHSL(fillBase, rng, 6, 0.05), bgLum);
      const strokeColor = enforceContrast(jitterColorHSL(strokeBase, rng, 5, 0.04), bgLum);

      // Semi-transparent fill
      const fillAlpha = 0.2 + rng() * 0.5;
      const transparentFill = hexWithAlpha(fillColor, fillAlpha);

      const strokeWidth = (0.5 + rng() * 2.0) * scaleFactor * dofStrokeScale;

      // Depth-of-field: reduce opacity slightly for distant layers
      const dofOpacityScale = 1 - dofContrastReduction;
      ctx.globalAlpha = layerOpacity * (0.5 + rng() * 0.5) * dofOpacityScale;

      // Glow on sacred shapes more often — scaled by archetype
      const isSacred = SACRED_SHAPES.includes(shape);
      const baseGlowChance = isSacred ? 0.45 : 0.2;
      const glowChance = baseGlowChance * archetype.glowMultiplier;
      const hasGlow = rng() < glowChance;
      const glowRadius = hasGlow ? (8 + rng() * 20) * scaleFactor : 0;

      // Gradient fill on ~30%
      const hasGradient = rng() < 0.3;
      const gradientEnd = hasGradient
        ? jitterColorHSL(pickHierarchyColor(colorHierarchy, rng), rng, 10, 0.1)
        : undefined;

      // Affinity-aware render style selection
      const shapeRenderStyle = pickStyleForShape(shape, layerRenderStyle, rng) as RenderStyle;

      // Organic edge jitter — applied via watercolor style on ~15% of shapes
      const useOrganicEdges = rng() < 0.15 && shapeRenderStyle === "fill-and-stroke";
      const finalRenderStyle = useOrganicEdges ? "watercolor" as RenderStyle : shapeRenderStyle;

      // Consistent light direction — subtle shadow offset
      const shadowDist = hasGlow ? 0 : (size * 0.02);
      const shadowOffX = shadowDist * Math.cos(lightAngle);
      const shadowOffY = shadowDist * Math.sin(lightAngle);

      // ── 5a. Tangent placement — nudge toward nearest shape edge ──
      let finalX = x;
      let finalY = y;
      if (shapePositions.length > 0 && rng() < 0.25) {
        // Find nearest placed shape
        let nearestDist = Infinity;
        let nearestPos: { x: number; y: number; size: number } | null = null;
        for (const sp of shapePositions) {
          const d = Math.hypot(x - sp.x, y - sp.y);
          if (d < nearestDist && d > 0) {
            nearestDist = d;
            nearestPos = sp;
          }
        }
        if (nearestPos) {
          // Target distance: edges kissing (sum of half-sizes)
          const targetDist = (size + nearestPos.size) * 0.5;
          if (nearestDist > targetDist * 0.5 && nearestDist < targetDist * 3) {
            const angle = Math.atan2(y - nearestPos.y, x - nearestPos.x);
            finalX = nearestPos.x + Math.cos(angle) * targetDist;
            finalY = nearestPos.y + Math.sin(angle) * targetDist;
            // Keep in bounds
            finalX = Math.max(0, Math.min(width, finalX));
            finalY = Math.max(0, Math.min(height, finalY));
          }
        }
      }

      // ── 5b. Shape mirroring — basic shapes get reflected copies ──
      const mirrorAxis = pickMirrorAxis(rng);
      const isBasicShape = ["circle", "triangle", "square", "hexagon", "star",
        "diamond", "crescent", "penroseTile", "reuleauxTriangle"].includes(shape);
      const shouldMirror = mirrorAxis !== null && isBasicShape && size > adjustedMaxSize * 0.2;

      const shapeConfig = {
        fillColor: transparentFill,
        strokeColor,
        strokeWidth,
        size,
        rotation,
        proportionType: "GOLDEN_RATIO" as const,
        glowRadius: glowRadius || (shadowDist > 0 ? shadowDist * 2 : 0),
        glowColor: hasGlow
          ? hexWithAlpha(fillColor, 0.6)
          : (shadowDist > 0 ? "rgba(0,0,0,0.08)" : undefined),
        gradientFillEnd: gradientEnd,
        renderStyle: finalRenderStyle,
        rng,
      };

      if (shouldMirror) {
        drawMirroredShape(ctx, shape, finalX, finalY, {
          ...shapeConfig,
          mirrorAxis: mirrorAxis!,
          mirrorGap: size * (0.1 + rng() * 0.3),
        });
      } else {
        enhanceShapeGeneration(ctx, shape, finalX, finalY, shapeConfig);
      }

      shapePositions.push({ x: finalX, y: finalY, size, shape });

      // ── 5c. Size echo — large shapes spawn trailing smaller copies ──
      if (size > adjustedMaxSize * 0.5 && rng() < 0.2) {
        const echoCount = 2 + Math.floor(rng() * 2);
        const echoAngle = rng() * Math.PI * 2;
        for (let e = 0; e < echoCount; e++) {
          const echoScale = 0.3 - e * 0.08;
          const echoDist = size * (0.6 + e * 0.4);
          const echoX = finalX + Math.cos(echoAngle) * echoDist;
          const echoY = finalY + Math.sin(echoAngle) * echoDist;
          const echoSize = size * Math.max(0.1, echoScale);

          if (echoX < 0 || echoX > width || echoY < 0 || echoY > height) continue;

          ctx.globalAlpha = layerOpacity * (0.4 - e * 0.1);
          enhanceShapeGeneration(ctx, shape, echoX, echoY, {
            fillColor: hexWithAlpha(fillColor, fillAlpha * 0.6),
            strokeColor: hexWithAlpha(strokeColor, 0.4),
            strokeWidth: strokeWidth * 0.6,
            size: echoSize,
            rotation: rotation + (e + 1) * 15,
            proportionType: "GOLDEN_RATIO",
            renderStyle: finalRenderStyle,
            rng,
          });
          shapePositions.push({ x: echoX, y: echoY, size: echoSize, shape });
        }
      }

      // ── 5d. Recursive nesting ──────────────────────────────────
      if (size > adjustedMaxSize * 0.4 && rng() < 0.15) {
        const innerCount = 1 + Math.floor(rng() * 3);
        for (let n = 0; n < innerCount; n++) {
          // Pick inner shape from palette affinities
          const innerSizeFraction = (size * 0.25) / adjustedMaxSize;
          const innerShape = pickShapeFromPalette(shapePalette, rng, innerSizeFraction);
          const innerSize = size * (0.15 + rng() * 0.25);
          const innerOffX = (rng() - 0.5) * size * 0.4;
          const innerOffY = (rng() - 0.5) * size * 0.4;
          const innerRot = rng() * 360;
          const innerFill = hexWithAlpha(
            jitterColorHSL(pickHierarchyColor(colorHierarchy, rng), rng, 10, 0.1),
            0.3 + rng() * 0.4,
          );

          ctx.globalAlpha = layerOpacity * 0.7;
          enhanceShapeGeneration(
            ctx,
            innerShape,
            finalX + innerOffX,
            finalY + innerOffY,
            {
              fillColor: innerFill,
              strokeColor: hexWithAlpha(strokeColor, 0.5),
              strokeWidth: strokeWidth * 0.6,
              size: innerSize,
              rotation: innerRot,
              proportionType: "GOLDEN_RATIO",
              renderStyle: pickStyleForShape(innerShape, layerRenderStyle, rng) as RenderStyle,
              rng,
            },
          );
        }
      }

      // ── 5e. Shape constellations — pre-composed groups ─────────
      if (size > adjustedMaxSize * 0.35 && rng() < 0.12) {
        const constellation = CONSTELLATIONS[Math.floor(rng() * CONSTELLATIONS.length)];
        const members = constellation.build(rng, size);
        const groupRotation = rng() * Math.PI * 2;
        const cosR = Math.cos(groupRotation);
        const sinR = Math.sin(groupRotation);

        for (const member of members) {
          // Rotate the group offset by the group rotation
          const mx = finalX + member.dx * cosR - member.dy * sinR;
          const my = finalY + member.dx * sinR + member.dy * cosR;

          if (mx < 0 || mx > width || my < 0 || my > height) continue;

          const memberFill = hexWithAlpha(
            jitterColorHSL(pickHierarchyColor(colorHierarchy, rng), rng, 8, 0.06),
            fillAlpha * 0.8,
          );
          const memberStroke = enforceContrast(
            jitterColorHSL(strokeBase, rng, 5, 0.04), bgLum,
          );

          ctx.globalAlpha = layerOpacity * 0.6;
          // Use the member's shape if available, otherwise fall back to palette
          const memberShape = shapeNames.includes(member.shape)
            ? member.shape
            : pickShapeFromPalette(shapePalette, rng, member.size / adjustedMaxSize);

          enhanceShapeGeneration(ctx, memberShape, mx, my, {
            fillColor: memberFill,
            strokeColor: memberStroke,
            strokeWidth: strokeWidth * 0.7,
            size: member.size,
            rotation: member.rotation + (groupRotation * 180) / Math.PI,
            proportionType: "GOLDEN_RATIO",
            renderStyle: pickStyleForShape(memberShape, layerRenderStyle, rng) as RenderStyle,
            rng,
          });
          shapePositions.push({ x: mx, y: my, size: member.size, shape: memberShape });
        }
      }
    }
  }

  // Reset blend mode for post-processing passes
  ctx.globalCompositeOperation = "source-over";


  // ── 6. Flow-line pass — variable color, branching, pressure ────
  const baseFlowLines = 6 + Math.floor(rng() * 10);
  const numFlowLines = Math.round(baseFlowLines * archetype.flowLineMultiplier);

  for (let i = 0; i < numFlowLines; i++) {
    let fx = rng() * width;
    let fy = rng() * height;
    const steps = 30 + Math.floor(rng() * 40);
    const stepLen = (3 + rng() * 5) * scaleFactor;
    const startWidth = (1 + rng() * 3) * scaleFactor;

    // Variable color: interpolate between two hierarchy colors along the stroke
    const lineColorStart = enforceContrast(pickHierarchyColor(colorHierarchy, rng), bgLum);
    const lineColorEnd = enforceContrast(pickHierarchyColor(colorHierarchy, rng), bgLum);
    const lineAlpha = 0.06 + rng() * 0.1;

    // Pressure simulation: sinusoidal width variation
    const pressureFreq = 2 + rng() * 4;
    const pressurePhase = rng() * Math.PI * 2;

    let prevX = fx;
    let prevY = fy;
    for (let s = 0; s < steps; s++) {
      const angle = flowAngle(fx, fy) + (rng() - 0.5) * 0.3;
      fx += Math.cos(angle) * stepLen;
      fy += Math.sin(angle) * stepLen;

      if (fx < 0 || fx > width || fy < 0 || fy > height) break;

      const t = s / steps;
      // Taper + pressure
      const taper = 1 - t * 0.8;
      const pressure = 0.6 + 0.4 * Math.sin(t * pressureFreq * Math.PI + pressurePhase);

      ctx.globalAlpha = lineAlpha * taper;
      // Interpolate color along stroke
      const lineColor = t < 0.5
        ? hexWithAlpha(lineColorStart, 0.4 + t * 0.2)
        : hexWithAlpha(lineColorEnd, 0.4 + (1 - t) * 0.2);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = startWidth * taper * pressure;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(fx, fy);
      ctx.stroke();

      // Branching: ~12% chance per step to spawn a thinner child stroke
      if (rng() < 0.12 && s > 5 && s < steps - 10) {
        const branchAngle = angle + (rng() < 0.5 ? 1 : -1) * (0.3 + rng() * 0.5);
        let bx = fx;
        let by = fy;
        let bPrevX = fx;
        let bPrevY = fy;
        const branchSteps = 5 + Math.floor(rng() * 10);
        const branchWidth = startWidth * taper * 0.4;
        for (let bs = 0; bs < branchSteps; bs++) {
          const bAngle = branchAngle + (rng() - 0.5) * 0.2;
          bx += Math.cos(bAngle) * stepLen * 0.8;
          by += Math.sin(bAngle) * stepLen * 0.8;
          if (bx < 0 || bx > width || by < 0 || by > height) break;
          const bTaper = 1 - (bs / branchSteps) * 0.9;
          ctx.globalAlpha = lineAlpha * taper * bTaper * 0.6;
          ctx.lineWidth = branchWidth * bTaper;
          ctx.beginPath();
          ctx.moveTo(bPrevX, bPrevY);
          ctx.lineTo(bx, by);
          ctx.stroke();
          bPrevX = bx;
          bPrevY = by;
        }
      }

      prevX = fx;
      prevY = fy;
    }
  }

  // ── 6b. Apply symmetry mirroring ─────────────────────────────────
  if (symmetryMode !== "none") {
    const canvas = ctx.canvas;
    ctx.save();
    if (symmetryMode === "bilateral-x" || symmetryMode === "quad") {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas, 0, 0, Math.ceil(cx), height, 0, 0, Math.ceil(cx), height);
      ctx.restore();
    }
    if (symmetryMode === "bilateral-y" || symmetryMode === "quad") {
      ctx.save();
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.drawImage(canvas, 0, 0, width, Math.ceil(cy), 0, 0, width, Math.ceil(cy));
      ctx.restore();
    }
    ctx.restore();
  }


  // ── 7. Noise texture overlay ───────────────────────────────────
  const noiseRng = createRng(seedFromHash(gitHash, 777));
  const noiseDensity = Math.floor((width * height) / 800);
  for (let i = 0; i < noiseDensity; i++) {
    const nx = noiseRng() * width;
    const ny = noiseRng() * height;
    const brightness = noiseRng() > 0.5 ? 255 : 0;
    const alpha = 0.01 + noiseRng() * 0.03;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},1)`;
    ctx.fillRect(nx, ny, 1 * scaleFactor, 1 * scaleFactor);
  }

  // ── 8. Vignette — darken edges to draw the eye inward ───────────
  ctx.globalAlpha = 1;
  const vignetteStrength = 0.25 + rng() * 0.2;
  const vigGrad = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.3, cx, cy, bgRadius);
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(0.6, "rgba(0,0,0,0)");
  vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength.toFixed(3)})`);
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, width, height);

  // ── 9. Organic connecting curves ───────────────────────────────
  if (shapePositions.length > 1) {
    const numCurves = Math.floor((8 * (width * height)) / (1024 * 1024));
    ctx.lineWidth = 0.8 * scaleFactor;

    for (let i = 0; i < numCurves; i++) {
      const idxA = Math.floor(rng() * shapePositions.length);
      const offset =
        1 + Math.floor(rng() * Math.min(5, shapePositions.length - 1));
      const idxB = (idxA + offset) % shapePositions.length;

      const a = shapePositions[idxA];
      const b = shapePositions[idxB];

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const bulge = (rng() - 0.5) * dist * 0.4;

      const cpx = mx + (-dy / (dist || 1)) * bulge;
      const cpy = my + (dx / (dist || 1)) * bulge;

      ctx.globalAlpha = 0.06 + rng() * 0.1;
      ctx.strokeStyle = hexWithAlpha(
        enforceContrast(pickHierarchyColor(colorHierarchy, rng), bgLum),
        0.3,
      );

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
      ctx.stroke();
    }
  }

  // ── 10. Post-processing ────────────────────────────────────────

  // 10a. Color grading — unified tone across the whole image
  // Apply as a semi-transparent overlay in the grade hue
  ctx.globalAlpha = colorGrade.intensity * 0.25;
  ctx.globalCompositeOperation = "soft-light";
  const gradeHsl = `hsl(${Math.round(colorGrade.hue)}, 40%, 50%)`;
  ctx.fillStyle = gradeHsl;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  // 10b. Chromatic aberration — subtle RGB channel offset at edges
  // Only apply for neon/cosmic/ethereal archetypes where it fits
  const chromaArchetypes = ["neon-glow", "cosmic", "ethereal"];
  if (chromaArchetypes.includes(archetype.name)) {
    const chromaOffset = Math.ceil(2 * scaleFactor);
    const canvas = ctx.canvas;
    // Shift red channel slightly
    ctx.globalAlpha = 0.03;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(canvas, chromaOffset, 0, width, height, 0, 0, width, height);
    // Shift blue channel opposite
    ctx.drawImage(canvas, -chromaOffset, 0, width, height, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }

  // 10c. Bloom — soft glow on bright areas for neon/cosmic archetypes
  const bloomArchetypes = ["neon-glow", "cosmic"];
  if (bloomArchetypes.includes(archetype.name)) {
    const canvas = ctx.canvas;
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = "screen";
    // Draw the image slightly scaled up and blurred via shadow
    ctx.save();
    ctx.shadowBlur = 30 * scaleFactor;
    ctx.shadowColor = "rgba(255,255,255,0.3)";
    ctx.drawImage(canvas, 0, 0, width, height);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = 1;

}
