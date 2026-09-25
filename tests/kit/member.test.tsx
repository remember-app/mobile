import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { X } from 'lucide-react-native';
import { View } from 'react-native';
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
      [26, 32, 34, 42, 64, 68].map((size) => [
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
    separated: <Avatar name="Марк Ковалёв" ringColor="#16161F" />,
    photo: <Avatar name="Марк Ковалёв" uri="https://bucket.example/m.jpg" />,
  });
  // The collar is `spark`, and it lies outside the circle: the one place a person is marked by
  // colour, and the one ring that has to coexist with the hairline of a stack.
  expect(story(<Avatar name="Марк Ковалёв" ring />)).toContain('0 0 0 1.5px #E4FF4F');
  expect(story(<Avatar name="Марк Ковалёв" ring ringColor="#16161F" />)).toContain('1.5px');
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
      [16, 24, 30, 32, 34, 38, 42, 64, 68].map((size) => [
        String(size),
        <Avatar name="Марк Ковалёв" size={size} />,
      ]),
    ),
  );
  // 16 in a day gap carries 6px of letters; 68 on the account carries 20.
  expect(story(<Avatar name="Марк Ковалёв" size={16} />)).toContain('font-size:6px');
  expect(story(<Avatar name="Марк Ковалёв" size={68} />)).toContain('font-size:20px');
});

test('a stack overlaps by what its circles can spare, and stops at four', () => {
  const stack = story(<AvatarStack names={['Аня', 'Марк', 'Лиза']} on="#16161F" />);
  expect(stack).toContain('АН');
  expect(stack).toContain('МА');
  expect(stack).toContain('ЛИ');
  // Spec 7.5: −12 at 34, −7 at 24 — the smaller the circle, the less of it there is to give away.
  expect(stack).toContain('margin-left:-12px');
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

test('the watching pill says how many are watching, in one sentence and not four', () => {
  const pill = story(
    <WatchingPill names={['Аня', 'Марк', 'Лиза']} count={3} label="Смотрят сейчас: 3" />,
  );
  expect(pill).toContain('aria-label="Смотрят сейчас: 3"');
  expect(pill).toContain('>3<');
  // Three faces at 24, overlapping by 7 and cut apart by a hairline in the colour under them.
  expect(pill).toContain('margin-left:-7px');
  expect(pill).toContain('font-size:9px');
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

const face = (selected: boolean, name = 'Лиза Морозова') => (
  <FaceToggle name={name} selected={selected} onPress={() => {}} />
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

test('chosen is the double ring and the tick; not chosen is the whole face at half', () => {
  allDifferent({ off: face(false), on: face(true) });
  const on = story(face(true));
  // 2 of the sheet's `surface` (#16161F), then 2 of `paper` (#F5F3EE), and the tick in `paper`.
  expect(on).toContain('0 0 0 2px #16161F, 0 0 0 4px #F5F3EE');
  expect(on).toContain('data-glyph="Check"');
  const off = story(face(false));
  expect(off).not.toContain('4px #F5F3EE');
  expect(off).not.toContain('data-glyph="Check"');
  // Both swap with the theme: the rings are cut in the sheet's own colours.
  expect(story(<ThemePin value="light">{face(true)}</ThemePin>)).not.toContain('#16161F');
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
        <FaceRow>
          {names.map((name) => (
            <FaceToggle key={name} name={name} selected={false} onPress={() => {}} />
          ))}
        </FaceRow>,
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
