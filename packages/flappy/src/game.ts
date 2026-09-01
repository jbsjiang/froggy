import { startAiGame } from "./aiGame";
import { loadFontBitmap, loadTextures } from "./assets";
import { checkCollision } from "./collision";
import {
  BIRD_HEIGHT,
  GROUND_HEIGHT,
  GROUND_TILE_WIDTH,
  MAX_DELTA_STEPS,
  MAX_VELOCITY,
  SCREEN_HEIGHT,
  SPEED,
} from "./constants";
import { updateBird } from "./physics";
import { drawBird, drawGround, drawScene, drawScore } from "./render";
import { createTubes, updateTubes } from "./tubes";
import type { Bird, GameState, Textures, Tube } from "./types";

const MIN_CANVAS_WIDTH = 360;

export function startGame(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): () => void {
  const toggleButton = document.querySelector<HTMLButtonElement>("#ai-toggle");
  const textures: Textures = loadTextures();
  const fontBitmap = loadFontBitmap();
  let stopNormal: (() => void) | null = null;
  let stopAi: (() => void) | null = null;
  let aiActive = false;

  function updateToggleButton(): void {
    if (toggleButton) {
      toggleButton.textContent = aiActive
        ? "AI Mode: On (N)"
        : "AI Mode: Off (N)";
      toggleButton.classList.toggle("on", aiActive);
    }
  }

  function enterNormalMode(): void {
    if (stopAi) {
      stopAi();
      stopAi = null;
    }
    aiActive = false;
    updateToggleButton();
    stopNormal = runNormalGame(
      canvas,
      context,
      textures,
      fontBitmap,
      enterAiMode,
    );
  }

  function enterAiMode(): void {
    if (stopNormal) {
      stopNormal();
      stopNormal = null;
    }
    aiActive = true;
    updateToggleButton();
    stopAi = startAiGame(
      canvas,
      context,
      textures,
      fontBitmap,
      enterNormalMode,
    );
  }

  function updateScreenSize(): void {
    const stage = canvas.closest<HTMLElement>("#stage");
    const side = document.querySelector<HTMLElement>(".ai-side");
    const stageWidth =
      stage?.clientWidth ?? document.documentElement.clientWidth;
    const stageTop = stage
      ? stage.getBoundingClientRect().top + window.scrollY
      : 0;
    const height = Math.max(window.innerHeight - stageTop, 0);
    const reservedWidth = side ? side.offsetWidth + 16 : 0;
    const sideBySideWidth = stageWidth - reservedWidth;
    const sideBySide = sideBySideWidth >= MIN_CANVAS_WIDTH;
    const width = sideBySide ? sideBySideWidth : stageWidth;
    let canvasHeight: number;
    if (width > height * 0.75) {
      canvas.style.width = `${height * 0.75}px`;
      canvas.style.height = `${height}px`;
      canvasHeight = height;
    } else {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${width * 1.333}px`;
      canvasHeight = width * 1.333;
    }
    if (stage) {
      stage.classList.toggle("stacked", !sideBySide);
      stage.style.height = sideBySide ? `${canvasHeight}px` : "";
    }
  }

  function onToggleClick(): void {
    if (!toggleButton) {
      return;
    }
    toggleButton.blur();
    if (aiActive) {
      enterNormalMode();
    } else {
      enterAiMode();
    }
  }

  function dispose(): void {
    if (stopNormal) {
      stopNormal();
      stopNormal = null;
    }
    if (stopAi) {
      stopAi();
      stopAi = null;
    }
    aiActive = false;
    window.removeEventListener("resize", updateScreenSize);
    toggleButton?.removeEventListener("click", onToggleClick);
  }

  toggleButton?.addEventListener("click", onToggleClick);

  updateScreenSize();
  window.addEventListener("resize", updateScreenSize);

  enterNormalMode();

  return dispose;
}

function runNormalGame(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  textures: Textures,
  fontBitmap: HTMLImageElement,
  onEnterAiMode: () => void,
): () => void {
  let state: GameState = "start";
  let bird: Bird = { yPosition: SCREEN_HEIGHT / 2, yVelocity: 0 };
  let tubes: Tube[] = createTubes();
  let groundOffset = 0;
  let animationStep = 0;
  let score = 0;
  let previousTime = performance.now();
  let input = false;
  let rafId = 0;

  function reset(): void {
    state = "start";
    bird = { yPosition: SCREEN_HEIGHT / 2, yVelocity: 0 };
    tubes = createTubes();
    score = 0;
  }

  function loop(): void {
    const currentTime = performance.now();
    const dt = Math.min(
      (currentTime - previousTime) / (1000 / 60),
      MAX_DELTA_STEPS,
    );
    previousTime = currentTime;

    switch (state) {
      case "start":
        groundOffset = (groundOffset + SPEED * dt) % GROUND_TILE_WIDTH;
        animationStep += dt;
        drawScene(context, textures, tubes);
        drawBird(context, textures, bird, state, animationStep);
        drawGround(context, textures, groundOffset);
        if (input) {
          updateBird(bird, dt, true);
          state = "running";
        }
        break;
      case "running":
        groundOffset = (groundOffset + SPEED * dt) % GROUND_TILE_WIDTH;
        animationStep += dt;
        score += updateTubes(tubes, dt);
        updateBird(bird, dt, input);
        if (checkCollision(bird, tubes)) {
          state = "gameOver";
        }
        drawScene(context, textures, tubes);
        drawBird(context, textures, bird, state, animationStep);
        drawGround(context, textures, groundOffset);
        drawScore(context, fontBitmap, score);
        break;
      case "gameOver":
        if (bird.yPosition < SCREEN_HEIGHT - BIRD_HEIGHT / 2 - GROUND_HEIGHT) {
          bird.yVelocity = MAX_VELOCITY;
          bird.yPosition = Math.min(
            bird.yPosition + MAX_VELOCITY * dt,
            SCREEN_HEIGHT - BIRD_HEIGHT / 2 - GROUND_HEIGHT,
          );
        } else if (input) {
          reset();
        }
        drawScene(context, textures, tubes);
        drawBird(context, textures, bird, state, animationStep);
        drawGround(context, textures, groundOffset);
        drawScore(context, fontBitmap, score);
        break;
    }
    input = false;
    rafId = window.requestAnimationFrame(loop);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      input = true;
    }
    if (event.key === "n" || event.key === "N") {
      onEnterAiMode();
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    input = true;
  }

  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerdown", onPointerDown);

  rafId = window.requestAnimationFrame(loop);

  return function dispose(): void {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerdown", onPointerDown);
  };
}
