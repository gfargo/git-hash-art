import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { renderHashArt } from "../lib/render";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";

function createTestCtx(width = 128, height = 128) {
  const canvas = createCanvas(width, height);
  return canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
}

describe("renderHashArt (core renderer)", () => {
  it("renders without error on a provided context", () => {
    const ctx = createTestCtx();
    expect(() =>
      renderHashArt(ctx, TEST_HASH, { width: 128, height: 128 }),
    ).not.toThrow();
  });

  it("is deterministic — same hash + config produces identical pixel data", () => {
    const canvas1 = createCanvas(64, 64);
    const canvas2 = createCanvas(64, 64);
    const config = { width: 64, height: 64, gridSize: 3 };

    renderHashArt(
      canvas1.getContext("2d") as unknown as CanvasRenderingContext2D,
      TEST_HASH,
      config,
    );
    renderHashArt(
      canvas2.getContext("2d") as unknown as CanvasRenderingContext2D,
      TEST_HASH,
      config,
    );

    const buf1 = canvas1.toBuffer("image/png");
    const buf2 = canvas2.toBuffer("image/png");
    expect(buf1.equals(buf2)).toBe(true);
  });

  it("different hashes produce different output", () => {
    const canvas1 = createCanvas(64, 64);
    const canvas2 = createCanvas(64, 64);
    const config = { width: 64, height: 64, gridSize: 3 };

    renderHashArt(
      canvas1.getContext("2d") as unknown as CanvasRenderingContext2D,
      TEST_HASH,
      config,
    );
    renderHashArt(
      canvas2.getContext("2d") as unknown as CanvasRenderingContext2D,
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      config,
    );

    const buf1 = canvas1.toBuffer("image/png");
    const buf2 = canvas2.toBuffer("image/png");
    expect(buf1.equals(buf2)).toBe(false);
  });

  it("uses defaults when no config is provided", () => {
    // Large default canvas — just verify it doesn't throw
    const canvas = createCanvas(2048, 2048);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => renderHashArt(ctx, TEST_HASH)).not.toThrow();
  });

  it("respects custom config values", () => {
    const ctx = createTestCtx(256, 128);
    expect(() =>
      renderHashArt(ctx, TEST_HASH, {
        width: 256,
        height: 128,
        layers: 2,
        gridSize: 3,
        baseOpacity: 0.5,
      }),
    ).not.toThrow();
  });
});
