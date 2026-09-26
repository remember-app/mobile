import { rule } from '@tests/helpers/css';
import { mountsTrees } from '@tests/helpers/renderer';
import { Check, Copy, Pencil, Plus, X } from 'lucide-react-native';
import {
  type Insets,
  Pressable,
  Text as RNText,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { BadgeDecision } from '@/kit/badge';
import { IconButton } from '@/kit/button';
import { Field } from '@/kit/field';
import { playFor } from '@/kit/icon';
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
import { allDifferent, compiled, story } from '@/kit/story';
import { font, setTheme, themes } from '@/theme';

/** Spec 7.7 — the rows, each of them one line of a list somewhere in the product. */

mountsTrees();

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

test('a summary row is 11 over and under a value of 14 / 500 on its 18 — rows of one line 41 apart', () => {
  // Spec 7.7, detail 52 («подпись 12 / 500 muted, значение 14 / 500 tabular, поля 11 / 0») and 10.11
  // («SheetFrameInfo шаг 41»); `SheetFrameInfo.json` e9–e11: «Файл» 12 / 500, «IMG_4471.HEIC · 4,2
  // МБ» 14 / 500 on 18, the rule at 212 and the next value at 224. The row stood on a floor of 44 with
  // its value at 15 / 600 and its label at 13 / 600: 45 apart.
  const fact = story(<RowSummary label="Файл" value="IMG_4471.HEIC · 4,2 МБ" />);
  const row = /<div[^>]*class="([^"]*)"><div[^>]*>Файл</.exec(fact)?.[1] ?? '';
  expect(row).toContain(rule('padding-bottom:11px;padding-top:11px'));
  expect(row).not.toContain('r-minHeight-');
  const value = /class="([^"]*)"[^>]*>IMG_4471/.exec(fact)?.[1] ?? '';
  expect(value).toContain(rule('font-size:14px'));
  expect(value).toContain(rule('line-height:18px'));
  expect(value).toContain(rule(`font-family:${font.medium}`));
  const label = /class="([^"]*)"[^>]*>Файл</.exec(fact)?.[1] ?? '';
  expect(label).toContain(rule('font-size:12px'));
  expect(label).toContain(rule(`font-family:${font.medium}`));
  expect(label).toContain(rule('color:rgba(164,161,178,1.00)'));
  // A row that leads somewhere is a button, and a button is felt at a finger's 44 all the same.
  expect(story(<RowSummary label="Кадры" value="214 из 486" onPress={() => {}} />)).toContain(
    rule('min-height:44px'),
  );
});

