import { expect, test, vi } from 'vitest';

// The phone, turned by the test: the iPhone SE zoomed to 320 on the largest type, where the words of
// the parts below broke letter by letter (TASK-375).
const { phone } = vi.hoisted(() => ({ phone: { width: 320, fontScale: 3.571 } }));

vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({
      width: phone.width,
      height: 568,
      scale: 2,
      fontScale: phone.fontScale,
    }),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { ArrowUpDown, Funnel } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import {
  ActionBar,
  Avatar,
  AvatarStack,
  BadgeDecision,
  BadgeFilms,
  BadgeMontage,
  BlockPicked,
  Button,
  brokeWord,
  CardMemory,
  CardMontage,
  CardNow,
  EmptyMontages,
  IconButton,
  PosterOrder,
  RowContact,
  RowTrack,
  Shares,
  StepNote,
  Text,
  Tile,
  TileNumber,
  TileTemplate,
  Upload,
  wholeAt,
} from '@/kit';
import { type } from '@/theme';

/**
 * TASK-375 — the parts whose words share a line with something else — round buttons, a badge, a
 * stack of photos, the other half of a grid — stand the drawn way until one of their words breaks
 * mid-word, and the roomier way from then on (`useWordRoom`). The phone says a word broke through
 * `onTextLayout`, which is what these tests hand the parts: the lines as the phone laid them out.
 */

mountsTrees();

/** «Добавить ещё» as the phone lays it out: whole on two lines, and torn letter by letter at 320. */
const WHOLE = [{ text: 'Добавить ' }, { text: 'ещё' }];
const TORN = [
  { text: 'До' },
  { text: 'ба' },
  { text: 'ви' },
  { text: 'ть ' },
  { text: 'ещ' },
  { text: 'ё' },
];

test('a word is broken where two lines meet with no space, hyphen or dash between them', () => {
  expect(brokeWord(WHOLE)).toBe(false);
  expect(brokeWord([{ text: 'Добавить ещё' }])).toBe(false);
  expect(brokeWord([{ text: 'чёрно-' }, { text: 'белый' }])).toBe(false);
  expect(brokeWord([{ text: '12 —' }, { text: '14 сентября' }])).toBe(false);
  expect(brokeWord([{ text: 'Новый\n' }, { text: 'ролик' }])).toBe(false);
  expect(brokeWord([{ text: 'Свадьба' }, { text: ' Лизы' }])).toBe(false);
  expect(brokeWord(TORN)).toBe(true);
  expect(brokeWord([{ text: 'Официал' }, { text: 'ьный отчёт' }])).toBe(true);
});

const flat = (node: ReactTestInstance) => {
  const { style } = node.props;
  return StyleSheet.flatten(
    typeof style === 'function' ? style({ pressed: false }) : style,
  ) as ViewStyle;
};

/** The box a part is laid out in: the nearest `View` it stands in, past the markup `View` draws. */
const box = (one: ReactTestInstance) => {
  let up = one.parent;
  while (up && up.type !== View) up = up.parent;
  return up as ReactTestInstance;
};

async function draw(element: ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(element));
  });
  return tree;
}

/** The phone laying out every kit text in the tree that listens for it, as `lines`. */
async function layOut(tree: TestRenderer.ReactTestRenderer, lines: { text: string }[]) {
  const handlers = tree.root
    .findAll((one) => typeof one.props.onTextLayout === 'function')
    .map((one) => one.props.onTextLayout as (event: unknown) => void);
  expect(handlers.length).toBeGreaterThan(0);
  await act(async () => {
    for (const handler of handlers) handler({ nativeEvent: { lines } });
  });
}

const bottomLayer = () => (
  <ActionBar
    footer="gallery"
    start={<IconButton icon={Funnel} label="Фильтры" size={56} />}
    end={<IconButton icon={ArrowUpDown} label="Порядок" size={56} />}
  >
    <Button variant="primary" wide label="Добавить ещё" />
  </ActionBar>
);

