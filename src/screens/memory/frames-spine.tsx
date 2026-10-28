import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaItem } from '@/api';
import { DateSpine, EASE, FEED_GAP, Text, useReducedMotion } from '@/kit';
import { formatDayTiny } from '@/lib/dates';
import { dateMarks } from '@/lib/frames';
import { board, duration, height, photo, radius, space, themed } from '@/theme';

/**
 * `MemoryScrub` — the spine at the left edge of the feed (spec 7.8): a hairline with a pill on
 * every seam where a day begins, proving while the feed is moving and gone a second after it stops.
 * It lies over the photographs and takes no room from them, and a finger dragging it throws the
 * feed to where the finger stands.
 *
 * The left edge and not the right: the spine stands where the thumb is while a finger is reading
 * the date under it, and a mark a palm is resting on is a mark not read.
 *
 * Kept apart from the feed because none of it is about the frames: it is measurement, a fade and a
 * pan, and the feed only has to say which records it is drawing and how tall a row of them is.
 */

/** How long the spine stands after the feed stops, before it goes (spec 6). */
const HOLD_MS = 1000;

/**
 * How wide a strip of the left edge the spine answers a finger in. Wider than the hairline and the
 * pills it carries, narrower than a tap target: it is live only while the spine itself is visible,
 * and a strip as wide as a thumb would be swallowing flicks meant for the feed underneath.
 */
const GRAB = 32;

/**
 * A pill on the spine is 16 tall and stands centred on the seam between two rows (spec 7.8, detail
 * 66): half a gutter above the row that opens the day, and half its own height above that. What
 * `dateMarks` hands over is where the row starts, so this is how far above it the pill's top edge
 * goes — without it the pill sits inside the first row of its day, 9 short of the layout.
 */
const SEAM_LIFT = FEED_GAP / 2 + 8;

/** How far the seam's day pill stands in from the left edge — the spine's own 12 (spec 7.8). */
const SEAM_LEFT = 12;

/** Everything the layer below is drawn from, worked out by the hook above it. */
export type Spine = {
  marks: { label: string; top: number }[];
  scrolled: Animated.Value;
  fade: Animated.Value;
  showing: boolean;
  content: number;
  grabTop: number;
  grabSpan: number;
  pan: ReturnType<typeof PanResponder.create>;
};

export function useSpine({
  frames,
  plain,
  columns,
  rowPitch,
  scrollTo,
}: {
  /** The records the feed is drawing, in the order it draws them. */
  frames: readonly MediaItem[];
  /** The plain wall of frames — cut into seams, or with the dates written, there is no spine. */
  plain: boolean;
  /** How many across the feed is cut at — the marks are counted over the rows that really are. */
  columns: number;
  /** A square tile and the gutter under it: what every row of the feed is worth in points. */
  rowPitch: number;
  scrollTo: (offset: number) => void;
}): {
  spine: Spine;
  onScroll: ReturnType<typeof Animated.event>;
  onContentSizeChange: (width: number, content: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onHeaderLayout: (e: LayoutChangeEvent) => void;
} {
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const scrolled = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [showing, setShowing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [feed, setFeed] = useState({ content: 0, view: 0 });
  const reduced = useReducedMotion();
  /** The timer that ends the spine's stay; null while it is not standing. */
  const stay = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Spec 6 — the spine proves while a finger is moving the feed and goes a second after it stops:
   * 120 coming, 400 going, and neither under «уменьшить движение», where it simply is or is not.
   * Every scroll event lands here, so the arrival is only played once a burst and the rest of the
   * burst just pushes the departure back.
   */
  const moving = useCallback(() => {
    const play = (toValue: number, ms: number) =>
      Animated.timing(fade, {
        toValue,
        duration: reduced ? 0 : ms,
        easing: EASE,
        useNativeDriver: true,
      }).start();
    // The arrival, and the one re-render the whole burst costs: sixty events a second must not be
    // sixty dispatches at a screen holding a wall of photographs.
    if (stay.current === null) {
      play(1, duration.spineIn);
      setShowing(true);
    } else {
      clearTimeout(stay.current);
    }
    stay.current = setTimeout(() => {
      stay.current = null;
      setShowing(false);
      play(0, duration.spineOut);
    }, HOLD_MS);
  }, [fade, reduced]);

  // The timer outlives the screen otherwise: it holds `setShowing`, and a memory left while the
  // spine is still up would be writing state into a screen that has gone.
  useEffect(
    () => () => {
      if (stay.current !== null) clearTimeout(stay.current);
    },
    [],
  );

  /**
   * Where the first row of frames starts, in points down the list's own content: the top the feed
   * is pushed down by to clear the glass, the block of films over it as it actually came out, and
   * the one gutter between that block and the frames. Everything below rides a row's pitch — a
   * square tile and the gutter under it.
   */
  const feedTop = insets.top + height.roundViewer + space.s4 + headerHeight + FEED_GAP;
  /** How much of the feed is out of sight — nothing at all, on one shorter than the screen. */
  const reach = feed.content - feed.view;

  /**
   * The marks: one per day, on the seam between the two rows where that day begins (spec 7.8). Only
   * on the wall, and only when there is something to scroll: «лента короче экрана — стержня нет».
   */
  const marks = useMemo(
    () =>
      !plain || headerHeight === 0 || reach <= 0
        ? []
        : dateMarks(frames, { top: feedTop, row: rowPitch, columns }).map((mark) => ({
            label: formatDayTiny(new Date(mark.at)),
            top: mark.top - SEAM_LIFT,
          })),
    [plain, frames, headerHeight, reach, feedTop, rowPitch, columns],
  );

  /** Where the strip the spine is grabbed by begins and how tall it is: between the two glasses. */
  const grabTop = insets.top + height.roundViewer;
  const grabSpan = Math.max(1, screen - board.footerGallery - grabTop);

  /**
   * Dragging the spine throws the feed (spec 7.8): where the finger stands on the strip is where the
   * feed stands in itself. It only answers touches that *begin* on the strip, and only while the
   * spine is visible — otherwise a flick along the left edge would stop being a flick halfway
   * through it.
   */
  const pan = useMemo(() => {
    const jump = (pageY: number) => {
      if (reach <= 0) return;
      const part = Math.min(1, Math.max(0, (pageY - grabTop) / grabSpan));
      scrollTo(part * reach);
      // A finger holding the spine still is holding the spine: the feed sends nothing while it
      // does not move, and the thing being held must not fade out from under it.
      moving();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => jump(e.nativeEvent.pageY),
      onPanResponderMove: (e) => jump(e.nativeEvent.pageY),
    });
  }, [reach, grabTop, grabSpan, moving, scrollTo]);

  /**
   * The scroll itself, hung once rather than rebuilt on every render: it carries a native animation
   * on one end and this screen's own fade on the other, and re-attaching it mid-flick is a dropped
   * frame under the finger.
   */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrolled } } }], {
        useNativeDriver: true,
        listener: moving,
      }),
    [scrolled, moving],
  );

  return {
    spine: { marks, scrolled, fade, showing, content: feed.content, grabTop, grabSpan, pan },
    onScroll,
    // The two numbers that say whether there is anything to scroll at all, and how far a drag on
    // the spine reaches. Guarded, because a list writes both on every layout pass.
    onContentSizeChange: (_width, content) =>
      setFeed((was) => (was.content === content ? was : { ...was, content })),
    onLayout: (e) => {
      const view = e.nativeEvent.layout.height;
      setFeed((was) => (was.view === view ? was : { ...was, view }));
    },
    // Measured rather than reckoned: the films are a block whose height is its own business — a
    // strip, an empty state, nothing at all while it reads — and the marks are counted from the
    // first row of frames, which stands under it.
    onHeaderLayout: (e) => {
      const tall = e.nativeEvent.layout.height;
      setHeaderHeight((was) => (was === tall ? was : tall));
    },
  };
}

