import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Text as RNText, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test, vi } from 'vitest';

import { Divider } from '@/kit/bits';
import { IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { BlockStuck, type StuckLine, Upload } from '@/kit/upload';
import { setTheme, themes, type } from '@/theme';

/** Spec 7.6 — sending: the block that counts it down, and the block for the files that will not go. */

mountsTrees();

beforeAll(async () => {
  await setTheme('dark');
});

test('the sending block says what is going, how much is left, and that the phone can be put away', () => {
  const block = story(
    <Upload
      title="Отправляем"
      meta="Осталось 9 файлов"
      value={0.26}
      hint="Приложение можно свернуть — отправка продолжится"
    />,
  );
  expect(block).toContain('Отправляем');
  expect(block).toContain('Осталось 9 файлов');
  expect(block).toContain('Приложение можно свернуть — отправка продолжится');
  expect(block).toContain('width:26%');
});

test('the line under the bar is 12 / 400 / 16 `muted` and one line, not the meta’s 500 in two', () => {
  // `UploadQueue.json` e10: «Приложение можно свернуть — отправка продолжится.» Onest 12 / 400,
  // 324 × 16 — at the meta's 500 it measures 327 and broke under the block's 324. Spec detail 48 and
  // 10.11 read it in `muted` #A4A1B2, not the layout's `faint` #6E6B7D (under the floor, 10.1).
  const block = story(
    <Upload
      title="Отправляем"
      value={0}
      hint="Приложение можно свернуть — отправка продолжится."
    />,
  );
  expect([type.noteSm.fontSize, type.noteSm.lineHeight]).toEqual([12, 16]);
  expect(block).toContain(rule(`font-family:${type.noteSm.fontFamily}`));
  expect(block).toContain(rule('color:rgba(164,161,178,1.00)'));
  expect(block).not.toContain(rule('color:rgba(110,107,125,1.00)'));
});

test('«Осталось 9 файлов» is 13 / 600 `muted`, and the block round it is 16 in, 12 between', () => {
  // Spec detail 48 and `UploadQueue.json`: the block 358 × 101 from 124 (e5), «Отправляем» at 141
  // (e6: 1 + 16 in), «Осталось 9 файлов» Onest 13 / 600 `#A4A1B2` (e7) — not the meta's 12 / 500 —
  // the bar 6 at 174 (e8), the line under it at 192 (e10): 12 between each — and the 101 is
  // 1 + 16 + 21 + 12 + 6 + 12 + 16 + 16 + 1, «Отправляем» on the spec's 21 line (`subtitle` 17 / 21).
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(
        <Upload title="Отправляем" meta="Осталось 9 файлов" value={0.26} hint="Можно свернуть" />,
      ),
    );
  });
  const count = tree.root
    .findAllByType(RNText)
    .find((one) => one.props.children === 'Осталось 9 файлов')!;
  expect(StyleSheet.flatten(count.props.style)).toMatchObject({
    fontFamily: 'Onest_600SemiBold',
    fontSize: 13,
    color: themes.dark.color.muted,
  });
  const block = StyleSheet.flatten(
    tree.root.findAllByType(View).find((one) => StyleSheet.flatten(one.props.style)?.padding)!.props
      .style,
  ) as ViewStyle;
  expect(block).toMatchObject({ padding: 141 - 124 - 1, gap: 192 - 174 - 6, borderWidth: 1 });
  const inset = Number(block.padding) + Number(block.borderWidth);
  const lines = Number(type.subtitleDisplay.lineHeight) + 6 + Number(type.noteSm.lineHeight);
  expect(inset * 2 + lines + Number(block.gap) * 2).toBe(101);
});

test('going and paused are the same block saying two different things under the bar', () => {
  // Paused is not a state of its own: the bar stops where it is and the line says why. A bar that
  // went backwards, or a block that vanished when the signal did, would both lie about the disk.
  allDifferent({
    going: (
      <Upload
        title="Отправляем"
        meta="Осталось 9 файлов"
        value={0.26}
        hint="Приложение можно свернуть — отправка продолжится"
      />
    ),
    paused: (
      <Upload
        title="Отправляем"
        meta="Осталось 9 файлов"
        value={0.26}
        hint="Продолжим, когда появится связь"
      />
    ),
  });
});