test('the foot of the gallery stands three across until the action’s words break, then the round two go over it', async () => {
  phone.fontScale = 3.571;
  const tree = await draw(bottomLayer());
  const parts = () => ({
    round: tree.root.findAllByType(IconButton),
    action: tree.root.findByType(Button),
  });
  // Drawn as the layout has it: 56 · the action · 56, one row.
  expect(parts().round.map(box)).toEqual([box(parts().action), box(parts().action)]);

  // Words that wrap at their space change nothing.
  await layOut(tree, WHOLE);
  expect(box(parts().round[0])).toBe(box(parts().action));

  // «До / ба / ви / ть» — the round two stand in a row of their own over the action, which takes the
  // whole width, and both ends of the row are still the round ones.
  await layOut(tree, TORN);
  const { round, action } = parts();
  expect(box(round[0])).toBe(box(round[1]));
  expect(box(round[0])).not.toBe(box(action));
  expect(flat(box(round[0])).justifyContent).toBe('space-between');
  // Over it, not under: the action keeps the foot of the layer.
  const layer = box(box(action));
  expect(box(box(round[0]))).toBe(layer);
  const rows = layer.findAll((one) => one.type === View && box(one) === layer);
  expect(rows.indexOf(box(round[0]))).toBeLessThan(
    rows.findIndex((one) => one.findAllByType(Button).length > 0),
  );
  // Once there, the words are whole, and that does not bring the row back.
  await layOut(tree, WHOLE);
  expect(box(parts().round[0])).not.toBe(box(parts().action));

  // Another type size is another question: the layer stands as drawn and asks again.
  phone.fontScale = 2;
  await act(async () => tree.update(bottomLayer()));
  expect(box(parts().round[0])).toBe(box(parts().action));
  phone.fontScale = 3.571;
});

test('a bottom layer with one action has nothing to rearrange, whatever its words do', async () => {
  const tree = await draw(
    <ActionBar>
      <Button variant="primary" wide label="Новое воспоминание" />
    </ActionBar>,
  );
  // No round ones either side: the words are not asked, so nothing listens for them.
  expect(tree.root.findAll((one) => typeof one.props.onTextLayout === 'function')).toHaveLength(0);
});

test('a template whose name breaks a word in its half of the grid takes the whole row', async () => {
  const tree = await draw(
    <TileTemplate
      title="Официальный отчёт"
      note="Ровно, по порядку"
      spec="4:00 · 16:9"
      style={{ flexGrow: 1, width: '40%' }}
      onPress={() => {}}
    />,
  );
  const tile = () => flat(tree.root.findByType(Pressable));
  expect(tile().width).toBe('40%');
  // At its own size the tile is the layout's 118, as a floor.
  expect(tile().minHeight).toBe(118);
  expect(tile().height).toBeUndefined();
  await layOut(tree, [{ text: 'Официал' }, { text: 'ьный' }, { text: 'отчёт' }]);
  // A width and never a basis: Yoga keeps the basis it first worked out for a node, and a tile
  // told a new one on the phone stays where it was.
  expect(tile().width).toBe('100%');
  expect(tile().flexBasis).toBeUndefined();
});

test('the names and lines on the cards of films and templates wrap by the word, never cut', async () => {
  // The layout's own markup wraps them (`MontageTemplate`, `MemoryFrames`); cut to a line, «Личное,
  // бе…» and «Ролик о…» were what large type left of them.
  const tree = await draw(
    <View>
      <TileTemplate title="Официальный отчёт" note="Ровно, по порядку" spec="4:00 · 16:9" />
      <CardMontage state="ready" title="Ролик на 1:00" meta="14 сентября · Тёплая" />
      <CardMontage state="pending" title="Ролик на 2:00" step={{ at: 3, of: 5, count: '3 из 5' }} />
    </View>,
  );
  for (const words of [
    'Официальный отчёт',
    'Ровно, по порядку',
    'Ролик на 1:00',
    '14 сентября · Тёплая',
    'Ролик на 2:00',
  ])
    expect(
      tree.root.find((one) => one.type === Text && one.props.children === words).props
        .numberOfLines,
      words,
    ).toBeUndefined();
});

