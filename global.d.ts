declare module 'color-scheme' {
  class ColorScheme {
    from_hue(hue: number): this;
    scheme(name: string): this;
    variation(name: string): this;
    colors(): string[];
  }

  export = ColorScheme;
}

// declare module 'color-scheme';