test('a track row is a row, and what picks it is the button on its right', () => {
  const take = <IconButton size={36} icon={Plus} label="Добавить «Яркая»" />;
  const listen = { label: 'Послушать «Яркая»', onPress: () => {} };
  allDifferent({
    plain: <RowTrack title="Яркая" length="2:14" play={listen} action={take} divider />,
    playing: <RowTrack title="Яркая" length="2:14" playing play={listen} action={take} />,
    taken: (
      <RowTrack
        title="Яркая"
        length="2:14"
        play={listen}
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

test('«Послушать» is the row’s own: 40 on the shelf, 36 among the chosen, a small filled play', () => {
  const listen = { label: 'Послушать «Тёплая»', onPress: () => {} };
  const shelf = story(<RowTrack title="Тёплая" length="1:40" play={listen} />);
  const chosen = story(<RowTrack picked title="Тёплая" length="1:40" play={listen} />);
  // Spec 7.7, details 53 and 54: a `raise` circle, 40 on the shelf and 36 in «Выбрано».
  expect(shelf).toContain('width:40px');
  expect(chosen).toContain('width:36px');
  expect(shelf).toContain('aria-label="Послушать «Тёплая»"');
  // TASK-384 (R7): the layout draws play filled, its own small triangle in a 16 box
  // (`MontageMusic.json`, «значок в «Послушать …»»: 16 × 16, fill #F5F3EE) — Lucide's lands on it at
  // `playFor(16)`, where the 40 circle's own 20, outlined, read ×1.8.
  for (const row of [shelf, chosen]) {
    expect(row).toContain(`<svg data-glyph="Play" width="${playFor(16)}"`);
    expect(row).toContain('fill="#F5F3EE"');
  }
  // Sounding, it is the pause, drawn and filled the same (spec 5 fills play and pause).
  const heard = story(<RowTrack title="Тёплая" length="1:40" playing play={listen} />);
  expect(heard).toContain(`<svg data-glyph="Pause" width="${playFor(16)}"`);
  expect(heard).toContain('fill="#F5F3EE"');
  // A track of their own has no link to play: no button at all.
  expect(story(<RowTrack title="Мой трек" length="Свой" />)).not.toContain('role="button"');
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
  expect(wished).toContain(rule('min-height:60px'));
  expect(bare).not.toContain(rule('min-height:60px'));
  // Both are floors: a name on large type takes a second line, and a row of a fixed 52 or 60 would
  // cut it off.
  expect(bare).toContain(rule('min-height:52px'));
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

test('a stage is named at 14 / 600 with its line at 11 / 500, as the layout draws the row', () => {
  // TASK-384 (R4), spec 7.7 detail 56 and `MontageLive.json`: «Отсев брака» 14 / 600, «212 из 214
  // годятся · 1 мин» 11 / 500 `muted`. The row used the scale's `label` 13 and `badgeSm` 10 / 700.
  const row = story(
    <RowStep
      title="Отсев брака"
      state="done"
      meta="212 из 214 годятся · 1 мин"
      onPress={() => {}}
    />,
  );
  const name = row.match(/class="([^"]*)"[^>]*>Отсев брака</)?.[1] ?? '';
  expect(name).toContain(rule('font-size:14px'));
  expect(name).toContain(rule(`font-family:${font.semi}`));
  const meta = row.match(/class="([^"]*)"[^>]*>212 из 214 годятся · 1 мин</)?.[1] ?? '';
  expect(meta).toContain(rule('font-size:11px'));
  expect(meta).toContain(rule(`font-family:${font.medium}`));
});

test('the reasons the pass dropped frames stand 10 above and below, row under row', () => {
  // TASK-384, spec 7.7 detail 55 («поля 10 / 0») and `SheetRejected.json`: a 40 «Вернуть» with 10
  // over and under it, the next row's button 68 further down where its count takes two lines. The
  // row had 12, and the sheet's gap of 18 between rows put them 83 apart.
  const row = story(<RowRejected icon={Copy} title="Размыто" count="34 кадра" />);
  expect(row).toContain(rule('padding-bottom:10px;padding-top:10px'));
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

test('a record under a stage is a glance, read out with its decision', () => {
  // The frame's card is one press further, on the stage's own journal (TASK-388): the record here
  // takes no finger. It carries no label of its own either: a screen reader is given the thought and
  // the decision beside it as they stand. A label of the thought alone would keep «Беру» / «Мимо» —
  // the other half of what the record says — from anybody who cannot see the pill.
  const note = story(
    <StepNote
      uri="https://bucket.example/f10.jpg"
      text="Марк роняет кольцо"
      mark={<BadgeDecision kind="take" label="Беру 0:04–0:07" />}
    />,
  );
  expect(note).not.toContain('role="button"');
  expect(note).not.toContain('aria-label');
  expect(note).toContain('Беру 0:04–0:07');
});

test('a row nobody can press is read as a line of facts, not as a control that is out', () => {
  // A `Pressable` held `disabled` is announced «недоступно» / «dimmed»: the facts of a frame, the
  // stages still ahead and a record under a stage are none of them a button that is switched off.
  for (const row of [
    <RowSummary key="fact" label="Файл" value="IMG_4471.HEIC · 4,2 МБ" />,
    <RowStep key="ahead" title="Дальше: ритм трека · склейка" state="waiting" />,
    <StepNote key="glance" uri="https://bucket.example/f10.jpg" text="Марк роняет кольцо" />,
  ]) {
    const drawn = story(row);
    expect(drawn).not.toContain('aria-disabled');
    expect(drawn).not.toContain('role="button"');
  }
  // One that leads somewhere is still the button it always was.
  expect(story(<RowSummary label="Кадры" value="214 из 486" onPress={() => {}} />)).toContain(
    'role="button"',
  );
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

/* ── The layout's numbers for the stages (`MontageLive`, `MontageLiveDone`, measured) ─────────── */

/**
 * A row drawn once: the style of its press area — the plain view a row nobody can press stands in —
 * and of each native text, and the texts' props.
 */
function drawnRow(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  const [{ props: press }] = tree.root.findAll(
    (node) => node.type === Pressable || (node.type === View && node.props.accessible === true),
  );
  const pressStyle = (pressed: boolean) =>
    typeof press.style === 'function' ? press.style({ pressed }) : press.style;
  const texts = tree.root.findAllByType(RNText).map((one) => ({
    said: [one.props.children].flat().join(''),
    lines: one.props.numberOfLines as number | undefined,
    style: StyleSheet.flatten(one.props.style) as TextStyle,
  }));
  act(() => tree.unmount());
  return {
    press: {
      style: StyleSheet.flatten(pressStyle(false)) as ViewStyle,
      hitSlop: press.hitSlop as Insets | undefined,
    },
    texts,
  };
}

test('a stage’s name and its line stand on their 18 and 14, in a row of 48, and neither is ever cut', () => {
  // `MontageLive`: «Отсев брака» at 424.5, 18 tall, and «212 из 214 годятся · 1 мин» `muted` at
  // 443.5, 14 tall, in a row of 48 from 417. Both were cut to one line, which on large system type
  // drops the end of a stage's name or of what it came to.
  const row = drawnRow(
    <RowStep
      title="Отсев брака"
      state="done"
      meta="212 из 214 годятся · 1 мин"
      onPress={() => {}}
    />,
  );
  const [name, line] = row.texts;
  expect(name).toMatchObject({ said: 'Отсев брака', lines: undefined });
  expect(name.style.lineHeight).toBe(18);
  expect(line).toMatchObject({ said: '212 из 214 годятся · 1 мин', lines: undefined });
  expect(line.style).toMatchObject({ lineHeight: 14, color: themes.dark.color.muted });
  expect(row.press.style.minHeight).toBe(48);
});

test('the stages still ahead are one quiet line on a row of 44, whole however long it runs', () => {
  // `MontageLive`: the circle at 706 and «Дальше: ритм трека · склейка» Onest 13 / 500 at 709.5 in a
  // row from 696 to 740 — 44, where a reached stage has 48. The app drew it 48 and cut it to one
  // line, which «Дальше:» with all five stages in it outruns. Spec detail 56 and 10.11: `muted`
  // #A4A1B2, not the layout's `faint` #6E6B7D, and a second line of 13 / 18 when it wraps.
  const row = drawnRow(
    <RowStep
      title="Дальше: отсев брака · разбор кадров · история · ритм трека · склейка"
      state="waiting"
    />,
  );
  expect(row.press.style.minHeight).toBe(740 - 696);
  expect(row.texts[0].lines).toBeUndefined();
  expect(row.texts[0].style).toMatchObject({
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Onest_500Medium',
    color: themes.dark.color.muted,
  });
});

test('the ring of a stage ahead is 1 and the running one’s 2, as the layout draws them', () => {
  // `MontageLive.json` e59: the stage ahead is a 24 circle in `1px solid #2C2C3A`; e45: the running
  // one is 24 in `2px` of `#2C2C3A` with its arc in `#4B5BFF` on top. Spec 10.11: 1.5 → 1 and
  // 2.5 → 2 — the app drew 1.5 and 3.
  const { line, accent } = themes.dark.color;
  const rings = (state: StepState) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<RowStep title="Этап" state={state} onPress={() => {}} />);
    });
    const styles = tree.root
      .findAll((node) => node.props.style !== undefined && typeof node.props.style !== 'function')
      .map((node) => StyleSheet.flatten(node.props.style) as ViewStyle)
      .filter((style) => style.width === 24 && style.height === 24);
    act(() => tree.unmount());
    return styles;
  };
  expect(rings('waiting')).toContainEqual(expect.objectContaining({ borderWidth: 1 }));
  expect(rings('running')).toContainEqual(
    expect.objectContaining({ borderWidth: 2, borderColor: line, borderTopColor: accent }),
  );
});

test('a record under the stage in hand is 12 / 500 / 16 in the quoted-words ink, two lines at most', () => {
  // `MontageLive.json` e51 and e54: «Марк роняет кольцо…» Onest 12 / 500 on a 16 line, 32 tall for
  // two, in `#D8D5E0` — spec detail 56 and 10.11, «текст-цитата» (the `quote` tone; the 13 / 400 / 19
  // of the `quote` role is the story in the order's summary, detail 43). The app drew the meta's 15
  // line in `paper`. The video's «0:12» in the corner (e50) is 9 / 700 untracked, not `badgeSm`.
  const note = drawnRow(
    <StepNote uri="https://bucket.example/f10.jpg" length="0:12" text="Марк роняет кольцо" />,
  );
  const words = note.texts.find((one) => one.said === 'Марк роняет кольцо')!;
  expect(words.lines).toBe(2);
  expect(words.style).toMatchObject({
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Onest_500Medium',
    color: '#D8D5E0',
  });
  expect(themes.dark.color.quote).toBe('#D8D5E0');
  const time = note.texts.find((one) => one.said === '0:12')!;
  expect(time.style).toMatchObject({ fontSize: 9, fontFamily: 'Onest_700Bold', color: '#FFFFFF' });
  expect(time.style.letterSpacing).toBeUndefined();
});

test('the way into a stage’s journal is drawn 40 and felt 44, its chevron right after the words', () => {
  // `MontageLive`: «Весь журнал этапа · 148 записей» Onest 12 / 600 `accentText` in a 356 × 40 row,
  // the chevron at 266 — 6 after the words, not at the far edge. The app drew it 44 tall in the
  // 11 / 700 badge, the words stretched to push the chevron to the edge.
  const link = drawnRow(<StepLink label="Весь журнал этапа · 148 записей" onPress={() => {}} />);
  expect(link.press.style).toMatchObject({ minHeight: 40, gap: 6 });
  expect(link.press.hitSlop).toMatchObject({ top: 2, bottom: 2 });
  const [words] = link.texts;
  expect(words.style).toMatchObject({
    fontSize: 12,
    fontFamily: 'Onest_600SemiBold',
    color: themes.dark.color.accentText,
    flexShrink: 1,
  });
  expect(words.style.flex).toBeUndefined();
  expect(words.style.flexGrow).toBeUndefined();
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
