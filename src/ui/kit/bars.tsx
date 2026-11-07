import {
  type ComponentRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { height, space, themed, type, useTheme } from '@/ui/theme';
import { BoardScrollContext } from './board-scroll';
import { IconButton } from './button';
import { AreaRoom, areaSight, focusedField } from './field';
import type { IconComponent } from './icon';
import { FieldInBar, KEYBOARD_SCROLL } from './interaction';
import { Text, TYPE_MOST } from './text';

function useMeasured(): [number, (event: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(0);
  return [height, (event) => setHeight(event.nativeEvent.layout.height)];
}
type BoardProps = {
  bar?: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
  body?: StyleProp<ViewStyle>;
  list?: (edges: { head: ReactNode; foot: ReactNode }) => ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};
const FIELD_BOX = space.s3;
export const pageBody = {
  paddingHorizontal: space.s5,
  paddingTop: space.s5,
  paddingBottom: space.s7,
  gap: space.s4,
} as const;
export function Board({ bar, heading, footer, body, list, children, style }: BoardProps) {
  const insets = useSafeAreaInsets();
  const { fontScale, height: tall } = useWindowDimensions();
  const styles = useStyles();
  const [top, onTop] = useMeasured();
  const [lead, onLead] = useMeasured();
  const [foot, onFoot] = useMeasured();
  const [room, onRoom] = useMeasured();
  const [fields, setFields] = useState(0);
  const holdBar = useCallback(() => {
    setFields((n) => n + 1);
    return () => setFields((n) => n - 1);
  }, []);
  const line = type.body.lineHeight * Math.min(fontScale, TYPE_MOST);
  const barTall = bar ? top : 0;
  const leadTall = heading ? lead : 0;
  const pinned = tall === 0 || barTall + leadTall + (footer ? foot : 0) + line <= tall - insets.top;
  const held = room === 0 || fields > 0;
  const stands = pinned && (held || barTall + line <= room);
  const leads =
    stands &&
    (!heading || held || barTall + leadTall + FIELD_BOX * 2 + areaSight(fontScale) <= room);
  const lifted = (stands ? 0 : barTall) + (leads ? 0 : leadTall);
  const sight = room - (barTall + leadTall - lifted);
  const scroll = useRef<ScrollViewInstance>(null);
  const column = useRef<ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const follow = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };
  const to = (y: number) => {
    offset.current = Math.max(0, y);
    scroll.current?.scrollTo({ y: offset.current, animated: false });
  };
  const scrollBy = useCallback(
    (delta: number) => {
      to(offset.current + delta);
    },
    // `to` only reads refs, so the first closure stays valid.
    [],
  );
  const boardScroll = useMemo(() => ({ scrollBy }), [scrollBy]);
  const was = useRef({ lifted, room, sight });
  const bring = () => {
    const field = focusedField();
    if (!field || !column.current) return;
    const now = was.current;
    field.measureLayout(
      column.current,
      (_x, y, _w, h) => {
        const from = y + now.lifted - FIELD_BOX;
        const whole = h + FIELD_BOX * 2;
        if (from < offset.current || whole > now.sight) to(from);
        else if (from + whole > offset.current + now.sight) to(from + whole - now.sight);
      },
      () => {},
    );
  };
  useLayoutEffect(() => {
    const before = was.current;
    was.current = { lifted, room, sight };
    if (before.lifted !== lifted && pinned) to(offset.current + lifted - before.lifted);
    if (room < before.room) bring();
  }, [lifted, room, pinned, sight]);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', bring);
    return () => shown.remove();
  }, []);
  const head = bar ? (
    <FieldInBar.Provider value={holdBar}>
      <View onLayout={onTop}>{bar}</View>
    </FieldInBar.Provider>
  ) : null;
  const under = heading ? (
    <FieldInBar.Provider value={holdBar}>
      <View onLayout={onLead}>{heading}</View>
    </FieldInBar.Provider>
  ) : null;
  const scrolled =
    (!stands && head) || (!leads && under) ? (
      <>
        {stands ? null : head}
        {leads ? null : under}
      </>
    ) : null;
  const tail = footer ? <View onLayout={onFoot}>{footer}</View> : null;
  return (
    <BoardScrollContext.Provider value={boardScroll}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.board, list ? null : styles.stands, { paddingTop: insets.top }, style]}
      >
        <View style={[styles.room, list ? null : styles.stands]} onLayout={onRoom}>
          {stands ? head : null}
          {leads ? under : null}
          {list ? (
            <View style={styles.room}>{list({ head: scrolled, foot: pinned ? null : tail })}</View>
          ) : (
            <ScrollView
              ref={scroll}
              style={styles.room}
              contentContainerStyle={styles.grow}
              alwaysBounceVertical={false}
              onScroll={follow}
              scrollEventThrottle={16}
              {...KEYBOARD_SCROLL}
            >
              {scrolled}
              <View ref={column} style={[styles.grow, body]}>
                <AreaRoom.Provider
                  value={pinned && room > 0 ? Math.max(0, sight - FIELD_BOX * 2) : null}
                >
                  {children}
                </AreaRoom.Provider>
              </View>
              {pinned ? null : tail}
            </ScrollView>
          )}
        </View>
        {pinned ? tail : null}
        {list ? children : null}
      </KeyboardAvoidingView>
    </BoardScrollContext.Provider>
  );
}
export function AppBar({
  title,
  subtitle,
  variant = 'inner',
  left,
  right,
  quiet,
  centerTitle,
  style,
}: {
  title: string;
  subtitle?: string;
  variant?: 'root' | 'inner' | 'live';
  left?: ReactNode;
  right?: ReactNode;
  centerTitle?: boolean;
  quiet?: {
    icon: IconComponent;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const inner = variant !== 'root';
  return (
    <View style={[styles.bar, inner ? styles.barInner : null, style]}>
      {left ? <View style={inner ? styles.pullLeft : null}>{left}</View> : null}
      <View style={styles.barWords}>
        <Text
          accessibilityRole="header"
          role={variant === 'root' ? 'displaySm' : variant === 'live' ? 'barTitleLive' : 'barTitle'}
          numberOfLines={centerTitle ? 1 : undefined}
          adjustsFontSizeToFit={centerTitle || undefined}
          minimumFontScale={centerTitle ? 0.7 : undefined}
          style={centerTitle ? styles.titleCenter : undefined}
        >
          {title}
        </Text>
        {subtitle ? <Text role="meta">{subtitle}</Text> : null}
      </View>
      {right}
      {quiet ? <IconButton {...quiet} tint={color.faint} style={styles.pullRight} /> : null}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    board: { flex: 1, backgroundColor: color.ink },
    stands: { justifyContent: 'flex-end' },
    room: { flex: 1 },
    grow: { flexGrow: 1 },
    bar: {
      minHeight: height.bar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
    },
    barInner: { gap: space.s2 },
    pullLeft: { marginLeft: -10 },
    pullRight: { marginRight: -10 },
    barWords: { flex: 1, minWidth: 0, gap: 2 },
    titleCenter: { textAlign: 'center' },
  }),
);
