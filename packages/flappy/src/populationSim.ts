import { checkCollision } from "./collision";
import {
  BIRD_WIDTH,
  BIRD_X,
  MAX_VELOCITY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TUBE_COUNT,
  TUBE_GAP,
  TUBE_WIDTH,
} from "./constants";
import { forward } from "./network";
import { updateBird } from "./physics";
import { createTubes, updateTubes } from "./tubes";
import type { Bird, Network, PopulationSim, Tube } from "./types";

const FITNESS_SCORE_SCALE = 1000000;
const FITNESS_ALIGNMENT_SCALE = 100;

export function createSim(
  networks: readonly Network[],
  rng: () => number,
): PopulationSim {
  return {
    tubes: createTubes(rng),
    population: networks.map((network) => ({
      bird: { yPosition: SCREEN_HEIGHT / 2, yVelocity: 0 },
      network,
      alive: true,
      score: 0,
      alignment: 0,
      framesSurvived: 0,
    })),
  };
}

export function tubesAhead(tubes: readonly Tube[]): Tube[] {
  const ahead = [...tubes]
    .filter((tube) => tube.position + TUBE_WIDTH + BIRD_WIDTH / 2 > BIRD_X)
    .sort((a, b) => a.position - b.position);
  if (ahead.length > 0) {
    return ahead;
  }
  return [...tubes].sort((a, b) => a.position - b.position);
}

export function networkInputs(bird: Bird, ahead: readonly Tube[]): number[] {
  const inputs = [
    bird.yPosition / SCREEN_HEIGHT,
    bird.yVelocity / MAX_VELOCITY,
  ];
  for (let slot = 0; slot < TUBE_COUNT; slot++) {
    const tube = ahead[Math.min(slot, ahead.length - 1)];
    inputs.push(
      (tube.position - BIRD_X) / SCREEN_WIDTH,
      (SCREEN_HEIGHT - tube.height - TUBE_GAP / 2) / SCREEN_HEIGHT,
    );
  }
  return inputs;
}

export function stepPopulation(
  sim: PopulationSim,
  dt: number,
  rng: () => number,
): void {
  const scored = updateTubes(sim.tubes, dt, rng);
  const ahead = tubesAhead(sim.tubes);
  const gapCenterY = SCREEN_HEIGHT - ahead[0].height - TUBE_GAP / 2;
  for (const entry of sim.population) {
    if (!entry.alive) {
      continue;
    }
    entry.score += scored;
    entry.framesSurvived += dt;
    const output = forward(entry.network, networkInputs(entry.bird, ahead));
    updateBird(entry.bird, dt, output >= 0.5);
    const offset = Math.abs(entry.bird.yPosition - gapCenterY);
    entry.alignment += Math.max(0, 1 - offset / SCREEN_HEIGHT) * dt;
    if (checkCollision(entry.bird, sim.tubes)) {
      entry.alive = false;
    }
  }
}

export function allDead(sim: PopulationSim): boolean {
  return sim.population.every((entry) => !entry.alive);
}

export function combineFitness(
  score: number,
  alignment: number,
  framesSurvived: number,
): number {
  return (
    score * FITNESS_SCORE_SCALE +
    alignment * FITNESS_ALIGNMENT_SCALE +
    framesSurvived
  );
}

export function populationFitnesses(sim: PopulationSim): number[] {
  return sim.population.map((entry) =>
    combineFitness(entry.score, entry.alignment, entry.framesSurvived),
  );
}
