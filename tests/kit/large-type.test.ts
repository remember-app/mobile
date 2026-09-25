import { fontFile, wordWidth } from '@tests/helpers/font';
import { expect, test } from 'vitest';

import { CANCEL_WORD_SCALE } from '@/kit/bars';
import { rowHolds } from '@/kit/segment';
import { en, ru, type Strings } from '@/strings';

/**
 * The wizard's «Отмена» and the six groups of segments on the smallest phones with the largest type
 * (TASK-373), worked out the way the spec works them out: each word from the dictionary, measured
 * off the font file the app draws it in (Onest 600, no kerning), times the system's type size, in
 * the room each phone leaves (spec 7.1, detail 3 and spec 7.3, detail 18). The numbers held here are
 * the spec's own — its measurements and its table of rows and columns — and not the kit's.
 */

const ONEST = fontFile('@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf');
const width = (words: string, size: number) => wordWidth(ONEST, words, size);

/** The three phones of the check, and the largest type each takes: iOS ×3.571, Android ×2.0. */
const PHONES = [375, 360, 320] as const;
/** Spec 7.3, detail 18: the words of a segment grow with the type up to ×2.0 and stop there. */
const CAP = 2;

test('the font file measures the words as the spec did', () => {
  // The spec writes its figures to a tenth, cut rather than rounded here and there.
  const spec: [number, number][] = [
    [width('Отмена', 14), 51.7],
    [width('Отмена', 14) * 3.571, 184.8],
    [width('Cancel', 14), 45.5],
    [width('Горизонтальный', 14), 114.4],
    [width('All of it', 14) * CAP, 92.8],
    [width('System', 13) * CAP, 92.6],
    [width('Новый', 13) * 3.571, 149.6],
  ];
  for (const [measured, written] of spec) expect(Math.abs(measured - written)).toBeLessThan(0.1);
});

/**
 * «Отмена» (spec 7.1, detail 3): the word has 64 in its 74 block — 10 a side, hung 10 past the
 * margin — and stays a word up to ×1.2, in both languages. Past that it is a round 44.
 */
test('«Отмена» is a word as far as it fits whole, and a glyph from the next size up', () => {
  expect(CANCEL_WORD_SCALE).toBe(1.2);
  const room = 74 + 10 - 2 * 10;
  for (const s of [ru, en]) {
    expect(width(s.action.cancel, 14) * CANCEL_WORD_SCALE, s.action.cancel).toBeLessThanOrEqual(
      room,
    );
  }
  // The size steps of the two phones either side of the line: iOS 1.118 and 1.235, Android 1.15 and
  // 1.3 — the first of each pair is the word, the second the glyph.
  for (const scale of [1.118, 1.15]) expect(scale).toBeLessThanOrEqual(CANCEL_WORD_SCALE);
  for (const scale of [1.235, 1.3]) expect(scale).toBeGreaterThan(CANCEL_WORD_SCALE);
});

/**
 * The counter between the two blocks: with them at 44 it has, less the 12 either side of it,
 * 176 on 320, 216 on 360, 231 on 375 — and the words the spec measured fit whole at the largest
 * type, where the blocks at 74 would have broken «Новый» and «ролик» letter by letter.
 *
 * One word the spec did not measure does not: the English total, «Summary», is 208.0 at ×3.571 and
 * breaks on 320. That is the counter's own gap, not «Отмена»'s — reported with TASK-373 rather than
 * decided here, and held so that closing it, or opening another, changes this test.
 */
test('with the side blocks at 44, the words of the counter fit whole at the largest type', () => {
  const room = (phone: number, block: number) => phone - 2 * 16 - 2 * block - 2 * 12;
  expect(PHONES.map((phone) => room(phone, 44))).toEqual([231, 216, 176]);
  const broken = [ru, en].flatMap((s) =>
    [s.montage.step(2, 4), s.montage.newOne, s.montage.summaryStep]
      .flatMap((line) => line.split(' '))
      .flatMap((word) =>
        PHONES.filter((phone) => width(word, 13) * 3.571 > room(phone, 44)).map(
          (phone) => `${word} on ${phone}`,
        ),
      ),
  );
  expect(broken).toEqual(['Summary on 320']);
  expect(width(ru.montage.newOne.split(' ')[0], 13) * 3.571).toBeGreaterThan(room(320, 74));
});

/** The six groups (spec 7.3, detail 18), their words from the dictionary and the size each is set in. */
const GROUPS: { name: string; size: number; words: (s: Strings) => string[] }[] = [
  {
    name: 'Тип',
    size: 14,
    words: (s) => [s.gallery.anyKind, s.media.photo, s.media.video],
  },
  {
    name: 'Порядок',
    size: 14,
    words: (s) => [s.gallery.orders.newest, s.gallery.orders.oldest],
  },
  {
    name: 'Собрать в группы',
    size: 14,
    words: (s) => [s.gallery.groups.none, s.gallery.groups.person, s.gallery.groups.kind],
  },
  { name: 'Тема', size: 13, words: (s) => [s.theme.system, s.theme.dark, s.theme.light] },
  { name: 'Язык', size: 14, words: (s) => [s.language.ru, s.language.en] },
  {
    name: 'Формат',
    size: 14,
    words: (s) => [s.montage.orientation.landscape, s.montage.orientation.portrait],
  },
];

