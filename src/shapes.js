export const drawCircle = (ctx, size) => {
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
};

export const drawSquare = (ctx, size) => {
  ctx.beginPath();
  ctx.rect(-size / 2, -size / 2, size, size);
};

export const drawTriangle = (ctx, size) => {
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, size / 2);
  ctx.closePath();
};

export const drawHexagon = (ctx, size) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 8) * i;
    const x = (size / 2) * Math.cos(angle);
    const y = (size / 2) * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

export const drawStar = (ctx, size) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 5 + (Math.PI / 5) * i * 3;
    const radius = i % 2 === 0 ? size / 2 : size / 4;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

export const drawJackedStar = (ctx, size) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 30 + (Math.PI / 30) * i * 8;
    const radius = i % 2 === 0 ? size / 2 : size / 8;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

export const drawHeart = (ctx, size) => {
  ctx.beginPath();
  ctx.moveTo(0, size / 4);
  ctx.quadraticCurveTo(size / 2, size / 4, 0, -size / 4);
  ctx.quadraticCurveTo(-size / 2, size / 4, 0, size / 4);
};

export const drawDiamond = (ctx, size) => {
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(size / 2, 0);
  ctx.lineTo(0, size / 2);
  ctx.lineTo(-size / 2, 0);
  ctx.closePath();
};

export const drawCube = (ctx, size) => {
  ctx.beginPath();
  ctx.moveTo(-size / 2, -size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.lineTo(size / 2, size / 2);
  ctx.lineTo(-size / 2, size / 2);
  ctx.closePath();
};

// Optional: Create a shape map for easier lookup
export const shapes = {
  circle: drawCircle,
  square: drawSquare,
  triangle: drawTriangle,
  hexagon: drawHexagon,
  star: drawStar,
  "jacked-star": drawJackedStar,
  heart: drawHeart,
  diamond: drawDiamond,
  cube: drawCube
};