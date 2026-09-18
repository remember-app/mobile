import { Copy } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { AvatarStack } from '@/kit/member';
import {
  RowAction,
  RowRejected,
  RowSection,
  RowStep,
  RowSummary,
  RowTrack,
  Waveform,
  type StepState,
} from '@/kit/rows';
import { allDifferent, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.6 — the rows, each of them one line of a list somewhere in the product. */

beforeAll(async () => {
  await setTheme('dark');
});

test('a summary row is a way back to the step that settled it', () => {
  const row = story(<RowSummary label="Кадры" value="214 из 486" onPress={() => {}} />);
  expect(row).toContain('Кадры');
  expect(row).toContain('214 из 486');
  expect(row).toContain('role="button"');
  // The label column is fixed so three rows line up whatever is in them.
  allDifferent({
    first: <RowSummary label="Кадры" value="214 из 486" onPress={() => {}} />,
    later: <RowSummary label="Музыка" value="Яркая · в ритм" onPress={() => {}} divider />,
  });
});

test('picking a track makes it grow rather than tick it', () => {
  allDifferent({
    plain: <RowTrack title="Яркая" length="2:14" onPress={() => {}} divider />,
    picked: <RowTrack title="Яркая" length="2:14" selected onPress={() => {}} />,
    playing: <RowTrack title="Яркая" length="2:14" selected playing at={0.4} onPress={() => {}} />,
  });
  // The waveform only opens under the one that was picked: sixteen bars, and none before that.
  const bars = (markup: string) => (markup.match(/height:\d+px/g) ?? []).length;
  expect(bars(story(<RowTrack title="Яркая" length="2:14" onPress={() => {}} />))).toBe(0);
  expect(bars(story(<RowTrack title="Яркая" length="2:14" selected onPress={() => {}} />))).toBe(16);
});

test('the waveform paints what has been heard and leaves the rest alone', () => {
  allDifferent({
    start: <Waveform at={0} />,
    middle: <Waveform at={0.5} />,
    end: <Waveform at={1} />,
  });
});

test('a reason the pass dropped frames reports, and offers them back', () => {
  const row = story(
    <RowRejected icon={Copy} title="Дубли" count="22 кадра — оставили лучший из серии" divider />,
  );
  expect(row).toContain('Дубли');
  expect(row).toContain('22 кадра — оставили лучший из серии');
  expect(row).toContain('data-glyph');
});

test('the four states of a build step are four states, and three of them say a word', () => {
  const states: StepState[] = ['done', 'running', 'waiting', 'failed'];
  const words: Record<StepState, string | undefined> = {
    done: 'готово',
    running: 'идёт',
    waiting: undefined,
    failed: 'не вышло',
  };
  allDifferent(
    Object.fromEntries(
      states.map((state) => [
        state,
        <RowStep title="Режиссёр строит историю" state={state} word={words[state]} />,
      ]),
    ),
  );
  // The one that is waiting says nothing on the right: there is nothing yet to report.
  expect(story(<RowStep title="Склейка" state="waiting" />)).not.toContain('готово');
  expect(story(<RowStep title="Склейка" state="running" word="идёт" />)).toContain('идёт');
});

test('a sheet’s dangerous action is the only red line on it', () => {
  allDifferent({
    plain: <RowAction icon={Copy} label="Сохранить в галерею телефона" onPress={() => {}} />,
    danger: <RowAction icon={Copy} label="Удалить из воспоминания" danger onPress={() => {}} />,
  });
  // #FF8D8D on both the glyph and the words — one voice, not a red word beside a grey glyph.
  const danger = story(
    <RowAction icon={Copy} label="Удалить из воспоминания" danger onPress={() => {}} />,
  );
  expect(danger).toContain('stroke="#FF8D8D"');
  expect(danger).toContain('rgba(255,141,141,1.00)');
});

test('a section row carries its sign, two lines and the chevron that says where it goes', () => {
  const row = story(
    <RowSection
      title="Контакты"
      meta="8 человек"
      sign={<AvatarStack names={['Аня', 'Марк', 'Лиза']} />}
      onPress={() => {}}
    />,
  );
  expect(row).toContain('Контакты');
  expect(row).toContain('8 человек');
  expect(row).toContain('role="button"');
  expect(row).toContain('АН');
});

test('a row nobody can press is not a button', () => {
  expect(story(<RowSummary label="Кадры" value="214 из 486" />)).not.toContain('role="button"');
  expect(story(<RowAction icon={Copy} label="Поделиться" />)).not.toContain('role="button"');
});
