import { beforeAll, expect, test } from 'vitest';

import { BadgeContribution, BadgeOrganizer } from '@/kit/badge';
import { Avatar, AvatarStack, RowContact, RowMember, initials } from '@/kit/member';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.5 — people: the circle, the row inside a memory, the row in the address book. */

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

test('the five kinds of circle are five kinds', () => {
  allDifferent({
    plain: <Avatar name="Марк Ковалёв" />,
    ringed: <Avatar name="Марк Ковалёв" ring />,
    gone: <Avatar name="Марк Ковалёв" gone />,
    separated: <Avatar name="Марк Ковалёв" ringColor="#16161F" />,
    photo: <Avatar name="Марк Ковалёв" uri="https://bucket.example/m.jpg" />,
  });
  // The collar is `spark` — the one place a person is marked by colour.
  expect(story(<Avatar name="Марк Ковалёв" ring />)).toContain('rgba(228,255,79,1.00)');
  // A photograph takes the circle whole, and the initials stay the spare.
  expect(story(<Avatar name="Марк Ковалёв" uri="https://bucket.example/m.jpg" />)).not.toContain(
    'МК',
  );
});

test('a stack of three overlaps and each circle is ringed in what it lies on', () => {
  const stack = story(<AvatarStack names={['Аня', 'Марк', 'Лиза']} on="#16161F" />);
  expect(stack).toContain('АН');
  expect(stack).toContain('МА');
  expect(stack).toContain('ЛИ');
  // Only three, however many were handed over — the sign is a sign, not a list.
  const many = story(<AvatarStack names={['Аня', 'Марк', 'Лиза', 'Ира']} on="#16161F" />);
  expect(many.match(/data-glyph/g)).toBeNull();
  expect(many).not.toContain('ИР');
});

test('a member row carries the name, a whole phrase under it, and the mark of what they brought', () => {
  const row = story(
    <RowMember
      name="Аня Петрова"
      meta="@anya.p · Добавление · 54 кадра"
      badge={<BadgeOrganizer label="Организатор" sm />}
      status={<BadgeContribution state="done" label="Всё загрузил" />}
      ring
    />,
  );
  expect(row).toContain('Аня Петрова');
  expect(row).toContain('@anya.p · Добавление · 54 кадра');
  expect(row).toContain('ОРГАНИЗАТОР');
  expect(row).toContain('aria-label="Всё загрузил"');
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
  expect(story(<RowContact name="Марина Ким" handle="Убрали из контактов" variant="gone" />)).toContain(
    'Убрали из контактов',
  );
});
