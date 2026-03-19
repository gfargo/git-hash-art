#!/usr/bin/env node

const { execSync } = require("child_process");
const { generateImageFromHash, saveImageToFile } = require("../dist/main.js");
const { PRESETS } = require("../dist/main.js");

const HELP = `
git-hash-art — Generate deterministic abstract art from git hashes.

Usage:
  git-hash-art current [options]          Generate art from HEAD commit
  git-hash-art generate <hash> [options]  Generate art from a specific hash

Options:
  --width <n>       Canvas width in pixels (default: 2048)
  --height <n>      Canvas height in pixels (default: 2048)
  --output <dir>    Output directory (default: ./output)
  --preset <name>   Use a built-in preset (overrides width/height)
  --layers <n>      Number of layers (default: 4)
  --grid <n>        Grid density (default: 5)
  --list-presets    List available presets

Examples:
  npx git-hash-art current
  npx git-hash-art current --preset instagram-square
  npx git-hash-art generate abc123ff --width 1920 --height 1080
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { command: null, hash: null, options: {} };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsed.command = "help";
      i += 1;
    } else if (arg === "--list-presets") {
      parsed.command = "list-presets";
      i += 1;
    } else if (arg === "--width" && args[i + 1]) {
      parsed.options.width = parseInt(args[i + 1], 10);
      i += 2;
    } else if (arg === "--height" && args[i + 1]) {
      parsed.options.height = parseInt(args[i + 1], 10);
      i += 2;
    } else if (arg === "--output" && args[i + 1]) {
      parsed.options.output = args[i + 1];
      i += 2;
    } else if (arg === "--preset" && args[i + 1]) {
      parsed.options.preset = args[i + 1];
      i += 2;
    } else if (arg === "--layers" && args[i + 1]) {
      parsed.options.layers = parseInt(args[i + 1], 10);
      i += 2;
    } else if (arg === "--grid" && args[i + 1]) {
      parsed.options.gridSize = parseInt(args[i + 1], 10);
      i += 2;
    } else if (!arg.startsWith("-") && !parsed.command) {
      // First positional arg is the command
      parsed.command = arg;
      if (parsed.command === "generate" && args[i + 1] && !args[i + 1].startsWith("-")) {
        parsed.hash = args[i + 1];
        i += 2;
        continue;
      }
      i += 1;
    } else {
      i += 1;
    }
  }

  return parsed;
}

function getHeadHash() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    console.error("Error: Not a git repository or git is not installed.");
    process.exit(1);
  }
}

function listPresets() {
  console.log("\nAvailable presets:\n");
  for (const [name, config] of Object.entries(PRESETS)) {
    console.log(`  ${name.padEnd(20)} ${config.width}x${config.height}`);
  }
  console.log("");
}

function run() {
  const { command, hash, options } = parseArgs(process.argv);

  if (!command || command === "help") {
    console.log(HELP);
    process.exit(0);
  }

  if (command === "list-presets") {
    listPresets();
    process.exit(0);
  }

  if (command !== "current" && command !== "generate") {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exit(1);
  }

  let gitHash;
  if (command === "current") {
    gitHash = getHeadHash();
    console.log(`Using HEAD: ${gitHash}`);
  } else {
    if (!hash) {
      console.error("Error: Please provide a hash.\n");
      console.log("Usage: git-hash-art generate <hash> [options]");
      process.exit(1);
    }
    gitHash = hash;
  }

  // Build config from preset + overrides
  let config = {};
  if (options.preset) {
    const preset = PRESETS[options.preset];
    if (!preset) {
      console.error(`Unknown preset: ${options.preset}`);
      console.log("Use --list-presets to see available presets.");
      process.exit(1);
    }
    config = { ...preset };
    delete config.hash;
  }

  if (options.width) config.width = options.width;
  if (options.height) config.height = options.height;
  if (options.layers) config.layers = options.layers;
  if (options.gridSize) config.gridSize = options.gridSize;

  const outputDir = options.output || "./output";

  try {
    const buffer = generateImageFromHash(gitHash, config);
    const w = config.width || 2048;
    const h = config.height || 2048;
    const outputPath = saveImageToFile(buffer, outputDir, gitHash, "", w, h);
    console.log(`Done! Image saved to ${outputPath}`);
  } catch (error) {
    console.error("Generation failed:", error.message);
    process.exit(1);
  }
}

run();
