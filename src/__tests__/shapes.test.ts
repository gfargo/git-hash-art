import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { shapes } from "../lib/canvas/shapes";
import { drawShape, enhanceShapeGeneration } from "../lib/canvas/draw";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";

function createTestCtx(size = 256) {
  const canvas = createCanvas(size, size);
  return canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
}

describe("all shapes render without crashing", () => {
  const shapeNames = Object.keys(shapes);

  it.each(shapeNames)("shape '%s' draws without error", (name) => {
    const ctx = createTestCtx();
    expect(() => shapes[name](ctx, 100)).not.toThrow();
  });

  it.each(shapeNames)("shape '%s' works through drawShape()", (name) => {
    const ctx = createTestCtx();
    expect(() =>
      drawShape(ctx, name, 128, 128, {
        fillColor: "#ff0000",
        strokeColor: "#000000",
        strokeWidth: 2,
        size: 80,
        rotation: 45,
      }),
    ).not.toThrow();
  });

  it.each(shapeNames)(
    "shape '%s' works through enhanceShapeGeneration()",
    (name) => {
      const ctx = createTestCtx();
      expect(() =>
        enhanceShapeGeneration(ctx, name, 128, 128, {
          fillColor: "#ff0000",
          strokeColor: "#000000",
          strokeWidth: 2,
          size: 80,
          rotation: 45,
          proportionType: "GOLDEN_RATIO",
        }),
      ).not.toThrow();
    },
  );
});

describe("platonicSolid handles missing config.type gracefully", () => {
  it("renders with no config at all", () => {
    const ctx = createTestCtx();
    expect(() => shapes["platonicSolid"](ctx, 100)).not.toThrow();
  });

  it("renders with explicit type", () => {
    const ctx = createTestCtx();
    expect(() =>
      shapes["platonicSolid"](ctx, 100, { type: "tetrahedron" }),
    ).not.toThrow();
  });

  it("renders with invalid type (falls back)", () => {
    const ctx = createTestCtx();
    expect(() =>
      shapes["platonicSolid"](ctx, 100, { type: "nonexistent" }),
    ).not.toThrow();
  });
});
