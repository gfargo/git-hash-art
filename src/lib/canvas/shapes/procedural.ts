/**
 * Procedural shape generators — hash-derived shapes that are unique
 * per generation. Unlike the fixed shape library, these produce geometry
 * that doesn't repeat across hashes.
 *
 * All draw functions accept an RNG via the config parameter so the
 * shapes are deterministic from the hash.
 */

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config?: any,
) => void;

// ── Blob: organic closed curve via cubic bezier ─────────────────────

export const drawBlob: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const numPoints = 5 + Math.floor(rng() * 5);
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const jitter = 0.5 + rng() * 0.5;
    points.push({
      x: Math.cos(angle) * r * jitter,
      y: Math.sin(angle) * r * jitter,
    });
  }

  ctx.beginPath();
  const last = points[points.length - 1];
  const first = points[0];
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);

  for (let i = 0; i < numPoints; i++) {
    const curr = points[i];
    const next = points[(i + 1) % numPoints];
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
  }
  ctx.closePath();
};

// ── Ngon: irregular polygon with hash-controlled vertices ───────────

export const drawNgon: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const sides = 3 + Math.floor(rng() * 10);
  const jitterAmount = 0.1 + rng() * 0.4;

  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const radiusJitter = 1 - jitterAmount + rng() * jitterAmount * 2;
    const x = Math.cos(angle) * r * radiusJitter;
    const y = Math.sin(angle) * r * radiusJitter;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Lissajous: parametric curves with hash-derived frequency ratios ─

export const drawLissajous: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const freqA = 1 + Math.floor(rng() * 5);
  const freqB = 1 + Math.floor(rng() * 5);
  const phase = rng() * Math.PI;
  const steps = 120;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.sin(freqA * t + phase) * r;
    const y = Math.sin(freqB * t) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Superellipse: |x|^n + |y|^n = 1 with hash-derived exponent ─────

export const drawSuperellipse: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const n = 0.3 + rng() * 4.7;
  const steps = 120;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const x = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n) * r;
    const y = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Spirograph: hypotrochoid curves ─────────────────────────────────

export const drawSpirograph: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const scale = size / 2;
  const R = 1;
  const r = 0.2 + rng() * 0.6;
  const d = 0.3 + rng() * 0.7;
  const gcd = (a: number, b: number): number => {
    const ai = Math.round(a * 1000);
    const bi = Math.round(b * 1000);
    const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
    return g(ai, bi) / 1000;
  };
  const period = r / gcd(R, r);
  const maxT = Math.min(period, 10) * Math.PI * 2;
  const steps = Math.min(600, Math.floor(maxT * 20));

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * maxT;
    const x = ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)) * scale / (1 + d);
    const y = ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)) * scale / (1 + d);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ── Wave ring: concentric ring with sinusoidal displacement ─────────

export const drawWaveRing: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const rings = 2 + Math.floor(rng() * 4);
  const freq = 3 + Math.floor(rng() * 12);
  const amp = 0.05 + rng() * 0.15;

  ctx.beginPath();
  for (let ring = 0; ring < rings; ring++) {
    const baseR = r * (0.3 + (ring / rings) * 0.7);
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const wave = Math.sin(t * freq + ring * 1.5) * baseR * amp;
      const x = Math.cos(t) * (baseR + wave);
      const y = Math.sin(t) * (baseR + wave);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
};

// ── Rose curve: polar rose r = cos(k*theta) ────────────────────────

export const drawRose: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const k = 2 + Math.floor(rng() * 6);
  const steps = 200;

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2 * (k % 2 === 0 ? 1 : 2);
    const rr = Math.cos(k * theta) * r;
    const x = rr * Math.cos(theta);
    const y = rr * Math.sin(theta);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

// ═══════════════════════════════════════════════════════════════════
// NEW PROCEDURAL SHAPES
// ═══════════════════════════════════════════════════════════════════

// ── ShardField: cluster of angular shards (broken glass / crystals) ─
// Generates 4-8 convex polygonal shards radiating from center.

