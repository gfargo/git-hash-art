# Art Generation Algorithm

This document describes the deterministic art generation pipeline used by `git-hash-art`. Every step derives its randomness from the input hash via a seeded mulberry32 PRNG, guaranteeing identical output for identical input.

## Pipeline Overview

```
Hash String
  │
  ├─► Seed (mulberry32 PRNG)
  │
  ├─► Archetype Selection (1 of 10 visual personalities)
  │
  ├─► Color Scheme (palette mode from archetype + temperature mode + contrast enforcement)
  │
  └─► Rendering Pipeline (parameters overridden by archetype)
       │
       0.  Archetype Override (gridSize, layers, opacity, sizes, styles)
       1.  Background Layer (7 styles: radial, linear, solid, multi-stop)
       1a. Background Luminance → contrast enforcement threshold
       1b. Layered Background (faint shapes + concentric rings)
       2.  Composition Mode Selection
       2b. Symmetry Mode Selection (none / bilateral / quad)
       3.  Focal Points (rule-of-thirds biased) + Void Zones
       4.  Flow Field Initialization
       4b. Hero Shape (large focal anchor, archetype-controlled)
       5.  Shape Layers (× N layers, archetype-tuned)
       │   ├─ Blend Mode (per-layer compositing)
       │   ├─ Render Style (archetype-preferred + random mix)
       │   ├─ Position (composition mode + focal bias + density check)
       │   ├─ Shape Selection (4 categories: basic, complex, sacred, procedural)
       │   ├─ Contrast Enforcement (ensure readability vs background)
       │   ├─ Atmospheric Depth (desaturation on later layers)
       │   ├─ Temperature Contrast (foreground opposite to background)
       │   ├─ Styling (transparency, glow, gradients, color jitter)
       │   ├─ Organic Edges (~15% watercolor bleed)
       │   └─ Recursive Nesting (~15% of large shapes)
       6.  Flow-Line Pass (tapered brush strokes, archetype-scaled)
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

## 2. Archetype System

Before any rendering begins, the hash deterministically selects one of 10 **visual archetypes** — fundamentally different rendering personalities that override key parameters. This is the primary mechanism for visual diversity: two hashes that select different archetypes will look like they came from entirely different generators.

Each archetype controls:

| Parameter | Effect |
|-----------|--------|
| `gridSize` | Shape density (2 = sparse, 9 = packed) |
| `layers` | Rendering depth (2 = flat, 5 = deep) |
| `baseOpacity` / `opacityReduction` | Transparency character |
| `minShapeSize` / `maxShapeSize` | Scale range |
| `backgroundStyle` | One of 7 background rendering modes |
| `paletteMode` | One of 7 color palette strategies |
| `preferredStyles` | Weighted render style selection |
| `flowLineMultiplier` | Flow line density (0 = none, 4 = heavy) |
| `heroShape` | Whether to draw a dominant focal shape |
| `glowMultiplier` | Glow probability scaling (0 = none, 3 = heavy) |
| `sizePower` | Size distribution curve (0.5 = uniform, 2.5 = many tiny) |

### The 10 Archetypes

| Archetype | Character | Background | Palette | Key Traits |
|-----------|-----------|------------|---------|------------|
| **dense-chaotic** | Packed, energetic | radial-dark | harmonious | 9×9 grid, 5 layers, heavy flow lines, low glow |
| **minimal-spacious** | Clean, deliberate | solid-light | duotone | 2×2 grid, 2 layers, large shapes, no glow |
| **organic-flow** | Natural, flowing | radial-dark | earth | Heavy flow lines (4×), watercolor style, no hero |
| **geometric-precision** | Technical, structured | solid-dark | high-contrast | Stroke-only/dashed/hatched styles, no flow lines |
| **ethereal** | Dreamy, luminous | radial-light | pastel-light | High glow (2×), watercolor, hero shape |
| **bold-graphic** | Poster-like, impactful | linear-diagonal | duotone | 2 layers, very large shapes, no flow lines |
| **neon-glow** | Electric, vibrant | solid-dark | neon | Heavy glow (3×), stroke-heavy styles, hero shape |
| **monochrome-ink** | Pen-and-ink, textural | solid-light | monochrome | Hatched/incomplete styles, no glow |
| **cosmic** | Deep space, vast | radial-dark | neon | 8×8 grid, 5 layers, heavy glow, many tiny shapes |
| **classic** | Balanced, familiar | radial-dark | harmonious | Preserves the original rendering look |

Archetype values serve as defaults — explicit user config always wins. The `classic` archetype preserves backward compatibility with the original rendering style.

## 3. Color Scheme

The `SacredColorScheme` class derives three harmonious palettes from the hash:

| Palette | Method | Purpose |
|---------|--------|---------|
| Base | `color-scheme` lib, hue = seed % 360, hash-driven scheme type | Primary shape colors |
| Complementary | hue = seed + 180°, contrasting variation | Contrast accents |
| Triadic | hue = seed + 120° | Additional variety |

These are merged and deduplicated into a single 6-8 color palette. Background colors are darkened variants (65% and 55% brightness) of the base scheme, with optional temperature shifting.

### Palette Modes

The archetype's `paletteMode` reshapes the color palette to match the visual personality:

| Mode | Colors | Character |
|------|--------|-----------|
| **harmonious** | Full base + complementary + triadic | Rich, balanced (default) |
| **monochrome** | Single hue, 5 lightness steps | Elegant, focused |
| **duotone** | Two contrasting hues + tints | Bold, graphic |
| **neon** | 4 hues at full saturation | Electric, vivid |
| **pastel-light** | 4 hues at low saturation, high lightness | Soft, dreamy |
| **earth** | Warm muted naturals (browns, olives, sage) | Organic, grounded |
| **high-contrast** | Black + white + one accent | Technical, stark |

Each mode also provides matching background colors (e.g., neon gets near-black backgrounds, pastel-light gets warm off-whites).

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

## 4. Background

The archetype's `backgroundStyle` selects one of 7 rendering modes:

| Style | Description |
|-------|-------------|
| **radial-dark** | Radial gradient from dark center to darker edges (original default) |
| **radial-light** | Light off-white center fading to the base palette |
| **linear-horizontal** | Left-to-right gradient between two palette colors |
| **linear-diagonal** | Corner-to-corner gradient with color reversal |
| **solid-dark** | Flat dark color fill |
| **solid-light** | Flat warm off-white fill |
| **multi-stop** | 3-4 color gradient with a darkened mid-palette accent |

This single change has an outsized impact on visual diversity — a solid-light background with monochrome shapes looks nothing like a radial-dark background with neon glow.

### Layered Background

After the gradient, a second pass adds visual texture to the background:

- **Faint shapes** — 3-7 large, very low-opacity circles (3-8% alpha) drawn with `soft-light` blending, creating subtle color pools
- **Concentric rings** — 2-4 rings emanating from center at ~2-5% opacity, adding structure without competing with foreground shapes

This prevents the background from feeling flat and gives the image depth before the main shape layers begin.

## 5. Composition Modes

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

## 6. Focal Points & Negative Space

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

## 7. Shape Layers

The image is built in N layers (default: 4). Each layer has its own characteristics:

### Layer Properties

| Property | Behavior |
|----------|----------|
| Opacity | Decays gently per layer (0.7 → 0.58 → 0.46 → 0.34), minimum 0.15 |
| Size scale | Later layers use progressively smaller shapes (×0.85, ×0.70, ×0.55) |
| Shape weights | Early layers favor basic shapes; later layers favor complex/sacred |
| Per-shape opacity | Additional random jitter (50-100% of layer opacity) |
| Blend mode | Each layer gets a hash-derived `globalCompositeOperation` (see below) |
| Render style | Each layer has a dominant render style (60% from archetype preferences, 40% random); 30% of shapes pick their own |
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

Shapes are divided into four categories with weights that shift across layers:

| Category | Shapes | Early layers | Late layers |
|----------|--------|-------------|-------------|
| **Basic** | circle, square, triangle, hexagon, diamond, cube | High weight | Low weight |
| **Complex** | star, platonic solid, fibonacci spiral, islamic pattern, celtic knot, merkaba, fractal | Medium | Medium-high |
| **Sacred** | mandala, flower of life, tree of life, Metatron's cube, Sri Yantra, seed of life, vesica piscis, torus, egg of life | Low | High |
| **Procedural** | blob, ngon, lissajous, superellipse, spirograph, waveRing, rose | Medium (always present) | Medium-high |

Procedural shapes are hash-derived — their geometry is generated from the RNG, so every hash produces unique shapes that don't exist in any other generation. See the Procedural Shapes section below for details.

### Contrast Enforcement

After color selection, every foreground color (fills, strokes, flow lines, connecting curves) is checked against the average background luminance. If the luminance difference is below the minimum threshold (0.15), the color is adjusted:

- **Light backgrounds** — foreground colors are darkened and saturated
- **Dark backgrounds** — foreground colors are lightened and saturated

This prevents the white-on-white and dark-on-dark readability problems that occur when light palette modes (pastel-light, high-contrast) combine with light background styles (solid-light, radial-light).

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

## 8. Flow-Line Pass (Tapered Brush Strokes)

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

## 9. Noise Texture Overlay

A dedicated noise RNG (seeded separately from the main RNG to avoid affecting shape generation) renders thousands of 1px dots across the canvas:

- Density: ~1 dot per 800 square pixels
- Each dot is either black or white (50/50)
- Very low opacity (1-4%)
- Creates subtle film-grain texture that adds organic depth

## 9b. Vignette

A radial gradient overlay darkens the edges of the canvas, drawing the viewer's eye toward the center:

- Strength varies by hash: 25-45% maximum edge darkening
- The vignette begins fading at 60% of the canvas radius from center
- Applied after noise but before connecting curves, so the curves remain visible at edges
- Creates a natural "spotlight" effect that makes compositions feel more focused and photographic

## 10. Organic Connecting Curves

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

### Procedural Shapes
Hash-derived shapes whose geometry is generated from the RNG. Every hash produces unique shapes that don't exist in any other generation:

| Shape | Algorithm | Hash Controls |
|-------|-----------|---------------|
| **Blob** | Smooth closed curve via quadratic bezier through 5-9 control points arranged around a circle | Number of lobes (5-9), radius jitter per lobe (50-100%) |
| **Ngon** | Irregular polygon with independent vertex displacement | Side count (3-12), vertex jitter amount (10-50%) |
| **Lissajous** | Parametric curve `x = sin(a*t + φ), y = sin(b*t)` | Frequency ratios a,b (1-5 each), phase offset φ |
| **Superellipse** | `|x|^n + |y|^n = 1` rendered parametrically | Exponent n: 0.3 (spiky astroid) → 2 (circle) → 5 (rounded rectangle) |
| **Spirograph** | Hypotrochoid curve `(R-r)cos(t) + d*cos((R-r)t/r)` | Inner radius ratio r (0.2-0.8), pen distance d (0.3-1.0) |
| **Wave Ring** | Concentric rings with sinusoidal radial displacement | Ring count (2-5), wave frequency (3-14), amplitude (5-20%) |
| **Rose** | Polar rose curve `r = cos(k*θ)` | Petal parameter k (2-7), producing k or 2k petals |

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
