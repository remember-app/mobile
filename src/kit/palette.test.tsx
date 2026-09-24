import { beforeAll, expect, test } from 'vitest';

import { Palette } from '@/kit/palette';
import { allDifferent, compiled, story } from '@/kit/story';
import { labelColors, setTheme, themes } from '@/theme';

/** Spec 7.3, detail 20 — the eight colours a label can be. */

beforeAll(async () => {
  await setTheme('dark');
});

const COLORS = labelColors(themes.dark);
const NAMES = [
  'жёлтый',
  'розовый',
  'красный',
  'зелёный',
  'голубой',
  'фиолетовый',
  'кислотный',
  'серый',
];

test('all eight colours of the palette are offered, and each one says its own name', () => {
  const row = story(
    <Palette colors={COLORS} names={NAMES} value={COLORS[1]} onChange={() => {}} label="Цвет лейбла" />,
  );
  expect(COLORS).toHaveLength(8);
  // Spec 10.4: «Цвет 2» tells nobody anything — the colours are named in words.
  for (const name of NAMES) expect(row).toContain(`aria-label="${name}"`);
  expect(row).toContain('role="radiogroup"');
  expect(row).toContain('role="radio"');
});

test('the last two colours are the theme’s own, so the palette turns with the theme', async () => {
  // Spec 2: six fixed values, then `spark` and `muted` — which is why this is a function of the
  // theme and not a constant.
  expect(labelColors(themes.dark).at(-2)).toBe(themes.dark.color.spark);
  expect(labelColors(themes.light).at(-2)).toBe(themes.light.color.spark);
  expect(labelColors(themes.dark)).not.toEqual(labelColors(themes.light));
});

test('the chosen colour wears the double ring, and nothing else does', () => {
  const chosen = story(
    <Palette colors={COLORS} names={NAMES} value={COLORS[1]} onChange={() => {}} label="Цвет" />,
  );
  // 3px of the surface it stands on, then 2px of `paper` — a mark that reads on all eight.
  expect(chosen).toContain('0 0 0 3px #16161F, 0 0 0 5px #F5F3EE');
  // One ring in the row, because one colour is chosen.
  expect(chosen.match(/0 0 0 3px/g)).toHaveLength(1);
  allDifferent({
    first: <Palette colors={COLORS} names={NAMES} value={COLORS[0]} onChange={() => {}} label="Цвет" />,
    second: <Palette colors={COLORS} names={NAMES} value={COLORS[1]} onChange={() => {}} label="Цвет" />,
  });
});

test('the inner ring is drawn in whatever the circles stand on', () => {
  const inSheet = story(
    <Palette colors={COLORS} names={NAMES} value={COLORS[0]} onChange={() => {}} label="Цвет" />,
  );
  const onScreen = story(
    <Palette
      colors={COLORS}
      names={NAMES}
      value={COLORS[0]}
      onChange={() => {}}
      on="#0B0B12"
      label="Цвет"
    />,
  );
  expect(inSheet).toContain('3px #16161F');
  expect(onScreen).toContain('3px #0B0B12');
});

test('the row is as tall as the finger, because the slop round a 36 circle cannot leave it', () => {
  // Spec 1.6 and 10.2: drawn 36, felt 44. `hitSlop` is clipped to the view the button stands in, so
  // on a row exactly 36 tall the four points above and below each circle would be dead.
  story(<Palette colors={COLORS} names={NAMES} value={COLORS[0]} onChange={() => {}} label="Цвет лейбла" />);
  expect(compiled()).toContain('min-height:44px');
});
