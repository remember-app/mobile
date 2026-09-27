import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Text as RNText, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeAll, expect, test, vi } from 'vitest';

import { Progress } from '@/kit/bits';
import { Button, IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { BlockStuck, type StuckLine, Upload, UploadLine } from '@/kit/upload';
import { setTheme, themes, type } from '@/theme';

/**
 * Spec 7.6 — sending: the block that counts it down, the same said as one line over one's own feed,
 * and the block for the files that will not go.
 */

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

/** The line over one's own feed, with whichever of its floors it is handed. */
const sendingLine = (over: Partial<Parameters<typeof UploadLine>[0]> = {}) => (
  <UploadLine
    title="Отправляем"
    meta="осталось 9"
    value={0.4}
    failed="5 файлов не ушли"
    action="Разобрать"
    label="Отправляем, осталось 9, 5 файлов не ушли. Разобрать"
    onPress={() => {}}
    {...over}
  />
);

test('the line over one’s own feed says what is going, what is left and what did not go — and the whole of it is the way in', () => {
  // Spec detail 48, «строка отправки» (`MyFrames`): «Отправляем» 15 / 600 and «осталось 9», the bar,
  // and the line of failures with «Разобрать» at its end.
  const onPress = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(TestRenderer.create(sendingLine({ onPress })));
  });
  expect(tree.root.findAllByType(Text).map((one) => [one.props.children, one.props.role])).toEqual([
    ['Отправляем', 'row'],
    ['осталось 9', 'timecode'],
    ['5 файлов не ушли', 'meta'],
    ['Разобрать', 'timecode'],
  ]);
  expect(tree.root.findAllByType(Progress)).toHaveLength(1);
  const link = tree.root.findByProps({ accessibilityRole: 'link' });
  expect(link.props.accessibilityLabel).toBe('Отправляем, осталось 9, 5 файлов не ушли. Разобрать');
  act(() => link.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('nothing going up leaves the line of failures alone, and nothing failed leaves it out', () => {
  allDifferent({
    both: sendingLine(),
    stuckOnly: sendingLine({ title: undefined, meta: undefined }),
    goingOnly: sendingLine({ failed: undefined }),
  });
  expect(story(sendingLine({ title: undefined, meta: undefined }))).not.toContain('progressbar');
  expect(story(sendingLine({ failed: undefined, label: 'Отправляем, осталось 9' }))).not.toContain(
    'Разобрать',
  );
});

/** A file that did not go, with its cross wired to nothing. */
const line = (name: string, reason: string, onDrop = () => {}): StuckLine => ({
  key: name,
  name,
  reason,
  dropLabel: `Убрать ${name} из очереди`,
  onDrop,
});

/** The block over the files it is handed, folded or open. */
const block = (lines: StuckLine[], open = false, onRetry = () => {}) => (
  <BlockStuck
    title={`Не ушли ${lines.length} файлов`}
    retry={{ label: 'Ещё раз', onPress: onRetry }}
    lines={lines}
    open={open}
    onToggle={() => {}}
    more={`Ещё ${lines.length - 2} файла`}
    less="Свернуть"
  />
);

test('every file that did not go is in one block: the count and «Ещё раз» in its head, a line to a file with its name and why', () => {
  // Spec detail 78 and 51: the head's triangle, «Не ушли 5 файлов» and the 32 «Ещё раз»; each line
  // the file's name 14 / 600 cut to one line, and the reason 12 / 500 `dangerText`, which wraps.
  const onRetry = vi.fn();
  const onDrop = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = mounted(
      TestRenderer.create(
        block(
          [
            line('IMG_4471.HEIC', 'Хранилище отказало (503)', onDrop),
            line('IMG_4470.HEIC', 'Больше нет на этом телефоне'),
          ],
          false,
          onRetry,
        ),
      ),
    );
  });
  const text = (words: string) =>
    tree.root.findAllByType(Text).find((one) => one.props.children === words)!;
  expect(text('Не ушли 2 файлов').props.role).toBe('row');
  expect(text('IMG_4471.HEIC').props).toMatchObject({ role: 'rowSm', numberOfLines: 1 });
  expect(text('Хранилище отказало (503)').props).toMatchObject({ role: 'meta', tone: 'danger' });
  expect(text('Хранилище отказало (503)').props.numberOfLines).toBeUndefined();
  const again = tree.root.findAllByType(Button).find((one) => one.props.label === 'Ещё раз')!;
  expect(again.props).toMatchObject({ variant: 'secondary', size: 'xxs' });
  act(() => again.props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
  const [cross] = tree.root.findAllByType(IconButton);
  expect(cross.props).toMatchObject({ size: 36, label: 'Убрать IMG_4471.HEIC из очереди' });
  act(() => cross.props.onPress());
  expect(onDrop).toHaveBeenCalledTimes(1);
  // One edge round the lot, and it is danger's.
  const edges = tree.root
    .findAllByType(View)
    .filter(
      (one) => StyleSheet.flatten(one.props.style)?.borderColor === themes.dark.color.dangerEdge,
    );
  expect(edges).toHaveLength(1);
});

test('two lines stand open and the rest fold behind «Ещё N», which opens them where they stand', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((n) =>
    line(`IMG_${n}.HEIC`, 'Связь с хранилищем оборвалась'),
  );
  const names = (open: boolean) => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = mounted(TestRenderer.create(block(five, open)));
    });
    return tree.root
      .findAllByType(Text)
      .map((one) => one.props.children)
      .filter((words) => typeof words === 'string' && words.startsWith('IMG_'));
  };
  expect(names(false)).toEqual(['IMG_a.HEIC', 'IMG_b.HEIC']);
  expect(names(true)).toHaveLength(5);
  expect(story(block(five))).toContain('Ещё 3 файла');
  expect(story(block(five, true))).toContain('Свернуть');
  // Two or fewer: nothing to fold.
  expect(story(block(five.slice(0, 2)))).not.toContain('Ещё 0');
  allDifferent({ folded: block(five), open: block(five, true) });
});
