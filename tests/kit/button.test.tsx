import { rule, shorthand } from '@tests/helpers/css';
import { fontFile, wordWidth } from '@tests/helpers/font';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Pause, Plus } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test } from 'vitest';

import { Button, type ButtonVariant, IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { font, setTheme } from '@/theme';

/** Every state of every button of spec 7.2, drawn once each. */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

const VARIANTS: ButtonVariant[] = [
  'primary',
  'paper',
  'secondary',
  'small',
  'outline',
  'raise',
  'quiet',
  'link',
  'danger',
  'dashed',
];

test('the ten buttons are ten different buttons', () => {
  allDifferent(
    Object.fromEntries(
      VARIANTS.map((variant) => [variant, <Button variant={variant} label="Смонтировать" />]),
    ),
  );
});

test('the main button is the only one carrying the accent and the shadow with it', () => {
  const primary = story(<Button variant="primary" label="Создать" />);
  // #4B5BFF, and the shadow spec 4 gives it — together, because a shadow without the fill would
  // make some other button look like the main one.
  expect(primary).toContain('rgba(75,91,255,1.00)');
  expect(primary).toContain('12px 32px');

  for (const variant of VARIANTS.filter((v) => v !== 'primary')) {
    expect(story(<Button variant={variant} label="Создать" />)).not.toContain('12px 32px');
  }
});

test('the dangerous button is filled and shadowless', () => {
  const solid = story(<Button variant="danger" label="Удалить" />);
  // #CE3028 under white — the fill of an irreversible action. The way out beside it is the outlined
  // `secondary`, and there is no outlined red: red means «навсегда» and is spent on one thing.
  expect(solid).toContain('rgba(206,48,40,1.00)');
  expect(solid).not.toContain('px 28px');
  expect(solid).not.toContain('px 32px');
});

test('a button that cannot be pressed says so, loses its fill and keeps its words', () => {
  for (const variant of VARIANTS) {
    const off = story(<Button variant={variant} label="Отправить" disabled />);
    expect(off).toContain('aria-disabled="true"');
    // `raise` and `faint` — spec 7.2 for every unavailable button, whatever it was before.
    expect(off).toContain('rgba(34,34,46,1.00)');
    expect(off).toContain('rgba(110,107,125,1.00)');
    expect(off).toContain('Отправить');
  }
});

test('a button waiting on the server swallows the press and says the action in the continuous', () => {
  const busy = story(<Button variant="primary" label="Отправить" busyLabel="Отправляем" busy />);
  expect(busy).toContain('Отправляем');
  expect(busy).not.toContain('>Отправить<');
  // It reads as disabled while it waits: React Native only speaks `busy` on Android, so on iOS the
  // button would otherwise announce itself live while it is swallowing every tap.
  expect(busy).toContain('aria-disabled="true"');
  // Without a continuous form the label simply stays — a word is the screen's to write.
  expect(story(<Button variant="primary" label="Отправить" busy />)).toContain('Отправить');
});

test('the dashed button is a hole rather than a thing, and it is square only where it is tall', () => {
  // Spec 7.2: 1px dashed `lineQuiet` (#3A3747) and no fill at all — «Новый лейбл» and «Свой трек».
  const big = story(<Button variant="dashed" label="Новый лейбл" />);
  expect(big).toContain('rgba(58,55,71,1.00)');
  expect(big).toContain('border-top-style:dashed');
  // 52 is a box with a 16 radius; 32 is a pill, like every chip in the row it stands in.
  expect(big).not.toBe(story(<Button variant="dashed" label="Свой трек" size="xxs" />));
  expect(story(<Button variant="primary" label="Создать" />)).not.toContain('dashed');
});

test('the dashed box of 52 carries its plus at 16 / 2.2, 8 from its words', () => {
  // `SheetLabels.json` e51–e52 (TASK-390): «Новый лейбл» 358 × 52 in a dashed `lineQuiet`, a plus of
  // 16 at stroke 2.2 at 138.1 and the words at 162.1 — 8 on. It had no plus at all, and the glyph
  // of a 52 is 18. The pill of 32, «Свой трек», keeps its own 14.
  const box = story(<Button variant="dashed" icon={Plus} label="Новый лейбл" />);
  expect(box).toContain('<svg data-glyph="Plus" width="16" height="16"');
  expect(box).toContain('stroke-width="2.2"');
  expect(box).toContain(rule('gap:8px'));
  expect(story(<Button variant="dashed" size="xxs" icon={Plus} label="Свой трек" />)).toContain(
    '<svg data-glyph="Plus" width="14" height="14"',
  );
});

test('the seven heights are seven heights, and each variant starts at its own', () => {
  allDifferent({
    // 60, and only «Выйти из аккаунта» stands at it.
    xl: <Button label="Дальше" size="xl" />,
    lg: <Button label="Дальше" size="lg" />,
    md: <Button label="Дальше" size="md" />,
    sm: <Button label="Дальше" size="sm" />,
    xs: <Button label="Дальше" size="xs" />,
    mini: <Button label="Дальше" size="mini" />,
    xxs: <Button label="Дальше" size="xxs" />,
  });
  // «Сбросить» stands at 36 without being told.
  expect(story(<Button variant="raise" label="Сбросить" />)).toBe(
    story(<Button variant="raise" label="Сбросить" size="mini" />),
  );
  // The main action stands at 56 and the small row button at 44 without being told.
  expect(story(<Button variant="primary" label="Дальше" />)).toBe(
    story(<Button variant="primary" label="Дальше" size="lg" />),
  );
  expect(story(<Button variant="small" label="Вернуть" />)).toBe(
    story(<Button variant="small" label="Вернуть" size="sm" />),
  );
});

test('the loud buttons run the width they are given and the quiet ones are as wide as their words', () => {
  expect(story(<Button variant="primary" label="Создать" />)).not.toBe(
    story(<Button variant="primary" label="Создать" wide={false} />),
  );
  expect(story(<Button variant="small" label="Вернуть" />)).not.toBe(
    story(<Button variant="small" label="Вернуть" wide />),
  );
});

test('the link is its words alone: 13 / 600 in accentText, underlined, as tall as its line', () => {
  // Spec 8, `Consent` — «Полный текст соглашения» is a link and not a button: Onest 13 / 600,
  // #A7AEFF, underlined, 17 tall (`Consent.json` e19). The finger's 44 grows round it.
  const link = story(<Button variant="link" label="Полный текст соглашения" />);
  expect(link).toContain('role="link"');
  expect(link).toContain('color:rgba(167,174,255,1.00)');
  const words = link.match(/class="([^"]*)"[^>]*>Полный текст соглашения</)?.[1] ?? '';
  expect(words).toContain(shorthand('textDecorationLine', 'text-decoration-line:underline'));
  expect(words).toContain(rule('font-size:13px'));
  expect(words).toContain(rule(`font-family:${font.semi}`));
  expect(link).toContain('min-height:16px');
  // No box round it: no sides, no hairline.
  expect(link).toContain(shorthand('paddingInline', 'padding-left:0px'));
  expect(link).toContain(shorthand('borderWidth', 'border-top-width:0px'));
  // The quiet button stays what it was: a 44 in muted, its words in the control's 16.
  const quiet = story(<Button variant="quiet" label="Позже" />);
  expect(quiet).toContain('min-height:44px');
  expect(quiet).toContain('color:rgba(164,161,178,1.00)');
  expect(quiet).not.toContain('role="link"');
});

