import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // The carrying-capacity workspace preserves its standalone Node test suite.
    // It is run by npm run test:carrying-capacity after this Vitest suite.
    exclude: ['**/node_modules/**', '**/dist/**', 'packages/carrying-capacity/test/**'],
    testTimeout: 30000
  }
});
