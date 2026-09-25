import { Check, Copy, Pause, Pencil, Play, Plus, X } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { BadgeDecision } from '@/kit/badge';
import { IconButton } from '@/kit/button';
import { Field } from '@/kit/field';
import { AvatarStack } from '@/kit/member';
import {
  RowAction,
  RowRejected,
  RowSection,
  RowStep,
  RowSummary,
  RowTrack,
  StepLink,
  StepNote,
  type StepState,
  Waveform,
} from '@/kit/rows';
import { allDifferent, compiled, rule, story } from '@/kit/story';
import { setTheme } from '@/theme';

/** Spec 7.7 — the rows, each of them one line of a list somewhere in the product. */

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

test('the same row stating a fact has no arrow on it', () => {
  // The chevron promises a screen, and on the frame's own sheet («Файл», «Камера», «Место») there
  // is none: that sheet is «только смотреть». Same row, two states, and the arrow is the difference.
  allDifferent({
    leads: <RowSummary label="Кадры" value="214 из 486" onPress={() => {}} />,
    states: <RowSummary label="Файл" value="IMG_4471.HEIC · 4,2 МБ" />,
  });
  const fact = story(<RowSummary label="Файл" value="IMG_4471.HEIC · 4,2 МБ" />);
  expect(fact).toContain('IMG_4471.HEIC · 4,2 МБ');
  expect(fact).not.toContain('data-glyph');
});

test('a track row is a row, and what picks it is the button on its right', () => {
  const take = <IconButton size={36} icon={Plus} label="Добавить «Яркая»" />;
  allDifferent({
    plain: (
      <RowTrack
        title="Яркая"
        length="2:14"
        play={<IconButton size={40} icon={Play} label="Послушать" />}
        action={take}
        divider
      />
    ),
    playing: (
      <RowTrack
        title="Яркая"
        length="2:14"
        playing
        play={<IconButton size={40} icon={Pause} label="Стоп" />}
        action={take}
      />
    ),
    taken: (
      <RowTrack
        title="Яркая"
        length="2:14"
        play={<IconButton size={40} icon={Play} label="Послушать" />}
        action={
          <IconButton size={36} icon={Check} label="Убрать «Яркая» из выбранных" tone="paper" on />
        }
      />
    ),
  });
  // The row itself picks nothing — several tracks can be taken, and a row that was the switch
  // could not say that.
  expect(story(<RowTrack title="Яркая" length="2:14" />)).not.toContain('role="button"');
  // The name goes `spark` while it is sounding, and nothing else in the row moves. The colour is
  // a compiled class here (`story.tsx`), so what is asked is that the two are not the same row.
  expect(story(<RowTrack title="Яркая" length="2:14" playing />)).not.toBe(
    story(<RowTrack title="Яркая" length="2:14" />),
  );
});

test('a chosen track carries its wish under its name, and its field under the row', () => {
  const buttons = (written: boolean) => (
    <>
      <IconButton
        size={36}
        icon={Pencil}
        label={written ? 'Изменить пожелание к «Тёплая»' : 'Как использовать «Тёплая»'}
        tone={written ? 'raise' : 'ghost'}
      />
      <IconButton size={36} icon={X} label="Убрать «Тёплая»" />
    </>
  );
  // Spec 7.7, detail 54: among the chosen the row is its own — tighter than on the shelf, 52 with
  // nothing written and 60 with a wish as a line under the name, and the field it is written in
  // unfolds under the row.
  allDifferent({
    shelf: <RowTrack title="Тёплая" length="1:40" />,
    chosen: <RowTrack picked title="Тёплая" length="1:40" action={buttons(false)} />,
    wished: (
      <RowTrack
        picked
        title="Тёплая"
        length="1:40"
        wish="На сборы, тихо, под голоса"
        action={buttons(true)}
      />
    ),
    open: (
      <RowTrack picked title="Тёплая" length="1:40" action={buttons(false)}>
        <Field variant="wish" label="Как использовать «Тёплая»" labelHidden value="" />
      </RowTrack>
    ),
  });
  const wished = story(
    <RowTrack picked title="Тёплая" length="1:40" wish="На сборы, тихо, под голоса" />,
  );
  const bare = story(<RowTrack picked title="Тёплая" length="1:40" />);
  expect(wished).toContain('На сборы, тихо, под голоса');
  // A sheet's shape is a class in the markup (`story.tsx`), so it is read through the rule.
  expect(wished).toContain(rule('height:60px'));
  expect(bare).not.toContain(rule('height:60px'));
  // One line, cut short with an ellipsis where it runs long: the whole of it is in the field.
  expect(wished).toContain(rule('text-overflow:ellipsis'));
  // The hairline between two chosen rows starts at 60, past the smaller «Послушать»; on the shelf
  // it starts at 64.
  expect(story(<RowTrack picked title="Тёплая" length="1:40" divider />)).toContain(
    rule('margin-left:60px'),
  );
  expect(story(<RowTrack title="Тёплая" length="1:40" divider />)).toContain(
    rule('margin-left:64px'),
  );
});