test('a quiet button reads its words in paper only where the place names it', () => {
  // Spec 8, `LoginCode`: «Ещё раз» stands beside the muted «Отправили на …» and is #F5F3EE at 13 /
  // 600 (`LoginCode.json` e17). Unavailable, it is faint like any other.
  const again = story(
    <Button variant="quiet" labelRole="label" labelTone="paper" label="Ещё раз" />,
  );
  expect(again).toContain('color:rgba(245,243,238,1.00)');
  expect(again).not.toContain('color:rgba(164,161,178,1.00)');
  expect(story(<Button variant="quiet" labelTone="paper" label="Ещё раз" disabled />)).toContain(
    'color:rgba(110,107,125,1.00)',
  );
});

test('the raised button is lifted by its fill alone, and everything in it is a size down', () => {
  // Spec 8, `SheetFilter` — «Сбросить»: `raise` (#22222E) under `paper`, no ring round it, a 13
  // cross and the words in `label` 13 / 600.
  const raised = story(<Button variant="raise" label="Сбросить" icon={Plus} />);
  expect(raised).toContain('rgba(34,34,46,1.00)');
  expect(raised).toContain('rgba(245,243,238,1.00)');
  expect(raised).toContain('width="13"');
  expect(raised).toContain('min-height:36px');
  expect(story(<Button variant="small" label="Сбросить" icon={Plus} />)).toContain('width="18"');
});

