import { Pressable } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { BadgeMontage } from '@/kit/badge';
import { Button } from '@/kit/button';
import { CardMontage, CardMontageNew, EmptyMontages } from '@/kit/card-montage';
import { allDifferent, compiled, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { mountsTrees } from '@/test-renderer';
import { setTheme } from '@/theme';

/** Spec 7.6 — the strip of montages over a memory's feed: a card, the way to start one, and none. */

const POSTER = 'https://bucket.example/poster.jpg';
const SHOTS = ['https://bucket.example/1.jpg', 'https://bucket.example/2.jpg'];

/** The bars of a card's scale, in order — the only children the scale has. */
const barsOf = (markup: string) =>
  markup.slice(markup.indexOf('role="progressbar"')).match(/<div class="[^"]*"><\/div>/g) ?? [];

/** The colour a bar is filled with, read out of the rule its class compiled to (`story.tsx`). */
const fillOf = (bar: string) => {
  const name = bar.match(/r-backgroundColor-[a-z0-9]+/)?.[0];
  return compiled().match(new RegExp(`\\.${name}\\{background-color:([^;]+);\\}`))?.[1];
};

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

test('ready, building and broken are three cards and not three colours of one', () => {
  allDifferent({
    ready: (
      <CardMontage
        title="Ролик на 1:00"
        meta="14 сентября · Тёплая"
        state="ready"
        poster={POSTER}
        badge={<BadgeMontage state="ready" label="Готов" />}
      />
    ),
    pending: (
      <CardMontage
        title="Ролик на 2:00"
        state="pending"
        poster={POSTER}
        badge={<BadgeMontage state="pending" label="Собирается" />}
        step={{ at: 3, of: 5, count: '3 из 5' }}
      />
    ),
    failed: (
      <CardMontage
        title="Ролик на 2:00"
        state="failed"
        caption="Сборка оборвалась на полпути"
        badge={<BadgeMontage state="failed" label="Не собрался" />}
      >
        <Button variant="secondary" size="sm" label="Повторить" />
      </CardMontage>
    ),
    large: (
      <CardMontage
        title="Ролик на 2:30"
        meta="2:30 · 16:9"
        state="ready"
        poster={POSTER}
        large
        badge={<BadgeMontage state="ready" label="Готов" />}
      />
    ),
  });
});

test('a card still being cut shows its own frame out of focus rather than no frame at all', () => {
  const pending = story(
    <CardMontage title="Ролик" state="pending" poster={POSTER} step={{ at: 3, of: 5, count: '3 из 5' }} />,
  );
  const ready = story(<CardMontage title="Ролик" state="ready" poster={POSTER} />);
  // Same still, drawn differently: there is something there and it is not ready to be looked at.
  expect(pending).not.toBe(ready);
  expect(pending).toContain('3 из 5');
});

test('the scale of five is lit up to the stage in hand, as many bars as the count says', () => {
  const scale = (at: number) =>
    story(<CardMontage title="Ролик" state="pending" step={{ at, of: 5, count: `${at} из 5` }} />);
  expect(scale(3)).toContain('role="progressbar"');
  // Five bars and not four: the scale says «of five» by being five, whatever the count beside it
  // reads. The bars are the only children it has, so counting them is counting these.
  expect(barsOf(scale(3))).toHaveLength(5);
  // Spec detail 38: «3 из 5» is three bars of `spark` — the stage in hand is lit with the ones
  // behind it. The lit ones share the first bar's look; the rest are the track.
  for (const at of [1, 2, 3, 4, 5]) {
    const bars = barsOf(scale(at));
    expect(bars.filter((bar) => bar === bars[0]), `${at} из 5`).toHaveLength(at);
  }
});

test('the stage a montage fell over on is lit in danger, apart from the ones it got through', async () => {
  const fallen = (failed?: boolean) =>
    story(
      <CardMontage title="Ролик" state="failed" step={{ at: 3, of: 5, count: '3 из 5', failed }} />,
    );
  const spark = 'rgba(228,255,79,1.00)';
  const track = 'rgba(255,255,255,0.22)';
  // The night's `dangerText` — the cross its row wears on the screen the card opens (spec detail 56).
  const danger = 'rgba(255,141,141,1.00)';
  expect(barsOf(fallen(true)).map(fillOf)).toEqual([spark, spark, danger, track, track]);
  // A montage that fell over between two stages has none that broke: the scale is only lit.
  expect(barsOf(fallen()).map(fillOf)).toEqual([spark, spark, spark, track, track]);
  // It lies on the poster, so daylight does not trade it for the day's dark red, made for cream.
  await setTheme('light');
  expect(fillOf(barsOf(fallen(true))[2])).toBe(danger);
  await setTheme('dark');
});

test('a fallen card says why it broke on one line, and its label carries all of it', () => {
  const why = 'материал не годится для ролика: файлы не читаются, кадры испорчены или исключены';
  const card = (
    <CardMontage
      title="Ролик на 2:00"
      state="failed"
      caption={why}
      step={{ at: 2, of: 5, count: '2 из 5', failed: true }}
      onPress={() => {}}
    >
      <Button variant="secondary" size="sm" label="Повторить" />
    </CardMontage>
  );
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(card);
  });
  // Under the button and over the scale, a second line lifts the name into the badge.
  const line = tree.root.find((node) => node.type === Text && node.props.children === why);
  expect(line.props.numberOfLines).toBe(1);
  expect(story(card)).toContain(`aria-label="Ролик на 2:00 · ${why} · 2 из 5"`);
});

