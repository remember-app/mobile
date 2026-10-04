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
  expect(name, missing(`no rule «${css}»`)).toBeDefined();
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
  expect(name, missing(`no ${property} rule with «${css}»`)).toBeDefined();
  return name as string;
}

/**
 * Why a name is not in the sheet, said on top of what is not. The sheet this reads is filled by
 * drawing, so a name asked for before the component it belongs to has been drawn is either genuinely
 * absent — the declaration is gone from the code — or the ask came first and only a neighbour drew
 * one. A message naming only the missing value leaves those two looking the same, and the second
 * reads as a broken kit rather than as an order that was got wrong: green beside the neighbour, red
 * on its own, and nothing in the output saying the two are the same bug (TASK-526, TASK-528).
 */
const missing = (what: string) =>
  `${what} was drawn — asked before the thing it belongs to was. Draw the component first (story(…)), then ask: a name reached before its own drawing is only in the sheet because some other check drew one, so the check passes on that neighbour instead of on its own subject. If it was drawn and the name is still absent, the declaration itself is gone from the code — that is the other cause, and this is what tells the two apart.`;

const escaped = (css: string) => css.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
