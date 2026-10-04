import { rule, shorthand } from '@tests/helpers/css';
import { expect, test } from 'vitest';

import { Chip } from '@/kit/chip';
import { story } from '@/kit/story';

/**
 * The trap `tests/helpers/css.ts` exists to make loud, checked as the helper itself rather than left
 * to the next person who reads the comment on `rule()` and does not stop for it.
 *
 * The sheet `rule()` reads is filled by drawing. Ask it for a name before drawing the component that
 * name belongs to, and the answer belongs to a neighbour: red on its own, green beside whoever drew
 * one first, the two disagreeing with nothing in the output to say why. That happened five times in
 * one stage (TASK-526) — and the check written next was written in exactly that order, which is what
 * TASK-528 is about. Fixing the five cases is not a fix for the case that comes next.
 *
 * So the message is pinned here. If this file stops failing, the helper has gone back to naming only
 * what is missing, and whoever writes check number six inherits the silent version.
 */

test('a name asked before anything is drawn says it was asked too early', () => {
  expect(() => rule('padding-left:6px')).toThrow('asked before the thing it belongs to was');
  // The other cause stays named as well: a declaration gone from the code is indistinguishable from
  // an early ask unless the message carries both, and dropping one re-creates the same silence.
  expect(() => rule('padding-left:6px')).toThrow('the declaration itself is gone from the code');
});

test('the same for a shorthand', () => {
  expect(() => shorthand('padding', 'padding-top:11px')).toThrow(
    'asked before the thing it belongs to was',
  );
});

test('drawn first, the same ask is answered', () => {
  story(<Chip label="Мысли" size={34} onPress={() => {}} />);
  expect(rule('padding-left:6px')).toMatch(/^r-paddingLeft-/);
});

test('a name no drawing has produced is still named in the message', () => {
  story(<Chip label="Мысли" size={34} onPress={() => {}} />);
  // The genuine absence, in a file that has drawn properly — it must not be reported as nothing.
  expect(() => rule('padding-left:6000px')).toThrow('padding-left:6000px');
});
