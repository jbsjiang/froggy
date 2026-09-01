import { describe, expect, it } from "vitest";
import { createPopulation, crossover, nextGeneration } from "../src/evolution";
import { LAYER_SIZES } from "../src/network";
import { mulberry32 } from "../src/rng";
import type { Network } from "../src/types";

function constantNetwork(
  weight: number,
  mutationRate: number,
  mutationStrength: number,
): Network {
  return {
    layers: LAYER_SIZES.slice(1).map((size, layer) =>
      Array.from({ length: size }, () =>
        Array.from({ length: LAYER_SIZES[layer] + 1 }, () => weight),
      ),
    ),
    mutationRate,
    mutationStrength,
  };
}

function dominantWeight(network: Network): number {
  const counts = new Map<number, number>();
  for (const matrix of network.layers) {
    for (const row of matrix) {
      for (const weight of row) {
        counts.set(weight, (counts.get(weight) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function tournamentFixture(): {
  networks: Network[];
  fitnesses: number[];
} {
  const elites = [
    constantNetwork(0.2, 0.01, 0.05),
    constantNetwork(0.25, 0.13, 0.4),
    constantNetwork(0.3, 0.25, 0.8),
  ];
  const networks = [
    ...elites,
    ...Array.from({ length: 17 }, () => constantNetwork(0.9, 0.02, 0.1)),
  ];
  const fitnesses = [3, 2, 1, ...Array.from({ length: 17 }, () => 0)];
  return { networks, fitnesses };
}

function bredChildren(
  networks: Network[],
  fitnesses: number[],
  runs: number,
): Network[] {
  const children: Network[] = [];
  for (let run = 0; run < runs; run++) {
    const next = nextGeneration(networks, fitnesses, mulberry32(1000 + run));
    for (const network of next) {
      if (!networks.includes(network)) {
        children.push(network);
      }
    }
  }
  return children;
}

function singleWeightNetwork(weight: number): Network {
  return {
    layers: [[[weight]]],
    mutationRate: 0.1,
    mutationStrength: 0.4,
  };
}

function countingRng(values: readonly number[]): {
  rng: () => number;
  draws: () => number;
} {
  let calls = 0;
  return {
    rng: () => values[calls++] ?? 0.5,
    draws: () => calls,
  };
}

describe("createPopulation", () => {
  it("creates the requested number of distinct networks", () => {
    const population = createPopulation(10, mulberry32(1));
    expect(population).toHaveLength(10);
    const serialized = new Set(population.map((n) => JSON.stringify(n)));
    expect(serialized.size).toBe(10);
  });
});

describe("crossover", () => {
  const parentA = constantNetwork(0.2, 0.01, 0.05);
  const parentB = constantNetwork(0.9, 0.25, 0.8);

  it("takes every gene from parent b when the rng stays high", () => {
    const child = crossover(parentA, parentB, () => 0.9);
    for (const matrix of child.layers) {
      for (const row of matrix) {
        for (const weight of row) {
          expect(weight).toBe(0.9);
        }
      }
    }
    expect(child.mutationRate).toBe(0.25);
    expect(child.mutationStrength).toBe(0.8);
  });

  it("takes every gene from parent a when the rng stays low", () => {
    const child = crossover(parentA, parentB, () => 0.1);
    for (const matrix of child.layers) {
      for (const row of matrix) {
        for (const weight of row) {
          expect(weight).toBe(0.2);
        }
      }
    }
    expect(child.mutationRate).toBe(0.01);
    expect(child.mutationStrength).toBe(0.05);
  });

  it("treats an exact half draw as parent b", () => {
    const child = crossover(parentA, parentB, () => 0.5);
    expect(child.layers[0][0][0]).toBe(0.9);
    expect(child.mutationRate).toBe(0.25);
    expect(child.mutationStrength).toBe(0.8);
  });

  it("mixes genes per weight from both parents", () => {
    let draw = 0;
    const draws = [0.9, 0.1, 0.9, 0.1];
    const child = crossover(parentA, parentB, () => draws[draw++ % 4]);
    const weights = child.layers.flat(2);
    expect(weights[0]).toBe(0.9);
    expect(weights[1]).toBe(0.2);
    expect(weights[2]).toBe(0.9);
    expect(weights[3]).toBe(0.2);
  });
});

describe("nextGeneration", () => {
  it("carries the top eight verbatim and keeps size", () => {
    const population = createPopulation(12, mulberry32(2));
    const fitnesses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const next = nextGeneration(population, fitnesses, mulberry32(3));
    expect(next).toHaveLength(12);
    const expectedOrder = [11, 10, 9, 8, 7, 6, 5, 4];
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(next[i]).toBe(population[expectedOrder[i]]);
    }
    for (const network of next.slice(8)) {
      for (const parent of population) {
        expect(network).not.toBe(parent);
      }
    }
  });

  it("keeps elites for tiny populations", () => {
    const population = createPopulation(2, mulberry32(4));
    const next = nextGeneration(population, [5, 9], mulberry32(5));
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(population[1]);
    expect(next[1]).toBe(population[0]);
  });

  it("is deterministic under a seeded rng", () => {
    const population = createPopulation(6, mulberry32(6));
    const fitnesses = [3, 1, 4, 1, 5, 9];
    const a = nextGeneration(population, fitnesses, mulberry32(7));
    const b = nextGeneration(population, fitnesses, mulberry32(7));
    expect(a).toEqual(b);
  });

  it("handles an all-zero-fitness population", () => {
    const population = createPopulation(4, mulberry32(8));
    const next = nextGeneration(population, [0, 0, 0, 0], mulberry32(9));
    expect(next).toHaveLength(4);
    expect(next[0]).toBe(population[0]);
  });

  it("evolves a small population across generations at constant size", () => {
    const rng = mulberry32(11);
    let population = createPopulation(10, rng);
    for (let generation = 0; generation < 5; generation++) {
      const fitnesses = population.map((_, index) => index);
      population = nextGeneration(population, fitnesses, rng);
      expect(population).toHaveLength(10);
    }
  });

  it("returns an empty generation for an empty population", () => {
    expect(nextGeneration([], [], mulberry32(1))).toEqual([]);
  });

  describe("breeding path selection", () => {
    const fitnesses = Array.from({ length: 9 }, (_, i) => 9 - i);

    function population(): Network[] {
      return Array.from({ length: 9 }, (_, i) => singleWeightNetwork(i + 1));
    }

    it("breeds via two parents when the decision draw is exactly one half", () => {
      const { rng, draws } = countingRng([
        0.9,
        0.9,
        0.9,
        0.9, // parent tournament over a single elite slot
        0.5, // decision draw: half is not below the single-parent chance
        0.9,
        0.9,
        0.9,
        0.9, // partner tournament
        0.9,
        0.9,
        0.9, // crossover: weight, rate, and strategy draws
        0.3,
        0,
        0.3,
        0, // mutate: rate gaussian, strength gaussian
        0.99, // mutate: weight draw above the perturbed rate
      ]);
      const next = nextGeneration(population(), fitnesses, rng);
      expect(next).toHaveLength(9);
      expect(next[8]).not.toBe(next[0]);
      expect(draws()).toBe(17);
    });

    it("breeds via a single parent when the decision draw is below the chance", () => {
      const { rng, draws } = countingRng([
        0.9,
        0.9,
        0.9,
        0.9, // parent tournament
        0.1, // decision draw below the single-parent chance
        0.3,
        0,
        0.3,
        0, // mutate: rate gaussian, strength gaussian
        0.99, // mutate: weight draw
      ]);
      const next = nextGeneration(population(), fitnesses, rng);
      expect(next).toHaveLength(9);
      expect(draws()).toBe(10);
    });
  });

  it("breeds children only from the elite fraction", () => {
    const { networks, fitnesses } = tournamentFixture();
    for (const child of bredChildren(networks, fitnesses, 20)) {
      expect([0.2, 0.25, 0.3]).toContain(dominantWeight(child));
      for (const matrix of child.layers) {
        for (const row of matrix) {
          for (const weight of row) {
            expect(Number.isFinite(weight)).toBe(true);
          }
        }
      }
    }
  });

  it("draws from several elites but favors the best", () => {
    const { networks, fitnesses } = tournamentFixture();
    const counts = new Map<number, number>();
    const children = bredChildren(networks, fitnesses, 30);
    for (const child of children) {
      const dominant = dominantWeight(child);
      counts.set(dominant, (counts.get(dominant) ?? 0) + 1);
    }
    expect((counts.get(0.2) ?? 0) / children.length).toBeGreaterThan(0.6);
    expect(counts.get(0.25) ?? 0).toBeGreaterThan(0);
    expect(counts.get(0.3) ?? 0).toBeGreaterThan(0);
  });

  it("mixes single-parent children with two-parent crossover children", () => {
    const { networks, fitnesses } = tournamentFixture();
    const children = bredChildren(networks, fitnesses, 30);
    let mixed = 0;
    for (const child of children) {
      const counts = new Map<number, number>();
      for (const weight of child.layers.flat(2)) {
        counts.set(weight, (counts.get(weight) ?? 0) + 1);
      }
      const shares = [...counts.values()].sort((a, b) => b - a);
      const total = child.layers.flat(2).length;
      if (shares.length > 1 && shares[1] / total >= 0.2) {
        mixed++;
      }
    }
    // Roughly half the children take the crossover path, and a crossover of
    // two distinct parents yields two dominant gene clusters.
    expect(mixed / children.length).toBeGreaterThan(0.1);
    expect(mixed / children.length).toBeLessThan(0.35);
  });

  it("crosses over strategy parameters from both elite lineages", () => {
    const { networks, fitnesses } = tournamentFixture();
    const rateClusters = new Set<number>();
    const strengthClusters = new Set<number>();
    for (const child of bredChildren(networks, fitnesses, 30)) {
      rateClusters.add(
        [0.01, 0.13, 0.25].reduce((best, option) =>
          Math.abs(child.mutationRate - option) <
          Math.abs(child.mutationRate - best)
            ? option
            : best,
        ),
      );
      strengthClusters.add(
        [0.05, 0.4, 0.8].reduce((best, option) =>
          Math.abs(child.mutationStrength - option) <
          Math.abs(child.mutationStrength - best)
            ? option
            : best,
        ),
      );
    }
    expect(rateClusters.has(0.01)).toBe(true);
    expect(rateClusters.has(0.25)).toBe(true);
    expect(strengthClusters.has(0.05)).toBe(true);
    expect(strengthClusters.has(0.8)).toBe(true);
  });
});
