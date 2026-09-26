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

test('the empty strip is the layout’s: its own hole, a 20 glyph at 1.6, the words 13 / 500 in `muted`', async () => {
  // Spec 7.6, detail 37 and 10.11. `Main.json` e33…e35: a dashed hole of #1D1D28, the `image` glyph
  // 20 at 1.6 in `faint`, «Ни одного кадра — скиньте первые» 13 / 500 #A4A1B2 — read, so `muted`
  // (spec 10.1). `HomeDay.json` e31…e33: the hole `raise` #F7F4EC, the glyph #8B8778, the words
  // #6C6979. The app drew a 22 glyph and the words at 12 in `faint`, on `raise` at night.
  const card = () =>
    story(<CardMemory title="Корпоратив Nox" emptyText="Ни одного кадра — скиньте первые" />);
  const night = card();
  expect(night).toContain(rule('background-color:rgba(29,29,40,1.00)'));
  expect(night).toContain('<svg data-glyph="ImageIcon" width="20" height="20" stroke="#6E6B7D"');
  expect(night).toContain('stroke-width="1.6"');
  expect(night).toContain(rule('color:rgba(164,161,178,1.00)'));
  expect(night).toMatch(
    new RegExp(`class="[^"]*${rule('font-size:13px')}[^"]*"[^>]*>Ни одного кадра`),
  );
  await setTheme('light');
  const day = card();
  expect(day).toContain(rule('background-color:rgba(247,244,236,1.00)'));
  expect(day).toContain('stroke="#8B8778"');
  await setTheme('dark');
});

test('the large card stands on #E8E3D8 by day, under its mosaic', async () => {
  // Spec 2, «День»: «подложка крупной карточки под мозаикой #E8E3D8» (`HomeDay.json` e4) — what
  // shows in the gaps of the mosaic. At night it is the card's own `surface` (`Main.json` e6).
  const large = () => story(<CardMemory title="Свадьба" thumbs={SHOTS} large />);
  expect(large()).toContain(rule('background-color:rgba(22,22,31,1.00)'));
  await setTheme('light');
  expect(large()).toContain(rule('background-color:rgba(232,227,216,1.00)'));
  await setTheme('dark');
});

test('the name on the cover is set at −0.03em, a hair looser than a heading’s', () => {
  // Spec 3 and 10.11: «`display` −0.035em везде → у имени на обложке −0.03em» — `Main.json` e17,
  // Unbounded 26 / 700 / 29 at −0.78.
  const large = story(<CardMemory title="Свадьба Лизы и Марка" thumbs={SHOTS} large />);
  expect(large).toContain(rule('letter-spacing:-0.78px'));
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
  // The name first in its pair — in the box it measures its room in, to be balanced (spec 3).
  expect(large).toMatch(
    new RegExp(`class="[^"]*${rule('gap:7px')}[^"]*"><div[^>]*><div[^>]*>Свадьба Лизы и Марка<`),
  );
  expect(large).toContain(rule('gap:12px'));
  expect(large).toContain(rule('line-height:16px'));
});

test('a long name is whole on both cards — it wraps and the card grows, never cut to a line count', () => {
  // TASK-400: «Свадьба / Лизы и Ма…» was what the ordinary card left of a name on the smallest phone
  // on large type, and three lines were the large one's. The name is the one place the list says
  // which memory this is; both cards' heights are floors, so it takes the lines it needs.
  const title = 'Свадьба Лизы и Марка в Карелии на берегу Ладоги';
  for (const large of [true, false]) {
    const drawn = story(<CardMemory title={title} thumbs={SHOTS} large={large} />);
    expect(drawn).toContain(title);
    expect(drawn).not.toContain('line-clamp');
    expect(drawn).not.toContain('r-textOverflow');
  }
});

test('the name on the cover is balanced, and the ordinary card’s name is not', () => {
  // Spec 3 and 7.6, detail 36: `text-wrap: balance` on the name on the cover alone — `Main.json` e14
  // «Свадьба / Лизы и Марка» (TASK-398). The measures that balance it are the words one by one.
  const large = story(<CardMemory title="Свадьба Лизы и Марка" thumbs={SHOTS} large />);
  const ordinary = story(<CardMemory title="Свадьба Лизы и Марка" thumbs={SHOTS} />);
  expect(large).toContain('>Свадьба Лизы<');
  expect(ordinary).not.toContain('>Свадьба Лизы<');
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
  // And the two apart (spec 7.6, detail 36): the dates and the count at .76 (`Main.json` e15, e17),
  // the sentence under the bar at .72 (e20).
  expect(rules).toContain('{color:rgba(255,255,255,0.76);}');
  const card = story(
    <CardMemory title="Свадьба" meta={['12–14 сентября', '486 кадров']} thumbs={SHOTS} large />,
  );
  const meta = card.match(/class="([^"]*)"[^>]*>12–14 сентября</)?.[1] ?? '';
  expect(meta).toContain(rule('color:rgba(255,255,255,0.76)'));
  expect(meta).not.toContain(rule('color:rgba(255,255,255,0.72)'));
});
