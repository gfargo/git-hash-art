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
  | "high-contrast"; // black + white + one accent

// ── Archetype definition ────────────────────────────────────────────

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
    flowLineMultiplier: 1,
    heroShape: true,
    glowMultiplier: 1,
    sizePower: 1.8,
    invertForeground: false,
  },
];

/**
 * Select an archetype deterministically from the hash.
 * The "classic" archetype preserves the original look for backward compat
 * but only gets ~10% of hashes.
 */
export function selectArchetype(rng: () => number): Archetype {
  return ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
}
