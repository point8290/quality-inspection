import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Reducers and sagas are pure functions — no DOM, so no jsdom to install or explain.
    environment: 'node',
  },
});
