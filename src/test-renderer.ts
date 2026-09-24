import type { ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeAll, vi } from 'vitest';

import { setTheme } from '@/theme';

/**
 * What a test that mounts a real tree with `react-test-renderer` needs once, at the top of its file:
 * React told that state updates are made under `act`, the dark theme (as on the phone at night), and
 * the lines the renderer and `react-native-web` print about themselves on every render — which say
 * nothing about the code under test — kept off the run while every other warning and error goes
 * through. Imported by `*.test.tsx` only.
 */
const NOISE = /react-test-renderer is deprecated|useNativeDriver|pointerEvents is deprecated|textShadow/;

/** The trees `mounted()` was handed and that are still standing. */
const standing: ReactTestRenderer[] = [];

/**
 * Hands a tree to the harness so it is taken down when its test ends. A screen that reads again by
 * itself (the feed does, every few seconds, while something is being developed) keeps its timer for
 * as long as it is mounted — and a tree left standing by one test reads through the stand-in server
 * of the next, and counts its requests. Returns the tree, so a test writes
 * `tree = mounted(TestRenderer.create(…))`.
 */
export function mounted<T extends ReactTestRenderer>(tree: T): T {
  standing.push(tree);
  return tree;
}

export function mountsTrees() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  beforeAll(async () => {
    await setTheme('dark');
    for (const level of ['error', 'warn'] as const) {
      const print = console[level];
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        if (!NOISE.test(String(args[0]))) print(...args);
      });
    }
  });
  afterEach(async () => {
    await act(async () => {
      for (const tree of standing.splice(0)) tree.unmount();
    });
  });
}
