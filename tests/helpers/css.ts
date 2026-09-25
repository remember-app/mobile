import { expect } from 'vitest';

import { compiled } from '@/kit/story';

/**
 * The class a compiled rule was given — how a style set in a sheet is found in the markup, since a
 * style from `StyleSheet.create` is drawn as a class and not as `style="…"` (`src/kit/story.tsx`).
 * `css` is the rule as written, parentheses and all: `background-color:rgba(11,11,18,0.55)`.
 */
export function rule(css: string): string {
  const literal = css.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = new RegExp(`\\.(r-[A-Za-z]+-[a-z0-9]+)\\{${literal};\\}`).exec(compiled())?.[1];
  expect(name, `no rule «${css}» was drawn`).toBeDefined();
  return name as string;
}
