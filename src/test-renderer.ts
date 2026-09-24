import { beforeAll, vi } from 'vitest';

import { setTheme } from '@/theme';

/**
 * What a test that mounts a real tree with `react-test-renderer` needs once, at the top of its file:
 * React told that state updates are made under `act`, the dark theme (as on the phone at night), and
 * the lines the renderer and `react-native-web` print about themselves on every render — which say
 * nothing about the code under test — kept off the run while every other warning and error goes
 * through. Imported by `*.test.tsx` only.
 */
const NOISE = /react-test-renderer is deprecated|useNativeDriver|pointerEvents is deprecated|textShadow/;

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
}
