import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { Divider } from '@/kit/bits';
import { Button } from '@/kit/button';
import { DateSpine, DayHead, DayMark } from '@/kit/daymark';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { themes } from '@/theme';

/** Spec 7.8 — the seam between two grids of frames, and the spine that says the same while scrolling. */

// The dark theme, and the one tree below mounted under `act` and taken down after its test.
mountsTrees();

test('the seam comes in three kinds and they are three', () => {
  allDifferent({
    day: <DayMark label="13 сентября, суббота" />,
    dayAndCount: <DayMark label="13 сентября, суббота" count="174 кадра" />,
    person: <DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" count="96" />,
    picking: <DayMark label="13 сентября" count="61" onPress={() => {}} pressLabel="Выбрать все" />,
    picked: (
      <DayMark label="13 сентября" count="61" picked onPress={() => {}} pressLabel="Снять выбор" />
    ),
  });
});

test('a date on its own is quiet, and a label that leads a count, a face or a switch is paper', () => {
  // Spec 7.8, detail 65 and `MemoryDated`: «13 сентября, суббота» alone in the seam is 10/12/600
  // `muted`; the person of `FramesByPeople` and the date-button of `Upload` stand in `paper`.
  const tone = (mark: ReactElement) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = mounted(TestRenderer.create(mark));
    });
    return tree.root.findAllByType(Text)[0].props.tone as string;
  };
  expect(tone(<DayMark label="13 сентября, суббота" />)).toBe('muted');
  expect(tone(<DayMark label="Лиза Морозова" avatar="Лиза Морозова" count="128" />)).toBe('paper');
  expect(tone(<DayMark label="13 сентября" count="61" onPress={() => {}} />)).toBe('paper');
  expect(tone(<DayMark label="Фото" count="4" />)).toBe('paper');
});

test('the words of a seam are 10 / 12 / 600 with 0.3 of tracking, not a badge’s bold caps', () => {
  // `MemoryDated` and `FramesByPeople` (MemoryDated.json, FramesByPeople.json): «13 сентября,
  // суббота» and «Лиза Морозова» are Onest 600 10/12 with `letter-spacing: 0.03em` — the app wrote
  // them in `badgeSm`, 700 and 0.5, and the words came out 4–5 % wider.
  for (const label of ['13 сентября, суббота', 'Лиза Морозова']) {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = mounted(TestRenderer.create(<DayMark label={label} avatar={label} count="128" />));
    });
    const words = tree.root.findAllByType(Text).find((one) => one.props.children === label)!;
    // Spec 3 names the role: `day`.
    expect(words.props.role).toBe('day');
    expect(StyleSheet.flatten(words.findByType(RNText).props.style)).toMatchObject({
      fontFamily: 'Onest_600SemiBold',
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 0.3,
    });
  }
});

test('the count in a seam is 10 / 12 / 500 `muted` and untracked, beside every kind of seam', () => {
  // `Upload.json` e5 «61», `FramesByPeople.json` e4 «128»: Onest 500 10 / 12 with no tracking; spec
  // detail 65 reads it in `muted` #A4A1B2 in all three (the layout's `faint` in `Upload` is under the
  // floor, 10.1). The app wrote it in `badgeSm` — 700 with 0.5 of tracking — and in `faint` on a day
  // that picks.
  for (const seam of [
    <DayMark key="day" label="13 сентября, суббота" count="61" onPress={() => {}} />,
    <DayMark key="picked" label="12 сентября" count="24" picked onPress={() => {}} />,
    <DayMark key="person" label="Лиза Морозова" avatar="Лиза Морозова" count="128" />,
  ]) {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = mounted(TestRenderer.create(seam));
    });
    const said = seam.props.count as string;
    const count = tree.root.findAllByType(RNText).find((one) => one.props.children === said)!;
    const style = StyleSheet.flatten(count.props.style);
    expect(style).toMatchObject({
      fontFamily: 'Onest_500Medium',
      fontSize: 10,
      lineHeight: 12,
      color: themes.dark.color.muted,
    });
    expect(style.letterSpacing).toBeUndefined();
  }
});

test('a seam that picks is a checkbox over the whole band, and one that does not is a heading', () => {
  const plain = story(<DayMark label="13 сентября" count="174 кадра" />);
  expect(plain).toContain('role="heading"');
  expect(plain).not.toContain('role="checkbox"');

  const picking = story(
    <DayMark label="13 сентября" count="61" onPress={() => {}} pressLabel="Выбрать все 61" />,
  );
  expect(picking).toContain('role="checkbox"');
  // The date and the count are a date and a count; what the press does is said out loud instead.
  expect(picking).toContain('aria-label="Выбрать все 61"');
  // Taken or not is a checkbox's own state, and it shows: whether it is spoken is the platform's
  // business — `react-native-web`'s static render drops `accessibilityState` — but the two must at
  // least be different things to look at, or the band says nothing about the day it stands over.
  expect(picking).not.toBe(
    story(
      <DayMark
        label="13 сентября"
        count="61"
        picked
        onPress={() => {}}
        pressLabel="Выбрать все 61"
      />,
    ),
  );
});

