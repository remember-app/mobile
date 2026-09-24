import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import type { Label } from '@/api';
import { allDifferent, story } from '@/kit/story';
import { LabelNewSheet, LabelsSheet } from '@/memory/label-sheets';
import { setTheme, ThemePin } from '@/theme';

/**
 * `SheetLabels` and `SheetLabelNew` (spec 7.7, 10.8.1) — the two surfaces of the labels, drawn from
 * what they are handed and holding no material of their own. Every state the layout names is a
 * story here: reading, empty, the two groups, a row that cannot file, the edit mode, a refusal, and
 * the same sheet editing a label rather than making one.
 *
 * What a press *does* is `labels.test.ts`'s (`filing`, `filed`); these read the surface.
 */

beforeAll(async () => {
  await setTheme('dark');
});

const label = (over: Partial<Label> = {}): Label => ({
  id: '1',
  title: 'Лучшее',
  color: 1,
  shared: true,
  mine: true,
  can_edit: true,
  can_add_media: true,
  media_count: 23,
  ...over,
});

const mine = label({ id: '2', title: 'Любимые', shared: false, color: 6, media_count: 9 });

const sheet = (over: Partial<Parameters<typeof LabelsSheet>[0]> = {}) => (
  <LabelsSheet
    visible
    labels={[label(), mine]}
    count="4 кадра"
    inside={() => false}
    editing={false}
    busy={false}
    error={null}
    onToggleEdit={() => {}}
    onFile={() => {}}
    onNew={() => {}}
    onRename={() => {}}
    onDelete={() => {}}
    onClose={() => {}}
    {...over}
  />
);

test('the sheet says what it is about, counts what is marked and lays the labels in two groups', () => {
  const whole = story(sheet());
  for (const line of [
    'В лейбл',
    '4 кадра',
    'ОБЩИЕ',
    'Лучшее',
    '23 кадра',
    'видят все',
    'МОИ',
    'Любимые',
    '9 кадров',
    'только вы',
    'Новый лейбл',
  ]) {
    expect(whole).toContain(line);
  }
});

test('the circle is lit only where everything marked already lies', () => {
  allDifferent({
    out: sheet(),
    in: sheet({ inside: () => true }),
    // Half of the selection filed reads exactly as «не лежит» — that press adds the rest.
    half: sheet({ inside: (id: string) => id === '2' }),
  });
});

test('a label the server will not let this person fill is a row and not a button', () => {
  // A viewer on somebody else's shared label: no circle to press, and the row still says what it
  // is. The rule is the api's own `can_add_media` and is never worked out here.
  const shut = story(sheet({ labels: [label({ can_add_media: false, can_edit: false })] }));
  expect(shut).toContain('Лучшее');
  expect(shut).not.toContain('aria-label="Лучшее"');
  allDifferent({
    shut: sheet({ labels: [label({ can_add_media: false, can_edit: false })] }),
    filing: sheet({ labels: [label()] }),
  });
});

test('nothing filed anywhere yet: both groups go and one line says what a label is', () => {
  const empty = story(sheet({ labels: [] }));
  expect(empty).toContain('Лейбл — это коробка');
  expect(empty).not.toContain('ОБЩИЕ');
  expect(empty).not.toContain('МОИ');
  // The way to make the first one stays, and so does the heading.
  expect(empty).toContain('Новый лейбл');
  expect(empty).toContain('В лейбл');
  // And with nothing to edit there is no «Править» either (spec 10.8.1).
  expect(empty).not.toContain('Править');
});

test('the edit mode puts the pair where the circle was and goes quiet about the count', () => {
  const editing = story(sheet({ editing: true }));
  expect(editing).toContain('Переименовать «Лучшее»');
  expect(editing).toContain('Удалить «Лучшее»');
  expect(editing).toContain('Готово');
  // The row is no longer filing anything: its name is not a button's name any more.
  expect(editing).not.toMatch(/aria-label="Лучшее[,"]/);
  allDifferent({ filing: sheet(), editing: sheet({ editing: true }) });
});

