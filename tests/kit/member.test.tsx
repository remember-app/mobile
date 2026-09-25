import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { BadgeContribution } from '@/kit/badge';
import { IconButton } from '@/kit/button';
import {
  Avatar,
  AvatarStack,
  FaceRow,
  FaceToggle,
  faceGap,
  initials,
  RowContact,
  RowMember,
  WatchingPill,
} from '@/kit/member';
import { allDifferent, story } from '@/kit/story';
import { setTheme, ThemePin } from '@/theme';

/**
 * Spec 7.5 — people: the circle, the face that is a switch in the filter, the row inside a memory,
 * the row in the address book.
 */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

test('two letters stand for a name, and one where there is only one word', () => {
  expect(initials('Марк Ковалёв')).toBe('МК');
  expect(initials('Лиза')).toBe('ЛИ');
  expect(initials('  аня   петрова ')).toBe('АП');
  expect(initials('')).toBe('');
});

test('the circle is drawn at every size the layout uses', () => {
  allDifferent(
    Object.fromEntries(
      [26, 32, 34, 36, 42, 64].map((size) => [
        String(size),
        <Avatar name="Марк Ковалёв" size={size} />,
      ]),
    ),
  );
  expect(story(<Avatar name="Марк Ковалёв" size={42} />)).toContain('width:42px');
});

test('a removed contact’s circle is still a circle on the screen’s ink', () => {
  // The layout draws it #1B1B24 — a step above the `ink` of the list it stands in. Drawn in `ink`
  // itself the circle vanishes and two faint letters float where a person was.
  const gone = story(<Avatar name="Марк Ковалёв" gone />);
  expect(gone).toContain('background-color:rgba(22,22,31,1.00)');
  expect(gone).not.toContain('background-color:rgba(11,11,18,1.00)');
});

test('the five kinds of circle are five kinds', () => {
  allDifferent({
    plain: <Avatar name="Марк Ковалёв" />,
    ringed: <Avatar name="Марк Ковалёв" ring />,
    gone: <Avatar name="Марк Ковалёв" gone />,
    stacked: <Avatar name="Марк Ковалёв" stacked={{ letters: 11, covered: 14 }} />,
    photo: <Avatar name="Марк Ковалёв" uri="https://bucket.example/m.jpg" />,
  });
  // The collar is `spark`, and it lies outside the circle: the one place a person is marked by
  // colour.
  expect(story(<Avatar name="Марк Ковалёв" ring />)).toContain('0 0 0 1.5px #E4FF4F');
  // A photograph takes the circle whole, and the initials stay the spare.
  expect(story(<Avatar name="Марк Ковалёв" uri="https://bucket.example/m.jpg" />)).not.toContain(
    'МК',
  );
});

test('a face takes its colour from the name, and the same name is the same colour', () => {
  // Spec 2 — the palette of faces: dealt out per person, carrying no meaning at all. What it must
  // do is hold still, or one person is two people between two screens.
  const anya = story(<Avatar name="Аня Петрова" />);
  expect(anya).toBe(story(<Avatar name="Аня Петрова" />));
  expect(anya).not.toBe(story(<Avatar name="Марк Ковалёв" />));
  // One of the six and nothing else.
  expect(anya).toMatch(/rgba\((91,75,138|47,94,99|122,75,58|62,90,46|90,62,94|58,74,110),1\.00\)/);
});

test('every size the layout draws a circle at is its own size, letters and all', () => {
  allDifferent(
    Object.fromEntries(
      [16, 24, 30, 32, 34, 36, 38, 42, 64].map((size) => [
        String(size),
        <Avatar name="Марк Ковалёв" size={size} />,
      ]),
    ),
  );
  // 16 in a day gap carries 6px of letters; 42 in a contact row carries 14.
  expect(story(<Avatar name="Марк Ковалёв" size={16} />)).toContain('font-size:6px');
  expect(story(<Avatar name="Марк Ковалёв" size={42} />)).toContain('font-size:14px');
});

test('the account’s own circle sets its letters like a name, at the size a confirmation does not', () => {
  // Spec 8, `Account`: 64 with the initials in Unbounded 600 19 — the same 64 on a confirmation
  // sheet carries Onest at 18.
  allDifferent({
    confirmation: <Avatar name="Марк Ковалёв" size={64} />,
    account: <Avatar name="Марк Ковалёв" size={64} display />,
  });
  expect(story(<Avatar name="Марк Ковалёв" size={64} display />)).toContain('font-size:19px');
  expect(story(<Avatar name="Марк Ковалёв" size={64} />)).toContain('font-size:18px');
});

