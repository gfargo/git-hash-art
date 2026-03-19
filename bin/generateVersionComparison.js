#!/usr/bin/env node

/**
 * generateVersionComparison.js
 *
 * Generates the same set of test images across every published version of
 * git-hash-art, storing each version's output in its own directory.
 *
 * Output structure:
 *   examples/versions/<version>/  — one folder per version
 *
 * Versions that lack the expected API (generateImageFromHash, PRESETS, or
 * saveImageToFile) are skipped with a warning.
 *
 * A local build from ./dist/main.js is also included as "local".
 *
 * Usage:
 *   node bin/generateVersionComparison.js [--min-version 0.3.0] [--cache-dir /tmp/gha-versions]
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Configuration ──────────────────────────────────────────────────────────

const PACKAGE_NAME = "git-hash-art";
const DEFAULT_MIN_VERSION = "0.2.0";
const DEFAULT_CACHE_DIR = path.join(
  require("os").tmpdir(),
  "git-hash-art-version-cache"
);
const OUTPUT_BASE = path.resolve("./examples/versions");

/**
 * Hardcoded test cases — identical across every version so the comparison
 * is meaningful even if older versions shipped different PRESETS.
 */
const TEST_CASES = {
  react: {
    hash: "46192e59d42f741c761cbea79462a8b3815dd905",
    width: 1024,
    height: 1024,
  },
  angular: {
    hash: "f31a6c3e94420f43c0cd323a5a6a99376ee59ff8",
    width: 1024,
    height: 1024,
    gridSize: 6,
  },
  banner: {
    hash: "d847ffd4269b22c54d6e85ad3c1892a298e961fb",
    width: 1920,
    height: 480,
    gridSize: 8,
    shapesPerLayer: 40,
  },
  "instagram-square": {
    hash: "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0",
    width: 1080,
    height: 1080,
  },
  "twitter-header": {
    hash: "7777777777777777777777777777777777777777",
    width: 1500,
    height: 500,
    gridSize: 8,
    shapesPerLayer: 35,
  },
  minimal: {
    hash: "000000000000000000000000000000000fffffff",
    width: 1024,
    height: 1024,
    layers: 3,
    baseOpacity: 0.8,
    shapesPerLayer: 15,
  },
  complex: {
    hash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    width: 2048,
    height: 2048,
    gridSize: 8,
    layers: 7,
    shapesPerLayer: 50,
    minShapeSize: 30,
    maxShapeSize: 250,
  },
};

// ── CLI argument parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    minVersion: DEFAULT_MIN_VERSION,
    cacheDir: DEFAULT_CACHE_DIR,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--min-version" && args[i + 1]) {
      opts.minVersion = args[++i];
    } else if (args[i] === "--cache-dir" && args[i + 1]) {
      opts.cacheDir = path.resolve(args[++i]);
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(
        `Usage: node bin/generateVersionComparison.js [options]\n\n` +
          `Options:\n` +
          `  --min-version <ver>  Minimum version to include (default: ${DEFAULT_MIN_VERSION})\n` +
          `  --cache-dir <path>   Directory to cache installed versions\n` +
          `                       (default: ${DEFAULT_CACHE_DIR})\n`
      );
      process.exit(0);
    }
  }
  return opts;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Naive semver comparison — works for simple x.y.z versions. */
function semverGte(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true; // equal
}

/** Fetch the list of published versions from npm. */
function getPublishedVersions() {
  const raw = execSync(`npm view ${PACKAGE_NAME} versions --json`, {
    encoding: "utf-8",
  });
  const versions = JSON.parse(raw);
  return Array.isArray(versions) ? versions : [versions];
}

/**
 * Ensure a specific version is installed in the cache directory.
 * Returns the path to the installed package's main entry.
 */
function ensureVersionInstalled(version, cacheDir) {
  const versionDir = path.join(cacheDir, version);
  const marker = path.join(versionDir, "node_modules", PACKAGE_NAME);

  if (fs.existsSync(marker)) {
    return marker; // already cached
  }

  fs.mkdirSync(versionDir, { recursive: true });

  // Create a minimal package.json so npm install works
  const pkgJson = path.join(versionDir, "package.json");
  if (!fs.existsSync(pkgJson)) {
    fs.writeFileSync(
      pkgJson,
      JSON.stringify({ name: `gha-test-${version}`, private: true }, null, 2)
    );
  }

  console.log(`  Installing ${PACKAGE_NAME}@${version}...`);
  execSync(
    `npm install ${PACKAGE_NAME}@${version} @napi-rs/canvas --no-save --legacy-peer-deps 2>&1`,
    { cwd: versionDir, encoding: "utf-8", stdio: "pipe" }
  );

  return marker;
}

/**
 * Try to load the lib from a given path and validate it has the API we need.
 * Returns { generateImageFromHash, saveImageToFile } or null.
 */
