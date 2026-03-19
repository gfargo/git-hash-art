import ColorScheme from "color-scheme";
import "../../../global.d";

import { gitHashToSeed, createRng, seedFromHash } from "../utils";

// ── Color variation modes ───────────────────────────────────────────
// The hash deterministically selects a variation, producing dramatically
// different palettes from the same hue.

const COLOR_VARIATIONS = [
  "soft",
  "hard",
  "pastel",
  "light",
  "pale",
  "default",
] as const;
type ColorVariation = (typeof COLOR_VARIATIONS)[number];

/**
 * Pick a color variation mode deterministically from a seed.
 */
function pickVariation(seed: number): ColorVariation {
  return COLOR_VARIATIONS[Math.abs(seed) % COLOR_VARIATIONS.length];
}

/**
 * Scheme type also varies — some hashes get near-monochromatic palettes,
 * others get high-contrast complementary schemes.
 */
const SCHEME_TYPES = [
  "analogic",
  "mono",
  "contrast",
  "triade",
  "tetrade",
] as const;
type SchemeType = (typeof SCHEME_TYPES)[number];

function pickSchemeType(seed: number): SchemeType {
  return SCHEME_TYPES[Math.abs(seed >> 4) % SCHEME_TYPES.length];
}


// ── Temperature contrast ─────────────────────────────────────────
// Warm hues: 0-60 (red-yellow) and 300-360 (magenta-red)
// Cool hues: 150-270 (cyan-blue-purple)
// Neutral: everything else

type TemperatureMode = "warm-bg" | "cool-bg" | "neutral";

function classifyHue(hue: number): "warm" | "cool" | "neutral" {
  if ((hue >= 0 && hue <= 60) || hue >= 300) return "warm";
  if (hue >= 150 && hue <= 270) return "cool";
  return "neutral";
}

/**
 * Shift a hue toward a target temperature zone.
 * Returns a new hue biased warm or cool.
 */
function shiftHueToward(hue: number, target: "warm" | "cool", amount: number): number {
  if (target === "warm") {
    // Pull toward 30 (orange) — the warmest point
    const warmTarget = 30;
    const diff = ((warmTarget - hue + 540) % 360) - 180;
    return (hue + diff * amount + 360) % 360;
  } else {
    // Pull toward 210 (blue) — the coolest point
    const coolTarget = 210;
    const diff = ((coolTarget - hue + 540) % 360) - 180;
    return (hue + diff * amount + 360) % 360;
  }
}

// Enhanced color scheme generation for sacred geometry
export class SacredColorScheme {
  private seed: number;
  private rng: () => number;
  private variation: ColorVariation;
  private schemeType: SchemeType;
  private temperatureMode: TemperatureMode;
  public baseScheme: string[];
  private complementaryScheme: string[];
  private triadicScheme: string[];

  constructor(gitHash: string) {
    this.seed = gitHashToSeed(gitHash);
    this.rng = createRng(seedFromHash(gitHash, 42));
    // Hash-driven variation and scheme type for palette diversity
    this.variation = pickVariation(this.seed);
    this.schemeType = pickSchemeType(this.seed);
    // ~40% warm-bg, ~40% cool-bg, ~20% neutral (no temperature bias)
    const tempRoll = this.rng();
    this.temperatureMode = tempRoll < 0.4 ? "warm-bg" : tempRoll < 0.8 ? "cool-bg" : "neutral";
    this.baseScheme = this.generateBaseScheme();
    this.complementaryScheme = this.generateComplementaryScheme();
    this.triadicScheme = this.generateTriadicScheme();
  }

