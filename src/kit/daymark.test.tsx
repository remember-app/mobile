import { beforeAll, expect, test } from 'vitest';

import { DateSpine, DayMark } from '@/kit/daymark';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.8 — the seam between two grids of frames, and the spine that says the same while scrolling. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the seam comes in three kinds and they are three', () => {
  allDifferent({
    day: <DayMark label="13 сентября, суббота" />,
    dayAndCount: <DayMark label="13 сентября, суббота" count="174 кадра" />,
    person: <DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" count="96" />,
    picking: <DayMark label="13 сентября" count="61" onPress={() => {}} pressLabel="Выбрать все" />,
    picked: (
      <DayMark label="13 сентября" count="61" picked onPress={() => {}} pressLabel="Снять выбор" />
    ),
    limited: <DayMark label="13 сентября" count="3 кадра" limited />,
  });
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
    story(<DayMark label="13 сентября" count="61" picked onPress={() => {}} pressLabel="Выбрать все 61" />),
  );
});

test('the organizer’s circle wears the spark collar in the seam, and nobody else’s does', () => {
  const organizer = story(<DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" organizer count="96" />);
  expect(organizer).toContain('rgba(228,255,79,1.00)');
  expect(story(<DayMark label="Аня" avatar="Аня" count="54" />)).not.toContain(
    'rgba(228,255,79,1.00)',
  );
});

test('a count about what the phone will not show is drawn back rather than forward', () => {
  // Under a partial grant the rest is not missing, it is unseen.
  allDifferent({
    whole: <DayMark label="13 сентября" count="61 кадр" />,
    limited: <DayMark label="13 сентября" count="3 кадра" limited />,
  });
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

test('a spine with no days in it is a bare line', () => {
  allDifferent({
    empty: <DateSpine marks={[]} />,
    oneDay: <DateSpine marks={[{ label: '13 сен', top: 100 }]} />,
  });
});