test('a card with a still and one without are not the same card', () => {
  expect(story(<CardMontage title="Ролик" state="ready" poster={POSTER} />)).not.toBe(
    story(<CardMontage title="Ролик" state="ready" poster={null} />),
  );
});

test('a card leads somewhere only when it is told to', () => {
  expect(story(<CardMontage title="Ролик" state="pending" onPress={() => {}} />)).toContain(
    'role="button"',
  );
  expect(story(<CardMontage title="Ролик" state="pending" />)).not.toContain('role="button"');
  // Read out as the whole thing it is, name and meta together.
  expect(
    story(<CardMontage title="Ролик на 1:00" meta="14 сентября · Тёплая" state="ready" onPress={() => {}} />),
  ).toContain('aria-label="Ролик на 1:00 · 14 сентября · Тёплая"');
  // Unless pressing it does something its own words do not say — the poster on `MontageLiveDone`
  // plays the film, and «Смотреть» is what a screen reader is told (TASK-222).
  expect(
    story(
      <CardMontage
        title="Ролик на 2:30"
        meta="2:30 · 16:9"
        state="ready"
        large
        label="Смотреть: Ролик на 2:30"
        onPress={() => {}}
      />,
    ),
  ).toContain('aria-label="Смотреть: Ролик на 2:30"');
});

