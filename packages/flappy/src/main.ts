import { startGame } from "./game";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
if (!canvas) {
  throw new Error("Canvas element #canvas not found");
}

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Failed to acquire 2D rendering context");
}

startGame(canvas, context);