test('the ordinary card puts its films badge under a name that broke a word beside it', async () => {
  const tree = await draw(
    <CardMemory
      title="Корпоратив Nox"
      meta={['3 октября', '12 кадров']}
      thumbs={['a.jpg']}
      films={<BadgeFilms label="2 ролика" />}
      onPress={() => {}}
    />,
  );
  const whole = () =>
    tree.root.findAll(
      (one) => one.type === View && flat(one).width === '100%' && flat(one).flexBasis === undefined,
    );
  expect(whole()).toHaveLength(0);
  await layOut(tree, [{ text: 'Корпорат' }, { text: 'ив Nox' }]);
  expect(whole()).toHaveLength(1);
  expect(whole()[0].findAllByType(BadgeFilms)).toHaveLength(0);
});

test('a finished film in the strip stands its circle over its words once a word beside it breaks', async () => {
  const tree = await draw(
    <CardMontage
      state="ready"
      title="Ролик на 1:00"
      meta="14 сентября · Горизонтальный"
      badge={<BadgeMontage sm state="ready" label="Готов" />}
    />,
  );
  const line = () =>
    box(box(tree.root.find((one) => one.type === Text && one.props.children === 'Ролик на 1:00')));
  expect(flat(line()).flexDirection).toBe('row');
  await layOut(tree, [{ text: '14 сентября · ' }, { text: 'Горизонтальн' }, { text: 'ый' }]);
  expect(flat(line()).flexDirection).toBe('column');
  // And the badge over the poster is in the card's flow, so words grown with the type push the card
  // down instead of running under it.
  expect(flat(box(tree.root.findByType(BadgeMontage))).position).toBeUndefined();
});

test('the empty films block stands its frames over its words once «Смонтировать» breaks', async () => {
  const tree = await draw(
    <EmptyMontages text="Нейросеть выберет лучшие моменты" photos={['a.jpg', 'b.jpg']}>
      <Button variant="paper" size="mini" label="Смонтировать" />
    </EmptyMontages>,
  );
  const block = () => flat(tree.root.findAllByType(View)[0]);
  expect(block().flexDirection).toBe('row');
  expect(block().minHeight).toBe(132);
  expect(block().height).toBeUndefined();
  await layOut(tree, [{ text: 'Смонтироват' }, { text: 'ь' }]);
  expect(block().flexDirection).toBe('column');
});

test('a record under a stage puts its mark under the thought once the thought breaks a word beside it', async () => {
  const tree = await draw(
    <StepNote
      text="Вносят торт — главный момент вечера"
      mark={<BadgeDecision kind="take" label="Беру 0:02–0:06" />}
    />,
  );
  const thought = () =>
    box(
      tree.root.find(
        (one) => one.type === Text && one.props.children === 'Вносят торт — главный момент вечера',
      ),
    );
  expect(thought().findAllByType(BadgeDecision)).toHaveLength(0);
  await layOut(tree, [{ text: 'Вносят торт — гла' }, { text: 'вный' }]);
  expect(thought().findAllByType(BadgeDecision)).toHaveLength(1);
});

test('the plates on the frame on air share a line that wraps, and none of them floats over another', async () => {
  const tree = await draw(
    <CardNow
      uri="a.jpg"
      author="Лиза Морозова"
      authorLine="Лиза Морозова · 12 сентября, 10:35"
      now="СЕЙЧАС"
      who="Режиссёр"
      standing="решил"
      decision={<BadgeDecision kind="take" label="Взял 1 из 2" />}
      thought="Вносят торт."
    />,
  );
  const now = tree.root.find((one) => one.type === Text && one.props.children === 'СЕЙЧАС');
  const row = box(box(now));
  expect(flat(row).flexWrap).toBe('wrap');
  const plates = row.findAll((one) => one.type === View && box(one) === row);
  expect(plates).toHaveLength(2);
  for (const plate of plates) expect(flat(plate).position).toBeUndefined();
});