test('the organizer’s circle wears the spark collar in the seam, and nobody else’s does', () => {
  // Spec 7.5: the collar is a shadow outside the circle rather than a border in it, so a circle
  // inside a stack can wear both it and the hairline that cuts it from its neighbour.
  const organizer = story(
    <DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" organizer count="96" />,
  );
  expect(organizer).toContain('0 0 0 1.5px #E4FF4F');
  expect(story(<DayMark label="Аня" avatar="Аня" count="54" />)).not.toContain('#E4FF4F');
});

test('the band that takes a day runs the width of the screen, not of its words', () => {
  // `Upload.json`: «Выбрать все кадры за 13 сентября, суббота» is a 390 × 44 button at 0, 96 — the
  // app's was as wide as its circle, date and count (190 of 390) and a tap beside them missed.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(<DayMark label="13 сентября, суббота" count="61" onPress={() => {}} />),
    );
  });
  const band = tree.root.findByType(Pressable);
  expect(StyleSheet.flatten(band.props.style)).toMatchObject({
    flexGrow: 1,
    height: 44,
    marginVertical: -12,
  });
});

/** The styles a heading of the queue's grid is drawn with, and the words in it by role. */
function dayHead(tree: ReactElement) {
  let drawn!: TestRenderer.ReactTestRenderer;
  act(() => {
    drawn = mounted(TestRenderer.create(tree));
  });
  const row = drawn.root
    .findAllByType(View)
    .find((one) => StyleSheet.flatten(one.props.style)?.minHeight !== undefined)!;
  const words = drawn.root.findAllByType(Text).map((one) => [one.props.role, one.props.tone]);
  return { row: StyleSheet.flatten(row.props.style), words, root: drawn.root };
}

test('a day over the queue’s grid is a heading with a line, 17 clear of what it holds and never under 56', () => {
  // `UploadLimited.json`: the hint ends at 282, «Снято 13 сентября» (13 / 600, e9) is centred on 310
  // and the grid starts at 338 — 56 between them. `UploadQueue.json`: «НЕ УШЛИ» ends at 417, the 44
  // «Выбрать все 61» (e28) stands at 434 and the grid at 495 — 17 clear of it both ways. The line
  // (e10, e27) starts 12 after the words: 16 + 117.28 + 12 = 145.28.
  const bare = dayHead(<DayHead label="Снято 13 сентября" count="3 кадра" />);
  expect(bare.row).toMatchObject({
    minHeight: 338 - 282,
    paddingVertical: 434 - 417,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Math.round(145.28 - 16 - 117.28),
  });
  expect(495 - 434 - 44).toBe(434 - 417);
  // «3 из 61» (e11) is 12 / 500 — `faint` in the layout, `muted` in the spec (detail 65, 10.1): the
  // meta's own tone, nothing asked; the day is the paper `label`.
  expect(bare.words).toEqual([
    ['label', undefined],
    ['meta', undefined],
  ]);
  const count = bare.root.findAllByType(RNText).find((one) => one.props.children === '3 кадра')!;
  expect(StyleSheet.flatten(count.props.style).color).toBe(themes.dark.color.muted);
  expect(bare.root.findAllByType(Divider)).toHaveLength(1);
});

test('the button at the end of a day’s heading goes under it on large type rather than off the edge', () => {
  const { row, root } = dayHead(
    <DayHead label="Снято 13 сентября">
      <Button variant="small" label="Выбрать все 61" />
    </DayHead>,
  );
  expect(row.flexWrap).toBe('wrap');
  expect(root.findAllByType(Button)).toHaveLength(1);
  // A heading, read out as one — the day is what the grid under it is about.
  expect(story(<DayHead label="Снято 13 сентября" count="3 кадра" />)).toContain('role="heading"');
});

test('the spine stands where the screen puts each mark, and says nothing out loud', () => {
  const spine = story(
    <DateSpine
      marks={[
        { label: '13 сен', top: 195 },
        { label: '12 сен', top: 588 },
      ]}
    />,
  );
  expect(spine).toContain('13 сен');
  expect(spine).toContain('12 сен');
  expect(spine).toContain('top:195px');
  expect(spine).toContain('top:588px');
  // A way of moving and not a thing to be pressed: nothing on it is a button.
  expect(spine).not.toContain('role="button"');
});

test('on the spine the line is the quietest thing and each mark on it louder than the last', () => {
  // Spec 7.8, detail 66 and 10.10: the line .22 and nothing else at it, the pill on the quieter
  // plate .55, the tick .35, the dot .6 — and the date read in the pill at .72.
  const spine = story(<DateSpine marks={[{ label: '13 сен', top: 195 }]} />);
  const fills = [...spine.matchAll(/r-backgroundColor-[a-z0-9]+/g)].map(([name]) => name);
  expect(fills).toEqual(
    [
      'background-color:rgba(245,243,238,0.22)',
      'background-color:rgba(11,11,18,0.55)',
      'background-color:rgba(245,243,238,0.35)',
      'background-color:rgba(245,243,238,0.60)',
    ].map(rule),
  );
  expect(spine).toContain(rule('color:rgba(245,243,238,0.72)'));
});

test('a spine with no days in it is a bare line', () => {
  allDifferent({
    empty: <DateSpine marks={[]} />,
    oneDay: <DateSpine marks={[{ label: '13 сен', top: 100 }]} />,
  });
});
