import { beforeAll, expect, test } from 'vitest';

import { LengthSlider } from '@/kit/slider';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3, detail 19 — how long the film should be. */

beforeAll(async () => {
  await setTheme('dark');
});

const PRESETS = [
  { label: '0:30', value: 30 },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '3:00', value: 180 },
  { label: 'Всё', value: 550 },
];

function slider(props: Partial<Parameters<typeof LengthSlider>[0]> = {}) {
  return (
    <LengthSlider
      value={150}
      onChange={() => {}}
      min={10}
      max={550}
      valueLabel="2:30"
      note="из шаблона «Для родителей»"
      minLabel="0:10"
      maxLabel="9:10 · всё, что есть"
      label="Длина"
      shorterLabel="Короче на 5 секунд"
      longerLabel="Длиннее на 5 секунд"
      presets={PRESETS}
      {...props}
    />
  );
}

test('the card carries the figure, the two buttons, the line and the five ready answers', () => {
  const card = story(slider());
  expect(card).toContain('2:30');
  expect(card).toContain('из шаблона «Для родителей»');
  expect(card).toContain('0:10');
  expect(card).toContain('9:10 · всё, что есть');
  expect(card).toContain('aria-label="Короче на 5 секунд"');
  for (const preset of PRESETS) expect(card).toContain(`>${preset.label}<`);
});

test('the line is something a screen reader can take hold of, not a picture of a number', () => {
  const card = story(slider());
  // «adjustable» on a phone, which the web this harness renders through calls `slider`.
  expect(card).toContain('role="slider"');
  expect(card).toContain('aria-label="Длина"');
  expect(card).toContain('aria-valuemin="10"');
  expect(card).toContain('aria-valuemax="550"');
  expect(card).toContain('aria-valuenow="150"');
  // And it is read out as the figure on the card, not as a count of seconds.
  expect(card).toContain('aria-valuetext="2:30"');
});

test('at the walls the buttons stop offering what there is no material for', () => {
  const full = story(slider({ value: 550, valueLabel: '9:10' }));
  const empty = story(slider({ value: 10, valueLabel: '0:10' }));
  expect(full).toContain('aria-disabled="true"');
  expect(empty).toContain('aria-disabled="true"');
  expect(story(slider())).not.toContain('aria-disabled="true"');
});

test('a preset the value stands on is the chosen one, and the others are not', () => {
  allDifferent({
    between: slider({ value: 150 }),
    onPreset: slider({ value: 60, valueLabel: '1:00' }),
  });
  // Chosen: filled with `paper` and read in `ink`, the same pair every chosen pill in the kit wears.
  expect(story(slider({ value: 60, valueLabel: '1:00' }))).toContain('rgba(11,11,18,1.00)');
});

test('a card without ready answers is the same card, minus the row of them', () => {
  const bare = story(slider({ presets: undefined }));
  expect(bare).not.toContain('>0:30<');
  expect(bare).toContain('2:30');
});
