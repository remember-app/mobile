import { rule, shorthand } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { allDifferent, compiled, story } from '@/kit/story';
import { RowToggle, Toggle } from '@/kit/toggle';
import { font, setTheme } from '@/theme';

/** Spec 7.3 — the thing that is simply on or off. */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

test('on, off and unavailable are three states of one switch', () => {
  allDifferent({
    on: <Toggle label="Длилось больше дня" value onValueChange={() => {}} />,
    off: <Toggle label="Длилось больше дня" value={false} onValueChange={() => {}} />,
    disabled: <Toggle label="Длилось больше дня" value onValueChange={() => {}} disabled />,
  });
});

test('the switch is the layout’s 52 × 32 with a 26 white grip 3 in: at the right on `accent`, at the left on `raise` in a hairline', () => {
  const on = story(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />);
  const off = story(
    <Toggle label="Сможет добавлять фото" value={false} onValueChange={() => {}} />,
  );
  // `Account.json`, e34 and e35: the track 52 × 32 at x305, the grip 26 × 26 at x328 — 3 from the
  // track's right edge, which is 2 of padding inside a hairline of 1.
  for (const drawn of [on, off]) {
    for (const size of ['width:52px', 'height:32px', 'width:26px', 'height:26px', 'padding:2px'])
      expect(drawn).toContain(rule(size));
    expect(drawn).toContain(shorthand('borderWidth', 'border-top-width:1px'));
    expect(drawn).toContain(rule('background-color:rgba(255,255,255,1.00)'));
  }
  expect(on).toContain(rule('background-color:rgba(75,91,255,1.00)'));
  expect(on).toContain(rule('justify-content:flex-end'));
  // Spec 7.3, detail 17: off is `raise` with a `line` hairline and the grip pressed to the left.
  expect(off).toContain(rule('background-color:rgba(34,34,46,1.00)'));
  expect(off).toContain(shorthand('borderColor', 'border-top-color:rgba(44,44,58,1.00)'));
  expect(off).toContain(rule('justify-content:flex-start'));
});

test('the words beside it are its name, and pressing them flips it too', () => {
  const row = story(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />);
  expect(row).toContain('Сможет добавлять фото');
  // The whole row is the control — which is why the switch inside it is hidden from the reader.
  expect(row).toContain('role="switch"');
  expect(row).toContain('aria-label="Сможет добавлять фото"');
});

test('the row is as tall as the switch, 32, felt at 44, with its words at 15 / 500', async () => {
  // Spec 8, `SheetInvite` («строка-тумблер 32 «Сможет добавлять фото» 15 / 500») and
  // `SheetInvite.json` e7–e8: the row 358 × 32, the words 15 / 500. The row kept a floor of 44, so
  // the switch stood 6 lower under the field and «ИЗ КОНТАКТОВ» 12 lower than drawn.
  const row = story(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />);
  const own = /<div[^>]*role="switch"[^>]*class="([^"]*)"/.exec(row)?.[1] ?? '';
  expect(own).toContain(rule('min-height:32px'));
  const words = /class="([^"]*)"[^>]*>Сможет добавлять фото</.exec(row)?.[1] ?? '';
  expect(words).toContain(rule('font-size:15px'));
  expect(words).toContain(rule(`font-family:${font.medium}`));
  // Drawn at 32 and felt at a finger's 44: 6 more above and below (spec 10.2).
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />),
    );
  });
  const pressed = (tree as TestRenderer.ReactTestRenderer).root.find(
    (one) => one.props.accessibilityRole === 'switch' && one.props.hitSlop !== undefined,
  );
  expect(pressed.props.hitSlop).toEqual({ left: 0, right: 0, top: 6, bottom: 6 });
});

/** Spec 7.7, detail 59 — the same switch given a place to stand. */

test('the switch in a card is on or off, and says nothing but its name', () => {
  const card = (value: boolean) => (
    <RowToggle label="Даты между днями" value={value} onValueChange={() => {}} />
  );
  allDifferent({ on: card(true), off: card(false) });

  const drawn = story(card(true));
  // One control to a screen reader, and one line of words: spec 59 puts nothing under the name.
  expect(drawn).toContain('role="switch"');
  expect(drawn).toContain('aria-label="Даты между днями"');
  expect(drawn.match(/dir="auto"/g)).toHaveLength(1);
});

test('the card stands on the screen’s `surface`, 26 round, and not on a sheet’s `ink`', () => {
  story(<RowToggle label="Даты между днями" value onValueChange={() => {}} />);
  const rules = compiled();
  expect(rules).toContain('background-color:rgba(22,22,31,1.00)');
  expect(rules).toContain('border-top-left-radius:26px');
});
