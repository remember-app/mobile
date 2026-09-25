import { rule } from '@tests/helpers/css';
import { beforeAll, expect, test } from 'vitest';

import {
  BadgeContribution,
  BadgeDecision,
  BadgeFilms,
  BadgeMontage,
  BadgeOrganizer,
  type Contribution,
  type MontageState,
  Tag,
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

test('the badges of a memory card stand as tall as the layout draws them: 26, 28 and 30', () => {
  // TASK-383, off `Main.json`: «ОРГАНИЗАТОР» e14 is 26 — 6 over and under its 11 caps in Onest's
  // own 14 of leading, 11 at the sides (w111); «2 ролика» e15 is 28 filled — 6 over and under a 12 /
  // 600 count in 16; «1 ролик» e33 is the same pill with a 1 hairline round it, 30. They were 25,
  // 25 and 25: the films count set in the organizer's 11 / 700 caps, every pill with a clear border.
  const organizer = story(<BadgeOrganizer label="Организатор" />);
  expect(organizer).toContain(rule('padding-bottom:6px;padding-top:6px'));
  expect(organizer).toContain(rule('padding-left:11px;padding-right:11px'));
  expect(organizer).toContain(rule('line-height:14px'));

  const filled = story(<BadgeFilms label="2 ролика" filled />);
  const outlined = story(<BadgeFilms label="1 ролик" />);
  for (const films of [filled, outlined]) {
    expect(films).toContain(rule('padding-bottom:6px;padding-top:6px'));
    expect(films).toContain(rule('font-size:12px'));
    expect(films).toContain(rule('line-height:16px'));
  }
  // A border is drawn edge by edge in the markup.
  const edges = (property: string, value: string) =>
    rule(
      ['bottom', 'left', 'right', 'top']
        .map((edge) => `border-${edge}-${property}:${value}`)
        .join(';'),
    );
  expect(filled).toContain(edges('width', '0px'));
  expect(outlined).toContain(edges('width', '1px'));
  // Spec 7.4, detail 23: the outline is `accent` itself, the words `accentText` — #4B5BFF round
  // #A7AEFF at night.
  expect(outlined).toContain(edges('color', 'rgba(75,91,255,1.00)'));
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

test('«Готов» on the large poster is a decision mark in its own words, «ГОТОВ» in the strip small caps', () => {
  // Spec 7.4, detail 24, 10.11 (answer 2): on `MontageLiveDone` «Готов» as it is written, 11 / 700
  // with no tracking, a 22 pill — `MontageLiveDone.json` e10, 46.4 × 22; only the card in the strip
  // says «ГОТОВ», 10 / 700 at 0.06em, 21 tall on `0 9` (`MemoryFrames.json` e12).
  const poster = story(<BadgeMontage state="ready" label="Готов" />);
  expect(poster).toContain('>Готов<');
  expect(poster).not.toContain('ГОТОВ');
  // The pill a decision is drawn in: 22 on `0 8`, its words 11 / 700 untracked.
  expect(poster).toContain(rule('height:22px'));
  expect(poster).toContain(rule('padding-left:8px;padding-right:8px'));
  expect(poster).not.toContain(rule('letter-spacing:0.66px'));
  const strip = story(<BadgeMontage sm state="ready" label="Готов" />);
  expect(strip).toContain('>ГОТОВ<');
  expect(strip).toContain(rule('min-height:21px'));
  expect(strip).toContain(rule('letter-spacing:0.6px'));
  expect(strip).toContain(rule('padding-left:9px;padding-right:9px'));
});

test('«ещё будет» is ringed 1 in `lineStrong`, not 1.5', () => {
  // Spec 7.4, detail 27 and 10.11: «значок вклада: обводка 1.5 → 1».
  const planned = story(<BadgeContribution state="planned" label="Планирует загрузить" />);
  expect(planned).toContain(
    rule(
      'border-bottom-width:1px;border-left-width:1px;border-right-width:1px;border-top-width:1px',
    ),
  );
});
