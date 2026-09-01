import { describe, expect, it } from "vitest";
import {
  BIRD_WIDTH,
  BIRD_X,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_VELOCITY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TUBE_COUNT,
  TUBE_GAP,
  TUBE_WIDTH,
} from "../src/constants";
import { LAYER_SIZES } from "../src/network";
import {
  allDead,
  combineFitness,
  createSim,
  networkInputs,
  populationFitnesses,
  stepPopulation,
  tubesAhead,
} from "../src/populationSim";
import { mulberry32 } from "../src/rng";
import type { Network, Tube } from "../src/types";

function zeroNetwork(): Network {
  return {
    layers: LAYER_SIZES.slice(1).map((size, layer) =>
      Array.from({ length: size }, () =>
        Array.from({ length: LAYER_SIZES[layer] + 1 }, () => 0),
      ),
    ),
    mutationRate: 0,
    mutationStrength: 0,
  };
}

function neverFlapNetwork(): Network {
  const network = zeroNetwork();
  network.layers[0][0][0] = 10;
  for (let layer = 1; layer < network.layers.length; layer++) {
    network.layers[layer][0][0] = layer === network.layers.length - 1 ? -2 : 10;
  }
  return network;
}

function tubeAt(position: number, height = 200): Tube {
  return { position, height, scored: false };
}

describe("tubesAhead", () => {
  it("returns only tubes past the bird's trailing edge, sorted left to right", () => {
    const ahead = tubesAhead([
      tubeAt(50),
      tubeAt(300),
      tubeAt(BIRD_X - TUBE_WIDTH - BIRD_WIDTH / 2 + 0.01),
      tubeAt(200),
    ]);
    expect(ahead.map((tube) => tube.position)).toEqual([
      BIRD_X - TUBE_WIDTH - BIRD_WIDTH / 2 + 0.01,
      200,
      300,
    ]);
  });

  it("excludes a tube exactly at the trailing edge", () => {
    const ahead = tubesAhead([
      tubeAt(BIRD_X - TUBE_WIDTH - BIRD_WIDTH / 2),
      tubeAt(300),
    ]);
    expect(ahead.map((tube) => tube.position)).toEqual([300]);
  });

  it("falls back to all tubes sorted by position when none are ahead", () => {
    const ahead = tubesAhead([tubeAt(50), tubeAt(10), tubeAt(100)]);
    expect(ahead.map((tube) => tube.position)).toEqual([10, 50, 100]);
  });
});

describe("networkInputs", () => {
  it("normalizes the bird state and each tube's position and gap center", () => {
    const inputs = networkInputs({ yPosition: 320, yVelocity: -7.5 }, [
      tubeAt(300, 220),
      tubeAt(400, 160),
    ]);
    expect(inputs).toEqual([
      320 / SCREEN_HEIGHT,
      -7.5 / MAX_VELOCITY,
      (300 - BIRD_X) / SCREEN_WIDTH,
      (SCREEN_HEIGHT - 220 - TUBE_GAP / 2) / SCREEN_HEIGHT,
      (400 - BIRD_X) / SCREEN_WIDTH,
      (SCREEN_HEIGHT - 160 - TUBE_GAP / 2) / SCREEN_HEIGHT,
    ]);
  });

  it("reuses the last tube when fewer tubes are ahead than input slots", () => {
    const inputs = networkInputs({ yPosition: 320, yVelocity: 0 }, [
      tubeAt(300, 220),
    ]);
    expect(inputs).toHaveLength(2 + TUBE_COUNT * 2);
    expect(inputs[2]).toBe((300 - BIRD_X) / SCREEN_WIDTH);
    expect(inputs[3]).toBe(
      (SCREEN_HEIGHT - 220 - TUBE_GAP / 2) / SCREEN_HEIGHT,
    );
    expect(inputs[4]).toBe(inputs[2]);
    expect(inputs[5]).toBe(inputs[3]);
  });
});

describe("createSim", () => {
  it("starts every bird alive at mid-screen with zero score", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(1));
    expect(sim.population).toHaveLength(1);
    const entry = sim.population[0];
    expect(entry.alive).toBe(true);
    expect(entry.score).toBe(0);
    expect(entry.alignment).toBe(0);
    expect(entry.framesSurvived).toBe(0);
    expect(entry.bird.yPosition).toBe(SCREEN_HEIGHT / 2);
    expect(allDead(sim)).toBe(false);
  });
});

