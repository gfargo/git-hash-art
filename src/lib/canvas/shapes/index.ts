import { basicShapes } from "./basic";
import { complexShapes } from "./complex";
import { sacredShapes } from "./sacred";
import { proceduralShapes } from "./procedural";

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  size: number,
  config?: any,
) => void;

export const shapes: Record<string, DrawFunction> = {
  ...basicShapes,
  ...complexShapes,
  ...sacredShapes,
  ...proceduralShapes,
};
