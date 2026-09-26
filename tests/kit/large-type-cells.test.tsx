import { expect, test, vi } from 'vitest';

// The system's type size, turned by the test: the calendar and the slider fit their cells by it.
const { phone } = vi.hoisted(() => ({ phone: { fontScale: 1 } }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 375, height: 667, scale: 2, fontScale: phone.fontScale }),
    // The plain container `vitest.setup.ts` makes of it: this mock replaces that one, it does not add.
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { fontFile, wordWidth } from '@tests/helpers/font';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import { Calendar } from '@/kit/calendar';
import { LengthSlider } from '@/kit/slider';
import { Text, TYPE_MOST } from '@/kit/text';
import { formatRuntime, weekdayLetters } from '@/lib/dates';
import { strings } from '@/strings';
import { space, type } from '@/theme';

/**
 * TASK-372, spec 7.3 details 15 and 19 — the two parts whose cells the layout fixes (a day of the
 * calendar, a ready length on the slider) on large type. The words grow as far as the cell holds
 * them and the cell grows down; at the system's own size it is the layout's own, 40 and 32. Read
 * against the font file the words are drawn in, so that the widths the parts assume for a figure
 * are held to what Onest really sets: a wrong assumption is a figure through its neighbour.
 */

mountsTrees();

const ONEST = (weight: string) =>
  fontFile(`@expo-google-fonts/onest/${weight}/Onest_${weight}.ttf`);
/** How wide a pair of tabular figures runs in em: the widest digit twice, in either weight the parts draw them in. */
const PAIR =
  Math.max(
    ...['500Medium', '700Bold'].map((weight) =>
      Math.max(...[...'0123456789'].map((digit) => wordWidth(ONEST(weight), digit, 1))),
    ),
  ) * 2;

/** The window sizes of the two phones the app is checked on, and the type sizes that put them under strain. */
const SCALES = [0.85, 1, 1.15, 1.5, 2, 3.571];

/** A pressable's style is asked as a function of whether it is pressed; here nobody is pressing it. */
const flat = (node: ReactTestInstance) => {
  const { style } = node.props;
  return StyleSheet.flatten(
    typeof style === 'function' ? style({ pressed: false }) : style,
  ) as ViewStyle;
};

async function drawCalendar(
  width: number,
  fontScale: number,
  picked: Date[] = [],
  weekdays = weekdayLetters('ru'),
) {
  phone.fontScale = fontScale;
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Calendar
          month={new Date(2026, 8, 1)}
          onMonth={() => {}}
          from={new Date(2026, 8, 28)}
          onPick={(day) => picked.push(day)}
          weekdays={weekdays}
          monthLabel="Сентябрь 2026"
          prevLabel="Назад"
          nextLabel="Вперёд"
          dayLabel={(day) => `${day.getDate()} сентября`}
        />,
      ),
    );
  });
  const root = tree.root;
  const grid = root.find((one) => one.type === View && typeof one.props.onLayout === 'function');
  if (width > 0)
    await act(async () =>
      grid.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 300 } } }),
    );
  phone.fontScale = 1;
  const days = root
    .findAllByType(Pressable)
    .filter((one) => /сентября$/.test(one.props.accessibilityLabel));
  return {
    root,
    days,
    picked,
    /** The cell of the 7th and the figure in the 28th — the edge of the range, in its heavier face. */
    figure: (n: number) =>
      days.find((one) => one.props.accessibilityLabel === `${n} сентября`)!.findByType(Text),
    weekdays: () => root.findAll((one) => one.type === Text && one.props.role === 'badge'),
    /** The empty places at the ends of the first and last week — cells with nothing in them. */
    blanks: () =>
      root.findAll(
        (one) =>
          one.type === View &&
          flat(one).flex === 1 &&
          flat(one).height !== undefined &&
          one.findAllByType(Text).length === 0,
      ),
  };
}

