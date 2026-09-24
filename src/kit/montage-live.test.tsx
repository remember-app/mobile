import { beforeAll, expect, test } from 'vitest';

import { BadgeDecision } from '@/kit/badge';
import {
  CardNow,
  Journal,
  JournalLine,
  LogEntry,
  NoteThought,
  RowFilmAt,
  ShotGaze,
  TileNumber,
} from '@/kit/montage-live';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 and 7.7 — the surface of a montage being made: what is happening now, and every why. */

const SHOT = 'https://bucket.example/f01.jpg';
const SERIES = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg', 'https://b/4.jpg'];

beforeAll(async () => {
  await setTheme('dark');
});

test('«Сейчас» has three states and they are three cards', () => {
  allDifferent({
    thinking: (
      <CardNow
        uri={SHOT}
        author="Аня Петрова"
        authorLine="Аня · 13 сент, 16:42"
        now="Сейчас"
        gaze={{ left: 118, top: 44 }}
        who="Режиссёр"
        standing="думает…"
        thought="Бабушка смеётся, Лиза обнимает её"
        unsaid=" — лица в фокусе, свет тёплый"
      />
    ),
    decided: (
      <CardNow
        uri={SHOT}
        author="Аня Петрова"
        authorLine="Аня · 13 сент, 16:42"
        now="Сейчас"
        who="Режиссёр"
        standing="решил"
        thought="Бабушка смеётся, Лиза обнимает её"
        decision={<BadgeDecision kind="take" label="Беру" />}
      />
    ),
    waiting: <CardNow who="Режиссёр" waiting="Ждём очереди" />,
  });
});

test('a card waiting its turn holds no frame and no thought — there is nothing in hand', () => {
  const waiting = story(<CardNow who="Режиссёр" waiting="Ждём очереди" />);
  expect(waiting).toContain('Ждём очереди');
  expect(waiting).not.toContain('Режиссёр');
});

test('the gaze square stands where it is told to and dims everything outside itself', () => {
  const left = story(<CardNow uri={SHOT} who="Режиссёр" gaze={{ left: 20, top: 10 }} />);
  const right = story(<CardNow uri={SHOT} who="Режиссёр" gaze={{ left: 118, top: 44 }} />);
  expect(left).not.toBe(right);
  // One view with a hole in it — a single outward shadow — and not four dimming panels around a
  // square. Without a gaze nothing on the frame carries a shadow at all.
  expect(right).toMatch(/r-boxShadow-\w+/);
  expect(story(<CardNow uri={SHOT} who="Режиссёр" />)).not.toMatch(/r-boxShadow-\w+/);
});

test('the thought is the one thing on the card a screen reader is told as it arrives', () => {
  // Spec 10.4: the square on the frame cannot be read out — what it is pointing at is the sentence
  // being said about it, so that sentence is the live area and the square stays silent.
  const card = story(<CardNow uri={SHOT} who="Режиссёр" thought="Бабушка" unsaid=" смеётся" />);
  expect(card).toContain('aria-live="polite"');
});

test('a thought still arriving already stands at its full height — the rest is laid out, not drawn', () => {
  // Spec 7.6, «экран не прыгает»: the sentence takes its final room from the first letter, so the
  // five stages under the card do not slide down a line at a time — nor jump back up the moment
  // the next sentence starts from nothing.
  const said = /Бабушка<[^]*?color:rgba\(0,0,0,0\.00\)"> смеётся</;
  expect(story(<CardNow uri={SHOT} who="Режиссёр" thought="Бабушка" unsaid=" смеётся" />)).toMatch(said);
  expect(story(<CardNow uri={SHOT} who="Режиссёр" unsaid="Бабушка смеётся" />)).toContain('Бабушка смеётся');
  expect(story(<LogEntry time="сейчас" uri={SHOT} text="Бабушка" unsaid=" смеётся" />)).toMatch(said);
  expect(story(<NoteThought text="Бабушка" unsaid=" смеётся" />)).toMatch(said);
  // Said in full, nothing is hidden and nothing blinks at the end of it.
  expect(story(<CardNow uri={SHOT} who="Режиссёр" thought="Бабушка смеётся" />)).not.toContain(
    'color:rgba(0,0,0,0.00)',
  );
});

test('the sheet draws the same frame bigger, with the same eye on it', () => {
  allDifferent({
    plain: <ShotGaze uri={SHOT} />,
    looking: <ShotGaze uri={SHOT} gaze={{ left: 118, top: 56 }} />,
    elsewhere: <ShotGaze uri={SHOT} gaze={{ left: 20, top: 10 }} />,
    // A frame that has been deleted since: the sheet is still the record, without a picture.
    gone: <ShotGaze gaze={{ left: 118, top: 56 }} />,
  });
  // Nothing is dimmed around this one — unlike the card, where the shadow is the dimming.
  expect(story(<ShotGaze uri={SHOT} gaze={{ left: 10, top: 10 }} />)).not.toMatch(
    /r-boxShadow-\w+/,
  );
});

