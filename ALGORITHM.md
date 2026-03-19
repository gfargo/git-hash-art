# Art Generation Algorithm

This document describes the deterministic art generation pipeline used by `git-hash-art`. Every step derives its randomness from the input hash via a seeded mulberry32 PRNG, guaranteeing identical output for identical input.

## Pipeline Overview

```text
Hash String
  │
  ├─► Seed (mulberry32 PRNG)
  │
  ├─► Archetype Selection (1 of 17 visual personalities)
  │
  ├─► Color Scheme (palette mode + temperature mode + contrast enforcement)
  │   └─► Color Hierarchy (dominant 60% / secondary 25% / accent 15%)
  │
  ├─► Shape Palette (affinity-curated primary / supporting / accent shapes)
  │
  ├─► Color Grade Selection (unified tone for post-processing)
  │
  └─► Rendering Pipeline (parameters overridden by archetype)
       │
       0.  Archetype Override (gridSize, layers, opacity, sizes, styles)
       0b. Color Hierarchy (dominant/secondary/accent weighting)
       0c. Shape Palette (curated via affinity graph)
       0d. Color Grade (hue + intensity for final tone)
       0e. Light Direction (consistent shadow angle)
       1.  Background Layer (7 styles: radial, linear, solid, multi-stop)
           └─ Gradient Mesh Overlay (3-4 radial color control points)
       1a. Background Luminance → contrast enforcement threshold
       1b. Layered Background (archetype-coherent shapes + concentric rings)
       1c. Background Pattern Layer (dot grid / diagonal lines / tessellation)
       2.  Composition Mode Selection
       2b. Symmetry Mode Selection (none / bilateral / quad)
       3.  Focal Points (rule-of-thirds biased) + Void Zones
       4.  Flow Field Initialization
       4b. Hero Shape (palette-aware, affinity-styled)
       5.  Shape Layers (× N layers, archetype-tuned)
       │   ├─ Blend Mode (per-layer compositing)
       │   ├─ Render Style (affinity-aware per shape)
       │   ├─ Depth-of-Field (stroke thinning + contrast reduction on far layers)
       │   ├─ Position (composition mode + focal bias + density check)
       │   ├─ Shape Selection (palette-driven with size constraints)
       │   ├─ Hero Avoidance Field (nearby shapes orient toward hero)
       │   ├─ Contrast Enforcement (ensure readability vs background)
       │   ├─ Atmospheric Depth (desaturation on later layers)
       │   ├─ Temperature Contrast (foreground opposite to background)
       │   ├─ Styling (transparency, glow, gradients, HSL jitter)
       │   ├─ Organic Edges (~15% watercolor bleed)
       │   ├─ 5a. Tangent Placement (~25% nudge toward nearest shape edge)
       │   ├─ 5b. Shape Mirroring (~40% of basic shapes get reflected copies)
       │   ├─ 5c. Size Echo (~20% of large shapes spawn trailing copies)
       │   ├─ 5d. Recursive Nesting (~15% of large shapes, palette-aware)
       │   └─ 5e. Shape Constellations (~12% of large shapes, pre-composed groups)
       6.  Flow-Line Pass (variable color, pressure, branching)
       6b. Symmetry Mirroring (bilateral-x, bilateral-y, or quad)
       7.  Noise Texture Overlay
       8.  Vignette (radial edge darkening)
       9.  Organic Connecting Curves
       10. Post-Processing
           ├─ Color Grading (unified tone overlay)
           ├─ Chromatic Aberration (neon/cosmic/ethereal only)
           └─ Bloom (neon/cosmic only)
```

## 1. Deterministic RNG

All randomness flows from a single **mulberry32** PRNG seeded by hashing the full input string:

```text
seed = hash(gitHash) → mulberry32 state
rng() → float in [0, 1)
```