/** A line of the stuck block, with its cross wired to nothing. */
const line = (count: string, reason: string, onDrop = () => {}): StuckLine => ({
  key: reason,
  count,
  reason,
  dropLabel: `Убрать ${count} из очереди`,
  onDrop,
});

test('the files that did not go are one block: how many, and why, in technical words a person can act on', () => {
  const stuck = story(
    <BlockStuck
      lines={[
        line('7 файлов', 'Связь с хранилищем оборвалась'),
        line('2 файла', 'Хранилище отказало (503)'),
      ]}
    />,
  );
  expect(stuck).toContain('7 файлов');
  expect(stuck).toContain('Связь с хранилищем оборвалась');
  expect(stuck).toContain('Хранилище отказало (503)');
  expect(stuck).toContain('aria-label="Убрать 2 файла из очереди"');
});

test('each line of the stuck block keeps the layout’s row: 12 / 14 round it, the count 3 over its reason, the cross 36 with a 16 glyph', () => {
  // `UploadQueue.json`: the row e13 at 16, 267 (358 × 70) — 1 of edge and 14 at the side, 12 on
  // top; the name e15 (14 / 600, 18 tall at 283.5) and the reason e16 at 304.5; the cross e17
  // 36 × 36 with its glyph e18 16 × 16. One edge round the block now, and a line inside it per reason.
  const onDrop = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(
        <BlockStuck
          lines={[
            line('3 файла', 'Больше нет на этом телефоне', onDrop),
            line('1 файл', 'Хранилище отказало'),
          ]}
        />,
      ),
    );
  });
  const views = tree.root.findAllByType(View).map((one) => StyleSheet.flatten(one.props.style));
  const [block] = views;
  expect(block).toMatchObject({ borderWidth: 1, paddingHorizontal: 31 - 16 - 1 });
  expect(views.filter((one) => one?.paddingVertical === 280 - 267 - 1)).toHaveLength(2);
  expect(views.find((one) => one?.flex === 1)!.gap).toBe(304.5 - (283.5 + 18));
  expect(tree.root.findAllByType(Text).map((one) => one.props.role)).toEqual([
    'rowSm',
    'meta',
    'rowSm',
    'meta',
  ]);
  expect([type.rowSm.fontSize, type.rowSm.lineHeight]).toEqual([14, 18]);
  const [cross] = tree.root.findAllByType(IconButton);
  expect(cross.props.size).toBe(36);
  expect(cross.props.glyph).toEqual({ size: 16 });
  expect(cross.props.label).toBe('Убрать 3 файла из очереди');
  act(() => cross.props.onPress());
  expect(onDrop).toHaveBeenCalledTimes(1);
});

test('one reason is one line and several are a hairline apart, all inside the one edge', () => {
  allDifferent({
    one: <BlockStuck lines={[line('7 файлов', 'Связь с хранилищем оборвалась')]} />,
    several: (
      <BlockStuck
        lines={[
          line('7 файлов', 'Связь с хранилищем оборвалась'),
          line('2 файла', 'Больше нет на этом телефоне'),
        ]}
      />
    ),
  });
  let several!: TestRenderer.ReactTestRenderer;
  act(() => {
    several = mounted(
      TestRenderer.create(
        <BlockStuck
          lines={[
            line('7 файлов', 'Связь с хранилищем оборвалась'),
            line('2 файла', 'Больше нет на этом телефоне'),
            line('1 файл', 'Хранилище отказало'),
          ]}
        />,
      ),
    );
  });
  expect(several.root.findAllByType(Divider)).toHaveLength(2);
  const edges = several.root
    .findAllByType(View)
    .filter(
      (one) => StyleSheet.flatten(one.props.style)?.borderColor === themes.dark.color.dangerEdge,
    );
  expect(edges).toHaveLength(1);
});
