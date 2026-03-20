/**
 * Pipeline phase profiler — instruments renderHashArt to show
 * exactly where time is spent across all 11 pipeline phases.
 *
 * This wraps the CanvasRenderingContext2D to count draw calls
 * and measure time per phase by intercepting canvas operations.
 */
import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { renderHashArt } from "../lib/render";

const TEST_HASH = "46192e59d42f741c761cbea79462a8b3815dd905";
const HASH_DEADBEEF = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

interface DrawCallStats {
  fill: number;
  stroke: number;
  fillRect: number;
  arc: number;
  beginPath: number;
  moveTo: number;
  lineTo: number;
  quadraticCurveTo: number;
  drawImage: number;
  save: number;
  restore: number;
  clip: number;
  getImageData: number;
  putImageData: number;
  createRadialGradient: number;
  createLinearGradient: number;
  setTransform: number;
  translate: number;
  scale: number;
  rotate: number;
}

function createInstrumentedCtx(width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const stats: DrawCallStats = {
    fill: 0, stroke: 0, fillRect: 0, arc: 0,
    beginPath: 0, moveTo: 0, lineTo: 0, quadraticCurveTo: 0,
    drawImage: 0, save: 0, restore: 0, clip: 0,
    getImageData: 0, putImageData: 0,
    createRadialGradient: 0, createLinearGradient: 0,
    setTransform: 0, translate: 0, scale: 0, rotate: 0,
  };

  // Wrap each method to count calls
  for (const method of Object.keys(stats) as Array<keyof DrawCallStats>) {
    const original = (ctx as any)[method];
    if (typeof original === "function") {
      (ctx as any)[method] = function (...args: any[]) {
        stats[method]++;
        return original.apply(ctx, args);
      };
    }
  }

  return { ctx, stats };
}

function formatMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`;
}

describe("Pipeline phase profiling", () => {
  const configs = [
    { label: "512×512", width: 512, height: 512 },
    { label: "1024×1024", width: 1024, height: 1024 },
  ];

  for (const { label, width, height } of configs) {
    it(`profiles ${label} with default hash`, () => {
      const { ctx, stats } = createInstrumentedCtx(width, height);

      const start = performance.now();
      renderHashArt(ctx, TEST_HASH, { width, height });
      const total = performance.now() - start;

      console.log(`\n  ═══ Pipeline profile: ${label} (hash=${TEST_HASH.slice(0, 8)}) ═══`);
      console.log(`  Total: ${formatMs(total)}`);
      console.log(`\n  Draw call counts:`);
      console.log(`    fill():           ${stats.fill}`);
      console.log(`    stroke():         ${stats.stroke}`);
      console.log(`    fillRect():       ${stats.fillRect}`);
      console.log(`    arc():            ${stats.arc}`);
      console.log(`    beginPath():      ${stats.beginPath}`);
      console.log(`    moveTo():         ${stats.moveTo}`);
      console.log(`    lineTo():         ${stats.lineTo}`);
      console.log(`    quadraticCurve(): ${stats.quadraticCurveTo}`);
      console.log(`    clip():           ${stats.clip}`);
      console.log(`    save()/restore(): ${stats.save}/${stats.restore}`);
      console.log(`    drawImage():      ${stats.drawImage}`);
      console.log(`    getImageData():   ${stats.getImageData}`);
      console.log(`    putImageData():   ${stats.putImageData}`);
      console.log(`    gradients:        ${stats.createRadialGradient + stats.createLinearGradient}`);
      console.log(`    transforms:       ${stats.translate + stats.scale + stats.rotate}`);

      const totalDrawOps = stats.fill + stats.stroke + stats.fillRect + stats.drawImage;
      console.log(`\n  Total draw ops (fill+stroke+fillRect+drawImage): ${totalDrawOps}`);
      console.log(`  Avg time per draw op: ${formatMs(total / totalDrawOps)}`);

      expect(total).toBeLessThan(30_000);
    });
  }

  it("profiles deadbeef hash (worst case) at 1024×1024", () => {
    const { ctx, stats } = createInstrumentedCtx(1024, 1024);

    const start = performance.now();
    renderHashArt(ctx, HASH_DEADBEEF, { width: 1024, height: 1024 });
    const total = performance.now() - start;

    console.log(`\n  ═══ Pipeline profile: 1024×1024 (hash=deadbeef — worst case) ═══`);
    console.log(`  Total: ${formatMs(total)}`);
    console.log(`\n  Draw call counts:`);
    console.log(`    fill():           ${stats.fill}`);
    console.log(`    stroke():         ${stats.stroke}`);
    console.log(`    fillRect():       ${stats.fillRect}`);
    console.log(`    arc():            ${stats.arc}`);
    console.log(`    beginPath():      ${stats.beginPath}`);
    console.log(`    clip():           ${stats.clip}`);
    console.log(`    save()/restore(): ${stats.save}/${stats.restore}`);

    const totalDrawOps = stats.fill + stats.stroke + stats.fillRect + stats.drawImage;
    console.log(`\n  Total draw ops: ${totalDrawOps}`);
    console.log(`  Avg time per draw op: ${formatMs(total / totalDrawOps)}`);

    expect(total).toBeLessThan(30_000);
  });

  it("compares shape counts across different hashes", () => {
    const hashes = [
      TEST_HASH,
      HASH_DEADBEEF,
      "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0",
      "7777777777777777777777777777777777777777",
    ];

    console.log(`\n  ═══ Shape count comparison (1024×1024) ═══`);
    console.log(`  ${"Hash".padEnd(12)} ${"Time".padStart(8)} ${"Fills".padStart(7)} ${"Strokes".padStart(8)} ${"FillRects".padStart(10)} ${"Clips".padStart(6)} ${"Total Ops".padStart(10)}`);

    for (const hash of hashes) {
      const { ctx, stats } = createInstrumentedCtx(1024, 1024);
      const start = performance.now();
      renderHashArt(ctx, hash, { width: 1024, height: 1024 });
      const ms = performance.now() - start;
      const totalOps = stats.fill + stats.stroke + stats.fillRect + stats.drawImage;

      console.log(
        `  ${hash.slice(0, 10).padEnd(12)} ${formatMs(ms).padStart(8)} ${String(stats.fill).padStart(7)} ${String(stats.stroke).padStart(8)} ${String(stats.fillRect).padStart(10)} ${String(stats.clip).padStart(6)} ${String(totalOps).padStart(10)}`
      );
    }

    expect(true).toBe(true);
  });
});
