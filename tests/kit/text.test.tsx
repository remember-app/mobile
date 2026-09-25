import { beforeAll, expect, test } from 'vitest';

import { allDifferent, story } from '@/kit/story';
import { fitCell, HiddenLabel, Text, type TextTone, type TypeRole } from '@/kit/text';
import { setTheme, type } from '@/theme';

/** Spec 3 — every type role and every tone words can be read in, drawn once each. */

beforeAll(async () => {
  await setTheme('dark');
});

const ROLES = Object.keys(type) as TypeRole[];

test('every role in the scale is a role the text can actually be asked for', () => {
  allDifferent(
    Object.fromEntries(ROLES.map((role) => [role, <Text role={role}>Воспоминания</Text>])),
  );
});

test('the two families are the two families, and each weight is its own loaded face', () => {
  // Spec 3: headings in Unbounded, everything else in Onest — and a weight is a family name here,
  // because asking a single-weight loaded face for a `fontWeight` makes Android synthesise one.
  for (const role of ROLES) {
    expect(type[role].fontFamily, role).toMatch(/^(Unbounded|Onest)_/);
    expect(type[role], role).not.toHaveProperty('fontWeight');
  }
  expect(type.hero.fontFamily).toBe('Unbounded_700Bold');
  expect(type.body.fontFamily).toBe('Onest_400Regular');
});

test('words are read in paper unless they are asked for in something else', () => {
  // React Native inherits no colour at all and falls back to black, so a role without one is black
  // on ink — invisible. This is the one place that pairs the two.
  expect(story(<Text>Абзац</Text>)).toBe(story(<Text tone="paper">Абзац</Text>));

  const tones: TextTone[] = [
    'paper',
    'muted',
    'faint',
    'accent',
    'spark',
    'sparkInk',
    'danger',
    'onFill',
  ];
  allDifferent(Object.fromEntries(tones.map((tone) => [tone, <Text tone={tone}>Абзац</Text>])));
});

test('meta and note bring muted with them, and spec 10.1 is why', () => {
  // `faint` is 3.8 : 1 on ink and the layout had it under running text; 10.1 settles that every
  // readable secondary line takes `muted` and `faint` keeps what is unavailable or decorative.
  expect(story(<Text role="meta">12 сентября</Text>)).toBe(
    story(
      <Text role="meta" tone="muted">
        12 сентября
      </Text>,
    ),
  );
  expect(story(<Text role="note">Чем точнее, тем меньше сюрпризов</Text>)).toBe(
    story(
      <Text role="note" tone="muted">
        Чем точнее, тем меньше сюрпризов
      </Text>,
    ),
  );
  // And `faint` is still reachable where the layout really means unavailable.
  expect(story(<Text role="meta">3 из 61</Text>)).not.toBe(
    story(
      <Text role="meta" tone="faint">
        3 из 61
      </Text>,
    ),
  );
});

test('every figure on screen is tabular, so a counter never dances', () => {
  expect(type.meta.fontVariant).toEqual(['tabular-nums']);
});

test('a label the eye does not need is still there for a screen reader', () => {
  // Spec 7.9: clipped to 1 × 1 rather than removed, because a placeholder is not a label.
  const hidden = story(<HiddenLabel>Ник</HiddenLabel>);
  expect(hidden).toContain('Ник');
  // Clipped rather than styled out of the way: nothing it shares with a line that is meant to be
  // read, which is the whole difference between a hidden label and an invisible one.
  expect(hidden).not.toBe(story(<Text role="label">Ник</Text>));
});

test('words in a cell the layout fixes grow as far as the cell holds them, and the cell grows down', () => {
  // A day of the calendar: two tabular figures in a 40 circle, 15 / 22 (TASK-372).
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // At the system's own size the cell is the layout's 40, whatever could be held back.
  expect(fitCell({ ...day, fontScale: 1, width: 40 }).height).toBe(40);
  // AX5 on the zoomed iPhone SE: the column is 37 wide, so the figures stop where two still fit…
  const tight = fitCell({ ...day, fontScale: 3.571, width: 37.4 });
  const most = tight.most ?? Number.POSITIVE_INFINITY;
  expect(15 * most * 1.35).toBeLessThanOrEqual(37.4 - 4 + 1e-9);
  expect(most).toBeLessThan(3.571);
  // …and the row grows under them instead, never under the 44 a finger needs.
  expect(tight.height).toBeGreaterThanOrEqual(44);
  expect(tight.height).toBeGreaterThanOrEqual(22 * most);
  // A cell with room to spare holds nothing back: the type grows as the phone asks.
  const roomy = fitCell({ ...day, fontScale: 1.2, width: 200 });
  expect(roomy.most).toBeGreaterThan(1.2);
  expect(roomy.height).toBe(Math.max(44, Math.ceil(22 * 1.2) + 4));
  // Not measured yet: nothing is held, and the cell is as tall as the type it will hold.
  expect(fitCell({ ...day, fontScale: 2, width: 0 })).toEqual({ most: undefined, height: 48 });
});

test('a cell is the layout’s own at the system’s size or smaller, and never below a finger from the first size up', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // Smaller than the system's default is the layout's cell too, whatever room the column has.
  for (const fontScale of [0.5, 0.85, 1])
    for (const width of [0, 10, 37.4, 400])
      expect(fitCell({ ...day, fontScale, width }).height, `×${fontScale} in ${width}`).toBe(40);
  // The first hair past the system's size is a 44 at least, and the tightest cell keeps to it.
  for (const width of [0, 20, 37.4, 400])
    expect(
      fitCell({ ...day, fontScale: 1.0001, width }).height,
      `in ${width}`,
    ).toBeGreaterThanOrEqual(44);
});

test('the type is held only to what the cell holds and never below the system’s own size, an unmeasured cell holds nothing', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // A column too narrow for even one size of it still shows the size the person has: it is the
  // cell that has to give, and the floor is the type's, not the cell's.
  expect(fitCell({ ...day, fontScale: 3, width: 10 }).most).toBe(1);
  expect(fitCell({ ...day, fontScale: 3, width: 4 }).most).toBe(1);
  // Nothing measured is nothing held — a width of nothing, and a width less than nothing.
  for (const width of [0, -1, -37.4])
    expect(fitCell({ ...day, fontScale: 3, width }).most).toBeUndefined();
  // Held to the column less 4, in em of the role's own size: 60 leaves 56 for 15 × 1.35 a size.
  expect(fitCell({ ...day, fontScale: 3.571, width: 60 }).most).toBeCloseTo(56 / (15 * 1.35), 6);
});

test('the cell grows down by the line the held type takes, rounded up, and 4 more — 44 at the least', () => {
  const day = { role: 'bodySm', em: 1.35, rest: 40 } as const;
  // Room to spare: the type is the system's own, 22 × 3.571 = 78.56, so 79 and 4.
  expect(fitCell({ ...day, fontScale: 3.571, width: 200 }).height).toBe(83);
  // Held to ×2.765 in a column of 60: 22 × 2.765 = 60.8, so 61 and 4 — not the 83 the system asked for.
  expect(fitCell({ ...day, fontScale: 3.571, width: 60 }).height).toBe(65);
  // Held to ×1.65 in the zoomed SE's 37.4: 37 and 4 is 41, and a finger wants 44.
  expect(fitCell({ ...day, fontScale: 3.571, width: 37.4 }).height).toBe(44);
});
