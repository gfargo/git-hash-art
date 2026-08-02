import ColorScheme from "color-scheme";
import "../../../global.d";

import { gitHashToSeed, createRng, seedFromHash } from "../utils";
import { hexToOklch, oklchToHex, hueDelta, perceivedLightness } from "./oklch";

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
function shiftHueToward(
  hue: number,
  target: "warm" | "cool",
  amount: number,
): number {
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
    this.temperatureMode =
      tempRoll < 0.4 ? "warm-bg" : tempRoll < 0.8 ? "cool-bg" : "neutral";
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
      this.variation === "soft"
        ? "hard"
        : this.variation === "pale"
          ? "light"
          : this.variation;
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
        return [0.15, 0.3, 0.45, 0.6, 0.75].map((l) => hslToHex(baseHue, s, l));
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
        const hues = [
          baseHue,
          (baseHue + 90) % 360,
          (baseHue + 180) % 360,
          (baseHue + 270) % 360,
        ];
        return hues.map((h) => hslToHex(h, 1.0, 0.55 + this.rng() * 0.1));
      }
      case "pastel-light": {
        // Soft pastels
        const hues = [
          baseHue,
          (baseHue + 60) % 360,
          (baseHue + 120) % 360,
          (baseHue + 200) % 360,
        ];
        return hues.map((h) =>
          hslToHex(h, 0.4 + this.rng() * 0.2, 0.75 + this.rng() * 0.1),
        );
      }
      case "earth": {
        // Warm muted naturals: browns, olives, terracotta, sage
        const earthHues = [25, 35, 45, 80, 150]; // orange-brown to olive to sage
        return earthHues.map((h) =>
          hslToHex(
            h + this.rng() * 15,
            0.25 + this.rng() * 0.2,
            0.35 + this.rng() * 0.2,
          ),
        );
      }
      case "high-contrast": {
        // Black, white, and one accent color
        const accent = hslToHex(baseHue, 0.9, 0.5);
        return ["#111111", "#eeeeee", accent, hslToHex(baseHue, 0.7, 0.35)];
      }
      case "split-complementary": {
        // Base hue + two colors flanking the complement (±30°)
        const comp = (baseHue + 180) % 360;
        const split1 = (comp - 30 + 360) % 360;
        const split2 = (comp + 30) % 360;
        const sat = 0.55 + this.rng() * 0.25;
        return [
          hslToHex(baseHue, sat, 0.5),
          hslToHex(baseHue, sat * 0.8, 0.65),
          hslToHex(split1, sat, 0.5),
          hslToHex(split2, sat, 0.5),
          hslToHex(split1, sat * 0.7, 0.7),
        ];
      }
      case "analogous-accent": {
        // Tight cluster of 3 analogous hues + 1 distant accent
        const step = 15 + this.rng() * 20; // 15-35° apart
        const h1 = (baseHue - step + 360) % 360;
        const h2 = (baseHue + step) % 360;
        const accentHue = (baseHue + 150 + this.rng() * 60) % 360;
        const sat = 0.5 + this.rng() * 0.3;
        return [
          hslToHex(baseHue, sat, 0.5),
          hslToHex(h1, sat, 0.55),
          hslToHex(h2, sat, 0.45),
          hslToHex(accentHue, sat + 0.15, 0.5),
        ];
      }
      case "limited-palette": {
        // Only 3 colors — like a risograph print
        const h2 = (baseHue + 120 + this.rng() * 40) % 360;
        const h3 = (baseHue + 220 + this.rng() * 40) % 360;
        const sat = 0.6 + this.rng() * 0.2;
        return [
          hslToHex(baseHue, sat, 0.5),
          hslToHex(h2, sat, 0.5),
          hslToHex(h3, sat * 0.9, 0.55),
        ];
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
        return [
          hslToHex(this.seed % 360, 0.15, 0.92),
          hslToHex((this.seed + 30) % 360, 0.1, 0.88),
        ];
      case "high-contrast":
      // Was "monochrome-ink" — an archetype name, not a palette mode, so
      // this branch never matched and the monochrome palettes fell through
      // to the darkened default.
      case "monochrome":
        return ["#f5f5f0", "#e8e8e0"];
      case "split-complementary":
      case "analogous-accent":
        return this.getBackgroundColors();
      case "limited-palette":
        return [
          hslToHex(this.seed % 360, 0.08, 0.94),
          hslToHex((this.seed + 20) % 360, 0.06, 0.9),
        ];
      case "neon":
        return ["#0a0a12", "#050510"];
      case "earth":
        return [
          this.darken(hslToHex(35, 0.3, 0.25), 0.8),
          this.darken(hslToHex(25, 0.25, 0.2), 0.7),
        ];
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
  private shiftColorTemperature(
    hex: string,
    target: "warm" | "cool",
    amount: number,
  ): string {
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

// sRGB chroma reaches roughly 0.37 at its widest; callers still speak in
// HSL-scale saturation amounts (0-1), so this maps between the two.
const CHROMA_PER_SAT = 0.32;

// ── Standalone color utilities ──────────────────────────────────────

// ── Cached hex→RGB parse — avoids repeated parseInt/substring on hot path ──
const _rgbCache = new Map<string, [number, number, number]>();
const _RGB_CACHE_MAX = 512;

/** Parse a hex color (#RRGGBB) into [r, g, b] 0-255. Cached. */
function hexToRgb(hex: string): [number, number, number] {
  let cached = _rgbCache.get(hex);
  if (cached) return cached;
  const c = hex.charAt(0) === "#" ? hex.substring(1) : hex;
  cached = [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
  if (_rgbCache.size >= _RGB_CACHE_MAX) _rgbCache.clear();
  _rgbCache.set(hex, cached);
  return cached;
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

/** Convert HSL [h 0-360, s 0-1, l 0-1] to RGB channels in 0-1. */
function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [r + m, g + m, b + m];
}

/** Convert HSL [h 0-360, s 0-1, l 0-1] back to hex. */
function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb01(h, s, l);
  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * sRGB relative luminance straight from HSL.
 *
 * `enforceContrast` bisects over lightness, so it evaluates luminance
 * several times per call on the hot path. Going through hslToHex →
 * hexToRgb would allocate a string per probe and thrash the shared
 * luminance/RGB caches with colors that are never drawn.
 */
function srgbChannel(v: number): number {
  const s = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hslLuminance(h: number, s: number, l: number): number {
  const [r, g, b] = hslToRgb01(h, s, l);
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

/**
 * Return a hex color with an alpha component as an rgba() CSS string.
 * `alpha` is 0-1.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  // Quantize alpha to 3 decimal places without toFixed overhead
  const a = Math.round(alpha * 1000) / 1000;
  return `rgba(${r},${g},${b},${a})`;
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

export function buildColorHierarchy(
  colors: string[],
  rng: () => number,
): ColorHierarchy {
  if (colors.length < 3) {
    return {
      dominant: colors[0] || "#888888",
      secondary: colors[1] || colors[0] || "#888888",
      accent: colors[colors.length - 1] || "#888888",
      all: colors,
    };
  }
  // Pick dominant as the color with the highest chroma (saturation × distance from gray)
  // This selects the most visually prominent color rather than the average
  const hsls = colors.map((c) => hexToHsl(c));
  let dominantIdx = 0;
  let maxChroma = -1;
  for (let i = 0; i < hsls.length; i++) {
    // Chroma approximation: saturation × how far lightness is from 50% (gray)
    const lightnessVibrancy = 1 - Math.abs(hsls[i][2] - 0.5) * 2; // peaks at L=0.5
    const chroma = hsls[i][1] * lightnessVibrancy;
    if (chroma > maxChroma) {
      maxChroma = chroma;
      dominantIdx = i;
    }
  }
  // Accent is the color most distant from dominant in hue
  let accentIdx = 0;
  let maxDist = 0;
  for (let i = 0; i < hsls.length; i++) {
    if (i === dominantIdx) continue;
    const d = Math.min(
      Math.abs(hsls[i][0] - hsls[dominantIdx][0]),
      360 - Math.abs(hsls[i][0] - hsls[dominantIdx][0]),
    );
    if (d > maxDist) {
      maxDist = d;
      accentIdx = i;
    }
  }
  // Secondary is the remaining color with highest saturation
  let secondaryIdx = 0;
  let maxSat = -1;
  for (let i = 0; i < hsls.length; i++) {
    if (i === dominantIdx || i === accentIdx) continue;
    if (hsls[i][1] > maxSat) {
      maxSat = hsls[i][1];
      secondaryIdx = i;
    }
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
export function pickHierarchyColor(
  hierarchy: ColorHierarchy,
  rng: () => number,
): string {
  const roll = rng();
  if (roll < 0.6) return hierarchy.dominant;
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
  // Name kept — every call site passes the same arguments. The jitter is
  // now perceptually even, so a wobble reads the same size on every hue
  // instead of being violent in the yellows and invisible in the blues.
  const { L, C, h } = hexToOklch(hex);
  return oklchToHex(
    Math.max(0, Math.min(1, L + (rng() - 0.5) * slAmount * 2)),
    Math.max(0, C + (rng() - 0.5) * slAmount * 2 * CHROMA_PER_SAT),
    h + (rng() - 0.5) * hueAmount * 2,
  );
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
  // Pulling chroma toward 0 holds perceived lightness. Mixing toward a
  // luminance grey in RGB did not: desaturating a yellow lightened it and
  // desaturating a blue darkened it, so atmospheric depth also shifted value.
  const { L, C, h } = hexToOklch(hex);
  return oklchToHex(L, C * Math.max(0, 1 - amount), h);
}

/**
 * Shift a hex color's hue toward warm (orange) or cool (blue).
 * `amount` 0 = unchanged, 1 = fully shifted.
 */
export function shiftTemperature(
  hex: string,
  target: "warm" | "cool",
  amount: number,
): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(shiftHueToward(h, target, amount), s, l);
}

/**
 * Compute relative luminance of a hex color (0 = black, 1 = white).
 * Uses the sRGB luminance formula from WCAG. Cached.
 */
const _lumCache = new Map<string, number>();
export function luminance(hex: string): number {
  let cached = _lumCache.get(hex);
  if (cached !== undefined) return cached;
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  cached = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (_lumCache.size >= 512) _lumCache.clear();
  _lumCache.set(hex, cached);
  return cached;
}

/**
 * Enforce minimum contrast between a foreground color and a background
 * luminance. On light backgrounds, darkens/saturates the foreground.
 * On dark backgrounds, lightens/saturates the foreground.
 *
 * `bgLuminance` is 0-1 (pre-computed from the background color).
 * `minContrast` is the minimum luminance difference to enforce (default 0.15).
 */
export function contrastFloorFor(bgLightness: number): number {
  // Expressed in OKLCH lightness, where the numbers mean the same thing at
  // every hue. Extreme grounds still need more separation: a mark on
  // near-white has less room to read than the same gap in the midtones.
  if (bgLightness > 0.78) return 0.16 + (bgLightness - 0.78) * 0.7;
  if (bgLightness < 0.22) return 0.16 + (0.22 - bgLightness) * 0.5;
  return 0.16;
}

/**
 * Push a colour away from the ground until it is legible against it.
 *
 * `bgLightness` and `minSeparation` are OKLCH lightness, 0-1.
 *
 * The HSL version had to *bisect*: it wanted a relative-luminance gap, but
 * could only steer lightness, and the mapping between them depends on hue —
 * so it searched, seven iterations per call, on the hot path. In OKLCH the
 * quantity being steered is the quantity being measured, so the correction
 * is one subtraction.
 */
export function enforceContrast(
  fgHex: string,
  bgLightness: number,
  minSeparation?: number,
): string {
  const required = minSeparation ?? contrastFloorFor(bgLightness);
  const { L, C, h } = hexToOklch(fgHex);
  if (Math.abs(L - bgLightness) >= required) return fgHex;

  const goDark = bgLightness > 0.5;
  const target = goDark ? bgLightness - required : bgLightness + required;
  // Bounds keep results tinted rather than pure black or white.
  const clamped = Math.max(0.12, Math.min(0.95, target));
  // Deep and very light colours hold less chroma in sRGB; lift it a little
  // so an enforced colour stays a hue rather than sliding toward grey.
  return oklchToHex(clamped, C + 0.02, h);
}

/**
 * Shift a hex color's saturation by a signed amount (clamped to [0, 1]).
 */
export function adjustSaturation(hex: string, amount: number): string {
  // Callers pass HSL-scale amounts (0-1). sRGB chroma only reaches ~0.37,
  // so scale into chroma units rather than reinterpreting the number.
  // Out-of-gamut chroma is reduced by oklchToHex, holding hue and lightness.
  const { L, C, h } = hexToOklch(hex);
  return oklchToHex(L, Math.max(0, C + amount * CHROMA_PER_SAT), h);
}

/**
 * Shift a hex color's lightness by a signed amount (clamped to [0.04, 0.96]).
 */
export function adjustLightness(hex: string, amount: number): string {
  // In OKLCH this is the same perceptual step whatever the hue. In HSL it
  // was a large move at hue 60 and nearly invisible at hue 240, which made
  // the tone-on-tone stroke hierarchy inconsistent by colour.
  const { L, C, h } = hexToOklch(hex);
  return oklchToHex(Math.max(0.05, Math.min(0.97, L + amount)), C, h);
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
export function pickColorGrade(rng: () => number): {
  hue: number;
  intensity: number;
} {
  // Warm golden, cool blue, rosy, teal, amber
  const GRADE_HUES = [40, 220, 340, 175, 30];
  const hue =
    GRADE_HUES[Math.floor(rng() * GRADE_HUES.length)] + (rng() - 0.5) * 20;
  const intensity = 0.15 + rng() * 0.25;
  return { hue: (hue + 360) % 360, intensity };
}

/**
 * Linearly blend two hex colors in RGB. `t` 0 = a, 1 = b.
 */
export function mixColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * Rotate the hue of a hex color by a given number of degrees.
 */
export function hueRotate(hex: string, degrees: number): string {
  const { L, C, h } = hexToOklch(hex);
  return oklchToHex(L, C, h + degrees);
}

/**
 * Re-map a color into an explicit lightness band while keeping its hue.
 *
 * Used to force background colors into the value range their background
 * style actually paints. Palette modes choose the *hue* of the ground;
 * the background style chooses its *value*. Without this the two
 * disagree — e.g. a `solid-light` archetype whose palette hands back
 * darkened colors — and every downstream contrast decision inverts.
 */
export function toGroundValue(
  hex: string,
  lightness: number,
  maxSaturation: number,
): string {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.min(s, maxSaturation), lightness);
}

/**
 * Largest circular gap between the hues in a palette, in degrees.
 * ~0 means every color sits on one hue — the palette will read as a
 * single wash no matter how it is used.
 */
export function paletteHueSpan(colors: string[]): number {
  // OKLCH hue steps are near-uniform, so 30 degrees means the same amount
  // of colour difference everywhere. In HSL it did not, which made the
  // guaranteed-accent-separation threshold stricter for some palettes than
  // others for no reason anyone chose.
  const hues = colors
    .map((c) => hexToOklch(c))
    .filter((o) => o.C > 0.02 && o.L > 0.05 && o.L < 0.97)
    .map((o) => o.h);
  if (hues.length < 2) return 0;
  let maxSep = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const raw = Math.abs(hues[i] - hues[j]);
      maxSep = Math.max(maxSep, Math.min(raw, 360 - raw));
    }
  }
  return maxSep;
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
    all: base.all.map((c) => hueRotate(c, shift * 0.6)),
  };
}
