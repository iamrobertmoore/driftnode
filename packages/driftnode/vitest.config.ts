import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: { reporter: ['text', 'lcov'] },

    // Vitest defaults to 5 seconds, which suits pure unit tests. Several tests
    // here spawn the TypeScript compiler to check that generated code really
    // compiles, and tsc takes one to five seconds depending on the machine.
    //
    // On a developer laptop those finish in about a second. On CI runners they
    // took 3.8s, 4.1s and 4.9s, and one hit 5.011s and failed. The tests were
    // correct, the budget was wrong.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
