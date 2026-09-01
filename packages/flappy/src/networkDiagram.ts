import { TUBE_COUNT } from "./constants";
import { svgElement } from "./svg";
import type { Network } from "./types";

const VIEW_WIDTH = 214;
const VIEW_HEIGHT = 250;
const POSITIVE_WEIGHT_COLOR = "#6FCF97";
const NEGATIVE_WEIGHT_COLOR = "#EB5757";
const INPUT_LABELS = [
  "Y",
  "Vy",
  ...Array.from({ length: TUBE_COUNT }, (_, tube) => [
    `D${tube + 1}`,
    `G${tube + 1}`,
  ]).flat(),
];

export interface NetworkDiagram {
  update(network: Network | null, title: string): void;
}

export function createNetworkDiagram(container: HTMLElement): NetworkDiagram {
  const diagram = svgElement("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    class: "ai-network",
  });
  container.append(diagram);

  function update(network: Network | null, title: string): void {
    diagram.replaceChildren(
      svgElement("rect", {
        x: 0,
        y: 0,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
        fill: "rgba(0, 0, 0, 0.35)",
      }),
    );
    if (title) {
      const titleText = svgElement("text", {
        x: VIEW_WIDTH / 2,
        y: 8,
        "text-anchor": "middle",
        "dominant-baseline": "hanging",
        fill: "#fff",
        "font-size": 11,
        "font-weight": "bold",
      });
      titleText.textContent = title;
      diagram.append(titleText);
    }
    if (!network) {
      const empty = svgElement("text", {
        x: VIEW_WIDTH / 2,
        y: VIEW_HEIGHT / 2,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "#aaa",
        "font-size": 11,
      });
      empty.textContent = "no champion yet";
      diagram.append(empty);
      return;
    }

    const graphTop = 22;
    const graphBottom = VIEW_HEIGHT - 8;
    const sizes = [INPUT_LABELS.length, ...network.layers.map((m) => m.length)];
    const columnX: number[] = [];
    const firstX = 30;
    const lastX = VIEW_WIDTH - 34;
    for (let column = 0; column < sizes.length; column++) {
      columnX.push(firstX + ((lastX - firstX) * column) / (sizes.length - 1));
    }

    function nodeY(column: number, index: number): number {
      return (
        graphTop + ((index + 0.5) / sizes[column]) * (graphBottom - graphTop)
      );
    }

    const edges = svgElement("g", { opacity: 0.75 });
    for (let layer = 0; layer < network.layers.length; layer++) {
      for (let dest = 0; dest < network.layers[layer].length; dest++) {
        const row = network.layers[layer][dest];
        for (let source = 0; source < row.length - 1; source++) {
          const weight = row[source];
          edges.append(
            svgElement("line", {
              x1: columnX[layer],
              y1: nodeY(layer, source),
              x2: columnX[layer + 1],
              y2: nodeY(layer + 1, dest),
              stroke:
                weight >= 0 ? POSITIVE_WEIGHT_COLOR : NEGATIVE_WEIGHT_COLOR,
              "stroke-width": Math.max(
                0.5,
                Math.min(3, Math.abs(weight) * 1.5),
              ),
            }),
          );
        }
      }
    }
    diagram.append(edges);

    for (let column = 0; column < sizes.length; column++) {
      const radius = column === 0 || column === sizes.length - 1 ? 4.5 : 3.5;
      for (let index = 0; index < sizes[column]; index++) {
        diagram.append(
          svgElement("circle", {
            cx: columnX[column],
            cy: nodeY(column, index),
            r: radius,
            fill: "#e8e8e8",
            stroke: "#666",
            "stroke-width": 1,
          }),
        );
      }
    }

    for (let input = 0; input < INPUT_LABELS.length; input++) {
      const label = svgElement("text", {
        x: columnX[0] - 9,
        y: nodeY(0, input),
        "text-anchor": "end",
        "dominant-baseline": "middle",
        fill: "#ddd",
        "font-size": 9,
      });
      label.textContent = INPUT_LABELS[input];
      diagram.append(label);
    }
    const flap = svgElement("text", {
      x: columnX[sizes.length - 1] + 10,
      y: (graphTop + graphBottom) / 2,
      "dominant-baseline": "middle",
      fill: "#ddd",
      "font-size": 9,
    });
    flap.textContent = "FLAP";
    diagram.append(flap);
  }

  return { update };
}
