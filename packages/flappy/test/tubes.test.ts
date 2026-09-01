import { describe, expect, it } from "vitest";
import {
  BIRD_X,
  SCREEN_WIDTH,
  SPEED,
  TUBE_CAP_WIDTH,
  TUBE_MAX_HEIGHT,
  TUBE_MIN_HEIGHT,
  TUBE_WIDTH,
} from "../src/constants";
import { createTubes, randomTubeHeight, updateTubes } from "../src/tubes";
import type { Tube } from "../src/types";

describe("randomTubeHeight", () => {
  it("stays within [TUBE_MIN_HEIGHT, TUBE_MAX_HEIGHT] across the rng range", () => {
    for (let r = 0; r < 1; r += 0.001) {
      const height = randomTubeHeight(() => r);
      expect(height).toBeGreaterThanOrEqual(TUBE_MIN_HEIGHT);
      expect(height).toBeLessThanOrEqual(TUBE_MAX_HEIGHT);
    }
  });

  it("reaches the range endpoints", () => {
    expect(randomTubeHeight(() => 0)).toBe(TUBE_MIN_HEIGHT);
    expect(randomTubeHeight(() => 0.999999999)).toBe(TUBE_MAX_HEIGHT - 1);
  });
});

describe("createTubes", () => {
  it("creates spaced tubes with heights in range and unscored", () => {
    const tubes = createTubes(() => 0.5);
    expect(tubes).toHaveLength(2);
    expect(tubes[0].position).toBe(SCREEN_WIDTH * 2);
    expect(tubes[1].position).toBe(
      SCREEN_WIDTH * 2 + (SCREEN_WIDTH + TUBE_WIDTH + 8) / 2,
    );
    for (const tube of tubes) {
      expect(tube.height).toBeGreaterThanOrEqual(TUBE_MIN_HEIGHT);
      expect(tube.height).toBeLessThanOrEqual(TUBE_MAX_HEIGHT);
      expect(tube.scored).toBe(false);
    }
  });
});

describe("updateTubes", () => {
  function makeTube(position: number, scored = false): Tube {
    return { position, height: 200, scored };
  }

  it("scrolls tubes left by SPEED * dt", () => {
    const tube = makeTube(400);
    updateTubes([tube], 2);
    expect(tube.position).toBe(394);
  });

  it("scores a tube exactly once when its center passes mid-screen", () => {
    const tube = makeTube(SCREEN_WIDTH / 2 - TUBE_WIDTH / 2 + 5);
    expect(updateTubes([tube], 1)).toBe(0);
    expect(updateTubes([tube], 1)).toBe(1);
    expect(updateTubes([tube], 1)).toBe(0);
    expect(tube.scored).toBe(true);
  });

  it("scores even when a large dt jumps past the scoring point", () => {
    const tube = makeTube(SCREEN_WIDTH / 2 - TUBE_WIDTH / 2 + 5);
    expect(updateTubes([tube], 5)).toBe(1);
    expect(updateTubes([tube], 5)).toBe(0);
  });

  it("recycles off-screen tubes to the right with a new height and unscored flag", () => {
    const tube = makeTube(-(TUBE_WIDTH + 8) - 0.5, true);
    updateTubes([tube], 0.1, () => 0);
    expect(tube.position).toBeCloseTo(SCREEN_WIDTH + 8 - 16.8, 5);
    expect(tube.position).toBeGreaterThan(SCREEN_WIDTH - TUBE_WIDTH);
    expect(tube.height).toBe(TUBE_MIN_HEIGHT);
    expect(tube.scored).toBe(false);
  });

  it("recycled tube can score again on its next pass", () => {
    const tube = makeTube(-(TUBE_WIDTH + 8) - 0.5, true);
    updateTubes([tube], 0.1, () => 0);
    let scored = 0;
    for (let i = 0; i < 200 && scored === 0; i++) {
      scored += updateTubes([tube], 1, () => 0);
    }
    expect(scored).toBe(1);
    expect(tube.scored).toBe(true);
  });

  it("does not score a tube whose center lands exactly on the bird", () => {
    const tube = makeTube(BIRD_X - TUBE_WIDTH / 2 + SPEED);
    expect(updateTubes([tube], 1)).toBe(0);
    expect(tube.scored).toBe(false);
    expect(updateTubes([tube], 1)).toBe(1);
  });

  it("does not recycle a tube exactly at the cap boundary", () => {
    const tube = makeTube(-TUBE_CAP_WIDTH + SPEED);
    updateTubes([tube], 1, () => 0);
    expect(tube.position).toBe(-TUBE_CAP_WIDTH);
    expect(tube.height).toBe(200);
  });

  it("wraps the recycle offset within the scroll span", () => {
    const tube = makeTube(-697, true);
    updateTubes([tube], 1, () => 0);
    expect(tube.position).toBe(
      SCREEN_WIDTH + 8 - (620 % (SCREEN_WIDTH + TUBE_WIDTH)),
    );
    expect(tube.height).toBe(TUBE_MIN_HEIGHT);
    expect(tube.scored).toBe(false);
  });
});
