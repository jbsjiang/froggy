import { describe, expect, it } from "vitest";
import { TUBE_COUNT } from "../src/constants";
import {
  createNetwork,
  forward,
  INPUT_COUNT,
  LAYER_SIZES,
  mutate,
  RATE_CLAMP,
  RATE_INIT_RANGE,
  STRENGTH_CLAMP,
  STRENGTH_INIT_RANGE,
  WEIGHT_CLAMP,
} from "../src/network";
import { gaussian, mulberry32 } from "../src/rng";
import type { Network } from "../src/types";

function zeroNetwork(mutationRate = 0, mutationStrength = 0): Network {
  return {
    layers: LAYER_SIZES.slice(1).map((size, layer) =>
      Array.from({ length: size }, () =>
        Array.from({ length: LAYER_SIZES[layer] + 1 }, () => 0),
      ),
    ),
    mutationRate,
    mutationStrength,
  };
}

describe("layer geometry", () => {
  it("derives the input count from the bird state and tube slots", () => {
    expect(INPUT_COUNT).toBe(2 + TUBE_COUNT * 2);
    expect(LAYER_SIZES[0]).toBe(INPUT_COUNT);
  });
});

describe("createNetwork", () => {
  it("creates weight matrices matching the layer sizes, weights in [-1, 1]", () => {
    const network = createNetwork(mulberry32(1));
    expect(network.layers).toHaveLength(LAYER_SIZES.length - 1);
    for (let layer = 0; layer < network.layers.length; layer++) {
      expect(network.layers[layer]).toHaveLength(LAYER_SIZES[layer + 1]);
      for (const row of network.layers[layer]) {
        expect(row).toHaveLength(LAYER_SIZES[layer] + 1);
        for (const weight of row) {
          expect(weight).toBeGreaterThanOrEqual(-1);
          expect(weight).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("is deterministic under a seeded rng", () => {
    expect(createNetwork(mulberry32(9))).toEqual(createNetwork(mulberry32(9)));
  });

  it("spans both positive and negative initial weights", () => {
    const network = createNetwork(mulberry32(2));
    const weights = network.layers.flat(2);
    expect(Math.max(...weights)).toBeGreaterThan(0);
    expect(Math.min(...weights)).toBeLessThan(0);
  });
  it("seeds mutation strategy parameters in their init ranges", () => {
    for (let seed = 0; seed < 100; seed++) {
      const network = createNetwork(mulberry32(seed));
      expect(network.mutationRate).toBeGreaterThanOrEqual(RATE_INIT_RANGE[0]);
      expect(network.mutationRate).toBeLessThanOrEqual(RATE_INIT_RANGE[1]);
      expect(network.mutationStrength).toBeGreaterThanOrEqual(
        STRENGTH_INIT_RANGE[0],
      );
      expect(network.mutationStrength).toBeLessThanOrEqual(
        STRENGTH_INIT_RANGE[1],
      );
    }
  });
});

describe("forward", () => {
  it("returns exactly 0.5 for zero weights", () => {
    const inputs = Array.from({ length: LAYER_SIZES[0] }, (_, i) => i * 0.1);
    expect(forward(zeroNetwork(), inputs)).toBe(0.5);
  });

  it("chains tanh through each hidden layer and sigmoid at the output", () => {
    const network = zeroNetwork();
    network.layers[0][0][0] = 1;
    for (let layer = 1; layer < network.layers.length; layer++) {
      network.layers[layer][0][0] = 1;
    }
    const inputs = Array.from({ length: LAYER_SIZES[0] }, () => 0);
    inputs[0] = 0.7;
    const output = forward(network, inputs);
    let expected = 0.7;
    for (let layer = 0; layer < network.layers.length - 1; layer++) {
      expected = Math.tanh(expected);
    }
    expected = 1 / (1 + Math.exp(-expected));
    expect(output).toBeCloseTo(expected, 10);
  });

  it("adds the trailing bias weight to each neuron's weighted sum", () => {
    const network = zeroNetwork();
    for (const matrix of network.layers) {
      for (const row of matrix) {
        row[row.length - 1] = 1;
      }
    }
    const output = forward(
      network,
      Array.from({ length: LAYER_SIZES[0] }, () => 0),
    );
    expect(output).toBeCloseTo(1 / (1 + Math.exp(-1)), 10);
  });
});

describe("mutate", () => {
  const DRIFT = gaussian(
    (() => {
      let calls = 0;
      return () => [0.3, 0][calls++] ?? 0.5;
    })(),
  );
  const PERTURBED_RATE = 0.1 * Math.exp(DRIFT * 0.05);
  const PERTURBED_STRENGTH = 0.4 * Math.exp(DRIFT * 0.05);

  function scriptedRng(values: readonly number[]): () => number {
    let calls = 0;
    return () => values[calls++] ?? 0.5;
  }

  function singleWeightNetwork(): Network {
    return {
      layers: [[[0.5]]],
      mutationRate: 0.1,
      mutationStrength: 0.4,
    };
  }

  it("returns a copy and leaves the original untouched", () => {
    const network = createNetwork(mulberry32(3));
    const original = structuredClone(network);
    const mutated = mutate(network, mulberry32(4));
    expect(mutated).not.toBe(network);
    expect(network).toEqual(original);
  });

  it("perturbs the inherited strategy parameters per child", () => {
    const network = createNetwork(mulberry32(3));
    const rates = new Set<number>();
    const strengths = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const child = mutate(network, mulberry32(200 + i));
      rates.add(child.mutationRate);
      strengths.add(child.mutationStrength);
    }
    expect(rates.size).toBeGreaterThan(1);
    expect(strengths.size).toBeGreaterThan(1);
  });

  it("is deterministic under a seeded rng", () => {
    const network = createNetwork(mulberry32(5));
    const a = mutate(network, mulberry32(6));
    const b = mutate(network, mulberry32(6));
    expect(a).toEqual(b);
  });

  it("perturbs at least one weight when the rate is high", () => {
    const network = zeroNetwork(RATE_CLAMP[1], STRENGTH_CLAMP[1]);
    const mutated = mutate(network, mulberry32(7));
    expect(mutated.layers).not.toEqual(network.layers);
  });

  it("adapts the inherited strategy parameters within clamps", () => {
    const network = createNetwork(mulberry32(3));
    for (let i = 0; i < 200; i++) {
      const child = mutate(network, mulberry32(100 + i));
      expect(child.mutationRate).toBeGreaterThanOrEqual(RATE_CLAMP[0]);
      expect(child.mutationRate).toBeLessThanOrEqual(RATE_CLAMP[1]);
      expect(child.mutationStrength).toBeGreaterThanOrEqual(STRENGTH_CLAMP[0]);
      expect(child.mutationStrength).toBeLessThanOrEqual(STRENGTH_CLAMP[1]);
    }
  });

  it("keeps strategy parameters positive over many generations", () => {
    let network = createNetwork(mulberry32(8));
    for (let i = 0; i < 1000; i++) {
      network = mutate(network, mulberry32(500 + i));
      expect(network.mutationRate).toBeGreaterThan(0);
      expect(network.mutationStrength).toBeGreaterThan(0);
    }
  });

  it("clamps mutated weights to the weight clamp on both sides", () => {
    let network = createNetwork(mulberry32(15));
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 400; i++) {
      network = mutate(network, mulberry32(6000 + i));
      for (const weight of network.layers.flat(2)) {
        expect(weight).toBeGreaterThanOrEqual(-WEIGHT_CLAMP);
        expect(weight).toBeLessThanOrEqual(WEIGHT_CLAMP);
        min = Math.min(min, weight);
        max = Math.max(max, weight);
      }
    }
    expect(min).toBe(-WEIGHT_CLAMP);
    expect(max).toBe(WEIGHT_CLAMP);
  });

  it("drifts strategy parameters by only a few percent per generation", () => {
    let network = createNetwork(mulberry32(16));
    network = { ...network, mutationRate: 0.1, mutationStrength: 0.4 };
    let clamped = 0;
    const generations = 100;
    for (let i = 0; i < generations; i++) {
      network = mutate(network, mulberry32(7000 + i));
      if (
        network.mutationRate === RATE_CLAMP[0] ||
        network.mutationRate === RATE_CLAMP[1]
      ) {
        clamped++;
      }
    }
    expect(clamped).toBeLessThan(generations * 0.2);
  });

  it("multiplies strategy parameters by the gaussian drift factor", () => {
    const child = mutate(
      singleWeightNetwork(),
      scriptedRng([0.3, 0, 0.3, 0, 0.99]),
    );
    expect(child.mutationRate).toBe(PERTURBED_RATE);
    expect(child.mutationStrength).toBe(PERTURBED_STRENGTH);
    expect(child.layers[0][0][0]).toBe(0.5);
  });

  it("leaves a weight untouched when its draw equals the mutation rate", () => {
    const child = mutate(
      singleWeightNetwork(),
      scriptedRng([0.3, 0, 0.3, 0, PERTURBED_RATE]),
    );
    expect(child.layers[0][0][0]).toBe(0.5);
  });

  it("adds gaussian noise scaled by the mutation strength to a selected weight", () => {
    const child = mutate(
      singleWeightNetwork(),
      scriptedRng([0.3, 0, 0.3, 0, 0, 0.3, 0]),
    );
    expect(child.layers[0][0][0]).toBe(
      Math.max(
        -WEIGHT_CLAMP,
        Math.min(WEIGHT_CLAMP, 0.5 + DRIFT * PERTURBED_STRENGTH),
      ),
    );
  });
});