test('the length on the summary poster is never squeezed by the shape beside it', async () => {
  const tree = await draw(
    <PosterOrder length="2:30" shape="Горизонтальный" about="16:9 · Свадьба Лизы и Марка" />,
  );
  const length = tree.root.find((one) => one.type === Text && one.props.children === '2:30');
  const style = flat(length);
  // As wide as its figure at least (`flexGrow`), never `flex: 1` down to nothing; the shape goes
  // under it when the two do not share the line.
  expect(style.flexGrow).toBe(1);
  expect(style.flexBasis).toBeUndefined();
  expect(flat(box(length)).flexWrap).toBe('wrap');
  expect(flat(tree.root.findAllByType(View)[0]).minHeight).toBe(136);
});

test('the initials are part of the circle and keep to its size, whatever the type', async () => {
  const tree = await draw(<Avatar name="Борис Носов" size={38} />);
  expect(tree.root.findByType(Text).props.maxFontSizeMultiplier).toBe(1);
  // And so is the «+N» closing a stack: at ×2 «+12» ran past its 36 onto the circle beside it.
  const stack = await draw(<AvatarStack names={['Аня', 'Марк', 'Лиза', 'Ира', 'Пётр']} />);
  const letters = stack.root.findAllByType(Text);
  expect(letters.map((one) => one.props.children)).toContainEqual(['+', 2]);
  for (const one of letters) expect(one.props.maxFontSizeMultiplier).toBe(1);
});

/**
 * TASK-400 — the last resort, for words that break even where the part has no roomier way left, or
 * that stand in no such part: they grow no further than their line holds the widest of them whole.
 * The phone reports each line with its width, and what broke is found where two lines meet mid-word.
 */
test('a broken word is found where it broke, and the words are set as far as the line holds it', () => {
  // «Приглашение» at the largest type on 320, the line 248: «Приглаше» fills it, «ние» starts the next.
  const torn = [
    { text: 'Приглаше', width: 247.5 },
    { text: 'ние не ', width: 150 },
    { text: 'действует', width: 230 },
  ];
  // The word is the whole first line and three letters of the six of the second: 247.5 + 75 — and
  // 2% to spare, for the rounding of the phone's measures.
  expect(wholeAt(torn, 1.39)).toBeCloseTo((1.39 * 0.98 * 247.5) / 322.5, 3);
  // Words that wrap at their spaces and dashes change nothing.
  expect(
    wholeAt(
      [
        { text: 'Приглашение ', width: 247 },
        { text: 'не действует', width: 190 },
      ],
      1.39,
    ),
  ).toBeUndefined();
  expect(wholeAt([{ text: 'Добавить ещё', width: 200 }], 2)).toBeUndefined();
  // A piece guessed short is still a step down, never the same size again.
  expect(
    wholeAt(
      [
        { text: 'Проявляем', width: 100 },
        { text: '…', width: 1 },
      ],
      2,
    ),
  ).toBeCloseTo(1.9, 5);
  // And a line with no width told is a step down too, never an answer that is not a number.
  expect(wholeAt(TORN as never, 2)).toBeCloseTo(1.9, 5);
});

/**
 * How far the words grow on this phone (×3.571): the platform's own text under the kit's, its size
 * against the role's, times the growth it is let have. Set smaller, the words are drawn at their
 * grown size and let grow no further — a lower cap alone is kept out of React Native's measure cache.
 */
const drawnOf = (tree: TestRenderer.ReactTestRenderer, words: string) =>
  tree.root
    .find((one) => one.type === Text && one.props.children === words)
    .findAll((one) => one.type !== Text && typeof one.props.maxFontSizeMultiplier === 'number')[0]
    .props;
const grows = (tree: TestRenderer.ReactTestRenderer, words: string) => {
  const kit = tree.root.find((one) => one.type === Text && one.props.children === words);
  const drawn = drawnOf(tree, words);
  const size = (style: unknown) => (StyleSheet.flatten(style as never) as TextStyle).fontSize ?? 0;
  const own = size([type[(kit.props.role ?? 'body') as keyof typeof type], kit.props.style]);
  return (size(drawn.style) / own) * Math.min(phone.fontScale, drawn.maxFontSizeMultiplier);
};

