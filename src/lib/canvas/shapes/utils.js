export const degToRad = (degrees) => (degrees * Math.PI) / 180;

export const applyTransforms = (ctx, size, config) => {
  ctx.save();
  ctx.translate(0, 0);
  if (config.rotation) {
    ctx.rotate(degToRad(config.rotation));
  }
  ctx.lineWidth = config.lineWidth;
  ctx.strokeStyle = config.strokeStyle;
  ctx.fillStyle = config.fillStyle;
};

export const restoreContext = (ctx) => {
  ctx.restore();
};

// Animation configuration stub for future use
export const createAnimationConfig = (type) => ({
  enabled: false,
  duration: 1000,
  easing: "linear",
  type,
  // Add more animation-specific properties as needed
});

export const createCirclePoints = (cx, cy, radius, segments) => {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return points;
};
