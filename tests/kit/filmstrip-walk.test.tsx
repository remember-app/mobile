import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { FlatList, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Filmstrip, type Frame, STRIP_TURNED, type StripSize } from '@/kit/filmstrip';

/**
 * Spec 7.7 — the strip under an open frame, as it walks and as it is walked. `filmstrip.test.tsx`
 * draws its states; what a story cannot say is when the strip moves: not before it has been laid
 * out, once as a jump and afterwards as a slide, and not at all because the frames it holds changed
 * — which is the bug a phone reported twice (TASK-106), and the reason it is pinned here as
 * behaviour. And what a finger does to it (TASK-474): the strip is the one horizontal scroll in the
 * product, and a scroll that does not open anything is a row of thumbnails and nothing else.
 */

mountsTrees();

const scrollToIndex = vi.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
afterEach(() => scrollToIndex.mockClear());

const frames = (n: number): Frame[] =>
  Array.from({ length: n }, (_, i) => ({ uri: `https://r2.example/${i}`, video: i === 1 }));

async function draw(index: number, list: readonly Frame[] = frames(6)) {
  const strip = (at: number, held: readonly Frame[]) => (
    <Filmstrip frames={held} index={at} labelAt={(i) => `Кадр ${i + 1}`} />
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
    shots: () =>
      tree.root.findAllByType(View).filter((one) => one.props.accessibilityLabel !== undefined),
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
  // 30 wide and 2 apart, the frame in hand 44 wide — `Viewer` (Viewer.json): neighbours at 13, 45,
  // 77, 109, 141, a pitch of 32; the one in hand at 173, the next at 219.
  expect(layout(null, 0)).toEqual({ length: 30, offset: 0, index: 0 });
  expect(layout(null, 1)).toEqual({ length: 30, offset: 32, index: 1 });
  expect(layout(null, 2)).toEqual({ length: 44, offset: 64, index: 2 });
  expect(layout(null, 3)).toEqual({ length: 30, offset: 3 * 32 + 14, index: 3 });
  expect(layout(null, 5)).toEqual({ length: 30, offset: 5 * 32 + 14, index: 5 });
});