test.each([
  [262, 'the zoomed iPhone SE'],
  [256, 'the card at its narrowest'],
  [343, 'an iPhone at 375'],
  [288, 'an iPhone at 320'],
])(
  'a calendar week %s wide (%s) keeps the figures in their days at every type size, and the days 44 tall from the first size up',
  async (width) => {
    for (const scale of SCALES) {
      const it = await drawCalendar(width, scale);
      const column = width / 7;
      const cells = it.days.map((one) => flat(one).height as number);
      // The layout's own cell at the system's size, or smaller — 40 where a column holds a finger's
      // 44; a week narrower than seven fingers (the zoomed SE, 262) cannot give a day 44 across and
      // scrolls nothing sideways, so its days are 44 tall at every size (TASK-375). Larger type makes
      // any cell 44 or more.
      if (scale <= 1) expect(new Set(cells), `×${scale}`).toEqual(new Set([column < 44 ? 44 : 40]));
      else expect(Math.min(...cells), `×${scale}`).toBeGreaterThanOrEqual(44);
      // The circle of a day keeps inside its column, so two picked days side by side never meet.
      for (const day of it.days) {
        const [circle] = day.findAll(
          (one) => one.type === View && flat(one).borderRadius !== undefined,
        );
        expect(flat(circle).width as number).toBeLessThanOrEqual(Math.min(column, 40) + 0.01);
      }

      // The empty places at the ends of a month are as tall as the days beside them, or a week bends.
      expect(it.blanks().length).toBeGreaterThan(0);
      for (const blank of it.blanks()) expect(flat(blank).height, `×${scale} blank`).toBe(cells[0]);
      for (const n of [7, 28, 30]) {
        const most = it.figure(n).props.maxFontSizeMultiplier as number;
        // The type is never held below the system's own size, and never past what the person asked.
        expect(most).toBeGreaterThanOrEqual(1);
        const drawn = type.bodySm.fontSize * Math.min(scale, most);
        // Two figures, in the widest way a pair of them runs, stand inside the circle of the day with 4 to spare —
        // wherever the column is narrower than the circle, inside the column.
        expect(drawn * PAIR, `×${scale} day ${n}`).toBeLessThanOrEqual(
          Math.min(column, 40) - 4 + 0.01,
        );
        // Held back no further than the cell needs, give or take the part's margin for the widest of
        // its figures: the type the person asked for is theirs to keep.
        const fits = (Math.min(column, 40) - 4) / (type.bodySm.fontSize * PAIR);
        expect(most, `×${scale} day ${n}`).toBeGreaterThanOrEqual(Math.max(1, fits / 1.1));
        // And the cell is tall enough for the line it holds.
        expect(flat(it.days[n - 1]).height).toBeGreaterThanOrEqual(
          scale > 1 ? Math.ceil(type.bodySm.lineHeight * Math.min(scale, most)) : 40,
        );
      }
    }
  },
);

/** The week inside the calendar's card, which stands in the screen's 16 margins or a sheet's. */
const WEEKS = [
  [262, 'the zoomed iPhone SE'],
  [302, 'Android at 360'],
  [317, 'the iPhone SE'],
  [332, 'the iPhone 17e'],
  [382, 'the iPhone 17 Pro Max'],
] as const;

test('the weekday letters stay whole in their column in both languages, measured off the face they are drawn in', async () => {
  // TASK-404: the letters the phone draws are «MON»…«SUN» in English, 2.59 em where «ПН» is 1.59 —
  // a measure taken off «ПН» alone broke them into «MO / N» on the SE and the 17e from AX-XL up.
  const words = [...weekdayLetters('ru'), ...weekdayLetters('en')];
  expect(words).toEqual(expect.arrayContaining(['ПН', 'ВС', 'MON', 'WED', 'SUN']));
  const tracking = type.badge.letterSpacing / type.badge.fontSize;
  for (const [width, where] of WEEKS) {
    const column = width / 7;
    for (const scale of SCALES) {
      for (const language of ['ru', 'en']) {
        const it = await drawCalendar(width, scale, [], weekdayLetters(language));
        for (const letters of it.weekdays()) {
          const { fontFamily } = StyleSheet.flatten([type.badge, letters.props.style]);
          const face = ONEST(String(fontFamily).replace(/^Onest_/, ''));
          // The widest of both languages, with the badge's tracking after every letter.
          const widest = Math.max(
            ...words.map((word) => wordWidth(face, word, 1) + word.length * tracking),
          );
          const most = letters.props.maxFontSizeMultiplier as number;
          const at = `${where} ×${scale} ${language}`;
          expect(most, at).toBeGreaterThanOrEqual(1);
          expect(type.badge.fontSize * Math.min(scale, most) * widest, at).toBeLessThanOrEqual(
            column - 4 + 0.01,
          );
          // And held back no further than the widest of them needs.
          const fits = (column - 4) / (type.badge.fontSize * widest);
          expect(most, at).toBeGreaterThanOrEqual(Math.max(1, fits / 1.05));
        }
      }
    }
  }
});

