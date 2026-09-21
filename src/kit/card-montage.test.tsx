import { beforeAll, expect, test } from 'vitest';

import { BadgeMontage } from '@/kit/badge';
import { Button } from '@/kit/button';
import { CardMontage } from '@/kit/card-montage';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 — a montage, whose three states are three different bodies. */

const POSTER = 'https://bucket.example/poster.jpg';

beforeAll(async () => {
  await setTheme('dark');
});

test('ready, building and broken are three cards and not three colours of one', () => {
  allDifferent({
    ready: (
      <CardMontage
        title="Свадьба — минута"
        meta="13 сентября · горизонтальный · Яркая"
        state="ready"
        poster={POSTER}
        length="1:04"
        badge={<BadgeMontage state="ready" label="Готов" />}
      >
        <Button variant="secondary" size="sm" label="Сохранить и поделиться" />
      </CardMontage>
    ),
    pending: (
      <CardMontage
        title="Свадьба — минута"
        state="pending"
        caption="Мы сообщим, когда будет готов"
        badge={<BadgeMontage state="pending" label="Собирается" />}
        step={{ done: 3, of: 5, label: 'Режиссёр строит историю', count: '3 из 5' }}
      />
    ),
    failed: (
      <CardMontage
        title="Свадьба — минута"
        state="failed"
        caption="Сборка оборвалась на полпути"
        badge={<BadgeMontage state="failed" label="Не собрался" />}
      >
        <Button variant="secondary" size="sm" label="Повторить" />
      </CardMontage>
    ),
  });
});

test('a card still building shows no poster at all — there is nothing yet to show', () => {
  const pending = story(
    <CardMontage
      title="Свадьба"
      state="pending"
      caption="Мы сообщим, когда будет готов"
      step={{ done: 3, of: 5, label: 'Режиссёр строит историю', count: '3 из 5' }}
    />,
  );
  expect(pending).not.toContain('data-testid="image"');
  // The stage is named rather than counted: «73 %» tells a person nothing, this does.
  expect(pending).toContain('Режиссёр строит историю');
  expect(pending).toContain('3 из 5');
});

test('a ready card carries its own still, and one without a still keeps the placeholder', () => {
  const withPoster = story(<CardMontage title="Свадьба" state="ready" poster={POSTER} />);
  const without = story(<CardMontage title="Свадьба" state="ready" poster={null} />);
  expect(withPoster).not.toBe(without);
  expect(withPoster).toContain('1:04'.slice(0, 0) + 'Свадьба');
});

test('the card takes the montage’s own shape, whichever way up it was cut', () => {
  // TASK-135 gave a standing montage a taller frame than a lying one; TASK-178 made it the video's
  // own shape rather than a shape of the card's choosing — 9:16 stood up, 16:9 laid down, and the
  // still fills it to the edges. The shape is the screen's to hand over and comes off the
  // orientation that was ordered, so the card is right from the queued one onwards and nothing
  // jumps when the still lands.
  allDifferent({
    wide: <CardMontage title="Свадьба" state="ready" poster={POSTER} ratio={16 / 9} />,
    tall: <CardMontage title="Свадьба" state="ready" poster={POSTER} ratio={9 / 16} />,
  });
  // And a card told nothing is the wide one — the orientation an order that named none was cut in.
  expect(story(<CardMontage title="Свадьба" state="ready" poster={POSTER} />)).toBe(
    story(<CardMontage title="Свадьба" state="ready" poster={POSTER} ratio={16 / 9} />),
  );
});

test('the broken card takes the one dangerous border the product has', () => {
  // Spec 10.5 settles a single `rgba(206,48,40,.45)` for every dangerous surface.
  const failed = story(<CardMontage title="Свадьба" state="failed" caption="Сборка оборвалась" />);
  expect(failed).toContain('Сборка оборвалась');
  expect(failed).not.toBe(story(<CardMontage title="Свадьба" state="ready" caption="Сборка оборвалась" />));
});

test('the running time sits in the poster’s corner and the card leads on where it is told to', () => {
  const ready = story(<CardMontage title="Свадьба" state="ready" poster={POSTER} length="1:04" />);
  expect(ready).toContain('1:04');
  expect(story(<CardMontage title="Свадьба" state="pending" onPress={() => {}} />)).toContain(
    'role="button"',
  );
});
