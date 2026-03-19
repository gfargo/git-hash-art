import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";

describe("@napi-rs/canvas compatibility", () => {
  it("createCanvas produces a valid canvas with 2d context", () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeDefined();
    expect(typeof ctx.fillRect).toBe("function");
    expect(typeof ctx.beginPath).toBe("function");
    expect(typeof ctx.arc).toBe("function");
  });

  it("canvas.toBuffer produces a valid PNG buffer", () => {
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 64, 64);
    const buf = canvas.toBuffer("image/png");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x4e); // N
    expect(buf[3]).toBe(0x47); // G
  });

  it("gradient API works", () => {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const buf = canvas.toBuffer("image/png");
    expect(buf.length).toBeGreaterThan(0);
  });
});
