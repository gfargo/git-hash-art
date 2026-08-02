#!/usr/bin/env node
/**
 * Corpus evaluation harness.
 *
 * The existing tests check determinism and validity — that a render happens
 * and happens the same way twice. They say nothing about whether the images
 * are any good, which is the property that actually regresses. Every
 * artistic change so far has been judged with throwaway scripts rebuilt from
 * scratch each time, so numbers were never comparable across sessions.
 *
 * This renders a fixed corpus, computes metrics designed to catch *failure*
 * (not to define beauty), writes contact sheets for human judgement, and
 * diffs against a saved baseline.
 *
 *   node bin/evaluate.js                    # evaluate, write report + sheets
 *   node bin/evaluate.js --baseline         # save the current run as baseline
 *   node bin/evaluate.js --count 64         # smaller/faster corpus
 *   node bin/evaluate.js --no-sheets        # metrics only
 *
 * The metrics are a triage tool. The quality gate is looking at the sheets.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createCanvas } = require("@napi-rs/canvas");
const { renderHashArt } = require("../dist/main.js");

// Renders and the full report are local artefacts. The baseline lives in
// the repo: comparing against a baseline that only exists on one machine
// defeats the purpose of having one.
const OUT_DIR = path.resolve(__dirname, "../.evaluation");
const BASELINE = path.resolve(__dirname, "../evaluation-baseline.json");

// Fixed corpus: derived from a constant seed so the same hashes are used
// every run, on every machine, forever. Comparisons are meaningless
// otherwise.
const CORPUS_SEED = "git-hash-art-evaluation-corpus-v1";

const FORMATS = [
  { name: "square", width: 512, height: 512 },
  { name: "landscape", width: 640, height: 400 },
  { name: "portrait", width: 400, height: 640 },
  { name: "banner", width: 768, height: 256 },
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { count: 128, sheets: true, baseline: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") opts.count = parseInt(args[++i], 10);
    else if (args[i] === "--no-sheets") opts.sheets = false;
    else if (args[i] === "--baseline") opts.baseline = true;
  }
  return opts;
}

function corpusHashes(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      crypto
        .createHash("sha1")
        .update(`${CORPUS_SEED}/${i}`)
        .digest("hex"),
    );
  }
  return out;
}

// ── Metrics ─────────────────────────────────────────────────────────
// Each is chosen to flag a specific failure mode seen in real output, not
// to score aesthetics. Anything that can't name the failure it detects
// doesn't belong here.

function analyze(data, w, h) {
  const n = w * h;
  const lum = new Float32Array(n);
  let chromaSum = 0;
  let clipped = 0; // blown highlights — pale archetypes losing all detail
  let crushed = 0; // dead shadows — dark archetypes collapsing to black
  const hueBins = new Float64Array(36);
  let comX = 0;
  let comY = 0;
  let comW = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    if (l > 0.97) clipped++;
    if (l < 0.02) crushed++;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const d = mx - mn;
    chromaSum += d;
    if (d > 0.08) {
      let hue;
      if (mx === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) hue = ((b - r) / d + 2) / 6;
      else hue = ((r - g) / d + 4) / 6;
      hueBins[Math.min(35, (hue * 36) | 0)] += d;
    }
  }

  // Modal ground colour, then coverage as distance from it in full RGB. A
  // luminance-only test scores a saturated mark on an equal-luminance
  // ground as blank canvas.
  const bins = new Map();
  for (let i = 0; i < n; i++) {
    const k =
      ((data[i * 4] >> 4) << 8) |
      ((data[i * 4 + 1] >> 4) << 4) |
      (data[i * 4 + 2] >> 4);
    bins.set(k, (bins.get(k) || 0) + 1);
  }
  let groundKey = 0;
  let groundCount = 0;
  for (const [k, c] of bins) {
    if (c > groundCount) {
      groundCount = c;
      groundKey = k;
    }
  }
  const gr = ((groundKey >> 8) & 15) * 16 + 8;
  const gg = ((groundKey >> 4) & 15) * 16 + 8;
  const gb = (groundKey & 15) * 16 + 8;
  let painted = 0;
  for (let i = 0; i < n; i++) {
    const dr = data[i * 4] - gr;
    const dg = data[i * 4 + 1] - gg;
    const db = data[i * 4 + 2] - gb;
    const off = dr * dr + dg * dg + db * db > 22 * 22;
    if (off) {
      painted++;
      const x = i % w;
      const y = (i / w) | 0;
      comX += x;
      comY += y;
      comW++;
    }
  }

  // Edge density — "is there anything to look at". A canvas covered by two
  // huge gradient-filled shapes has full coverage and a wide value range
  // but no structure.
  let edges = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + w] - lum[i - w];
      if (gx * gx + gy * gy > 0.0016) edges++;
    }
  }

  // Edge engagement — does the composition touch the frame, or float in a
  // centred pool of empty margin.
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  let edgePainted = 0;
  let edgeTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onBand =
        x < band || y < band || x >= w - band || y >= h - band;
      if (!onBand) continue;
      edgeTotal++;
      const i = y * w + x;
      const dr = data[i * 4] - gr;
      const dg = data[i * 4 + 1] - gg;
      const db = data[i * 4 + 2] - gb;
      if (dr * dr + dg * dg + db * db > 22 * 22) edgePainted++;
    }
  }

  const sorted = Float32Array.from(lum).sort();
  const q = (p) => sorted[Math.floor(p * (n - 1))];

  const hueTotal = hueBins.reduce((a, b) => a + b, 0);
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i < 36; i++) {
    if (hueBins[i] > peak) {
      peak = hueBins[i];
      peakIdx = i;
    }
  }
  let dominantMass = 0;
  for (let d = -2; d <= 2; d++) dominantMass += hueBins[(peakIdx + d + 36) % 36];

  return {
    valueRange: q(0.98) - q(0.02),
    meanChroma: chromaSum / n,
    coverage: painted / n,
    edgeDensity: edges / n,
    edgeEngagement: edgeTotal > 0 ? edgePainted / edgeTotal : 0,
    hueSpread: hueTotal > 0 ? 1 - dominantMass / hueTotal : 0,
    clippedHighlights: clipped / n,
    crushedShadows: crushed / n,
    // 0 = mass centred, 1 = mass pinned to a corner. Flags the
    // "centred blob floating in margin" silhouette.
    massOffset:
      comW > 0
        ? Math.hypot(comX / comW - w / 2, comY / comW - h / 2) /
          Math.hypot(w / 2, h / 2)
        : 0,
  };
}

// ── Failure classification ──────────────────────────────────────────
// Named failures, each traceable to something actually seen in output.

const FAILURES = [
  {
    key: "flat",
    label: "no tonal range",
    test: (m) => m.valueRange < 0.25,
  },
  {
    key: "empty",
    label: "almost nothing painted",
    test: (m) => m.coverage < 0.35,
  },
  {
    key: "bare",
    label: "no structure to read",
    test: (m) => m.edgeDensity < 0.03,
  },
  {
    key: "blownOut",
    label: "highlights clipped away",
    test: (m) => m.clippedHighlights > 0.25,
  },
  {
    key: "crushed",
    label: "shadows collapsed to black",
    test: (m) => m.crushedShadows > 0.35,
  },
  {
    key: "drab",
    label: "no colour",
    test: (m) => m.meanChroma < 0.06,
  },
];

function classify(m) {
  return FAILURES.filter((f) => f.test(m)).map((f) => f.key);
}

// ── Contact sheets ──────────────────────────────────────────────────

function writeSheet(file, tiles, cell) {
  const cols = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / cols);
  const pad = 5;
  const sheet = createCanvas(
    cols * (cell + pad) + pad,
    rows * (cell + pad) + pad,
  );
  const g = sheet.getContext("2d");
  g.fillStyle = "#101012";
  g.fillRect(0, 0, sheet.width, sheet.height);
  tiles.forEach((t, i) => {
    const c = i % cols;
    const r = (i / cols) | 0;
    const x = pad + c * (cell + pad);
    const y = pad + r * (cell + pad);
    const scale = Math.min(cell / t.width, cell / t.height);
    const dw = t.width * scale;
    const dh = t.height * scale;
    g.drawImage(t.canvas, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh);
    if (t.failures.length > 0) {
      g.strokeStyle = "#d05a4a";
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  });
  fs.writeFileSync(file, sheet.toBuffer("image/png"));
}

// ── Run ─────────────────────────────────────────────────────────────

function pct(x) {
  return `${(100 * x).toFixed(1)}%`;
}

function median(values) {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  return v[v.length >> 1];
}

function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hashes = corpusHashes(opts.count);
  const records = [];
  const sheets = {};
  for (const f of FORMATS) sheets[f.name] = [];

  const started = Date.now();
  for (let i = 0; i < hashes.length; i++) {
    // Rotate formats through the corpus so every format is exercised
    // without multiplying the render count by four.
    const format = FORMATS[i % FORMATS.length];
    const canvas = createCanvas(format.width, format.height);
    const ctx = canvas.getContext("2d");
    const info = {};
    const t0 = process.hrtime.bigint();
    renderHashArt(ctx, hashes[i], {
      width: format.width,
      height: format.height,
      _debugInfo: info,
    });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const metrics = analyze(
      ctx.getImageData(0, 0, format.width, format.height).data,
      format.width,
      format.height,
    );
    const failures = classify(metrics);
    records.push({
      hash: hashes[i].slice(0, 10),
      format: format.name,
      ms: +ms.toFixed(1),
      scene: info,
      metrics,
      failures,
    });
    if (opts.sheets) {
      sheets[format.name].push({
        canvas,
        width: format.width,
        height: format.height,
        failures,
      });
    }
    if ((i + 1) % 16 === 0) {
      process.stdout.write(`  rendered ${i + 1}/${hashes.length}\r`);
    }
  }
  const elapsed = (Date.now() - started) / 1000;

  if (opts.sheets) {
    for (const f of FORMATS) {
      if (sheets[f.name].length === 0) continue;
      writeSheet(
        path.join(OUT_DIR, `sheet-${f.name}.png`),
        sheets[f.name],
        320,
      );
    }
  }

  // ── Report ──
  const metricKeys = Object.keys(records[0].metrics);
  const summary = { metrics: {}, failures: {}, scene: {} };
  for (const k of metricKeys) {
    summary.metrics[k] = +median(records.map((r) => r.metrics[k])).toFixed(4);
  }
  for (const f of FAILURES) {
    summary.failures[f.key] =
      records.filter((r) => r.failures.includes(f.key)).length / records.length;
  }
  summary.failures.any =
    records.filter((r) => r.failures.length > 0).length / records.length;

  for (const field of [
    "archetype",
    "paletteMode",
    "backgroundStyle",
    "compositionMode",
    "symmetry",
  ]) {
    const counts = {};
    for (const r of records) {
      const v = r.scene[field] ?? "unknown";
      counts[v] = (counts[v] || 0) + 1;
    }
    summary.scene[field] = counts;
  }
  summary.scene.attractorShare =
    records.filter((r) => r.scene.attractor).length / records.length;
  summary.timing = {
    meanMs: +(records.reduce((a, r) => a + r.ms, 0) / records.length).toFixed(1),
    medianMs: +median(records.map((r) => r.ms)).toFixed(1),
    p95Ms: +[...records.map((r) => r.ms)].sort((a, b) => a - b)[
      Math.floor(records.length * 0.95)
    ].toFixed(1),
  };

  const report = { corpusSeed: CORPUS_SEED, count: records.length, summary, records };
  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2),
  );

  // ── Console output ──
  console.log(`\ncorpus: ${records.length} renders in ${elapsed.toFixed(1)}s`);
  console.log(
    `timing: mean ${summary.timing.meanMs}ms  median ${summary.timing.medianMs}ms  p95 ${summary.timing.p95Ms}ms\n`,
  );

  console.log("failures");
  for (const f of FAILURES) {
    const share = summary.failures[f.key];
    const bar = "█".repeat(Math.round(share * 40));
    console.log(
      `  ${f.key.padEnd(18)} ${pct(share).padStart(6)}  ${bar}  ${f.label}`,
    );
  }
  console.log(`  ${"ANY".padEnd(18)} ${pct(summary.failures.any).padStart(6)}\n`);

  console.log("median metrics");
  for (const k of metricKeys) {
    console.log(`  ${k.padEnd(20)} ${summary.metrics[k].toFixed(3)}`);
  }

  console.log("\ndiversity");
  const arch = summary.scene.archetype;
  const archTop = Object.entries(arch).sort((a, b) => b[1] - a[1]);
  const topShare = archTop[0][1] / records.length;
  console.log(
    `  archetypes seen      ${archTop.length}   most common ${archTop[0][0]} at ${pct(topShare)}`,
  );
  console.log(
    `  attractor substrate  ${pct(summary.scene.attractorShare)}`,
  );
  const sym = summary.scene.symmetry;
  console.log(
    `  symmetry             ${pct(1 - (sym.none || 0) / records.length)}`,
  );

  // ── Baseline diff ──
  if (opts.baseline) {
    fs.writeFileSync(BASELINE, JSON.stringify({ summary }, null, 2));
    console.log(`\nsaved baseline → ${path.relative(process.cwd(), BASELINE)}`);
  } else if (fs.existsSync(BASELINE)) {
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).summary;
    console.log("\nvs baseline");
    for (const f of [...FAILURES.map((x) => x.key), "any"]) {
      const before = base.failures[f] ?? 0;
      const after = summary.failures[f];
      const delta = after - before;
      if (Math.abs(delta) < 0.005) continue;
      const arrow = delta < 0 ? "▼" : "▲";
      console.log(
        `  ${f.padEnd(18)} ${pct(before).padStart(6)} → ${pct(after).padStart(6)}  ${arrow} ${pct(Math.abs(delta))}`,
      );
    }
    const mt = base.timing;
    if (mt) {
      console.log(
        `  ${"median ms".padEnd(18)} ${mt.medianMs} → ${summary.timing.medianMs}`,
      );
    }
  } else {
    console.log(
      "\nno baseline saved — run with --baseline to record this run for comparison",
    );
  }

  console.log(
    `\nreport  → ${path.relative(process.cwd(), path.join(OUT_DIR, "report.json"))}`,
  );
  if (opts.sheets) {
    console.log(
      `sheets  → ${path.relative(process.cwd(), OUT_DIR)}/sheet-*.png  (red border = flagged)`,
    );
  }
  console.log(
    "\nThe metrics triage; they do not judge. Look at the sheets before concluding anything.",
  );
}

main();