test('a stack overlaps by what its circles can spare, and stops at four', () => {
  const stack = story(<AvatarStack names={['Аня', 'Марк', 'Лиза']} on="#16161F" />);
  expect(stack).toContain('АН');
  expect(stack).toContain('МА');
  expect(stack).toContain('ЛИ');
  // Spec 7.5: −12 at 36, −7 at 24 — the smaller the circle, the less of it there is to give away.
  // 36 is the stack's own size: the «Контакты» card is where it stands.
  expect(stack).toContain('margin-left:-12px');
  expect(stack).toContain('width:36px');
  expect(story(<AvatarStack names={['Аня', 'Марк']} size={24} on="#16161F" />)).toContain(
    'margin-left:-7px',
  );
  // Four faces are four faces; past that the fourth circle becomes the count of everyone left.
  expect(story(<AvatarStack names={['Аня', 'Марк', 'Лиза', 'Ира']} on="#16161F" />)).toContain(
    'ИР',
  );
  const many = story(<AvatarStack names={['Аня', 'Марк', 'Лиза', 'Ира', 'Пётр']} on="#16161F" />);
  expect(many).toContain('+2');
  expect(many).not.toContain('ИР');
});

/** A number off a written style, `undefined` where the style does not carry it. */
const px = (style: string, property: string) => {
  const found = new RegExp(`(?:^|;)${property}:(-?[\\d.]+)px`).exec(style);
  return found ? Number(found[1]) : undefined;
};

/**
 * A drawn stack read back circle by circle, as the numbers that decide whether its initials show
 * whole: how far the circle is covered by the next one — the overlap plus that one's collar where it
 * stands outside the circle (a box-shadow; a border lies inside and hides nothing) — so what is left
 * showing, and where the letters stand in it, at what size and weight.
 */
function stackOf(markup: string) {
  const circles = [
    ...markup.matchAll(/<div[^>]*style="([^"]*)"><div dir="auto"[^>]*style="([^"]*)">([^<]*)</g),
  ].map(([, circle, letters, text]) => ({
    text,
    width: px(circle, 'width') ?? 0,
    tuck: -(px(circle, 'margin-left') ?? 0),
    halo: Number(/box-shadow:0 0 0 ([\d.]+)px/.exec(circle)?.[1] ?? 0),
    letters,
  }));
  return circles.map(({ text, width, tuck, letters }, at) => {
    const next = circles[at + 1];
    const covered = next ? next.tuck + next.halo : 0;
    return {
      text,
      // What the circle adds to the stack's width.
      across: width - tuck,
      visible: width - covered,
      // The letters' box grows on the right by its padding, so the glyphs stand at the middle of
      // what is left of the circle — this far left of the circle's own middle.
      shift: (px(letters, 'padding-right') ?? 0) / 2,
      size: px(letters, 'font-size'),
      bold: letters.includes('font-family:Onest_700Bold'),
    };
  });
}

test('the initials of a stack show whole: 11 / 700 at 36, centred in the 22 the next circle leaves', () => {
  // Spec 7.5, detail 32 (10.10): the next circle and its 2 collar hide the right 14 of 36, and
  // letters centred in the whole circle lost 5.4 px of «МК». The overlap and the width stay.
  const drawn = stackOf(
    story(
      <AvatarStack
        names={['Марк Ковалёв', 'Аня Петрова', 'Вера Горина', 'Жанна Щукина']}
        on="#16161F"
      />,
    ),
  );
  expect(drawn.map((one) => one.text)).toEqual(['МК', 'АП', 'ВГ', 'ЖЩ']);
  for (const circle of drawn.slice(0, -1)) {
    expect(circle).toMatchObject({ visible: 22, shift: 7, size: 11, bold: true });
    // Centred in what shows: as much room on either side of the letters' middle.
    expect(18 - circle.shift).toBe(circle.visible / 2);
  }
  // The last one has nothing over it and keeps the middle.
  expect(drawn.at(-1)).toMatchObject({ visible: 36, shift: 0, size: 11, bold: true });
  // Four circles of 36 overlapping by 12: 108 across, as before.
  expect(drawn.reduce((sum, one) => sum + one.across, 0)).toBe(108);
  // A «+N» in the fourth place is the last circle: centred, and the third face gives way to it.
  const many = stackOf(
    story(<AvatarStack names={['Аня', 'Марк', 'Лиза', 'Ира', 'Пётр']} on="#16161F" />),
  );
  expect(many.map((one) => one.text)).toEqual(['АН', 'МА', 'ЛИ', '+2']);
  expect(many[2]).toMatchObject({ visible: 22, shift: 7 });
  expect(many[3]).toMatchObject({ visible: 36, shift: 0, size: 11, bold: true });
});

