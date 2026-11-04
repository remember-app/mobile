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

const HOLD_MS = 1000;
const GRAB = 32;
const SEAM_LIFT = FEED_GAP / 2 + 8;
const SEAM_LEFT = 12;
export type Spine = {
  marks: {
    label: string;
    top: number;
  }[];
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
  frames: readonly MediaItem[];
  plain: boolean;
  columns: number;
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
  const stay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moving = useCallback(() => {
    const play = (toValue: number, ms: number) =>
      Animated.timing(fade, {
        toValue,
        duration: reduced ? 0 : ms,
        easing: EASE,
        useNativeDriver: true,
      }).start();
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
  useEffect(
    () => () => {
      if (stay.current !== null) clearTimeout(stay.current);
    },
    [],
  );
  const feedTop = insets.top + height.roundViewer + space.s4 + headerHeight + FEED_GAP;
  const reach = feed.content - feed.view;
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
  const grabTop = insets.top + height.roundViewer;
  const grabSpan = Math.max(1, screen - board.footerGallery - grabTop);
  const pan = useMemo(() => {
    const jump = (pageY: number) => {
      if (reach <= 0) return;
      const part = Math.min(1, Math.max(0, (pageY - grabTop) / grabSpan));
      scrollTo(part * reach);
      moving();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => jump(e.nativeEvent.pageY),
      onPanResponderMove: (e) => jump(e.nativeEvent.pageY),
    });
  }, [reach, grabTop, grabSpan, moving, scrollTo]);
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
    onContentSizeChange: (_width, content) =>
      setFeed((was) => (was.content === content ? was : { ...was, content })),
    onLayout: (e) => {
      const view = e.nativeEvent.layout.height;
      setFeed((was) => (was.view === view ? was : { ...was, view }));
    },
    onHeaderLayout: (e) => {
      const tall = e.nativeEvent.layout.height;
      setHeaderHeight((was) => (was === tall ? was : tall));
    },
  };
}
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
      pointerEvents={showing ? 'box-none' : 'none'}
      style={[styles.spine, { opacity: fade }]}
    >
      <Animated.View
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
    spine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    feed: { position: 'absolute', top: 0, left: 0, right: 0 },
    grab: { position: 'absolute', left: 0, width: GRAB },
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
