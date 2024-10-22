import ColorScheme from "color-scheme";
import { gitHashToSeed } from "../utils";


/**
 * Generates a color scheme based on a given Git hash.
 *
 * @param {string} gitHash - The Git hash used to generate the color scheme.
 * @returns {string[]} An array of hex color codes representing the generated color scheme.
 */
export function generateColorScheme(gitHash) {
  const seed = gitHashToSeed(gitHash);
  const scheme = new ColorScheme();
  scheme
    .from_hue(seed % 360)
    .scheme("analogic")
    .variation("soft");

  let colors = scheme.colors().map((hex) => `#${hex}`);

  const contrastingHue = (seed + 180) % 360;
  const contrastingScheme = new ColorScheme();
  contrastingScheme.from_hue(contrastingHue).scheme("mono").variation("soft");
  colors.push(`#${contrastingScheme.colors()[0]}`);

  return colors;
}

// Enhanced color scheme generation for sacred geometry
export class SacredColorScheme {
  constructor(gitHash) {
    this.seed = this.gitHashToSeed(gitHash);
    this.baseScheme = this.generateBaseScheme();
    this.complementaryScheme = this.generateComplementaryScheme();
    this.metallic = this.generateMetallicColors();
  }

  gitHashToSeed(hash) {
    return parseInt(hash.slice(0, 8), 16);
  }

  generateBaseScheme() {
    const scheme = new ColorScheme();
    return scheme
      .from_hue(this.seed % 360)
      .scheme("analogic")
      .variation("soft")
      .colors()
      .map((hex) => `#${hex}`);
  }

  generateComplementaryScheme() {
    const complementaryHue = (this.seed + 180) % 360;
    const scheme = new ColorScheme();
    return scheme
      .from_hue(complementaryHue)
      .scheme("mono")
      .variation("soft")
      .colors()
      .map((hex) => `#${hex}`);
  }

  generateMetallicColors() {
    return {
      gold: "#FFD700",
      silver: "#C0C0C0",
      copper: "#B87333",
      bronze: "#CD7F32",
    };
  }

  getColorPalette(type = "sacred") {
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
