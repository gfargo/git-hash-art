# Project Structure

```
src/
  index.ts              # Node.js entry: generateImageFromHash, saveImageToFile, re-exports renderHashArt
  browser.ts            # Browser entry: renderToCanvas, generateImageBlob, generateDataURL, re-exports renderHashArt
  types.ts              # Shared GenerationConfig interface and DEFAULT_CONFIG
  __tests__/            # Vitest test files (*.test.ts)
  lib/
    render.ts           # Pure rendering logic (environment-agnostic) — renderHashArt()
    utils.ts            # Hash-to-seed conversion, deterministic RNG, PatternCombiner
    constants.ts        # PRESETS, default shape config, proportions, pattern presets
    canvas/
      colors.ts         # Color scheme generation (generateColorScheme, SacredColorScheme class)
      draw.ts           # Shape drawing and enhancement (drawShape, enhanceShapeGeneration)
      shapes/
        index.ts        # Aggregates and re-exports all shape draw functions
        basic.ts        # Circle, square, triangle, hexagon, star
        complex.ts      # Platonic solids, fibonacci, golden ratio shapes
        sacred.ts       # Flower of life, tree of life, Metatron's cube, Sri Yantra
        utils.ts        # Geometry helpers (transforms, degree conversion)
bin/
  generateExamples.js   # Script to generate example images from PRESETS
examples/               # Generated example PNGs (gitignored)
```

## Architecture

- `src/lib/render.ts` contains the pure rendering core (`renderHashArt`) that only uses the standard `CanvasRenderingContext2D` API — no Node or browser dependencies
- `src/index.ts` is the Node entry point — wraps `renderHashArt` with `@napi-rs/canvas` for PNG buffer output and `fs` for file saving
- `src/browser.ts` is the browser entry point — wraps `renderHashArt` with `HTMLCanvasElement`/`OffscreenCanvas` helpers
- `@napi-rs/canvas` is an optional peer dependency, only required for Node.js usage

## Conventions

- Shape draw functions follow the `DrawFunction` signature: `(ctx: CanvasRenderingContext2D, size: number, config?: any) => void`
- Shapes are grouped by category (basic, complex, sacred) and merged via the barrel `shapes/index.ts`
- All randomness is derived deterministically from the git hash via `getRandomFromHash` — never use `Math.random()`
- Tests live in `src/__tests__/` and use Vitest (`describe`/`it`/`expect`)
- The `examples/` directory is gitignored; regenerate with `yarn build:examples`
