interface Point {
  x: number;
  y: number;
}

interface ShapeConfig {
  rotation?: number;
  lineWidth: number;
  strokeStyle: string;
  fillStyle: string;
}

interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: string;
  type: string;
}

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;

export const applyTransforms = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config: ShapeConfig,
): void => {
  ctx.save();
  ctx.translate(0, 0);
  if (config.rotation) {
    ctx.rotate(degToRad(config.rotation));
  }
  ctx.lineWidth = config.lineWidth;
  ctx.strokeStyle = config.strokeStyle;
  ctx.fillStyle = config.fillStyle;
};

export const restoreContext = (ctx: CanvasRenderingContext2D): void => {
  ctx.restore();
};

// Animation configuration stub for future use
export const createAnimationConfig = (type: string): AnimationConfig => ({
  enabled: false,
  duration: 1000,
  easing: "linear",
  type,
  // Add more animation-specific properties as needed
});

export const createCirclePoints = (
  cx: number,
  cy: number,
  radius: number,
  segments: number,
): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return points;
};
