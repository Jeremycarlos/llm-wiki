import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    "@llm-wiki/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    "@llm-wiki/llm": fileURLToPath(new URL("./packages/llm/src/index.ts", import.meta.url)),
    "@llm-wiki/ingestion": fileURLToPath(new URL("./packages/ingestion/src/index.ts", import.meta.url)),
  } },
  test: {
    environment: "node",
    globals: false,
  },
});