test('a chosen row is dragged by its name', () => {
  // Spec 7.7, detail 54: «строку берут за имя и ведут». The handlers belong to the list; what the
  // row does is put them on the one part of it that is not a button — the name and the wish.
  const dragged = story(
    <RowTrack
      picked
      title="Тёплая"
      length="1:40"
      wish="На сборы"
      grip={{
        accessible: true,
        accessibilityRole: 'adjustable',
        accessibilityLabel: 'Переставить «Тёплая». 1:40. На сборы',
      }}
    />,
  );
  expect(dragged).toContain('aria-label="Переставить «Тёплая». 1:40. На сборы"');
  expect(dragged).toContain('role="slider"');
  // A row nobody can reorder is the same row without any of that on it.
  expect(story(<RowTrack picked title="Тёплая" length="1:40" />)).not.toContain('aria-label');
});

test('the waveform is one drawing, and no track row carries it', () => {
  const bars = (markup: string) => (markup.match(/height:\d+px/g) ?? []).length;
  // Twenty 3px bars, in the summary (spec 7.10) — the rows of the music step have none any more.
  expect(bars(story(<Waveform />))).toBe(20);
  expect(story(<Waveform />)).toContain(rule('width:3px'));
  expect(bars(story(<RowTrack title="Яркая" length="2:14" />))).toBe(0);
  expect(
    bars(story(<RowTrack picked title="Тёплая" length="1:40" wish="На сборы, тихо, под голоса" />)),
  ).toBe(0);
});

test('a reason the pass dropped frames reports, and offers them back', () => {
  const row = story(
    <RowRejected icon={Copy} title="Дубли" count="22 кадра — оставили лучший из серии" divider />,
  );
  expect(row).toContain('Дубли');
  expect(row).toContain('22 кадра — оставили лучший из серии');
  expect(row).toContain('data-glyph');
});

test('the four states of a build step are four states, and three of them lead somewhere', () => {
  const states: StepState[] = ['done', 'running', 'waiting', 'failed'];
  const metas: Record<StepState, string | undefined> = {
    done: '212 из 214 годятся · 1 мин',
    running: '61 из 212 разложено · идёт 4 мин',
    waiting: undefined,
    failed: 'оборвалось на 3 минуте',
  };
  allDifferent(
    Object.fromEntries(
      states.map((state) => [
        state,
        <RowStep
          title="Режиссёр строит историю"
          state={state}
          meta={metas[state]}
          onPress={() => {}}
        />,
      ]),
    ),
  );
  // Spec 7.7 — a stage still ahead is not a road: no second line, no chevron, and no press.
  const ahead = story(
    <RowStep title="Дальше: ритм трека · склейка" state="waiting" onPress={() => {}} />,
  );
  expect(ahead).not.toContain('role="button"');
  expect(
    story(<RowStep title="Отсев брака" state="done" meta="1 мин" onPress={() => {}} />),
  ).toContain('role="button"');
});

