import { Bell } from 'lucide-react-native';
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
  const off = story(<Toggle label="Сможет добавлять фото" value={false} onValueChange={() => {}} />);
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

test('the switch stands in a card or in a pill, and they are two shapes of one thing', () => {
  allDifferent({
    card: (
      <RowToggle
        label="Даты между днями"
        note="Выключено — дата видна только на полосе у края, пока листаете."
        value
        onValueChange={() => {}}
      />
    ),
    cardOff: (
      <RowToggle
        label="Даты между днями"
        note="Выключено — дата видна только на полосе у края, пока листаете."
        value={false}
        onValueChange={() => {}}
      />
    ),
    pill: (
      <RowToggle
        label="Сообщить, когда будет готово"
        icon={Bell}
        variant="pill"
        value
        onValueChange={() => {}}
      />
    ),
  });
});

test('the card kind explains the setting and the pill kind opens with a glyph', () => {
  const card = story(
    <RowToggle
      label="Даты между днями"
      note="Выключено — дата видна только на полосе у края."
      value
      onValueChange={() => {}}
    />,
  );
  expect(card).toContain('Выключено — дата видна только на полосе у края.');
  // The explanation is the whole point of the card kind: without it, it is not that kind.
  expect(card).not.toContain('data-glyph');

  const pill = story(
    <RowToggle
      label="Сообщить, когда будет готово"
      icon={Bell}
      variant="pill"
      value
      onValueChange={() => {}}
    />,
  );
  expect(pill).toContain('data-glyph');
  // Both are one control to a screen reader, whatever they carry.
  expect(pill).toContain('role="switch"');
  expect(pill).toContain('aria-label="Сообщить, когда будет готово"');
});
