import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The app resolves `@/…` through tsconfig `paths`, which vite does not read. This one alias lets a
// test import a module exactly the way every other file in `src/` does. Keyed on `@/` and not `@`
// so it cannot swallow a scoped package name.
export default defineConfig({
  resolve: { alias: { '@/': fileURLToPath(new URL('./src/', import.meta.url)) } },
  // Tests live in `src/` and nowhere else. Spelled out because the default pattern sweeps the whole
  // tree: a git worktree under `.claude/worktrees/` is a second copy of every test file, and the
  // run then reports on a mixture of this checkout and a stale one — twice the tests, half of them
  // about code that is not here. The api repo carries the same line for the same reason (d371e2a).
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
