import { defineConfig } from 'vitest/config';

// Security-rules tests talk to the Firestore emulator, so they are slower than the unit tests and
// live in their own config: `npm run test:rules` (needs Java for the emulator).
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 20_000, hookTimeout: 30_000 },
});