test('a glyph can stand before the words or after them, and never instead of them', () => {
  allDifferent({
    bare: <Button variant="primary" label="Новое воспоминание" />,
    leading: <Button variant="primary" label="Новое воспоминание" icon={Plus} />,
    trailing: <Button variant="primary" label="Дальше" trailingIcon={Plus} />,
  });
  expect(story(<Button variant="primary" label="Новое воспоминание" icon={Plus} />)).toContain(
    'Новое воспоминание',
  );
});

test('the round button is drawn at the seven diameters the layout uses', () => {
  allDifferent(
    Object.fromEntries(
      [72, 56, 48, 44, 36, 32, 28].map((size) => [
        String(size),
        <IconButton icon={Plus} label="Фильтры" size={size} />,
      ]),
    ),
  );
  expect(story(<IconButton icon={Plus} label="Фильтры" size={48} />)).toContain('width:48px');
  // The glyph grows with the circle. The viewer's 72 is the one that needs it: the layout draws a
  // 26 in it, and 22 there reads as a plate with something small lost in the middle (TASK-181).
  expect(story(<IconButton icon={Plus} label="Пауза" size={72} />)).toContain('width="26"');
  expect(story(<IconButton icon={Plus} label="Закрыть" size={48} />)).toContain('width="22"');
  // And the 28 beside «Все дни» carries a 14 (spec 8), felt at 44 all the same (spec 10.2).
  const calendar = story(<IconButton icon={Plus} label="Выбрать другую дату" size={28} />);
  expect(calendar).toContain('width="14"');
  expect(calendar).toContain('width:28px');
});

test('every round tone is its own fill, and none of them is a word', () => {
  allDifferent({
    surface: <IconButton icon={Plus} label="Аккаунт" tone="surface" />,
    raise: <IconButton icon={Plus} label="Короче на 5 секунд" tone="raise" />,
    ghost: <IconButton icon={Plus} label="Назад" tone="ghost" />,
    outline: <IconButton icon={Plus} label="Выбрать другую дату" tone="outline" />,
    glass: <IconButton icon={Plus} label="Назад" tone="glass" />,
    viewer: <IconButton icon={Plus} label="Закрыть" tone="viewer" />,
    video: <IconButton icon={Plus} label="Пауза" tone="video" />,
    paper: <IconButton icon={Plus} label="Послушать" tone="paper" />,
    spark: <IconButton icon={Plus} label="Выбрать" tone="spark" />,
    danger: <IconButton icon={Plus} label="Удалить" tone="danger" />,
  });
  // The outlined one is ringed in `lineQuiet` (#3A3747), the chip's ring, and reads in `paper`.
  const outlined = story(<IconButton icon={Plus} label="Выбрать другую дату" tone="outline" />);
  expect(outlined).toContain('rgba(58,55,71,1.00)');
  expect(outlined).toContain('stroke="#F5F3EE"');
  // The label is the only thing a screen reader has: a glyph says nothing on its own.
  expect(story(<IconButton icon={Plus} label="Фильтры" />)).toContain('aria-label="Фильтры"');
});

test('the two glasses are two glasses, and both read their glyph in full voice', () => {
  // Spec 7.2: the bar over the feed is `ink` at 62% with a hairline of its own; the viewer's pane is
  // paper-tinted and has none — what shows through it is the frame itself.
  const bar = story(<IconButton icon={Plus} label="Назад" tone="glass" size={48} />);
  expect(bar).toContain('rgba(22,22,31,0.62)');
  expect(bar).toContain('rgba(255,255,255,0.09)');
  expect(bar).toContain('stroke="#F5F3EE"');

  const viewer = story(<IconButton icon={Plus} label="Закрыть" tone="viewer" size={48} />);
  expect(viewer).toContain('rgba(245,243,238,0.10)');
  expect(viewer).not.toContain('rgba(255,255,255,0.09)');
});

