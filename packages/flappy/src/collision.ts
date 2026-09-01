import {
  BIRD_HEIGHT,
  BIRD_WIDTH,
  BIRD_X,
  GROUND_HEIGHT,
  SCREEN_HEIGHT,
  TUBE_GAP,
  TUBE_WIDTH,
} from "./constants";
import type { Bird, Tube } from "./types";

export function birdHitsTube(birdYPosition: number, tube: Tube): boolean {
  const overlapsBirdX =
    tube.position < BIRD_X + BIRD_WIDTH / 2 &&
    tube.position > BIRD_X - TUBE_WIDTH - BIRD_WIDTH / 2;
  const hitsLowerTube =
    birdYPosition > SCREEN_HEIGHT - tube.height - BIRD_HEIGHT / 2;
  const hitsUpperTube =
    birdYPosition < SCREEN_HEIGHT - (tube.height + TUBE_GAP) + BIRD_HEIGHT / 2;
  return overlapsBirdX && (hitsLowerTube || hitsUpperTube);
}

export function birdHitsGround(birdYPosition: number): boolean {
  return birdYPosition > SCREEN_HEIGHT - BIRD_HEIGHT / 2 - GROUND_HEIGHT;
}

export function checkCollision(bird: Bird, tubes: readonly Tube[]): boolean {
  for (const tube of tubes) {
    if (birdHitsTube(bird.yPosition, tube)) {
      return true;
    }
  }
  return birdHitsGround(bird.yPosition);
}
