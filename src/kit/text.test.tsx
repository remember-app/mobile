import { beforeAll, expect, test } from 'vitest';

import { allDifferent, story } from '@/kit/story';
import { HiddenLabel, Text, type TextTone, type TypeRole } from '@/kit/text';
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

  const tones: TextTone[] = ['paper', 'muted', 'faint', 'accent', 'spark', 'sparkInk', 'danger', 'onFill'];
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