export const drawShardField: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const shardCount = 4 + Math.floor(rng() * 5); // 4-8 shards

  ctx.beginPath();
  for (let s = 0; s < shardCount; s++) {
    const baseAngle = (s / shardCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const dist = r * (0.15 + rng() * 0.35);
    const cx = Math.cos(baseAngle) * dist;
    const cy = Math.sin(baseAngle) * dist;
    const shardSize = r * (0.2 + rng() * 0.4);
    const verts = 3 + Math.floor(rng() * 3); // 3-5 vertices per shard
    const shardAngleOffset = rng() * Math.PI * 2;

    for (let v = 0; v < verts; v++) {
      const angle = shardAngleOffset + (v / verts) * Math.PI * 2;
      // Elongate shards along their radial direction
      const stretch = v % 2 === 0 ? 1.0 : 0.3 + rng() * 0.4;
      const px = cx + Math.cos(angle) * shardSize * stretch;
      const py = cy + Math.sin(angle) * shardSize * stretch;
      if (v === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
};

// ── VoronoiCell: single organic cell with straight edges ────────────
// Simulates a Voronoi cell by generating a convex hull around
// a jittered set of midpoints between center and random neighbors.

export const drawVoronoiCell: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const edgeCount = 5 + Math.floor(rng() * 4); // 5-8 edges
  const points: Array<{ angle: number; x: number; y: number }> = [];

  // Generate edge midpoints at varying distances
  for (let i = 0; i < edgeCount; i++) {
    const angle = (i / edgeCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const dist = r * (0.6 + rng() * 0.4);
    points.push({
      angle,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    });
  }
  // Sort by angle for proper winding
  points.sort((a, b) => a.angle - b.angle);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
};

// ── Crescent: two overlapping circles subtracted ────────────────────
// Hash controls bite size and angle of the crescent.

export const drawCrescent: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const biteSize = 0.6 + rng() * 0.3; // 60-90% of radius
  const biteOffset = r * (0.3 + rng() * 0.4);
  const biteAngle = rng() * Math.PI * 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);

  // Subtract inner circle using even-odd rule
  const bx = Math.cos(biteAngle) * biteOffset;
  const by = Math.sin(biteAngle) * biteOffset;
  // Draw inner circle counter-clockwise for subtraction
  ctx.moveTo(bx + r * biteSize, by);
  ctx.arc(bx, by, r * biteSize, 0, Math.PI * 2, true);
};

// ── Tendril: tapered curving stroke that branches ───────────────────
// Like a vine or neural dendrite. Draws as a filled tapered path.

export const drawTendril: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const segments = 12 + Math.floor(rng() * 8);
  const startAngle = rng() * Math.PI * 2;
  const curvature = (rng() - 0.5) * 0.4;

  // Build spine points
  const spine: Array<{ x: number; y: number }> = [];
  let angle = startAngle;
  let px = 0, py = 0;
  for (let i = 0; i <= segments; i++) {
    spine.push({ x: px, y: py });
    const stepLen = (r / segments) * (1.5 + rng() * 0.5);
    angle += curvature + (rng() - 0.5) * 0.6;
    px += Math.cos(angle) * stepLen;
    py += Math.sin(angle) * stepLen;
  }

  // Build tapered outline by offsetting perpendicular to spine
  ctx.beginPath();
  const leftSide: Array<{ x: number; y: number }> = [];
  const rightSide: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < spine.length; i++) {
    const t = i / (spine.length - 1);
    const width = r * 0.12 * (1 - t * 0.9); // taper from thick to thin
    const next = spine[Math.min(i + 1, spine.length - 1)];
    const dx = next.x - spine[i].x;
    const dy = next.y - spine[i].y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    leftSide.push({ x: spine[i].x + nx * width, y: spine[i].y + ny * width });
    rightSide.push({ x: spine[i].x - nx * width, y: spine[i].y - ny * width });
  }

  ctx.moveTo(leftSide[0].x, leftSide[0].y);
  for (let i = 1; i < leftSide.length; i++) {
    ctx.lineTo(leftSide[i].x, leftSide[i].y);
  }
  for (let i = rightSide.length - 1; i >= 0; i--) {
    ctx.lineTo(rightSide[i].x, rightSide[i].y);
  }
  ctx.closePath();
};

