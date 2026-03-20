/**
 * Phase-level timing profiler — measures cost of each pipeline section
 * by running the full pipeline with instrumented timing hooks.
 *
 * Strategy: We can't easily instrument inside renderHashArt without
 * modifying it, so instead we measure the cost of individual subsystems
 * in isolation at realistic scales, then compare to full pipeline time.
 */
import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { renderHashArt } from "../lib/render";
import * as utils from "../lib/utils";
import * as colors from "../lib/canvas/colors";

const HASHES = [
  { label: "46192e59", hash: "46192e59d42f741c761cbea79462a8b3815dd905" },
  { label: "deadbeef", hash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
  { label: "ff00ff00", hash: "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0" },
  { label: "77777777", hash: "7777777777777777777777777777777777777777" },
];

function fmt(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`;
}

describe("Phase cost breakdown", () => {
  it("measures noise texture (phase 7) cost in isolation", () => {
    // Phase 7 does getImageData → pixel loop → putImageData
    // At 1024×1024 that's ~1.3M noise dots
    const sizes = [512, 1024, 2048];
    console.log("\n  ═══ Noise texture (phase 7) cost ═══");
    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      // Fill with something so getImageData has data
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, size, size);

      const noiseDensity = Math.floor((size * size) / 800);
      const noiseRng = utils.createRng(utils.seedFromHash("test", 777));

      const start = performance.now();
      const imageData = ctx.getImageData(0, 0, size, size);
      const getTime = performance.now() - start;

      const data = imageData.data;
      const loopStart = performance.now();
      for (let i = 0; i < noiseDensity; i++) {
        const nx = Math.floor(noiseRng() * size);
        const ny = Math.floor(noiseRng() * size);
        const brightness = noiseRng() > 0.5 ? 255 : 0;
        const alpha = Math.floor((0.01 + noiseRng() * 0.03) * 255);
        const idx = (ny * size + nx) * 4;
        const srcA = alpha / 255;
        const invA = 1 - srcA;
        data[idx] = Math.round(data[idx] * invA + brightness * srcA);
        data[idx + 1] = Math.round(data[idx + 1] * invA + brightness * srcA);
        data[idx + 2] = Math.round(data[idx + 2] * invA + brightness * srcA);
      }
      const loopTime = performance.now() - loopStart;

      const putStart = performance.now();
      ctx.putImageData(imageData, 0, 0);
      const putTime = performance.now() - putStart;

      console.log(`  ${size}×${size}: getImageData=${fmt(getTime)}, loop(${noiseDensity} dots)=${fmt(loopTime)}, putImageData=${fmt(putTime)}, total=${fmt(getTime + loopTime + putTime)}`);
    }
    expect(true).toBe(true);
  });

  it("measures flow line cost (phase 6) — per-segment stroke vs batched", () => {
    console.log("\n  ═══ Flow line (phase 6) cost: per-segment vs batched ═══");
    const size = 1024;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    // Simulate realistic flow line parameters
    const numLines = 15;
    const stepsPerLine = 50;
    const totalSegments = numLines * stepsPerLine;

    // Current approach: beginPath/moveTo/lineTo/stroke per segment
    const start1 = performance.now();
    for (let line = 0; line < numLines; line++) {
      let px = Math.random() * size;
      let py = Math.random() * size;
      for (let s = 0; s < stepsPerLine; s++) {
        const nx = px + (Math.random() - 0.5) * 10;
        const ny = py + (Math.random() - 0.5) * 10;
        ctx.globalAlpha = 0.1 * (1 - s / stepsPerLine);
        ctx.strokeStyle = `rgba(100,150,200,0.3)`;
        ctx.lineWidth = 2 * (1 - s / stepsPerLine * 0.8);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx;
        py = ny;
      }
    }
    const perSegTime = performance.now() - start1;

    // Batched approach: group segments by quantized state
    const start2 = performance.now();
    // Quantize into alpha buckets (e.g. 5 buckets)
    const ALPHA_BUCKETS = 5;
    const buckets: Array<Array<[number, number, number, number]>> = [];
    for (let i = 0; i < ALPHA_BUCKETS; i++) buckets.push([]);

    for (let line = 0; line < numLines; line++) {
      let px = Math.random() * size;
      let py = Math.random() * size;
      for (let s = 0; s < stepsPerLine; s++) {
        const nx = px + (Math.random() - 0.5) * 10;
        const ny = py + (Math.random() - 0.5) * 10;
        const t = s / stepsPerLine;
        const bucketIdx = Math.min(ALPHA_BUCKETS - 1, Math.floor(t * ALPHA_BUCKETS));
        buckets[bucketIdx].push([px, py, nx, ny]);
        px = nx;
        py = ny;
      }
    }
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const t = (b + 0.5) / ALPHA_BUCKETS;
      ctx.globalAlpha = 0.1 * (1 - t);
      ctx.strokeStyle = `rgba(100,150,200,0.3)`;
      ctx.lineWidth = 2 * (1 - t * 0.8);
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of buckets[b]) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    const batchedTime = performance.now() - start2;

    console.log(`  Per-segment (${totalSegments} segments): ${fmt(perSegTime)}`);
    console.log(`  Batched (${ALPHA_BUCKETS} buckets): ${fmt(batchedTime)}`);
    console.log(`  Speedup: ${(perSegTime / batchedTime).toFixed(1)}×`);
    expect(true).toBe(true);
  });

  it("measures energy line cost (phase 6b)", () => {
    console.log("\n  ═══ Energy lines (phase 6b) cost ═══");
    const size = 1024;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    // Worst case: 15 energy sources × 6 bursts = 90 line segments
    const energyCount = 15;
    const burstsPerSource = 6;

    // Current: per-segment beginPath/stroke
    const start1 = performance.now();
    for (let e = 0; e < energyCount; e++) {
      for (let b = 0; b < burstsPerSource; b++) {
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = "rgba(100,150,200,0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      }
    }
    const perSegTime = performance.now() - start1;

    // Batched: single path
    const start2 = performance.now();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let e = 0; e < energyCount; e++) {
      for (let b = 0; b < burstsPerSource; b++) {
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
      }
    }
    ctx.stroke();
    const batchedTime = performance.now() - start2;

    console.log(`  Per-segment (${energyCount * burstsPerSource} lines): ${fmt(perSegTime)}`);
    console.log(`  Batched (single path): ${fmt(batchedTime)}`);
    console.log(`  Speedup: ${(perSegTime / batchedTime).toFixed(1)}×`);
    expect(true).toBe(true);
  });

  it("measures connecting curves (phase 9) cost", () => {
    console.log("\n  ═══ Connecting curves (phase 9) cost ═══");
    const size = 1024;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    const numCurves = 8; // typical for 1024×1024
    // Current: per-curve beginPath/quadraticCurveTo/stroke
    const start1 = performance.now();
    for (let i = 0; i < numCurves; i++) {
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "rgba(100,150,200,0.3)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.quadraticCurveTo(
        Math.random() * size, Math.random() * size,
        Math.random() * size, Math.random() * size,
      );
      ctx.stroke();
    }
    const perCurveTime = performance.now() - start1;
    console.log(`  Per-curve (${numCurves} curves): ${fmt(perCurveTime)}`);
    expect(true).toBe(true);
  });

  it("measures hexWithAlpha hot path cost", () => {
    // hexWithAlpha is called thousands of times — check if caching helps
    console.log("\n  ═══ hexWithAlpha caching potential ═══");
    const iterations = 100_000;
    const colors_list = ["#4a7fc1", "#c14a7f", "#7fc14a", "#f0e0d0", "#333333"];
    const alphas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      colors.hexWithAlpha(colors_list[i % colors_list.length], alphas[i % alphas.length]);
    }
    const uncachedTime = performance.now() - start;

    // Simple cache simulation
    const cache = new Map<string, string>();
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const c = colors_list[i % colors_list.length];
      const a = alphas[i % alphas.length];
      const key = `${c}|${a}`;
      if (!cache.has(key)) {
        cache.set(key, colors.hexWithAlpha(c, a));
      }
      cache.get(key);
    }
    const cachedTime = performance.now() - start2;

    console.log(`  Uncached: ${fmt(uncachedTime)} (${(uncachedTime / iterations * 1000).toFixed(2)}µs/call)`);
    console.log(`  Cached:   ${fmt(cachedTime)} (${(cachedTime / iterations * 1000).toFixed(2)}µs/call)`);
    console.log(`  Speedup:  ${(uncachedTime / cachedTime).toFixed(1)}×`);
    expect(true).toBe(true);
  });

  it("full pipeline breakdown — before vs after", () => {
    console.log("\n  ═══ Full pipeline timing (1024×1024) ═══");
    for (const { label, hash } of HASHES) {
      const canvas = createCanvas(1024, 1024);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const start = performance.now();
      renderHashArt(ctx, hash, { width: 1024, height: 1024 });
      const ms = performance.now() - start;
      console.log(`  ${label}: ${fmt(ms)}`);
    }
    expect(true).toBe(true);
  });
});