test('a heading in the wide face that breaks a word grows only as far as its line holds it, and never under its size', async () => {
  const words = 'Приглашение не действует';
  const tree = await draw(<Text role="emptyTitle">{words}</Text>);
  expect(grows(tree, words)).toBe(1.39);
  await layOut(tree, [
    { text: 'Приглаше', width: 247.5 },
    { text: 'ние не ', width: 150 },
    { text: 'действует', width: 230 },
  ] as never);
  const settled = grows(tree, words);
  expect(settled).toBeCloseTo((1.39 * 0.98 * 247.5) / 322.5, 3);
  // Set at that size and let grow no further — not only capped there: React Native measures a text
  // by its size and not by its cap, and a cap alone kept the box as tall as the torn lines.
  expect(drawnOf(tree, words).maxFontSizeMultiplier).toBe(1);
  expect(StyleSheet.flatten(drawnOf(tree, words).style).lineHeight).toBeCloseTo(28 * settled, 3);
  // Whole at that size, it stays there.
  await layOut(tree, [
    { text: 'Приглашение ', width: 230 },
    { text: 'не действует', width: 200 },
  ] as never);
  expect(grows(tree, words)).toBe(settled);
  // Torn again at it, it steps down again — and the spec's own size is the floor.
  for (let i = 0; i < 40; i += 1)
    await layOut(tree, [
      { text: 'Пригла', width: 247 },
      { text: 'шение', width: 200 },
    ] as never);
  expect(grows(tree, words)).toBe(1);
});

test('a cap a cell measures once its words are drawn reaches the phone as their size', async () => {
  // `fitCell` — a day of the calendar, a ready length on the slider — knows its room only once laid
  // out, so its cap lands on «28» already drawn at the role's ×2. React Native's measure cache keys
  // on the size and not on the cap: the cap alone drew the figure at ×1.78 in the box of ×2.
  const cell = (most?: number) => (
    <Text role="bodySm" maxFontSizeMultiplier={most}>
      28
    </Text>
  );
  const tree = await draw(cell());
  expect(grows(tree, '28')).toBe(2);
  await act(async () => tree.update(cell(1.78)));
  expect(grows(tree, '28')).toBeCloseTo(1.78, 5);
  const drawn = StyleSheet.flatten(drawnOf(tree, '28').style);
  expect(drawn.fontSize).toBeCloseTo(15 * 1.78, 5);
  expect(drawn.lineHeight).toBeCloseTo(22 * 1.78, 5);
  // A cap over the phone's own size holds nothing back, and changes nothing drawn.
  await act(async () => tree.update(cell(4)));
  expect(StyleSheet.flatten(drawnOf(tree, '28').style).fontSize).toBe(15);
});

test('running text asks nothing of its lines unless it stands in a box that cannot widen', async () => {
  // A second layout of every paragraph is what listening costs; only what can break a word listens.
  const plain = await draw(<Text role="body">Абзац</Text>);
  expect(plain.root.findAll((one) => typeof one.props.onTextLayout === 'function')).toHaveLength(0);
  const fitted = await draw(
    <Text role="meta" fit>
      Проявляем…
    </Text>,
  );
  await layOut(fitted, [
    { text: 'Проявля', width: 107 },
    { text: 'ем…', width: 30 },
  ] as never);
  expect(grows(fitted, 'Проявляем…')).toBeLessThan(2);
  // A contact's «@nick» has no space to wrap at either: torn beside the circle, it grows less.
  const contact = await draw(<RowContact name="Александра Морозова" handle="@alexandra.moroz" />);
  await layOut(contact, [
    { text: '@alexandra.mo', width: 230 },
    { text: 'roz', width: 50 },
  ] as never);
  expect(grows(contact, '@alexandra.moroz')).toBeLessThan(2);
  // «Remember» shrinks to fit its one line, and the bar's headings do not grow: neither listens.
  for (const role of ['hero', 'barTitle', 'pillTitle'] as const) {
    const one = await draw(<Text role={role}>Remember</Text>);
    expect(
      one.root.findAll((node) => typeof node.props.onTextLayout === 'function'),
      role,
    ).toHaveLength(0);
  }
});

