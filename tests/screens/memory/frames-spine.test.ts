import { expect, test } from 'vitest';

import frames from '@/screens/memory/frames.tsx?raw';
import spine from '@/screens/memory/frames-spine.tsx?raw';

/**
 * The days on the feed (TASK-208, spec 8): off by default and read off the spine at the right edge
 * while a finger is moving the feed (`MemoryScrub`), on by the switch in the sort sheet and then
 * written into a 20px seam between the days (`MemoryDated`). Never both.
 *
 * Read as text, the idiom `tests/routes/memory/screen.test.ts` explains at length: the spine is
 * measurement, a native animation and a pan responder, and none of the three is a thing node can be
 * shown. What is pinned here is the arithmetic and the two rules it has to keep.
 */

test('the feed nobody arranged is one wall, and the days are only on the spine', () => {
  // The ungrouped cut has no seam of its own, so the feed spends no row at all on saying what day
  // it is — that is the whole of `MemoryFrames` and `MemoryScrub`.
  expect(frames).toContain("...(group.by === 'all' ? [] : [{ key: group.key, group }])");
  // And the spine is drawn only there: cut by people or by kind the days interleave, and a rail of
  // them would point at nothing. A feed shorter than the screen has no spine either (spec 8).
  expect(frames).toContain("plain: sort.by === 'none' && !sort.dates,");
  expect(spine).toContain('!plain || headerHeight === 0 || reach <= 0');
  expect(spine).toContain('const reach = feed.content - feed.view;');
  expect(spine).toContain('dateMarks(frames, { top: feedTop, row: rowPitch })');
  // Where the first row of frames stands: the top the feed is pushed down by, the block of films
  // over it measured rather than guessed, and the one gutter between them.
  expect(spine).toContain(
    'const feedTop = insets.top + height.roundViewer + space.s4 + headerHeight + FEED_GAP;',
  );
  expect(frames).toContain('rowPitch: cell.width + FEED_GAP,');
  // And the pill is centred on the seam and not hung from the row (`MemoryScrub`: the pills stand at
  // 195 and 588 over rows that start at 204 and 597 — 9 above, which is half a gutter and half a
  // pill).
  expect(spine).toContain('const SEAM_LIFT = FEED_GAP / 2 + 8;');
  expect(spine).toContain('top: mark.top - SEAM_LIFT,');
});

test('the spine rides the scroll itself, and is grabbed only while it can be seen', () => {
  // Spec 6: 120 coming, 400 going, a second after the feed stops — and nothing under «уменьшить
  // движение», where it simply is or is not.
  expect(spine).toContain('duration: reduced ? 0 : ms');
  expect(spine).toContain('play(1, duration.spineIn)');
  expect(spine).toContain('play(0, duration.spineOut)');
  expect(spine).toContain('}, HOLD_MS);');
  // The marks stand on the feed's own seams, so they are moved by the scroll on the native side
  // rather than by this screen re-rendering sixty times a second — and the handler is hung once,
  // because re-attaching it mid-flick is a dropped frame under the finger.
  expect(spine).toContain('useNativeDriver: true,');
  expect(spine).toContain('transform: [{ translateY: Animated.multiply(scrolled, -1) }]');
  expect(spine).toContain('const onScroll = useMemo(');
  expect(frames).toContain('onScroll={onScroll}');
  // Dragging it throws the feed (spec 7.8), and it answers only touches that begin on the strip —
  // a flick along the right edge must not stop being a flick halfway through.
  expect(spine).toContain('scrollTo(part * reach)');
  expect(frames).toContain('list.current?.scrollToOffset({ offset, animated: false })');
  expect(spine).toContain('onStartShouldSetPanResponder: () => true,');
  expect(spine).not.toContain('onMoveShouldSetPanResponder');
  // What is drawn at nought opacity is still a thing in the way of the feed underneath.
  expect(spine).toContain("pointerEvents={showing ? 'box-none' : 'none'}");
});
