import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { renderHashArt } from "../lib/render";
import * as utils from "../lib/utils";
import * as affinity from "../lib/canvas/shapes/affinity";
import * as colors from "../lib/canvas/colors";
import * as draw from "../lib/canvas/draw";
import { shapes } from "../lib/canvas/shapes";
import * as archetypes from "../lib/archetypes";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";
const HASH_B = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function timeMs(fn: () => void, iterations = 1): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - start;
}

function createTestCtx(width = 512, height = 512) {
  const canvas = createCanvas(width, height);
  return canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
}

// ── 1. Full pipeline benchmarks ─────────────────────────────────────

describe("Full pipeline timing", () => {
  const sizes: Array<[number, number, string]> = [
    [128, 128, "128×128 (tiny)"],
    [512, 512, "512×512 (small)"],
    [1024, 1024, "1024×1024 (medium)"],
    [2048, 2048, "2048×2048 (default)"],
  ];

  for (const [w, h, label] of sizes) {
    it(`renders ${label} within budget`, () => {
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const ms = timeMs(() => renderHashArt(ctx, TEST_HASH, { width: w, height: h }));
      console.log(`  ${label}: ${ms.toFixed(1)} ms`);
      expect(ms).toBeLessThan(30_000);
    });
  }

  it("renders 512×512 with gridSize=9 layers=5 (dense worst case)", () => {
    const ctx = createTestCtx(512, 512);
    const ms = timeMs(() =>
      renderHashArt(ctx, TEST_HASH, { width: 512, height: 512, gridSize: 9, layers: 5 }),
    );
    console.log(`  512×512 grid=9 layers=5: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(15_000);
  });

  it("renders 1024×1024 with multiple hashes consistently", () => {
    const hashes = [
      TEST_HASH,
      HASH_B,
      "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0",
      "7777777777777777777777777777777777777777",
    ];
    const times: number[] = [];
    for (const hash of hashes) {
      const canvas = createCanvas(1024, 1024);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const ms = timeMs(() => renderHashArt(ctx, hash, { width: 1024, height: 1024 }));
      times.push(ms);
      console.log(`  1024×1024 hash=${hash.slice(0, 8)}: ${ms.toFixed(1)} ms`);
    }
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`  Variance: fastest=${min.toFixed(1)} ms, slowest=${max.toFixed(1)} ms, ratio=${(max / min).toFixed(2)}×`);
    expect(max / min).toBeLessThan(8);
  });
});

// ── 2. Color pipeline micro-benchmarks ──────────────────────────────

describe("Color pipeline timing", () => {
  it("SacredColorScheme construction + getColorsByMode", () => {
    const iterations = 1000;
    const ms = timeMs(() => {
      const scheme = new colors.SacredColorScheme(TEST_HASH);
      scheme.getColorsByMode("harmonious");
    }, iterations);
    console.log(`  SacredColorScheme: ${(ms / iterations).toFixed(3)} ms/call (${iterations} iterations)`);
    expect(ms / iterations).toBeLessThan(5);
  });

  it("buildColorHierarchy", () => {
    const scheme = new colors.SacredColorScheme(TEST_HASH);
    const palette = scheme.getColors();
    const iterations = 10_000;
    const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
    const ms = timeMs(() => colors.buildColorHierarchy(palette, rng), iterations);
    console.log(`  buildColorHierarchy: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(1);
  });

  it("jitterColorHSL (hot path — called 2-3× per shape)", () => {
    const iterations = 50_000;
    const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
    const ms = timeMs(() => colors.jitterColorHSL("#4a7fc1", rng, 6, 0.05), iterations);
    console.log(`  jitterColorHSL: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.1);
  });

  it("enforceContrast (called per shape fill + stroke)", () => {
    const iterations = 50_000;
    const ms = timeMs(() => colors.enforceContrast("#4a7fc1", 0.15), iterations);
    console.log(`  enforceContrast: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.1);
  });

  it("luminance (called inside enforceContrast)", () => {
    const iterations = 100_000;
    const ms = timeMs(() => colors.luminance("#4a7fc1"), iterations);
    console.log(`  luminance: ${(ms / iterations).toFixed(5)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.05);
  });

  it("evolveHierarchy (called per layer)", () => {
    const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
    const scheme = new colors.SacredColorScheme(TEST_HASH);
    const palette = scheme.getColors();
    const hierarchy = colors.buildColorHierarchy(palette, rng);
    const iterations = 10_000;
    const ms = timeMs(() => colors.evolveHierarchy(hierarchy, 0.5, 20), iterations);
    console.log(`  evolveHierarchy: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.5);
  });

  it("hexWithAlpha (called many times per shape)", () => {
    const iterations = 100_000;
    const ms = timeMs(() => colors.hexWithAlpha("#4a7fc1", 0.5), iterations);
    console.log(`  hexWithAlpha: ${(ms / iterations).toFixed(5)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.01);
  });
});

// ── 3. Noise / flow field micro-benchmarks ──────────────────────────

describe("Noise and flow field timing", () => {
  it("createSimplexNoise setup", () => {
    const iterations = 1000;
    const ms = timeMs(() => {
      const rng = utils.createRng(utils.seedFromHash(TEST_HASH, 333));
      utils.createSimplexNoise(rng);
    }, iterations);
    console.log(`  createSimplexNoise: ${(ms / iterations).toFixed(3)} ms/call`);
    expect(ms / iterations).toBeLessThan(2);
  });

  it("FBM noise sampling (3 octaves — used for flow field)", () => {
    const rng = utils.createRng(utils.seedFromHash(TEST_HASH, 333));
    const noise = utils.createSimplexNoise(rng);
    const fbm = utils.createFBM(noise, 3, 2.0, 0.5);
    const iterations = 100_000;
    let sink = 0;
    const ms = timeMs(() => {
      sink += fbm(Math.random() * 5, Math.random() * 5);
    }, iterations);
    console.log(`  FBM (3 octaves): ${(ms / iterations).toFixed(5)} ms/call (sink=${sink.toFixed(2)})`);
    expect(ms / iterations).toBeLessThan(0.02);
  });
});

// ── 4. Shape palette and selection ──────────────────────────────────

describe("Shape palette timing", () => {
  it("buildShapePalette", () => {
    const shapeNames = Object.keys(shapes);
    const iterations = 5000;
    const ms = timeMs(() => {
      const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
      affinity.buildShapePalette(rng, shapeNames, "classic");
    }, iterations);
    console.log(`  buildShapePalette: ${(ms / iterations).toFixed(3)} ms/call`);
    expect(ms / iterations).toBeLessThan(2);
  });

  it("pickShapeFromPalette (called per shape)", () => {
    const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
    const shapeNames = Object.keys(shapes);
    const palette = affinity.buildShapePalette(rng, shapeNames, "classic");
    const iterations = 50_000;
    const ms = timeMs(() => affinity.pickShapeFromPalette(palette, rng, 0.5), iterations);
    console.log(`  pickShapeFromPalette: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.1);
  });
});

// ── 5. Archetype selection ──────────────────────────────────────────

describe("Archetype selection timing", () => {
  it("selectArchetype (including ~15% blend chance)", () => {
    const iterations = 10_000;
    const ms = timeMs(() => {
      const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
      archetypes.selectArchetype(rng);
    }, iterations);
    console.log(`  selectArchetype: ${(ms / iterations).toFixed(4)} ms/call`);
    expect(ms / iterations).toBeLessThan(0.5);
  });
});

// ── 6. Canvas draw operations (shape rendering) ─────────────────────

describe("Shape rendering timing", () => {
  const renderStyles = [
    ["fill-and-stroke", 5000, 2],
    ["watercolor", 2000, 5],
    ["stipple", 1000, 10],
    ["hatched", 2000, 5],
    ["noise-grain", 500, 15],
    ["fabric-weave", 1000, 5],
    ["hand-drawn", 2000, 5],
    ["marble-vein", 1000, 5],
    ["wood-grain", 1000, 5],
  ] as const;

  for (const [style, iterations, maxMs] of renderStyles) {
    it(`enhanceShapeGeneration — ${style}`, () => {
      const ctx = createTestCtx(512, 512);
      const rng = utils.createRng(utils.seedFromHash(TEST_HASH));
      const size = style === "noise-grain" ? 200 : style === "stipple" ? 120 : 80;
      const ms = timeMs(() => {
        draw.enhanceShapeGeneration(ctx, "circle", 256, 256, {
          fillColor: "rgba(74,127,193,0.5)",
          strokeColor: "#333333",
          strokeWidth: 2,
          size,
          rotation: 45,
          renderStyle: style,
          rng,
          lightAngle: 1.2,
          scaleFactor: 0.5,
        });
      }, iterations);
      console.log(`  enhanceShape (${style}): ${(ms / iterations).toFixed(3)} ms/call`);
      expect(ms / iterations).toBeLessThan(maxMs);
    });
  }
});
