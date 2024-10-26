# git-hash-art

Generate beautiful, deterministic abstract art from git commit hashes. Perfect for creating unique visual representations of your project's commits, generating placeholder images, or creating artistic wallpapers.

## Features

- Generate consistent, deterministic abstract art from any git hash
- Configurable canvas sizes and output formats
- Built-in presets for common social media and device sizes
- Harmonious color schemes based on hash values
- Grid-based composition system for balanced layouts
- Multiple shape types and layering effects
- Customizable output settings

## Installation

```bash
npm install git-hash-art
```

## Basic Usage

```javascript
import { generateImageFromHash } from 'git-hash-art';

// Generate art from a git hash with default settings
const gitHash = '46192e59d42f741c761cbea79462a8b3815dd905';
generateImageFromHash(gitHash, 'my-artwork');
```

## Advanced Usage

```javascript
// Custom configuration
const config = {
  width: 1920,
  height: 1080,
  gridSize: 6,
  layers: 7,
  shapesPerLayer: 30,
  minShapeSize: 20,
  maxShapeSize: 180,
  baseOpacity: 0.6,
  opacityReduction: 0.1
};

generateImageFromHash(gitHash, 'custom-artwork', config);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | 1024 | Canvas width in pixels |
| `height` | number | 1024 | Canvas height in pixels |
| `gridSize` | number | 4 | Number of grid cells (gridSize x gridSize) |
| `layers` | number | 5 | Number of layers to generate |
| `shapesPerLayer` | number | - | Base number of shapes per layer (defaults to grid cells * 1.5) |
| `minShapeSize` | number | 20 | Minimum shape size |
| `maxShapeSize` | number | 180 | Maximum shape size |
| `baseOpacity` | number | 0.6 | Starting opacity for first layer |
| `opacityReduction` | number | 0.1 | How much to reduce opacity per layer |

## Preset Sizes

The package includes several preset configurations for common use cases:

```javascript
import { PRESETS } from 'git-hash-art-generator';

// Generate an Instagram-sized image
generateImageFromHash(gitHash, 'instagram', PRESETS['instagram'].config);

// Generate a mobile wallpaper
generateImageFromHash(gitHash, 'phone', PRESETS['phone-wallpaper'].config);
```

Available presets include:
- Standard (1024x1024)
- Banner (1920x480)
- Ultrawide (3440x1440)
- Instagram (1080x1080)
- Instagram Story (1080x1920)
- Twitter Header (1500x500)
- LinkedIn Banner (1584x396)
- Phone Wallpaper (1170x2532)
- Tablet Wallpaper (2048x2732)
- Print sizes (A4/A3 at 300 DPI)

## CLI Usage

The package includes a command-line interface:

```bash
# Generate with default settings
npx git-hash-art current

# Generate from specific hash
npx git-hash-art generate <hash>

# Generate with custom size
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
      - run: npm install git-hash-art-generator
      - run: npx git-hash-art current --output artwork/
```

### Git Hooks

```bash
#!/bin/sh
# .git/hooks/post-commit

hash=$(git rev-parse HEAD)
npx git-hash-art generate $hash --output .git/artwork/
```

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## License

MIT License - see [LICENSE](LICENSE) for details.