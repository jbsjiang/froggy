import { describe, expect, it } from "vitest";
import { birdHitsGround, birdHitsTube, checkCollision } from "../src/collision";
import {
  BIRD_HEIGHT,
  BIRD_WIDTH,
  BIRD_X,
  SCREEN_HEIGHT,
  TUBE_GAP,
  TUBE_WIDTH,
} from "../src/constants";
import type { Bird, Tube } from "../src/types";

const TUBE_X = 240;
const LOWER_TUBE_Y = SCREEN_HEIGHT - 200 - 10;

function makeBird(yPosition: number): Bird {
  return { yPosition, yVelocity: 0 };
}

function makeTube(position: number, height: number): Tube {
  return { position, height, scored: false };
}

describe("birdHitsTube", () => {
  it("hits the lower tube when below the gap", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(SCREEN_HEIGHT - 200 - 10, tube)).toBe(true);
  });

  it("hits the upper tube when above the gap", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(SCREEN_HEIGHT - 200 - 175 + 10, tube)).toBe(true);
  });

  it("passes cleanly through the middle of the gap", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(SCREEN_HEIGHT - 200 - 175 / 2, tube)).toBe(false);
  });

  it("ignores tubes that do not overlap the bird horizontally", () => {
    const tube = makeTube(400, 200);
    expect(birdHitsTube(SCREEN_HEIGHT - 200 - 10, tube)).toBe(false);
  });

  it("excludes a tube exactly at the leading horizontal edge", () => {
    const tube = makeTube(BIRD_X + BIRD_WIDTH / 2, 200);
    expect(birdHitsTube(LOWER_TUBE_Y, tube)).toBe(false);
  });

  it("excludes a tube exactly at the trailing horizontal edge", () => {
    const tube = makeTube(BIRD_X - TUBE_WIDTH - BIRD_WIDTH / 2, 200);
    expect(birdHitsTube(LOWER_TUBE_Y, tube)).toBe(false);
  });

  it("overlaps tubes between the trailing edge and the bird column", () => {
    const tube = makeTube(BIRD_X - TUBE_WIDTH + BIRD_WIDTH / 2, 200);
    expect(birdHitsTube(LOWER_TUBE_Y, tube)).toBe(true);
  });

  it("misses the lower tube exactly at the gap boundary", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(SCREEN_HEIGHT - 200 - BIRD_HEIGHT / 2, tube)).toBe(
      false,
    );
  });

  it("misses the upper tube exactly at the gap boundary", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(
      birdHitsTube(SCREEN_HEIGHT - (200 + TUBE_GAP) + BIRD_HEIGHT / 2, tube),
    ).toBe(false);
  });

  it("treats the lower band inside the gap as clear", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(400, tube)).toBe(false);
  });

  it("treats the upper band inside the gap as clear", () => {
    const tube = makeTube(TUBE_X, 200);
    expect(birdHitsTube(300, tube)).toBe(false);
  });
});

describe("birdHitsGround", () => {
  it("hits the ground below the ground line", () => {
    expect(birdHitsGround(SCREEN_HEIGHT - 80)).toBe(true);
  });

  it("does not hit the ground above the ground line", () => {
    expect(birdHitsGround(SCREEN_HEIGHT - 80 - 40)).toBe(false);
  });

  it("does not hit the ground exactly at the ground line", () => {
    expect(birdHitsGround(SCREEN_HEIGHT - BIRD_HEIGHT / 2 - 80)).toBe(false);
  });
});

describe("checkCollision", () => {
  it("returns true on tube contact", () => {
    const bird = makeBird(SCREEN_HEIGHT - 200 - 10);
    expect(checkCollision(bird, [makeTube(TUBE_X, 200)])).toBe(true);
  });

  it("returns true on ground contact with no tubes nearby", () => {
    const bird = makeBird(SCREEN_HEIGHT - 80);
    expect(checkCollision(bird, [makeTube(400, 200)])).toBe(true);
  });

  it("returns false on a clean mid-gap pass", () => {
    const bird = makeBird(SCREEN_HEIGHT - 200 - 175 / 2);
    expect(checkCollision(bird, [makeTube(TUBE_X, 200)])).toBe(false);
  });
});