test('the play circle stands in the corner of the frame in hand, 4 in from its left and its foot', async () => {
  // `ViewerVideo` (ViewerVideo.json): the frame in hand at 173,766, 44 × 48; the circle 14 at
  // 177,796 — 4 from its left, 4 from its foot. It stood in the middle.
  const strip = await draw(1);
  const circle = strip.root
    .findAllByType(View)
    .map((one) => StyleSheet.flatten(one.props.style) as ViewStyle)
    .find((style) => style?.width === 14);
  expect(circle).toMatchObject({ position: 'absolute', left: 4, bottom: 4, height: 14 });
  expect(circle?.top).toBeUndefined();
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

test('a frame of the strip is a picture with a name, and a tap on it opens nothing', async () => {
  // TASK-574, #3: the strip is the row that shows where the middle stands and a finger that swipes
  // it walks the gallery. A tap that jumped to the frame under the finger was a second way to do
  // what the swipe already does, and it caught people who meant only to move the row.
  const strip = await draw(0);
  expect(strip.root.findAllByType(Pressable)).toHaveLength(0);
  expect(strip.shots().map((one) => one.props.accessibilityLabel)).toEqual([
    'Кадр 1',
    'Кадр 2',
    'Кадр 3',
    'Кадр 4',
    'Кадр 5',
    'Кадр 6',
  ]);
  expect(strip.shots()[0].props.accessibilityState).toEqual({ selected: true });
});

test('a screen reader activates the frame it is on, and a frame the window refuses puts the strip back', async () => {
  // TASK-582: the strip lost its touch handler when a tap stopped naming a frame (TASK-574, #3), and
  // with it a reader lost the only way to open one. The action is the same ask a resting finger
  // makes, so the same gate answers it — «c» still developing is refused, and the strip returns to
  // the frame in hand rather than standing over one nobody opened.
  const asked: number[] = [];
  const strip = await drawSettled(4, (at) => {
    asked.push(at);
    return true;
  });
  expect(strip.shots()[6].props.accessibilityActions).toEqual([{ name: 'activate' }]);
  await strip.activate(6);
  expect(asked).toEqual([6]);
  // The window took it: the frame change itself walks the strip, and the answer does not fight it.
  expect(strip.scrollToIndex).not.toHaveBeenCalled();

  const refused = await drawSettled(4, () => false);
  await refused.activate(6);
  expect(refused.scrollToIndex).toHaveBeenCalledWith({
    index: 4,
    viewPosition: 0.5,
    animated: true,
  });
});

test('activating the frame already in hand asks for nothing', async () => {
  const asked: number[] = [];
  const strip = await drawSettled(4, (at) => {
    asked.push(at);
    return true;
  });
  await strip.activate(4);
  expect(asked).toEqual([]);
  expect(strip.scrollToIndex).not.toHaveBeenCalled();
});

test('a strip that opens nothing offers no action to a screen reader, and is still not a pressable to a finger', async () => {
  const strip = await draw(2);
  expect(strip.shots().every((one) => one.props.accessibilityActions === undefined)).toBe(true);
  expect(strip.shots().every((one) => one.props.onAccessibilityAction === undefined)).toBe(true);
  expect(strip.root.findAllByType(Pressable)).toHaveLength(0);
});

/**
 * A strip with somebody listening, and a finger on it. The strip is laid out 200 wide, which is
 * narrower than the ten frames it holds and so leaves room to scroll it — a strip that fits cannot
 * be walked, and the numbers below mean nothing against a strip that never moves.
 *
 * `flick` runs the whole touch and runs it in the *worst* order, not the likeliest: the lift
 * answers, a whole turn of the event loop goes by, and only then does the glide say where it
 * stopped. That gap is the device, not the test — the beginning of a glide comes out of the native
 * scroll and cannot cross a frame boundary faster than a frame, while anything the lift armed
 * itself with fires within the tick. A helper that ran them back to back would let the lift's own
 * machinery never fire, which is how the last version of this check came to pass on a fix that does
 * not work on a phone.
 *
 * `glided` is where the glide rests, and it is never the number the finger left on: the whole of a
 * flick is that the two are different places, and a helper that gave both the same one would ask
 * the right frame with any code at all.
 *
 * No glide and no second answer either: a slow touch is the lift and nothing more, and nothing the
 * lift hands over arrives afterwards.
 */
async function drawSettled(
  index: number,
  settle: ((at: number) => boolean) | undefined,
  { size, count = 10, width = 200 }: { size?: StripSize; count?: number; width?: number } = {},
) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <Filmstrip frames={frames(count)} index={index} onSettle={settle} size={size} />,
      ),
    );
  });
  const list = () => tree.root.findByType(FlatList).props as Record<string, (e?: unknown) => void>;
  const shots = () =>
    tree.root.findAllByType(View).filter((one) => one.props.accessibilityState !== undefined);
  await act(async () =>
    tree.root.findByType(FlatList).props.onLayout({ nativeEvent: { layout: { width } } }),
  );
  scrollToIndex.mockClear();
  const at = (x: number) => ({ nativeEvent: { contentOffset: { x } } });
  /** A whole turn of the event loop, which is the gap a real glide leaves before it is heard. */
  const aGlideLater = () =>
    act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
  return {
    scrollToIndex,
    shots,
    /** A screen reader's activation of one frame — it has no finger, so the action is the whole way in. */
    activate: (at: number) =>
      act(async () =>
        shots()[at].props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }),
      ),
    /** A finger that begins on the strip, walks it to `lifted` and lets go, gliding on to `glided`. */
    flick: async (lifted: number, glided: number | null = null) => {
      await act(async () => list().onScrollBeginDrag());
      await act(async () => list().onScrollEndDrag(at(lifted)));
      if (glided === null) {
        await aGlideLater();
        return;
      }
      await aGlideLater();
      await act(async () => list().onMomentumScrollEnd(at(glided)));
    },
  };
}

test('a finger that leaves the strip resting on a frame asks for that frame, and a flick asks once', async () => {
  // TASK-474: the strip is the one horizontal scroll in the product, and a scroll that opens nothing
  // is a row of thumbnails. Ten frames at 30 wide with a pitch of 32, the frame in hand 44: the
  // fourth is 128 from the head and its middle 150, so 118 from the head stands the sixth in the
  // middle of a strip 200 wide.
  const asked: number[] = [];
  const took = (at: number) => {
    asked.push(at);
    return true;
  };
  const strip = await drawSettled(4, took);
  await strip.flick(118);
  expect(asked).toEqual([6]);
  // A frame the window took stands for itself — the strip is walked by the frame change itself, and
  // the strip must not walk back over what it just asked for.
  expect(strip.scrollToIndex).not.toHaveBeenCalled();
});

test('the frame a flick lands on is the one the glide came to rest on, not the one under the finger', async () => {
  // A lift mid-flick is where the strip is that moment; the frame is whatever it coasts to. Asking on
  // the lift alone opens the frame the finger passed over and stops the glide dead on it.
  //
  // The lift is at 104 and the glide rests at 118, and those are two different frames: the middle of
  // the strip stands the fifth at 104 and the sixth at 118, both inside the 132 the strip can reach.
  // `flick` leaves a whole turn of the loop between them, which is the order a phone gives — the
  // lift answers first and the glide overrules it a frame later.
  //
  // What is checked is the *last* answer, because a fix that lets the glide overrule the lift asks
  // twice and that is the trade it makes: nothing in a lift can know a glide is coming, so the only
  // race-free form lets the later answer win. A code that latches the lift's answer — the flag that
  // was here, and the timer that came after it — leaves the fifth on screen and fails here.
  const asked: number[] = [];
  const strip = await drawSettled(4, (at) => {
    asked.push(at);
    return true;
  });
  await strip.flick(104, 118);
  expect(asked.at(-1)).toBe(6);
});