The old approach extracted 2-char hex pairs from the hash (only ~20 unique values in a 40-char hash). Mulberry32 produces a full 32-bit uniform stream from any seed, eliminating correlation artifacts.

## 2. Archetype System

Before any rendering begins, the hash deterministically selects one of 17 **visual archetypes** — fundamentally different rendering personalities that override key parameters. This is the primary mechanism for visual diversity: two hashes that select different archetypes will look like they came from entirely different generators.

Each archetype controls:

| Parameter | Effect |
| --------- | ------ |
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
| `sizePower` | Size distribution curve (0.5 = uniform, 2.8 = many tiny) |

### The 17 Archetypes

| Archetype | Grid | Layers | Background | Palette | Key Styles | Flow | Hero | Character |
| --------- | ---- | ------ | ---------- | ------- | ---------- | ---- | ---- | --------- |
| dense-chaotic | 9 | 5 | radial-dark | harmonious | fill-and-stroke, watercolor | 2.5× | no | Packed, layered, energetic |
| minimal-spacious | 2 | 2 | solid-light | duotone | fill-and-stroke, stroke-only, incomplete | 0.3× | yes | Clean, airy, few large shapes |
| organic-flow | 4 | 3 | radial-dark | earth | watercolor, fill-only, incomplete | 4× | no | Natural, flowing, muted tones |
| geometric-precision | 6 | 3 | solid-dark | high-contrast | stroke-only, dashed, double-stroke, hatched | 0× | no | Sharp, structured, no flow lines |
| ethereal | 7 | 5 | radial-light | pastel-light | watercolor, incomplete | 1.5× | yes | Soft, glowing, dreamlike |
| bold-graphic | 2 | 2 | linear-diagonal | duotone | fill-and-stroke, double-stroke | 0× | yes | Poster-like, large shapes |
| neon-glow | 5 | 4 | solid-dark | neon | stroke-only, double-stroke, dashed | 2× | yes | Bright outlines on black, heavy glow |
| monochrome-ink | 6 | 3 | solid-light | monochrome | hatched, incomplete, stroke-only | 1.5× | no | Pen-and-ink, single hue |
| cosmic | 8 | 5 | radial-dark | neon | fill-only, watercolor | 3× | yes | Deep space, many tiny shapes, glow |
| watercolor-wash | 3 | 3 | radial-light | harmonious | watercolor, fill-only, incomplete | 0.5× | no | Soft washes, large shapes, low opacity |
| op-art | 8 | 2 | solid-light | high-contrast | fill-and-stroke, stroke-only, dashed | 0× | no | Dense, high-contrast, uniform sizes |
| collage | 4 | 3 | solid-light | duotone | fill-and-stroke, fill-only, double-stroke | 0× | yes | Overlapping, medium-large shapes |
| classic | 5 | 4 | radial-dark | harmonious | fill-and-stroke, watercolor | 1× | yes | Balanced, the original look |
| shattered-glass | 8 | 3 | solid-dark | high-contrast | fill-and-stroke, stroke-only, fill-only | 0× | no | Angular fragments, sharp edges, mosaic-like |
| botanical | 4 | 4 | radial-light | earth | watercolor, fill-only, incomplete | 3× | yes | Organic tendrils, flowing forms, natural tones |
| stipple-portrait | 9 | 2 | solid-light | monochrome | stipple, fill-only, hatched | 0× | no | Dense dot textures, pointillist, single hue |
| celestial | 7 | 5 | radial-dark | neon | fill-only, watercolor, stroke-only, incomplete | 2× | yes | Cosmic crescents, sacred geometry, heavy glow |

#### New Archetype Details

**shattered-glass** — Favors angular, fragmented shapes (shardField, voronoiCell, penroseTile, diamond, triangle, ngon). Organic shapes like blobs and clouds are filtered from the palette. High contrast on a dark background with no flow lines creates a mosaic of sharp-edged fragments.

