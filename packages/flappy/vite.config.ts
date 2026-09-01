/// <reference types="vitest/config" />
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/main.ts",
        "src/index.ts",
        "src/game.ts",
        "src/aiGame.ts",
        "src/render.ts",
        "src/scoreGraph.ts",
        "src/networkDiagram.ts",
        "src/assets.ts",
        "src/svg.ts",
        "src/types.ts",
      ],
    },
  },
});
