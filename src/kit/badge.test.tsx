import { beforeAll, expect, test } from 'vitest';

import {
  BadgeContribution,
  BadgeDecision,
  BadgeFilms,
  BadgeMontage,
  BadgeOrganizer,
  Tag,
  type Contribution,
  type MontageState,
} from '@/kit/badge';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/**
 * Spec 7.4 — every badge, in every form it takes.
 *
 * A fill that comes out of `StyleSheet.create` is compiled to a class rather than written out as a
 * colour (`story.tsx` says why), so «this is the spark one» is asked by holding two badges up
 * against each other: the class is the same or it is not.
 */

/** The background class of a rendered badge — its fill, as far as the markup shows one. */
function fillOf(markup: string): string {
  return markup.match(/r-backgroundColor-[a-z0-9]+/)?.[0] ?? '';
}

beforeAll(async () => {
  await setTheme('dark');
});

test('«Организатор» is the one spark pill, and it comes in the two sizes the layout draws', () => {
  const big = story(<BadgeOrganizer label="Организатор" />);
  expect(big).toContain('ОРГАНИЗАТОР');
  // The one place a person is marked by colour, and it is the fill `spark` is spent on: the same
  // fill the «Готов» badge wears and no other badge does.
  expect(fillOf(big)).toBe(fillOf(story(<BadgeMontage state="ready" label="Готов" />)));
  allDifferent({
    cover: <BadgeOrganizer label="Организатор" />,
    row: <BadgeOrganizer label="Организатор" sm />,
  });
});

test('the films badge is filled on a cover and outlined on a card', () => {
  allDifferent({
    filled: <BadgeFilms label="2 ролика" filled />,
    outlined: <BadgeFilms label="2 ролика" />,
  });
  // The declension is the screen's — a badge never counts anything itself.
  expect(story(<BadgeFilms label="1 ролик" />)).toContain('1 ролик');
  expect(story(<BadgeFilms label="5 роликов" />)).toContain('5 роликов');
});

test('the three states of a montage are three fills, and each says its own word', () => {
  const states: Record<MontageState, string> = {
    ready: 'Готов',
    pending: 'Собирается',
    failed: 'Не собрался',
  };
  allDifferent(
    Object.fromEntries(
      (Object.keys(states) as MontageState[]).map((state) => [
        state,
        <BadgeMontage state={state} label={states[state]} />,
      ]),
    ),
  );
  // «Готов» is the one that gets the spark — spec 1.2 spends it on «готово» and nothing near it.
  expect(fillOf(story(<BadgeMontage state="pending" label="Собирается" />))).not.toBe(
    fillOf(story(<BadgeMontage state="ready" label="Готов" />)),
  );
});

test('what a participant has brought is a circle, and the circle is read out in words', () => {
  const states: Record<Contribution, string> = {
    done: 'Всё загрузил',
    planned: 'Планирует загрузить',
  };
  allDifferent(
    Object.fromEntries(
      (Object.keys(states) as Contribution[]).map((state) => [
        state,
        <BadgeContribution state={state} label={states[state]} />,
      ]),
    ),
  );
  // A circle says nothing on its own, so each carries the sentence it stands for.
  for (const [state, label] of Object.entries(states) as [Contribution, string][]) {
    expect(story(<BadgeContribution state={state} label={label} />)).toContain(
      `aria-label="${label}"`,
    );
  }
  // «Всё загрузил» is the one wearing the spark: that mark is what the organizer scans a roster
  // for, and the other is an outline.
  expect(fillOf(story(<BadgeContribution state="done" label="Всё загрузил" />))).toBe(
    fillOf(story(<BadgeOrganizer label="Организатор" />)),
  );
});

test('what the director decided about a file is three marks, and one of them never stands alone', () => {
  allDifferent({
    take: <BadgeDecision kind="take" label="Беру" />,
    takeAt: <BadgeDecision kind="take" label="Беру 0:04–0:07" />,
    pass: <BadgeDecision kind="pass" label="Мимо" />,
    part: <BadgeDecision kind="part" label="часть 2" />,
  });
  // Spec 1.2: in the montage `spark` means «taken», so «Беру» and «Взял 1 из 4» wear the same fill
  // as «Готов» and «Мимо» does not.
  expect(fillOf(story(<BadgeDecision kind="take" label="Взял 1 из 4" />))).toBe(
    fillOf(story(<BadgeMontage state="ready" label="Готов" />)),
  );
  expect(fillOf(story(<BadgeDecision kind="pass" label="Мимо" />))).not.toBe(
    fillOf(story(<BadgeDecision kind="take" label="Беру" />)),
  );
});

test('a tag word is what was seen on a frame, and nothing presses it', () => {
  const tag = story(<Tag label="тёплый свет" />);
  expect(tag).toContain('тёплый свет');
  expect(tag).not.toContain('role="button"');
  // It is not a chip either: a chip is offered to be pressed and this one only reports.
  allDifferent({
    tag: <Tag label="Бабушка" />,
    decision: <BadgeDecision kind="pass" label="Бабушка" />,
  });
});
