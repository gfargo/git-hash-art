# Art Generation Algorithm

This document describes the deterministic art generation pipeline used by `git-hash-art`. Every step derives its randomness from the input hash via a seeded mulberry32 PRNG, guaranteeing identical output for identical input.

## Pipeline Overview

```
Hash String
  │
  ├─► Seed (mulberry32 PRNG)
  │
  ├─► Color Scheme (analogic + complementary + triadic palettes)
  │
  └─► Rendering Pipeline
       │
       1. Background Layer
       2. Composition Mode Selection
       3. Focal Point Generation
       4. Flow Field Initialization
       5. Shape Layers (× N layers)
       │   ├─ Position (composition mode + focal bias)
       │   ├─ Shape Selection (layer-weighted)
       │   ├─ Styling (transparency, glow, gradients, color jitter)
       │   └─ Recursive Nesting (~15% of large shapes)
       6. Flow-Line Pass
       7. Noise Texture Overlay
       8. Organic Connecting Curves
```

## 1. Deterministic RNG

All randomness flows from a single **mulberry32** PRNG seeded by hashing the full input string:

```
seed = hash(gitHash) → mulberry32 state
rng() → float in [0, 1)
```

The old approach extracted 2-char hex pairs from the hash (only ~20 unique values in a 40-char hash). Mulberry32 produces a full 32-bit uniform stream from any seed, eliminating correlation artifacts.

## 2. Color Scheme

The `SacredColorScheme` class derives three harmonious palettes from the hash:

| Palette | Method | Purpose |
|---------|--------|---------|
| Base (analogic) | `color-scheme` lib, hue = seed % 360 | Primary shape colors |
| Complementary (mono) | hue = seed + 180° | Contrast accents |
| Triadic | hue = seed + 120° | Additional variety |

These are merged and deduplicated into a single 6-8 color palette. Background colors are darkened variants (65% and 55% brightness) of the base scheme.

### Color Utilities

- **`hexWithAlpha(hex, alpha)`** — converts hex to `rgba()` for transparency
- **`jitterColor(hex, rng, amount)`** — applies ±amount RGB jitter per channel for organic variation
- **Positional blending** — shape fill color is biased by canvas position, creating smooth color flow across the image

## 3. Background

A radial gradient fills the canvas from center to corners using two darkened base-scheme colors. This creates depth before any shapes are drawn.

## 4. Composition Modes

The hash deterministically selects one of five composition strategies that control how shapes are positioned on the canvas:

| Mode | Description |
|------|-------------|
| **Radial** | Shapes emanate from the center with distance following a power curve (denser near center) |
| **Flow-field** | Random positions; shapes are rotated to align with a hash-derived vector field |
| **Spiral** | Shapes follow a multi-turn spiral path outward from center with slight scatter |
| **Grid-subdivision** | Canvas is divided into cells; shapes are placed randomly within cells |
| **Clustered** | 3-5 cluster centers are generated; shapes scatter around the nearest cluster |

Each mode produces fundamentally different visual character from the same shape set.

## 5. Focal Points

1-2 focal points are placed on the canvas (kept away from edges). Every shape position is pulled toward the nearest focal point by a strength factor (30-70%), creating areas of visual density and intentional-looking composition rather than uniform scatter.

## 6. Shape Layers

The image is built in N layers (default: 4). Each layer has its own characteristics:

### Layer Properties

| Property | Behavior |
|----------|----------|
| Opacity | Decays gently per layer (0.7 → 0.58 → 0.46 → 0.34), minimum 0.15 |
| Size scale | Later layers use progressively smaller shapes (×0.85, ×0.70, ×0.55) |
| Shape weights | Early layers favor basic shapes; later layers favor complex/sacred |
| Per-shape opacity | Additional random jitter (50-100% of layer opacity) |

### Shape Selection (Layer-Weighted)

Shapes are divided into three categories with weights that shift across layers:

| Category | Shapes | Early layers | Late layers |
|----------|--------|-------------|-------------|
| **Basic** | circle, square, triangle, hexagon, diamond, cube | High weight | Low weight |
| **Complex** | star, platonic solid, fibonacci spiral, islamic pattern, celtic knot, merkaba, fractal | Medium | Medium-high |
| **Sacred** | mandala, flower of life, tree of life, Metatron's cube, Sri Yantra, seed of life, vesica piscis, torus, egg of life | Low | High |

