import { Heart, House, Zap } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { Field } from '@/kit/field';
import {
  BlockPicked,
  BlockSummary,
  PosterOrder,
  SummarySection,
  SummaryShots,
  SummaryTrack,
  TileTemplate,
} from '@/kit/montage-order';
import { RowTrack } from '@/kit/rows';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 and 7.7 — what a person reads while they are ordering a montage. */

const SHOTS = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg'];

beforeAll(async () => {
  await setTheme('dark');
});

test('a template says what kind of film it is, in three states', () => {
  allDifferent({
    resting: (
      <TileTemplate title="Для родителей" note="Лица, тепло, чуть медленнее" spec="2:30 · 16:9" icon={House} uri={SHOTS[0]} onPress={() => {}} />
    ),
    picked: (
      <TileTemplate title="Для родителей" note="Лица, тепло, чуть медленнее" spec="2:30 · 16:9" icon={House} uri={SHOTS[0]} picked onPress={() => {}} />
    ),
    dimmed: (
      <TileTemplate title="Быстрый, энергичный" note="Бодро, в ритм" spec="1:00 · 16:9" icon={Zap} uri={SHOTS[1]} dimmed onPress={() => {}} />
    ),
    bare: <TileTemplate title="Для себя" onPress={() => {}} />,
  });
  const tile = story(
    <TileTemplate title="Для себя" note="Личное, без спешки" spec="3:00 · 16:9" icon={Heart} onPress={() => {}} />,
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
  expect(story(<PosterOrder photos={SHOTS} length="2:30" shape="Горизонтальный" />)).not.toBe(poster);
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

test('the chosen tracks stand in the accent’s own block, with the wish under them', () => {
  const block = story(
    <BlockPicked
      title="Выбрано"
      count="2 трека · 3:45"
      footer={<Field label="Как использовать треки" labelHidden value="" onChangeText={() => {}} />}
    >
      <RowTrack title="Тёплая" length="1:40" wave />
      <RowTrack title="Спокойная" length="2:05" wave divider />
    </BlockPicked>,
  );
  expect(block).toContain('ВЫБРАНО');
  expect(block).toContain('2 трека · 3:45');
  expect(block).toContain('Тёплая');
  expect(block).toContain('Спокойная');
  // The block never stands empty: with nothing taken its place goes to the «Без музыки» card.
  allDifferent({
    counted: (
      <BlockPicked title="Выбрано" count="2 трека · 3:45">
        <RowTrack title="Тёплая" length="1:40" wave />
      </BlockPicked>
    ),
    uncounted: (
      <BlockPicked title="Выбрано">
        <RowTrack title="Тёплая" length="1:40" wave />
      </BlockPicked>
    ),
  });
});
