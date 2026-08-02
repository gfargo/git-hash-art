import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createHash } from "crypto";
import { generateImageFromHash, renderHashArt } from "../index";

/**
 * `renderHashArt` treats a present config key as an explicit caller
 * override (`config.gridSize ?? archetype.gridSize`). Any wrapper that
 * resolves DEFAULT_CONFIG before calling it therefore suppresses every
 * archetype's own grid, layer, size and opacity settings, collapsing all
 * of the rendering personalities into one.
 *
 * That regression is invisible: output stays deterministic and every other
 * test passes, the images are simply far less varied. These tests pin the
 * contract.
 */
const SIZE = 220;

function hashFor(i: number): string {
  return createHash("sha1").update(`parity-${i}`).digest("hex");
}

function viaRenderHashArt(hash: string): Buffer {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderHashArt(ctx, hash, { width: SIZE, height: SIZE });
  return canvas.toBuffer("image/png");
}

describe("wrapper config parity", () => {
  it("generateImageFromHash matches renderHashArt for the same partial config", () => {
    for (let i = 0; i < 12; i++) {
      const hash = hashFor(i);
      const wrapper = generateImageFromHash(hash, {
        width: SIZE,
        height: SIZE,
      });
      expect(
        wrapper.equals(viaRenderHashArt(hash)),
        `hash ${hash.slice(0, 8)} differs between entry points`,
      ).toBe(true);
    }
  });

  it("still honours an explicit override", () => {
    const hash = hashFor(99);
    const a = generateImageFromHash(hash, {
      width: SIZE,
      height: SIZE,
      gridSize: 2,
    });
    const b = generateImageFromHash(hash, {
      width: SIZE,
      height: SIZE,
      gridSize: 9,
    });
    expect(a.equals(b)).toBe(false);
  });

  it("archetype variety survives the wrapper", () => {
    // If defaults were being forwarded, every archetype would render at the
    // same gridSize/layers/sizes and the corpus would collapse toward one
    // density. Painted coverage is a cheap proxy: its spread across hashes
    // should stay wide.
    const coverage: number[] = [];
    for (let i = 0; i < 24; i++) {
      const canvas = createCanvas(SIZE, SIZE);
      const ctx = canvas.getContext(
        "2d",
      ) as unknown as CanvasRenderingContext2D;
      renderHashArt(ctx, hashFor(i), { width: SIZE, height: SIZE });
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
      const counts = new Map<number, number>();
      for (let p = 0; p < SIZE * SIZE; p++) {
        const k =
          ((data[p * 4] >> 4) << 8) |
          ((data[p * 4 + 1] >> 4) << 4) |
          (data[p * 4 + 2] >> 4);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      let best = 0;
      for (const c of counts.values()) if (c > best) best = c;
      coverage.push(1 - best / (SIZE * SIZE));
    }
    coverage.sort((a, b) => a - b);
    const spread = coverage[coverage.length - 1] - coverage[0];
    expect(spread).toBeGreaterThan(0.35);
  });
});