test('the same rule at 24: 8 / 700, centred in the 17 the next circle leaves', () => {
  // The collar at 24 is a 1.5 hairline inside the circle, so only the overlap of 7 is hidden.
  const drawn = stackOf(
    story(<AvatarStack names={['Лиза Морозова', 'Марк Ковалёв', 'Аня Петрова']} size={24} />),
  );
  expect(drawn.map((one) => one.text)).toEqual(['ЛМ', 'МК', 'АП']);
  for (const circle of drawn.slice(0, -1)) {
    expect(circle).toMatchObject({ visible: 17, shift: 3.5, size: 8, bold: true });
    expect(12 - circle.shift).toBe(circle.visible / 2);
  }
  expect(drawn.at(-1)).toMatchObject({ visible: 24, shift: 0, size: 8, bold: true });
});

test('the watching pill says how many are watching, in one sentence and not four', () => {
  const markup = story(
    <WatchingPill names={['Лиза Морозова', 'Марк Ковалёв']} count={3} label="Смотрят сейчас: 3" />,
  );
  expect(markup).toContain('aria-label="Смотрят сейчас: 3"');
  expect(markup).toContain('>3<');
  // The faces are the stack at 24, overlapping by 7 and cut apart by a hairline in the colour under
  // them — the stack's own rule for the initials, not a copy of it.
  expect(markup).toContain('margin-left:-7px');
  expect(stackOf(markup)).toMatchObject([
    { text: 'ЛМ', visible: 17, shift: 3.5, size: 8, bold: true },
    { text: 'МК', visible: 24, shift: 0, size: 8, bold: true },
  ]);
});

test('a member row carries the name, what they brought under it, and one mark at its edge', () => {
  const row = story(
    <RowMember
      name="Аня Петрова"
      meta="54 кадра"
      status={<BadgeContribution state="done" label="Всё загрузил" />}
      ring
    />,
  );
  expect(row).toContain('Аня Петрова');
  expect(row).toContain('54 кадра');
  expect(row).toContain('aria-label="Всё загрузил"');
  // Spec 7.5 — the organizer is told by the collar on their circle and never by a second word:
  // «Организатор» beside a name that already wears the ring is the same thing said twice.
  expect(row).toContain('0 0 0 1.5px #E4FF4F');
  expect(row).not.toContain('ОРГАНИЗАТОР');
});

test('the mark at the row’s edge is one thing, and which one is the screen’s to say', () => {
  // Spec 10.8.4 — while the roster is being edited the contribution circle gives way to the cross;
  // they never queue up, because two marks in a 56 row is a row nobody can scan.
  allDifferent({
    brought: (
      <RowMember
        name="Аня Петрова"
        meta="54 кадра"
        status={<BadgeContribution state="done" label="Всё загрузил" />}
      />
    ),
    coming: (
      <RowMember
        name="Аня Петрова"
        meta="54 кадра"
        status={<BadgeContribution state="planned" label="Ещё будет" />}
      />
    ),
    editing: (
      <RowMember
        name="Аня Петрова"
        meta="54 кадра"
        status={<IconButton size={36} icon={X} tone="danger" label="Убрать Аню Петрову" />}
      />
    ),
    viewer: <RowMember name="Аня Петрова" />,
  });
});

test('the hairline belongs to the list, not to the row — React Native has no sibling selector', () => {
  allDifferent({
    first: <RowMember name="Аня Петрова" meta="@anya.p" />,
    rest: <RowMember name="Аня Петрова" meta="@anya.p" divider />,
  });
});

test('the three states of a contact row are three rows', () => {
  allDifferent({
    saved: <RowContact name="Марина Ким" handle="@marina.k" />,
    found: <RowContact name="Марина Ким" handle="@marina.k" variant="found" />,
    gone: <RowContact name="Марина Ким" handle="Убрали из контактов" variant="gone" />,
  });
  // A removed row says where the username was, rather than leaving the line empty.
  expect(
    story(<RowContact name="Марина Ким" handle="Убрали из контактов" variant="gone" />),
  ).toContain('Убрали из контактов');
});

const face = (selected: boolean, excluded = false) => (
  <FaceToggle name="Лиза Морозова" selected={selected} excluded={excluded} onPress={() => {}} />
);

test('a face in the filter is the circle alone, read out by the whole name', () => {
  const drawn = story(face(false));
  // Initials in the circle and no name beside it (spec 7.5): the name is what it is called out as.
  expect(drawn).toContain('>ЛМ<');
  expect(drawn).not.toContain('>Лиза Морозова<');
  expect(drawn).not.toContain('>Лиза<');
  expect(drawn).toContain('aria-label="Лиза Морозова"');
  // A switch that stays in (spec 7.5, `aria-pressed`), drawn at 48.
  expect(drawn).toContain('role="togglebutton"');
  expect(drawn).toContain('width:48px');
});

