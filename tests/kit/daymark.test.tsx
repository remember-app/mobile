import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import type { ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { DateSpine, DayMark } from '@/kit/daymark';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';

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
    limited: <DayMark label="13 сентября" count="3 кадра" limited />,
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