test('a stage that fell over wears the danger cross, never the spark of a stage it got through', () => {
  const failed = story(<RowStep title="Анализ кадров" state="failed" onPress={() => {}} />);
  const done = story(<RowStep title="Отсев брака" state="done" onPress={() => {}} />);
  // Spec detail 56: `dangerText` with a cross against `spark` with a check.
  const cross = 'stroke="#FF8D8D"';
  expect(failed).toContain(cross);
  expect(done).not.toContain(cross);
  const sparkFill = compiled().match(
    /\.(r-backgroundColor-[a-z0-9]+)\{background-color:rgba\(228,255,79,1\.00\);\}/,
  )?.[1];
  expect(sparkFill).toBeDefined();
  expect(done).toContain(sparkFill);
  expect(failed).not.toContain(sparkFill);
});

test('the stage in hand opens out, and the ones around it do not', () => {
  const open = (
    <RowStep
      title="Режиссёр строит историю"
      state="running"
      meta="61 из 212"
      open
      onPress={() => {}}
    >
      <StepNote
        uri="https://bucket.example/f10.jpg"
        length="0:12"
        text="Марк роняет кольцо — живой момент, беру 3 секунды"
        mark={<BadgeDecision kind="take" label="Беру" />}
      />
    </RowStep>
  );
  const shut = (
    <RowStep title="Режиссёр строит историю" state="running" meta="61 из 212" onPress={() => {}} />
  );
  allDifferent({ open, shut });
  expect(story(open)).toContain('Марк роняет кольцо');
  // A record handed to a stage that is not opened is not drawn at all.
  expect(story(shut)).not.toContain('Марк роняет кольцо');
});

test('a record under a stage opens that frame’s card where there is one to open', () => {
  // On the finished film's page every record leads to `SheetLiveFile` (TASK-222); while the montage
  // is still being cut the same row is a glance and takes no finger, so the press is optional and
  // the row is not a button without one.
  const note = (onPress?: () => void) =>
    story(
      <StepNote uri="https://bucket.example/f10.jpg" text="Марк роняет кольцо" onPress={onPress} />,
    );
  expect(note(() => {})).toContain('role="button"');
  expect(note()).not.toContain('role="button"');
  // It carries no label of its own: a screen reader is given the thought and the decision beside it
  // as they stand. A label of the thought alone would keep «Беру» / «Мимо» — the other half of what
  // the record says — from anybody who cannot see the pill.
  expect(note(() => {})).not.toContain('aria-label');
  expect(
    story(
      <StepNote
        uri="https://bucket.example/f10.jpg"
        text="Марк роняет кольцо"
        mark={<BadgeDecision kind="take" label="Беру 0:04–0:07" />}
        onPress={() => {}}
      />,
    ),
  ).toContain('Беру 0:04–0:07');
});

test('the last line of an opened stage is the way into the whole of its journal', () => {
  const link = story(<StepLink label="Весь журнал этапа · 148 записей" onPress={() => {}} />);
  expect(link).toContain('Весь журнал этапа · 148 записей');
  expect(link).toContain('role="button"');
  // A road and not an action: the chevron is the only thing it wears, in the accent the words are
  // read in.
  expect(link).toContain('stroke="#A7AEFF"');
  // And with nowhere to go it is not a button at all — the rule every row here keeps.
  expect(story(<StepLink label="Весь журнал этапа · 148 записей" />)).not.toContain(
    'role="button"',
  );
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

test('a section stands under its own heading, in the caps the layout writes it in', () => {
  // Spec 7.7, detail 58: the eyebrow over the card, and the card itself unchanged under it.
  const headed = story(
    <RowSection heading="Контакты" title="8 человек" meta="Зовите выбором" onPress={() => {}} />,
  );
  expect(headed).toContain('КОНТАКТЫ');
  expect(headed).toContain('role="heading"');
  expect(headed).toContain('8 человек');
  allDifferent({
    bare: <RowSection title="8 человек" onPress={() => {}} />,
    headed: <RowSection heading="Контакты" title="8 человек" onPress={() => {}} />,
  });
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