test('a flick whose glide stops where the lift already asked is one ask, not two', async () => {
  // AC #3. Overruling is for a glide that went somewhere else; a glide that came to rest on the
  // frame the lift already named has nothing to add, and asking twice would open two frames for one
  // swipe — the thing this check was first written to refuse, and the reason it exists at all.
  const asked: number[] = [];
  const strip = await drawSettled(4, (at) => {
    asked.push(at);
    return true;
  });
  await strip.flick(118, 118);
  expect(asked).toEqual([6]);
});

test('a frame the window did not take puts the strip back on the frame in hand', async () => {
  // A frame still being developed is refused — the strip must not stand centred over one nobody
  // opened, and must not stay where the finger left it either.
  const refused = await drawSettled(4, () => false);
  await refused.flick(118);
  expect(refused.scrollToIndex).toHaveBeenCalledWith({
    index: 4,
    viewPosition: 0.5,
    animated: true,
  });
  // Nobody to tell at all is the same answer: the strip keeps its own frame.
  const unheard = await drawSettled(4, undefined);
  await unheard.flick(118);
  expect(unheard.scrollToIndex).toHaveBeenCalledWith({
    index: 4,
    viewPosition: 0.5,
    animated: true,
  });
});

test('a finger that lets the strip go on the frame in hand walks it back under that frame', async () => {
  // TASK-540, AC #3: the strip always stands centred on the frame the picture shows. A drag that
  // comes short of the next frame — or a glide that stops between two — leaves the strip resting
  // off-centre, with the frame in hand no longer under the middle of it. Nobody is asked for a
  // frame here (the window already has it), and the strip is walked back.
  //
  // 15 points: a pitch of 32, so the middle of the strip is still over the fifth frame, 50 being
  // where that frame stands it and 65 where the finger left it.
  const asked: number[] = [];
  const strip = await drawSettled(4, (at) => {
    asked.push(at);
    return true;
  });
  await strip.flick(65);
  expect(asked).toEqual([]);
  expect(strip.scrollToIndex).toHaveBeenCalledWith({ index: 4, viewPosition: 0.5, animated: true });
});

test('swiping past the first and the last frame does nothing, and the strip does not go into the empty', async () => {
  // AC #3 of TASK-474. At either end the strip cannot scroll further, so the middle of it stands over
  // a neighbour a few frames away — and read on its own that neighbour would be opened by a finger
  // that only ever tried to go backwards. A touch that does not move the strip has chosen nothing.
  for (const index of [0, 9]) {
    const asked: number[] = [];
    const strip = await drawSettled(index, (at) => {
      asked.push(at);
      return true;
    });
    // 200 wide against 332 of frames: 0 at the head, 132 at the tail — the only two places it rests
    // on either of them.
    await strip.flick(index === 0 ? 0 : 132);
    expect(asked, String(index)).toEqual([]);
    expect(strip.scrollToIndex, String(index)).not.toHaveBeenCalled();
  }
});

test('a strip that fits is never walked by a finger, and a strip of one frame is not an error', async () => {
  // Three frames of 30 stand in a strip 200 wide: there is nowhere to scroll to, so a finger on it
  // has chosen nothing and must not ask for the frame its middle happens to fall on.
  const asked: number[] = [];
  const fits = await drawSettled(
    0,
    (at) => {
      asked.push(at);
      return true;
    },
    { count: 3 },
  );
  await fits.flick(0);
  expect(asked).toEqual([]);
  // One frame is a strip of one frame: the edge of both ends at once, and still nothing to ask.
  const one = await drawSettled(0, () => true, { count: 1 });
  await one.flick(0);
  expect(one.scrollToIndex).not.toHaveBeenCalled();
});

test('a frame is read off the sizes the window handed the strip, standing or turned', async () => {
  // TASK-475: the turned strip is 26 wide with a pitch of 28 and the frame in hand 38 — every
  // distance in it is smaller, so a finger's resting place means a different point in the row.
  const took = (asked: number[]) => (at: number) => {
    asked.push(at);
    return true;
  };
  const standing: number[] = [];
  await (await drawSettled(4, took(standing))).flick(118);
  const turned: number[] = [];
  await (await drawSettled(4, took(turned), { size: STRIP_TURNED })).flick(93);
  expect(standing).toEqual([6]);
  // 93 of the turned strip, not 118: the same finger, the same frame, a narrower row.
  expect(turned).toEqual([6]);
  // And the frame in hand turned stands at 31, where the standing one stands at 50 — the strip
  // rests where it put it either way, and a touch that did not move it asks nothing.
  const held: number[] = [];
  await (await drawSettled(4, took(held), { size: STRIP_TURNED })).flick(31);
  expect(held).toEqual([]);
});