// ── CloudForm: overlapping circles along a curved spine ─────────────
// Like cumulus clouds — soft, billowy, organic.

export const drawCloudForm: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const lobeCount = 4 + Math.floor(rng() * 4); // 4-7 lobes
  const spineAngle = rng() * Math.PI * 2;
  const spineLen = r * 0.6;

  ctx.beginPath();
  for (let i = 0; i < lobeCount; i++) {
    const t = (i / (lobeCount - 1)) - 0.5; // -0.5 to 0.5
    const sx = Math.cos(spineAngle) * spineLen * t;
    const sy = Math.sin(spineAngle) * spineLen * t;
    // Offset perpendicular for cloud shape
    const perpAngle = spineAngle + Math.PI / 2;
    const perpOff = (rng() - 0.3) * r * 0.3;
    const cx = sx + Math.cos(perpAngle) * perpOff;
    const cy = sy + Math.sin(perpAngle) * perpOff;
    const lobeR = r * (0.25 + rng() * 0.2);
    ctx.moveTo(cx + lobeR, cy);
    ctx.arc(cx, cy, lobeR, 0, Math.PI * 2);
  }
};

// ── InkSplat: radial spikes with bezier curves between them ─────────
// Like an ink drop hitting paper — organic, explosive.

export const drawInkSplat: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const spikeCount = 8 + Math.floor(rng() * 8); // 8-15 spikes
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const isSpike = i % 2 === 0;
    const dist = isSpike
      ? r * (0.5 + rng() * 0.5) // spikes reach 50-100% of radius
      : r * (0.15 + rng() * 0.2); // valleys at 15-35%
    points.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const cpx = (curr.x + next.x) / 2 + (rng() - 0.5) * r * 0.15;
    const cpy = (curr.y + next.y) / 2 + (rng() - 0.5) * r * 0.15;
    ctx.quadraticCurveTo(cpx, cpy, next.x, next.y);
  }
  ctx.closePath();
};

// ── GeodesicDome: subdivided icosahedron projection ─────────────────
// Hash controls subdivision level (1-3). Projected to 2D.

export const drawGeodesicDome: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const subdivisions = 1 + Math.floor(rng() * 3); // 1-3

  // Start with icosahedron vertices projected to 2D
  const baseVerts = 6 + subdivisions * 4;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < baseVerts; i++) {
    const angle = (i / baseVerts) * Math.PI * 2;
    const ring = i % 2 === 0 ? 1.0 : 0.5 + rng() * 0.3;
    points.push({
      x: Math.cos(angle) * r * ring,
      y: Math.sin(angle) * r * ring,
    });
  }

  ctx.beginPath();
  // Draw triangulated mesh — connect each point to neighbors and center
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(next.x, next.y);
    // Connect to center
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(0, 0);
    // Cross-connect to create triangulation
    if (i % 2 === 0 && i + 2 < points.length) {
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 2].x, points[i + 2].y);
    }
  }
  // Outer ring
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
};

// ── PenroseTile: kite or dart shape from Penrose tiling ─────────────
// Hash selects kite vs dart and rotation.

export const drawPenroseTile: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const phi = (1 + Math.sqrt(5)) / 2; // golden ratio
  const isKite = rng() < 0.5;

  ctx.beginPath();
  if (isKite) {
    // Kite: two golden triangles joined at base
    const topY = -r;
    const bottomY = r * (1 / phi);
    const midY = r * (1 / phi - 1) * 0.3;
    const wingX = r * 0.6;
    ctx.moveTo(0, topY);
    ctx.lineTo(wingX, midY);
    ctx.lineTo(0, bottomY);
    ctx.lineTo(-wingX, midY);
  } else {
    // Dart: concave quadrilateral
    const topY = -r;
    const bottomY = r * 0.3;
    const midY = -r * 0.1;
    const wingX = r * 0.5;
    ctx.moveTo(0, topY);
    ctx.lineTo(wingX, midY);
    ctx.lineTo(0, bottomY);
    ctx.lineTo(-wingX, midY);
  }
  ctx.closePath();
};

