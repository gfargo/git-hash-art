# git-hash-art

Generate beautiful, deterministic abstract art from git commit hashes. Perfect for creating unique visual representations of your project's commits, generating placeholder images, or creating artistic wallpapers.

Works in both Node.js and browser environments.

## Features

- Deterministic output — same hash always produces the same image
- Hash-driven color palettes — 6 variation modes × 5 scheme types for dramatic palette diversity
- Per-layer blend modes — `screen`, `multiply`, `overlay`, `soft-light`, and more for painterly depth
- 6 shape render styles — fill+stroke, wireframe, dashed, double-stroke, watercolor bleed, fill-only
- 20+ shape types across three categories: basic, complex, and sacred geometry
- Layered composition with depth — early layers use simple shapes, later layers use intricate ones
- Atmospheric perspective — later layers desaturate for foreground/background separation
- Negative space — void zones and density-aware placement create intentional breathing room
- Watercolor-style transparency with semi-transparent fills and color blending
- Organic edges — ~15% of shapes get multi-pass watercolor bleed for hand-drawn quality
- Glow effects on sacred geometry shapes for an ethereal quality
- Layered backgrounds — faint shapes and concentric rings add texture before the main layers
- Tapered flow lines — brush-stroke curves with width and opacity tapering
- Radial gradient fills and organic color jitter for a hand-painted feel
- Organic bezier curves connecting nearby shapes
- Configurable canvas size, layers, shape sizes, and opacity
- Built-in presets for social media, device wallpapers, and print sizes
- CLI for generating art from the current commit or a specific hash
- Cross-platform: runs in Node.js (via `@napi-rs/canvas`) and browsers (native Canvas API)

## Installation

```bash
npm install git-hash-art
```

For Node.js usage you also need the canvas backend:

```bash
npm install @napi-rs/canvas
```

Browser usage requires no additional dependencies — the library uses the native Canvas 2D API.

## Node.js Usage

```javascript
import { generateImageFromHash, saveImageToFile } from 'git-hash-art';

// Generate a PNG buffer from a git hash
const gitHash = '46192e59d42f741c761cbea79462a8b3815dd905';
const imageBuffer = generateImageFromHash(gitHash);

// Save to disk
saveImageToFile(imageBuffer, './output', gitHash, 'my-art', 2048, 2048);
```

### Advanced Node.js Usage

```javascript
import { generateImageFromHash } from 'git-hash-art';

const config = {
  width: 1920,
  height: 1080,
  gridSize: 6,
  layers: 5,
  shapesPerLayer: 40,
  minShapeSize: 20,
  maxShapeSize: 300,
  baseOpacity: 0.7,
  opacityReduction: 0.12
};

const imageBuffer = generateImageFromHash(gitHash, config);
```

## Browser Usage

```javascript
import { renderToCanvas, generateDataURL, generateImageBlob } from 'git-hash-art/browser';
```

### Render onto an existing canvas element

```javascript
import { renderToCanvas } from 'git-hash-art/browser';

const canvas = document.getElementById('art-canvas');
canvas.width = 1024;
canvas.height = 1024;

renderToCanvas(canvas, '46192e59d42f741c761cbea79462a8b3815dd905');
```

### Generate a data URL (for `<img>` tags)

```javascript
import { generateDataURL } from 'git-hash-art/browser';

const dataUrl = generateDataURL('46192e59d42f741c761cbea79462a8b3815dd905', {
  width: 512,
  height: 512,
});

document.getElementById('preview').src = dataUrl;
```

### Generate a Blob (for downloads or uploads)

```javascript
import { generateImageBlob } from 'git-hash-art/browser';

const blob = await generateImageBlob('46192e59d42f741c761cbea79462a8b3815dd905', {
  width: 1080,
  height: 1080,
});

// Trigger a download
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'hash-art.png';
a.click();
```

## Core Renderer (Environment-Agnostic)

If you need full control, both entry points re-export `renderHashArt` which
accepts any standard `CanvasRenderingContext2D` — useful for custom canvas
setups, Web Workers with `OffscreenCanvas`, or server-side rendering
frameworks.

```javascript
import { renderHashArt } from 'git-hash-art'; // or 'git-hash-art/browser'

const ctx = myCanvas.getContext('2d');
renderHashArt(ctx, '46192e59d42f741c761cbea79462a8b3815dd905', {
  width: myCanvas.width,
  height: myCanvas.height,
});
```

## Configuration Options

| Option            | Type   | Default | Description                                          |
| ----------------- | ------ | ------- | ---------------------------------------------------- |
| `width`           | number | 2048    | Canvas width in pixels                               |
| `height`          | number | 2048    | Canvas height in pixels                              |
| `gridSize`        | number | 5       | Controls base shape count per layer (gridSize² × 1.5)|
| `layers`          | number | 4       | Number of layers to generate                         |
| `shapesPerLayer`  | number | auto    | Base shapes per layer (defaults to gridSize² × 1.5)  |
| `minShapeSize`    | number | 30      | Minimum shape size in pixels (scaled to canvas)      |
| `maxShapeSize`    | number | 400     | Maximum shape size in pixels (scaled to canvas)      |
| `baseOpacity`     | number | 0.7     | Starting opacity for the first layer                 |
| `opacityReduction`| number | 0.12    | Opacity reduction per layer                          |

## Shape Categories

Shapes are selected with layer-aware weighting — early layers favor simple shapes for background texture, later layers favor intricate ones for foreground detail.

**Basic** — circle, square, triangle, hexagon, star, diamond, cube, heart

**Complex** — platonic solids, fibonacci spiral, islamic pattern, celtic knot, merkaba, mandala, fractal

**Sacred Geometry** — flower of life, tree of life, Metatron's cube, Sri Yantra, seed of life, vesica piscis, torus, egg of life

## Preset Sizes

```javascript
import { PRESETS } from 'git-hash-art';

// Use a preset's hash and config
const preset = PRESETS['instagram-square'];
const imageBuffer = generateImageFromHash(preset.hash, preset);
```

Available presets:

- Standard (1024×1024)
- Banner (1920×480)
- Ultrawide (3440×1440)
- Instagram Square (1080×1080)
- Instagram Story (1080×1920)
- Twitter Header (1500×500)
- LinkedIn Banner (1584×396)
- Phone Wallpaper (1170×2532)
- Tablet Wallpaper (2048×2732)
- Minimal, Complex (special configurations)

## CLI Usage

```bash
# Generate from the current commit
npx git-hash-art current

# Generate from a specific hash
npx git-hash-art generate <hash>

# Custom size
npx git-hash-art generate <hash> --width 1920 --height 1080
```

## Integration Examples

### GitHub Actions

```yaml
name: Generate Commit Art
on: [push]
jobs:
  generate-art:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install git-hash-art @napi-rs/canvas
      - run: npx git-hash-art current --output artwork/
```

### Git Hooks

```bash
#!/bin/sh
# .git/hooks/post-commit
hash=$(git rev-parse HEAD)
npx git-hash-art generate $hash --output .git/artwork/
```

### React Component

```jsx
import { useEffect, useRef } from 'react';
import { renderToCanvas } from 'git-hash-art/browser';

function CommitArt({ hash, width = 256, height = 256 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderToCanvas(canvasRef.current, hash, { width, height });
    }
  }, [hash, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
```

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## License

MIT License - see [LICENSE](LICENSE) for details.
