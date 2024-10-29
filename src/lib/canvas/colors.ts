import ColorScheme from "color-scheme";
import "../../../global.d";

import { gitHashToSeed } from "../utils";

/**
 * Generates a color scheme based on a given Git hash.
 *
 * @param {string} gitHash - The Git hash used to generate the color scheme.
 * @returns {string[]} An array of hex color codes representing the generated color scheme.
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

interface SacredPalette {
  primary: string;
  secondary: string;
  accent: string;
  metallic: string;
}

interface ElementalPalette {
  earth: string;
  water: string;
  air: string;
  fire: string;
}

interface ChakraPalette {
  root: string;
  sacral: string;
  solar: string;
  heart: string;
  throat: string;
  third_eye: string;
  crown: string;
}

type ColorPalette = SacredPalette | ElementalPalette | ChakraPalette | string[];

// Enhanced color scheme generation for sacred geometry
export class SacredColorScheme {
  private seed: number;
  public baseScheme: string[];
  private complementaryScheme: string[];
  private metallic: MetallicColors;

  constructor(gitHash: string) {
    this.seed = this.gitHashToSeed(gitHash);
    this.baseScheme = this.generateBaseScheme();
    this.complementaryScheme = this.generateComplementaryScheme();
    this.metallic = this.generateMetallicColors();
  }

  private gitHashToSeed(hash: string): number {
    return parseInt(hash.slice(0, 8), 16);
  }

  private generateBaseScheme(): string[] {
    const scheme = new ColorScheme();
    scheme;
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

  private generateMetallicColors(): MetallicColors {
    return {
      gold: "#FFD700",
      silver: "#C0C0C0",
      copper: "#B87333",
      bronze: "#CD7F32",
    };
  }

  getColorPalette(
    type: "sacred" | "elemental" | "chakra" | "default" = "sacred",
  ): ColorPalette {
    switch (type) {
      case "sacred":
        return {
          primary: this.baseScheme[0],
          secondary: this.baseScheme[1],
          accent: this.complementaryScheme[0],
          metallic: this.metallic.gold,
        };
      case "elemental":
        return {
          earth: this.baseScheme[0],
          water: this.baseScheme[1],
          air: this.baseScheme[2],
          fire: this.complementaryScheme[0],
        };
      case "chakra":
        return {
          root: "#FF0000",
          sacral: "#FF7F00",
          solar: "#FFFF00",
          heart: "#00FF00",
          throat: "#0000FF",
          third_eye: "#4B0082",
          crown: "#8F00FF",
        };
      default:
        return this.baseScheme;
    }
  }
}
