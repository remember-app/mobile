import { afterEach, beforeAll, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { JournalEntry, JournalFile } from '@/api';
import { story } from '@/kit/story';
import { setLanguage } from '@/lib/language';
import { SheetLiveFile } from '@/screens/memory/live-file';
import { setTheme, themes } from '@/theme';

/**
 * `SheetLiveFile` (spec 8, «файл журнала») is a sheet of facts, not of a question: 14 between its
 * blocks, the same rhythm as the frame's own sheet and the labels', whatever it is told — a frame
 * that is gone, a thought that runs long, the English words.
 */

beforeAll(() => setTheme('dark'));
afterEach(() => setLanguage('ru'));

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 7,
  stage: 'directing',
  media_id: 'f1',
  thought: 'Общий план, все смотрят в кадр и смеются, свет мягкий. '.repeat(6),
  decision: 'take',
  reason: null,
  series_size: null,
  story_part: 2,
  story_part_title: 'Дорога',
  source_from_seconds: null,
  source_to_seconds: null,
  labels: ['смех', 'закат', 'семья'],
  focus: { x: 0.2, y: 0.3, w: 0.4, h: 0.4 },
  created_at: new Date(2026, 8, 20, 12).toISOString(),
  ...over,
});
const file: JournalFile = {
  id: 'f1',
  kind: 'photo',
  uploaded_by: 'u',
  captured_at: new Date(2026, 8, 13, 21, 47).toISOString(),
  duration_seconds: null,
  thumbnail_url: 'https://example.test/f1.jpg',
  places: [{ start_seconds: 12, duration_seconds: 3 }],
};

test('the file is named 14 / 600, and where it lay is said 12 / 600 in accent', async () => {
  // `SheetLiveFile`: «IMG_2041 · фото» Onest 14 / 600 on its 18 line beside the 32 face, and «Часть 2
  // «Клятвы» · 1:12–1:16» Onest 12 / 600 `accentText`, tabular. The app named the file in the 17 /
  // 600 subtitle and said the place in the 12 / 500 meta.
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <SheetLiveFile entry={entry()} file={file} author="Аня Петрова" onCancel={() => {}} />,
    );
  });
  const style = (said: string) =>
    StyleSheet.flatten(
      tree.root.find((node) => node.type === Text && [node.props.children].flat().join('') === said)
        .props.style,
    );
  expect(style('Фото')).toMatchObject({
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Onest_600SemiBold',
  });
  expect(style('Часть 2 «Дорога» · 0:12–0:15')).toMatchObject({
    fontSize: 12,
    fontFamily: 'Onest_600SemiBold',
    color: themes.dark.color.accentText,
    fontVariant: ['tabular-nums'],
  });
  await act(async () => tree.unmount());
});

/** The sheet's own style: its rhythm and, under it, the scroll's — where a floor would show too. */
const sheetStyle = (markup: string) => /style="(gap:[^"]*padding-bottom:[^"]*)"/.exec(markup)?.[1];

test.each([
  ['ru', entry(), file],
  ['en', entry({ thought: 'A wide shot, everybody laughing at the camera. '.repeat(8) }), file],
  ['ru', entry({ decision: 'skip', reason: 'blur', thought: null, labels: null }), file],
  // The frame has been deleted from the memory since: the sheet has the words and no picture.
  ['ru', entry(), undefined],
] as const)(
  'in %s the file of the journal keeps 14 between its blocks',
  async (language, one, of) => {
    await setLanguage(language);
    const drawn = story(
      <SheetLiveFile entry={one} file={of} author="Аня Петрова" onCancel={() => {}} />,
    );
    expect(sheetStyle(drawn)).toMatch(/^gap:14px;/);
    // It scrolls once it outgrows the screen, and keeps the same 14 inside the scroll.
    expect(drawn).toContain('<div class="css-view-g5y9jx" style="gap:14px">');
    expect(drawn).toContain('data-testid="sheet-handle"');
  },
);
