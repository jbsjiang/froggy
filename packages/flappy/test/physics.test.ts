import { describe, expect, it } from "vitest";
import {
  FLAP_ANIMATION_INTERVAL,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_VELOCITY,
} from "../src/constants";
import { birdAnimationFrame, birdRotation, updateBird } from "../src/physics";
import type { Bird } from "../src/types";

function makeBird(): Bird {
  return { yPosition: 320, yVelocity: 0 };
}

describe("updateBird", () => {
  it("accumulates gravity over frames", () => {
    const bird = makeBird();
    updateBird(bird, 1, false);
    expect(bird.yVelocity).toBe(GRAVITY);
    updateBird(bird, 1, false);
    expect(bird.yVelocity).toBe(GRAVITY * 2);
  });

  it("flap sets upward jump velocity regardless of current velocity", () => {
    const bird = makeBird();
    bird.yVelocity = 8;
    updateBird(bird, 1, true);
    expect(bird.yVelocity).toBe(-JUMP_VELOCITY);
  });

  it("clamps falling speed to terminal velocity", () => {
    const bird = makeBird();
    updateBird(bird, 100, false);
    expect(bird.yVelocity).toBe(MAX_VELOCITY);
  });

  it("flap does not clamp the jump velocity", () => {
    const bird = makeBird();
    updateBird(bird, 1, true);
    expect(bird.yVelocity).toBe(-JUMP_VELOCITY);
  });

  it("scales gravity and position by dt (units of 60fps frames)", () => {
    const birdA = makeBird();
    const birdB = makeBird();
    updateBird(birdA, 1, false);
    updateBird(birdB, 2, false);
    expect(birdB.yVelocity).toBe(birdA.yVelocity * 2);
    expect(birdA.yPosition).toBe(320 + GRAVITY);
    expect(birdB.yPosition).toBeCloseTo(320 + GRAVITY * 2 * 2, 10);
  });

  it("moves position by velocity times dt", () => {
    const bird = makeBird();
    updateBird(bird, 0, false);
    expect(bird.yPosition).toBe(320);
    bird.yVelocity = 10;
    updateBird(bird, 2, false);
    expect(bird.yPosition).toBe(320 + (10 + GRAVITY * 2) * 2);
  });
});

describe("birdAnimationFrame", () => {
  it("shows the resting frame on game over", () => {
    expect(birdAnimationFrame(0, "gameOver")).toBe(1);
    expect(birdAnimationFrame(4 * FLAP_ANIMATION_INTERVAL, "gameOver")).toBe(1);
  });

  it("steps through the flap sequence at the animation interval", () => {
    expect(birdAnimationFrame(0, "running")).toBe(0);
    expect(birdAnimationFrame(FLAP_ANIMATION_INTERVAL, "running")).toBe(1);
    expect(birdAnimationFrame(2 * FLAP_ANIMATION_INTERVAL, "running")).toBe(2);
    expect(birdAnimationFrame(3 * FLAP_ANIMATION_INTERVAL, "running")).toBe(1);
    expect(birdAnimationFrame(4 * FLAP_ANIMATION_INTERVAL, "running")).toBe(0);
  });

  it("holds each frame across the flap interval", () => {
    expect(birdAnimationFrame(2, "running")).toBe(0);
    expect(birdAnimationFrame(FLAP_ANIMATION_INTERVAL + 2, "running")).toBe(1);
    expect(birdAnimationFrame(2 * FLAP_ANIMATION_INTERVAL + 2, "running")).toBe(
      2,
    );
    expect(birdAnimationFrame(3 * FLAP_ANIMATION_INTERVAL + 2, "running")).toBe(
      1,
    );
  });
});

describe("birdRotation", () => {
  it("is level on the start screen", () => {
    expect(birdRotation(0, "start")).toBe(0);
    expect(birdRotation(15, "start")).toBe(0);
  });

  it("tilts up while gliding", () => {
    expect(birdRotation(0, "running")).toBe(-20);
    expect(birdRotation(9, "running")).toBe(-20);
  });

  it("tilts down proportionally past velocity 9", () => {
    expect(birdRotation(10, "running")).toBe(15);
    expect(birdRotation(15, "running")).toBe(90);
  });
});
