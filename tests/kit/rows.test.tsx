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

import { IconButton } from '@/kit/button';
import { Field } from '@/kit/field';
import { playFor } from '@/kit/icon';
import { AvatarStack } from '@/kit/member';
import {
  RowAction,
  RowEdit,
  RowRejected,
  RowSection,
  RowSummary,
  RowTrack,
  ShotCells,
  Waveform,
} from '@/kit/rows';
import { allDifferent, story } from '@/kit/story';
import { font, setTheme } from '@/theme';

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

test('the reasons the pass dropped frames stand 10 above and below, row under row', () => {
  // TASK-384, spec 7.7 detail 55 («поля 10 / 0») and `SheetRejected.json`: a 40 «Вернуть» with 10
  // over and under it, the next row's button 68 further down where its count takes two lines. The
  // row had 12, and the sheet's gap of 18 between rows put them 83 apart.
  const row = story(<RowRejected icon={Copy} title="Размыто" count="34 кадра" />);
  expect(row).toContain(rule('padding-bottom:10px;padding-top:10px'));
});

/* ── The layout's numbers for the stages (`MontageLive`, `MontageLiveDone`, measured) ─────────── */

/**
 * A row drawn once: the style of its press area — the plain view a row nobody can press stands in —
 * and of each native text, and the texts' props.
 */
function _drawnRow(element: React.ReactElement) {
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

test('the date row carries the words that change it, and no chevron promising a screen', () => {
  // Spec 8, `FrameInfo` and `FrameInfo.html` e57–e62: the card of what the file is opens with when
  // it was shot, and at its end «Изменить» — words alone in `accent`, 28 tall, with nothing round
  // them. A chevron here would promise a screen to go to, and there is none: the editor opens in
  // place, under the row.
  const row = story(<RowEdit value="13 сентября, 21:47" edit="Изменить" onEdit={() => {}} />);
  expect(row).toContain('13 сентября, 21:47');
  expect(row).toContain('Изменить');
  expect(row).toContain('role="button"');
  expect(row).not.toContain('data-glyph');
  // The tail is `accent` (#A7AEFF, `FrameInfo.html` e61) and not the `paper` the value is set in.
  expect(row).toContain(rule('color:rgba(167,174,255,1.00)'));
  expect(row).toContain(rule('min-height:28px'));
  // 14 over the value and 12 under, and the row's own sides — as the layout draws it.
  expect(row).toContain(rule('padding-top:14px'));
  expect(row).toContain(rule('padding-bottom:12px'));
  // Read out with the value, so «Изменить» is not the only thing a reader is answered with.
  expect(row).toContain('aria-label="Изменить: 13 сентября, 21:47"');
});

/**
 * TASK-533 — the shooting settings strip (`FrameInfo.html` e76–82): five equal columns under a
 * `raise` rule, a `raise` hairline at the left of every cell but the first, and a centred 12 / 600
 * `muted` figure in each, 11 over and under.
 *
 * The shape is what is asked of here — the words are the screen's (`@/lib/frames` says which cells
 * there are and what each says) — so the strip is drawn from all five and checked against the
 * layout's own numbers rather than against a remembered look.
 */
test('the shooting settings are five equal cells under a rule, with a hairline between two', () => {
  const strip = story(<ShotCells cells={['ISO 400', '24 мм', '0 ev', 'f/1.8', '1/60 с']} />);
  for (const cell of ['ISO 400', '24 мм', '0 ev', 'f/1.8', '1/60 с']) expect(strip).toContain(cell);
  // `repeat(5, minmax(0, 1fr))` — every cell a share of the row and no wider than its share.
  expect(strip.match(new RegExp(rule('flex:1'), 'g'))).toHaveLength(5);
  expect(strip).toContain(rule('min-width:0px'));
  // The rule over the whole strip, and one at the left of the second through the fifth (e78–e81).
  expect(strip).toContain(rule('border-top-width:1px'));
  expect(strip.match(new RegExp(rule('border-left-width:1px'), 'g'))).toHaveLength(4);
  // `padding: 11px 0` — the figure sits 11 over and under, centred, with no side padding at all.
  // A themed sheet's rule is a class, so the numbers of a cell are read off the drawn node rather
  // than off the compiled sheet: `paddingVertical` is one value standing for both edges.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ShotCells cells={['ISO 400']} />);
  });
  const cell = tree.root
    .findAllByType(View)
    .find((one) => StyleSheet.flatten(one.props.style)?.flex === 1)!;
  expect(StyleSheet.flatten(cell.props.style)).toMatchObject({
    paddingVertical: 11,
    alignItems: 'center',
  });
  // `padding: 11px 0` — and nothing at the sides: the cells touch, split by the hairline.
  expect(StyleSheet.flatten(cell.props.style)?.paddingHorizontal).toBeUndefined();
  // The figure: 12 / 600 `muted`, tabular, the size the layout gives every figure that must not dance.
  expect(strip).toContain(rule('font-size:12px'));
  expect(strip).toContain(rule(`font-family:${font.semi}`));
  expect(strip).toContain(rule('color:rgba(164,161,178,1.00)'));
  expect(strip).toContain(rule('text-align:center'));
});

test('a cell with nothing in it is not drawn — and takes its hairline with it', () => {
  // The shutter was never stamped. Four cells, three hairlines: no empty fifth column holding its
  // place, and no rule left standing where the cell that wore it has gone.
  const four = story(<ShotCells cells={['ISO 400', '24 мм', '0 ev', null, '1/60 с']} />);
  expect(four.match(new RegExp(rule('flex:1'), 'g'))).toHaveLength(4);
  expect(four.match(new RegExp(rule('border-left-width:1px'), 'g'))).toHaveLength(3);
  // And the first cell drawn has no rule before it whichever of the five it is: here the ISO went.
  const noIso = story(<ShotCells cells={[null, '24 мм', '0 ev', 'f/1.8', '1/60 с']} />);
  expect(noIso.match(new RegExp(rule('border-left-width:1px'), 'g'))).toHaveLength(3);
  expect(noIso).not.toContain('ISO');

  // Nothing at all is no strip: a band with a rule over it and no figures in it claims the camera
  // wrote something here, which is the one thing this strip must never do.
  allDifferent({
    four: <ShotCells cells={['ISO 400', '24 мм', '0 ev', null, '1/60 с']} />,
    none: <ShotCells cells={[null, null, null, null, null]} />,
  });
  expect(story(<ShotCells cells={[null, null, null, null, null]} />)).toBe('');
});

test('the strip is read out as the one line it is, not as five figures', () => {
  // Five separate figures leave a screen reader to reassemble what the layout says in one breath.
  expect(story(<ShotCells cells={['ISO 400', null, '0 ev', null, '1/60 с']} />)).toContain(
    'aria-label="ISO 400 · 0 ev · 1/60 с"',
  );
});

test('the date row with nobody able to change it is the date and no words', () => {
  // `editMedia` answers 404 for a frame that is not the asker's own, so a row that offered the words
  // anyway would be words that refuse — the same answer `RowSummary` gives a fact it cannot lead
  // anywhere from, and the same one the chips give a box the api will not let this person file into.
  const row = story(<RowEdit value="13 сентября, 21:47" edit="Изменить" />);
  expect(row).toContain('13 сентября, 21:47');
  expect(row).not.toContain('Изменить');
  expect(row).not.toContain('role="button"');
});

test('a row nobody can press is not a button', () => {
  expect(story(<RowSummary label="Кадры" value="214 из 486" />)).not.toContain('role="button"');
  expect(story(<RowAction icon={Copy} label="Поделиться" />)).not.toContain('role="button"');
});
