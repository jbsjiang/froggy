import {
  FLAP_ANIMATION_INTERVAL,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_VELOCITY,
} from "./constants";
import type { Bird, GameState } from "./types";

const FLAP_SEQUENCE = [0, 1, 2, 1];

export function birdAnimationFrame(
  animationStep: number,
  state: GameState,
): number {
  if (state === "gameOver") {
    return 1;
  }
  const index =
    Math.floor(animationStep / FLAP_ANIMATION_INTERVAL) % FLAP_SEQUENCE.length;
  return FLAP_SEQUENCE[index];
}

export function updateBird(bird: Bird, dt: number, flap: boolean): void {
  if (flap) {
    bird.yVelocity = -JUMP_VELOCITY;
  } else {
    bird.yVelocity = Math.min(bird.yVelocity + GRAVITY * dt, MAX_VELOCITY);
  }
  bird.yPosition += bird.yVelocity * dt;
}

export function birdRotation(yVelocity: number, state: GameState): number {
  if (state === "start") {
    return 0;
  }
  if (yVelocity > 9) {
    return (yVelocity - 9) * 15;
  }
  return -20;
}
