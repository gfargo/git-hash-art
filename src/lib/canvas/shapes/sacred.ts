import { createCirclePoints } from "./utils";

type DrawFunction = (ctx: CanvasRenderingContext2D, size: number) => void;

interface Point {
  x: number;
  y: number;
}

export const drawFlowerOfLife: DrawFunction = (ctx, size) => {
  const radius = size / 6;
  const centers: Point[] = [
    { x: 0, y: 0 },
    { x: radius * Math.sqrt(3), y: 0 },
    { x: (radius * Math.sqrt(3)) / 2, y: 1.5 * radius },
    { x: (-radius * Math.sqrt(3)) / 2, y: 1.5 * radius },
    { x: -radius * Math.sqrt(3), y: 0 },
    { x: (-radius * Math.sqrt(3)) / 2, y: -1.5 * radius },
    { x: (radius * Math.sqrt(3)) / 2, y: -1.5 * radius },
  ];

  ctx.beginPath();
  centers.forEach((center) => {
    ctx.moveTo(center.x + radius, center.y);
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  });
};

export const drawTreeOfLife: DrawFunction = (ctx, size) => {
  const radius = size / 12;
  const spacing = radius * 2.5;

  // Sephirot positions (traditional layout)
  const positions: Point[] = [
    { x: 0, y: -spacing * 2 }, // Kether
    { x: -spacing, y: -spacing }, // Chokmah
    { x: spacing, y: -spacing }, // Binah
    { x: -spacing, y: 0 }, // Chesed
    { x: spacing, y: 0 }, // Geburah
    { x: 0, y: 0 }, // Tiphereth
    { x: -spacing, y: spacing }, // Netzach
    { x: spacing, y: spacing }, // Hod
    { x: 0, y: spacing * 2 }, // Yesod
    { x: 0, y: spacing * 3 }, // Malkuth
  ];

  // Draw circles
  ctx.beginPath();
  positions.forEach((pos) => {
    ctx.moveTo(pos.x + radius, pos.y);
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  });

  // Draw connecting lines
  ctx.moveTo(positions[0].x, positions[0].y);
  positions.forEach((pos, i) => {
    if (i > 0) {
      positions.slice(i + 1).forEach((nextPos) => {
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(nextPos.x, nextPos.y);
      });
    }
  });
};

export const drawMetatronsCube: DrawFunction = (ctx, size) => {
  const radius = size / 3;

  // Create 13 points - one center and 12 vertices of an icosahedron

  // const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

  const vertices: Point[] = [
    { x: 0, y: 0 }, // Center point
    ...createCirclePoints(0, 0, radius, 6), // Inner hexagon
    ...createCirclePoints(0, 0, radius * 1.5, 6), // Outer hexagon
  ];

  ctx.beginPath();
  // Draw all connecting lines
  vertices.forEach((v1, i) => {
    vertices.slice(i + 1).forEach((v2) => {
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
    });
  });
};

export const drawSriYantra: DrawFunction = (ctx, size) => {
  const radius = size / 2;
  ctx.beginPath();

  // Draw outer triangles
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const x1 = Math.cos(angle) * radius;
    const y1 = Math.sin(angle) * radius;
    const x2 = Math.cos(angle + Math.PI / 9) * radius;
    const y2 = Math.sin(angle + Math.PI / 9) * radius;

    ctx.moveTo(0, 0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(0, 0);
  }

  // Draw inner triangles
  const innerRadius = radius * 0.6;
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + Math.PI / 18;
    const x1 = Math.cos(angle) * innerRadius;
    const y1 = Math.sin(angle) * innerRadius;
    const x2 = Math.cos(angle + Math.PI / 9) * innerRadius;
    const y2 = Math.sin(angle + Math.PI / 9) * innerRadius;

    ctx.moveTo(0, 0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(0, 0);
  }
};

export const drawSeedOfLife: DrawFunction = (ctx, size) => {
  const radius = size / 6;
  const centers: Point[] = [
    { x: 0, y: 0 },
    { x: radius * Math.sqrt(3), y: 0 },
    { x: (radius * Math.sqrt(3)) / 2, y: 1.5 * radius },
    { x: (-radius * Math.sqrt(3)) / 2, y: 1.5 * radius },
    { x: -radius * Math.sqrt(3), y: 0 },
    { x: (-radius * Math.sqrt(3)) / 2, y: -1.5 * radius },
    { x: (radius * Math.sqrt(3)) / 2, y: -1.5 * radius },
  ];

  ctx.beginPath();
  centers.forEach((center) => {
    ctx.moveTo(center.x + radius, center.y);
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  });
};

export const drawVesicaPiscis: DrawFunction = (ctx, size) => {
  const radius = size / 4;
  ctx.beginPath();
  ctx.arc(-radius / 2, 0, radius, 0, Math.PI * 2);
  ctx.arc(radius / 2, 0, radius, 0, Math.PI * 2);
};

export const drawTorus: DrawFunction = (ctx, size) => {
  const outerRadius = size / 2;
  const innerRadius = size / 4;
  const steps = 36;

  ctx.beginPath();
  for (let i = 0; i < steps; i++) {
    const angle1 = (i / steps) * Math.PI * 2;
    // const angle2 = ((i + 1) / steps) * Math.PI * 2;

    for (let j = 0; j < steps; j++) {
      const phi1 = (j / steps) * Math.PI * 2;
      const phi2 = ((j + 1) / steps) * Math.PI * 2;

      const x1 =
        (outerRadius + innerRadius * Math.cos(phi1)) * Math.cos(angle1);
      const y1 =
        (outerRadius + innerRadius * Math.cos(phi1)) * Math.sin(angle1);
      const x2 =
        (outerRadius + innerRadius * Math.cos(phi2)) * Math.cos(angle1);
      const y2 =
        (outerRadius + innerRadius * Math.cos(phi2)) * Math.sin(angle1);

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
  }
};

export const drawEggOfLife: DrawFunction = (ctx, size) => {
  const radius = size / 8;
  const centers: Point[] = [
    { x: 0, y: 0 },
    { x: radius * 2, y: 0 },
    { x: radius, y: radius * Math.sqrt(3) },
    { x: -radius, y: radius * Math.sqrt(3) },
    { x: -radius * 2, y: 0 },
    { x: -radius, y: -radius * Math.sqrt(3) },
    { x: radius, y: -radius * Math.sqrt(3) },
  ];

  ctx.beginPath();
  centers.forEach((center) => {
    ctx.moveTo(center.x + radius, center.y);
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  });
};

export const sacredShapes: Record<string, DrawFunction> = {
  flowerOfLife: drawFlowerOfLife,
  treeOfLife: drawTreeOfLife,
  metatronsCube: drawMetatronsCube,
  sriYantra: drawSriYantra,
  seedOfLife: drawSeedOfLife,
  vesicaPiscis: drawVesicaPiscis,
  torus: drawTorus,
  eggOfLife: drawEggOfLife,
};
