import { Minus, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { IconButton } from './button';
import { PRESS, TAP, hitSlop, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.3, detail 19 — how long the film should be. A card with the figure in the middle of it, a
 * button on each side that moves it by five seconds, the line it can be dragged along, and five
 * lengths worth having as ready answers.
 *
 * It knows nothing about time: every figure it draws — the value, the two ends, the presets — comes
 * in as a word already formatted, because «2:30» and «9:10 · всё, что есть» are the screen's to
 * write. What it holds is a number of seconds and the two walls it runs between.
 *
 * The figure is any whole number of seconds between the walls. The line moves it by the second, and
 * the two buttons and a screen reader's increment by five from wherever it stands, never onto a
 * multiple of five: a figure this control did not set — a template's 2:32 — stays exactly what it
 * was until somebody moves it.
 */
const NUDGE = 5;

export type LengthSliderProps = {
  /** Seconds. */
  value: number;
  onChange: (seconds: number) => void;
  min: number;
  /** Worked out from the material: `min(10:00, Σ video + 2.5s × photos)` — the screen does that sum. */
  max: number;
  /** «2:30» — the value, written out. */
  valueLabel: string;
  /** «из шаблона „Для родителей“», under the figure. */
  note?: string;
  /** «0:10» and «9:10 · всё, что есть», under the two ends of the line. */
  minLabel: string;
  maxLabel: string;
  /** What the whole control is called, and what each of the two buttons does. */
  label: string;
  shorterLabel: string;
  longerLabel: string;
  /** «0:30 · 1:00 · 1:30 · 3:00 · Всё» — a word and the seconds behind it. */
  presets?: readonly { label: string; value: number }[];
  style?: StyleProp<ViewStyle>;
};

/** A whole number of seconds between both walls — the one place either of those is decided. */
function clamp(seconds: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(seconds)));
}

/** How far along the line a figure stands, 0 to 1 — which is where its handle is drawn. */
function place(seconds: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (seconds - min) / Math.max(1, max - min)));
}

/**
 * What a finger that lands at `x` on a line `width` wide does to the figure: the figure at each
 * later point of it, or `null` while that is still the one already standing — a finger that has not
 * moved it has nothing to say. Landing within a touch target of the handle takes the figure where it
 * stands, because the point the finger happened to hit is not a length anybody chose; anywhere else
 * on the line the figure goes to the finger.
 */
export function grabLength(
  x: number,
  width: number,
  { value, min, max }: { value: number; min: number; max: number },
): (to: number) => number | null {
  const under = (at: number) => min + (width === 0 ? 0 : at / width) * Math.max(1, max - min);
  const from = Math.abs(x - place(value, min, max) * width) <= TAP / 2 ? under(x) - value : 0;
  let last = value;
  return (to) => {
    // Spec 7.3: at the wall the handle simply stops — the figure never runs past what there is
    // material for.
    const next = clamp(under(to) - from, min, max);
    if (next === last) return null;
    last = next;
    return next;
  };
}

