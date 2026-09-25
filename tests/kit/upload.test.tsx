import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { ImageIcon } from 'lucide-react-native';
import { Text as RNText, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test, vi } from 'vitest';

import { IconButton } from '@/kit/button';
import { Icon } from '@/kit/icon';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { RowStuck, Upload } from '@/kit/upload';
import { setTheme, themes, type } from '@/theme';

/** Spec 7.6 — sending: the block that counts it down, and the row for a file that will not go. */

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

test('a stuck file names the reason in technical words, because a person can act on them', () => {
  const stuck = story(
    <RowStuck
      name="IMG_4821.HEIC"
      reason="Хранилище отказало на части 3 (503)"
      uri="https://b/1.jpg"
      dropLabel="Убрать IMG_4821.HEIC из очереди"
      onDrop={() => {}}
    />,
  );
  expect(stuck).toContain('IMG_4821.HEIC');
  expect(stuck).toContain('Хранилище отказало на части 3 (503)');
  expect(stuck).toContain('aria-label="Убрать IMG_4821.HEIC из очереди"');
});

test('a stuck file is drawn to the layout: 12 / 14 round it, the name 3 over its reason, the cross 36 with a 16 glyph', () => {
  // `UploadQueue.json`: the row e13 at 16, 267 (358 × 70) with its thumbnail e14 at 31, 280 — 1 of
  // edge and 14 at the side, 12 on top; the name e15 (14 / 600, 18 tall at 283.5) and the reason e16
  // at 304.5; the cross e17 36 × 36 with its glyph e18 16 × 16; a file that is gone, e21, 20 × 20.
  const onDrop = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(
        <RowStuck
          name="IMG_4503.MOV"
          reason="Этого файла больше нет на телефоне"
          icon={ImageIcon}
          dropLabel="Убрать IMG_4503.MOV из очереди"
          onDrop={onDrop}
        />,
      ),
    );
  });
  const views = tree.root.findAllByType(View).map((one) => StyleSheet.flatten(one.props.style));
  const [row] = views;
  const words = views.find((one) => one?.flex === 1)!;
  expect(row).toMatchObject({
    paddingVertical: 280 - 267 - 1,
    paddingHorizontal: 31 - 16 - 1,
  });
  expect(words.gap).toBe(304.5 - (283.5 + 18));
  expect(tree.root.findAllByType(Text).map((one) => one.props.role)).toEqual(['rowSm', 'meta']);
  expect([type.rowSm.fontSize, type.rowSm.lineHeight]).toEqual([14, 18]);
  const cross = tree.root.findByType(IconButton);
  expect(cross.props.size).toBe(36);
  expect(cross.props.glyph).toEqual({ size: 16 });
  expect(cross.props.label).toBe('Убрать IMG_4503.MOV из очереди');
  act(() => cross.props.onPress());
  expect(onDrop).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAllByType(Icon).find((one) => one.props.icon === ImageIcon)?.props.size,
  ).toBe(20);
});

test('a file the phone no longer has shows a glyph where its picture would be', () => {
  const drop = { dropLabel: 'Убрать из очереди', onDrop: () => {} };
  allDifferent({
    withThumb: (
      <RowStuck name="IMG_4821.HEIC" reason="Хранилище отказало" uri="https://b/1.jpg" {...drop} />
    ),
    gone: (
      <RowStuck
        name="IMG_4821.HEIC"
        reason="Этого файла больше нет на телефоне"
        icon={ImageIcon}
        {...drop}
      />
    ),
  });
  expect(
    story(<RowStuck name="IMG_4821.HEIC" reason="Файла больше нет" icon={ImageIcon} {...drop} />),
  ).toContain('data-glyph');
});
