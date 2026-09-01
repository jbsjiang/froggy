import { TUBE_COUNT } from "./constants";
import { gaussian } from "./rng";
import type { Network } from "./types";

export const INPUT_COUNT = 2 + TUBE_COUNT * 2;
export const LAYER_SIZES = [INPUT_COUNT, 8, 8, 1];
export const WEIGHT_CLAMP = 3;
export const RATE_CLAMP = [0.01, 0.25] as const;
export const STRENGTH_CLAMP = [0.05, 0.8] as const;
export const RATE_INIT_RANGE = [0.02, 0.1] as const;
export const STRENGTH_INIT_RANGE = [0.1, 0.4] as const;
const STRATEGY_STEP = 0.05;

function clamped(weight: number): number {
  return Math.max(-WEIGHT_CLAMP, Math.min(WEIGHT_CLAMP, weight));
}

function clampRange(value: number, range: readonly [number, number]): number {
  return Math.max(range[0], Math.min(range[1], value));
}

function perturbStrategy(value: number, rng: () => number): number {
  return value * Math.exp(gaussian(rng) * STRATEGY_STEP);
}

export function createNetwork(rng: () => number): Network {
  const layers: number[][][] = [];
  for (let layer = 0; layer < LAYER_SIZES.length - 1; layer++) {
    const matrix: number[][] = [];
    for (let dest = 0; dest < LAYER_SIZES[layer + 1]; dest++) {
      const row: number[] = [];
      for (let source = 0; source <= LAYER_SIZES[layer]; source++) {
        row.push(rng() * 2 - 1);
      }
      matrix.push(row);
    }
    layers.push(matrix);
  }
  return {
    layers,
    mutationRate:
      RATE_INIT_RANGE[0] + rng() * (RATE_INIT_RANGE[1] - RATE_INIT_RANGE[0]),
    mutationStrength:
      STRENGTH_INIT_RANGE[0] +
      rng() * (STRENGTH_INIT_RANGE[1] - STRENGTH_INIT_RANGE[0]),
  };
}

export function forward(network: Network, inputs: readonly number[]): number {
  let activations: readonly number[] = inputs;
  for (let layer = 0; layer < network.layers.length; layer++) {
    const isLast = layer === network.layers.length - 1;
    const next: number[] = [];
    for (const row of network.layers[layer]) {
      const bias = row[row.length - 1];
      let weightedSum = bias;
      for (let source = 0; source < row.length - 1; source++) {
        weightedSum += row[source] * activations[source];
      }
      next.push(isLast ? sigmoid(weightedSum) : Math.tanh(weightedSum));
    }
    activations = next;
  }
  return activations[0];
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function mutate(network: Network, rng: () => number): Network {
  const mutationRate = clampRange(
    perturbStrategy(network.mutationRate, rng),
    RATE_CLAMP,
  );
  const mutationStrength = clampRange(
    perturbStrategy(network.mutationStrength, rng),
    STRENGTH_CLAMP,
  );
  return {
    layers: network.layers.map((matrix) =>
      matrix.map((row) =>
        row.map((weight) =>
          rng() < mutationRate
            ? clamped(weight + gaussian(rng) * mutationStrength)
            : weight,
        ),
      ),
    ),
    mutationRate,
    mutationStrength,
  };
}
