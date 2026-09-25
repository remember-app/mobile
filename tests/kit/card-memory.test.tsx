import { rule } from '@tests/helpers/css';
import { beforeAll, expect, test } from 'vitest';

import { BadgeFilms, BadgeOrganizer } from '@/kit/badge';
import { CardMemory } from '@/kit/card-memory';
import { allDifferent, compiled, story } from '@/kit/story';
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

test('a chosen cover takes the whole face of the large card, mosaic and all', () => {
  // Spec 7.6, «с обложкой» (10.8.3): one frame instead of the 3 × 2, with the darkening, the
  // badges and the name left exactly where they were. A memory that has nothing in it yet can
  // still carry one, which is the state the main screen leans on.
  allDifferent({
    mosaic: <CardMemory title="Свадьба" thumbs={SHOTS} large />,
    cover: <CardMemory title="Свадьба" thumbs={SHOTS} cover={SHOTS[3]} large />,
  });
  // A memory with a cover and nothing else drawn is the same card: once a face is chosen the tail
  // behind it does not show through, which is why the main screen may lead with it on its own.
  expect(story(<CardMemory title="Свадьба" cover={SHOTS[3]} large />)).toBe(
    story(<CardMemory title="Свадьба" thumbs={SHOTS} cover={SHOTS[3]} large />),
  );
  // Nobody chose one, so the card is the one that stood here before covers existed.
  expect(story(<CardMemory title="Свадьба" thumbs={SHOTS} cover={null} large />)).toBe(
    story(<CardMemory title="Свадьба" thumbs={SHOTS} large />),
  );
  // On the ordinary card the cover leads the strip instead of being added to it: still four cells,
  // never five. Which picture is in which cell cannot be read here at all — `expo-image` stands in
  // as a view without its source (`vitest.setup.ts`), so two different photographs are one markup.
  const led = story(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={SHOTS} cover="https://b/9.jpg" />,
  );
  expect(led.match(/data-testid="image"/g) ?? []).toHaveLength(4);
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

test('the ordinary card is 181 with its meta and 158 without, its films badge on the foot of the words', () => {
  // TASK-383, off `Main.json`: e24 is 358 × 181 — 1 + 10 + 96 (the strip) + 13 + 22 (e29, the name)
  // + 6 + 17 (e30, the meta at 13 / 500) + 5 + 10 + 1 — and the empty card under it 158, the same
  // without the meta. The badge (e33, h30) ends where the meta ends (y673 + 30 = 686 + 17). The
  // old card was 167 — 12 under the strip, nothing under the words, meta 12 / 15 flush on the name
  // and the badge in the middle of them — and the empty one 152.
  const full = story(
    <CardMemory
      title="Поход на Ладогу"
      meta={['2–5 августа', '212 кадров']}
      thumbs={SHOTS}
      films={<BadgeFilms label="1 ролик" />}
    />,
  );
  const empty = story(
    <CardMemory title="Корпоратив Nox" emptyText="Ни одного кадра — скиньте первые" />,
  );
  for (const card of [full, empty]) {
    expect(card).toContain(rule('padding-top:13px'));
    expect(card).toContain(rule('padding-bottom:5px'));
  }
  expect(full).toContain(rule('align-items:flex-end'));
  // The 6 is the one between the name and its meta: on the column the name stands in.
  expect(full).toMatch(
    new RegExp(`class="[^"]*${rule('gap:6px')}[^"]*"><div[^>]*>Поход на Ладогу<`),
  );
  expect(full).toContain(rule('font-size:13px'));
  expect(full).toContain(rule('line-height:17px'));
});

test('the large card hangs its badges 14 off the top and stands its words 18 off the bottom', () => {
  // `Main.json`: the badges at x30 / y201 of a card at x16 / y186 (e14, e15 — centred in a 28 row
  // at 14); the name, meta, bar and sentence end 18 over the card's foot at x34, 7 inside each pair
  // and 12 between them (e17…e23: name ends at 445, meta 452–469, bar at 481, the sentence 492–508
  // of a card ending at 526). The sentence is 12 / 600 (e23 h16).
  const large = story(
    <CardMemory
      title="Свадьба Лизы и Марка"
      meta={['12–14 сентября', '486 кадров']}
      thumbs={SHOTS}
      large
      organizer={<BadgeOrganizer label="Организатор" />}
      films={<BadgeFilms label="2 ролика" filled />}
      progress={7 / 9}
      progressLabel="7 из 9 уже скинули свои кадры"
    />,
  );
  expect(large).toContain(rule('padding-top:14px'));
  expect(large).toContain(rule('padding-left:14px;padding-right:14px'));
  expect(large).toContain(rule('padding-left:18px;padding-right:18px'));
  expect(large).toContain(rule('padding-bottom:18px'));
  expect(large).toMatch(
    new RegExp(`class="[^"]*${rule('gap:7px')}[^"]*"><div[^>]*>Свадьба Лизы и Марка<`),
  );
  expect(large).toContain(rule('gap:12px'));
  expect(large).toContain(rule('line-height:16px'));
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

test('the meta and the count on a cover are read at the photograph’s quiet white, and not at the dot’s 45%', () => {
  // The layout writes them in rgba(255,255,255,.72….76). 45% is the colour of the dot *between* two
  // pieces of meta, and a line of words drawn in it over a bright frame is a line nobody can read.
  story(
    <CardMemory
      title="Свадьба Лизы и Марка"
      meta={['12–14 сентября', '486 кадров']}
      thumbs={SHOTS}
      large
      progress={0.78}
      progressLabel="7 из 9 уже скинули свои кадры"
    />,
  );
  const rules = compiled();
  expect(rules).toContain('{color:rgba(255,255,255,0.72);}');
  expect(rules).not.toContain('{color:rgba(255,255,255,0.45);}');
});
