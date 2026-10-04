import { expect } from 'vitest';

import { compiled } from '@/kit/story';

/**
 * The class a compiled rule was given — how a style set in a sheet is found in the markup, since a
 * style from `StyleSheet.create` is drawn as a class and not as `style="…"` (`src/kit/story.tsx`).
 * `css` is the rule as written, parentheses and all: `background-color:rgba(11,11,18,0.55)`. One
 * declaration is one class wherever it is drawn, so this names the value and not the part.
 *
 * Draw the thing the rule belongs to before asking for it: the sheet this reads is the one the
 * drawing fills, so a name asked for before its own component is drawn is only there because some
 * other check drew one, and the check passes on that neighbour instead of on its own subject —
 * green in the ordinary run, red run alone, and only as often as the order happens to fall
 * (TASK-526).
 */
export function rule(css: string): string {
  const name = new RegExp(`\\.(r-[A-Za-z]+-[a-z0-9]+)\\{${escaped(css)};\\}`).exec(compiled())?.[1];
  expect(name, `no rule «${css}» was drawn`).toBeDefined();
  return name as string;
}

/**
 * The same, for a style property that compiles to more than one declaration — `borderRadius` to its
 * four corners, `paddingHorizontal` to both sides, `overflow` to both axes: named by the property as
 * React Native spells it and one of the declarations it wrote.
 */
export function shorthand(property: string, css: string): string {
  const name = new RegExp(`\\.(r-${property}-[a-z0-9]+)\\{[^}]*${escaped(css)};`).exec(
    compiled(),
  )?.[1];
  expect(name, `no ${property} rule with «${css}» was drawn`).toBeDefined();
  return name as string;
}

const escaped = (css: string) => css.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