// ── ReuleauxTriangle: constant-width curve ──────────────────────────
// Three circular arcs connecting the vertices of an equilateral triangle.

export const drawReuleauxTriangle: DrawFunction = (ctx, size, config) => {
  const r = size / 2;
  // Vertices of equilateral triangle
  const verts = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    verts.push({ x: Math.cos(angle) * r * 0.7, y: Math.sin(angle) * r * 0.7 });
  }
  // Side length = distance between vertices
  const sideLen = Math.hypot(verts[1].x - verts[0].x, verts[1].y - verts[0].y);

  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const from = verts[(i + 1) % 3];
    const to = verts[(i + 2) % 3];
    const center = verts[i];
    const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
    const endAngle = Math.atan2(to.y - center.y, to.x - center.x);
    if (i === 0) ctx.moveTo(from.x, from.y);
    ctx.arc(center.x, center.y, sideLen, startAngle, endAngle);
  }
  ctx.closePath();
};

// ── DotCluster: cloud of dots in a bounded region ───────────────────
// Hash controls density, spread, and clustering.

export const drawDotCluster: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const dotCount = 15 + Math.floor(rng() * 25); // 15-39 dots
  const clusterTightness = 0.3 + rng() * 0.5;

  ctx.beginPath();
  for (let i = 0; i < dotCount; i++) {
    // Gaussian-ish distribution via Box-Muller approximation
    const u1 = Math.max(0.001, rng());
    const u2 = rng();
    const mag = Math.sqrt(-2 * Math.log(u1)) * clusterTightness;
    const angle = u2 * Math.PI * 2;
    const dx = Math.cos(angle) * mag * r;
    const dy = Math.sin(angle) * mag * r;
    const dotR = r * (0.02 + rng() * 0.04);
    ctx.moveTo(dx + dotR, dy);
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
  }
};

// ── CrosshatchPatch: bounded region filled with directional lines ───
// Like an engraving or etching mark.

export const drawCrosshatchPatch: DrawFunction = (ctx, size, config) => {
  const rng: () => number = config?.rng ?? Math.random;
  const r = size / 2;
  const angle1 = rng() * Math.PI;
  const angle2 = angle1 + Math.PI / 2 + (rng() - 0.5) * 0.3;
  const spacing = r * (0.08 + rng() * 0.08);
  const hasCross = rng() < 0.6;

  // Draw bounding shape (ellipse)
  const rx = r * (0.7 + rng() * 0.3);
  const ry = r * (0.5 + rng() * 0.3);

  // Outer boundary
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

  // Hatch lines clipped to the ellipse
  const cos1 = Math.cos(angle1);
  const sin1 = Math.sin(angle1);
  for (let d = -r; d <= r; d += spacing) {
    const lx1 = d * cos1 - r * sin1;
    const ly1 = d * sin1 + r * cos1;
    const lx2 = d * cos1 + r * sin1;
    const ly2 = d * sin1 - r * cos1;
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
  }

  if (hasCross) {
    const cos2 = Math.cos(angle2);
    const sin2 = Math.sin(angle2);
    for (let d = -r; d <= r; d += spacing * 1.3) {
      const lx1 = d * cos2 - r * sin2;
      const ly1 = d * sin2 + r * cos2;
      const lx2 = d * cos2 + r * sin2;
      const ly2 = d * sin2 - r * cos2;
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
    }
  }
};

// ── Shape registry ──────────────────────────────────────────────────

export const proceduralShapes: Record<string, DrawFunction> = {
  blob: drawBlob,
  ngon: drawNgon,
  lissajous: drawLissajous,
  superellipse: drawSuperellipse,
  spirograph: drawSpirograph,
  waveRing: drawWaveRing,
  rose: drawRose,
  shardField: drawShardField,
  voronoiCell: drawVoronoiCell,
  crescent: drawCrescent,
  tendril: drawTendril,
  cloudForm: drawCloudForm,
  inkSplat: drawInkSplat,
  geodesicDome: drawGeodesicDome,
  penroseTile: drawPenroseTile,
  reuleauxTriangle: drawReuleauxTriangle,
  dotCluster: drawDotCluster,
  crosshatchPatch: drawCrosshatchPatch,
};