function tryLoadLib(libPath, label) {
  try {
    // Clear require cache so each version loads fresh
    Object.keys(require.cache)
      .filter((k) => k.includes(PACKAGE_NAME) || k.includes("git-hash-art"))
      .forEach((k) => delete require.cache[k]);

    const lib = require(libPath);
    const { generateImageFromHash, saveImageToFile } = lib;

    if (typeof generateImageFromHash !== "function") {
      console.warn(`  ⚠ ${label}: generateImageFromHash not found — skipping`);
      return null;
    }
    if (typeof saveImageToFile !== "function") {
      // Fallback: we can save manually if saveImageToFile is missing
      return { generateImageFromHash, saveImageToFile: null };
    }
    return { generateImageFromHash, saveImageToFile };
  } catch (err) {
    console.warn(`  ⚠ ${label}: failed to load — ${err.message}`);
    return null;
  }
}

/** Save a PNG buffer to disk, with or without the lib's saveImageToFile. */
function saveImage(buffer, outputDir, label, testCase, saveImageToFile) {
  if (saveImageToFile) {
    return saveImageToFile(
      buffer,
      outputDir,
      testCase.hash,
      label,
      testCase.width,
      testCase.height
    );
  }
  // Manual fallback
  fs.mkdirSync(outputDir, { recursive: true });
  const shortHash = testCase.hash.slice(0, 8);
  const filename = `${label}-${testCase.width}x${testCase.height}-${shortHash}.png`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// ── Per-version generation ─────────────────────────────────────────────────

function generateForVersion(lib, _versionLabel, outputDir) {
  const results = [];
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [label, testCase] of Object.entries(TEST_CASES)) {
    try {
      const config = { ...testCase };
      delete config.hash;
      const buffer = lib.generateImageFromHash(testCase.hash, {
        width: testCase.width,
        height: testCase.height,
        ...config,
      });
      const outputPath = saveImage(
        buffer,
        outputDir,
        label,
        testCase,
        lib.saveImageToFile
      );
      results.push({ label, success: true, outputPath });
    } catch (err) {
      results.push({ label, success: false, error: err.message });
    }
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log(`\n🎨 git-hash-art Version Comparison Generator`);
  console.log(`   Min version : ${opts.minVersion}`);
  console.log(`   Cache dir   : ${opts.cacheDir}`);
  console.log(`   Output dir  : ${OUTPUT_BASE}\n`);

  // Collect all versions to process (published + local)
  const allPublished = getPublishedVersions();
  const versions = allPublished.filter((v) => semverGte(v, opts.minVersion));

  console.log(
    `Found ${allPublished.length} published versions, ` +
      `${versions.length} >= ${opts.minVersion}\n`
  );

  const summary = [];

  // ── Published versions ──
  for (const version of versions) {
    console.log(`▸ ${version}`);
    try {
      const libPath = ensureVersionInstalled(version, opts.cacheDir);
      const lib = tryLoadLib(libPath, version);
      if (!lib) {
        summary.push({ version, status: "skipped", reason: "incompatible API" });
        continue;
      }

      const outputDir = path.join(OUTPUT_BASE, version);
      const results = generateForVersion(lib, version, outputDir);
      const passed = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(
        `  ✓ ${passed} images generated` +
          (failed ? `, ✗ ${failed} failed` : "") +
          ` → ${outputDir}`
      );

      summary.push({ version, status: "done", passed, failed, outputDir });
    } catch (err) {
      console.error(`  ✗ ${version}: ${err.message}`);
      summary.push({ version, status: "error", reason: err.message });
    }
  }

  // ── Local build ──
  console.log(`\n▸ local (./dist/main.js)`);
  const localLibPath = path.resolve("./dist/main.js");
  if (fs.existsSync(localLibPath)) {
    const lib = tryLoadLib(localLibPath, "local");
    if (lib) {
      const outputDir = path.join(OUTPUT_BASE, "local");
      const results = generateForVersion(lib, "local", outputDir);
      const passed = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      console.log(
        `  ✓ ${passed} images generated` +
          (failed ? `, ✗ ${failed} failed` : "") +
          ` → ${outputDir}`
      );
      summary.push({ version: "local", status: "done", passed, failed, outputDir });
    } else {
      summary.push({
        version: "local",
        status: "skipped",
        reason: "could not load",
      });
    }
  } else {
    console.warn(`  ⚠ Local build not found — run "yarn build" first`);
    summary.push({
      version: "local",
      status: "skipped",
      reason: "dist/main.js not found",
    });
  }

  // ── Summary ──
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Summary:\n`);
  for (const s of summary) {
    if (s.status === "done") {
      console.log(
        `  ✓ ${s.version.padEnd(10)} ${s.passed} images` +
          (s.failed ? ` (${s.failed} failed)` : "")
      );
    } else {
      console.log(`  ⚠ ${s.version.padEnd(10)} ${s.status}: ${s.reason}`);
    }
  }
  console.log(`\nOutput: ${OUTPUT_BASE}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
