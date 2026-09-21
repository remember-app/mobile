import { beforeAll, expect, test } from 'vitest';

import { Button } from '@/kit/button';
import { DayMark } from '@/kit/daymark';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.7 — the heading over a group of frames, in its four kinds. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the four headings are four headings', () => {
  allDifferent({
    dayAndCount: <DayMark label="14 сентября" count="174 кадра" />,
    dayAndButton: (
      <DayMark label="14 сентября">
        <Button variant="quiet" size="xs" label="Выбрать все 174" />
      </DayMark>
    ),
    person: <DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" count="112 фото" />,
    limited: <DayMark label="13 сентября" count="3 из 61" limited />,
  });
});

test('the right edge is one slot: a count or a button, never both at once', () => {
  const counted = story(<DayMark label="14 сентября" count="174 кадра" />);
  expect(counted).toContain('174 кадра');
  const picking = story(
    <DayMark label="14 сентября">
      <Button variant="quiet" size="xs" label="Выбрать все 174" />
    </DayMark>,
  );
  expect(picking).toContain('Выбрать все 174');
  expect(picking).not.toContain('174 кадра');
});

test('a heading is a heading to a screen reader, whatever stands at its ends', () => {
  expect(story(<DayMark label="14 сентября" count="174 кадра" />)).toContain('role="heading"');
});

test('the organizer’s circle wears the spark collar, and nobody else’s does', () => {
  // Spec 7.5: the collar is a shadow outside the circle rather than a border in it, so a circle
  // inside a stack can wear both it and the hairline that cuts it from its neighbour.
  const organizer = story(<DayMark label="Марк Ковалёв" avatar="Марк Ковалёв" organizer count="112 фото" />);
  expect(organizer).toContain('0 0 0 1.5px #E4FF4F');
  expect(story(<DayMark label="Аня" avatar="Аня" count="54 фото" />)).not.toContain('#E4FF4F');
});

test('a count about what the phone will not show is drawn back rather than forward', () => {
  // «3 из 61» under limited access: the rest is not missing, it is unseen.
  allDifferent({
    whole: <DayMark label="13 сентября" count="61 кадр" />,
    limited: <DayMark label="13 сентября" count="3 из 61" limited />,
  });
});