test('things in equal shares stand side by side until a word in one breaks, then one under another', async () => {
  const shared = () => (
    <Shares>
      <Button variant="primary" size="sm" wide label="Сохранить" />
      <Button size="sm" wide label="Поделиться" />
    </Shares>
  );
  const tree = await draw(shared());
  const buttons = () => tree.root.findAllByType(Button);
  const row = () => flat(box(box(buttons()[0])));
  // As drawn: one row, each button in a share of its own.
  expect(row().flexDirection).toBe('row');
  expect(buttons().map((one) => flat(box(one)).flex)).toEqual([1, 1]);
  expect(box(box(buttons()[0]))).toBe(box(box(buttons()[1])));
  // «Сохрани / ть»: one under another, each the whole width — by stretching, never by a basis.
  await layOut(tree, TORN);
  expect(row().flexDirection).toBe('column');
  for (const one of buttons()) {
    expect(flat(box(one)).alignSelf).toBe('stretch');
    expect(flat(box(one)).flexBasis).toBeUndefined();
  }
  // Stacked and still torn — the smallest phone, the largest type: the words grow less instead.
  const label = 'Поделиться';
  const before = grows(tree, label);
  await layOut(tree, [
    { text: 'Поделит', width: 280 },
    { text: 'ься', width: 60 },
  ] as never);
  expect(grows(tree, label)).toBeLessThan(before);
  // Another type size is another question: the row stands as drawn and asks again.
  phone.fontScale = 2;
  await act(async () => tree.update(shared()));
  expect(row().flexDirection).toBe('row');
  phone.fontScale = 3.571;
});

test('words beside a count or a length move it under themselves, and a tile’s caption fits its tile', async () => {
  // «Отпр / авляе / м» beside «Осталось 9 файлов», «ВЫБ / РАН / О» beside «ничего не добавлено»,
  // «Спокой…» beside «2:05» (TASK-400): the row wraps, and the words grow from their own width —
  // never `flex: 1`, whose basis of 0 keeps the neighbour on their line and squeezes them instead.
  const tree = await draw(
    <View>
      <Upload title="Отправляем" meta="Осталось 9 файлов" value={0.3} />
      <BlockPicked
        title="Выбрано"
        count="ничего не добавлено"
        empty={{ title: 'Ролик будет без музыки', note: 'Только живой звук из видео' }}
      />
      <RowTrack title="Спокойная" length="2:05" picked />
    </View>,
  );
  for (const words of ['Отправляем', 'ВЫБРАНО', 'Спокойная']) {
    const text = tree.root.find((one) => one.type === Text && one.props.children === words);
    expect(flat(box(text)).flexWrap, words).toBe('wrap');
    expect(flat(text).flex, words).toBeUndefined();
    expect(text.props.numberOfLines, words).toBeUndefined();
  }
  // A developing frame's tile is a third of the screen whatever the type: its word grows less.
  const tile = await draw(<Tile state="processing" lane="feed" caption="Проявляем…" />);
  expect(
    tile.root.find((one) => one.type === Text && one.props.children === 'Проявляем…').props.fit,
  ).toBe(true);
});

test('the number tiles fill their shares, so three stand even whatever each one wraps to', async () => {
  const tree = await draw(
    <Shares>
      <TileNumber figure="214" label="просмотрел" />
      <TileNumber figure="3" label="части" />
      <TileNumber figure="21" label="склейки" />
    </Shares>,
  );
  const tiles = tree.root.findAllByType(TileNumber);
  expect(tiles).toHaveLength(3);
  for (const tile of tiles) {
    const face = flat(tile.findAllByType(View)[0]);
    expect(face.flexGrow).toBe(1);
    expect(face.flex).toBeUndefined();
  }
  await layOut(tree, [
    { text: 'просмот', width: 60 },
    { text: 'рел', width: 30 },
  ] as never);
  expect(flat(box(box(tiles[0]))).flexDirection).toBe('column');
});