**botanical** — Boosts organic shapes (tendril, cloudForm, blob, crescent, rose, inkSplat) for a natural, garden-like feel. Earth palette on a light radial background with heavy flow lines (3×) creates flowing, vine-like compositions.

**stipple-portrait** — Extremely dense (grid 9) with very small shapes (5–120px) and a steep size power curve (2.8) producing many tiny dots. Monochrome palette with stipple and hatched styles creates a pointillist texture. No flow lines or hero shape.

**celestial** — Boosts sacred geometry and cosmic shapes (crescent, geodesicDome, mandala, flowerOfLife, spirograph, fibonacciSpiral). Neon palette on dark background with heavy glow (2.5×) and deep layering (5 layers) creates a starfield-like composition with luminous geometric forms.

## 3. Color Scheme

Color generation uses the `color-scheme` library seeded from the hash, then applies archetype-specific palette modes.

### Palette Modes

| Mode | Description |
| ---- | ----------- |
| harmonious | Full palette from the scheme — the default |
| monochrome | Single hue, varying lightness |
| duotone | Two colors only |
| neon | High saturation on dark backgrounds |
| pastel-light | Soft pastels on light backgrounds |
| earth | Muted warm naturals |
| high-contrast | Black + white + one accent color |

### Color Hierarchy

After generating the raw palette, colors are organized into a **hierarchy** with weighted selection:

- **Dominant (60%)** — the most-used color, selected as the palette entry closest to the average hue
- **Secondary (25%)** — the color most distant from the dominant
- **Accent (15%)** — a remaining color for visual punctuation

`pickHierarchyColor(hierarchy, rng)` rolls against these weights so compositions naturally converge on a dominant tone without being monotonous.

### HSL Jitter

Color variation uses **HSL-space jitter** (`jitterColorHSL`) instead of the old RGB approach. This produces perceptually uniform shifts — a ±10° hue rotation and ±8% saturation/lightness shift feels natural, whereas the equivalent RGB jitter could accidentally desaturate or muddy colors.

### Positional Color

Shapes receive color based on their position relative to the canvas center:
- **Center (< 35% radius):** biased toward the dominant color
- **Middle (35–70%):** weighted random from the full hierarchy
- **Edges (> 70%):** biased toward secondary and accent colors

This creates a natural color gradient across the composition without explicit gradient code.

### Temperature Contrast

The scheme detects whether the background leans warm or cool, then shifts foreground shapes toward the opposite temperature. This ensures shapes always "pop" against their background.

### Contrast Enforcement

Every shape color is checked against the background luminance. If the contrast ratio is too low, the color is lightened or darkened to ensure visibility.

## 4. Shape Affinity System

Not all shapes look equally good at all sizes or in all combinations. The affinity system replaces naive random shape selection with intentional curation.

### Shape Inventory

The system includes 40+ shapes across 4 categories:

| Category | Shapes |
| -------- | ------ |
| Basic (9) | circle, square, triangle, hexagon, star, jacked-star, heart, diamond, cube |
| Complex (7) | platonicSolid, fibonacciSpiral, islamicPattern, celticKnot, merkaba, mandala, fractal |
| Sacred (8) | flowerOfLife, treeOfLife, metatronsCube, sriYantra, seedOfLife, vesicaPiscis, torus, eggOfLife |
| Procedural (18) | blob, ngon, lissajous, superellipse, spirograph, waveRing, rose, shardField, voronoiCell, crescent, tendril, cloudForm, inkSplat, geodesicDome, penroseTile, reuleauxTriangle, dotCluster, crosshatchPatch |

### Quality Tiers

Each shape has a profile with:

| Field | Purpose |
| ----- | ------- |
| `tier` (1–3) | Visual quality rating. Tier 1 shapes look good at any size; Tier 3 shapes need specific conditions |
| `minSizeFraction` / `maxSizeFraction` | Size bounds as fraction of `maxShapeSize` — prevents shapes from being drawn at sizes where they look bad |
| `affinities` | List of shapes this one composes well with |
| `category` | basic, complex, sacred, or procedural |
| `heroCandidate` | Whether the shape works as a dominant focal element |
| `bestStyles` | Render styles that suit this shape (e.g., sacred geometry looks best as stroke-only) |

