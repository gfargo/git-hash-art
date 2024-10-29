import { defaultShapeConfig } from "../../constants";
import { applyTransforms, createCirclePoints, restoreContext } from "./utils";

interface PlatonicSolidConfig {
  vertices: number;
  faces: number;
}

interface FibonacciConfig {
  iterations: number;
  growthFactor: number;
}

interface GoldenRatioConfig {
  iterations: number;
  ratio: number;
}

export const ShapeConfigs = {
  platonic: {
    tetrahedron: { vertices: 4, faces: 4 },
    cube: { vertices: 8, faces: 6 },
    octahedron: { vertices: 6, faces: 8 },
    dodecahedron: { vertices: 20, faces: 12 },
    icosahedron: { vertices: 12, faces: 20 },
  } as Record<string, PlatonicSolidConfig>,
  fibonacci: {
    iterations: 13,
    growthFactor: 1.618034, // Golden ratio
  } as FibonacciConfig,
  goldenRatio: {
    iterations: 8,
    ratio: 1.618034,
  } as GoldenRatioConfig,
};

interface ShapeConfig {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  rotation?: number;
  iterations?: number;
  animate?: boolean;
  type?: string;
}

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config?: ShapeConfig,
) => void;

export const drawPlatonicSolid: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const {
    vertices,
    // faces
  } = ShapeConfigs.platonic[config.type as keyof typeof ShapeConfigs.platonic];
  const radius = size / 2;

  // Calculate vertices based on platonic solid type
  const points = createCirclePoints(0, 0, radius, vertices);

  ctx.beginPath();
  // Draw edges between vertices
  points.forEach((p1, i) => {
    points.slice(i + 1).forEach((p2) => {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    });
  });

  if (finalConfig.fillStyle !== "transparent") {
    ctx.fill();
  }
  ctx.stroke();
  restoreContext(ctx);
};

export const drawFibonacciSpiral: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = {
    ...defaultShapeConfig,
    ...ShapeConfigs.fibonacci,
    ...config,
  };
  applyTransforms(ctx, size, finalConfig);

  let current = 1;
  let previous = 1;
  let scale = size / Math.pow(finalConfig.growthFactor, finalConfig.iterations);

  ctx.beginPath();
  for (let i = 0; i < finalConfig.iterations; i++) {
    const radius = scale * current;
    const centerX = radius / 2;
    const centerY = radius / 2;

    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI * 1.5);

    // Calculate next Fibonacci number
    const next = current + previous;
    previous = current;
    current = next;

    // Transform for next iteration
    ctx.translate(radius, 0);
    ctx.rotate(Math.PI / 2);
  }

  ctx.stroke();
  restoreContext(ctx);
};

export const drawIslamicPattern: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const gridSize = 8;
  const unit = size / gridSize;

  ctx.beginPath();
  // Create base grid
  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const x = (i - gridSize / 2) * unit;
      const y = (j - gridSize / 2) * unit;

      // Draw star pattern at each intersection
      const radius = unit / 2;
      for (let k = 0; k < 8; k++) {
        const angle = (Math.PI / 4) * k;
        const x1 = x + radius * Math.cos(angle);
        const y1 = y + radius * Math.sin(angle);
        const x2 = x + radius * Math.cos(angle + Math.PI / 4);
        const y2 = y + radius * Math.sin(angle + Math.PI / 4);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
    }
  }

  ctx.stroke();
  restoreContext(ctx);
};

export const drawCelticKnot: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const gridSize = 4;
  const unit = size / gridSize;

  const drawKnotSegment = (x: number, y: number, type: string) => {
    ctx.beginPath();
    switch (type) {
      case "over":
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + unit / 2,
          y,
          x + unit / 2,
          y + unit,
          x + unit,
          y + unit,
        );
        break;
      case "under":
        ctx.moveTo(x, y + unit);
        ctx.bezierCurveTo(x + unit / 2, y + unit, x + unit / 2, y, x + unit, y);
        break;
    }
    ctx.stroke();
  };

  // Create knot pattern
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = (i - gridSize / 2) * unit;
      const y = (j - gridSize / 2) * unit;
      drawKnotSegment(x, y, (i + j) % 2 === 0 ? "over" : "under");
    }
  }

  restoreContext(ctx);
};

export const drawMerkaba: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const radius = size / 2;

  // Draw two intersecting tetrahedra
  ctx.beginPath();
  // First tetrahedron
  const points1 = createCirclePoints(0, 0, radius, 3);
  points1.forEach((p1, i) => {
    points1.slice(i + 1).forEach((p2) => {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    });
  });

  // Second tetrahedron (rotated)
  ctx.rotate(Math.PI / 6);
  const points2 = createCirclePoints(0, 0, radius, 3);
  points2.forEach((p1, i) => {
    points2.slice(i + 1).forEach((p2) => {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    });
  });

  if (finalConfig.fillStyle !== "transparent") {
    ctx.fill();
  }
  ctx.stroke();
  restoreContext(ctx);
};

export const drawMandala: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const numCircles = 8;
  const numPoints = 16;
  const radius = size / 2;

  ctx.beginPath();
  for (let i = 1; i <= numCircles; i++) {
    const circleRadius = (radius / numCircles) * i;
    ctx.moveTo(circleRadius, 0);
    ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);

    for (let j = 0; j < numPoints; j++) {
      const angle = (Math.PI * 2 * j) / numPoints;
      const x = circleRadius * Math.cos(angle);
      const y = circleRadius * Math.sin(angle);
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  restoreContext(ctx);
};

export const drawFractal: DrawFunction = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config, iterations: 5 };
  applyTransforms(ctx, size, finalConfig);

  const drawBranch = (
    x: number,
    y: number,
    length: number,
    angle: number,
    depth: number,
  ) => {
    if (depth === 0) return;

    const endX = x + length * Math.cos(angle);
    const endY = y + length * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    drawBranch(endX, endY, length * 0.7, angle - Math.PI / 6, depth - 1);
    drawBranch(endX, endY, length * 0.7, angle + Math.PI / 6, depth - 1);
  };

  drawBranch(0, size / 2, size / 4, -Math.PI / 2, finalConfig.iterations);
  restoreContext(ctx);
};

export const complexShapes: Record<string, DrawFunction> = {
  platonicSolid: drawPlatonicSolid,
  fibonacciSpiral: drawFibonacciSpiral,
  islamicPattern: drawIslamicPattern,
  celticKnot: drawCelticKnot,
  merkaba: drawMerkaba,
  mandala: drawMandala,
  fractal: drawFractal,
};
