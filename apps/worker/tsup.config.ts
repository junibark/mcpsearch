import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Worker is an internal app, no need for type declarations
  clean: true,
  sourcemap: true,
  target: 'node20',
  outDir: 'dist',
});
