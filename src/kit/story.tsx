import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet } from 'react-native';
import { expect } from 'vitest';

/**
 * The harness the stories are written on. There is no Storybook in this project and no room for
 * one — the product is a phone app and a browser is not where it is checked (README, «Чего здесь
 * нет»). A story here is a test: every variant and every state of every part is rendered through
 * `react-native-web` and read back, which is the same question a story answers — «does this state
 * exist, and does it look like itself» — asked in a way that fails a build instead of a person.
 *
 * Imported only by `*.test.tsx`, so nothing in it reaches the bundle.
 *
 * What the markup shows and what it does not: a style built per render — anything that comes out of
 * a `themed()` lookup or a ternary — is written into the output as `style="…"`, colours and all; a
 * style from `StyleSheet.create` is compiled to a class hash instead. So a colour that has two
 * answers can be read off directly, while a shape can only be told apart from another shape. Both
 * are covered below.
 */

/** One state of one part, rendered the way a story would show it. */
export function story(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

/**
 * Every rule the styles drawn so far in this file have compiled to. A style from `StyleSheet.create`
 * is a class in the markup and its values live here, so this is how a colour a component put in a
 * sheet — the text colour of a line over a photograph, say — is read at all.
 */
export function compiled(): string {
  return (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet().textContent;
}

/**
 * The class a compiled rule was given — how a shape set in a sheet is found in the markup. One
 * declaration is one class wherever it is drawn, so this names the value and not the part.
 */
export function rule(css: string): string {
  const name = new RegExp(`\\.(r-[A-Za-z]+-[a-z0-9]+)\\{${css};\\}`).exec(compiled())?.[1];
  expect(name, `no rule «${css}» was drawn`).toBeDefined();
  return name as string;
}

/**
 * Every named state draws differently from every other one. This is what a story board is for: a
 * state nobody can tell from its neighbour is not a state, and the way it usually happens is a
 * branch that was written and then never wired to a style.
 */
export function allDifferent(states: Record<string, ReactElement>): void {
  const drawn = new Map<string, string>();
  for (const [name, node] of Object.entries(states)) {
    const markup = story(node);
    for (const [other, seen] of drawn) {
      expect(markup, `«${name}» and «${other}» are drawn the same`).not.toBe(seen);
    }
    drawn.set(name, markup);
  }
}
