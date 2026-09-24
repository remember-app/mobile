import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeAll, vi } from 'vitest';

import { setTheme, themes } from '@/theme';

/**
 * What a test that mounts a real tree with `react-test-renderer` needs once, at the top of its file:
 * React told that state updates are made under `act`, the dark theme (as on the phone at night), and
 * the lines the renderer and `react-native-web` print about themselves on every render — which say
 * nothing about the code under test — kept off the run while every other warning and error goes
 * through. Imported by `*.test.tsx` only.
 */
const NOISE =
  /react-test-renderer is deprecated|useNativeDriver|pointerEvents is deprecated|textShadow/;

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

/**
 * Which theme a drawn screen is in, read off the styles it hands down: the colours the night has and
 * the day does not, and the other way round, that turn up anywhere in the tree. A screen in daylight
 * that carries one of the night's is a place that drew itself in a fixed set — the mistake the light
 * theme cannot show anyone in the theme they wrote it in. Both lists are of tokens that differ between
 * the themes, so a colour the two share (the accent) says nothing about either.
 */
export function themesShown(root: ReactTestInstance): { night: string[]; day: string[] } {
  const own = (theme: 'dark' | 'light') =>
    new Set(
      Object.values(themes[theme].color).filter(
        (value): value is string => typeof value === 'string',
      ),
    );
  const [dark, light] = [own('dark'), own('light')];
  const styles = root
    .findAll(() => true)
    .map((node) =>
      Object.entries(node.props)
        // `style`, `contentContainerStyle`, `columnWrapperStyle`: every prop that carries a style.
        .filter(([key, value]) => /style$/i.test(key) && typeof value !== 'function')
        .map(([, value]) => JSON.stringify(value ?? null))
        .join(''),
    )
    .join('|')
    .toLowerCase();
  const found = (only: Set<string>, other: Set<string>) =>
    [...only].filter((value) => !other.has(value) && styles.includes(value.toLowerCase()));
  return { night: found(dark, light), day: found(light, dark) };
}