/**
 * The day mark the single-frame feed keeps after its spine is gone (spec 10.14.2): the spine's own
 * pill, without the line and the dot, standing on the seam between two frames where the day begins.
 * It lies over the photographs, so the frames keep standing touching — the 20 a day-gap takes in
 * the grid would tear them apart.
 */
export function SeamDay({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.seam} pointerEvents="none" accessibilityRole="header">
      <View style={styles.seamPill}>
        <Text role="day" style={styles.seamText}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * The layer the marks are drawn on: the whole screen, over the photographs, moved by the scroll
 * itself rather than by the feed re-rendering.
 */
export function SpineLayer({
  marks,
  scrolled,
  fade,
  showing,
  content,
  grabTop,
  grabSpan,
  pan,
}: Spine) {
  const styles = useStyles();
  if (marks.length === 0) return null;
  return (
    <Animated.View
      // Dead to a finger unless the spine can be seen: what is drawn at nought opacity is still
      // a thing in the way of the feed underneath.
      pointerEvents={showing ? 'box-none' : 'none'}
      style={[styles.spine, { opacity: fade }]}
    >
      <Animated.View
        // Dead to a finger: this view is the feed's own coordinates — the full width of the screen
        // and as tall as everything there is to scroll — so left answering, it takes every flick
        // aimed at the photographs underneath for as long as the spine stands. The strip below is
        // the one thing here a finger is meant to find.
        pointerEvents="none"
        style={[
          styles.feed,
          { height: content, transform: [{ translateY: Animated.multiply(scrolled, -1) }] },
        ]}
      >
        <DateSpine marks={marks} />
      </Animated.View>
      <View style={[styles.grab, { top: grabTop, height: grabSpan }]} {...pan.panHandlers} />
    </Animated.View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    // The spine's own layer: the whole screen, so the hairline runs its full height (spec 7.8).
    spine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    // And inside it the feed's own coordinates — as tall as everything there is to scroll, moved
    // up by however much of it has been. The line and the marks live in here together, so both
    // stand still against the photographs instead of against the phone.
    feed: { position: 'absolute', top: 0, left: 0, right: 0 },
    // Where a finger takes hold of it: the left edge between the two glasses, drawn by nothing.
    grab: { position: 'absolute', left: 0, width: GRAB },
    // The single frame's day mark: half of the 16 pill above the row it opens, so it is centred on
    // the seam — no line under it, and no gap spent on saying so.
    seam: { position: 'absolute', top: -8, left: SEAM_LEFT },
    seamPill: {
      minHeight: 16,
      justifyContent: 'center',
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: photo.plateQuiet,
    },
    seamText: { color: photo.spineMark, lineHeight: 16, letterSpacing: 0 },
  }),
);
