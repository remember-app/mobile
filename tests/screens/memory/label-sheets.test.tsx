import { beforeAll, expect, test, vi } from 'vitest';

// The words come from the dictionary, and the dictionary asks the phone which language it is in.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { label } from '@tests/helpers/labels';
import { Tag as TagIcon } from 'lucide-react-native';
import { allDifferent, story } from '@/kit/story';
import { LabelNewSheet, LabelsSheet } from '@/screens/memory/label-sheets';
import { setTheme, ThemePin } from '@/theme';

/**
 * `SheetLabels` and `SheetLabelNew` (spec 7.7, 10.8.1) — the two surfaces of the labels, drawn from
 * what they are handed and holding no material of their own. Every state the layout names is a
 * story here: reading, empty, the two groups, a row that cannot file, the edit mode, a failure, and
 * the same sheet editing a label rather than making one.
 *
 * What a press *does* is `labels.test.ts`'s (`filing`, `filed`); these read the surface.
 */

beforeAll(async () => {
  await setTheme('dark');
});

/**
 * Whether the row of a label is a button in this markup. Read by the name the row is announced
 * under, whatever the kit adds after it (its count, who sees it) — so the words after the name can
 * change without this test caring.
 */
const isButton = (markup: string, name: string) =>
  new RegExp(`aria-label="${name}[,"]`).test(markup);

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
  // No circle to press, and the row still says what it is. The rule is the api's own
  // `can_add_media` and is never worked out here.
  const shut = story(sheet({ labels: [label({ can_add_media: false, can_edit: false })] }));
  expect(shut).toContain('Лучшее');
  expect(isButton(shut, 'Лучшее')).toBe(false);
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
  expect(isButton(editing, 'Лучшее')).toBe(false);
  allDifferent({ filing: sheet(), editing: sheet({ editing: true }) });
});

test('a label the server will not let this person edit keeps no pair, and goes on filing', () => {
  // Spec 10.8.1, «Края»: the two buttons are not drawn at all where the server refused the right.
  const shut = label({ can_edit: false });
  const editing = story(sheet({ labels: [shut], editing: true }));
  expect(editing).not.toContain('Переименовать «Лучшее»');
  expect(isButton(editing, 'Лучшее')).toBe(true);
  // With nothing this person may edit, the button that turns the mode on is not drawn either.
  expect(story(sheet({ labels: [shut] }))).not.toContain('Править');
});

test('rights come from the flags the server sent and not from who made the label', () => {
  // Somebody else's shared label, which the server lets this person fill and edit (decision-12): the
  // circle and the pair are there although `mine` is false.
  const theirs = label({ mine: false });
  const editing = story(sheet({ labels: [theirs], editing: true }));
  expect(editing).toContain('Переименовать «Лучшее»');
  expect(editing).toContain('Удалить «Лучшее»');
  expect(isButton(story(sheet({ labels: [theirs] })), 'Лучшее')).toBe(true);
  // And the other way round: mine, and still no pair where the server withheld `can_edit`.
  const withheld = story(
    sheet({ labels: [label({ mine: true, can_edit: false })], editing: true }),
  );
  expect(withheld).not.toContain('Переименовать');
  // Only what came down is drawn: a viewer who has nobody's private label sees no «МОИ» group at all.
  const seen = story(sheet({ labels: [theirs] }));
  expect(seen).toContain('ОБЩИЕ');
  expect(seen).not.toContain('МОИ');
  expect(seen).not.toContain('Любимые');
});

test('a failure from the server is said in words, over a sheet that still works', () => {
  const failed = story(sheet({ error: { text: 'Этого лейбла больше нет.', icon: TagIcon } }));
  expect(failed).toContain('Этого лейбла больше нет.');
  // The list is still there under it — the sheet does not get stuck on a failure.
  expect(failed).toContain('Лучшее');
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
  // No count in the button, and the visibility is a value rather than a pair of tiles: it is
  // chosen at creation and changing it afterwards is not allowed (decision-12).
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
