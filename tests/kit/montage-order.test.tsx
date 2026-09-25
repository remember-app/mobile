import { Heart, House, Zap } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import {
  BlockPicked,
  BlockSummary,
  ChipTemplate,
  PosterOrder,
  SummarySection,
  SummaryShots,
  SummaryTrack,
  TileTemplate,
} from '@/kit/montage-order';
import { RowTrack } from '@/kit/rows';
import { allDifferent, compiled, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 and 7.7 — what a person reads while they are ordering a montage. */

const SHOTS = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg'];

beforeAll(async () => {
  await setTheme('dark');
});

test('a template says what kind of film it is, in three states', () => {
  allDifferent({
    resting: (
      <TileTemplate
        title="Для родителей"
        note="Лица, тепло, чуть медленнее"
        spec="2:30 · 16:9"
        icon={House}
        uri={SHOTS[0]}
        onPress={() => {}}
      />
    ),
    picked: (
      <TileTemplate
        title="Для родителей"
        note="Лица, тепло, чуть медленнее"
        spec="2:30 · 16:9"
        icon={House}
        uri={SHOTS[0]}
        picked
        onPress={() => {}}
      />
    ),
    dimmed: (
      <TileTemplate
        title="Быстрый, энергичный"
        note="Бодро, в ритм"
        spec="1:00 · 16:9"
        icon={Zap}
        uri={SHOTS[1]}
        dimmed
        onPress={() => {}}
      />
    ),
    bare: <TileTemplate title="Для себя" onPress={() => {}} />,
  });
  const tile = story(
    <TileTemplate
      title="Для себя"
      note="Личное, без спешки"
      spec="3:00 · 16:9"
      icon={Heart}
      onPress={() => {}}
    />,
  );
  expect(tile).toContain('role="button"');
  // Read out whole: what it is called, what it is like, and how long it runs.
  expect(tile).toContain('aria-label="Для себя. Личное, без спешки. 3:00 · 16:9"');
});

test('the poster of an order prints its length and names its shape in a word', () => {
  const poster = story(
    <PosterOrder
      photos={SHOTS}
      template="Для родителей"
      templateIcon={House}
      length="2:30"
      shape="Горизонтальный"
      about="16:9 · Свадьба Лизы и Марка"
    />,
  );
  expect(poster).toContain('2:30');
  expect(poster).toContain('Горизонтальный');
  expect(poster).toContain('Для родителей');
  // The shape is said, never drawn: a 9:16 order does not make this card tall, because there is
  // nothing yet to show at that shape and a word is read faster than a rectangle is measured.
  expect(story(<PosterOrder photos={SHOTS} length="0:30" shape="Вертикальный" />)).not.toBe(poster);
  expect(story(<PosterOrder photos={SHOTS} length="2:30" shape="Горизонтальный" />)).not.toBe(
    poster,
  );
});

test('a poster with fewer than three frames keeps its layout', () => {
  allDifferent({
    three: <PosterOrder photos={SHOTS} length="2:30" />,
    one: <PosterOrder photos={SHOTS.slice(0, 1)} length="2:30" />,
    none: <PosterOrder length="2:30" />,
  });
});

test('the summary reads the order back and nothing in it can be touched', () => {
  const summary = story(
    <BlockSummary>
      <SummarySection title="Кадры">
        <SummaryShots photos={[...SHOTS, ...SHOTS]} />
      </SummarySection>
      <SummarySection title="История" divider>
        <SummaryTrack title="Тёплая" note="склейки в ритм" />
      </SummarySection>
    </BlockSummary>,
  );
  expect(summary).toContain('КАДРЫ');
  expect(summary).toContain('ИСТОРИЯ');
  expect(summary).toContain('Тёплая');
  // The way back to an answer is the step that gave it; a field here would be a second place where
  // the same thing is decided.
  expect(summary).not.toContain('role="button"');
  expect(summary).toContain('role="heading"');
});

test('a summary section with a rule above it is not the first one', () => {
  allDifferent({
    first: <SummarySection title="Кадры">{null}</SummarySection>,
    later: (
      <SummarySection title="Музыка" divider>
        {null}
      </SummarySection>
    ),
  });
});

test('«Выбрано» holds the chosen tracks, each with its own wish, and no field of its own', () => {
  const block = story(
    <BlockPicked title="Выбрано" count="2 трека · 3:45">
      <RowTrack picked title="Тёплая" length="1:40" wish="На сборы, тихо, под голоса" />
      <RowTrack picked title="Спокойная" length="2:05" divider />
    </BlockPicked>,
  );
  expect(block).toContain('ВЫБРАНО');
  expect(block).toContain('2 трека · 3:45');
  expect(block).toContain('Тёплая');
  expect(block).toContain('На сборы, тихо, под голоса');
  expect(block).toContain('Спокойная');
  // Spec 7.7, detail 54: the wishes are the tracks' own, so the block has no line of its own to
  // type one into — and it is a plain surface, not the accent's: a track here is chosen by being here.
  expect(block).not.toContain('<input');
  const surface = compiled().match(
    /\.(r-backgroundColor-[a-z0-9]+)\{background-color:rgba\(22,22,31,1\.00\);\}/,
  )?.[1];
  expect(surface).toBeDefined();
  expect(block).toContain(surface);
});

test('with nothing chosen the block stays and says the film will have no music', () => {
  const empty = story(
    <BlockPicked
      title="Выбрано"
      count="ничего не добавлено"
      empty={{ title: 'Ролик будет без музыки', note: 'Только живой звук из видео' }}
    />,
  );
  expect(empty).toContain('ВЫБРАНО');
  expect(empty).toContain('ничего не добавлено');
  expect(empty).toContain('Ролик будет без музыки');
  expect(empty).toContain('Только живой звук из видео');
  expect(empty).toContain('data-glyph="VolumeX"');
  // A state and not a choice: nothing in it presses — music is added with the plus on the shelf.
  expect(empty).not.toContain('role="button"');
  expect(empty).not.toContain('role="radio"');
  allDifferent({
    empty: (
      <BlockPicked
        title="Выбрано"
        count="ничего не добавлено"
        empty={{ title: 'Ролик будет без музыки', note: 'Только живой звук из видео' }}
      />
    ),
    chosen: (
      <BlockPicked title="Выбрано" count="1 трек · 1:40">
        <RowTrack picked title="Тёплая" length="1:40" />
      </BlockPicked>
    ),
  });
});

test('the plate over the story names the template, or says the words are the person’s own', () => {
  const plate = story(<ChipTemplate label="Шаблон «Для родителей»" icon={House} />);
  expect(plate).toContain('Шаблон «Для родителей»');
  // Nothing about it is pressable: it reports which text is in the box, and the box is where that
  // text is changed.
  expect(plate).not.toContain('role="button"');
  // The two states it is ever in: the template's, with its own glyph, and «Свой текст» without one.
  allDifferent({
    template: <ChipTemplate label="Шаблон «Для родителей»" icon={House} />,
    own: <ChipTemplate label="Свой текст" />,
  });
});

test('the glyphs on a template and on the poster of an order are the night’s paper in daylight too', async () => {
  // Both stand on a photograph under a darkening — a template's glass, the poster's plate — and
  // those are dark in both themes. The day's `paper` is a near black, and a near-black glyph on
  // that glass is a template with no sign of what kind it is.
  const template = (
    <TileTemplate title="Для родителей" icon={Heart} uri={SHOTS[0]} onPress={() => {}} />
  );
  const poster = (
    <PosterOrder photos={SHOTS} template="Для родителей" templateIcon={Heart} length="2:30" />
  );
  await setTheme('light');
  for (const node of [template, poster]) {
    expect(story(node)).toContain('stroke="#F5F3EE"');
    expect(story(node)).not.toContain('stroke="#15151C"');
  }
  await setTheme('dark');
});
