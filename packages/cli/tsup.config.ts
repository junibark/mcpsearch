import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: 'node18',
  // Bundle workspace dependencies so CLI is self-contained
  noExternal: ['@mcpsearch/shared'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
