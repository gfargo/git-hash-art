import fs from 'fs';
import path from 'path';
import { generateImageFromHash, saveImageToFile } from '../dist/main.js';
import { PRESETS } from '../src/lib/constants.js';

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
        ...testCase, // Include any additional configuration from the preset
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

// Run the test cases
generateTestCases();



// const gitHash = '1234567890abcdef1234567890abcdef12345678';
// const imageBuffer = generateImageFromHash(gitHash, { width: 1024, height: 1024 });
// const savedImagePath = saveImageToFile(imageBuffer, './output', gitHash, 'example', 1024, 1024);
// console.log(`Image saved to: ${savedImagePath}`);

