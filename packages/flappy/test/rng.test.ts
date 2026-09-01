import { describe, expect, it } from "vitest";
import { gaussian, mulberry32 } from "../src/rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).not.toEqual(sequenceB);
  });

  it("matches the reference mulberry32 sequence", () => {
    const rng = mulberry32(42);
    expect([rng(), rng(), rng()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });

  it("accepts negative seeds via unsigned coercion", () => {
    const rng = mulberry32(-1);
    expect([rng(), rng(), rng()]).toEqual([
      0.8964226141106337, 0.189478256739676, 0.7156526781618595,
    ]);
  });
});

describe("gaussian", () => {
  it("has mean near zero and deviation near one over many samples", () => {
    const rng = mulberry32(7);
    let sum = 0;
    let sumSquares = 0;
    const count = 10000;
    for (let i = 0; i < count; i++) {
      const value = gaussian(rng);
      sum += value;
      sumSquares += value * value;
    }
    const mean = sum / count;
    const deviation = Math.sqrt(sumSquares / count - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(deviation - 1)).toBeLessThan(0.05);
  });

  it("is deterministic under a seeded rng", () => {
    expect(gaussian(mulberry32(3))).toBe(gaussian(mulberry32(3)));
  });

  it("redraws until the first uniform sample is nonzero", () => {
    const draws = [0, 0.3, 0.25];
    let calls = 0;
    const stub = () => draws[calls++];
    expect(gaussian(stub)).toBeCloseTo(
      Math.sqrt(-2 * Math.log(0.3)) * Math.cos(2 * Math.PI * 0.25),
      10,
    );
    expect(calls).toBe(3);
  });
});
