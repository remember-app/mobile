import { Lock, Users, VolumeX } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { ChoiceCard } from '@/kit/choice';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.3, detail 21 — the choice card: one meaning at two heights, and one of them read-only. */

beforeAll(async () => {
  await setTheme('dark');
});

test('a tile and a row are two heights of one thing, chosen or not', () => {
  allDifferent({
    tile: <ChoiceCard icon={Users} title="Общий" note="видят все участники" onPress={() => {}} />,
    tileChosen: (
      <ChoiceCard icon={Users} title="Общий" note="видят все участники" selected onPress={() => {}} />
    ),
    row: (
      <ChoiceCard
        icon={VolumeX}
        title="Без музыки"
        note="Только живой звук из видео"
        variant="row"
        onPress={() => {}}
      />
    ),
    rowChosen: (
      <ChoiceCard
        icon={VolumeX}
        title="Без музыки"
        note="Только живой звук из видео"
        variant="row"
        selected
        onPress={() => {}}
      />
    ),
  });
});

test('the chosen one carries the accent’s quiet fill and says it is chosen', () => {
  const chosen = story(
    <ChoiceCard icon={Lock} title="Личный" note="только вы" selected onPress={() => {}} />,
  );
  // Spec 7.3: `accentSoft` under a 1.5 accent border, which is a shape and a fill both — told apart
  // from the unchosen one by the drawing, and said out loud by the state.
  expect(chosen).not.toBe(
    story(<ChoiceCard icon={Lock} title="Личный" note="только вы" onPress={() => {}} />),
  );
  // One of a set where exactly one is on, so it is a radio and says «checked» rather than «pressed».
  expect(chosen).toContain('role="radio"');
  expect(chosen).toContain('aria-checked="true"');
});

test('the row carries a tick on the right and the tile does not', () => {
  const row = story(
    <ChoiceCard icon={VolumeX} title="Без музыки" variant="row" selected onPress={() => {}} />,
  );
  const tile = story(<ChoiceCard icon={Users} title="Общий" selected onPress={() => {}} />);
  // Two glyphs in the row — the sign on the left and the tick on the right; one in the tile.
  expect(row.match(/data-glyph/g)).toHaveLength(2);
  expect(tile.match(/data-glyph/g)).toHaveLength(1);
  // An unchosen row has no tick at all: there is nothing to un-tick.
  expect(
    story(<ChoiceCard icon={VolumeX} title="Без музыки" variant="row" onPress={() => {}} />).match(
      /data-glyph/g,
    ),
  ).toHaveLength(1);
});

test('a read-only card is the choice that was made, whether or not it is also told it is selected', () => {
  // The sheet that edits a label hands it in as just `readOnly`: the value is fixed, so there is no
  // unchosen state to fall back on, and a card drawn as unchosen would say «not this one».
  const bare = story(<ChoiceCard icon={Users} title="Общий" note="видят все участники" variant="row" readOnly />);
  const told = story(
    <ChoiceCard icon={Users} title="Общий" note="видят все участники" variant="row" selected readOnly />,
  );
  expect(bare).toBe(told);
  expect(bare).not.toBe(story(<ChoiceCard icon={Users} title="Общий" note="видят все участники" variant="row" />));
});

test('read-only is a value and not a button, and never a greyed-out one', () => {
  const fixed = story(
    <ChoiceCard icon={Users} title="Общий" note="видят все участники" selected readOnly />,
  );
  // Spec 10.8.1: no press and no `tabindex`, because a disabled button promises it will press one
  // day. What is left is the value, read out as one sentence.
  expect(fixed).not.toContain('role="radio"');
  expect(fixed).not.toContain('tabindex');
  expect(fixed).toContain('aria-label="Общий. видят все участники"');
  // Drawn as chosen — the fill stays — but quiet: the border goes back to `line`, so it is not the
  // same drawing as the live chosen tile.
  expect(fixed).not.toBe(
    story(
      <ChoiceCard
        icon={Users}
        title="Общий"
        note="видят все участники"
        selected
        onPress={() => {}}
      />,
    ),
  );
});
