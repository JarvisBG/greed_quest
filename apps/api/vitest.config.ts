import { defineConfig } from 'vitest/config';

// PGlite (WebAssembly) met plusieurs secondes à démarrer quand plusieurs fichiers tournent en parallèle.
export default defineConfig({
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
});