test('the journal’s line is one line, whether the records are a block or a list', () => {
  // A whole stage's journal scrolls as a list and has no single box to draw a line down, so the
  // line is the same part laid behind it — and the block still draws it exactly once.
  const alone = story(<JournalLine />);
  expect(alone).toBeTruthy();
  expect(story(<Journal>{null}</Journal>)).toContain(alone.slice(alone.indexOf('class=')));
});

test('a thought is a plate with the sentence in it, and nothing else', () => {
  allDifferent({
    plan: <NoteThought text="План: три части — сборы, клятвы, танцы." />,
    file: <NoteThought text="Бабушка смеётся, Лиза обнимает её." />,
  });
  expect(story(<NoteThought text="План" />)).toContain('План');
});

test('a journal record comes in the three bodies the journal has', () => {
  allDifferent({
    file: (
      <LogEntry
        time="16:43"
        uri={SHOT}
        length="0:12"
        source="VID_0117 · Марк"
        text="Марк роняет кольцо — живой момент, но кадр трясётся."
        marks={<BadgeDecision kind="take" label="Беру 0:04–0:07" />}
      />
    ),
    series: (
      <LogEntry
        time="16:42"
        photos={SERIES}
        text="Серия из четырёх с тостом. Оставлю одну."
        marks={<BadgeDecision kind="take" label="Взял 1 из 4" />}
      />
    ),
    thought: (
      <LogEntry time="16:41">
        <NoteThought text="План: три части — сборы 0:35, клятвы 1:05, танцы 0:50." />
      </LogEntry>
    ),
  });
});

test('the freshest record is the one wearing the spark dot', () => {
  allDifferent({
    fresh: <LogEntry time="сейчас" fresh uri={SHOT} text="Бабушка" unsaid=" смеётся" />,
    older: <LogEntry time="16:43" uri={SHOT} text="Бабушка смеётся" />,
  });
  // The dot's own fill is a compiled class here (`story.tsx`), so what is asked is that the fresh
  // record and the ones behind it are not the same thing to look at.
  expect(story(<LogEntry time="сейчас" fresh uri={SHOT} text="Бабушка смеётся" />)).not.toBe(
    story(<LogEntry time="16:43" uri={SHOT} text="Бабушка смеётся" />),
  );
});

test('a record about a file opens it, and one about a thought has nowhere to go', () => {
  expect(story(<LogEntry time="16:43" uri={SHOT} text="Мысль" onPress={() => {}} />)).toContain(
    'role="button"',
  );
  expect(story(<LogEntry time="16:43" photos={SERIES} text="Мысль" onPress={() => {}} />)).not.toContain(
    'role="button"',
  );
});

test('a record says everything on it to a screen reader, the decision pills included', () => {
  // A label of the file's name, or of the thought, would keep the other two from anybody who cannot
  // see the pills: the record's decision is «Беру» or «Мимо», and that is the point of the record.
  const file = story(
    <LogEntry
      time="16:43"
      uri={SHOT}
      source="VID_0117 · Марк"
      text="Марк роняет кольцо"
      marks={<BadgeDecision kind="take" label="Беру 0:04–0:07" />}
      onPress={() => {}}
    />,
  );
  expect(file).toContain('role="button"');
  expect(file).not.toContain('aria-label');
  for (const words of ['VID_0117 · Марк', 'Марк роняет кольцо', 'Беру 0:04–0:07']) {
    expect(file).toContain(words);
  }
});

test('the journal draws the line its records hang off', () => {
  const journal = story(
    <Journal>
      <LogEntry time="сейчас" fresh uri={SHOT} text="Бабушка смеётся" />
      <LogEntry time="16:43" uri={SHOT} text="Дубль прошлого кадра" />
    </Journal>,
  );
  expect(journal).toContain('Бабушка смеётся');
  expect(journal).toContain('Дубль прошлого кадра');
  // One line for the whole journal: a record that drew its own would break at every gap.
  expect(journal).not.toBe(
    story(
      <>
        <LogEntry time="сейчас" fresh uri={SHOT} text="Бабушка смеётся" />
        <LogEntry time="16:43" uri={SHOT} text="Дубль прошлого кадра" />
      </>,
    ),
  );
});

test('a frame says which films it ended up in, and on what second', () => {
  const row = story(<RowFilmAt title="«Для родителей»" at="на 1:12" onPress={() => {}} />);
  expect(row).toContain('«Для родителей»');
  expect(row).toContain('на 1:12');
  expect(row).toContain('role="button"');
  expect(row).toContain('aria-label="«Для родителей» на 1:12"');
  expect(story(<RowFilmAt title="«Для родителей»" at="на 1:12" />)).not.toContain('role="button"');
});

test('a number tile is a number and the word it answers', () => {
  const tile = story(<TileNumber figure="214" label="просмотрел" />);
  expect(tile).toContain('214');
  expect(tile).toContain('просмотрел');
  allDifferent({
    seen: <TileNumber figure="214" label="просмотрел" />,
    taken: <TileNumber figure="61" label="взял в ролик" />,
  });
});
