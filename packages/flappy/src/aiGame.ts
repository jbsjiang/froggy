import { GROUND_TILE_WIDTH, MAX_DELTA_STEPS, SPEED } from "./constants";
import { createPopulation, ELITE_FRACTION, nextGeneration } from "./evolution";
import pretrainedModel from "./models/champion.json";
import { LAYER_SIZES, RATE_INIT_RANGE, STRENGTH_INIT_RANGE } from "./network";
import { createNetworkDiagram } from "./networkDiagram";
import {
  allDead,
  combineFitness,
  createSim,
  stepPopulation,
} from "./populationSim";
import { drawBird, drawGround, drawScene, drawScore } from "./render";
import { createScoreGraph } from "./scoreGraph";
import { createTubes } from "./tubes";
import type { Network, Textures } from "./types";

const POPULATION_SIZE = 300;
const COURSES_PER_GENERATION = 3;
const STORAGE_KEY = "flappy-ai-best";
const WINNING_SCORE = 1000;
const SPEED_STEPS = [1, 2, 4, 8, 16, 32, 64, 128];
const SPEED_LABELS = SPEED_STEPS.map((steps) => `${steps}x`);
const BASE_STEP_MS = 1000 / 60;
const BIRD_ALPHA = 0.8;
const PANEL_UPDATE_INTERVAL_MS = 150;
const DEFAULT_MUTATION_RATE = (RATE_INIT_RANGE[0] + RATE_INIT_RANGE[1]) / 2;
const DEFAULT_MUTATION_STRENGTH =
  (STRENGTH_INIT_RANGE[0] + STRENGTH_INIT_RANGE[1]) / 2;

interface SavedBest {
  generation: number;
  bestScore: number;
  courses: number;
  network: Network;
}

