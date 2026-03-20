/**
 * Per-phase timing breakdown using _debugTiming instrumentation.
 * This gives exact cost of each pipeline section inside renderHashArt.
 */
import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { renderHashArt } from "../lib/render";
import type { GenerationConfig } from "../types";

const HASHES = [
  { label: "46192e59", hash: "46192e59d42f741c761cbea79462a8b3815dd905" },
  { label: "deadbeef", hash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
  { label: "ff00ff00", hash: "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0" },
  { label: "77777777", hash: "7777777777777777777777777777777777777777" },
];

function fmt(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`;
}

describe("Phase breakdown via _debugTiming", () => {
  for (const { label, hash } of HASHES) {
    it(`${label} at 1024×1024`, () => {
      const canvas = createCanvas(1024, 1024);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const timing: GenerationConfig["_debugTiming"] = { phases: {}, shapeCount: 0, extraCount: 0 };
      const config: Partial<GenerationConfig> = { width: 1024, height: 1024, _debugTiming: timing };

      const start = performance.now();
      renderHashArt(ctx, hash, config);
      const total = performance.now() - start;

      console.log(`\n  ═══ ${label} (${total.toFixed(0)}ms total, ${timing!.shapeCount} shapes, ${timing!.extraCount} extras) ═══`);
      const phases = timing!.phases;
      // Sort by cost descending
      const sorted = Object.entries(phases).sort((a, b) => b[1] - a[1]);
      for (const [name, ms] of sorted) {
        const pct = ((ms / total) * 100).toFixed(1);
        console.log(`  ${name.padEnd(25)} ${fmt(ms).padStart(10)}  (${pct}%)`);
      }
      expect(total).toBeLessThan(5_000); // was 30s, now targeting <5s
    });
  }
});
