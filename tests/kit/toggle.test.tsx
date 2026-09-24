import { beforeAll, expect, test } from 'vitest';

import { allDifferent, story } from '@/kit/story';
import { RowToggle, Toggle } from '@/kit/toggle';
import { setTheme } from '@/theme';

/** Spec 7.3 — the thing that is simply on or off. */

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

test('on is accent, off is raise, and the grip is white on both sides', () => {
  const on = story(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />);
  const off = story(
    <Toggle label="Сможет добавлять фото" value={false} onValueChange={() => {}} />,
  );
  expect(on).toContain('rgba(75,91,255,1.00)');
  expect(off).toContain('rgba(34,34,46,1.00)');
  for (const drawn of [on, off]) expect(drawn).toContain('rgba(255,255,255,1.00)');
});

test('the words beside it are its name, and pressing them flips it too', () => {
  const row = story(<Toggle label="Сможет добавлять фото" value onValueChange={() => {}} />);
  expect(row).toContain('Сможет добавлять фото');
  // The whole row is the control — which is why the switch inside it is hidden from the reader.
  expect(row).toContain('role="switch"');
  expect(row).toContain('aria-label="Сможет добавлять фото"');
});

/** Spec 7.7, detail 59 — the same switch given a place to stand. */

test('the switch in a card is on or off, and explains what it reaches', () => {
  const card = (value: boolean) => (
    <RowToggle
      label="Даты между днями"
      note="Выключено — дата видна только на полосе у края, пока листаете."
      value={value}
      onValueChange={() => {}}
    />
  );
  allDifferent({ on: card(true), off: card(false) });

  const drawn = story(card(true));
  expect(drawn).toContain('Выключено — дата видна только на полосе у края, пока листаете.');
  // One control to a screen reader, whatever it carries.
  expect(drawn).toContain('role="switch"');
  expect(drawn).toContain('aria-label="Даты между днями"');
});