test('before the week is measured nothing is held back, and at the system’s size the days are the layout’s 40', async () => {
  for (const scale of [1, 2]) {
    const it = await drawCalendar(0, scale);
    expect(it.figure(28).props.maxFontSizeMultiplier).toBeUndefined();
    expect(it.weekdays()[0].props.maxFontSizeMultiplier).toBeUndefined();
    // Unmeasured, the cell is as tall as the type it will hold, and no less than a finger.
    for (const day of it.days) expect(flat(day).height).toBe(scale > 1 ? 48 : 40);
  }
});

test('every day answers a press with its own date, at every type size and width, and no two share a cell', async () => {
  for (const [width, scale] of [
    [262, 3.571],
    [256, 2],
    [343, 1],
    [288, 1.15],
  ]) {
    const picked: Date[] = [];
    const it = await drawCalendar(width, scale, picked);
    expect(it.days).toHaveLength(30);
    await act(async () => {
      for (const day of it.days) day.props.onPress();
    });
    expect(picked.map((day) => day.getDate())).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    // A day is a seventh of the row and nothing more: no margin or overhang takes a press from a neighbour.
    for (const day of it.days) {
      const style = flat(day);
      expect(style.flex).toBe(1);
      expect(style.marginHorizontal ?? 0).toBe(0);
      expect(day.props.hitSlop).toBeUndefined();
    }
  }
});

const PRESETS = [
  { label: '0:30', value: 30 },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '3:00', value: 180 },
  { label: 'Всё', value: 550 },
];

async function drawSlider(row: number, fontScale: number, presets = PRESETS) {
  phone.fontScale = fontScale;
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <LengthSlider
          value={152}
          onChange={() => {}}
          min={10}
          max={550}
          valueLabel="2:32"
          minLabel="0:10"
          maxLabel="9:10 · всё, что есть"
          label="Длина"
          shorterLabel="Короче"
          longerLabel="Длиннее"
          presets={presets}
        />,
      ),
    );
  });
  const root = tree.root;
  const strip = root.find(
    (one) =>
      typeof one.props.onLayout === 'function' &&
      one.findAll((inner) => inner.props.accessibilityLabel === presets[0].label).length > 0,
  );
  if (row > 0)
    await act(async () =>
      strip.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: row, height: 32 } } }),
    );
  phone.fontScale = 1;
  const pill = (label: string) =>
    root.find((one) => one.type === Pressable && one.props.accessibilityLabel === label);
  return { root, pill, word: (label: string) => pill(label).findByType(Text) };
}

test.each([
  [256, 'the zoomed iPhone SE'],
  [311, 'an iPhone at 375'],
  [272, 'an iPhone at 320'],
])(
  'five ready lengths in a row %s wide (%s) keep their figures in their pills at every size, and grow the pill down',
  async (row) => {
    const semi = ONEST('600SemiBold');
    // Tabular: every figure as wide as the widest one is.
    const widest = [...'0123456789'].sort(
      (a, b) => wordWidth(semi, b, 1) - wordWidth(semi, a, 1),
    )[0];
    const em = Math.max(
      ...PRESETS.map((one) => wordWidth(semi, one.label.replace(/\d/g, widest), 13) / 13),
    );
    // The row is shared by however many there are — the slider offers fewer when there is less to
    // offer — with 6 between neighbours.
    for (const count of [3, 4, 5]) {
      const shown = PRESETS.slice(0, count);
      const inside = (row - 6 * (count - 1)) / count;
      for (const scale of SCALES) {
        const it = await drawSlider(row, scale, shown);
        for (const { label } of shown) {
          const most = it.word(label).props.maxFontSizeMultiplier as number;
          expect(most).toBeGreaterThanOrEqual(1);
          expect(13 * Math.min(scale, most) * em, `«${label}» ×${scale}`).toBeLessThanOrEqual(
            inside - 4 + 0.01,
          );
          expect(most, `«${label}» ×${scale} of ${count}`).toBeGreaterThanOrEqual(
            Math.max(1, (inside - 4) / (13 * em) / 1.1),
          );
          const tall = flat(it.pill(label)).height as number;
          if (scale <= 1) expect(tall).toBe(32);
          else expect(tall).toBeGreaterThanOrEqual(44);
          // Felt at 44 whatever it is drawn at, and not a point more where it is drawn 44 already.
          const { top, bottom } = it.pill(label).props.hitSlop;
          expect(top + tall + bottom).toBe(Math.max(44, tall));
        }
      }
    }
  },
);

