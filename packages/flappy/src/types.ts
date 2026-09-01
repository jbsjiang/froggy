export type GameState = "start" | "running" | "gameOver";

export interface Bird {
  yPosition: number;
  yVelocity: number;
}

export interface Tube {
  position: number;
  height: number;
  scored: boolean;
}

export interface Textures {
  birdFrames: HTMLImageElement[];
  background: HTMLImageElement;
  ground: HTMLImageElement;
  tubeBody: HTMLImageElement;
  tubeTop: HTMLImageElement;
}

export interface Network {
  layers: number[][][];
  mutationRate: number;
  mutationStrength: number;
}

export interface PopulationBird {
  bird: Bird;
  network: Network;
  alive: boolean;
  score: number;
  alignment: number;
  framesSurvived: number;
}

export interface PopulationSim {
  population: PopulationBird[];
  tubes: Tube[];
}
