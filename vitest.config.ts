import { defineConfig } from "vitest/config";

// The deterministic compute layer (lib/metrics, lib/parsers, lib/memo) is plain
// TypeScript with no DOM, so the test environment is node. Tests are co-located
// as *.test.ts next to the code they prove (the architectural laws live here).
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["lib/**/*.test.ts"],
    // Use the forks pool, not the default threads pool. On this Windows machine
    // the threads (worker_threads) pool crashes once several test files run
    // together with "Cannot read properties of undefined (reading 'config')" (a
    // worker-state race); forks runs each file in a child process and is stable.
    // B1 had only two files and never hit it; B2 added five more, which exposed it.
    pool: "forks",
  },
});