test('the pause over a video is dark and not glass: no hairline, and a 26 filled in paper', () => {
  // Spec 7.2, «над видео», and 10.10: `rgba(6,6,10,.5)`, no border and no blur — the viewer's glass
  // vanishes over a bright frame. The glyph is one of the three the set fills (spec 5).
  const pause = story(<IconButton icon={Pause} label="Пауза" size={72} tone="video" />);
  expect(pause).toContain('background-color:rgba(6,6,10,0.50)');
  expect(pause).not.toContain('rgba(245,243,238,0.10)');
  expect(pause).not.toContain('border-top-color');
  expect(pause).toContain('width="26"');
  expect(pause).toContain('stroke="#F5F3EE"');
  expect(pause).toContain('fill="#F5F3EE"');
  // A glass button keeps its glyph hollow.
  expect(story(<IconButton icon={Pause} label="Пауза" size={72} tone="viewer" />)).toContain(
    'fill="none"',
  );
});

test('«Смонтировать» is a 36 on paper with the plus the layout draws for it', () => {
  // Spec 8, detail 40 and 10.10: a 15 plus at stroke 2.2 before the words, 6 between them, 14 a
  // side, the words 13 / 600 in `ink` — the button does not go without the sign.
  const make = story(<Button variant="paper" size="mini" icon={Plus} label="Смонтировать" />);
  expect(make).toContain('min-height:36px');
  expect(make).toContain('<svg data-glyph="Plus" width="15" height="15" stroke="#0B0B12"');
  expect(make).toContain('stroke-width="2.2"');
  expect(make).toContain(rule('gap:6px'));
  expect(make).toContain(rule('padding-left:14px;padding-right:14px'));
  const words = make.match(/class="([^"]*)"[^>]*>Смонтировать</)?.[1];
  expect(words).toContain(rule('font-size:13px'));
  expect(words).toContain(rule(`font-family:${font.semi}`));
  // The full-size paper button keeps the glyph its size gives it.
  const full = story(<Button variant="paper" icon={Plus} label="Смонтировать" />);
  expect(full).toContain('width="19"');
  expect(full).not.toContain('stroke-width="2.2"');
});

test('a main 56 wears its glyph at 19 / 2.1, 9 from its words — and a place the layout names wears its own', () => {
  // Spec 7.2, detail 10: «иконка 19 (sw 2.1) со щелью 9» — `Main.html`: «Новое воспоминание», the
  // plus 19 at 2.1 in a `gap: 9px` row. It was the kit's 18 at 2, 8 from the words.
  const make = story(<Button variant="primary" icon={Plus} label="Новое воспоминание" />);
  expect(make).toContain('<svg data-glyph="Plus" width="19" height="19"');
  expect(make).toContain('stroke-width="2.1"');
  expect(make).toContain(rule('gap:9px'));
  // The 52 in a sheet keeps its 18 and its 8.
  const sheet = story(<Button variant="primary" size="md" icon={Plus} label="Позвать" />);
  expect(sheet).toContain('<svg data-glyph="Plus" width="18" height="18"');
  expect(sheet).not.toContain(rule('gap:9px'));
  // `MontageSummary`: «Начать монтаж» — panels-top-left 19 at 1.9 (spec 8), named for the place.
  const start = story(
    <Button
      variant="primary"
      icon={Plus}
      glyph={{ size: 19, stroke: 1.9 }}
      label="Начать монтаж"
    />,
  );
  expect(start).toContain('stroke-width="1.9"');
  expect(start).toContain(rule('gap:9px'));
});

/** The classes of the words a button draws: the element whose text is exactly `words`. */
const wordsOf = (markup: string, words: string) =>
  markup.match(new RegExp(`class="([^"]*)"[^>]*>${words}<`))?.[1] ?? '';

const ONEST_SEMI = fontFile('@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf');
/** How wide a button with a hairline comes out: its sides, its glyph and gap, its words. */
const across = (words: string, size: number, sides: number, glyph = 0) =>
  2 + 2 * sides + glyph + wordWidth(ONEST_SEMI, words, size);

