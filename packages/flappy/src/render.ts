import {
  BIRD_X,
  FONT_HEIGHT,
  FONT_SPACING,
  FONT_WIDTH,
  GROUND_HEIGHT,
  GROUND_TILE_WIDTH,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TUBE_CAP_HEIGHT,
  TUBE_CAP_OVERHANG,
  TUBE_CAP_WIDTH,
  TUBE_GAP,
  TUBE_WIDTH,
} from "./constants";
import { birdAnimationFrame, birdRotation } from "./physics";
import type { Bird, GameState, Textures, Tube } from "./types";

export function drawScene(
  context: CanvasRenderingContext2D,
  textures: Textures,
  tubes: readonly Tube[],
): void {
  context.fillStyle = "#67BEC6";
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.drawImage(textures.background, 0, 380);
  context.fillStyle = "#7ADE86";
  context.fillRect(0, 530, SCREEN_WIDTH, 45);
  drawTubes(context, textures, tubes);
}

export function drawGround(
  context: CanvasRenderingContext2D,
  textures: Textures,
  groundOffset: number,
): void {
  context.fillStyle = "#D9D18F";
  context.fillRect(
    0,
    SCREEN_HEIGHT - GROUND_HEIGHT,
    SCREEN_WIDTH,
    GROUND_HEIGHT,
  );
  context.drawImage(
    textures.ground,
    -groundOffset,
    SCREEN_HEIGHT - GROUND_HEIGHT,
    SCREEN_WIDTH + GROUND_TILE_WIDTH,
    28,
  );
}

export function drawTubes(
  context: CanvasRenderingContext2D,
  textures: Textures,
  tubes: readonly Tube[],
): void {
  for (const tube of tubes) {
    context.drawImage(
      textures.tubeTop,
      tube.position - TUBE_CAP_OVERHANG,
      SCREEN_HEIGHT - tube.height,
      TUBE_CAP_WIDTH,
      TUBE_CAP_HEIGHT,
    );
    context.scale(1, -1);
    context.drawImage(
      textures.tubeTop,
      tube.position - TUBE_CAP_OVERHANG,
      -(SCREEN_HEIGHT - tube.height - TUBE_GAP),
      TUBE_CAP_WIDTH,
      TUBE_CAP_HEIGHT,
    );
    context.scale(1, -1);
    context.drawImage(
      textures.tubeBody,
      tube.position,
      SCREEN_HEIGHT - tube.height + TUBE_CAP_HEIGHT,
      TUBE_WIDTH,
      tube.height - GROUND_HEIGHT,
    );
    context.drawImage(
      textures.tubeBody,
      tube.position,
      0,
      TUBE_WIDTH,
      SCREEN_HEIGHT - tube.height - TUBE_GAP - TUBE_CAP_HEIGHT,
    );
  }
}

export function drawBird(
  context: CanvasRenderingContext2D,
  textures: Textures,
  bird: Bird,
  state: GameState,
  animationStep: number,
): void {
  const x = BIRD_X;
  const y = bird.yPosition;
  const texture =
    textures.birdFrames[birdAnimationFrame(animationStep, state)] ??
    textures.birdFrames[0];
  const width = texture.width;
  const height = texture.height;
  const rotation = birdRotation(bird.yVelocity, state);

  context.save();
  context.translate(x, y);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(texture, -width / 2, -height / 2, width, height);
  context.restore();
}

export function drawScore(
  context: CanvasRenderingContext2D,
  fontBitmap: HTMLImageElement,
  score: number,
): void {
  const text = score.toString();
  const x = Math.floor(
    SCREEN_WIDTH / 2 -
      (text.length * FONT_WIDTH + (text.length - 1) * FONT_SPACING) / 2,
  );
  for (let i = 0; i < text.length; i++) {
    context.drawImage(
      fontBitmap,
      (text.charCodeAt(i) - 48) * FONT_WIDTH,
      0,
      FONT_WIDTH,
      FONT_HEIGHT,
      x + i * (FONT_WIDTH + FONT_SPACING),
      60,
      FONT_WIDTH,
      FONT_HEIGHT,
    );
  }
}
