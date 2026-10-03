import { mountsTrees } from '@tests/helpers/renderer';
import {
  Pressable,
  Text as RNText,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { BadgeDecision } from '@/kit/badge';
import { Icon } from '@/kit/icon';
import {
  GAZE_SHEET,
  Journal,
  JournalLine,
  LogEntry,
  NoteThought,
  RowFilmAt,
  ShotGaze,
  TileNumber,
} from '@/kit/montage-live';
import { allDifferent, story } from '@/kit/story';
import { setTheme, themes } from '@/theme';

/** Spec 7.6 and 7.7 — the surface of a montage being made: what is happening now, and every why. */

const SHOT = 'https://bucket.example/f01.jpg';
const SERIES = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg', 'https://b/4.jpg'];

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
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
  expect(
    story(<LogEntry time="16:43" photos={SERIES} text="Мысль" onPress={() => {}} />),
  ).not.toContain('role="button"');
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

/* ── The layout's numbers (measured off `design/screens`: `MontageLive`, `SheetLiveFile`,
      `MontageLiveDone`) ───────────────────────────────────────────────────────────────── */

/** What one element draws: every style in its tree, flattened, and the style of a native text. */
function drawn(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  const boxes = tree.root
    .findAll((node) => node.props.style !== undefined && typeof node.props.style !== 'function')
    .map((node) => StyleSheet.flatten(node.props.style) as ViewStyle);
  const text = (which: (props: Record<string, unknown>) => boolean) =>
    StyleSheet.flatten(
      tree.root.find((node) => node.type === RNText && which(node.props)).props.style,
    ) as TextStyle;
  const words = (said: string) => text((props) => [props.children].flat().join('') === said);
  return { boxes, text, words, done: () => act(() => tree.unmount()) };
}

test('the eye is the square the layout draws: 114 on the sheet, hairline in', () => {
  // `SheetLiveFile`: 114 × 114 at 134, 87 — 118, 56 into its frame. The spec's 110 is the CSS box
  // inside the 2px border; the app drew that as the whole square, 4 short each way.
  const { spark } = themes.dark.color;
  const sheet = drawn(<ShotGaze uri={SHOT} gaze={{ left: 118, top: 56 }} />);
  expect(
    sheet.boxes.find((box) => box.borderColor === spark && box.borderWidth === 2),
  ).toMatchObject({ width: 114, height: 114, borderRadius: 16 });
  sheet.done();
  expect(GAZE_SHEET).toBe(114);
});

/** The words a thought is said in: the `Text` holding the sentence that is (partly) said. */
const thoughtOf = (said: string) => (props: Record<string, unknown>) =>
  (props.children as { props?: { said?: string } } | undefined)?.props?.said === said;

test('a thought is one plate wherever it stands: 16 round, 12 in, the 22 with its 12 sparkle, 13 / 400 / 18', () => {
  // Spec detail 50 and 10.11, «Плашка мысли — одна»: `SheetLiveFile.json` e16–e19 — radius 16, 12 in
  // inside its hairline (29 − 16 − 1), the `spark` 22 with a sparkle 12 at 2.4, the words 10 after it
  // at 13 / 400; `MontageLiveStage.json` e52–e55 drew another, 14 round with a 20 and 13 / 500. The
  // spec keeps one, on the 18 line — the app drew the journal's 20 and 13 / 500 / 19 in both places.
  const { accentEdge, accentNote, spark, sparkInk, paper } = themes.dark.color;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NoteThought text="План: три части" />);
  });
  const boxes = tree.root
    .findAll((node) => node.props.style !== undefined && typeof node.props.style !== 'function')
    .map((node) => StyleSheet.flatten(node.props.style) as ViewStyle);
  expect(boxes.find((box) => box.borderColor === accentEdge)).toMatchObject({
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 10,
    backgroundColor: accentNote,
  });
  expect(accentEdge).toBe('rgba(75,91,255,0.35)');
  expect(boxes.find((box) => box.backgroundColor === spark)).toMatchObject({
    width: 22,
    height: 22,
  });
  expect(tree.root.findByType(Icon).props).toMatchObject({
    size: 12,
    stroke: 2.4,
    color: sparkInk,
  });
  expect(
    StyleSheet.flatten(tree.root.find((node) => node.type === RNText).props.style),
  ).toMatchObject({ fontSize: 13, lineHeight: 18, fontFamily: 'Onest_400Regular', color: paper });
  act(() => tree.unmount());
});