test('a button standing in a row is 13 / 600 and 14 a side, and comes out as wide as the layout', () => {
  // TASK-384 (R6). Spec 7.2: «В строке — 36–40 … подпись `label`», and the outlined `small` is the
  // same shape at 44. Measured off the layout (`m28-mock-measure`): «Вернуть» on `SheetRejected` is
  // 82.5 wide, «Что сняли» on `MontageSelect` 93.95 — a hairline, 14 a side and the words at 13 / 600
  // (their width read here off the font file). At 16 and 20 a side, as they were, they ran 27–28 %
  // wider than drawn.
  expect(across('Вернуть', 13, 14)).toBeCloseTo(82.5, 0);
  expect(across('Что сняли', 13, 14)).toBeCloseTo(93.95, 0);
  expect(across('Вернуть', 16, 20)).toBeGreaterThan(82.5 * 1.25);

  const back = story(<Button size="xs" wide={false} label="Вернуть" />);
  const dropped = story(<Button variant="small" label="Что сняли" />);
  for (const [drawn, words] of [
    [back, 'Вернуть'],
    [dropped, 'Что сняли'],
  ] as const) {
    expect(drawn).toContain(rule('padding-left:14px;padding-right:14px'));
    expect(wordsOf(drawn, words)).toContain(rule('font-size:13px'));
    expect(wordsOf(drawn, words)).toContain(rule(`font-family:${font.semi}`));
  }
  expect(back).toContain('min-height:40px');
  expect(dropped).toContain('min-height:44px');
});

test('«Свой трек» is the 32 pill of the same kind: 12 a side, a 14 plus 6 from its words', () => {
  // `MontageMusic`: 110.84 wide — the hairline, 12 a side, the plus 14 at stroke 2.2, 6, and the
  // words at 13 / 600. Set at 16 with an 18 glyph it came out a third wider (146.7).
  expect(across('Свой трек', 13, 12, 14 + 6)).toBeCloseTo(110.84, 0);
  const own = story(
    <Button variant="dashed" size="xxs" wide={false} icon={Plus} label="Свой трек" />,
  );
  expect(own).toContain(rule('padding-left:12px;padding-right:12px'));
  expect(own).toContain(rule('gap:6px'));
  expect(own).toContain('<svg data-glyph="Plus" width="14" height="14"');
  expect(own).toContain('stroke-width="2.2"');
  expect(wordsOf(own, 'Свой трек')).toContain(rule('font-size:13px'));
});

test('the small one at 44 reads at 14 with a 16 glyph 7 from its words, the main ones stay at 16', () => {
  // Spec 8, `MontageLiveDone`: «Сохранить» and «Поделиться» are 44, 14 / 600, a 16 glyph with 7
  // between it and the words — at 16 they ran 14 % wider (TASK-384). The main 56 keeps its 16.
  const save = story(<Button variant="primary" size="sm" wide icon={Plus} label="Сохранить" />);
  expect(wordsOf(save, 'Сохранить')).toContain(rule('font-size:14px'));
  expect(save).toContain('<svg data-glyph="Plus" width="16" height="16"');
  expect(save).toContain(rule('gap:7px'));
  const main = story(<Button variant="primary" label="Дальше" />);
  expect(wordsOf(main, 'Дальше')).toContain(rule('font-size:16px'));
  expect(wordsOf(main, 'Дальше')).not.toContain(rule('font-size:14px'));
});

test('«Сохранить» at 44 is 18 a side and comes out 109 wide, as `Contacts` draws it', () => {
  // Spec 7.2 and 10.11: «малая 44 — «Сохранить» 14 / 600, поля `0 18`»; `Contacts.json` e16 is
  // 109.38 × 44. The layout's button has no border and ours a clear hairline, so the 18 is 17 and
  // that hairline. At the main button's 20 a side it came out 113.
  expect(across('Сохранить', 14, 17)).toBeCloseTo(109.38, 0);
  expect(across('Сохранить', 14, 20)).toBeGreaterThan(112);
  const save = story(<Button variant="primary" size="sm" wide={false} label="Сохранить" />);
  expect(save).toContain(rule('padding-left:17px;padding-right:17px'));
  expect(wordsOf(save, 'Сохранить')).toContain(rule('font-size:14px'));
});

