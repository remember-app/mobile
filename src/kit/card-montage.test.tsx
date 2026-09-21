import { beforeAll, expect, test } from 'vitest';

import { BadgeMontage } from '@/kit/badge';
import { Button } from '@/kit/button';
import { CardMontage, CardMontageNew, EmptyMontages } from '@/kit/card-montage';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 — the strip of montages over a memory's feed: a card, the way to start one, and none. */

const POSTER = 'https://bucket.example/poster.jpg';
const SHOTS = ['https://bucket.example/1.jpg', 'https://bucket.example/2.jpg'];

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
        step={{ done: 3, of: 5, count: '3 из 5' }}
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
    <CardMontage title="Ролик" state="pending" poster={POSTER} step={{ done: 3, of: 5, count: '3 из 5' }} />,
  );
  const ready = story(<CardMontage title="Ролик" state="ready" poster={POSTER} />);
  // Same still, drawn differently: there is something there and it is not ready to be looked at.
  expect(pending).not.toBe(ready);
  expect(pending).toContain('3 из 5');
});

test('the scale of five says how far along, and the done ones are spark', () => {
  const scale = story(
    <CardMontage title="Ролик" state="pending" step={{ done: 3, of: 5, count: '3 из 5' }} />,
  );
  expect(scale).toContain('role="progressbar"');
  // Five bars and not four: the scale says «of five» by being five, whatever the count beside it
  // reads. The bars are the only children it has, so counting them is counting these.
  const bars = scale.slice(scale.indexOf('role="progressbar"'));
  expect((bars.match(/<div class="css-view/g) ?? []).length).toBe(5);
  allDifferent({
    started: <CardMontage title="Ролик" state="pending" step={{ done: 1, of: 5, count: '1 из 5' }} />,
    nearly: <CardMontage title="Ролик" state="pending" step={{ done: 4, of: 5, count: '4 из 5' }} />,
  });
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
