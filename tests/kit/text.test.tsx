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