test('chosen is the double ring and the tick; left out is the whole face at half', () => {
  allDifferent({ off: face(false), on: face(true), left: face(false, true) });
  const on = story(face(true));
  // 2 of the sheet's `surface` (#16161F), then 2 of `paper` (#F5F3EE), and the tick in `paper`.
  expect(on).toContain('0 0 0 2px #16161F, 0 0 0 4px #F5F3EE');
  expect(on).toContain('data-glyph="Check"');
  for (const off of [story(face(false)), story(face(false, true))]) {
    expect(off).not.toContain('4px #F5F3EE');
    expect(off).not.toContain('data-glyph="Check"');
  }
  // Both swap with the theme: the rings are cut in the sheet's own colours.
  expect(story(<ThemePin value="light">{face(true)}</ThemePin>)).not.toContain('#16161F');
});

test('with nobody chosen every face is at full strength; once one is, the rest go down to half', async () => {
  // Spec 7.5, detail 31 (chief, 25 September): half means «left out», and with no filter by people
  // nobody is left out — so the rule is the row's, and it comes back whole when the choice is emptied.
  const people = ['Лиза Морозова', 'Марк Ковалёв', 'Аня Петрова'];
  const pressed: string[] = [];
  const row = (chosen: string[]) => (
    <FaceRow
      faces={people.map((name) => ({ id: name, name, selected: chosen.includes(name) }))}
      onToggle={(id) => pressed.push(id)}
    />
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(row([])));
  });
  const faces = () => tree.root.findAllByType(FaceToggle);
  // The opacity the face's own press surface is drawn at — 1 where nothing sets one.
  const strength = () =>
    faces().map((one) => StyleSheet.flatten(one.findAllByType(View)[0].props.style).opacity ?? 1);

  expect(strength()).toEqual([1, 1, 1]);
  expect(faces().map((one) => one.props.excluded)).toEqual([false, false, false]);
  await act(async () => tree.update(row(['Марк Ковалёв'])));
  expect(strength()).toEqual([0.5, 1, 0.5]);
  await act(async () => tree.update(row(['Марк Ковалёв', 'Аня Петрова'])));
  expect(strength()).toEqual([0.5, 1, 1]);
  // «Сбросить»: nobody chosen again, and everybody back at full strength.
  await act(async () => tree.update(row([])));
  expect(strength()).toEqual([1, 1, 1]);
  // A press hands the row's owner the id of the face pressed, and nothing else.
  await act(async () => faces()[2].props.onPress());
  expect(pressed).toEqual(['Аня Петрова']);
});

test('one row of faces is spread edge to edge; past a row they wrap and keep the first row’s columns', () => {
  // 390 wide less the sheet's 16 a side and the row's own 2: 354. Six faces are one row, spread by
  // `space-between` and needing no number (spec 8).
  expect(faceGap(354, 1)).toBeUndefined();
  expect(faceGap(354, 6)).toBeUndefined();
  // The seventh does not fit: it goes to a second row (TASK-294), and every row keeps six columns —
  // 13 apart, whole pixels, so the last face of a row is never rounded onto the next one.
  expect(faceGap(354, 7)).toBe(13);
  expect(faceGap(354, 13)).toBe(13);
  expect(6 * 48 + 5 * faceGap(354, 7)!).toBeLessThanOrEqual(354);
  // A narrower phone fits fewer, because faces never stand closer than 8 — a chosen face's ring
  // reaches 4 out. On 320 six do not fit: five to a row, 20 apart, and the sixth goes under the first.
  expect(faceGap(320, 5)).toBeUndefined();
  expect(faceGap(320, 6)).toBe(20);
  expect(faceGap(0, 7)).toBeUndefined();
});

test('the row wraps rather than scrolls, and hides nobody behind a «+N»', async () => {
  const names = Array.from({ length: 9 }, (_, at) => `Гость ${at + 1}`);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FaceRow
          faces={names.map((name) => ({ id: name, name, selected: false }))}
          onToggle={() => {}}
        />,
      ),
    );
  });
  const row = () => tree.root.findAllByType(View)[0];
  const style = () => Object.assign({}, ...[row().props.style].flat(2).filter(Boolean));
  expect(tree.root.findAllByType(FaceToggle)).toHaveLength(9);
  expect(style().flexWrap).toBe('wrap');
  // Unmeasured, the one row the layout draws; measured, the columns of the first row.
  expect(style().justifyContent).toBe('space-between');
  await act(async () => row().props.onLayout({ nativeEvent: { layout: { width: 358 } } }));
  expect(style().columnGap).toBe(13);
  expect(style().justifyContent).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).not.toMatch(/\+\d/);
});
