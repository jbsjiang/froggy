import {
  BIRD_X,
  SCREEN_WIDTH,
  SPEED,
  TUBE_CAP_WIDTH,
  TUBE_COUNT,
  TUBE_MAX_HEIGHT,
  TUBE_MIN_HEIGHT,
  TUBE_WIDTH,
} from "./constants";
import type { Tube } from "./types";

export function randomTubeHeight(rng: () => number = Math.random): number {
  return (
    TUBE_MIN_HEIGHT + Math.floor(rng() * (TUBE_MAX_HEIGHT - TUBE_MIN_HEIGHT))
  );
}

export function createTubes(rng: () => number = Math.random): Tube[] {
  const tubes: Tube[] = [];
  for (let i = 0; i < TUBE_COUNT; i++) {
    tubes.push({
      position: SCREEN_WIDTH * 2 + ((SCREEN_WIDTH + TUBE_WIDTH + 8) / 2) * i,
      height: randomTubeHeight(rng),
      scored: false,
    });
  }
  return tubes;
}

export function updateTubes(
  tubes: Tube[],
  dt: number,
  rng: () => number = Math.random,
): number {
  let newScored = 0;
  for (const tube of tubes) {
    tube.position -= SPEED * dt;
    if (!tube.scored && tube.position + TUBE_WIDTH / 2 < BIRD_X) {
      tube.scored = true;
      newScored++;
    }
    if (tube.position < -TUBE_CAP_WIDTH) {
      tube.position =
        SCREEN_WIDTH +
        8 -
        ((-tube.position - TUBE_WIDTH + 8) % (SCREEN_WIDTH + TUBE_WIDTH));
      tube.height = randomTubeHeight(rng);
      tube.scored = false;
    }
  }
  return newScored;
}