export function startAiGame(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  textures: Textures,
  fontBitmap: HTMLImageElement,
  onExit: () => void,
): () => void {
  const saved = loadBest();
  let networks = createPopulation(POPULATION_SIZE, Math.random);
  let generation = 1;
  let allTimeBestScore = 0;
  let allTimeBestGeneration = 0;
  let champion: Network | null = null;
  let championGeneration = 0;
  let championScore = 0;
  let speedIndex = 0;
  let groundOffset = 0;
  let animationStep = 0;
  let rafId = 0;
  let courseIndex = 0;
  let courseScores: number[] = [];
  let courseAlignments: number[] = [];
  let courseFrames: number[] = [];
  let historyBestScores: number[] = [];
  let historyMedianScores: number[] = [];
  let historyEliteFloorScores: number[] = [];
  let lastPanelUpdate = 0;
  let drawnChampion: Network | null | undefined;
  let previousTime = performance.now();
  let pendingSteps = 0;
  let winner: Network | null = null;
  let winnerGeneration = 0;
  let winnerScore = 0;
  let trainingStopped = false;
  let showcaseNetwork: Network | null = null;
  let showcaseGeneration = 0;
  let showcaseScore = 0;
  let showcaseActive = false;
  let showcaseSource: "Imported" | "Pretrained" = "Imported";
  let showcaseSim: ReturnType<typeof createSim> | null = null;
  const idleTubes = createTubes();

  if (saved) {
    allTimeBestScore = saved.bestScore;
    allTimeBestGeneration = saved.generation;
    generation = saved.generation + 1;
    networks = [saved.network, ...networks.slice(1)];
    champion = saved.network;
    championGeneration = saved.generation;
    championScore = saved.bestScore;
  }
  resetCourseStats();
  let sim = createSim(networks, Math.random);

  function resetCourseStats(): void {
    courseScores = new Array<number>(POPULATION_SIZE).fill(0);
    courseAlignments = new Array<number>(POPULATION_SIZE).fill(0);
    courseFrames = new Array<number>(POPULATION_SIZE).fill(0);
  }

  function accumulateCourse(): void {
    for (let i = 0; i < sim.population.length; i++) {
      courseScores[i] += sim.population[i].score;
      courseAlignments[i] += sim.population[i].alignment;
      courseFrames[i] += sim.population[i].framesSurvived;
    }
  }

  function drawGenerationHistory(): void {
    scoreGraph.update(
      historyBestScores,
      historyMedianScores,
      historyEliteFloorScores,
    );
  }

  function advanceGeneration(): void {
    const fitnesses = courseScores.map((score, i) =>
      combineFitness(score, courseAlignments[i], courseFrames[i]),
    );
    let bestIndex = 0;
    for (let i = 1; i < fitnesses.length; i++) {
      if (fitnesses[i] > fitnesses[bestIndex]) {
        bestIndex = i;
      }
    }
    champion = networks[bestIndex];
    championGeneration = generation;
    championScore = courseScores[bestIndex];
    const sortedScores = [...courseScores].sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    const median =
      sortedScores.length % 2 === 0
        ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
        : sortedScores[mid];
    const order = fitnesses
      .map((_, index) => index)
      .sort((a, b) => fitnesses[b] - fitnesses[a]);
    const eliteCount = Math.max(1, Math.floor(order.length * ELITE_FRACTION));
    const eliteFloorScore = courseScores[order[eliteCount - 1]];
    historyBestScores.push(championScore);
    historyMedianScores.push(median);
    historyEliteFloorScores.push(eliteFloorScore);
    drawGenerationHistory();
    if (championScore > allTimeBestScore) {
      allTimeBestScore = championScore;
      allTimeBestGeneration = generation;
      saveBest({
        generation: allTimeBestGeneration,
        bestScore: allTimeBestScore,
        courses: COURSES_PER_GENERATION,
        network: champion,
      });
    }
    networks = nextGeneration(networks, fitnesses, Math.random);
    sim = createSim(networks, Math.random);
    courseIndex = 0;
    resetCourseStats();
    generation += 1;
  }

  function onPopulationDead(): void {
    accumulateCourse();
    if (courseIndex + 1 < COURSES_PER_GENERATION) {
      courseIndex += 1;
      sim = createSim(networks, Math.random);
    } else {
      advanceGeneration();
    }
  }

  function resetTraining(): void {
    clearBest();
    networks = createPopulation(POPULATION_SIZE, Math.random);
    sim = createSim(networks, Math.random);
    generation = 1;
    allTimeBestScore = 0;
    allTimeBestGeneration = 0;
    champion = null;
    championGeneration = 0;
    championScore = 0;
    courseIndex = 0;
    resetCourseStats();
    historyBestScores = [];
    historyMedianScores = [];
    historyEliteFloorScores = [];
    winner = null;
    winnerGeneration = 0;
    winnerScore = 0;
    trainingStopped = false;
    downloadButton.disabled = true;
    drawGenerationHistory();
  }

  function enterShowcase(): void {
    showcaseActive = true;
    pendingSteps = 0;
    const network = showcaseNetwork ?? champion;
    if (network) {
      const gen = showcaseNetwork ? showcaseGeneration : championGeneration;
      const score = showcaseNetwork ? showcaseScore : championScore;
      showcaseSim = createSim([network], Math.random);
      showcaseModelLine.textContent = `Running ${showcaseSource.toLowerCase()} model: gen ${gen} (score ${score})`;
      showcaseDiagram.update(network, `${showcaseSource} g${gen} (${score})`);
    } else {
      showcaseSim = null;
      showcaseModelLine.textContent =
        "No model yet: train first or import a winner file below.";
      showcaseDiagram.update(null, "");
    }
  }

  function exitShowcase(): void {
    showcaseActive = false;
    showcaseSim = null;
    pendingSteps = 0;
  }

  function applyImport(record: SavedBest, source: "Imported" | "Pretrained") {
    showcaseNetwork = record.network;
    showcaseGeneration = record.generation;
    showcaseScore = record.bestScore;
    showcaseSource = source;
    enterShowcase();
  }

  function runPretrained(): void {
    try {
      const record = parseSavedBest(JSON.stringify(pretrainedModel));
      applyImport(record, "Pretrained");
      importStatus.className = "ai-import-status ok";
      importStatus.textContent = `Running bundled model: gen ${record.generation}, score ${record.bestScore}.`;
    } catch {
      importStatus.className = "ai-import-status error";
      importStatus.textContent = "Bundled pretrained model is invalid";
    }
  }

  function cycleSpeed(): void {
    if (showcaseActive) {
      return;
    }
    speedIndex = (speedIndex + 1) % SPEED_STEPS.length;
    speedButton.textContent = `Speed: ${SPEED_LABELS[speedIndex]}`;
  }

  function drawChampionDiagram(): void {
    networkDiagram.update(
      champion,
      champion ? `Champion g${championGeneration} (${championScore})` : "",
    );
  }

  function updatePanel(): void {
    if (showcaseActive) {
      return;
    }
    if (champion !== drawnChampion) {
      drawnChampion = champion;
      drawChampionDiagram();
    }
    const now = performance.now();
    if (now - lastPanelUpdate < PANEL_UPDATE_INTERVAL_MS) {
      return;
    }
    lastPanelUpdate = now;
    let alive = 0;
    let genBestScore = 0;
    for (let i = 0; i < sim.population.length; i++) {
      const entry = sim.population[i];
      if (entry.alive) {
        alive += 1;
      }
      const total = courseScores[i] + entry.score;
      if (total > genBestScore) {
        genBestScore = total;
      }
    }
    statEls[0].textContent = `Generation ${generation}`;
    statEls[1].textContent = `Course ${courseIndex + 1}/${COURSES_PER_GENERATION}`;
    statEls[2].textContent = `Alive ${alive}/${sim.population.length}`;
    statEls[3].textContent = `Gen best ${genBestScore}`;
    statEls[4].textContent = `All-time best ${allTimeBestScore} (gen ${allTimeBestGeneration})`;
    statEls[5].textContent = `Speed ${SPEED_LABELS[speedIndex]}`;
    statEls[6].textContent = winner
      ? `WINNER gen ${winnerGeneration} score ${winnerScore}`
      : "";
  }

  function checkWinner(): boolean {
    for (const entry of sim.population) {
      if (entry.score >= WINNING_SCORE) {
        declareWinner(entry.network, entry.score);
        return true;
      }
    }
    return false;
  }

  function declareWinner(network: Network, score: number): void {
    winner = network;
    winnerGeneration = generation;
    winnerScore = score;
    trainingStopped = true;
    pendingSteps = 0;
    champion = network;
    championGeneration = generation;
    championScore = score;
    if (score > allTimeBestScore) {
      allTimeBestScore = score;
      allTimeBestGeneration = generation;
      saveBest({
        generation,
        bestScore: score,
        courses: COURSES_PER_GENERATION,
        network,
      });
    }
    downloadButton.disabled = false;
  }

  function downloadWinner(): void {
    if (!winner) {
      return;
    }
    const record: SavedBest = {
      generation: winnerGeneration,
      bestScore: winnerScore,
      courses: COURSES_PER_GENERATION,
      network: winner,
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `flappy-winner-g${winnerGeneration}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function draw(steps: number): void {
    groundOffset = (groundOffset + SPEED * steps) % GROUND_TILE_WIDTH;
    animationStep += steps;
    const activeSim = showcaseActive ? showcaseSim : sim;
    if (activeSim) {
      drawScene(context, textures, activeSim.tubes);
      context.globalAlpha = showcaseActive ? 1 : BIRD_ALPHA;
      for (const entry of activeSim.population) {
        if (entry.alive) {
          drawBird(context, textures, entry.bird, "running", animationStep);
        }
      }
      context.globalAlpha = 1;
      drawGround(context, textures, groundOffset);
      let bestScore = 0;
      for (const entry of activeSim.population) {
        if (entry.score > bestScore) {
          bestScore = entry.score;
        }
      }
      drawScore(context, fontBitmap, bestScore);
    } else {
      drawScene(context, textures, idleTubes);
      drawGround(context, textures, groundOffset);
    }
    updatePanel();
  }

  function frame(): void {
    const now = performance.now();
    const elapsed = Math.min(
      now - previousTime,
      MAX_DELTA_STEPS * BASE_STEP_MS,
    );
    previousTime = now;
    let steps = 0;
    if (showcaseActive) {
      if (showcaseSim) {
        pendingSteps += elapsed / BASE_STEP_MS;
        steps = Math.floor(pendingSteps);
        pendingSteps -= steps;
        for (let i = 0; i < steps; i++) {
          if (allDead(showcaseSim)) {
            showcaseSim = createSim(
              [showcaseSim.population[0].network],
              Math.random,
            );
          }
          stepPopulation(showcaseSim, 1, Math.random);
        }
      } else {
        pendingSteps = 0;
      }
    } else if (!trainingStopped) {
      pendingSteps += (elapsed / BASE_STEP_MS) * SPEED_STEPS[speedIndex];
      steps = Math.floor(pendingSteps);
      pendingSteps -= steps;
      for (let i = 0; i < steps; i++) {
        if (allDead(sim)) {
          onPopulationDead();
        }
        stepPopulation(sim, 1, Math.random);
        if (checkWinner()) {
          break;
        }
      }
    }
    draw(steps);
    rafId = window.requestAnimationFrame(frame);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "f") {
      cycleSpeed();
    } else if (key === "r") {
      if (showcaseActive) {
        showTab("training");
      }
      resetTraining();
    } else if (key === "d") {
      downloadWinner();
    } else if (key === "n") {
      exit();
    }
  }

  function exit(): void {
    stop();
    onExit();
  }

  function stop(): void {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    tabBar.remove();
    trainingContent.remove();
    showcaseContent.remove();
    panel.classList.remove("ai-on");
    if (ownsPanel) {
      panel.remove();
    }
    window.dispatchEvent(new Event("resize"));
  }

  let ownsPanel = false;
  let panel: HTMLElement;
  const existingPanel = document.querySelector<HTMLElement>("#ai-panel");
  if (existingPanel) {
    panel = existingPanel;
  } else {
    ownsPanel = true;
    panel = document.createElement("aside");
    panel.className = "ai-panel";
  }

  const statsBlock = document.createElement("div");
  statsBlock.className = "ai-stats";
  const statEls: HTMLDivElement[] = [];
  for (let i = 0; i < 7; i++) {
    const line = document.createElement("div");
    if (i === 6) {
      line.className = "winner";
    }
    statsBlock.append(line);
    statEls.push(line);
  }
  const hint = document.createElement("div");
  hint.className = "dim";
  hint.textContent = "F speed | R reset | D download | N exit";
  statsBlock.append(hint);

  const graphBlock = document.createElement("div");
  const scoreGraph = createScoreGraph(graphBlock);

  const networkBlock = document.createElement("div");
  const networkDiagram = createNetworkDiagram(networkBlock);
  drawGenerationHistory();

  const controlsBlock = document.createElement("div");
  controlsBlock.className = "ai-panel-controls";
  const speedButton = document.createElement("button");
  speedButton.type = "button";
  speedButton.textContent = `Speed: ${SPEED_LABELS[speedIndex]}`;
  speedButton.addEventListener("click", () => {
    speedButton.blur();
    cycleSpeed();
  });
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset training (R)";
  resetButton.addEventListener("click", () => {
    resetButton.blur();
    resetTraining();
  });
  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.textContent = "Download winner (D)";
  downloadButton.disabled = true;
  downloadButton.addEventListener("click", () => {
    downloadButton.blur();
    downloadWinner();
  });
  controlsBlock.append(speedButton, resetButton, downloadButton);

  function showTab(name: "training" | "showcase"): void {
    trainingContent.classList.toggle("active", name === "training");
    showcaseContent.classList.toggle("active", name === "showcase");
    trainingTabButton.classList.toggle("active", name === "training");
    showcaseTabButton.classList.toggle("active", name === "showcase");
    if (name === "showcase") {
      enterShowcase();
    } else {
      exitShowcase();
    }
  }

  const tabBar = document.createElement("div");
  tabBar.className = "ai-tabs";
  const trainingTabButton = document.createElement("button");
  trainingTabButton.type = "button";
  trainingTabButton.textContent = "Training";
  trainingTabButton.addEventListener("click", () => {
    trainingTabButton.blur();
    showTab("training");
  });
  const showcaseTabButton = document.createElement("button");
  showcaseTabButton.type = "button";
  showcaseTabButton.textContent = "Showcase";
  showcaseTabButton.addEventListener("click", () => {
    showcaseTabButton.blur();
    showTab("showcase");
  });
  tabBar.append(trainingTabButton, showcaseTabButton);

  const trainingContent = document.createElement("div");
  trainingContent.className = "ai-tab-content ai-tab-training";
  trainingContent.append(statsBlock, graphBlock, networkBlock, controlsBlock);

  const showcaseModelLine = document.createElement("div");
  showcaseModelLine.className = "ai-showcase-model";
  const showcaseDiagramBlock = document.createElement("div");
  const showcaseDiagram = createNetworkDiagram(showcaseDiagramBlock);

  const importHint = document.createElement("div");
  importHint.className = "ai-import-hint";
  importHint.textContent =
    "Import a winner JSON (saved with Download winner) to watch that network play instead.";
  const importLabel = document.createElement("label");
  importLabel.className = "ai-import-label";
  importLabel.textContent = "Choose winner file…";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.addEventListener("change", () => {
    void onFileChosen();
  });
  importLabel.append(fileInput);
  const importStatus = document.createElement("div");
  importStatus.className = "ai-import-status";
  const pretrainedButton = document.createElement("button");
  pretrainedButton.type = "button";
  pretrainedButton.className = "ai-pretrained-button";
  pretrainedButton.textContent = "Run pretrained model";
  pretrainedButton.addEventListener("click", () => {
    pretrainedButton.blur();
    runPretrained();
  });
  const importBlock = document.createElement("div");
  importBlock.className = "ai-import-controls";
  importBlock.append(pretrainedButton, importLabel, importStatus);
  const showcaseContent = document.createElement("div");
  showcaseContent.className = "ai-tab-content ai-tab-showcase";
  showcaseContent.append(
    showcaseModelLine,
    showcaseDiagramBlock,
    importHint,
    importBlock,
  );

  async function onFileChosen(): Promise<void> {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) {
      return;
    }
    try {
      const record = parseSavedBest(await file.text());
      applyImport(record, "Imported");
      importStatus.className = "ai-import-status ok";
      importStatus.textContent = `Running ${file.name}: gen ${record.generation}, score ${record.bestScore}.`;
    } catch (error) {
      importStatus.className = "ai-import-status error";
      importStatus.textContent =
        error instanceof Error ? error.message : "Import failed";
    }
  }

  showTab("training");
  panel.classList.add("ai-on");
  panel.append(tabBar, trainingContent, showcaseContent);
  if (ownsPanel) {
    (
      document.querySelector("#ai-side") ??
      canvas.closest("#stage") ??
      canvas.parentElement
    )?.append(panel);
  }
  window.dispatchEvent(new Event("resize"));

  window.addEventListener("keydown", onKeyDown);
  rafId = window.requestAnimationFrame(frame);

  return stop;
}

function isValidNetwork(network: unknown): network is Network {
  if (typeof network !== "object" || network === null) {
    return false;
  }
  const candidate = network as Network;
  if (
    !Array.isArray(candidate.layers) ||
    candidate.layers.length !== LAYER_SIZES.length - 1
  ) {
    return false;
  }
  for (let layer = 0; layer < candidate.layers.length; layer++) {
    const matrix = candidate.layers[layer];
    if (!Array.isArray(matrix) || matrix.length !== LAYER_SIZES[layer + 1]) {
      return false;
    }
    for (const row of matrix) {
      if (!Array.isArray(row) || row.length !== LAYER_SIZES[layer] + 1) {
        return false;
      }
      for (const weight of row) {
        if (typeof weight !== "number" || !Number.isFinite(weight)) {
          return false;
        }
      }
    }
  }
  return true;
}

function parseSavedBest(raw: string): SavedBest {
  let parsed: Partial<SavedBest>;
  try {
    parsed = JSON.parse(raw) as Partial<SavedBest>;
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (
    typeof parsed.generation !== "number" ||
    typeof parsed.bestScore !== "number" ||
    parsed.courses !== COURSES_PER_GENERATION ||
    !isValidNetwork(parsed.network)
  ) {
    throw new Error("Not a flappy winner file");
  }
  return {
    generation: parsed.generation,
    bestScore: parsed.bestScore,
    courses: parsed.courses,
    network: {
      ...parsed.network,
      mutationRate:
        typeof parsed.network.mutationRate === "number"
          ? parsed.network.mutationRate
          : DEFAULT_MUTATION_RATE,
      mutationStrength:
        typeof parsed.network.mutationStrength === "number"
          ? parsed.network.mutationStrength
          : DEFAULT_MUTATION_STRENGTH,
    },
  };
}

function loadBest(): SavedBest | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseSavedBest(raw);
  } catch {
    return null;
  }
}

function saveBest(record: SavedBest): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    return;
  }
}

function clearBest(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
