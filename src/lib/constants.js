export const PRESETS = {
  // Standard sizes with different hashes
  react: {
    hash: "46192e59d42f741c761cbea79462a8b3815dd905",
    width: 1024,
    height: 1024,
  },
  angular: {
    hash: "f31a6c3e94420f43c0cd323a5a6a99376ee59ff8",
    width: 1024,
    height: 1024,
    gridSize: 6, // Higher density grid
  },
  testing123: {
    hash: "a-random-string-that-is-32-characters-long",
    width: 2048,
    height: 2048,
    gridSize: 12, // Higher density
  },
  testing3: {
    hash: "43b45692efc234082f6990fa0c62b2ec1246cf17",
    width: 2048,
    height: 2048,
    gridSize: 12, // Higher density
  },
  testing3: {
    hash: "bc4c1aeb8d0bee786d980762064f3526c8ee8c03",
    width: 2048,
    height: 2048,
    gridSize: 16, // Higher density
  },
  // Wide format variations
  banner: {
    hash: "d847ffd4269b22c54d6e85ad3c1892a298e961fb",
    width: 1920,
    height: 480,
    gridSize: 8, // More horizontal cells for wide format
    shapesPerLayer: 40,
  },
  ultrawide: {
    hash: "a3e126e537ed2cd11ddf3a96c37066e97c7afee6",
    width: 3440,
    height: 1440,
    gridSize: 12, // Extra wide needs more cells
    shapesPerLayer: 60,
  },
  // Social media sizes
  "instagram-square": {
    hash: "ff00ff00ff00ff00ff00ff00ff00ff00ff00ff0",
    width: 1080,
    height: 1080,
  },
  "instagram-story": {
    hash: "abc123def456abc123def456abc123def456abc1",
    width: 1080,
    height: 1920,
    gridSize: 6,
    layers: 6,
  },
  "twitter-header": {
    hash: "7777777777777777777777777777777777777777",
    width: 1500,
    height: 500,
    gridSize: 8,
    shapesPerLayer: 35,
  },
  "linkedin-banner": {
    hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    width: 1584,
    height: 396,
    gridSize: 8,
    shapesPerLayer: 35,
  },
  // Mobile sizes
  "phone-wallpaper": {
    hash: "ffffffffffffffffffffffffffffffffaaaaaaaa",
    width: 1170,
    height: 2532, // iPhone 13 Pro size
    gridSize: 5,
    layers: 6,
  },
  "tablet-wallpaper": {
    hash: "123456789abcdef0123456789abcdef012345678",
    width: 2048,
    height: 2732, // iPad Pro size
    gridSize: 7,
    layers: 6,
  },
  // Special configurations
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
  // Print sizes
  "a4-portrait": {
    hash: "a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4",
    width: 2480,
    height: 3508, // A4 at 300 DPI
    gridSize: 8,
    layers: 6,
    shapesPerLayer: 45,
  },
  "a3-landscape": {
    hash: "a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3",
    width: 4961,
    height: 3508, // A3 at 300 DPI
    gridSize: 12,
    layers: 6,
    shapesPerLayer: 60,
  },
};

// Basic configuration that applies to all shapes
export const defaultShapeConfig = {
  strokeStyle: "#000000",
  fillStyle: "transparent",
  lineWidth: 1,
  rotation: 0,
  iterations: 1,
  animate: false, // For future use
};

// Base configuration types that can be extended per shape
export const ShapeConfigTypes = {
  BASIC: "basic",
  DETAILED: "detailed",
  ANIMATED: "animated",
};

// Golden ratio and other important proportions
export const Proportions = {
  GOLDEN_RATIO: 1.618034,
  SQUARE_ROOT_2: Math.sqrt(2),
  SQUARE_ROOT_3: Math.sqrt(3),
  SQUARE_ROOT_5: Math.sqrt(5),
  PI: Math.PI,
  PHI: (1 + Math.sqrt(5)) / 2,
};

// Helper for creating common sacred geometry combinations
export const PatternPresets = {
  flowerOfLifeMandala: (size) => [
    { type: "flowerOfLife", config: { size } },
    { type: "merkaba", config: { size: size * 0.8 } },
    { type: "sriYantra", config: { size: size * 0.5 } },
  ],

  platonicProgression: (size) => [
    { type: "platonicSolid", config: { size, type: "tetrahedron" } },
    { type: "platonicSolid", config: { size: size * 0.8, type: "cube" } },
    { type: "platonicSolid", config: { size: size * 0.6, type: "octahedron" } },
  ],

  cosmicTree: (size) => [
    { type: "treeOfLife", config: { size } },
    { type: "fibonacciSpiral", config: { size: size * 0.9 } },
    { type: "metatronsCube", config: { size: size * 0.7 } },
  ],
};
