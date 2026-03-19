/**
 * Visual archetypes — fundamentally different rendering personalities
 * selected deterministically from the hash.
 *
 * Each archetype overrides key rendering parameters to produce images
 * that look like they came from different generators entirely.
 */
import type { RenderStyle } from "./canvas/draw";

// ── Background types ────────────────────────────────────────────────

export type BackgroundStyle =
  | "radial-dark"       // current default: dark radial gradient
  | "radial-light"      // light center, medium edges
  | "linear-horizontal" // left-to-right gradient
  | "linear-diagonal"   // corner-to-corner gradient
  | "solid-dark"        // flat dark color
  | "solid-light"       // flat light/white color
  | "multi-stop";       // 3-4 color gradient

// ── Palette modes ───────────────────────────────────────────────────

export type PaletteMode =
  | "harmonious"    // current default: full palette
  | "monochrome"    // single hue, varying lightness
  | "duotone"       // two colors only
  | "neon"          // high saturation on dark
  | "pastel-light"  // soft pastels on light background
  | "earth"         // muted warm naturals
  | "high-contrast" // black + white + one accent
  | "split-complementary" // base hue + two flanking complements
  | "analogous-accent"    // tight analogous cluster + one distant accent
  | "limited-palette";    // 3 colors only, risograph-print feel

// ── Archetype definition ────────────────────────────────────────────

export type CompositionMode =
  | "radial"
  | "flow-field"
  | "spiral"
  | "grid-subdivision"
  | "clustered"
  | "golden-spiral";

export interface Archetype {
  name: string;
  /** Override gridSize (controls shape count) */
  gridSize: number;
  /** Override layer count */
  layers: number;
  /** Override base opacity */
  baseOpacity: number;
  /** Override opacity reduction per layer */
  opacityReduction: number;
  /** Override min shape size */
  minShapeSize: number;
  /** Override max shape size */
  maxShapeSize: number;
  /** Background rendering style */
  backgroundStyle: BackgroundStyle;
  /** Color palette mode */
  paletteMode: PaletteMode;
  /** Preferred render styles (weighted toward these) */
  preferredStyles: RenderStyle[];
  /** Preferred composition modes (70% chance of using one of these) */
  preferredCompositions: CompositionMode[];
  /** Flow line count multiplier (1 = default) */
  flowLineMultiplier: number;
  /** Whether to draw the hero shape */
  heroShape: boolean;
  /** Glow probability multiplier */
  glowMultiplier: number;
  /** Shape size power curve exponent (higher = more small shapes) */
  sizePower: number;
  /** Whether to invert colors (light shapes on dark, or dark on light) */
  invertForeground: boolean;
}

// ── Archetype definitions ───────────────────────────────────────────