test('the words of a button follow its height: 15 on a 52 and on the quiet 48 in a sheet, 14 on the quiet 44', () => {
  // Spec 3, `control` 14–17, measured off the layout: «Оставить» 52 (`SheetConfirmDelete.json` e7)
  // and «Разрешить доступ» 52 (`UploadAccess.json` e10) are 15 / 600; «Позже» and «Оставить как
  // есть» are the quiet 48 at 15 / 600 (`SheetTooLittle.json` e8, `SheetRejected.json` e22);
  // «Снять» is the quiet 44 at 14 / 600 (`UploadLimited.json` e22); «Новый лейбл», the dashed 52,
  // 14 / 600 (`SheetLabels.json` e51). They were all 16.
  const drawn: [ReactElement, string, number][] = [
    [<Button size="md" label="Оставить" />, 'Оставить', 15],
    [<Button variant="primary" size="md" label="Разрешить доступ" />, 'Разрешить доступ', 15],
    [<Button variant="quiet" size="ms" wide label="Позже" />, 'Позже', 15],
    [<Button variant="quiet" label="Снять" />, 'Снять', 14],
    [<Button variant="dashed" label="Новый лейбл" />, 'Новый лейбл', 14],
    // The main 56 keeps its 16.
    [<Button variant="primary" label="Дальше" />, 'Дальше', 16],
  ];
  for (const [button, words, px] of drawn) {
    const classes = wordsOf(story(button), words);
    expect(classes, words).toContain(rule(`font-size:${px}px`));
    for (const other of [14, 15, 16].filter((one) => one !== px))
      expect(classes, words).not.toContain(rule(`font-size:${other}px`));
  }
  expect(story(<Button variant="quiet" size="ms" wide label="Позже" />)).toContain(
    'min-height:48px',
  );
});

test('the outlined one in a row is ringed in lineQuiet, and stands at the row’s 36 as wide as its words', () => {
  // Spec 8, `MemorySettings` and `MemorySettings.json` e15: «Править состав» — 36, `0 14`, 13 / 600
  // `paper`, the pencil 14 / 1.8, and the ring #3A3747 — `lineQuiet`, not the `line` (#2C2C3A) of
  // the small one («Что сняли») nor the `lineStrong` (#45424F) of «Вернуть».
  const quietRing = 'border-top-color:rgba(58,55,71,1.00)';
  const edit = story(<Button variant="outline" icon={Plus} label="Править состав" />);
  expect(edit).toContain(quietRing);
  expect(edit).toContain('min-height:36px');
  expect(edit).toContain(rule('padding-left:14px;padding-right:14px'));
  expect(edit).toContain('<svg data-glyph="Plus" width="14" height="14"');
  expect(edit).toContain('stroke-width="1.8"');
  expect(wordsOf(edit, 'Править состав')).toContain(rule('font-size:13px'));
  expect(edit).toContain('color:rgba(245,243,238,1.00)');
  const small = story(<Button variant="small" size="mini" label="Править состав" />);
  const strong = story(<Button size="mini" wide={false} label="Править состав" />);
  expect(small).toContain('border-top-color:rgba(44,44,58,1.00)');
  expect(strong).toContain('border-top-color:rgba(69,66,79,1.00)');
  for (const other of [small, strong]) expect(other).not.toContain(quietRing);
});

test('a button in a row wears a 14 glyph at 1.8, and only «Смонтировать» its heavier plus', () => {
  // Spec 7.2 and 10.11: «кнопка в строке — знак 14 / 1.8»; «Править состав» — the pencil 14 / 1.8,
  // not 15 / 2.2 (`MemorySettings.json`), which is the plus of the paper «Смонтировать» alone.
  const edit = story(
    <Button variant="small" size="mini" wide={false} icon={Plus} label="Править" />,
  );
  expect(edit).toContain('<svg data-glyph="Plus" width="14" height="14"');
  expect(edit).toContain('stroke-width="1.8"');
  const more = story(<Button size="xs" wide={false} icon={Plus} label="Отдать ещё" />);
  expect(more).toContain('width="14"');
  expect(more).toContain('stroke-width="1.8"');
});

