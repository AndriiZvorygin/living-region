import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    // Some deployment tooling leaves untracked transpiled .js siblings next
    // to the canonical TypeScript sources. Unit tests must exercise the same
    // TypeScript implementation used by tsx rather than that stale copy.
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  test: {
    // The carrying-capacity workspace preserves its standalone Node test suite.
    // It is run by npm run test:carrying-capacity after this Vitest suite.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/carrying-capacity/test/**',
      'tests/e2e/**',
    ],
    testTimeout: 30000
  }
});