const ARCHETYPES: Archetype[] = [
  {
    name: "dense-chaotic",
    gridSize: 9,
    layers: 5,
    baseOpacity: 0.5,
    opacityReduction: 0.06,
    minShapeSize: 10,
    maxShapeSize: 200,
    backgroundStyle: "radial-dark",
    paletteMode: "harmonious",
    preferredStyles: ["fill-and-stroke", "watercolor", "fill-only"],
    preferredCompositions: ["clustered", "flow-field", "radial"],
    flowLineMultiplier: 2.5,
    heroShape: false,
    glowMultiplier: 0.5,
    sizePower: 1.2,
    invertForeground: false,
  },
  {
    name: "minimal-spacious",
    gridSize: 2,
    layers: 2,
    baseOpacity: 0.85,
    opacityReduction: 0.05,
    minShapeSize: 150,
    maxShapeSize: 600,
    backgroundStyle: "solid-light",
    paletteMode: "duotone",
    preferredStyles: ["fill-and-stroke", "stroke-only", "incomplete"],
    preferredCompositions: ["golden-spiral", "grid-subdivision"],
    flowLineMultiplier: 0.3,
    heroShape: true,
    glowMultiplier: 0,
    sizePower: 0.8,
    invertForeground: false,
  },
  {
    name: "organic-flow",
    gridSize: 4,
    layers: 3,
    baseOpacity: 0.4,
    opacityReduction: 0.08,
    minShapeSize: 20,
    maxShapeSize: 250,
    backgroundStyle: "radial-dark",
    paletteMode: "earth",
    preferredStyles: ["watercolor", "fill-only", "incomplete"],
    preferredCompositions: ["flow-field", "golden-spiral", "spiral"],
    flowLineMultiplier: 4,
    heroShape: false,
    glowMultiplier: 0.3,
    sizePower: 1.5,
    invertForeground: false,
  },
  {
    name: "geometric-precision",
    gridSize: 6,
    layers: 3,
    baseOpacity: 0.9,
    opacityReduction: 0.15,
    minShapeSize: 40,
    maxShapeSize: 300,
    backgroundStyle: "solid-dark",
    paletteMode: "high-contrast",
    preferredStyles: ["stroke-only", "dashed", "double-stroke", "hatched"],
    preferredCompositions: ["grid-subdivision", "radial"],
    flowLineMultiplier: 0,
    heroShape: false,
    glowMultiplier: 0,
    sizePower: 1.0,
    invertForeground: false,
  },
  {
    name: "ethereal",
    gridSize: 7,
    layers: 5,
    baseOpacity: 0.3,
    opacityReduction: 0.03,
    minShapeSize: 50,
    maxShapeSize: 500,
    backgroundStyle: "radial-light",
    paletteMode: "pastel-light",
    preferredStyles: ["watercolor", "incomplete", "fill-only"],
    preferredCompositions: ["golden-spiral", "radial", "spiral"],
    flowLineMultiplier: 1.5,
    heroShape: true,
    glowMultiplier: 2,
    sizePower: 1.4,
    invertForeground: false,
  },
  {
    name: "bold-graphic",
    gridSize: 2,
    layers: 2,
    baseOpacity: 0.95,
    opacityReduction: 0.1,
    minShapeSize: 200,
    maxShapeSize: 800,
    backgroundStyle: "linear-diagonal",
    paletteMode: "duotone",
    preferredStyles: ["fill-and-stroke", "double-stroke"],
    preferredCompositions: ["grid-subdivision", "golden-spiral"],
    flowLineMultiplier: 0,
    heroShape: true,
    glowMultiplier: 0,
    sizePower: 0.5,
    invertForeground: false,
  },
  {
    name: "neon-glow",
    gridSize: 5,
    layers: 4,
    baseOpacity: 0.6,
    opacityReduction: 0.1,
    minShapeSize: 20,
    maxShapeSize: 350,
    backgroundStyle: "solid-dark",
    paletteMode: "neon",
    preferredStyles: ["stroke-only", "double-stroke", "dashed"],
    preferredCompositions: ["radial", "spiral", "clustered"],
    flowLineMultiplier: 2,
    heroShape: true,
    glowMultiplier: 3,
    sizePower: 1.6,
    invertForeground: false,
  },
  {
    name: "monochrome-ink",
    gridSize: 6,
    layers: 3,
    baseOpacity: 0.7,
    opacityReduction: 0.15,
    minShapeSize: 15,
    maxShapeSize: 350,
    backgroundStyle: "solid-light",
    paletteMode: "monochrome",
    preferredStyles: ["hatched", "incomplete", "stroke-only", "dashed"],
    preferredCompositions: ["flow-field", "grid-subdivision", "clustered"],
    flowLineMultiplier: 1.5,
    heroShape: false,
    glowMultiplier: 0,
    sizePower: 1.8,
    invertForeground: false,
  },
  {
    name: "cosmic",
    gridSize: 8,
    layers: 5,
    baseOpacity: 0.5,
    opacityReduction: 0.06,
    minShapeSize: 5,
    maxShapeSize: 300,
    backgroundStyle: "radial-dark",
    paletteMode: "neon",
    preferredStyles: ["fill-only", "watercolor", "fill-and-stroke"],
    preferredCompositions: ["radial", "spiral", "golden-spiral"],
    flowLineMultiplier: 3,
    heroShape: true,
    glowMultiplier: 2.5,
    sizePower: 2.5,
    invertForeground: false,
  },
  {
    name: "watercolor-wash",
    gridSize: 3,
    layers: 3,
    baseOpacity: 0.25,
    opacityReduction: 0.03,
    minShapeSize: 200,
    maxShapeSize: 700,
    backgroundStyle: "radial-light",
    paletteMode: "harmonious",
    preferredStyles: ["watercolor", "fill-only", "incomplete"],
    preferredCompositions: ["golden-spiral", "flow-field", "radial"],
    flowLineMultiplier: 0.5,
    heroShape: false,
    glowMultiplier: 0.3,
    sizePower: 0.6,
    invertForeground: false,
  },
  {
    name: "op-art",
    gridSize: 8,
    layers: 2,
    baseOpacity: 0.95,
    opacityReduction: 0.05,
    minShapeSize: 20,
    maxShapeSize: 200,
    backgroundStyle: "solid-light",
    paletteMode: "high-contrast",
    preferredStyles: ["fill-and-stroke", "stroke-only", "dashed"],
    preferredCompositions: ["grid-subdivision", "radial"],
    flowLineMultiplier: 0,
    heroShape: false,
    glowMultiplier: 0,
    sizePower: 0.4,
    invertForeground: false,
  },
  {
    name: "collage",
    gridSize: 4,
    layers: 3,
    baseOpacity: 0.9,
    opacityReduction: 0.08,
    minShapeSize: 80,
    maxShapeSize: 500,
    backgroundStyle: "solid-light",
    paletteMode: "duotone",
    preferredStyles: ["fill-and-stroke", "fill-only", "double-stroke"],
    preferredCompositions: ["grid-subdivision", "clustered"],
    flowLineMultiplier: 0,
    heroShape: true,
    glowMultiplier: 0,
    sizePower: 0.7,
    invertForeground: false,
  },
  {
    name: "classic",
    gridSize: 5,
    layers: 4,
    baseOpacity: 0.7,
    opacityReduction: 0.12,
    minShapeSize: 30,
    maxShapeSize: 400,
    backgroundStyle: "radial-dark",
    paletteMode: "harmonious",
    preferredStyles: ["fill-and-stroke", "watercolor", "fill-only"],
    preferredCompositions: ["radial", "golden-spiral", "flow-field"],
    flowLineMultiplier: 1,
    heroShape: true,
    glowMultiplier: 1,
    sizePower: 1.8,
    invertForeground: false,
  },
  {
    name: "shattered-glass",
    gridSize: 8,
    layers: 3,
    baseOpacity: 0.85,
    opacityReduction: 0.1,
    minShapeSize: 15,
    maxShapeSize: 250,
    backgroundStyle: "solid-dark",
    paletteMode: "high-contrast",
    preferredStyles: ["fill-and-stroke", "stroke-only", "fill-only"],
    preferredCompositions: ["clustered", "grid-subdivision", "radial"],
    flowLineMultiplier: 0,
    heroShape: false,
    glowMultiplier: 0.3,
    sizePower: 1.0,
    invertForeground: false,
  },
  {
    name: "botanical",
    gridSize: 4,
    layers: 4,
    baseOpacity: 0.5,
    opacityReduction: 0.06,
    minShapeSize: 30,
    maxShapeSize: 400,
    backgroundStyle: "radial-light",
    paletteMode: "earth",
    preferredStyles: ["watercolor", "fill-only", "incomplete"],
    preferredCompositions: ["flow-field", "golden-spiral", "spiral"],
    flowLineMultiplier: 3,
    heroShape: true,
    glowMultiplier: 0.2,
    sizePower: 1.6,
    invertForeground: false,
  },
  {
    name: "stipple-portrait",
    gridSize: 9,
    layers: 2,
    baseOpacity: 0.8,
    opacityReduction: 0.05,
    minShapeSize: 5,
    maxShapeSize: 120,
    backgroundStyle: "solid-light",
    paletteMode: "monochrome",
    preferredStyles: ["stipple", "fill-only", "hatched"],
    preferredCompositions: ["radial", "clustered", "flow-field"],
    flowLineMultiplier: 0,
    heroShape: false,
    glowMultiplier: 0,
    sizePower: 2.8,
    invertForeground: false,
  },
  {
    name: "celestial",
    gridSize: 7,
    layers: 5,
    baseOpacity: 0.45,
    opacityReduction: 0.04,
    minShapeSize: 8,
    maxShapeSize: 450,
    backgroundStyle: "radial-dark",
    paletteMode: "neon",
    preferredStyles: ["fill-only", "watercolor", "stroke-only", "incomplete"],
    preferredCompositions: ["spiral", "radial", "golden-spiral"],
    flowLineMultiplier: 2,
    heroShape: true,
    glowMultiplier: 2.5,
    sizePower: 2.2,
    invertForeground: false,
  },
];