test('a record’s time is 11 / 600 — «сейчас» in paper, every one behind it muted — over its file at 11 / 500 and the thought at 13 / 400 / 18', () => {
  // Spec detail 61 and `MontageLiveStage.json`: «сейчас» (e19) Onest 11 / 600 `#F5F3EE`, «16:43»
  // (e28) 11 / 600 — `faint` in the layout, `muted` in the spec (10.1, 10.11); «IMG_2041 · Аня»
  // (e22) 11 / 500 `muted`; the thought (e23) 13 / 400 / 18 `paper`. The app drew the time and the
  // file in the meta's 12 / 500, the older times in `faint`, and the thought 13 / 500 / 19.
  const { muted, paper } = themes.dark.color;
  const fresh = drawn(
    <LogEntry time="сейчас" fresh uri={SHOT} source="IMG_2041 · Аня" text="Бабушка смеётся" />,
  );
  expect(fresh.words('сейчас')).toMatchObject({
    fontSize: 11,
    fontFamily: 'Onest_600SemiBold',
    color: paper,
  });
  expect(fresh.words('IMG_2041 · Аня')).toMatchObject({
    fontSize: 11,
    fontFamily: 'Onest_500Medium',
    color: muted,
  });
  expect(fresh.text(thoughtOf('Бабушка смеётся'))).toMatchObject({
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Onest_400Regular',
    color: paper,
  });
  fresh.done();
  const older = drawn(<LogEntry time="16:43" uri={SHOT} text="Дубль прошлого кадра" />);
  expect(older.words('16:43')).toMatchObject({
    fontSize: 11,
    fontFamily: 'Onest_600SemiBold',
    color: muted,
  });
  older.done();
});

test('a video’s time on a journal thumbnail is 9 / 700 and untracked, 3 in and 2 up', () => {
  // `MontageLive.json` e50 and `MontageLiveStage.json` e31: «0:12» Onest 9 / 700 white, 12 tall,
  // ending 3 from the thumbnail's right and 2 above its foot (spec detail 56). The app wrote it in
  // `badgeSm` — 10 / 700 at 0.6 of tracking.
  const entry = drawn(<LogEntry time="16:43" uri={SHOT} length="0:12" text="Марк роняет кольцо" />);
  const time = entry.words('0:12');
  expect(time).toMatchObject({
    fontSize: 9,
    lineHeight: 12,
    fontFamily: 'Onest_700Bold',
    color: '#FFFFFF',
    paddingRight: 101 - (76.89 + 21.11),
    paddingBottom: 603 - (589 + 12),
  });
  expect(time.letterSpacing).toBeUndefined();
  entry.done();
});

test('a film a frame lies in is a row of 42 — a floor, the words grow it', () => {
  // Spec detail 62 and 10.11 («строка ролика в сведениях 40 → 42»), `SheetFrameInfo.json` e21:
  // 358 × 42, radius 12, `#14152A` in `rgba(75,91,255,0.35)`.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <RowFilmAt title="«Для родителей»" at="на 1:12" onPress={() => {}} />,
    );
  });
  const press = tree.root.findByType(Pressable).props.style as (state: {
    pressed: boolean;
  }) => unknown;
  const box = StyleSheet.flatten(press({ pressed: false }) as ViewStyle) as ViewStyle;
  expect(box).toMatchObject({
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderColor: themes.dark.color.accentEdge,
  });
  expect(box.height).toBeUndefined();
  act(() => tree.unmount());
});

test('a number tile is 66 tall: 13 in, the 24 figure, 2, the 11 / 500 word on its 14 line, 13 out', () => {
  // `MontageLiveDone`: tiles 114 × 66 from 409, figures at 422 (20 / 24), words at 448 (11 / 500,
  // `muted`). The app drew the word as the 12 / 500 meta on a 15 line, and the tile came out 67.
  const tile = drawn(<TileNumber figure="214" label="просмотрел" />);
  const box = tile.boxes.find((one) => one.borderWidth === 1) as ViewStyle;
  const figure = tile.words('214');
  const word = tile.words('просмотрел');
  expect(word).toMatchObject({
    fontSize: 11,
    fontFamily: 'Onest_500Medium',
    color: themes.dark.color.muted,
  });
  const inset = Number(box.padding) + Number(box.borderWidth);
  expect(inset).toBe(422 - 409);
  expect(inset + Number(figure.lineHeight) + Number(box.gap)).toBe(448 - 409);
  expect(inset * 2 + Number(figure.lineHeight) + Number(box.gap) + Number(word.lineHeight)).toBe(
    66,
  );
  tile.done();
});