describe("stepPopulation", () => {
  it("kills a never-flapping bird on the ground", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(2));
    const rng = mulberry32(3);
    for (let i = 0; i < 600 && !allDead(sim); i++) {
      stepPopulation(sim, 1, rng);
    }
    expect(allDead(sim)).toBe(true);
  });

  it("adds the newly scored tube count to every alive bird", () => {
    const sim = createSim(
      [neverFlapNetwork(), neverFlapNetwork()],
      mulberry32(4),
    );
    sim.tubes[0].position = SCREEN_WIDTH / 2 - TUBE_WIDTH / 2 - 1;
    stepPopulation(sim, 1, mulberry32(5));
    for (const entry of sim.population) {
      expect(entry.score).toBe(1);
    }
  });

  it("accrues more alignment credit near the gap center than at the ceiling", () => {
    const sim = createSim(
      [neverFlapNetwork(), neverFlapNetwork()],
      mulberry32(4),
    );
    const gapCenterY = SCREEN_HEIGHT - sim.tubes[0].height - TUBE_GAP / 2;
    sim.population[0].bird.yPosition = gapCenterY;
    sim.population[1].bird.yPosition = 10;
    for (let i = 0; i < 10; i++) {
      stepPopulation(sim, 1, mulberry32(100 + i));
    }
    expect(sim.population[0].alignment).toBeGreaterThan(
      sim.population[1].alignment,
    );
  });

  it("does not add score to dead birds", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(6));
    sim.population[0].alive = false;
    sim.tubes[0].position = SCREEN_WIDTH / 2 - TUBE_WIDTH / 2 - 1;
    stepPopulation(sim, 1, mulberry32(7));
    expect(sim.population[0].score).toBe(0);
    expect(allDead(sim)).toBe(true);
  });

  it("counts survived frames only while alive", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(8));
    const rng = mulberry32(9);
    for (let i = 0; i < 600; i++) {
      stepPopulation(sim, 1, rng);
    }
    const entry = sim.population[0];
    expect(entry.alive).toBe(false);
    expect(entry.framesSurvived).toBeGreaterThan(0);
    const frozen = entry.framesSurvived;
    for (let i = 0; i < 10; i++) {
      stepPopulation(sim, 1, rng);
    }
    expect(entry.framesSurvived).toBe(frozen);
  });

  it("flaps when the network output is exactly one half", () => {
    const sim = createSim([zeroNetwork()], mulberry32(20));
    stepPopulation(sim, 1, mulberry32(21));
    expect(sim.population[0].bird.yVelocity).toBe(-JUMP_VELOCITY);
    expect(sim.population[0].alive).toBe(true);
  });

  it("does not flap when the network output is below one half", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(22));
    stepPopulation(sim, 1, mulberry32(23));
    expect(sim.population[0].bird.yVelocity).toBe(GRAVITY);
  });

  it("accrues exact alignment credit from the gap center", () => {
    const sim = createSim([neverFlapNetwork()], mulberry32(24));
    const gapCenterY = SCREEN_HEIGHT - sim.tubes[0].height - TUBE_GAP / 2;
    sim.population[0].bird.yPosition = gapCenterY;
    const dt = 0.5;
    stepPopulation(sim, dt, mulberry32(25));
    const yAfterUpdate = gapCenterY + GRAVITY * dt * dt;
    expect(sim.population[0].alignment).toBeCloseTo(
      Math.max(0, 1 - Math.abs(yAfterUpdate - gapCenterY) / SCREEN_HEIGHT) * dt,
      10,
    );
  });

  it("gives identical networks identical trajectories over shared tubes", () => {
    const network = neverFlapNetwork();
    const sim = createSim([network, network], mulberry32(10));
    const rng = mulberry32(11);
    for (let i = 0; i < 60; i++) {
      stepPopulation(sim, 1, rng);
    }
    const [a, b] = sim.population;
    expect(a.bird.yPosition).toBe(b.bird.yPosition);
    expect(a.score).toBe(b.score);
    expect(a.framesSurvived).toBe(b.framesSurvived);
    expect(a.alive).toBe(b.alive);
  });

  it("is deterministic under seeded rngs", () => {
    const seed = 12;
    const simA = createSim(
      [neverFlapNetwork(), zeroNetwork()],
      mulberry32(seed),
    );
    const simB = createSim(
      [neverFlapNetwork(), zeroNetwork()],
      mulberry32(seed),
    );
    const rngA = mulberry32(13);
    const rngB = mulberry32(13);
    for (let i = 0; i < 500; i++) {
      stepPopulation(simA, 1, rngA);
      stepPopulation(simB, 1, rngB);
    }
    expect(simA).toEqual(simB);
  });
});

describe("allDead", () => {
  it("is false while any bird is still alive", () => {
    const sim = createSim(
      [neverFlapNetwork(), neverFlapNetwork()],
      mulberry32(30),
    );
    sim.population[0].alive = false;
    expect(allDead(sim)).toBe(false);
    sim.population[1].alive = false;
    expect(allDead(sim)).toBe(true);
  });
});

describe("combineFitness", () => {
  it("ranks tube score above any alignment or survival total", () => {
    expect(combineFitness(2, 0, 0)).toBeGreaterThan(
      combineFitness(1, 5000, 1000),
    );
  });

  it("ranks gap alignment above raw survival time", () => {
    expect(combineFitness(0, 10, 0)).toBeGreaterThan(combineFitness(0, 0, 700));
  });

  it("uses survival time as the final tie-break", () => {
    expect(combineFitness(0, 5, 20)).toBeGreaterThan(combineFitness(0, 5, 10));
  });
});

describe("populationFitnesses", () => {
  it("combines score, alignment, and frames per bird", () => {
    const sim = createSim(
      [neverFlapNetwork(), neverFlapNetwork(), neverFlapNetwork()],
      mulberry32(14),
    );
    sim.population[0].score = 2;
    sim.population[0].alignment = 10;
    sim.population[0].framesSurvived = 100;
    sim.population[1].score = 2;
    sim.population[1].alignment = 20;
    sim.population[1].framesSurvived = 5;
    sim.population[2].score = 3;
    sim.population[2].alignment = 1;
    sim.population[2].framesSurvived = 1;
    const [lowAlign, highAlign, highScore] = populationFitnesses(sim);
    expect(highAlign).toBeGreaterThan(lowAlign);
    expect(highScore).toBeGreaterThan(highAlign);
  });
});