test('a round button that stays in is a switch, and one that fires is not', () => {
  const plain = story(<IconButton icon={Plus} label="Выбрать" />);
  expect(plain).toContain('role="button"');

  // Passing `on` at all is what makes it a switch — a button that does not toggle must not read as
  // an unticked box.
  const off = story(<IconButton icon={Plus} label="Выбрать" on={false} />);
  const held = story(<IconButton icon={Plus} label="Выбрать" on />);
  expect(off).toContain('role="togglebutton"');
  expect(held).toContain('role="togglebutton"');
  expect(off).not.toBe(held);
  // Spec 7.2 — held in: `accent`, a white hairline and the shadow that no other round button has.
  expect(held).toContain('rgba(75,91,255,1.00)');
  expect(held).toContain('6px 18px');
  expect(off).not.toContain('6px 18px');
});

test('a switch in the paper tone is held in on its paper, not on the accent', () => {
  // Spec 7.7, detail 53 — the tick of a track already taken: a switch like any other, and drawn
  // `paper` with an `ink` glyph, because the track is not going anywhere.
  const taken = story(
    <IconButton icon={Plus} label="Убрать «Тёплая» из выбранных" tone="paper" on />,
  );
  expect(taken).toContain('role="togglebutton"');
  expect(taken).toContain('rgba(245,243,238,1.00)');
  expect(taken).toContain('stroke="#0B0B12"');
  expect(taken).not.toContain('rgba(75,91,255,1.00)');
  expect(taken).not.toContain('6px 18px');
});

test('a round button standing on a fill of its own reads its glyph in full voice', () => {
  // Spec 7.2: `muted` belongs to the 36 and the 32 that stand on nothing; the account in the root
  // bar and the two at the foot of the gallery stand on `surface` and are read in `paper`.
  expect(story(<IconButton icon={Plus} label="Аккаунт" tone="surface" />)).toContain(
    'stroke="#F5F3EE"',
  );
  expect(story(<IconButton icon={Plus} label="Закрыть" size={36} />)).toContain('stroke="#A4A1B2"');
});

test('the spark dot says a setting has moved off its default, and is not a state of its own', () => {
  allDifferent({
    plain: <IconButton icon={Plus} label="Фильтры" tone="surface" />,
    dotted: <IconButton icon={Plus} label="Фильтры" tone="surface" dot />,
  });
  const off = story(<IconButton icon={Plus} label="Фильтры" disabled />);
  expect(off).toContain('aria-disabled="true"');
});

test('the spark dot is 9 of spark 10 inside the edge of a 56, and its ring lies outside the 9', () => {
  // `FramesByPeople` (design/screens/FramesByPeople.html): `right: 10px; top: 10px; width: 9px;
  // height: 9px; box-shadow: 0 0 0 2px` — the 9 is the spark, the ring is round it. The app drew a
  // 9 box with a 2 border inside it: a 5 of spark, 13 in.
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(<IconButton icon={Plus} label="Сортировка" size={56} tone="glass" dot />),
    );
  });
  const dot = tree.root
    .findAllByType(View)
    .map((one) => StyleSheet.flatten(one.props.style) as ViewStyle)
    .find((style) => style?.position === 'absolute');
  const ring = Number(dot?.borderWidth);
  expect(ring).toBe(2);
  expect(Number(dot?.width) - ring * 2).toBe(9);
  expect(Number(dot?.height) - ring * 2).toBe(9);
  expect(Number(dot?.top) + ring).toBe(10);
  expect(Number(dot?.right) + ring).toBe(10);
});

test('the spark dot is ringed in whatever it stands on, which is the button it sits inside', () => {
  // Spec 7.4. On the filled 56 at the foot of the gallery that is `surface` and nothing else — an
  // `ink` ring there is a hole cut in the button.
  const filled = story(<IconButton icon={Plus} label="Фильтры" size={56} tone="surface" dot />);
  expect(filled).not.toContain('rgba(11,11,18,1.00)');
  // With no fill under it the screen is what it stands on, and the screen is `ink`.
  expect(story(<IconButton icon={Plus} label="Фильтры" size={56} dot />)).toContain(
    'rgba(11,11,18,1.00)',
  );
});
