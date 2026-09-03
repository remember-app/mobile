import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The app resolves `@/…` through tsconfig `paths`, which vite does not read. This one alias lets a
// test import a module exactly the way every other file in `src/` does. Keyed on `@/` and not `@`
// so it cannot swallow a scoped package name.
export default defineConfig({
  resolve: { alias: { '@/': fileURLToPath(new URL('./src/', import.meta.url)) } },
});
