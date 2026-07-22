<div align="center">

# git-hash-art

**Deterministic generative art from git commit hashes.**

Every commit becomes a one-of-a-kind abstract composition — same hash, same image, forever.

[![npm version](https://img.shields.io/npm/v/git-hash-art?color=c4634f&label=npm)](https://www.npmjs.com/package/git-hash-art)
[![npm downloads](https://img.shields.io/npm/dm/git-hash-art?color=8a9a5b)](https://www.npmjs.com/package/git-hash-art)
[![license](https://img.shields.io/badge/license-MIT-4a7a8c)](LICENSE)
[![types](https://img.shields.io/badge/types-included-5a6a9a)](https://www.npmjs.com/package/git-hash-art)
[![gallery](https://img.shields.io/badge/gallery-git--hash--art.griffen.codes-6a5a8a)](https://git-hash-art.griffen.codes)

<br />

*Generated from the latest commit hashes of well-known open-source repos:*

| [<img src="https://git-hash-art.griffen.codes/oss-art/facebook--react.png" width="180" alt="react" />](https://git-hash-art.griffen.codes)<br />`react` | [<img src="https://git-hash-art.griffen.codes/oss-art/sveltejs--svelte.png" width="180" alt="svelte" />](https://git-hash-art.griffen.codes)<br />`svelte` | [<img src="https://git-hash-art.griffen.codes/oss-art/denoland--deno.png" width="180" alt="deno" />](https://git-hash-art.griffen.codes)<br />`deno` | [<img src="https://git-hash-art.griffen.codes/oss-art/colinhacks--zod.png" width="180" alt="zod" />](https://git-hash-art.griffen.codes)<br />`zod` |
| :---: | :---: | :---: | :---: |
| [<img src="https://git-hash-art.griffen.codes/oss-art/tailwindlabs--tailwindcss.png" width="180" alt="tailwindcss" />](https://git-hash-art.griffen.codes)<br />`tailwindcss` | [<img src="https://git-hash-art.griffen.codes/oss-art/oven-sh--bun.png" width="180" alt="bun" />](https://git-hash-art.griffen.codes)<br />`bun` | [<img src="https://git-hash-art.griffen.codes/oss-art/mrdoob--three.js.png" width="180" alt="three.js" />](https://git-hash-art.griffen.codes)<br />`three.js` | [<img src="https://git-hash-art.griffen.codes/oss-art/bigskysoftware--htmx.png" width="180" alt="htmx" />](https://git-hash-art.griffen.codes)<br />`htmx` |

**[Browse the full gallery →](https://git-hash-art.griffen.codes)**

</div>

---

## How it works

A commit hash seeds a deterministic PRNG that drives every decision in a multi-stage rendering pipeline:

- **17 visual archetypes** — fundamentally different personalities (`minimal-spacious`, `neon-glow`, `watercolor-wash`, `shattered-glass`, `celestial`, …), with ~15% of hashes blending two
- **44 shapes across 5 categories** — basic, complex, sacred geometry, procedural, and *noise-field organics* whose silhouettes are contoured from hash-seeded simplex noise, so no two renders ever repeat a form
- **17 render styles** — watercolor bleeds, ink-bleed with fiber wicking and satellite droplets, gravity-correct paint drips, stipple, cross-hatch, hand-drawn wobble, and more
- **Generative mark-making** — branching growth structures (coral roots or crack networks), sweeping hero flow ribbons, and rare hard-mirror Rorschach symmetry
- **Composition & color discipline** — rule-of-thirds anchors with edge bleed, dominant/secondary/accent color hierarchies, background-aware blend modes, value hierarchy by scale
- **Physical finishing** — torn-paper deckle frames, translucent vellum sheets, film grain, palette-tinted vignettes, and a per-hash signature chop mark

The full pipeline is documented in [ALGORITHM.md](ALGORITHM.md).

Works in **Node.js** (via `@napi-rs/canvas`) and **browsers** (native Canvas API), with zero config and full determinism — the same hash produces byte-identical output every time.

## Installation

```bash
npm install git-hash-art
```

For Node.js usage you also need the canvas backend:

```bash
npm install @napi-rs/canvas
```

Browser usage requires no additional dependencies.

## Quick start

### Node.js

```javascript
import { generateImageFromHash, saveImageToFile } from 'git-hash-art';

const gitHash = '46192e59d42f741c761cbea79462a8b3815dd905';
const imageBuffer = generateImageFromHash(gitHash);

saveImageToFile(imageBuffer, './output', gitHash, 'my-art', 2048, 2048);
```

### Browser

```javascript
import { renderToCanvas, generateDataURL, generateImageBlob } from 'git-hash-art/browser';

// Render onto an existing canvas element
const canvas = document.getElementById('art-canvas');
canvas.width = 1024;
canvas.height = 1024;
renderToCanvas(canvas, '46192e59d42f741c761cbea79462a8b3815dd905');

// Or get a data URL for <img> tags
const dataUrl = generateDataURL(hash, { width: 512, height: 512 });

// Or a Blob for downloads/uploads
const blob = await generateImageBlob(hash, { width: 1080, height: 1080 });
```

### CLI

```bash
# Generate from the current commit
npx git-hash-art current

# Generate from a specific hash
npx git-hash-art generate <hash>

# Custom size, output directory, or preset
npx git-hash-art generate <hash> --width 1920 --height 1080 --output ./artwork
npx git-hash-art generate <hash> --preset instagram-square
```

## Core renderer (environment-agnostic)

Both entry points re-export `renderHashArt`, which accepts any standard `CanvasRenderingContext2D` — useful for `OffscreenCanvas` in Web Workers, custom canvas setups, or server-side rendering frameworks.

```javascript
import { renderHashArt } from 'git-hash-art'; // or 'git-hash-art/browser'

const ctx = myCanvas.getContext('2d');
renderHashArt(ctx, '46192e59d42f741c761cbea79462a8b3815dd905', {
  width: myCanvas.width,
  height: myCanvas.height,
});
```

## Configuration

Every option is optional — the archetype system picks tuned values per hash, and explicit config always wins over archetype defaults.

| Option             | Type   | Default | Description                                           |
| ------------------ | ------ | ------- | ----------------------------------------------------- |
| `width`            | number | 2048    | Canvas width in pixels                                |
| `height`           | number | 2048    | Canvas height in pixels                               |
| `gridSize`         | number | auto    | Controls base shape count per layer (gridSize² × 1.5) |
| `layers`           | number | auto    | Number of rendering layers                            |
| `shapesPerLayer`   | number | auto    | Base shapes per layer (defaults to gridSize² × 1.5)   |
| `minShapeSize`     | number | auto    | Minimum shape size in pixels (scaled to canvas)       |
| `maxShapeSize`     | number | auto    | Maximum shape size in pixels (scaled to canvas)       |
| `baseOpacity`      | number | auto    | Starting opacity for the first layer                  |
| `opacityReduction` | number | auto    | Opacity reduction per layer                           |
| `customShapes`     | object | —       | Your own shapes, merged into the generation (below)   |

## Custom shapes

Register your own geometry and it participates in everything — palette selection, affinity matching, render styles, nesting, echoes:

```javascript
import { generateImageFromHash } from 'git-hash-art';

const imageBuffer = generateImageFromHash(hash, {
  customShapes: {
    lightning: {
      // Build a path centered on the origin — the pipeline handles
      // translate/rotate/fill/stroke. Use the provided rng (seeded
      // from the hash) instead of Math.random() to stay deterministic.
      draw: (ctx, size, rng) => {
        const s = size / 2;
        ctx.moveTo(-s * 0.2, -s);
        ctx.lineTo(s * (0.1 + rng() * 0.2), -s * 0.1);
        ctx.lineTo(-s * 0.1, -s * 0.1);
        ctx.lineTo(s * 0.2, s);
        ctx.lineTo(-s * (0.1 + rng() * 0.2), s * 0.1);
        ctx.lineTo(s * 0.1, s * 0.1);
        ctx.closePath();
      },
      profile: {
        tier: 1,
        heroCandidate: true,
        affinities: ['star', 'triangle'],
        bestStyles: ['fill-and-stroke', 'double-stroke'],
      },
    },
  },
});
```

## Preset sizes

```javascript
import { PRESETS, generateImageFromHash } from 'git-hash-art';

const preset = PRESETS['instagram-square'];
const imageBuffer = generateImageFromHash(preset.hash, preset);
```

Standard (1024²) · Banner (1920×480) · Ultrawide (3440×1440) · Instagram Square & Story · Twitter Header · LinkedIn Banner · Phone & Tablet Wallpaper · Minimal & Complex configurations

## Integration recipes

### GitHub Actions

```yaml
name: Generate Commit Art
on: [push]
jobs:
  generate-art:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install git-hash-art @napi-rs/canvas
      - run: npx git-hash-art current --output artwork/
```

### Git hook

```bash
#!/bin/sh
# .git/hooks/post-commit
hash=$(git rev-parse HEAD)
npx git-hash-art generate $hash --output .git/artwork/
```

### React component

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

## Use cases

- **Commit / release art** — a visual identity for every version you ship
- **Deterministic avatars & placeholders** — hash any string (user IDs, file digests) for stable, unique imagery
- **Repo identicons** — like the [gallery](https://git-hash-art.griffen.codes), give every project a face
- **Wallpapers & social banners** — built-in presets for every common size

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The rendering pipeline is documented in depth in [ALGORITHM.md](ALGORITHM.md) if you want to understand (or extend) how images are made.

## License

[MIT](LICENSE) © [Griffen Fargo](https://github.com/gfargo)
