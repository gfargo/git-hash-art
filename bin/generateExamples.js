#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { generateImageFromHash, saveImageToFile } = require('../dist/main.js');
const { PRESETS } = require('../dist/main.js');

const OUTPUT_DIR = './examples';

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function generateTestCases() {
  console.log("Generating test cases...");
  console.log("Output directory:", path.resolve(OUTPUT_DIR));

  const results = [];
  for (const [label, testCase] of Object.entries(PRESETS)) {
    try {
      console.log(`Generating image for ${label}...`);
      const imageBuffer = generateImageFromHash(testCase.hash, {
        width: testCase.width,
        height: testCase.height,
        ...testCase,
      });
      const outputPath = saveImageToFile(imageBuffer, OUTPUT_DIR, testCase.hash, label, testCase.width, testCase.height);
      results.push({ label, hash: testCase.hash, outputPath, success: true });
    } catch (error) {
      console.error(`Failed to generate image for ${label}:`, error);
      results.push({
        label,
        hash: testCase.hash,
        success: false,
        error: error.message,
      });
    }
  }

  console.log("\nGeneration Summary:");
  console.log("------------------");
  results.forEach(({ label, success, outputPath, error }) => {
    if (success) {
      console.log(`✓ ${label}: ${outputPath}`);
    } else {
      console.log(`✗ ${label}: Failed - ${error}`);
    }
  });
}

generateTestCases();
