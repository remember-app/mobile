import { contrast } from '@tests/helpers/contrast';
import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Heart, House, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
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
import { Text as KitText } from '@/kit/text';
import { font, setTheme, ThemePin, themes } from '@/theme';

/** Spec 7.6 and 7.7 — what a person reads while they are ordering a montage. */

mountsTrees();

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

/** The classes of the element whose text is exactly `words`. */
const wordsOf = (markup: string, words: string) =>
  markup.match(new RegExp(`class="([^"]*)"[^>]*>${words}<`))?.[1] ?? '';

test('a template’s tile is set in the sizes the layout draws it in', () => {
  // TASK-384 (R4), spec 7.6 detail 41 and `MontageTemplate.json`: the name 14 / 17 / 700 («Официальный
  // отчёт» 140.25 wide there — 13 / 600 made it 127.7), the line under it 11 / 14 / 500 and the plate
  // 11 / 600. The tile used the scale's `label`, `badgeSm` and `meta`: 13 / 600, 10 / 700 and 12.
  const tile = story(
    <TileTemplate
      title="Официальный отчёт"
      note="Ровно, по порядку"
      spec="2:00 · 16:9"
      icon={Heart}
      onPress={() => {}}
    />,
  );
  const name = wordsOf(tile, 'Официальный отчёт');
  expect(name).toContain(rule('font-size:14px'));
  expect(name).toContain(rule('line-height:17px'));
  expect(name).toContain(rule(`font-family:${font.bold}`));
  const note = wordsOf(tile, 'Ровно, по порядку');
  expect(note).toContain(rule('font-size:11px'));
  expect(note).toContain(rule('line-height:14px'));
  expect(note).toContain(rule(`font-family:${font.medium}`));
  const plate = wordsOf(tile, '2:00 · 16:9');
  expect(plate).toContain(rule('font-size:11px'));
  expect(plate).toContain(rule(`font-family:${font.semi}`));
});

test('the poster’s second line and the plate over the story are a size down from the scale’s', () => {
  // TASK-384 (R4): «16:9 · Свадьба Лизы и Марка» is 11 / 500 on `MontageSummary` (spec 7.6, detail 42;
  // `meta` 12 made it 9 % wider), the plate «Шаблон «Для родителей»» 12 / 600 on `MontageStory`
  // (`label` 13 made it 8 % wider).
  const poster = story(<PosterOrder length="2:30" about="16:9 · Свадьба Лизы и Марка" />);
  expect(wordsOf(poster, '16:9 · Свадьба Лизы и Марка')).toContain(rule('font-size:11px'));
  const plate = story(<ChipTemplate label="Шаблон «Для родителей»" icon={House} />);
  const words = wordsOf(plate, 'Шаблон «Для родителей»');
  expect(words).toContain(rule('font-size:12px'));
  expect(words).toContain(rule(`font-family:${font.semi}`));
});

test('the headings of the summary are read in muted, as every eyebrow in the layout is', () => {
  // TASK-384 (R5): «КАДРЫ», «ИСТОРИЯ», «МУЗЫКА» are #A4A1B2 on `MontageSummary` — 33 eyebrows of 33 in
  // the layout are. They were drawn in `paper`.
  const section = story(<SummarySection title="Кадры">{null}</SummarySection>);
  expect(section).toContain(
    story(
      <KitText role="eyebrow" tone="muted" accessibilityRole="header">
        КАДРЫ
      </KitText>,
    ),
  );
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

test.each([
  ['dark', 7.12],
  ['light', 5.34],
] as const)(
  'the count in the head of «Выбрано» reads in `muted` on the block, %s',
  async (theme, spec) => {
    // Spec 7.7, detail 54 (10.10): the layout set it in `faint` — 3.48 : 1 on the block, under the 4.5
    // floor for 12 px. The colour and the ground are read off what the block draws, not the tokens.
    for (const [count, empty] of [
      ['2 трека · 3:45', undefined],
      [
        'ничего не добавлено',
        { title: 'Ролик будет без музыки', note: 'Только живой звук из видео' },
      ],
    ] as const) {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = mounted(
          TestRenderer.create(
            <ThemePin value={theme}>
              <BlockPicked title="Выбрано" count={count} empty={empty} />
            </ThemePin>,
          ),
        );
      });
      const words = tree.root.findAllByType(Text).filter((one) => one.props.children === count);
      expect(words).toHaveLength(1);
      const ink = StyleSheet.flatten(words[0].props.style).color as string;
      const ground = StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style)
        .backgroundColor as string;
      expect(ink).toBe(themes[theme].color.muted);
      expect(ground).toBe(themes[theme].color.surface);
      const ratio = contrast(ink, ground);
      expect(ratio, `${count} — ${ratio.toFixed(2)} : 1`).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(spec, 2);
    }
  },
);

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

test('a template’s tile carries its length on the quieter plate, the poster its template on the fuller', () => {
  // Spec 2 and 10.10 — two exact values, each by its place: «3:00 · 16:9» on a template's tile stands
  // on .55, the template named on the summary's poster on .60.
  const tile = story(<TileTemplate title="Для себя" spec="3:00 · 16:9" onPress={() => {}} />);
  const poster = story(
    <PosterOrder photos={SHOTS} template="Для родителей" templateIcon={House} length="2:30" />,
  );
  const quiet = rule('background-color:rgba(11,11,18,0.55)');
  const full = rule('background-color:rgba(11,11,18,0.60)');
  expect(tile).toContain(quiet);
  expect(tile).not.toContain(full);
  expect(poster).toContain(full);
  expect(poster).not.toContain(quiet);
});
