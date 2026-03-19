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
 * Apply slight hue/saturation/lightness jitter to a hex color.
 * `rng` should return a float in [0,1). `amount` controls intensity (0-1, default 0.1).
 */
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
