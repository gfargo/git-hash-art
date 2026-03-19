# Product: git-hash-art

A cross-platform library that generates deterministic abstract art from git commit hashes. Given a hex hash string, it produces a unique image using layered geometric shapes, sacred geometry patterns, and harmonious color schemes. Works in both Node.js and browser environments.

Key capabilities:
- Deterministic output: same hash always produces the same image
- Configurable canvas size, grid density, layers, shape sizes, and opacity
- Built-in presets for social media (Instagram, Twitter, LinkedIn), device wallpapers, and print sizes
- CLI for generating art from the current commit or a specific hash
- Cross-platform: Node.js (via `@napi-rs/canvas`) and browsers (native Canvas 2D API)

## Public API

- Node entry (`git-hash-art`): `generateImageFromHash` (returns PNG Buffer), `saveImageToFile`, `renderHashArt`
- Browser entry (`git-hash-art/browser`): `renderToCanvas`, `generateImageBlob`, `generateDataURL`, `renderHashArt`
- Both re-export `PRESETS`, `DEFAULT_CONFIG`, and the `GenerationConfig` type