test('the ready lengths hold nothing back until the row is measured, and share the row by how many there are', async () => {
  const unmeasured = await drawSlider(0, 2);
  expect(unmeasured.word('0:30').props.maxFontSizeMultiplier).toBeUndefined();
  // Three of them have more room each than five: the type may grow further.
  const three = await drawSlider(256, 2, PRESETS.slice(0, 3));
  const five = await drawSlider(256, 2);
  expect(three.word('0:30').props.maxFontSizeMultiplier).toBeGreaterThan(
    five.word('0:30').props.maxFontSizeMultiplier,
  );
});

/** The two ends under the line, and the row they stand in, as the slider draws them. */
async function drawEnds(min: string, max: string) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <LengthSlider
          value={150}
          onChange={() => {}}
          min={10}
          max={600}
          valueLabel="2:30"
          minLabel={min}
          maxLabel={max}
          label="Длина"
          shorterLabel="Короче"
          longerLabel="Длиннее"
        />,
      ),
    );
  });
  const words = (text: string) => (one: ReactTestInstance) =>
    one.type === Text && one.props.children === text;
  // The innermost view that holds both.
  const row = tree.root
    .findAll(
      (one) => one.type === View && [min, max].every((end) => one.findAll(words(end)).length),
    )
    .pop() as ReactTestInstance;
  const style = (one: ReactTestInstance) => StyleSheet.flatten(one.props.style) ?? {};
  return {
    row: flat(row),
    left: style(row.find(words(min))),
    right: style(row.find(words(max))),
  };
}

test('the two ends of the line keep apart and inside the card, the right one under the left once one line no longer holds both', async () => {
  // TASK-404: at ×2 «0:10» and «10:00 · everything there is» stood end to end — «0:1010:00 · …» on
  // the 17e, and past the card's edge on the SE: one row, `space-between`, neither a gap nor a wrap.
  // The words are measured off the face they are drawn in, figures tabular; the row's own style says
  // how the phone lays them out — flex wrap sends the right one to the next line when it and the gap
  // no longer fit after the left one.
  const medium = ONEST('500Medium');
  const figure = [...'0123456789'].sort(
    (a, b) => wordWidth(medium, b, 1) - wordWidth(medium, a, 1),
  )[0];
  const wide = (words: string, size: number) =>
    wordWidth(medium, words.replace(/\d/g, figure), size);
  // A phone's width less the build step's margins, the card's own and its hairline.
  const inside = (phone: number) => phone - 2 * space.s4 - 2 * space.s4 - 2;
  const scales = [...SCALES, ...Array.from({ length: 101 }, (_, i) => 1 + i / 100)];
  for (const language of ['ru', 'en'] as const) {
    const min = formatRuntime(10) ?? '';
    const max = strings[language].montage.lengthEnd(formatRuntime(600) ?? '');
    const { row, left, right } = await drawEnds(min, max);
    const gap = Number(row.columnGap ?? row.gap ?? 0);
    console.log(JSON.stringify({ row, left, right }));
    for (const phone of [320, 360, 375, 390, 440]) {
      const room = inside(phone);
      for (const scale of scales) {
        const size = type.metaSm.fontSize * Math.min(scale, TYPE_MOST);
        const [a, b] = [wide(min, size), wide(max, size)];
        const at = `${language} ${phone} ×${scale}`;
        const oneLine = a + gap + b <= room || row.flexWrap !== 'wrap';
        // At the system's own size and under it the two stand on one line, as the layout draws them.
        if (scale <= 1) expect(oneLine, at).toBe(true);
        if (oneLine) {
          // The left one at the start, the right one at the end, and air between them to read by.
          expect(left.marginLeft ?? 0, at).toBe(0);
          expect(right.marginLeft === 'auto' || row.justifyContent === 'space-between', at).toBe(
            true,
          );
          expect(room - a - b, at).toBeGreaterThanOrEqual(space.s2);
        } else {
          // The right one on a line of its own, still at the right end and inside the card.
          expect(right.marginLeft, at).toBe('auto');
          expect(a, at).toBeLessThanOrEqual(room);
          expect(
            Math.max(...max.split(' ').map((word) => wide(word, size))),
            at,
          ).toBeLessThanOrEqual(room);
        }
      }
    }
  }
});
