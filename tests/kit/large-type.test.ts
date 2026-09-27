import { fontFile, wordWidth } from '@tests/helpers/font';
import { flat } from '@tests/helpers/source';
import { expect, test } from 'vitest';

import { CANCEL_WORD_SCALE } from '@/kit/bars';
import bars from '@/kit/bars.tsx?raw';
import { rowHolds } from '@/kit/segment';
import { HEADING_MOST, TYPE_MOST, type TypeRole } from '@/kit/text';
import { en, ru, type Strings } from '@/strings';
import { type } from '@/theme';

/**
 * The wizard's «Отмена» and the seven groups of segments on the smallest phones with the largest type
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
const CAP = TYPE_MOST;

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
 * 176 on 320, 216 on 360, 231 on 375 — and every word it carries fits whole at the largest type,
 * where the blocks at 74 would have broken «Новый» and «ролик» letter by letter.
 *
 * The counter is `label`, and `label` stops at the kit's ×2 (TASK-377): the English total, «Summary»,
 * is 116.5 there against 176 on 320 — the 208.0 it would be at ×3.571 was the gap TASK-373 held open,
 * and the ceiling is what closed it (TASK-375). Worked out at the role's own ceiling, so lifting that
 * ceiling past what the counter holds fails here.
 */
test('with the side blocks at 44, the words of the counter fit whole at the largest type', () => {
  const room = (phone: number, block: number) => phone - 2 * 16 - 2 * block - 2 * 12;
  expect(PHONES.map((phone) => room(phone, 44))).toEqual([231, 216, 176]);
  expect(flat(bars)).toContain('<Text role="label" tone="muted" style={styles.wizardStep}>');
  const grown = Math.min(3.571, HEADING_MOST.label ?? TYPE_MOST);
  expect(grown).toBe(2);
  const broken = [ru, en].flatMap((s) =>
    [s.montage.step(2, 4), s.montage.newOne, s.montage.summaryStep]
      .flatMap((line) => line.split(' '))
      .flatMap((word) =>
        PHONES.filter((phone) => width(word, 13) * grown > room(phone, 44)).map(
          (phone) => `${word} on ${phone}`,
        ),
      ),
  );
  expect(broken).toEqual([]);
  expect(width(en.montage.summaryStep, 13) * grown).toBeCloseTo(116.5, 0);
  expect(width(ru.montage.newOne.split(' ')[0], 13) * 3.571).toBeGreaterThan(room(320, 74));
});

