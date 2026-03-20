import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import * as render from "../lib/render";
import * as affinity from "../lib/canvas/shapes/affinity";
import type { CustomDrawFunction } from "../types";

describe("Custom shapes", () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    const canvas = createCanvas(256, 256);
    ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  });

  it("should render with custom shapes without crashing", () => {
    const drawSpy = vi.fn<CustomDrawFunction>((ctx, size, rng) => {
      const r = size / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.closePath();
    });

    expect(() => {
      render.renderHashArt(ctx, "abcdef1234567890", {
        width: 256,
        height: 256,
        customShapes: {
          myCircle: { draw: drawSpy },
        },
      });
    }).not.toThrow();
  });

  it("should pass deterministic RNG to custom draw function", () => {
    const rngValues: number[] = [];
    const makeDraw = (collector: number[]): CustomDrawFunction => (ctx, size, rng) => {
      collector.push(rng());
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.closePath();
    };

    render.renderHashArt(ctx, "deadbeefdeadbeef", {
      width: 256,
      height: 256,
      customShapes: {
        onlyShape: {
          draw: makeDraw(rngValues),
          profile: { tier: 1, heroCandidate: true, affinities: ["onlyShape"] },
        },
      },
    });

    if (rngValues.length > 0) {
      const rngValues2: number[] = [];
      const canvas2 = createCanvas(256, 256);
      const ctx2 = canvas2.getContext("2d") as unknown as CanvasRenderingContext2D;

      render.renderHashArt(ctx2, "deadbeefdeadbeef", {
        width: 256,
        height: 256,
        customShapes: {
          onlyShape: {
            draw: makeDraw(rngValues2),
            profile: { tier: 1, heroCandidate: true, affinities: ["onlyShape"] },
          },
        },
      });

      expect(rngValues).toEqual(rngValues2);
    }
  });

  it("should not crash with empty customShapes", () => {
    expect(() => {
      render.renderHashArt(ctx, "1111111111111111", {
        width: 256,
        height: 256,
        customShapes: {},
      });
    }).not.toThrow();
  });

  it("should not crash with undefined customShapes", () => {
    expect(() => {
      render.renderHashArt(ctx, "2222222222222222", {
        width: 256,
        height: 256,
      });
    }).not.toThrow();
  });

  it("should clean up custom profiles after render", () => {
    render.renderHashArt(ctx, "3333333333333333", {
      width: 256,
      height: 256,
      customShapes: {
        tempShape: {
          draw: (ctx, size) => {
            ctx.beginPath();
            ctx.rect(-size / 2, -size / 2, size, size);
            ctx.closePath();
          },
        },
      },
    });

    expect(affinity.SHAPE_PROFILES["tempShape"]).toBeUndefined();
  });

  it("should apply custom profile overrides", () => {
    affinity.registerCustomProfile("testShape", {
      tier: 1,
      minSizeFraction: 0.1,
      maxSizeFraction: 0.5,
      affinities: ["circle", "triangle"],
      heroCandidate: true,
      bestStyles: ["stroke-only"],
    });

    const profile = affinity.SHAPE_PROFILES["testShape"];
    expect(profile).toBeDefined();
    expect(profile.tier).toBe(1);
    expect(profile.minSizeFraction).toBe(0.1);
    expect(profile.maxSizeFraction).toBe(0.5);
    expect(profile.heroCandidate).toBe(true);
    expect(profile.bestStyles).toEqual(["stroke-only"]);
    expect(profile.category).toBe("procedural");

    affinity.unregisterCustomProfile("testShape");
    expect(affinity.SHAPE_PROFILES["testShape"]).toBeUndefined();
  });

  it("should use sensible defaults for missing profile fields", () => {
    affinity.registerCustomProfile("defaultsShape", {});

    const profile = affinity.SHAPE_PROFILES["defaultsShape"];
    expect(profile.tier).toBe(2);
    expect(profile.minSizeFraction).toBe(0.05);
    expect(profile.maxSizeFraction).toBe(1.0);
    expect(profile.affinities).toEqual(["circle", "square"]);
    expect(profile.heroCandidate).toBe(false);
    expect(profile.bestStyles).toEqual(["fill-and-stroke", "watercolor"]);

    affinity.unregisterCustomProfile("defaultsShape");
  });

  it("should render with multiple custom shapes", () => {
    const diamond: CustomDrawFunction = (ctx, size, rng) => {
      const half = size / 2;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half * rng(), 0);
      ctx.lineTo(0, half);
      ctx.lineTo(-half * rng(), 0);
      ctx.closePath();
    };

    const cross: CustomDrawFunction = (ctx, size, rng) => {
      const arm = size * 0.15;
      const half = size / 2 * (0.8 + rng() * 0.2);
      ctx.beginPath();
      ctx.rect(-arm, -half, arm * 2, size);
      ctx.rect(-half, -arm, size, arm * 2);
      ctx.closePath();
    };

    expect(() => {
      render.renderHashArt(ctx, "cafebabe12345678", {
        width: 256,
        height: 256,
        customShapes: {
          customDiamond: { draw: diamond },
          customCross: {
            draw: cross,
            profile: { tier: 1, heroCandidate: true },
          },
        },
      });
    }).not.toThrow();
  });
});
