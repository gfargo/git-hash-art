# Art Generation Algorithm

This document describes the deterministic art generation pipeline used by `git-hash-art`. Every step derives its randomness from the input hash via a seeded mulberry32 PRNG, guaranteeing identical output for identical input.

## Pipeline Overview

```
Hash String
  │
  ├─► Seed (mulberry32 PRNG)
  │
  ├─► Color Scheme (hash-driven variation + scheme type + temperature mode)
  │
  └─► Rendering Pipeline
       │
       1.  Background Layer (radial gradient, temperature-shifted)
       1b. Layered Background (faint shapes + concentric rings)
       2.  Composition Mode Selection
       2b. Symmetry Mode Selection (none / bilateral / quad)
       3.  Focal Points (rule-of-thirds biased) + Void Zones
       4.  Flow Field Initialization
       4b. Hero Shape (large focal anchor, ~60% of images)
       5.  Shape Layers (× N layers)
       │   ├─ Blend Mode (per-layer compositing)
       │   ├─ Render Style (fill+stroke, wireframe, dashed, watercolor, hatched, incomplete, etc.)
       │   ├─ Position (composition mode + focal bias + density check)
       │   ├─ Shape Selection (layer-weighted)
       │   ├─ Atmospheric Depth (desaturation on later layers)
       │   ├─ Temperature Contrast (foreground opposite to background)
       │   ├─ Styling (transparency, glow, gradients, color jitter)
       │   ├─ Organic Edges (~15% watercolor bleed)
       │   └─ Recursive Nesting (~15% of large shapes)
       6.  Flow-Line Pass (tapered brush strokes)
       6b. Symmetry Mirroring (bilateral-x, bilateral-y, or quad)
       7.  Noise Texture Overlay
       8.  Vignette (radial edge darkening)
       9.  Organic Connecting Curves
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
| Base | `color-scheme` lib, hue = seed % 360, hash-driven scheme type | Primary shape colors |
| Complementary | hue = seed + 180°, contrasting variation | Contrast accents |
| Triadic | hue = seed + 120° | Additional variety |

These are merged and deduplicated into a single 6-8 color palette. Background colors are darkened variants (65% and 55% brightness) of the base scheme, with optional temperature shifting.

### Temperature Contrast

The hash deterministically selects a **temperature mode** that creates warm/cool tension across the image:

| Mode | Probability | Background | Foreground |
|------|-------------|------------|------------|
| `warm-bg` | ~40% | Hues shifted toward orange (30°) | Hues shifted toward blue (210°) |
| `cool-bg` | ~40% | Hues shifted toward blue (210°) | Hues shifted toward orange (30°) |
| `neutral` | ~20% | No temperature shift | No temperature shift |

The shift amount is subtle (15-25%) and increases on later layers, creating progressive temperature separation between foreground and background elements. This produces the kind of warm/cool interplay seen in classical painting.

### Hash-Driven Color Variation

The hash deterministically selects both a **scheme type** and a **color variation**, producing dramatically different palettes from the same hue:

| Variation | Character |
|-----------|-----------|
| `soft` | Muted, gentle tones |
| `hard` | High saturation, vivid |
| `pastel` | Light, airy |
| `light` | Bright, open |
| `pale` | Washed out, ethereal |
| `default` | Balanced, neutral |

Scheme types also vary: `analogic`, `mono`, `contrast`, `triade`, `tetrade`. The complementary palette uses a contrasting variation (e.g., if base is `soft`, complementary uses `hard`) to create intentional color tension.

### Color Utilities

- **`hexWithAlpha(hex, alpha)`** — converts hex to `rgba()` for transparency
- **`jitterColor(hex, rng, amount)`** — applies ±amount RGB jitter per channel for organic variation
- **`desaturate(hex, amount)`** — blends toward luminance gray for atmospheric depth
- **`shiftTemperature(hex, target, amount)`** — shifts hue toward warm (orange) or cool (blue)
- **Positional blending** — shape fill color is biased by canvas position, creating smooth color flow across the image

## 3. Background

A radial gradient fills the canvas from center to corners using two darkened base-scheme colors. This creates depth before any shapes are drawn.

### Layered Background

After the gradient, a second pass adds visual texture to the background:

- **Faint shapes** — 3-7 large, very low-opacity circles (3-8% alpha) drawn with `soft-light` blending, creating subtle color pools
- **Concentric rings** — 2-4 rings emanating from center at ~2-5% opacity, adding structure without competing with foreground shapes

This prevents the background from feeling flat and gives the image depth before the main shape layers begin.

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

### Symmetry Modes

~25% of hashes trigger a symmetry mode that mirrors the rendered content:

| Mode | Probability | Effect |
|------|-------------|--------|
| `bilateral-x` | 10% | Left half mirrored onto right half |
| `bilateral-y` | 10% | Top half mirrored onto bottom half |
| `quad` | 5% | Both axes mirrored (4-fold symmetry) |
| `none` | 75% | No mirroring |

Symmetry is applied after shape layers and flow lines but before post-processing (noise, vignette, connecting curves). This means the mirrored content gets the same noise texture and vignette as the original, maintaining visual consistency. Symmetrical generative art is disproportionately appealing to humans due to our innate preference for bilateral symmetry.

## 5. Focal Points & Negative Space

1-2 focal points are placed on the canvas. **70% of the time**, focal points snap to **rule-of-thirds intersection points** (with slight jitter to avoid a mechanical look), creating compositions that feel intentionally designed. The remaining 30% use free placement within the central 60% of the canvas. Every shape position is pulled toward the nearest focal point by a strength factor (30-70%).

### Hero Shape

~60% of images receive a **hero shape** — a large sacred or complex geometry piece anchored at the primary focal point. The hero shape:
- Uses sacred/complex shape types (flower of life, fibonacci spiral, merkaba, fractal, etc.)
- Is sized at 80-130% of the maximum shape size for visual dominance
- Gets glow effects, gradient fills, and often watercolor rendering
- Is drawn before the main shape layers so other shapes layer on top of it
- Creates a clear center of gravity that anchors the entire composition

### Void Zones (Negative Space)

1-2 void zones are generated at random positions. Shapes that land inside a void zone have an 85% chance of being skipped, creating deliberate areas of breathing room. A few shapes bleed through (15%) to keep the edges organic rather than hard-cut.

### Density Awareness

Before placing each shape, the renderer checks how many shapes already exist nearby. If local density exceeds ~15% of the per-layer shape count, there's a 60% chance the shape is skipped. This prevents areas from becoming an opaque blob and creates natural visual rhythm.

## 6. Shape Layers

The image is built in N layers (default: 4). Each layer has its own characteristics:

### Layer Properties

| Property | Behavior |
|----------|----------|
| Opacity | Decays gently per layer (0.7 → 0.58 → 0.46 → 0.34), minimum 0.15 |
| Size scale | Later layers use progressively smaller shapes (×0.85, ×0.70, ×0.55) |
| Shape weights | Early layers favor basic shapes; later layers favor complex/sacred |
| Per-shape opacity | Additional random jitter (50-100% of layer opacity) |
| Blend mode | Each layer gets a hash-derived `globalCompositeOperation` (see below) |
| Render style | Each layer has a dominant render style; 30% of shapes pick their own |
| Atmospheric depth | Later layers desaturate colors by up to 30%, simulating distance |

### Blend Modes (Per-Layer Compositing)

Each layer deterministically selects a `globalCompositeOperation` from: `source-over`, `screen`, `multiply`, `overlay`, `soft-light`, `color-dodge`, `color-burn`, `lighter`. There's a 40% chance of `source-over` (default) to keep some images clean, while the other modes create rich color interactions where shapes overlap — the kind of depth that makes output feel painterly rather than stacked.

### Render Styles (Per-Shape Treatment)

Instead of always `fill()` + `stroke()`, each shape gets a rendering treatment:

| Style | Description | Probability |
|-------|-------------|-------------|
| `fill-and-stroke` | Classic solid fill with outline | ~22% (weighted) |
| `fill-only` | Soft shapes with no outline | ~11% |
| `stroke-only` | Wireframe with ghost fill at 30% alpha | ~11% |
| `double-stroke` | Outer stroke at 2× width + inner stroke in fill color | ~11% |
| `dashed` | Dashed outline (5% size dash, 3% gap) | ~11% |
| `watercolor` | 3-4 slightly offset passes at low opacity for bleed effect | ~11% |
| `hatched` | Cross-hatch texture fill clipped to shape boundary | ~11% |
| `incomplete` | Only 60-85% of outline drawn via dash patterns | ~11% |

70% of shapes in a layer use the layer's dominant style; 30% pick independently. Additionally, ~15% of `fill-and-stroke` shapes are upgraded to `watercolor` for organic edge effects.

### Atmospheric Depth (Per-Layer Desaturation)

Later layers progressively desaturate their colors (0% on layer 0, up to 30% on the final layer). This simulates atmospheric perspective — distant shapes appear more muted, creating a sense of foreground/background depth.

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

## 7. Flow-Line Pass (Tapered Brush Strokes)

6-16 flowing curves are drawn across the canvas, following the hash-derived vector field:

- Each line starts at a random position and takes 30-70 steps
- At each step, direction is determined by the flow field angle at that position plus slight random wobble
- Lines stop if they leave the canvas bounds
- **Tapered width** — each line starts at 1-4px and tapers to 20% of its starting width by the end, simulating a brush stroke that lifts off the canvas
- **Tapered opacity** — alpha also decays along the stroke, creating natural fade-out
- Individual segments are drawn with `lineCap: "round"` for smooth joins

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

## 8b. Vignette

A radial gradient overlay darkens the edges of the canvas, drawing the viewer's eye toward the center:

- Strength varies by hash: 25-45% maximum edge darkening
- The vignette begins fading at 60% of the canvas radius from center
- Applied after noise but before connecting curves, so the curves remain visible at edges
- Creates a natural "spotlight" effect that makes compositions feel more focused and photographic

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
