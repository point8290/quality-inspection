import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Isolation lives here, not in the seeders (DESIGN.md §7.0): every test file shares
    // one SQLite file and truncates the mutable tables in beforeEach, so test files must
    // run one at a time — SQLite can't take parallel writers.
    fileParallelism: false,
    // Selects the `test` block in config/config.js (data/test.sqlite) — the same database
    // `pretest` drops, migrates, and seeds.
    env: { NODE_ENV: 'test' },
  },
});