### Size Distribution

Shape sizes follow a **power distribution** (`Math.pow(rng(), 1.8)`) — producing many small shapes and few large ones, which creates natural visual hierarchy.

### Styling Per Shape

Each shape receives:

- **Semi-transparent fill** — alpha between 0.2-0.7, creating watercolor-style blending where shapes overlap
- **Color jitter** — ±8% RGB variation on fills, ±5% on strokes, so no two shapes using the "same" palette color are pixel-identical
- **Positional color** — fill color is biased by the shape's canvas position, creating smooth color flow
- **Glow effect** — 45% of sacred shapes and 20% of others get a `shadowBlur` glow (8-28px scaled), with glow color at 60% opacity
- **Gradient fill** — ~30% of shapes get a radial gradient between two jittered palette colors instead of a flat fill
- **Variable stroke width** — 0.5-2.5px scaled to canvas size

### Recursive Nesting

~15% of shapes larger than 40% of max size spawn 1-3 inner shapes:
- Inner shapes are drawn at the parent's position with small random offsets
- They use more complex/sacred shape types (layer ratio biased +0.3)
- Sized at 15-40% of the parent
- More transparent than the parent layer

## 7. Flow-Line Pass

6-16 flowing curves are drawn across the canvas, following the hash-derived vector field:

- Each line starts at a random position and takes 30-70 steps
- At each step, direction is determined by the flow field angle at that position plus slight random wobble
- Lines stop if they leave the canvas bounds
- Drawn at very low opacity (6-16%) with thin strokes for subtle movement

The flow field is defined by:
```
angle(x, y) = baseAngle + sin(x/w × freq × 2π) × π/2 + cos(y/h × freq × 2π) × π/2
```

## 8. Noise Texture Overlay

A dedicated noise RNG (seeded separately from the main RNG to avoid affecting shape generation) renders thousands of 1px dots across the canvas:

- Density: ~1 dot per 800 square pixels
- Each dot is either black or white (50/50)
- Very low opacity (1-4%)
- Creates subtle film-grain texture that adds organic depth

## 9. Organic Connecting Curves

Quadratic bezier curves connect nearby shapes:

- Number of curves scales with canvas area (~8 per megapixel)
- Each curve connects two shapes that were drawn near each other in sequence
- Control points are offset perpendicular to the connecting line with random bulge
- Drawn at low opacity (6-16%) with palette colors at 30% alpha

## Shape Implementations

### Basic Shapes
Standard geometric primitives drawn as canvas paths (beginPath → moveTo/lineTo/arc → closePath). The draw pipeline calls `fill()` and `stroke()` after the path is defined.

### Complex Shapes
More intricate geometry including:
- **Platonic solids** — 2D projections with all edges drawn between vertices
- **Fibonacci spiral** — iterative arc segments following the golden ratio
- **Islamic pattern** — 8-pointed star grid at intersections
- **Celtic knot** — bezier over/under weaving pattern
- **Mandala** — concentric circles with radial lines
- **Fractal tree** — recursive branching at ±30° with 0.7× length decay

### Sacred Geometry
Mathematically precise sacred geometry patterns:
- **Flower of Life** — 7 overlapping circles in hexagonal arrangement
- **Tree of Life** — 10 Sephirot nodes with connecting paths
- **Metatron's Cube** — 13 vertices (center + inner/outer hexagons) fully connected
- **Sri Yantra** — 9 interlocking triangles at two radii
- **Seed of Life** — 7 circles (same as Flower of Life, different scale)
- **Vesica Piscis** — two overlapping circles
- **Torus** — 2D projection of a torus via line segments
- **Egg of Life** — 7 circles in tight hexagonal packing

## Configuration

All parameters are exposed via `GenerationConfig`:

| Parameter | Default | Effect |
|-----------|---------|--------|
| `width` | 2048 | Canvas width in pixels |
| `height` | 2048 | Canvas height in pixels |
| `gridSize` | 5 | Base shape count = gridSize² × 1.5 |
| `layers` | 4 | Number of rendering layers |
| `minShapeSize` | 30 | Minimum shape size (scaled to canvas) |
| `maxShapeSize` | 400 | Maximum shape size (scaled to canvas) |
| `baseOpacity` | 0.7 | First layer opacity |
| `opacityReduction` | 0.12 | Opacity decay per layer |
| `shapesPerLayer` | auto | Override auto-calculated shape count |