export function LengthSlider({
  value,
  onChange,
  min,
  max,
  valueLabel,
  note,
  minLabel,
  maxLabel,
  label,
  shorterLabel,
  longerLabel,
  presets,
  style,
}: LengthSliderProps) {
  const styles = useStyles();
  const focusRing = useFocusRing();
  const { focused, props } = useHoverFocus();
  /** How wide the line is, measured rather than assumed: it is whatever the card leaves it. */
  const width = useRef(0);
  /** What the finger that is down makes of the figure, taken the moment it lands. */
  const hold = useRef<(x: number) => number | null>(() => null);
  /** Where the finger is holding it, and `null` when nothing is. */
  const [held, setHeld] = useState<number | null>(null);
  const at = place(held ?? value, min, max);

  const follow = (e: GestureResponderEvent) => {
    const seconds = hold.current(e.nativeEvent.locationX);
    if (seconds === null) return;
    setHeld(seconds);
    onChange(seconds);
  };

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      hold.current = grabLength(e.nativeEvent.locationX, width.current, { value, min, max });
      follow(e);
    },
    onPanResponderMove: follow,
    onPanResponderRelease: (e) => {
      follow(e);
      setHeld(null);
    },
    onPanResponderTerminate: () => setHeld(null),
  });

  const move = (by: number) => onChange(clamp(value + by, min, max));

  return (
    <View style={[styles.card, style]}>
      <View style={styles.figureRow}>
        <IconButton
          icon={Minus}
          label={shorterLabel}
          tone="raise"
          onPress={() => move(-NUDGE)}
          disabled={value <= min}
        />
        <View style={styles.figureWords}>
          <Text role="figureSm">{valueLabel}</Text>
          {note ? <Text role="meta">{note}</Text> : null}
        </View>
        <IconButton
          icon={Plus}
          label={longerLabel}
          tone="raise"
          onPress={() => move(NUDGE)}
          disabled={value >= max}
        />
      </View>

      <View style={styles.line}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          // The `aria-` spelling of `accessibilityValue`: React Native maps one onto the other, and
          // the text form is the point — «150 секунд» says nothing to anybody and «2:30» does.
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueLabel}
          accessibilityActions={STEPS}
          onAccessibilityAction={(e) =>
            move(e.nativeEvent.actionName === 'decrement' ? -NUDGE : NUDGE)
          }
          {...props}
          style={[styles.pad, focused ? focusRing : null]}
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
        >
          <View style={styles.track} pointerEvents="none">
            <View style={[styles.fill, { width: `${at * 100}%` }]} />
            <View style={[styles.handle, { left: `${at * 100}%` }]} />
          </View>
        </View>
        <View style={styles.ends}>
          <Text role="meta" tone="muted">
            {minLabel}
          </Text>
          <Text role="meta" tone="muted">
            {maxLabel}
          </Text>
        </View>
      </View>

      {presets ? (
        <View style={styles.presets}>
          {presets.map((preset) => {
            // Spec 7.3, «материала на 40 с»: a ready answer longer than there is material for is
            // not offered at all. Clamping it instead would make «3:00» quietly mean «0:40», and
            // three pills that all set the same length are three lies in a row.
            const over = preset.value > max;
            return (
              <Preset
                key={preset.label}
                label={preset.label}
                selected={!over && clamp(preset.value, min, max) === value}
                disabled={over}
                onPress={() => onChange(clamp(preset.value, min, max))}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** What a screen reader may do to a control it cannot drag. */
const STEPS = [{ name: 'increment' }, { name: 'decrement' }];

/** One of the five ready lengths: a 32 pill, quiet until it is the one the value stands on. */
function Preset({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Longer than the material: spec 7.3 leaves the pill standing and takes the press away. */
  disabled?: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop(TAP, height.roundTiny)}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.preset,
        disabled ? styles.presetOff : selected ? styles.presetOn : hovered ? styles.presetHover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <Text
        role="label"
        style={[
          styles.presetWord,
          // Spec 7.3, detail 16: unavailable is `faint` on the quieter of the two borders.
          { color: disabled ? color.faint : selected ? color.ink : color.paper },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.section,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      paddingTop: space.s4 - 2,
      paddingHorizontal: space.s4,
      paddingBottom: space.s4,
      gap: space.s3,
    },
    figureRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    figureWords: { flex: 1, alignItems: 'center', gap: 1 },
    line: { gap: 6 },
    // The bar is 6 tall and the finger's share of it is 26, the width of the handle: spec 10.2 again,
    // and the whole row is dragged rather than the handle alone.
    pad: { height: 26, justifyContent: 'center' },
    track: { height: 6, borderRadius: radius.pill, backgroundColor: color.line },
    fill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },
    handle: {
      position: 'absolute',
      width: 26,
      height: 26,
      top: -10,
      marginLeft: -13,
      borderRadius: radius.pill,
      backgroundColor: color.onFill,
      boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
    },
    ends: { flexDirection: 'row', justifyContent: 'space-between' },
    presets: { flexDirection: 'row', gap: 6 },
    preset: {
      flex: 1,
      height: height.roundTiny,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineQuiet,
    },
    presetOn: { backgroundColor: color.paper, borderColor: color.paper },
    presetOff: { borderColor: color.line },
    presetHover: { backgroundColor: color.raise },
    presetWord: { fontVariant: ['tabular-nums'] },
  }),
);