/**
 * The spec's table, as it is written there: for each group, ru / en, on 375, 360 and 320, at the
 * ordinary size and at ×2.0 (×3.571 is drawn as ×2.0). `r` is a row, `c` a column.
 */
const TABLE: Record<string, Record<'ru' | 'en', string>> = {
  //                          375×1  375×2  360×1  360×2  320×1  320×2
  Тип: { ru: 'r r r r r c', en: 'r r r r r c' },
  Порядок: { ru: 'r c r c r c', en: 'r c r c r c' },
  'Собрать в группы': { ru: 'r c r c c c', en: 'r c r c r c' },
  Тема: { ru: 'r c r c c c', en: 'r r r r r c' },
  Язык: { ru: 'r r r r r r', en: 'r r r r r r' },
  Формат: { ru: 'r c r c r c', en: 'r r r r r r' },
};

test.each(GROUPS)('«$name» stands as the spec’s table has it, on every phone and size', (group) => {
  for (const [language, s] of [
    ['ru', ru],
    ['en', en],
  ] as const) {
    const words = group.words(s).map((word) => width(word, group.size));
    const drawn = PHONES.flatMap((phone) =>
      [1, 3.571].map((scale) =>
        rowHolds(
          phone - 2 * 16,
          words.map((word) => word * Math.min(scale, CAP)),
        )
          ? 'r'
          : 'c',
      ),
    ).join(' ');
    expect(drawn, `«${group.name}» ${language}`).toBe(TABLE[group.name][language]);
  }
});

/**
 * And a column always holds: the widest word at ×2.0 fits whole in a cell of its own less its 12 a
 * side — 309 on 375, 294 on 360, 254 on 320 — so nothing is ever broken letter by letter. Uncapped,
 * «Горизонтальный» at ×3.571 would be 408.5 against 254: the reason for the cap.
 */
test('stacked, every word of every group fits whole at the capped size on the smallest phone', () => {
  const column = (phone: number) => phone - 2 * 16 - 2 * (4 + 1) - 2 * 12;
  expect(PHONES.map(column)).toEqual([309, 294, 254]);
  for (const s of [ru, en])
    for (const group of GROUPS)
      for (const word of group.words(s)) {
        expect(width(word, group.size) * CAP, word).toBeLessThanOrEqual(column(320));
        // The spec's guard for a new word: at its own size, no wider than half the column on 320.
        expect(width(word, group.size), word).toBeLessThanOrEqual(column(320) / CAP);
      }
  expect(width(ru.montage.orientation.landscape, 14) * 3.571).toBeGreaterThan(column(320));
});

/**
 * The words themselves, as the spec writes them in the table of the six groups — and the widest of
 * each, at the size the spec measured it at. The rows-and-columns table above is only as good as the
 * words it is worked out from: a shorter word in the dictionary would quietly turn a column back
 * into a row and this file would go on agreeing with itself.
 */
test('the dictionary’s words are the spec’s, and the widest of each group is the width the spec gives', () => {
  // `widest` is ru and en at the group's own size and ×1: «(111)» in the spec is ×1, «(86)» and
  // «(93)» are ×2, halved here.
  const spec: Record<string, { ru: string[]; en: string[]; widest: [number, number] }> = {
    Тип: { ru: ['Всё', 'Фото', 'Видео'], en: ['All of it', 'Photo', 'Video'], widest: [43, 46.4] },
    Порядок: {
      ru: ['Сначала новые', 'Сначала старые'],
      en: ['Newest first', 'Oldest first'],
      widest: [111, 81.5],
    },
    'Собрать в группы': {
      ru: ['Не собирать', 'По людям', 'По типу'],
      en: ['No groups', 'By person', 'By kind'],
      widest: [86, 69],
    },
    Тема: {
      ru: ['Как в системе', 'Тёмная', 'Светлая'],
      en: ['System', 'Dark', 'Light'],
      widest: [91, 46.3],
    },
    Язык: { ru: ['Русский', 'English'], en: ['Русский', 'English'], widest: [57, 57] },
    Формат: {
      ru: ['Горизонтальный', 'Вертикальный'],
      en: ['Wide', 'Tall'],
      widest: [114.4, 34],
    },
  };
  for (const group of GROUPS) {
    const { ru: inRu, en: inEn, widest } = spec[group.name];
    expect(group.words(ru), group.name).toEqual(inRu);
    expect(group.words(en), group.name).toEqual(inEn);
    for (const [words, at] of [
      [inRu, widest[0]],
      [inEn, widest[1]],
    ] as const)
      expect(
        Math.max(...words.map((word) => width(word, group.size))),
        `${group.name}: ${words}`,
      ).toBeCloseTo(at, 0);
  }
});
