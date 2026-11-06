import { X } from 'lucide-react-native';
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { board, height, photo, radius, space, ThemePin, themed, type, useTheme } from '@/ui/theme';
import { StepScale } from './bits';
import { BoardScrollContext } from './board-scroll';
import { BAR_GLYPH, Button, IconButton } from './button';
import { AreaRoom, areaSight, focusedField } from './field';
import type { IconComponent } from './icon';
import { FieldInBar, KEYBOARD_SCROLL, useKeyboardShown } from './interaction';
import { useMeasured } from './sheet';
import { Text, TYPE_MOST, useWordRoom, WordRoom } from './text';
export type BoardProps = {
  bar?: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
  body?: StyleProp<ViewStyle>;
  list?: (edges: { head: ReactNode; foot: ReactNode }) => ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};
const FIELD_BOX = space.s3;
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
  style,
}: {
  title: string;
  subtitle?: string;
  variant?: 'root' | 'inner' | 'live';
  left?: ReactNode;
  right?: ReactNode;
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
export const CANCEL_WORD_SCALE = 1.2;
export type WizardFace = 'step' | 'summary' | 'entry';
export function WizardBar({
  step,
  steps,
  label,
  variant = 'step',
  back,
  cancel,
  style,
}: {
  step: number;
  steps: number;
  label: string;
  variant?: WizardFace;
  back?: ReactNode;
  cancel?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const { fontScale } = useWindowDimensions();
  const glyph = fontScale > CANCEL_WORD_SCALE;
  const side = glyph ? styles.wizardSideNarrow : styles.wizardSide;
  return (
    <View style={style}>
      <View style={styles.bar}>
        <View style={side}>{back}</View>
        <Text role="label" tone="muted" style={styles.wizardStep}>
          {label}
        </Text>
        <View style={[side, styles.wizardRight]}>
          {cancel === undefined ? null : glyph ? (
            <IconButton
              icon={X}
              label={cancel.label}
              glyph={BAR_GLYPH}
              tint={color.muted}
              onPress={cancel.onPress}
              style={styles.pullRight}
            />
          ) : (
            <Button
              variant="quiet"
              labelRole="controlSm"
              label={cancel.label}
              onPress={cancel.onPress}
              style={styles.cancelWord}
            />
          )}
        </View>
      </View>

      {variant === 'step' ? (
        <StepScale steps={steps} done={step} style={styles.wizardScale} />
      ) : null}
    </View>
  );
}
export function WizardHeading({
  title,
  note,
  variant = 'step',
}: {
  title: string;
  note?: string;
  variant?: WizardFace;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.wizardWords, variant === 'entry' ? styles.wizardWordsEntry : null]}>
      <Text role="display" accessibilityRole="header">
        {title}
      </Text>
      {note ? (
        <Text role="note" tone="muted" style={styles.wizardNote}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
export function GlassBar({
  title,
  meta,
  capsuleLabel,
  onCapsule,
  middle,
  left,
  right,
  bare,
  style,
}: {
  title: string;
  meta?: string;
  capsuleLabel: string;
  onCapsule?: () => void;
  middle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const words = (
    <>
      <Text role="pillTitle" numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text role="meta" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </>
  );
  return (
    <ThemePin value="dark">
      <View style={[styles.glassBar, { paddingTop: insets.top }, style]}>
        {bare ? null : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                bottom: undefined,
                height: board.headGallery,
                experimental_backgroundImage: photo.headGallery,
              },
            ]}
          />
        )}
        {left}
        {middle ??
          (onCapsule ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={capsuleLabel}
              onPress={onCapsule}
              style={styles.capsule}
            >
              {words}
            </Pressable>
          ) : (
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={capsuleLabel}
              style={styles.capsule}
            >
              {words}
            </View>
          ))}

        {right ?? <View style={styles.slot} />}
      </View>
    </ThemePin>
  );
}
export function ViewerBar({
  date,
  meta,
  label,
  onPress,
  on = false,
  turned = false,
  left,
  right,
  style,
}: {
  date: string;
  meta: string;
  label?: string;
  onPress?: () => void;
  on?: boolean;
  turned?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <ThemePin value="dark">
      <View style={[styles.viewerBar, turned ? styles.viewerBarTurned : null, style]}>
        {left}
        <View style={styles.viewerMiddle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={onPress}
            disabled={!onPress}
            style={[
              styles.viewerPill,
              turned ? styles.viewerPillTurned : null,
              on ? styles.viewerPillOn : null,
            ]}
          >
            <Text
              role="row"
              style={[
                styles.centred,
                turned ? styles.unwrapped : null,
                on ? styles.viewerPillOnInk : null,
              ]}
            >
              {date}
            </Text>

            {turned ? <View style={styles.viewerDot} /> : null}
            <Text
              role="meta"
              style={[
                styles.viewerMeta,
                styles.centred,
                turned ? styles.viewerMetaTurned : null,
                turned ? styles.unwrapped : null,
                on ? styles.viewerPillOnMeta : null,
              ]}
            >
              {meta}
            </Text>
          </Pressable>
        </View>
        {right}
      </View>
    </ThemePin>
  );
}
export type Footer = 'plain' | 'count' | 'gallery' | 'upload';
const FOOTERS: Record<
  Footer,
  {
    height: number;
    over?: string;
    stop: string;
  }
> = {
  plain: { height: board.footer, stop: '58%' },
  count: { height: board.footerTall, stop: '62%' },
  gallery: { height: board.footerGallery, over: photo.footerGallery, stop: '' },
  upload: { height: board.footerUpload, over: photo.footerUpload, stop: '' },
};
export function ActionBar({
  children,
  start,
  end,
  above,
  footer,
  keyboardGap,
  style,
}: {
  children: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  above?: ReactNode;
  footer?: Footer;
  keyboardGap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const styles = useStyles();
  const { roomy, room } = useWordRoom();
  const keyboard = useKeyboardShown();
  const kind = FOOTERS[footer ?? (above ? 'count' : 'plain')];
  const sides = start !== undefined || end !== undefined;
  const bottom =
    keyboard && keyboardGap !== undefined ? keyboardGap : Math.max(insets.bottom, board.bottom);
  return (
    <View style={[styles.layer, { paddingBottom: bottom }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            top: undefined,
            height: kind.height,
            experimental_backgroundImage:
              kind.over ?? `linear-gradient(to top, ${color.ink} ${kind.stop}, transparent)`,
          },
        ]}
      />
      {above ? <View style={styles.layerAbove}>{above}</View> : null}
      {sides && roomy ? (
        <View style={styles.layerSides}>
          {start}
          {end}
        </View>
      ) : null}
      <WordRoom.Provider value={sides ? room : null}>
        <View style={styles.layerRow}>
          {sides && !roomy ? start : null}
          {children}
          {sides && !roomy ? end : null}
        </View>
      </WordRoom.Provider>
    </View>
  );
}
export function useFooterOverhang(): number {
  const insets = useSafeAreaInsets();
  return Math.max(
    0,
    board.footer - space.s3 - height.primary - Math.max(insets.bottom, board.bottom),
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
    glassBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s3,
    },
    capsule: {
      flex: 1,
      minWidth: 0,
      minHeight: height.roundViewer,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: photo.bar,
      borderWidth: 1,
      borderColor: photo.barEdge,
    },
    slot: { width: height.roundViewer },
    wizardScale: { marginHorizontal: space.s4, marginTop: space.s3 },
    wizardWords: { marginHorizontal: space.s4, marginTop: 18 },
    wizardWordsEntry: { marginTop: 14 },
    wizardNote: { marginTop: 10 },
    wizardSide: { width: 74, alignItems: 'flex-start' },
    wizardSideNarrow: { width: height.roundBar, alignItems: 'flex-start' },
    wizardRight: { alignItems: 'flex-end' },
    cancelWord: { paddingHorizontal: 10, marginRight: -10 },
    wizardStep: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
    viewerBar: {
      minHeight: height.roundViewer,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: space.s3,
    },
    viewerBarTurned: {
      minHeight: height.roundBar,
      paddingHorizontal: 44,
    },
    viewerMiddle: { flex: 1, minWidth: 0, alignItems: 'center' },
    viewerPill: {
      minHeight: height.roundViewer,
      maxWidth: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      paddingHorizontal: 20,
      paddingVertical: space.s1,
      borderRadius: radius.pill,
      backgroundColor: photo.glass,
      borderWidth: 1,
      borderColor: photo.barEdge,
    },
    viewerPillTurned: {
      minHeight: height.roundBar,
      flexDirection: 'row',
      gap: 9,
      paddingVertical: 0,
    },
    viewerDot: { width: 3, height: 3, borderRadius: radius.pill, backgroundColor: photo.viewerDot },
    viewerMetaTurned: { fontSize: 13 },
    unwrapped: { flexShrink: 0 },
    viewerMeta: { color: photo.viewerMeta },
    viewerPillOn: {
      backgroundColor: photo.pillHeld,
      borderColor: photo.pillHeldEdge,
    },
    viewerPillOnInk: { color: photo.pillHeldInk },
    viewerPillOnMeta: { color: photo.pillHeldMeta },
    centred: { textAlign: 'center' },
    layer: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
    layerAbove: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 },
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    layerSides: { flexDirection: 'row', justifyContent: 'space-between' },
  }),
);
