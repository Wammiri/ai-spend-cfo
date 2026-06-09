import { defineConfig } from "vitest/config";

// The deterministic compute layer (lib/metrics, lib/parsers, lib/memo) is plain
// TypeScript with no DOM, so the test environment is node. Tests are co-located
// as *.test.ts next to the code they prove (the architectural laws live here).
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["lib/**/*.test.ts"],
  },
});
