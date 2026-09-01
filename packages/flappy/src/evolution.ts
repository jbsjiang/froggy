import { createNetwork, mutate } from "./network";
import type { Network } from "./types";

export const ELITE_FRACTION = 0.15;
export const ELITE_CARRY_COUNT = 8;
const TOURNAMENT_SIZE = 4;
const SINGLE_PARENT_CHANCE = 0.5;

export function createPopulation(size: number, rng: () => number): Network[] {
  const networks: Network[] = [];
  for (let i = 0; i < size; i++) {
    networks.push(createNetwork(rng));
  }
  return networks;
}

export function crossover(a: Network, b: Network, rng: () => number): Network {
  return {
    layers: a.layers.map((matrix, layer) =>
      matrix.map((row, dest) =>
        row.map((_, source) =>
          rng() < 0.5 ? row[source] : b.layers[layer][dest][source],
        ),
      ),
    ),
    mutationRate: rng() < 0.5 ? a.mutationRate : b.mutationRate,
    mutationStrength: rng() < 0.5 ? a.mutationStrength : b.mutationStrength,
  };
}

export function nextGeneration(
  networks: readonly Network[],
  fitnesses: readonly number[],
  rng: () => number,
): Network[] {
  const size = networks.length;
  const order = networks
    .map((_, index) => index)
    .sort((a, b) => fitnesses[b] - fitnesses[a]);
  const eliteCount = Math.max(1, Math.floor(size * ELITE_FRACTION));

  function tournamentWinner(): Network {
    let bestSlot = Math.floor(rng() * eliteCount);
    for (let i = 1; i < TOURNAMENT_SIZE; i++) {
      bestSlot = Math.min(bestSlot, Math.floor(rng() * eliteCount));
    }
    return networks[order[bestSlot]];
  }

  const carryCount = Math.max(1, Math.min(ELITE_CARRY_COUNT, size));
  const next: Network[] = order
    .slice(0, carryCount)
    .map((index) => networks[index]);
  while (next.length < size) {
    const parent = tournamentWinner();
    const child =
      rng() < SINGLE_PARENT_CHANCE
        ? mutate(parent, rng)
        : mutate(crossover(parent, tournamentWinner(), rng), rng);
    next.push(child);
  }
  return next;
}
