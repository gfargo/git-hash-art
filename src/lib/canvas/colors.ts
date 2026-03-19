import ColorScheme from "color-scheme";
import "../../../global.d";

import { gitHashToSeed } from "../utils";

/**
 * Generates a color scheme based on a given Git hash.
 */
export function generateColorScheme(gitHash: string): string[] {
  const seed = gitHashToSeed(gitHash);
  const scheme = new ColorScheme();
  scheme
    .from_hue(seed % 360)
    .scheme("analogic")
    .variation("soft");

  let colors = scheme.colors().map((hex: string) => `#${hex}`);

  const contrastingHue = (seed + 180) % 360;
  const contrastingScheme = new ColorScheme();
  contrastingScheme.from_hue(contrastingHue).scheme("mono").variation("soft");
  colors.push(`#${contrastingScheme.colors()[0]}`);

  return colors;
}

interface MetallicColors {
  gold: string;
  silver: string;
  copper: string;
  bronze: string;
}

// Enhanced color scheme generation for sacred geometry
export class SacredColorScheme {
  private seed: number;
  public baseScheme: string[];
  private complementaryScheme: string[];
  private triadicScheme: string[];
  private metallic: MetallicColors;

  constructor(gitHash: string) {
    this.seed = gitHashToSeed(gitHash);
    this.baseScheme = this.generateBaseScheme();
    this.complementaryScheme = this.generateComplementaryScheme();
    this.triadicScheme = this.generateTriadicScheme();
    this.metallic = this.generateMetallicColors();
  }

  private generateBaseScheme(): string[] {
    const scheme = new ColorScheme();
    return scheme
      .from_hue(this.seed % 360)
      .scheme("analogic")
      .variation("soft")
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  private generateComplementaryScheme(): string[] {
    const complementaryHue = (this.seed + 180) % 360;
    const scheme = new ColorScheme();
    return scheme
      .from_hue(complementaryHue)
      .scheme("mono")
      .variation("soft")
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  private generateTriadicScheme(): string[] {
    const triadicHue = (this.seed + 120) % 360;
    const scheme = new ColorScheme();
    return scheme
      .from_hue(triadicHue)
      .scheme("triade")
      .variation("soft")
      .colors()
      .map((hex: string) => `#${hex}`);
  }

  private generateMetallicColors(): MetallicColors {
    return {
      gold: "#FFD700",
      silver: "#C0C0C0",
      copper: "#B87333",
      bronze: "#CD7F32",
    };
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
