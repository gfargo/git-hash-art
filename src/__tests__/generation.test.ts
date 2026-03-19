import { describe, it, expect } from "vitest";
import { generateImageFromHash } from "../index";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";

describe("generateImageFromHash", () => {
  it("produces a valid PNG buffer with default config", () => {
    const buf = generateImageFromHash(TEST_HASH, { width: 128, height: 128 });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("is deterministic — same hash produces identical output", () => {
    const config = { width: 128, height: 128, gridSize: 4 };
    const buf1 = generateImageFromHash(TEST_HASH, config);
    const buf2 = generateImageFromHash(TEST_HASH, config);
    expect(buf1.equals(buf2)).toBe(true);
  });

  it("different hashes produce different images", () => {
    const config = { width: 128, height: 128, gridSize: 4 };
    const buf1 = generateImageFromHash(TEST_HASH, config);
    const buf2 = generateImageFromHash(
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      config,
    );
    expect(buf1.equals(buf2)).toBe(false);
  });

  it("respects custom dimensions", () => {
    const buf = generateImageFromHash(TEST_HASH, { width: 64, height: 32 });
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles non-square aspect ratios", () => {
    expect(() =>
      generateImageFromHash(TEST_HASH, {
        width: 1920,
        height: 480,
        gridSize: 8,
      }),
    ).not.toThrow();
  });

  it("handles high layer count without crashing", () => {
    expect(() =>
      generateImageFromHash(TEST_HASH, {
        width: 128,
        height: 128,
        layers: 5,
        gridSize: 4,
      }),
    ).not.toThrow();
  });
});