test('the button under a fallen card is never swallowed by the card', () => {
  // Pressed, the card is one thing to a screen reader — «Ролик · 14 сентября» — and everything in it
  // is part of that. The fallen card's «Повторить» has to be reachable on its own, so it never
  // stands inside that one thing.
  const fallen = (onPress?: () => void) => (
    <CardMontage
      title="Ролик на 2:00"
      state="failed"
      caption="Сборка оборвалась на полпути"
      badge={<BadgeMontage state="failed" label="Не собрался" />}
      onPress={onPress}
    >
      <Button variant="secondary" size="sm" label="Повторить" />
    </CardMontage>
  );
  const buttons = (markup: string) => (markup.match(/role="button"/g) ?? []).length;
  const marked = story(fallen());
  expect(marked).toContain('aria-label="Повторить"');
  // Not pressed: one button — «Повторить» — and the card around it is neither a button nor a dead one.
  expect(buttons(marked)).toBe(1);
  expect(marked).not.toContain('aria-disabled');
  // The card that does lead somewhere is a button itself, on top of whatever is in it.
  expect(buttons(story(<CardMontage title="Ролик" state="pending" onPress={() => {}} />))).toBe(1);

  // Spec detail 38: the fallen card leads to the journal of the attempt that broke, and keeps its
  // «Повторить» — two buttons, and the second is not inside the first.
  expect(buttons(story(fallen(() => {})))).toBe(2);
  // Pressed, it is one element, so its label carries the line saying where it broke — left out, a
  // screen reader would hear the name and never learn it did not finish.
  expect(story(fallen(() => {}))).toContain('aria-label="Ролик на 2:00 · Сборка оборвалась на полпути"');
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(fallen(() => {}));
  });
  const card = tree.root.findAll(
    (node) => node.type === Pressable && node.props.accessibilityLabel?.startsWith('Ролик на 2:00'),
  );
  expect(card).toHaveLength(1);
  expect(card[0].findAllByType(Button)).toEqual([]);
  expect(tree.root.findAllByType(Button)).toHaveLength(1);
});

test('what lies on the poster is read in the night’s ink in daylight too', async () => {
  // The poster is a photograph in both themes. The play circle is the layout's `paper` with `ink`
  // in it (#F5F3EE and #0B0B12); in daylight the theme's own ink is a cream, and a cream triangle
  // on a cream circle is a circle with nothing in it.
  const ready = <CardMontage title="Ролик" state="ready" poster={POSTER} />;
  const badge = <BadgeMontage state="pending" label="Собирается" />;
  const retry = <Button variant="secondary" size="sm" label="Повторить" />;
  const card = (
    <CardMontage title="Ролик" state="failed" poster={POSTER} badge={badge}>
      {retry}
    </CardMontage>
  );
  const [night, nightBadge, nightRetry] = [story(ready), story(badge), story(retry)];
  await setTheme('light');
  expect(story(ready)).toContain('stroke="#0B0B12"');
  expect(story(ready)).not.toContain('stroke="#F2EFE7"');
  expect(night).toContain('stroke="#0B0B12"');
  // The badge and the button are the callers', and they are drawn as they are at night — «Собирается»
  // in the day's blue, on a poster, would be a dark word on a dark frame. Standing alone in daylight
  // they are different, which is what makes finding the night's inside the card mean something.
  const day = story(card);
  expect(story(badge)).not.toBe(nightBadge);
  expect(day).toContain(nightBadge);
  expect(story(retry)).not.toBe(nightRetry);
  expect(day).toContain(nightRetry);
  await setTheme('dark');
});

test('«Новый ролик» is a hole in the strip, and it is always a button', () => {
  const tile = story(<CardMontageNew label="Новый ролик" onPress={() => {}} />);
  expect(tile).toContain('Новый ролик');
  expect(tile).toContain('role="button"');
  // It is not a montage card wearing a plus: a hole is 92 where a card is 232.
  expect(tile).not.toContain('r-width-talwmj');
  // Nothing to press until there is something to press with.
  expect(story(<CardMontageNew label="Новый ролик" />)).toContain('aria-disabled="true"');
});

test('a memory with no montages gets the dashed block, not an empty state', () => {
  const block = story(
    <EmptyMontages photos={SHOTS} text="Нейросеть выберет лучшие моменты и положит на музыку.">
      <Button variant="paper" size="sm" label="Смонтировать" />
    </EmptyMontages>,
  );
  expect(block).toContain('Нейросеть выберет лучшие моменты');
  // The block never explains without offering.
  expect(block).toContain('Смонтировать');
  // Two frames, no more — and it is the same block with fewer when a memory has fewer.
  allDifferent({
    two: <EmptyMontages photos={SHOTS} text="Нейросеть соберёт ролик." />,
    one: <EmptyMontages photos={SHOTS.slice(0, 1)} text="Нейросеть соберёт ролик." />,
    none: <EmptyMontages text="Нейросеть соберёт ролик." />,
  });
});
