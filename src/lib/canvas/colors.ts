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
  "dark",
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


// Enhanced color scheme generation for sacred geometry
export class SacredColorScheme {
  private seed: number;
  private rng: () => number;
  private variation: ColorVariation;
  private schemeType: SchemeType;
  public baseScheme: string[];
  private complementaryScheme: string[];
  private triadicScheme: string[];

  constructor(gitHash: string) {
    this.seed = gitHashToSeed(gitHash);
    this.rng = createRng(seedFromHash(gitHash, 42));
    // Hash-driven variation and scheme type for palette diversity
    this.variation = pickVariation(this.seed);
    this.schemeType = pickSchemeType(this.seed);
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
      this.variation === "soft" ? "hard" : this.variation === "dark" ? "light" : this.variation;
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
   * of the base scheme for gradient backgrounds.
   */
  getBackgroundColors(): [string, string] {
    return [
      this.darken(this.baseScheme[0], 0.65),
      this.darken(this.baseScheme[1], 0.55),
    ];
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
