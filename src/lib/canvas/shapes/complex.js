import { defaultShapeConfig } from "../../constants";
import { applyTransforms, createCirclePoints, restoreContext } from "./utils";

export const ShapeConfigs = {
  platonic: {
    tetrahedron: { vertices: 4, faces: 4 },
    cube: { vertices: 8, faces: 6 },
    octahedron: { vertices: 6, faces: 8 },
    dodecahedron: { vertices: 20, faces: 12 },
    icosahedron: { vertices: 12, faces: 20 },
  },
  fibonacci: {
    iterations: 13,
    growthFactor: 1.618034, // Golden ratio
  },
  goldenRatio: {
    iterations: 8,
    ratio: 1.618034,
  },
};

export const drawPlatonicSolid = (ctx, size, type, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const { 
    vertices, 
    // faces 
  } = ShapeConfigs.platonic[type];
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

export const drawFibonacciSpiral = (ctx, size, config = {}) => {
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

export const drawIslamicPattern = (ctx, size, config = {}) => {
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
        const angle = (k / 8) * Math.PI * 2;
        const x1 = x + Math.cos(angle) * radius;
        const y1 = y + Math.sin(angle) * radius;
        if (k === 0) {
          ctx.moveTo(x1, y1);
        } else {
          ctx.lineTo(x1, y1);
        }
      }
      ctx.closePath();
    }
  }

  if (finalConfig.fillStyle !== "transparent") {
    ctx.fill();
  }
  ctx.stroke();
  restoreContext(ctx);
};

export const drawCelticKnot = (ctx, size, config = {}) => {
  const finalConfig = { ...defaultShapeConfig, ...config };
  applyTransforms(ctx, size, finalConfig);

  const gridSize = 4;
  const unit = size / gridSize;

  const drawKnotSegment = (x, y, type) => {
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
          y + unit
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

export const drawMerkaba = (ctx, size, config = {}) => {
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

export const complexShapes = {
  platonicSolid: (ctx, size, type = "tetrahedron", config) =>
    drawPlatonicSolid(ctx, size, type, config),
  fibonacciSpiral: (ctx, size, config) =>
    drawFibonacciSpiral(ctx, size, config),
  islamicPattern: (ctx, size, config) => drawIslamicPattern(ctx, size, config),
  celticKnot: (ctx, size, config) => drawCelticKnot(ctx, size, config),
  merkaba: (ctx, size, config) => drawMerkaba(ctx, size, config),
};