test('somebody else’s label keeps no pair in the edit mode, and goes on filing', () => {
  // Spec 10.8.1, «Края»: the two buttons are not drawn at all where the server refused the right.
  const theirs = label({ can_edit: false });
  const editing = story(sheet({ labels: [theirs], editing: true }));
  expect(editing).not.toContain('Переименовать «Лучшее»');
  expect(editing).toMatch(/aria-label="Лучшее[,"]/);
  // With nothing of this person's to edit, the button that turns the mode on is not drawn either.
  expect(story(sheet({ labels: [theirs] }))).not.toContain('Править');
});

test('a refusal from the server is said in words, over a sheet that still works', () => {
  const refused = story(sheet({ error: 'Убрать кадры может тот, кто их положил, или организатор.' }));
  expect(refused).toContain('Убрать кадры может тот, кто их положил');
  // The list is still there under it — the sheet does not get stuck on a failure.
  expect(refused).toContain('Лучшее');
  // And a read that has not come back yet is a wait and not an empty list.
  const reading = story(sheet({ labels: null }));
  expect(reading).not.toContain('Лейбл — это коробка');
  allDifferent({ reading: sheet({ labels: null }), empty: sheet({ labels: [] }) });
});

const newSheet = (over: Partial<Parameters<typeof LabelNewSheet>[0]> = {}) => (
  <LabelNewSheet
    label={null}
    count={4}
    busy={false}
    error={null}
    onSubmit={() => {}}
    onCancel={() => {}}
    {...over}
  />
);

test('a new label: a name, the eight colours, who sees it, and what the button will file', () => {
  const made = story(newSheet());
  for (const line of [
    'Новый лейбл',
    'НАЗВАНИЕ',
    'ЦВЕТ',
    'КТО ВИДИТ',
    'Общий',
    'видят все участники',
    'Личный',
    'Создать и положить 4 кадра',
  ]) {
    expect(made).toContain(line);
  }
  // The eight are said out loud by their colours and not by their number (spec 10.4).
  expect(made).toContain('aria-label="жёлтый"');
  expect(made).toContain('aria-label="серый"');
});

test('editing one is the same sheet: the name and the colour, and who sees it only to read', () => {
  const editing = story(newSheet({ label: label({ shared: false }) }));
  expect(editing).toContain('Лейбл');
  expect(editing).toContain('Сохранить');
  // No count in the button, and the visibility is a value rather than a pair of tiles: the answer
  // was given at creation and the api has no way back (decision-12).
  expect(editing).not.toContain('Создать и положить');
  expect(editing).toContain('Выбирается один раз, при создании.');
  // The value is read out as one sentence and is not a control of any kind — not even a disabled
  // one, which would promise that one day it presses (spec 10.8.1).
  expect(editing).toContain('aria-label="Личный. только вы"');
  expect(editing).not.toContain('aria-label="Личный"');
  expect(editing).not.toContain('aria-label="Общий"');
  allDifferent({ making: newSheet(), editing: newSheet({ label: label() }) });
});

test('an empty name is a button that cannot be pressed', () => {
  // The api would refuse it anyway, and a round trip to say what the field already knows is a
  // round trip a person waits for.
  allDifferent({
    blank: newSheet(),
    named: newSheet({ label: label({ title: 'Лучшее', shared: true }) }),
  });
  expect(story(newSheet())).toContain('aria-disabled="true"');
  expect(story(newSheet({ label: label() }))).not.toContain('aria-disabled="true"');
});

test('both sheets are drawn in the theme the app is in', () => {
  // Every colour on them is a token, so daylight is a different sheet and the same words (spec 2).
  for (const node of [sheet(), newSheet()]) {
    const night = story(<ThemePin value="dark">{node}</ThemePin>);
    const day = story(<ThemePin value="light">{node}</ThemePin>);
    expect(day).not.toBe(night);
  }
  const day = story(<ThemePin value="light">{sheet()}</ThemePin>);
  expect(day).toContain('Лучшее');
  expect(day).toContain('видят все');
});
