import { svgElement } from "./svg";

const VIEW_WIDTH = 214;
const VIEW_HEIGHT = 130;
const LEFT = 8;
const RIGHT = VIEW_WIDTH - 8;
const TOP = 30;
const BOTTOM = VIEW_HEIGHT - 14;
const BEST_SCORE_COLOR = "#F2C94C";
const MEDIAN_SCORE_COLOR = "#6FCF97";
const ELITE_FLOOR_COLOR = "#56CCF2";

export interface ScoreGraph {
  update(
    bestScores: readonly number[],
    medianScores: readonly number[],
    eliteFloorScores: readonly number[],
  ): void;
}

export function createScoreGraph(container: HTMLElement): ScoreGraph {
  container.classList.add("ai-graph-wrap");
  const graph = svgElement("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    class: "ai-graph",
  });
  const tooltip = document.createElement("div");
  tooltip.className = "ai-graph-tooltip";
  container.append(graph, tooltip);

  let highlight: SVGGElement | null = null;

  function clearHighlight(): void {
    if (highlight) {
      highlight.remove();
      highlight = null;
    }
    tooltip.style.display = "none";
  }

  function update(
    bestScores: readonly number[],
    medianScores: readonly number[],
    eliteFloorScores: readonly number[],
  ): void {
    clearHighlight();
    graph.replaceChildren(
      svgElement("rect", {
        x: 0,
        y: 0,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
        fill: "rgba(0, 0, 0, 0.35)",
      }),
    );
    const title = svgElement("text", {
      x: VIEW_WIDTH / 2,
      y: 4,
      "text-anchor": "middle",
      "dominant-baseline": "hanging",
      fill: "#fff",
      "font-size": 11,
      "font-weight": "bold",
    });
    title.textContent = "Score per generation";
    graph.append(title);

    if (bestScores.length === 0) {
      const empty = svgElement("text", {
        x: VIEW_WIDTH / 2,
        y: VIEW_HEIGHT / 2,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "#aaa",
        "font-size": 11,
      });
      empty.textContent = "no generations yet";
      graph.append(empty);
      return;
    }

    const legend = [
      ["best", BEST_SCORE_COLOR],
      ["med", MEDIAN_SCORE_COLOR],
      ["elite", ELITE_FLOOR_COLOR],
    ] as const;
    for (let i = 0; i < legend.length; i++) {
      const [label, color] = legend[i];
      const text = svgElement("text", {
        x: VIEW_WIDTH - 4 - i * 34,
        y: 20,
        "text-anchor": "end",
        "dominant-baseline": "middle",
        fill: color,
        "font-size": 9,
      });
      text.textContent = label;
      graph.append(text);
    }

    let maxValue = 1;
    for (let i = 0; i < bestScores.length; i++) {
      maxValue = Math.max(maxValue, bestScores[i], medianScores[i]);
    }
    const roundScale = 10 ** Math.floor(Math.log10(maxValue));
    maxValue = Math.ceil(maxValue / roundScale) * roundScale;

    const count = bestScores.length;
    const xAt = (index: number): number =>
      count === 1
        ? (LEFT + RIGHT) / 2
        : LEFT + ((RIGHT - LEFT) * index) / (count - 1);
    const yAt = (value: number): number =>
      BOTTOM - ((BOTTOM - TOP) * value) / maxValue;

    graph.append(
      svgElement("line", {
        x1: LEFT,
        y1: BOTTOM,
        x2: RIGHT,
        y2: BOTTOM,
        stroke: "#555",
        "stroke-width": 1,
      }),
    );

    const series = [
      [eliteFloorScores, ELITE_FLOOR_COLOR],
      [medianScores, MEDIAN_SCORE_COLOR],
      [bestScores, BEST_SCORE_COLOR],
    ] as const;
    for (const [scores, color] of series) {
      let d = "";
      for (let i = 0; i < scores.length; i++) {
        d += `${i === 0 ? "M" : "L"}${xAt(i)} ${yAt(scores[i])} `;
      }
      graph.append(
        svgElement("path", {
          d,
          fill: "none",
          stroke: color,
          "stroke-width": 1.5,
        }),
      );
    }

    const axisLabels = [
      [String(maxValue), LEFT, TOP - 8, "start"],
      ["0", RIGHT, BOTTOM + 8, "end"],
      ["g1", LEFT, BOTTOM + 8, "start"],
      [`g${count}`, RIGHT - 18, BOTTOM + 8, "start"],
    ] as const;
    for (const [label, x, y, anchor] of axisLabels) {
      const text = svgElement("text", {
        x,
        y,
        "text-anchor": anchor,
        "dominant-baseline": "middle",
        fill: "#ddd",
        "font-size": 9,
      });
      text.textContent = label;
      graph.append(text);
    }

    for (let i = 0; i < count; i++) {
      const x = xAt(i);
      const left = i === 0 ? LEFT : (xAt(i - 1) + x) / 2;
      const right = i === count - 1 ? RIGHT : (x + xAt(i + 1)) / 2;
      const band = svgElement("rect", {
        x: left,
        y: TOP - 6,
        width: right - left,
        height: BOTTOM - TOP + 6,
        fill: "transparent",
      });
      band.addEventListener("mouseenter", () => {
        clearHighlight();
        highlight = svgElement("g");
        highlight.append(
          svgElement("line", {
            x1: x,
            y1: TOP,
            x2: x,
            y2: BOTTOM,
            stroke: "#fff",
            opacity: 0.4,
            "stroke-width": 1,
          }),
          svgElement("circle", {
            cx: x,
            cy: yAt(bestScores[i]),
            r: 3,
            fill: BEST_SCORE_COLOR,
          }),
          svgElement("circle", {
            cx: x,
            cy: yAt(medianScores[i]),
            r: 3,
            fill: MEDIAN_SCORE_COLOR,
          }),
          svgElement("circle", {
            cx: x,
            cy: yAt(eliteFloorScores[i]),
            r: 3,
            fill: ELITE_FLOOR_COLOR,
          }),
        );
        graph.append(highlight);

        const heading = document.createElement("div");
        heading.textContent = `g${i + 1}`;
        tooltip.replaceChildren(
          heading,
          ...(
            [
              ["best", bestScores[i], BEST_SCORE_COLOR],
              ["med", medianScores[i], MEDIAN_SCORE_COLOR],
              ["elite", eliteFloorScores[i], ELITE_FLOOR_COLOR],
            ] as [string, number, string][]
          ).map(([label, value, color]) => {
            const row = document.createElement("div");
            const dot = document.createElement("span");
            dot.className = "ai-graph-dot";
            dot.style.background = color;
            const name = document.createElement("span");
            name.textContent = `${label} ${value}`;
            row.append(dot, name);
            return row;
          }),
        );
        tooltip.style.display = "block";
        const containerWidth = container.clientWidth;
        const tooltipWidth = tooltip.offsetWidth;
        const px = (x / VIEW_WIDTH) * containerWidth;
        const clamped = Math.max(
          tooltipWidth / 2 + 2,
          Math.min(px, containerWidth - tooltipWidth / 2 - 2),
        );
        tooltip.style.left = `${clamped}px`;
      });
      band.addEventListener("mouseleave", clearHighlight);
      graph.append(band);
    }
  }

  return { update };
}
