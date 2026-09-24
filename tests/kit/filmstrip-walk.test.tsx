import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, Pressable } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Filmstrip, type Frame } from '@/kit/filmstrip';

/**
 * Spec 7.7 — the strip under an open frame, as it walks. `filmstrip.test.tsx` draws its states; what
 * a story cannot say is when the strip moves: not before it has been laid out, once as a jump and
 * afterwards as a slide, and not at all because the frames it holds changed — which is the bug a
 * phone reported twice (TASK-106), and the reason it is pinned here as behaviour.
 */

mountsTrees();

const scrollToIndex = vi.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
afterEach(() => scrollToIndex.mockClear());

const frames = (n: number): Frame[] =>
  Array.from({ length: n }, (_, i) => ({ uri: `https://r2.example/${i}`, video: i === 1 }));

async function draw(index: number, list: readonly Frame[] = frames(6)) {
  const strip = (at: number, held: readonly Frame[]) => (
    <Filmstrip frames={held} index={at} onPick={() => {}} labelAt={(i) => `Кадр ${i + 1}`} />
  );
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(strip(index, list)));
  });
  return {
    root: tree.root,
    move: (at: number, held: readonly Frame[] = list) =>
      act(async () => tree.update(strip(at, held))),
    lay: (width: number) =>
      act(async () =>
        tree.root.findByType(FlatList).props.onLayout({ nativeEvent: { layout: { width } } }),
      ),
    shots: () => tree.root.findAllByType(Pressable),
  };
}

test('the strip stays where it is until it has been laid out — the walk hangs on its own width', async () => {
  const strip = await draw(3);
  expect(scrollToIndex).not.toHaveBeenCalled();
  await strip.move(4);
  expect(scrollToIndex).not.toHaveBeenCalled();
  await strip.lay(390);
  expect(scrollToIndex).toHaveBeenCalledTimes(1);
  // To the frame in hand as it stands now, in the middle of the strip.
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 4, viewPosition: 0.5, animated: false });
});

test('the first walk is a jump and every one after it is a slide', async () => {
  const strip = await draw(1);
  await strip.lay(390);
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 1, viewPosition: 0.5, animated: false });
  await strip.move(2);
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 2, viewPosition: 0.5, animated: true });
  await strip.move(0);
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 0, viewPosition: 0.5, animated: true });
  expect(scrollToIndex).toHaveBeenCalledTimes(3);
});

test('a strip that was laid out again walks to the same frame once more', async () => {
  const strip = await draw(2);
  await strip.lay(390);
  await strip.lay(844);
  expect(scrollToIndex).toHaveBeenCalledTimes(2);
  // The same width is not a new layout.
  await strip.lay(844);
  expect(scrollToIndex).toHaveBeenCalledTimes(2);
});

test('frames that change while the frame in hand does not are not a reason to walk: the strip stays where a finger left it', async () => {
  const strip = await draw(2);
  await strip.lay(390);
  scrollToIndex.mockClear();
  // A record turned ready and the list is longer by one.
  await strip.move(2, frames(7));
  await strip.move(2, frames(8));
  expect(scrollToIndex).not.toHaveBeenCalled();
});

test('no frame in hand, or one that is not in the strip, is nowhere to walk to', async () => {
  const strip = await draw(-1);
  await strip.lay(390);
  expect(scrollToIndex).not.toHaveBeenCalled();
  await strip.move(6);
  expect(scrollToIndex).not.toHaveBeenCalled();
  await strip.move(5);
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 5, viewPosition: 0.5, animated: false });
  const first = await draw(0);
  await first.lay(390);
  expect(scrollToIndex).toHaveBeenLastCalledWith({ index: 0, viewPosition: 0.5, animated: false });
});

test('the strip can be walked to any frame without measuring one: the frame in hand is the wide one, the rest are pushed along by the difference', async () => {
  const strip = await draw(2);
  const layout = strip.root.findByType(FlatList).props.getItemLayout as (
    data: unknown,
    at: number,
  ) => { length: number; offset: number; index: number };
  // 30 wide and 4 apart, the frame in hand 44 wide.
  expect(layout(null, 0)).toEqual({ length: 30, offset: 0, index: 0 });
  expect(layout(null, 1)).toEqual({ length: 30, offset: 34, index: 1 });
  expect(layout(null, 2)).toEqual({ length: 44, offset: 68, index: 2 });
  expect(layout(null, 3)).toEqual({ length: 30, offset: 3 * 34 + 14, index: 3 });
  expect(layout(null, 5)).toEqual({ length: 30, offset: 5 * 34 + 14, index: 5 });
});

test('the fade is by distance from the frame in hand, and the frame in hand is at full strength and says it is the one', async () => {
  const strip = await draw(2);
  const opacity = (at: number) => {
    const style = strip.shots()[at].props.style as unknown[];
    return style
      .flat()
      .find((one) => one && typeof one === 'object' && 'opacity' in (one as object)) as
      | { opacity: number }
      | undefined;
  };
  expect([0, 1, 3, 4, 5].map((at) => opacity(at)?.opacity)).toEqual([0.6, 0.75, 0.75, 0.6, 0.45]);
  expect(opacity(2)?.opacity).toBe(1);
  expect(strip.shots().map((one) => one.props.accessibilityState.selected)).toEqual([
    false,
    false,
    true,
    false,
    false,
    false,
  ]);
  expect(strip.shots().map((one) => one.props.accessibilityLabel)).toEqual([
    'Кадр 1',
    'Кадр 2',
    'Кадр 3',
    'Кадр 4',
    'Кадр 5',
    'Кадр 6',
  ]);
});

test('a press on a frame of the strip names that frame, and a strip with nobody to tell is not a row of buttons', async () => {
  const picked: number[] = [];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Filmstrip frames={frames(3)} index={0} onPick={(at) => picked.push(at)} />,
      ),
    );
  });
  await act(async () => tree.root.findAllByType(Pressable)[2].props.onPress());
  await act(async () => tree.root.findAllByType(Pressable)[1].props.onPress());
  expect(picked).toEqual([2, 1]);
  await act(async () => {
    tree.update(<Filmstrip frames={frames(3)} index={0} />);
  });
  expect(tree.root.findAllByType(Pressable).every((one) => one.props.disabled === true)).toBe(true);
});