  private generateBaseScheme(): string[] {
    const scheme = new ColorScheme();
    return scheme
      .from_hue(this.seed % 360)
      .scheme(this.schemeType)
      .variation(this.variation)
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  private generateComplementaryScheme(): string[] {
    const complementaryHue = (this.seed + 180) % 360;
    // Complementary uses a contrasting variation for tension
    const compVariation =
      this.variation === "soft" ? "hard" : this.variation === "pale" ? "light" : this.variation;
    const scheme = new ColorScheme();
    return scheme
      .from_hue(complementaryHue)
      .scheme("mono")
      .variation(compVariation)
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  private generateTriadicScheme(): string[] {
    const triadicHue = (this.seed + 120) % 360;
    const scheme = new ColorScheme();
    return scheme
      .from_hue(triadicHue)
      .scheme("triade")
      .variation(this.variation)
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  /**
   * Returns a flat array of hash-derived colors suitable for art generation.
   * Combines base analogic, complementary, and triadic schemes for variety
   * while maintaining color harmony.
   */
  getColors(): string[] {
    // Deduplicate and return a rich palette
    const all = [
      ...this.baseScheme.slice(0, 4),
      ...this.complementaryScheme.slice(0, 2),
      ...this.triadicScheme.slice(0, 2),
    ];
    return [...new Set(all)];
  }

  /**
   * Returns a palette shaped by the given palette mode.
   * Falls back to getColors() for "harmonious".
   */
  getColorsByMode(mode: string): string[] {
    const baseHue = this.seed % 360;
    switch (mode) {
      case "monochrome": {
        // Single hue, 5 lightness steps
        const s = 0.5 + this.rng() * 0.3;
        return [0.15, 0.3, 0.45, 0.6, 0.75].map((l) =>
          hslToHex(baseHue, s, l),
        );
      }
      case "duotone": {
        // Two contrasting colors + tints
        const hue2 = (baseHue + 150 + this.rng() * 60) % 360;
        return [
          hslToHex(baseHue, 0.7, 0.5),
          hslToHex(baseHue, 0.6, 0.7),
          hslToHex(hue2, 0.7, 0.5),
          hslToHex(hue2, 0.6, 0.7),
        ];
      }
      case "neon": {
        // High saturation, vivid colors
        const hues = [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360];
        return hues.map((h) => hslToHex(h, 1.0, 0.55 + this.rng() * 0.1));
      }
      case "pastel-light": {
        // Soft pastels
        const hues = [baseHue, (baseHue + 60) % 360, (baseHue + 120) % 360, (baseHue + 200) % 360];
        return hues.map((h) => hslToHex(h, 0.4 + this.rng() * 0.2, 0.75 + this.rng() * 0.1));
      }
      case "earth": {
        // Warm muted naturals: browns, olives, terracotta, sage
        const earthHues = [25, 35, 45, 80, 150]; // orange-brown to olive to sage
        return earthHues.map((h) =>
          hslToHex(h + this.rng() * 15, 0.25 + this.rng() * 0.2, 0.35 + this.rng() * 0.2),
        );
      }
      case "high-contrast": {
        // Black, white, and one accent color
        const accent = hslToHex(baseHue, 0.9, 0.5);
        return ["#111111", "#eeeeee", accent, hslToHex(baseHue, 0.7, 0.35)];
      }
      case "harmonious":
      default:
        return this.getColors();
    }
  }

  /**
   * Returns background colors appropriate for the given palette mode.
   */
  getBackgroundColorsByMode(mode: string): [string, string] {
    switch (mode) {
      case "pastel-light":
        return [hslToHex(this.seed % 360, 0.15, 0.92), hslToHex((this.seed + 30) % 360, 0.1, 0.88)];
      case "high-contrast":
      case "monochrome-ink":
        return ["#f5f5f0", "#e8e8e0"];
      case "neon":
        return ["#0a0a12", "#050510"];
      case "earth":
        return [this.darken(hslToHex(35, 0.3, 0.25), 0.8), this.darken(hslToHex(25, 0.25, 0.2), 0.7)];
      default:
        return this.getBackgroundColors();
    }
  }

  /**
   * Returns two background colors derived from the hash — darker variants
   * of the base scheme, temperature-shifted for warm/cool contrast.
   */
  getBackgroundColors(): [string, string] {
    let bg0 = this.baseScheme[0];
    let bg1 = this.baseScheme[1];

    if (this.temperatureMode !== "neutral") {
      const bgTemp = this.temperatureMode === "warm-bg" ? "warm" : "cool";
      bg0 = this.shiftColorTemperature(bg0, bgTemp, 0.3);
      bg1 = this.shiftColorTemperature(bg1, bgTemp, 0.25);
    }

    return [this.darken(bg0, 0.65), this.darken(bg1, 0.55)];
  }

  /**
   * Returns the temperature mode so the renderer can apply
   * contrasting temperature to foreground elements.
   */
  getTemperatureMode(): TemperatureMode {
    return this.temperatureMode;
  }

  /**
   * Shift a hex color's hue toward warm or cool.
   */
  private shiftColorTemperature(hex: string, target: "warm" | "cool", amount: number): string {
    const [h, s, l] = hexToHsl(hex);
    const shifted = shiftHueToward(h, target, amount);
    return hslToHex(shifted, s, l);
  }

  /**
   * Simple hex color darkening by a factor (0 = black, 1 = unchanged).
   */
  private darken(hex: string, factor: number): string {
    const c = hex.replace("#", "");
    const r = Math.round(parseInt(c.substring(0, 2), 16) * factor);
    const g = Math.round(parseInt(c.substring(2, 4), 16) * factor);
    const b = Math.round(parseInt(c.substring(4, 6), 16) * factor);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
}

// ── Standalone color utilities ──────────────────────────────────────

/** Parse a hex color (#RRGGBB) into [r, g, b] 0-255. */
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

/** Format [r, g, b] back to #RRGGBB. */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/** Convert hex to HSL [h 0-360, s 0-1, l 0-1]. */
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Convert HSL [h 0-360, s 0-1, l 0-1] back to hex. */
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Return a hex color with an alpha component as an rgba() CSS string.
 * `alpha` is 0-1.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/**
 * Color hierarchy — assigns dominant/secondary/accent roles to a palette.
 * Dominant gets ~60% of usage, secondary ~25%, accent ~15%.
 */
export interface ColorHierarchy {
  dominant: string;
  secondary: string;
  accent: string;
  all: string[];
}

export function buildColorHierarchy(colors: string[], rng: () => number): ColorHierarchy {
  if (colors.length < 3) {
    return {
      dominant: colors[0] || "#888888",
      secondary: colors[1] || colors[0] || "#888888",
      accent: colors[colors.length - 1] || "#888888",
      all: colors,
    };
  }
  // Pick dominant as the color closest to the palette's average hue
  const hsls = colors.map((c) => hexToHsl(c));
  const avgHue = hsls.reduce((s, h) => s + h[0], 0) / hsls.length;
  let dominantIdx = 0;
  let minDist = 360;
  for (let i = 0; i < hsls.length; i++) {
    const d = Math.min(Math.abs(hsls[i][0] - avgHue), 360 - Math.abs(hsls[i][0] - avgHue));
    if (d < minDist) { minDist = d; dominantIdx = i; }
  }
  // Accent is the color most distant from dominant in hue
  let accentIdx = 0;
  let maxDist = 0;
  for (let i = 0; i < hsls.length; i++) {
    if (i === dominantIdx) continue;
    const d = Math.min(Math.abs(hsls[i][0] - hsls[dominantIdx][0]), 360 - Math.abs(hsls[i][0] - hsls[dominantIdx][0]));
    if (d > maxDist) { maxDist = d; accentIdx = i; }
  }
  // Secondary is the remaining color with highest saturation
  let secondaryIdx = 0;
  let maxSat = -1;
  for (let i = 0; i < hsls.length; i++) {
    if (i === dominantIdx || i === accentIdx) continue;
    if (hsls[i][1] > maxSat) { maxSat = hsls[i][1]; secondaryIdx = i; }
  }
  if (secondaryIdx === dominantIdx) secondaryIdx = accentIdx === 0 ? 1 : 0;

  return {
    dominant: colors[dominantIdx],
    secondary: colors[secondaryIdx],
    accent: colors[accentIdx],
    all: colors,
  };
}

/**
 * Pick a color from the hierarchy with weighted probability.
 * ~60% dominant, ~25% secondary, ~15% accent.
 */
export function pickHierarchyColor(hierarchy: ColorHierarchy, rng: () => number): string {
  const roll = rng();
  if (roll < 0.60) return hierarchy.dominant;
  if (roll < 0.85) return hierarchy.secondary;
  return hierarchy.accent;
}

/**
 * HSL-space color jitter — preserves vibrancy better than RGB jitter.
 * Applies small hue wobble + saturation/lightness variation.
 */
export function jitterColorHSL(
  hex: string,
  rng: () => number,
  hueAmount = 8,
  slAmount = 0.06,
): string {
  const [h, s, l] = hexToHsl(hex);
  const newH = (h + (rng() - 0.5) * hueAmount * 2 + 360) % 360;
  const newS = Math.max(0, Math.min(1, s + (rng() - 0.5) * slAmount * 2));
  const newL = Math.max(0, Math.min(1, l + (rng() - 0.5) * slAmount * 2));
  return hslToHex(newH, newS, newL);
}

export function jitterColor(
  hex: string,
  rng: () => number,
  amount = 0.1,
): string {
  const [r, g, b] = hexToRgb(hex);
  const jit = () => (rng() - 0.5) * 2 * amount * 255;
  return rgbToHex(r + jit(), g + jit(), b + jit());
}

/**
 * Desaturate a hex color by blending toward its luminance gray.
 * `amount` 0 = unchanged, 1 = fully gray.
 */
export function desaturate(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => c + (gray - c) * amount;
  return rgbToHex(mix(r), mix(g), mix(b));
}

/**
 * Shift a hex color's hue toward warm (orange) or cool (blue).
 * `amount` 0 = unchanged, 1 = fully shifted.
 */
export function shiftTemperature(hex: string, target: "warm" | "cool", amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(shiftHueToward(h, target, amount), s, l);
}

/**
 * Compute relative luminance of a hex color (0 = black, 1 = white).
 * Uses the sRGB luminance formula from WCAG.
 */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Enforce minimum contrast between a foreground color and a background
 * luminance. On light backgrounds, darkens/saturates the foreground.
 * On dark backgrounds, lightens/saturates the foreground.
 *
 * `bgLuminance` is 0-1 (pre-computed from the background color).
 * `minContrast` is the minimum luminance difference to enforce (default 0.15).
 */
export function enforceContrast(
  fgHex: string,
  bgLuminance: number,
  minContrast = 0.15,
): string {
  const fgLum = luminance(fgHex);
  const diff = Math.abs(fgLum - bgLuminance);

  if (diff >= minContrast) return fgHex;

  const [h, s, l] = hexToHsl(fgHex);

  if (bgLuminance > 0.5) {
    // Light background — darken and boost saturation
    const targetL = Math.max(0.08, l - (minContrast - diff) * 1.5);
    const targetS = Math.min(1, s + 0.2);
    return hslToHex(h, targetS, targetL);
  } else {
    // Dark background — lighten and boost saturation
    const targetL = Math.min(0.92, l + (minContrast - diff) * 1.5);
    const targetS = Math.min(1, s + 0.15);
    return hslToHex(h, targetS, targetL);
  }
}

/**
 * Apply a unified color grade to a hex color — shifts the entire image
 * toward a cohesive tone. This is the "Instagram filter" effect.
 */
export function applyColorGrade(
  hex: string,
  gradeHue: number,
  intensity: number,
): string {
  const [h, s, l] = hexToHsl(hex);
  // Blend hue toward the grade hue
  const hueDiff = ((gradeHue - h + 540) % 360) - 180;
  const newH = (h + hueDiff * intensity * 0.3 + 360) % 360;
  // Slightly unify saturation
  const newS = Math.max(0, Math.min(1, s + (0.5 - s) * intensity * 0.15));
  return hslToHex(newH, newS, l);
}

/**
 * Compute a deterministic color grade from the hash.
 * Returns a hue (0-360) and intensity (0.15-0.4).
 */
export function pickColorGrade(rng: () => number): { hue: number; intensity: number } {
  // Warm golden, cool blue, rosy, teal, amber
  const GRADE_HUES = [40, 220, 340, 175, 30];
  const hue = GRADE_HUES[Math.floor(rng() * GRADE_HUES.length)] + (rng() - 0.5) * 20;
  const intensity = 0.15 + rng() * 0.25;
  return { hue: (hue + 360) % 360, intensity };
}

/**
 * Rotate the hue of a hex color by a given number of degrees.
 */
export function hueRotate(hex: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex((h + degrees + 360) % 360, s, l);
}

/**
 * Evolve a color hierarchy for a given layer — shifts hue progressively.
 * Creates atmospheric color perspective (like distant mountains shifting blue).
 */
export function evolveHierarchy(
  base: ColorHierarchy,
  layerRatio: number,
  hueShiftPerLayer: number,
): ColorHierarchy {
  const shift = layerRatio * hueShiftPerLayer;
  return {
    dominant: hueRotate(base.dominant, shift),
    secondary: hueRotate(base.secondary, shift * 0.7),
    accent: hueRotate(base.accent, shift * 0.5),
  };
}