### Shape Palette Construction

`buildShapePalette(rng, shapeNames, archetypeName)` builds a curated set:

1. **Seed selection:** Pick a Tier 1 hero-candidate shape as the seed
2. **Primary (5 shapes):** The seed + its direct affinities (Tier 1–2 only)
3. **Supporting (6 shapes):** Affinities-of-affinities + same-category Tier 1–2 shapes
4. **Accents (3 shapes):** Tier 1–2 shapes from *other* categories for contrast

Archetype-specific overrides apply:
- `geometric-precision` removes organic/procedural shapes from primary
- `organic-flow` boosts blobs and wave rings
- `shattered-glass` boosts angular shapes (shardField, voronoiCell, penroseTile), removes blobs/clouds
- `botanical` boosts organic shapes (tendril, cloudForm, crescent, rose, inkSplat)
- `stipple-portrait` boosts dot-friendly shapes (dotCluster, circle, crosshatchPatch)
- `celestial` boosts sacred/cosmic shapes (crescent, geodesicDome, mandala, flowerOfLife)

### Palette-Driven Selection

During rendering, `pickShapeFromPalette(palette, rng, sizeFraction)` selects shapes with weighted probability:
- **Primary: ~60%**, Supporting: ~30%, Accent: ~10%
- Shapes whose size constraints don't match the current `sizeFraction` are filtered out before selection

### Affinity-Aware Styling

`pickStyleForShape(shapeName, layerStyle, rng)` gives each shape a 70% chance of using one of its `bestStyles` instead of the layer's default style. This means sacred geometry naturally renders as stroke-only while blobs naturally render as watercolor.

## 5. Background Rendering

### Base Background

The archetype's `backgroundStyle` selects one of 7 modes:

| Style | Description |
| ----- | ----------- |
| radial-dark | Dark radial gradient from center outward (default) |
| radial-light | Light center (#f0ece4) fading to the palette background |
| linear-horizontal | Left-to-right gradient |
| linear-diagonal | Corner-to-corner gradient with midpoint return |
| solid-dark | Flat dark fill |
| solid-light | Flat off-white (#f5f2eb) |
| multi-stop | 3–4 color gradient using palette colors |

### Gradient Mesh Overlay

After the base background, 3–4 radial color control points are placed at random positions using `soft-light` compositing. Each point uses a hierarchy color at very low opacity (8–14%). This adds subtle color variation and depth to what would otherwise be a flat or simple gradient background.

### Layered Background Shapes

Large, nearly-transparent shapes (3–7) are drawn in `soft-light` mode at 3–8% opacity. The shape type is archetype-coherent: geometric archetypes (`geometric-precision`, `op-art`) use rectangles; all others use circles. Subtle concentric rings radiate from the center at ~2–5% opacity to add structure.

### Background Pattern Layer

~60% of images receive a subtle background pattern drawn in `soft-light` at 2–6% opacity, simulating textured paper:

| Pattern | Description |
| ------- | ----------- |
| Dot grid (⅓ chance) | Evenly spaced tiny dots across the canvas |
| Diagonal lines (⅓ chance) | Parallel diagonal lines at 0.5px width |
| Hexagonal tessellation (⅓ chance) | Honeycomb grid of tiny hexagons, stroke-only |

The pattern spacing scales with canvas size (1.5–3% of the shorter dimension). This adds tactile depth without competing with foreground shapes.

### Background Luminance

The average luminance of the two background colors is computed and stored. This value drives contrast enforcement for all foreground shapes — ensuring they remain visible regardless of background brightness.

## 6. Composition & Symmetry

### Composition Modes

Each image uses one of 5 composition strategies for shape placement:

| Mode | Behavior |
| ---- | -------- |
| radial | Shapes cluster around center with power-curve falloff |
| spiral | Shapes follow a multi-turn spiral from center outward |
| grid-subdivision | Canvas divided into 3–5 cells; shapes placed within random cells |
| clustered | 3–5 cluster centers; shapes scatter around the nearest cluster |
| flow-field | Uniform random placement (rotation driven by flow field) |

### Symmetry

~25% of hashes trigger symmetry mirroring, applied after all shapes and flow lines are drawn:
- **bilateral-x (10%):** Left half mirrored to right
- **bilateral-y (10%):** Top half mirrored to bottom
- **quad (5%):** Both axes mirrored

Symmetry is applied by drawing the canvas image onto itself with `scale(-1, 1)` or `scale(1, -1)` transforms.

## 7. Focal Points & Void Zones

1–2 **focal points** are placed with 70% bias toward rule-of-thirds intersections (the remaining 30% are placed randomly within the central 60% of the canvas). Each focal point has a `strength` (0.3–0.7) that pulls nearby shapes toward it via `applyFocalBias`.

1–2 **void zones** are placed randomly. Shapes landing inside a void zone have an 85% chance of being skipped, creating breathing room in the composition.

## 8. Hero Shape

When the archetype enables `heroShape` and the RNG roll passes (60% chance), a dominant focal element is drawn at the first focal point:

- Shape is selected from palette hero candidates (Tier 1, `heroCandidate: true`)
- Size is 80–130% of `adjustedMaxSize`
- Style is chosen from the shape's `bestStyles` via its affinity profile
- Fill uses the dominant hierarchy color; stroke uses the accent
- Glow radius is 12–32px (scaled)
- The hero's position and size are stored for the **hero avoidance field**

## 9. Shape Layers

The core of the image: `layers` passes (archetype-controlled, typically 2–5), each drawing `gridSize² × 1.5` shapes plus up to 30% random extra.

### Per-Layer Setup

- **Blend mode:** Random compositing mode (`source-over`, `multiply`, `screen`, `overlay`, `soft-light`, etc.)
- **Render style bias:** 60% chance of using an archetype-preferred style; 40% random
- **Opacity:** Decreases per layer (`baseOpacity - layer × opacityReduction`, floor 0.15)
- **Size scale:** Decreases 15% per layer (later layers = smaller shapes)
- **Atmospheric desaturation:** Later layers are progressively desaturated (up to 30%) to simulate depth
- **Depth-of-field:** Later layers get thinner strokes (down to 40% of base width) and reduced contrast (up to 20% opacity reduction), simulating camera focus falloff

### Per-Shape Pipeline

For each shape in a layer:

1. **Position:** Composition mode generates a candidate position, then `applyFocalBias` pulls it toward the nearest focal point
2. **Void check:** 85% skip chance if inside a void zone
3. **Density check:** If local density exceeds 15% of `shapesPerLayer`, 60% skip chance
4. **Size:** Power-curve distribution controlled by `archetype.sizePower` — higher values produce more small shapes
5. **Shape selection:** `pickShapeFromPalette` with size-constraint filtering
6. **Rotation:** Flow-field angle in flow-field mode (±15° jitter); random otherwise
7. **Hero avoidance:** Shapes within 1.5× the hero's size orient toward it (rotation blended 40% toward the angle-to-hero)
8. **Color:** Positional color from hierarchy + HSL jitter, with atmospheric desaturation and temperature contrast applied
9. **Contrast enforcement:** Fill and stroke colors checked against background luminance
10. **Styling:** Affinity-aware render style, optional glow (sacred shapes 45% base chance × archetype multiplier), optional radial gradient fill (30% chance)
11. **Organic edges:** 15% of `fill-and-stroke` shapes are promoted to `watercolor` style
12. **Light direction:** Non-glowing shapes get a subtle shadow offset along the consistent light angle

### 5a. Tangent Placement

~25% of shapes are nudged toward the nearest previously-placed shape so their edges "kiss." The algorithm finds the nearest shape, computes the target distance (sum of half-sizes), and repositions the current shape along the angle between them. This creates organic clustering where shapes feel intentionally arranged rather than randomly scattered.

### 5b. Shape Mirroring

Basic shapes (circle, triangle, square, hexagon, star, diamond, crescent, penroseTile, reuleauxTriangle) that are larger than 20% of max size have a ~40% chance of receiving a mirrored reflection. Four mirror axes are available:

| Axis | Probability | Effect |
| ---- | ----------- | ------ |
| horizontal | 15% | Reflected below with inverted rotation |
| vertical | 12% | Reflected to the right with 180° rotation offset |
| diagonal | 8% | Reflected along 45° axis with 90° rotation offset |
| radial-4 | 5% | Four copies at 90° intervals around the center |

The mirror copy is drawn at 70% opacity and 95% size (decreasing for radial-4), creating a subtle symmetry effect without perfect duplication.

### 5c. Size Echo

~20% of shapes larger than half `adjustedMaxSize` spawn 2–3 trailing copies along a random direction. Each echo is progressively smaller (30% → 22% → 14% of parent size) and more transparent, creating a motion-trail effect.

### 5d. Recursive Nesting

~15% of shapes larger than 40% of `adjustedMaxSize` receive 1–3 inner shapes. Inner shapes are selected from the palette via `pickShapeFromPalette` at the nested size fraction, and styled with their own affinity-aware render style.

### 5e. Shape Constellations

~12% of shapes larger than 35% of `adjustedMaxSize` trigger a **constellation** — a pre-composed group of shapes placed as a unit. The entire group is rotated by a random angle for variety. Five constellation types are available:

| Constellation | Description |
| ------------- | ----------- |
| flanked-triangle | Central triangle with two smaller circles on either side |
| hexagon-ring | 5–6 hexagons arranged in a ring |
| spiral-dots | 7–11 circles spiraling outward with decreasing size |
| diamond-cluster | 4 diamonds in a cardinal arrangement with progressive rotation |
| crescent-pair | Two crescents facing each other |

Each member shape uses hierarchy colors with HSL jitter and affinity-aware render styles. Members that fall outside the canvas bounds are skipped.

## 10. Render Styles

Each shape is drawn using one of 14 render styles:

| Style | Description |
| ----- | ----------- |
| fill-and-stroke | Standard fill + outline (default) |
| fill-only | Solid fill, no outline |
| stroke-only | Ghost fill at 30% opacity + full outline |
| double-stroke | Fill + thick outer stroke at 50% opacity + thin inner stroke in fill color |
| dashed | Fill + dashed outline (dash = 5% of size, gap = 3%) |
| watercolor | Multi-pass: base wash (scaled up 8%), radial-bleed offset washes, edge darkening via inner lighter fill, delicate thin stroke |
| hatched | 30% opacity fill + clipped cross-hatch lines (parallel + optional perpendicular) + 50% opacity outline |
| incomplete | 25% opacity fill + long-dash stroke simulating a partially drawn outline (60–85% completeness) |
| stipple | Ghost fill at 15% + clipped dot grid with jittered positions and variable dot sizes |
| stencil | Negative-space cutout: fills a bounding rectangle, then erases the shape via destination-out compositing |
| noise-grain | 25% base tint + clipped procedural noise (random black/white dots at 15–50% opacity, variable sizes) |
| wood-grain | 20% base tint + clipped parallel wavy lines at a random angle, simulating wood texture |
| marble-vein | 35% soft base + clipped branching vein lines that drift and fork, simulating marble stone |
| fabric-weave | 15% ghost base + clipped interlocking horizontal and vertical thread lines at alternating opacities |

### Texture Fill Details

The 4 new texture fills (noise-grain, wood-grain, marble-vein, fabric-weave) all work by:
1. Drawing a low-opacity base fill to tint the shape
2. Clipping to the shape boundary via `ctx.clip()`
3. Drawing the procedural texture pattern within the clipped region
4. Adding a subtle outline stroke on top

**noise-grain** scatters random-sized dots (black or white) across the shape at variable opacity, creating a film-grain or sandpaper texture. Dot spacing scales with shape size.

**wood-grain** draws parallel wavy lines at a random angle. The wave frequency (3–8 cycles) and amplitude (1–4% of size) create organic undulation. Line spacing is ~3.5% of shape size.

**marble-vein** draws 2–4 main veins that drift randomly downward, with ~20% chance per step of spawning a thinner branch vein. This creates the characteristic forking pattern of natural marble.

**fabric-weave** draws horizontal threads at full spacing, then vertical threads at half-spacing offsets, creating an over-under weave pattern. The two thread directions use different opacities (55% vs 45%) and colors (stroke vs fill) for visual distinction.

### Watercolor Detail

The watercolor style simulates wet media through 4 passes:
1. **Base wash:** Shape drawn at 108% scale, 15% opacity — soft bleed beyond the boundary
2. **Offset washes:** 4–5 passes with radial displacement (random angle, up to 5% of size) — organic edge irregularity
3. **Edge darkening:** Shape drawn at 85–93% scale with lightened fill — simulates pigment pooling at boundaries where the inner area dries lighter
4. **Delicate stroke:** Thin outline (60% of normal width) at 25% opacity

## 11. Flow Lines

Flow lines follow a sinusoidal vector field defined by `flowAngle(x, y)`. The archetype's `flowLineMultiplier` controls count (0× = none, up to 4× = heavy).

Each flow line:
- Starts at a random position
- Takes 30–70 steps along the flow field (±0.3 radians jitter per step)
- **Variable color:** Interpolates between two hierarchy colors along the stroke length
- **Pressure simulation:** Line width oscillates sinusoidally (frequency 2–6 cycles, amplitude ±40%) to simulate pen pressure
- **Taper:** Width and opacity decrease toward the end (80% taper over the stroke length)
- **Branching:** ~12% chance per step (between steps 5 and N-10) to spawn a child stroke at ±0.3–0.8 radians, 40% width, 5–15 steps, 60% parent opacity

## 12. Post-Processing

After all shapes, flow lines, and symmetry mirroring:

### Noise Texture

Deterministic noise (separate RNG seeded from hash + salt 777) scatters single-pixel dots across the canvas. Density scales with canvas area (~1 dot per 800px²). Each dot is black or white at 1–4% opacity, adding subtle film grain.

### Vignette

A radial gradient darkens the edges: transparent at center, ramping to 25–45% black at the corners. This draws the eye inward toward the focal points.

### Organic Connecting Curves

Quadratic Bézier curves connect random pairs of placed shapes. The control point is offset perpendicular to the line between shapes by up to 40% of their distance, creating organic arcs. Count scales with canvas area (~8 per megapixel). Drawn at 6–16% opacity using hierarchy colors.

### Color Grading

A `soft-light` overlay in a single hue (random, 40% saturation, 50% lightness) at low intensity (grade intensity × 25% opacity). This unifies the image's color temperature — like applying a photo filter.

### Chromatic Aberration

Only for `neon-glow`, `cosmic`, and `ethereal` archetypes. The canvas is drawn onto itself with a small horizontal offset (±2px scaled) using `screen` compositing at 3% opacity. This creates a subtle RGB fringing effect at high-contrast edges.

### Bloom

Only for `neon-glow` and `cosmic` archetypes. The canvas is redrawn with `shadowBlur` at 30px (scaled) and white shadow color, composited via `screen` at 8% opacity. This creates a soft glow around bright areas.