/** The seven groups (spec 7.3, detail 18), their words from the dictionary and the size each is set in. */
const GROUPS: { name: string; size: number; words: (s: Strings) => string[] }[] = [
  { name: 'Тип', size: 14, words: (s) => [s.media.photo, s.media.video] },
  {
    name: 'Ориентация',
    size: 14,
    words: (s) => [s.gallery.orientations.landscape, s.gallery.orientations.portrait],
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
  Тип: { ru: 'r r r r r r', en: 'r r r r r r' },
  Ориентация: { ru: 'r c r c r c', en: 'r r r r r r' },
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
 * TASK-377 — how far each role grows with the system's type, worked out the same way: the widest
 * word a role carries, off the file of its own face, in the room it has on the narrowest iPhone
 * (375 × 667, the smallest the app installs on). Letter-spacing is left out, which only ever makes a
 * word narrower, so every figure here errs on the side of fitting.
 */
const IPHONE = 375;

/** The file a role's face is drawn from: `Unbounded_700Bold` → the package's own ttf. */
const faceOf = (role: TypeRole) => {
  const family = String(type[role].fontFamily);
  const [name, weight] = family.split('_');
  return fontFile(`@expo-google-fonts/${name.toLowerCase()}/${weight}/${family}.ttf`);
};

/**
 * The headings of the empty states, one per `<Empty title=…>` in the sources. «Приглашение» on
 * `InviteDead` (TASK-400) was missing here, and at the ceiling the four others allowed — ×1.93 — it
 * broke «Приглаше / ние» on 375.
 */
const EMPTY_TITLES: ((s: Strings) => string)[] = [
  (s) => s.contacts.emptyTitle,
  (s) => s.gallery.emptyTitle,
  (s) => s.home.emptyTitle,
  (s) => s.upload.emptyTitle,
  (s) => s.join.deadTitle,
];

test('every empty state that carries a heading is measured with the others', () => {
  const sources = Object.values(
    import.meta.glob<string>('@/{app,screens}/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  );
  const titled = sources.flatMap((source) => source.match(/<Empty\b[^>]*\btitle=/g) ?? []);
  expect(titled).toHaveLength(EMPTY_TITLES.length);
});

/** The words of a line, without the marks around them that never stand alone at a line's edge. */
const wordsOf = (lines: string[]) =>
  lines.flatMap((line) => line.split(/[\s—–]+/)).map((word) => word.replace(/[«»“”,.:;!?…]/g, ''));

/**
 * Every heading, the room it stands in on 375 and what it carries there. `line`: the heading is one
 * line by design, so what has to fit is all of it, not its widest word.
 */
const HEADINGS: {
  role: TypeRole;
  room: number;
  line?: boolean;
  carries: (s: Strings) => string[];
}[] = [
  // `OnboardingHead`: the words stand 24 in from either side.
  { role: 'hero', room: IPHONE - 2 * 24, carries: () => ['Remember'] },
  // `Consent`: 24 in, measured at `invite`'s 32 — tighter, so it errs on the side of fitting.
  { role: 'heroNarrow', room: IPHONE - 2 * 32, carries: () => ['Remember'] },
  // «Присоединяем…» on `invite`, `hero малый`: 32 in.
  { role: 'heroSm', room: IPHONE - 2 * 32, carries: () => ['Remember'] },
  // The wizard's heading, in the screen's own 16.
  {
    role: 'display',
    room: IPHONE - 2 * 16,
    carries: (s) => [
      s.montage.templateTitle,
      s.montage.pickTitle,
      s.montage.droppedTitle,
      s.montage.storyTitle,
      s.montage.musicTitle,
      s.montage.buildTitle,
      s.montage.summaryTitle,
    ],
  },
  // The root bar: 16 a side, and the round 44 on the right 12 away.
  { role: 'displaySm', room: IPHONE - 2 * 16 - 44 - 12, carries: (s) => [s.home.title] },
  // The empty state stands 36 in (spec 4, `HomeEmpty`: the paragraph is 318 of 390). Every heading an
  // `Empty` is handed — held to that by the sweep of the sources below.
  {
    role: 'emptyTitle',
    room: IPHONE - 2 * 36,
    carries: (s) => EMPTY_TITLES.map((title) => title(s)),
  },
  // A sheet: 16 a side inside a hairline.
  {
    role: 'sheetTitle',
    room: IPHONE - 2 * 16 - 2,
    carries: (s) => [
      s.labels.editTitle,
      s.labels.newOne,
      s.consent.agreement.title,
      s.edit.cover,
      s.gallery.sorting,
      s.members.inviteTitle,
      s.profile.edit,
    ],
  },
  // A confirmation: the same, less the 64 mark beside the question and the 14 after it.
  {
    role: 'sheetTitleSm',
    room: IPHONE - 2 * 16 - 2 - 64 - 14,
    carries: (s) => [
      s.edit.leaveAsk,
      s.gallery.deleteAsk('video'),
      s.labels.deleteAsk(''),
      s.montage.leaveAsk,
      s.profile.logOutAsk,
      s.settings.deleteAsk,
      s.upload.askAll,
      s.montage.tooLittleTitle,
    ],
  },
  // The inner bar: 16 a side, «Назад» 44 pulled 10 out, 8 to the words. Its own words only — the
  // memory's name in it is the person's, and is cut with an ellipsis by the spec (7.1, detail 2).
  {
    role: 'barTitle',
    room: IPHONE - 2 * 16 + 10 - 44 - 8,
    line: true,
    carries: (s) => [s.create.title, s.contacts.title, s.edit.title, s.profile.title],
  },
];

test.each(HEADINGS)(
  'a $role heading grows only while what it carries fits whole on 375',
  (heading) => {
    const face = faceOf(heading.role);
    const size = type[heading.role].fontSize as number;
    const most = HEADING_MOST[heading.role] as number;
    const pieces = [ru, en].flatMap((s) =>
      heading.line ? heading.carries(s) : wordsOf(heading.carries(s)),
    );
    const widest = Math.max(...pieces.map((piece) => wordWidth(face, piece, size)));
    expect(widest * most, heading.role).toBeLessThanOrEqual(heading.room);
    // And no lower than it has to be — the ceiling is the measurement, not a guess under it. The bar
    // alone stops at ×1 whatever the room: a one-line heading of a bar does not grow, the way an iOS
    // navigation bar's title does not.
    if (heading.role === 'barTitle') expect(most).toBe(1);
    else expect(widest * (most + 0.02), heading.role).toBeGreaterThan(heading.room);
  },
);

test('the bar’s one-line headings do not grow at all, and no role grows past the kit’s ×2', () => {
  expect(HEADING_MOST.barTitleLive).toBe(1);
  expect(HEADING_MOST.pillTitle).toBe(1);
  for (const [role, most] of Object.entries(HEADING_MOST)) {
    expect(most, role).toBeGreaterThanOrEqual(1);
    expect(most, role).toBeLessThanOrEqual(TYPE_MOST);
  }
});

/**
 * Running text stops at ×2: the widest word the dictionary puts in it, «зарегистрироваться» (Onest
 * 400 at 16), fits whole in the column of the narrowest phones — 343 on the 375 iPhone, 328 on a
 * 360 Android — and iOS's next step with room for fewer letters, ×2.643, breaks it on both. Words
 * that are not words — an address, a key, a hyphenated pair that breaks at its hyphen — are left
 * out.
 */
test('at ×2 the widest word of running text fits whole on the narrowest phones', () => {
  const body = faceOf('body');
  const all: string[] = [];
  const collect = (node: unknown): void => {
    if (typeof node === 'string') all.push(node);
    else if (typeof node === 'function') {
      // A sentence around a count or a name: said with one, where it takes one.
      for (const given of [3, 'Лиза']) {
        try {
          const line = (node as (...args: unknown[]) => unknown)(given);
          if (typeof line === 'string') all.push(line);
        } catch {}
      }
    } else if (node && typeof node === 'object')
      for (const one of Object.values(node)) collect(one);
  };
  collect(ru);
  collect(en);
  const words = wordsOf(all).filter((word) => !/[@_/\d-]/.test(word));
  const width16 = (word: string) => wordWidth(body, word, type.body.fontSize as number);
  const widest = words.reduce((a, b) => (width16(b) > width16(a) ? b : a));
  expect(widest).toBe('зарегистрироваться');
  expect(TYPE_MOST).toBe(2);
  for (const phone of [375, 360]) {
    expect(width16(widest) * TYPE_MOST, `${phone}`).toBeLessThanOrEqual(phone - 2 * 16);
    expect(width16(widest) * 2.643, `${phone}`).toBeGreaterThan(phone - 2 * 16);
  }
});

/**
 * The words themselves, as the spec writes them in the table of the seven groups — and the widest of
 * each, at the size the spec measured it at. The rows-and-columns table above is only as good as the
 * words it is worked out from: a shorter word in the dictionary would quietly turn a column back
 * into a row and this file would go on agreeing with itself.
 */
test('the dictionary’s words are the spec’s, and the widest of each group is the width the spec gives', () => {
  // `widest` is ru and en at the group's own size and ×1: «(111)» in the spec is ×1, «(86)» and
  // «(93)» are ×2, halved here.
  const spec: Record<string, { ru: string[]; en: string[]; widest: [number, number] }> = {
    Тип: { ru: ['Фото', 'Видео'], en: ['Photo', 'Video'], widest: [43, 39.3] },
    Ориентация: {
      ru: ['Горизонтальные', 'Вертикальные'],
      en: ['Wide', 'Tall'],
      widest: [113.9, 34],
    },
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