/**
 * Linearly interpolate between two archetype numeric parameters.
 */
function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Blend two archetypes by interpolating their numeric parameters
 * and merging their style arrays.
 */
function blendArchetypes(a: Archetype, b: Archetype, t: number): Archetype {
  // Merge preferred styles — unique union, primary archetype first
  const mergedStyles = [...new Set([...a.preferredStyles, ...b.preferredStyles])] as RenderStyle[];
  const mergedCompositions = [...new Set([...a.preferredCompositions, ...b.preferredCompositions])] as CompositionMode[];

  return {
    name: `${a.name}+${b.name}`,
    gridSize: Math.round(lerpNum(a.gridSize, b.gridSize, t)),
    layers: Math.round(lerpNum(a.layers, b.layers, t)),
    baseOpacity: lerpNum(a.baseOpacity, b.baseOpacity, t),
    opacityReduction: lerpNum(a.opacityReduction, b.opacityReduction, t),
    minShapeSize: Math.round(lerpNum(a.minShapeSize, b.minShapeSize, t)),
    maxShapeSize: Math.round(lerpNum(a.maxShapeSize, b.maxShapeSize, t)),
    backgroundStyle: t < 0.5 ? a.backgroundStyle : b.backgroundStyle,
    paletteMode: t < 0.5 ? a.paletteMode : b.paletteMode,
    preferredStyles: mergedStyles,
    preferredCompositions: mergedCompositions,
    flowLineMultiplier: lerpNum(a.flowLineMultiplier, b.flowLineMultiplier, t),
    heroShape: t < 0.5 ? a.heroShape : b.heroShape,
    glowMultiplier: lerpNum(a.glowMultiplier, b.glowMultiplier, t),
    sizePower: lerpNum(a.sizePower, b.sizePower, t),
    invertForeground: t < 0.5 ? a.invertForeground : b.invertForeground,
  };
}

/**
 * Select an archetype deterministically from the hash.
 * ~15% of hashes produce a blended archetype (interpolation of two).
 */
export function selectArchetype(rng: () => number): Archetype {
  const primary = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];

  // ~15% chance of blending with a second archetype
  if (rng() < 0.15) {
    const secondary = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
    if (secondary.name !== primary.name) {
      const blendT = 0.25 + rng() * 0.25; // 25-50% blend toward secondary
      return blendArchetypes(primary, secondary, blendT);
    }
  }

  return primary;
}
