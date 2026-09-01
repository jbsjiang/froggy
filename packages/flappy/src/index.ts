import { startGame } from "./game";

export function mountFlappy(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to acquire 2D rendering context");
  }
  return startGame(canvas, context);
}
