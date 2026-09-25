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
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

import {
  ActionBar,
  Avatar,
  BadgeDecision,
  BadgeFilms,
  BadgeMontage,
  Button,
  brokeWord,
  CardMemory,
  CardMontage,
  CardNow,
  EmptyMontages,
  IconButton,
  PosterOrder,
  StepNote,
  Text,
  TileTemplate,
} from '@/kit';

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
});
