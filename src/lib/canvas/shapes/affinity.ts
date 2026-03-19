/**
 * Shape affinity system — controls which shapes look good together,
 * quality tiers for different rendering contexts, and size preferences.
 *
 * This replaces the naive "pick any shape" approach with intentional
 * curation that produces more cohesive compositions.
 */

// ── Quality tiers ───────────────────────────────────────────────────
// Not all shapes render equally well at all sizes or in all contexts.
// Tier 1 shapes are visually strong at any size; Tier 3 shapes need
// specific conditions to look good.

export type ShapeTier = 1 | 2 | 3;

export interface ShapeProfile {
  /** Visual quality tier (1 = always good, 3 = situational) */
  tier: ShapeTier;
  /** Minimum size (as fraction of maxShapeSize) before shape looks bad */
  minSizeFraction: number;
  /** Maximum size fraction — some shapes look bad when huge */
  maxSizeFraction: number;
  /** Which shapes this one composes well with */
  affinities: string[];
  /** Category for grouping */
  category: "basic" | "complex" | "sacred" | "procedural";
  /** Whether this shape works well as a hero/focal element */
  heroCandidate: boolean;
  /** Best render styles for this shape */
  bestStyles: string[];
}

export const SHAPE_PROFILES: Record<string, ShapeProfile> = {
  // ── Basic shapes ──────────────────────────────────────────────
  circle: {
    tier: 1,
    minSizeFraction: 0.05,
    maxSizeFraction: 1.0,
    affinities: ["circle", "blob", "hexagon", "flowerOfLife", "seedOfLife"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke", "hand-drawn"],
  },
  square: {
    tier: 2,
    minSizeFraction: 0.08,
    maxSizeFraction: 0.7,
    affinities: ["square", "diamond", "superellipse", "islamicPattern"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "stroke-only", "hatched"],
  },
  triangle: {
    tier: 1,
    minSizeFraction: 0.06,
    maxSizeFraction: 0.9,
    affinities: ["triangle", "diamond", "hexagon", "merkaba", "sriYantra"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "fill-only", "watercolor", "hand-drawn"],
  },
  hexagon: {
    tier: 1,
    minSizeFraction: 0.05,
    maxSizeFraction: 1.0,
    affinities: ["hexagon", "circle", "flowerOfLife", "metatronsCube", "triangle"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-only", "fill-and-stroke", "watercolor"],
  },
  star: {
    tier: 2,
    minSizeFraction: 0.08,
    maxSizeFraction: 0.6,
    affinities: ["star", "circle", "mandala", "spirograph"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "stroke-only", "dashed"],
  },
  "jacked-star": {
    tier: 3,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.4,
    affinities: ["star", "circle"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["stroke-only", "dashed"],
  },
  heart: {
    tier: 3,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.5,
    affinities: ["circle", "blob"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor"],
  },
  diamond: {
    tier: 2,
    minSizeFraction: 0.06,
    maxSizeFraction: 0.8,
    affinities: ["diamond", "triangle", "square", "merkaba"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "fill-only", "double-stroke"],
  },
  cube: {
    tier: 3,
    minSizeFraction: 0.08,
    maxSizeFraction: 0.5,
    affinities: ["square", "diamond"],
    category: "basic",
    heroCandidate: false,
    bestStyles: ["stroke-only", "fill-and-stroke"],
  },

  // ── Complex shapes ────────────────────────────────────────────
  platonicSolid: {
    tier: 2,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.8,
    affinities: ["metatronsCube", "merkaba", "hexagon", "triangle"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "double-stroke", "dashed"],
  },
  fibonacciSpiral: {
    tier: 1,
    minSizeFraction: 0.2,
    maxSizeFraction: 1.0,
    affinities: ["circle", "rose", "spirograph", "flowerOfLife"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "incomplete", "watercolor"],
  },
  islamicPattern: {
    tier: 2,
    minSizeFraction: 0.25,
    maxSizeFraction: 0.9,
    affinities: ["square", "hexagon", "star", "mandala"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "dashed", "hatched"],
  },
  celticKnot: {
    tier: 2,
    minSizeFraction: 0.2,
    maxSizeFraction: 0.7,
    affinities: ["circle", "lissajous", "spirograph"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "double-stroke"],
  },
  merkaba: {
    tier: 1,
    minSizeFraction: 0.15,
    maxSizeFraction: 1.0,
    affinities: ["triangle", "diamond", "sriYantra", "metatronsCube"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "fill-and-stroke", "double-stroke"],
  },
  mandala: {
    tier: 1,
    minSizeFraction: 0.2,
    maxSizeFraction: 1.0,
    affinities: ["circle", "flowerOfLife", "spirograph", "rose"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "dashed", "incomplete"],
  },
  fractal: {
    tier: 2,
    minSizeFraction: 0.2,
    maxSizeFraction: 0.8,
    affinities: ["blob", "lissajous", "circle"],
    category: "complex",
    heroCandidate: true,
    bestStyles: ["stroke-only", "incomplete"],
  },

  // ── Sacred shapes ─────────────────────────────────────────────
  flowerOfLife: {
    tier: 1,
    minSizeFraction: 0.2,
    maxSizeFraction: 1.0,
    affinities: ["circle", "hexagon", "seedOfLife", "eggOfLife", "metatronsCube"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "watercolor", "incomplete"],
  },
  treeOfLife: {
    tier: 2,
    minSizeFraction: 0.25,
    maxSizeFraction: 0.9,
    affinities: ["circle", "flowerOfLife", "metatronsCube"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "double-stroke"],
  },
  metatronsCube: {
    tier: 1,
    minSizeFraction: 0.2,
    maxSizeFraction: 1.0,
    affinities: ["hexagon", "flowerOfLife", "platonicSolid", "merkaba"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "dashed", "incomplete"],
  },
  sriYantra: {
    tier: 1,
    minSizeFraction: 0.2,
    maxSizeFraction: 1.0,
    affinities: ["triangle", "merkaba", "mandala", "diamond"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "fill-and-stroke", "double-stroke"],
  },
  seedOfLife: {
    tier: 1,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.9,
    affinities: ["circle", "flowerOfLife", "eggOfLife", "hexagon"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "watercolor", "fill-only"],
  },
  vesicaPiscis: {
    tier: 2,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.7,
    affinities: ["circle", "seedOfLife", "flowerOfLife"],
    category: "sacred",
    heroCandidate: false,
    bestStyles: ["stroke-only", "watercolor"],
  },
  torus: {
    tier: 3,
    minSizeFraction: 0.2,
    maxSizeFraction: 0.6,
    affinities: ["circle", "spirograph", "waveRing"],
    category: "sacred",
    heroCandidate: false,
    bestStyles: ["stroke-only", "dashed"],
  },
  eggOfLife: {
    tier: 2,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.8,
    affinities: ["circle", "seedOfLife", "flowerOfLife"],
    category: "sacred",
    heroCandidate: true,
    bestStyles: ["stroke-only", "watercolor"],
  },

  // ── Procedural shapes ─────────────────────────────────────────
  blob: {
    tier: 1,
    minSizeFraction: 0.05,
    maxSizeFraction: 1.0,
    affinities: ["blob", "circle", "superellipse", "waveRing"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke", "hand-drawn"],
  },
  ngon: {
    tier: 2,
    minSizeFraction: 0.06,
    maxSizeFraction: 0.8,
    affinities: ["hexagon", "triangle", "diamond", "superellipse"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "fill-only", "hatched"],
  },
  lissajous: {
    tier: 2,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.8,
    affinities: ["spirograph", "rose", "celticKnot", "fibonacciSpiral"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["stroke-only", "incomplete", "dashed"],
  },
  superellipse: {
    tier: 1,
    minSizeFraction: 0.05,
    maxSizeFraction: 1.0,
    affinities: ["circle", "square", "blob", "hexagon"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke", "wood-grain"],
  },
  spirograph: {
    tier: 1,
    minSizeFraction: 0.15,
    maxSizeFraction: 0.9,
    affinities: ["rose", "lissajous", "mandala", "flowerOfLife"],
    category: "procedural",
    heroCandidate: true,
    bestStyles: ["stroke-only", "incomplete", "dashed"],
  },
  waveRing: {
    tier: 2,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.8,
    affinities: ["circle", "blob", "torus", "spirograph"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["stroke-only", "dashed", "incomplete"],
  },
  rose: {
    tier: 1,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.9,
    affinities: ["spirograph", "mandala", "flowerOfLife", "circle"],
    category: "procedural",
    heroCandidate: true,
    bestStyles: ["stroke-only", "fill-only", "watercolor"],
  },

  // ── New procedural shapes ─────────────────────────────────────
  shardField: {
    tier: 2,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.7,
    affinities: ["voronoiCell", "diamond", "triangle", "penroseTile"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "stroke-only", "fill-only"],
  },
  voronoiCell: {
    tier: 1,
    minSizeFraction: 0.08,
    maxSizeFraction: 0.9,
    affinities: ["shardField", "ngon", "superellipse", "blob"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "fill-only", "watercolor", "marble-vein"],
  },
  crescent: {
    tier: 1,
    minSizeFraction: 0.1,
    maxSizeFraction: 1.0,
    affinities: ["circle", "blob", "cloudForm", "vesicaPiscis"],
    category: "procedural",
    heroCandidate: true,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke"],
  },
  tendril: {
    tier: 2,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.8,
    affinities: ["blob", "inkSplat", "lissajous", "fibonacciSpiral"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke"],
  },
  cloudForm: {
    tier: 1,
    minSizeFraction: 0.15,
    maxSizeFraction: 1.0,
    affinities: ["blob", "circle", "crescent", "superellipse"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor"],
  },
  inkSplat: {
    tier: 2,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.8,
    affinities: ["blob", "tendril", "shardField", "star"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "watercolor", "fill-and-stroke"],
  },
  geodesicDome: {
    tier: 2,
    minSizeFraction: 0.2,
    maxSizeFraction: 0.9,
    affinities: ["metatronsCube", "platonicSolid", "hexagon", "triangle"],
    category: "procedural",
    heroCandidate: true,
    bestStyles: ["stroke-only", "dashed", "double-stroke"],
  },
  penroseTile: {
    tier: 2,
    minSizeFraction: 0.06,
    maxSizeFraction: 0.6,
    affinities: ["diamond", "triangle", "shardField", "voronoiCell"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-and-stroke", "fill-only", "double-stroke"],
  },
  reuleauxTriangle: {
    tier: 1,
    minSizeFraction: 0.08,
    maxSizeFraction: 1.0,
    affinities: ["triangle", "circle", "superellipse", "vesicaPiscis"],
    category: "procedural",
    heroCandidate: true,
    bestStyles: ["fill-and-stroke", "fill-only", "watercolor"],
  },
  dotCluster: {
    tier: 3,
    minSizeFraction: 0.05,
    maxSizeFraction: 0.5,
    affinities: ["cloudForm", "inkSplat", "blob"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["fill-only", "stipple"],
  },
  crosshatchPatch: {
    tier: 3,
    minSizeFraction: 0.1,
    maxSizeFraction: 0.6,
    affinities: ["voronoiCell", "ngon", "superellipse"],
    category: "procedural",
    heroCandidate: false,
    bestStyles: ["stroke-only", "hatched", "fabric-weave"],
  },
};

// ── Shape palette: curated sets of shapes that work well together ────

export interface ShapePalette {
  /** Primary shapes — used most often */
  primary: string[];
  /** Supporting shapes — used less frequently */
  supporting: string[];
  /** Accent shapes — rare, for visual punctuation */
  accents: string[];
}

/**
 * Build a curated shape palette from a seed shape.
 * Uses affinity data to select shapes that compose well together,
 * filtering out low-tier shapes that don't work at the current scale.
 */
export function buildShapePalette(
  rng: () => number,
  shapeNames: string[],
  archetypeName: string,
): ShapePalette {
  const available = shapeNames.filter((s) => SHAPE_PROFILES[s]);

  // Pick a seed shape — tier 1 shapes that are hero candidates
  const heroPool = available.filter(
    (s) => SHAPE_PROFILES[s].tier === 1 && SHAPE_PROFILES[s].heroCandidate,
  );
  const seedShape = heroPool.length > 0
    ? heroPool[Math.floor(rng() * heroPool.length)]
    : available[Math.floor(rng() * available.length)];

  const seedProfile = SHAPE_PROFILES[seedShape];

  // Primary: seed shape + its direct affinities (tier 1-2 only)
  const primaryCandidates = [seedShape, ...seedProfile.affinities]
    .filter((s) => available.includes(s))
    .filter((s) => SHAPE_PROFILES[s].tier <= 2);
  const primary = [...new Set(primaryCandidates)].slice(0, 5);

  // Supporting: affinities of affinities, plus same-category shapes
  const supportingSet = new Set<string>();
  for (const p of primary) {
    const profile = SHAPE_PROFILES[p];
    if (!profile) continue;
    for (const aff of profile.affinities) {
      if (available.includes(aff) && !primary.includes(aff)) {
        supportingSet.add(aff);
      }
    }
  }
  // Add same-category tier 1-2 shapes
  for (const s of available) {
    const p = SHAPE_PROFILES[s];
    if (p.category === seedProfile.category && p.tier <= 2 && !primary.includes(s)) {
      supportingSet.add(s);
    }
  }
  const supporting = [...supportingSet].slice(0, 6);

  // Accents: tier 1 shapes from other categories for contrast
  const usedCategories = new Set(
    [...primary, ...supporting].map((s) => SHAPE_PROFILES[s]?.category),
  );
  const accentCandidates = available.filter(
    (s) =>
      !primary.includes(s) &&
      !supporting.includes(s) &&
      SHAPE_PROFILES[s].tier <= 2 &&
      !usedCategories.has(SHAPE_PROFILES[s].category),
  );
  // Shuffle and take a few
  const accents: string[] = [];
  const shuffled = [...accentCandidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  accents.push(...shuffled.slice(0, 3));

  // For certain archetypes, bias the palette
  if (archetypeName === "geometric-precision") {
    // Remove blobs and organic shapes from primary
    return {
      primary: primary.filter((s) => SHAPE_PROFILES[s]?.category !== "procedural" || s === "ngon"),
      supporting: supporting.filter((s) => s !== "blob"),
      accents,
    };
  }
  if (archetypeName === "organic-flow") {
    // Boost procedural/organic shapes
    const organicBoost = available.filter(
      (s) => ["blob", "superellipse", "waveRing", "rose"].includes(s) && !primary.includes(s),
    );
    return {
      primary: [...primary, ...organicBoost.slice(0, 2)],
      supporting,
      accents,
    };
  }
  if (archetypeName === "shattered-glass") {
    // Favor angular, fragmented shapes
    const shardBoost = available.filter(
      (s) => ["shardField", "voronoiCell", "penroseTile", "diamond", "triangle", "ngon"].includes(s) && !primary.includes(s),
    );
    return {
      primary: [...primary.filter((s) => s !== "blob" && s !== "cloudForm"), ...shardBoost.slice(0, 3)],
      supporting: supporting.filter((s) => s !== "blob" && s !== "cloudForm"),
      accents,
    };
  }
  if (archetypeName === "botanical") {
    // Favor organic, flowing shapes
    const botanicalBoost = available.filter(
      (s) => ["tendril", "cloudForm", "blob", "crescent", "rose", "inkSplat"].includes(s) && !primary.includes(s),
    );
    return {
      primary: [...primary, ...botanicalBoost.slice(0, 3)],
      supporting,
      accents,
    };
  }
  if (archetypeName === "stipple-portrait") {
    // Favor small, dot-friendly shapes
    const stippleBoost = available.filter(
      (s) => ["dotCluster", "circle", "crosshatchPatch", "voronoiCell", "blob"].includes(s) && !primary.includes(s),
    );
    return {
      primary: [...primary, ...stippleBoost.slice(0, 3)],
      supporting,
      accents,
    };
  }
  if (archetypeName === "celestial") {
    // Favor sacred geometry and cosmic shapes
    const celestialBoost = available.filter(
      (s) => ["crescent", "geodesicDome", "mandala", "flowerOfLife", "spirograph", "fibonacciSpiral"].includes(s) && !primary.includes(s),
    );
    return {
      primary: [...primary, ...celestialBoost.slice(0, 3)],
      supporting,
      accents,
    };
  }

  return { primary, supporting, accents };
}

/**
 * Pick a shape from the palette with weighted probability.
 * Primary: ~60%, Supporting: ~30%, Accent: ~10%.
 * Also respects size constraints from the shape profile.
 */
export function pickShapeFromPalette(
  palette: ShapePalette,
  rng: () => number,
  sizeFraction: number,
): string {
  // Filter each tier by size constraints
  const validPrimary = palette.primary.filter((s) => {
    const p = SHAPE_PROFILES[s];
    return p && sizeFraction >= p.minSizeFraction && sizeFraction <= p.maxSizeFraction;
  });
  const validSupporting = palette.supporting.filter((s) => {
    const p = SHAPE_PROFILES[s];
    return p && sizeFraction >= p.minSizeFraction && sizeFraction <= p.maxSizeFraction;
  });
  const validAccents = palette.accents.filter((s) => {
    const p = SHAPE_PROFILES[s];
    return p && sizeFraction >= p.minSizeFraction && sizeFraction <= p.maxSizeFraction;
  });

  const roll = rng();
  if (roll < 0.60 && validPrimary.length > 0) {
    return validPrimary[Math.floor(rng() * validPrimary.length)];
  }
  if (roll < 0.90 && validSupporting.length > 0) {
    return validSupporting[Math.floor(rng() * validSupporting.length)];
  }
  if (validAccents.length > 0) {
    return validAccents[Math.floor(rng() * validAccents.length)];
  }
  // Fallback: any valid primary or supporting
  const fallback = [...validPrimary, ...validSupporting];
  if (fallback.length > 0) return fallback[Math.floor(rng() * fallback.length)];
  // Ultimate fallback
  return palette.primary[0] || "circle";
}

/**
 * Get the best render style for a shape, with some randomness.
 * 70% chance of using one of the shape's best styles,
 * 30% chance of using the layer's style.
 */
export function pickStyleForShape(
  shapeName: string,
  layerStyle: string,
  rng: () => number,
): string {
  const profile = SHAPE_PROFILES[shapeName];
  if (!profile || rng() > 0.7) return layerStyle;
  return profile.bestStyles[Math.floor(rng() * profile.bestStyles.length)];
}
