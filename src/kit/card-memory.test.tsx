import { beforeAll, expect, test } from 'vitest';

import { BadgeFilms, BadgeOrganizer } from '@/kit/badge';
import { CardMemory } from '@/kit/card-memory';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 — a memory in the list, large and ordinary, in every state each of them has. */

const SHOTS = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg', 'https://b/4.jpg'];

beforeAll(async () => {
  await setTheme('dark');
});

test('the large card and the ordinary one are two different cards', () => {
  allDifferent({
    large: <CardMemory title="Свадьба Лизы и Марка" thumbs={SHOTS} large />,
    ordinary: <CardMemory title="Поход на Ладогу" thumbs={SHOTS} />,
  });
});

test('every state of the large card is its own', () => {
  allDifferent({
    full: (
      <CardMemory
        title="Свадьба Лизы и Марка"
        meta={['12–14 сентября', '486 кадров']}
        thumbs={SHOTS}
        large
        organizer={<BadgeOrganizer label="Организатор" />}
        films={<BadgeFilms label="2 ролика" filled />}
        progress={7 / 9}
        progressLabel="7 из 9 уже скинули свои кадры"
      />
    ),
    noFilms: (
      <CardMemory
        title="Свадьба Лизы и Марка"
        meta={['12–14 сентября', '486 кадров']}
        thumbs={SHOTS}
        large
        organizer={<BadgeOrganizer label="Организатор" />}
      />
    ),
    notOrganizer: (
      <CardMemory
        title="Свадьба Лизы и Марка"
        meta={['12–14 сентября', '486 кадров']}
        thumbs={SHOTS}
        large
        films={<BadgeFilms label="2 ролика" filled />}
      />
    ),
    thin: <CardMemory title="Свадьба Лизы и Марка" thumbs={SHOTS.slice(0, 1)} large />,
  });
});

test('the cover is read in white in both themes, because it lies on a photograph', async () => {
  // Spec 2, the day's second departure from plain substitution: the darkening over a photograph
  // stays dark in daylight and the name on it stays white. So this one line has to come out
  // identical in both — the theme may move everything around it and not this.
  const name = (markup: string) => markup.match(/<div[^>]*>Свадьба<\/div>/)?.[0];
  const dark = story(<CardMemory title="Свадьба" thumbs={SHOTS} large />);
  await setTheme('light');
  const light = story(<CardMemory title="Свадьба" thumbs={SHOTS} large />);
  await setTheme('dark');
  expect(name(dark)).toBeTruthy();
  expect(name(dark)).toBe(name(light));
});

test('the bar of who has brought theirs is never drawn without the sentence beside it', () => {
  const withBar = story(
    <CardMemory
      title="Свадьба"
      thumbs={SHOTS}
      large
      progress={7 / 9}
      progressLabel="7 из 9 уже скинули свои кадры"
    />,
  );
  expect(withBar).toContain('7 из 9 уже скинули свои кадры');
  // A bar with no number says nothing, so a value on its own does not draw one.
  expect(story(<CardMemory title="Свадьба" thumbs={SHOTS} large progress={0.5} />)).not.toContain(
    'role="progressbar"',
  );
});

test('an empty ordinary card says so instead of the strip, and drops the meta with it', () => {
  const empty = story(
    <CardMemory
      title="Корпоратив Nox"
      meta={['12 сентября', '0 кадров']}
      emptyText="Ни одного кадра — скиньте первые"
    />,
  );
  expect(empty).toContain('Ни одного кадра — скиньте первые');
  // There is nothing yet to count, so the card wears its name alone.
  expect(empty).not.toContain('486');
  expect(empty).not.toContain('12 сентября');

  allDifferent({
    full: <CardMemory title="Поход" meta={['12 сентября', '86 кадров']} thumbs={SHOTS} />,
    empty: <CardMemory title="Поход" emptyText="Ни одного кадра — скиньте первые" />,
  });
});

test('a long name balances over three lines rather than running out of the card', () => {
  const long = story(
    <CardMemory title="Свадьба Лизы и Марка в Карелии на берегу Ладоги" thumbs={SHOTS} large />,
  );
  expect(long).toContain('Свадьба Лизы и Марка в Карелии на берегу Ладоги');
  expect(long).toContain('-webkit-line-clamp:3');
});

test('a card that leads somewhere is a button, and one that does not is not', () => {
  expect(story(<CardMemory title="Поход" thumbs={SHOTS} onPress={() => {}} />)).toContain(
    'role="button"',
  );
  expect(story(<CardMemory title="Поход" thumbs={SHOTS} />)).toContain('aria-disabled="true"');
});
