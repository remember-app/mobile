import { beforeAll, expect, test } from 'vitest';

import { Segment } from '@/kit/segment';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3 — the choice of two or three, drawn as a row of pills inside one. */

beforeAll(async () => {
  await setTheme('dark');
});

const FACES = [
  { value: 'frames', label: 'Кадры' },
  { value: 'films', label: 'Ролики' },
  { value: 'people', label: 'Люди' },
] as const;

test('every value is on screen at once, and the chosen one is the only one filled', () => {
  const row = story(<Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />);
  for (const face of FACES) expect(row).toContain(face.label);
  // #0B0B12 on the chosen pill; the rest stay muted at #A4A1B2.
  expect(row).toContain('rgba(11,11,18,1.00)');
  expect(row).toContain('rgba(164,161,178,1.00)');
});

test('moving the choice moves the fill, and nothing else about the row', () => {
  allDifferent(
    Object.fromEntries(
      FACES.map((face) => [
        face.value,
        <Segment label="Лицо" options={FACES} value={face.value} onChange={() => {}} />,
      ]),
    ),
  );
});

test('the row is a radiogroup and each pill is a radio, so a switch reads as a switch', () => {
  const row = story(<Segment label="Лицо" options={FACES} value="films" onChange={() => {}} />);
  expect(row).toContain('role="radiogroup"');
  expect(row).toContain('aria-label="Лицо"');
  expect(row.match(/role="radio"/g)).toHaveLength(FACES.length);
});

test('the two heights, the two widths and the two grounds are each their own', () => {
  allDifferent({
    plain: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />,
    small: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} sm />,
    wide: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} wide />,
    inSheet: <Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} onSurface />,
  });
});

test('a long word steps down a size instead of wrapping or being cut', () => {
  const themes = [
    { value: 'system', label: 'Как в телефоне' },
    { value: 'dark', label: 'Тёмная' },
    { value: 'light', label: 'Светлая' },
  ] as const;
  expect(
    story(<Segment label="Тема" options={themes} value="system" onChange={() => {}} />),
  ).not.toBe(story(<Segment label="Лицо" options={FACES} value="frames" onChange={() => {}} />));
});

test('the heading over the row can be spoken without being drawn, and the hint is read out', () => {
  const shown = story(<Segment label="Тема" options={FACES} value="frames" onChange={() => {}} />);
  const bare = story(
    <Segment label="Тема" options={FACES} value="frames" onChange={() => {}} hideLabel />,
  );
  expect(shown).toContain('>Тема<');
  expect(bare).not.toContain('>Тема<');
  expect(bare).toContain('aria-label="Тема"');

  const withHint = story(
    <Segment
      label="Тема"
      options={FACES}
      value="frames"
      onChange={() => {}}
      hint="Меняется сразу — этот экран и есть образец"
    />,
  );
  expect(withHint).toContain('Меняется сразу — этот экран и есть образец');
});
