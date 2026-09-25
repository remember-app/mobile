import { rule } from '@tests/helpers/css';
import { Camera, ImageIcon, Link2Off } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Button } from '@/kit/button';
import { Empty, Spinner, type SpinnerSize, Waiting } from '@/kit/empty';
import { allDifferent, story } from '@/kit/story';
import { font, setTheme, space, spinner } from '@/theme';

/** Spec 7.9 — a screen with nothing on it yet, and a screen still waiting for something. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the signs an empty state can wear are each their own sign', () => {
  allDifferent({
    dashed: (
      <Empty
        icon={ImageIcon}
        title="Ни одного кадра"
        text="Всё, что добавит любой участник, появится здесь."
      />
    ),
    line: (
      <Empty
        sign="line"
        icon={Link2Off}
        title="Приглашение не действует"
        text="Эту ссылку отозвали или заменили новой."
      />
    ),
    spark: (
      <Empty sign="spark" icon={Camera} title="Здесь пока пусто" text="Заведите воспоминание." />
    ),
  });
});

test('the heading names what is missing and the paragraph says what to do', () => {
  const empty = story(
    <Empty
      icon={ImageIcon}
      title="Ни одного кадра"
      text="Всё, что добавит любой участник, появится здесь. Начните со своих."
    />,
  );
  expect(empty).toContain('Ни одного кадра');
  expect(empty).toContain('Начните со своих');
  expect(empty).toContain('role="heading"');
});

test('the sign only repeats the words, so it says nothing of its own', () => {
  expect(story(<Empty icon={ImageIcon} text="Пусто" />)).not.toContain('aria-label');
});

test('the sign inside the spark ring is read in full voice, and a dimmed circle in a dimmed one', () => {
  // Spec 7.9: the `spark` circle is a call to act, so its glyph is `paper` — #F5F3EE — like the
  // heading under it; the dashed circle only reports an absence and keeps `faint` — #6E6B7D.
  expect(story(<Empty sign="spark" icon={Camera} text="Заведите воспоминание." />)).toContain(
    'stroke="#F5F3EE"',
  );
  for (const sign of ['dashed', 'line'] as const) {
    expect(story(<Empty sign={sign} icon={ImageIcon} text="Пусто" />)).toContain(
      'stroke="#6E6B7D"',
    );
  }
});

test('the block breathes at two rhythms — 22 under the sign, 12 inside the words', () => {
  const empty = story(
    <Empty
      icon={ImageIcon}
      title="Ни одного кадра"
      text="Всё, что добавит участник, будет здесь."
    />,
  );
  // Spec 7.9 gives the sign and the paragraph two different distances, and one distance for both is
  // exactly what this looked like before: two gaps, not one repeated.
  const gaps = new Set([...empty.matchAll(/r-gap-\w+/g)].map(([found]) => found));
  expect(gaps.size).toBe(2);
});

test('waiting holds the place of the list instead of blinking over it', () => {
  allDifferent({
    empty: <Empty icon={ImageIcon} text="Пока никого" />,
    waiting: <Empty busy text="Собираем ваши воспоминания…" />,
  });
  // No sign at all while it waits — the spinner is what stands there.
  expect(story(<Empty busy icon={ImageIcon} text="Собираем…" />)).not.toContain('data-glyph');
});

test('the action belongs to the bottom layer, and anything else handed over stands under the words', () => {
  const withButton = story(
    <Empty icon={ImageIcon} title="Ни одного кадра" text="Начните со своих.">
      <Button variant="secondary" label="Добавить кадры" />
    </Empty>,
  );
  expect(withButton).toContain('Добавить кадры');
});

test('the spinner turns at the four sizes the layout uses', () => {
  const sizes: SpinnerSize[] = [spinner.tile, spinner.card, spinner.join, spinner.screen];
  allDifferent(Object.fromEntries(sizes.map((size) => [String(size), <Spinner size={size} />])));
  // TASK-383, measured off the layout's own rendering: `HomeLoading.json` e4 and
  // `InviteJoining.json` e2 are 44 × 44 and 40 × 40 — the spec's 38 and 34 are the CSS box inside a
  // 3px ring, and the ring drawn here counts its border in. Back at 38 / 34 it is 13 % short.
  expect([spinner.screen, spinner.join]).toEqual([44, 40]);
  expect(story(<Spinner size={spinner.join} />)).toContain('width:40px');
  expect(story(<Spinner />)).toContain('width:40px');
  // The lit arc is `spark` over `raise` — #E4FF4F on #22222E.
  expect(story(<Spinner size={spinner.join} />)).toContain('rgba(228,255,79,1.00)');
  expect(story(<Spinner size={spinner.join} />)).toContain('rgba(34,34,46,1.00)');
  // A button waiting borrows it in its own colours.
  expect(story(<Spinner size={16} track="#FFFFFF" head="transparent" />)).toContain(
    'rgba(255,255,255,1.00)',
  );
});

test('waiting says what is being waited for, at the size of a whole screen unless told', () => {
  const waiting = story(<Waiting text="Собираем ваши воспоминания…" />);
  expect(waiting).toContain('Собираем ваши воспоминания…');
  expect(waiting).toContain('width:44px');
  // The empty state waiting in the place of its list turns at the same size.
  expect(story(<Empty busy text="Собираем…" />)).toContain('width:44px');
  expect(story(<Waiting text="Готовим…" size={spinner.card} />)).toContain('width:26px');
});

test('the line under the ring is 15 / 500 muted, 18 under it', () => {
  // Spec 7.9, detail 70 and `HomeLoading.json`: the ring 372…416, «Собираем ваши воспоминания…»
  // at 434 — 18 — in Onest 15 / 500 #A4A1B2. It was the paragraph's 400, 16 under the ring.
  const waiting = story(<Waiting text="Собираем ваши воспоминания…" />);
  expect(waiting).toContain(rule('gap:18px'));
  const words = waiting.match(/class="([^"]*)"[^>]*>Собираем ваши воспоминания…</)?.[1] ?? '';
  expect(words).toContain(rule(`font-family:${font.medium}`));
  expect(words).toContain(rule('font-size:15px'));
  expect(words).toContain(rule('color:rgba(164,161,178,1.00)'));
});

test('an empty state stands 36 in from the screen, and its paragraph takes all of that width', () => {
  // TASK-383: `HomeEmpty.json` e8 — the paragraph is x36 w318 of 390 and runs to three lines, where
  // 48 in and a 300 cap made it four. The screen gives its own 16, the block the other 20.
  const empty = story(
    <Empty sign="spark" icon={Camera} title="Здесь пока пусто" text="Заведите воспоминание." />,
  );
  const side = 36 - space.s4;
  expect(empty).toContain(rule(`padding-left:${side}px;padding-right:${side}px`));
  expect(empty).not.toContain('r-maxWidth');
});

test('the spark sign is ringed outside its 96, the way the layout draws it', () => {
  // `HomeEmpty.html`: `box-shadow: 0 0 0 2px #E4FF4F` round a 96 — 100 across as measured, where a
  // border inside the 96 drew 96 and moved everything under it.
  const empty = story(<Empty sign="spark" icon={Camera} text="Заведите воспоминание." />);
  expect(empty).toContain(rule('box-shadow:0 0 0 2px #E4FF4F'));
  expect(empty).toContain(rule('width:96px'));
  expect(empty).not.toContain('r-borderWidth');
});

test('each sign carries the glyph its kind is drawn with: 40 in the spark and the solid ring, 38 dashed', () => {
  // Spec 7.9, detail 69 and 10.11 («знаки по видам»): `HomeEmpty.json` e6 and `InviteDead.json` e2
  // are 40, the dashed sign of `FramesEmpty` 38 — all at 1.5.
  const glyph = (sign: 'spark' | 'line' | 'dashed') =>
    /data-glyph="\w+" width="(\d+)"/.exec(
      story(<Empty sign={sign} icon={Camera} text="Пусто" />),
    )?.[1];
  expect([glyph('spark'), glyph('line'), glyph('dashed')]).toEqual(['40', '40', '38']);
});
