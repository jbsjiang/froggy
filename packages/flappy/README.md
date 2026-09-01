# flappy

![CI](https://github.com/iam-jason-jiang/flappy/actions/workflows/ci.yml/badge.svg)
[![Netlify Status](https://api.netlify.com/api/v1/badges/367c971a-7c9f-4d39-af37-2f9c539680b5/deploy-status)](https://app.netlify.com/projects/flappy-fish/deploys)
[![License: MIT](https://img.shields.io/github/license/iam-jason-jiang/flappy)](LICENSE.TXT)

Flappy Bird clone in TypeScript on an HTML canvas.

Play it at: https://iam-jason-jiang.github.io/flappy/

## Prerequisites

- Node.js 20 or newer

## Commands

| Command                 | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `npm install`           | Install dev dependencies                            |
| `npm run dev`           | Start the Vite dev server (hot reload)              |
| `npm run build`         | Type-check, then build production bundle to `dist/` |
| `npm run preview`       | Serve the production build locally                  |
| `npm run lint`          | Lint + format check with Biome                      |
| `npm run format`        | Auto-format the codebase with Biome                 |
| `npm run typecheck`     | TypeScript check only (no build)                    |
| `npm test`              | Run unit tests with Vitest                          |
| `npm run test:coverage` | Run unit tests with a coverage report               |
| `npm run test:mutation` | Mutation testing with Stryker (report in `reports/mutation/`) |
| `npm run ci`            | Everything CI runs: lint + typecheck + test + build |

## Project layout

```
index.html           dev harness entry point, loads src/main.ts
src/
  res/               sprites and bitmap font, imported as ?url assets
  constants.ts       screen, physics, tube, and font constants
  types.ts           GameState, Bird, Tube, Textures, Network, sim types
  assets.ts          texture loading via ?url asset imports
  physics.ts         pure bird physics: gravity, jump, clamp, rotation
  tubes.ts           pure tube spawning, scrolling, recycling, scoring
  collision.ts       pure tube/ground collision checks
  rng.ts             seeded mulberry32 RNG and gaussian sampler
  network.ts         fixed [6, 8, 8, 1] feedforward networks: create, forward, mutate
  evolution.ts       population creation and elite + mutation generational step
  populationSim.ts   headless multi-bird simulation over shared tubes
  render.ts          canvas drawing
  game.ts            state machine loop, input handling, AI mode toggle
  aiGame.ts          AI training mode: loop, HUD, speed control, persistence
  main.ts            bootstrap: finds the canvas and starts the game
test/                Vitest unit tests for the pure modules
```

Delta time throughout the game is measured in 60fps frames: a `dt` of `1.0`
means one 1/60th-second step, so physics constants are tuned per-frame rather
than per-second.

## AI mode

Press `N` (or the on-screen button) to swap the normal game for a
neuroevolution training mode. A population of 300 randomized neural networks
plays simultaneously: each bird sees six normalized inputs — its height,
vertical velocity, and the distance + gap center of every tube ahead of it
(both on-screen tubes) — through a fixed `[6, 8, 8, 1]` tanh/sigmoid network
(two hidden layers of 8, with a bias weight per neuron) and flaps when the
output is at least 0.5.

Fitness is shaped: every frame a bird survives, it earns alignment credit
proportional to how close it sits to the center of the next gap (1 at the
center, decaying linearly to 0 at a full screen height away), so even birds
that never pass a tube get a smooth gradient toward gap-threading instead of
being rewarded for stalling at the ceiling. Final fitness ranks, in order:
tubes passed, accumulated alignment, then frames survived. Each generation
flies three fresh random tube sequences ("courses") back to back; a genome's
fitness is its combined total across all three, which averages out course
luck and keeps selection stable while every generation still faces new
terrain. When the last course ends, the top eight networks are carried over
verbatim; every other bird is either a mutated copy of a single tournament
winner (half the time) or a child of two parents picked by tournament of four
from the top 15%, combined with uniform per-weight crossover and then
Gaussian mutation. Mutation is self-adaptive: each genome carries its own
mutation rate (clamped to [0.01, 0.25]) and strength (clamped to [0.05,
0.8]), which are inherited, crossed over, and log-normally perturbed per
child — so selection automatically anneals exploration pressure per lineage,
running hot early and fine-tuning as champions emerge. The best network and
its generation are persisted to `localStorage` (key `flappy-ai-best`)
whenever a generation beats the all-time best, and are restored the next time
AI mode starts (records are versioned by course count; changing it discards
old saves). While AI mode is active, a side panel appears next to the game canvas:
live training stats (generation, alive count, scores, speed), the champion's
network drawn as a diagram — 6 input nodes (Y, Vy, then D/G pairs per tube),
two hidden layers of 8, and one FLAP output, with green edges for positive
weights, red for negative, and edge thickness tracking magnitude — plus the
speed and reset controls. The panel has two tabs: Training (stats, diagrams,
controls) and Showcase, which runs a single network in the game at regular 1x
speed and full opacity, restarting whenever it crashes. Opening the Showcase
tab runs the best network from training (or the saved best from localStorage);
the tab also holds a "Run pretrained model" button that runs a champion network
bundled with the app (`src/models/champion.json`, validated by the same loader
as imported files), plus an import button that loads a previously downloaded
winner JSON and runs that network instead. Training pauses while the Showcase
tab is open and resumes where it left off when switching back. The game canvas
itself shows only the bird and the world.

AI mode controls:

| Key / button             | Action                                    |
| ------------------------ | ----------------------------------------- |
| `N` / AI Mode button     | Toggle between normal game and AI mode    |
| `F` / Speed button       | Cycle simulation speed: 1x, 2x, 4x, 8x, 16x, 32x, 64x, 128x |
| `R` / Reset button       | Wipe the saved best brain and restart     |
| `D` / Download button    | Save the winner network as JSON           |
| Showcase tab             | Run best/imported winner at 1x speed      |
| Run pretrained button    | Run the champion bundled with the app     |

Normal gameplay is unchanged; toggling back resets the normal game to its
start screen.

## Deployment

Pushes to `main` and pull requests run CI (lint, typecheck, tests, build) via
`.github/workflows/ci.yml`. Deployment is handled separately.
