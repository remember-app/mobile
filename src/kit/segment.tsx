import { useState } from 'react';
import {
  Pressable,
  Text as RNText,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { height, radius, space, themed, type, useTheme } from '@/theme';

import { Hint } from './field';
import { hitSlop, TAP, useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/** One of the values on offer, and the word it is offered under. */
export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentProps<T extends string> = {
  /** The heading over the row, and the radiogroup's name for a screen reader. */
  label: string;
  /**
   * Drawn without that heading, which is then only the spoken one — the row under a screen's bar is
   * titled by the screen itself, and a second heading over it would name the same thing twice.
   */
  hideLabel?: boolean;
  /** The row spans its column and splits it evenly, instead of being as wide as its words. */
  wide?: boolean;
  /** Where the setting reaches, said once and quietly, under the row. */
  hint?: string;
  /** Spec 7.3: 36 inside a memory's own header pill, 40 everywhere else. */
  sm?: boolean;
  /** Spec 7.3, detail 18: the words at 13 and not 14 — «Тема» on `Account` alone, as drawn. */
  small?: boolean;
  /** Inside a sheet the container is `ink`, because the sheet itself is already `surface`. */
  onSurface?: boolean;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Spec 7.3, detail 18: a word grows with the system's type up to twice its size and no further —
 * past that the longest of them would not fit whole even in a cell of its own on the smallest phone.
 */
const MOST = 2;

/** Spec 7.3, detail 18: the stacked container's corners; its cells sit concentric, 4 inside them. */
const STACKED = 22;

/**
 * Spec 7.3, detail 18 — whether the group stands as a row in a column `width` wide: every word, as
 * wide as it is drawn, whole on one line in its equal share, with 4 to spare on each side. The
 * container's padding and hairline come off first (4 + 1 a side), then the gaps between the cells.
 */
export function rowHolds(width: number, words: readonly number[]): boolean {
  const cell = (width - 2 * (space.s1 + 1) - space.s1 * (words.length - 1)) / words.length;
  return words.every((word) => word <= cell - 2 * space.s1);
}

/**
 * Spec 7.3 — a choice of two or three, drawn as a row of pills inside one. Every value is visible at
 * once on purpose: nobody opens a list to find out what a product even offers.
 *
 * A row only while every word reads whole in its cell; otherwise the whole group stands as a column,
 * a cell per word the width of the container (spec 7.3, detail 18) — never an ellipsis, never a
 * word broken letter by letter. Which of the two is decided off the words as they are drawn right
 * now, at the system's type size and in the app's language, and before the group is first seen, so
 * it never jumps in front of anyone. Picking a value moves no width, so it never moves the group.
 *
 * Controlled and wordless, like everything else here: the caller holds the value and says what the
 * words are.
 */
export function Segment<T extends string>({
  label,
  hideLabel,
  wide,
  hint,
  sm,
  small,
  onSurface,
  options,
  value,
  onChange,
  style,
}: SegmentProps<T>) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [words, setWords] = useState<readonly number[]>([]);
  const drawn = options.map((_, at) => words[at]);
  const measured = width > 0 && drawn.every((word) => word !== undefined);
  const stacked = measured && !rowHolds(width, drawn);

  return (
    <View
      style={[styles.group, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {hideLabel ? null : <Text role="label">{label}</Text>}
      <View
        style={[
          styles.segment,
          onSurface ? styles.onSurface : null,
          wide ? styles.wide : null,
          stacked ? styles.stacked : null,
          measured ? null : styles.unseen,
        ]}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        // Read out with the group rather than left to the eye: the line says what picking here
        // actually does, and a screen reader stepping over it would leave the switch unexplained.
        accessibilityHint={hint}
      >
        {options.map((option) => (
          <Option
            key={option.value}
            label={option.label}
            wide={wide}
            sm={sm}
            small={small}
            stacked={stacked}
            checked={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
      {hint ? <Hint>{hint}</Hint> : null}
      {/* The same words once more, unseen and outside any cell, so each lays out exactly as wide as
          it is drawn — and lays out again, and says so, when the type size or the language changes. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        {options.map((option, at) => (
          <RNText
            key={option.value}
            maxFontSizeMultiplier={MOST}
            style={[type.controlSm, small ? styles.small : null]}
            onLayout={(event) => {
              const word = event.nativeEvent.layout.width;
              setWords((had) => (had[at] === word ? had : Object.assign([...had], { [at]: word })));
            }}
          >
            {option.label}
          </RNText>
        ))}
      </View>
    </View>
  );
}

/**
 * One pill. Its own component and not a branch of the loop above because hover and focus are per
 * pill, and a hook cannot be called inside a `map`.
 *
 * The layout hides the radio from the eye but not from the keyboard or the voice; React Native has
 * no radio to hide, so the pill is the control and carries the role itself.
 */
function Option({
  label,
  wide,
  sm,
  small,
  stacked,
  checked,
  onPress,
}: {
  label: string;
  wide?: boolean;
  sm?: boolean;
  small?: boolean;
  stacked: boolean;
  checked: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  // In the row a cell is drawn at 40 and felt at 44; stacked, it is never under 44 to begin with.
  const tall = stacked ? TAP : sm ? height.segmentSm : height.segment;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={hitSlop(TAP, tall)}
      onPress={onPress}
      {...props}
      style={[
        styles.option,
        { minHeight: tall },
        stacked ? styles.optionStacked : wide ? styles.optionWide : null,
        checked ? styles.checked : null,
        focused ? focusRing : null,
      ]}
    >
      <RNText
        maxFontSizeMultiplier={MOST}
        style={[
          type.controlSm,
          small ? styles.small : null,
          stacked ? (small ? styles.linesSmall : styles.lines) : null,
          // Chosen is read on `paper` in `ink`; the rest stay muted — and on web the one under the
          // cursor lights up on its way to being picked.
          { color: checked ? color.ink : hovered ? color.paper : color.muted },
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    group: { gap: space.s2 },
    segment: {
      // The row is as wide as its words and no wider, until `wide` says otherwise.
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      padding: space.s1,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.pill,
    },
    onSurface: { backgroundColor: color.ink },
    wide: { alignSelf: 'stretch' },
    stacked: {
      alignSelf: 'stretch',
      flexDirection: 'column',
      alignItems: 'stretch',
      borderRadius: STACKED,
    },
    // Until its words are measured the group does not know which way it stands, so it is not seen.
    unseen: { opacity: 0 },
    measure: { position: 'absolute', top: 0, left: 0, alignItems: 'flex-start', opacity: 0 },
    option: {
      paddingHorizontal: space.s3,
      // Below the smallest phone, or with huge type on, a pill that gives way beats a row that runs
      // off the screen.
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    // Equal parts, 4 to spare on each side of the word: the row stands only while every word fits
    // whole in that (`rowHolds`).
    optionWide: { flexGrow: 1, flexBasis: 0, paddingHorizontal: space.s1 },
    optionStacked: {
      paddingVertical: space.s2,
      paddingHorizontal: space.s3,
      borderRadius: STACKED - space.s1,
    },
    checked: { backgroundColor: color.paper },
    small: { fontSize: 13 },
    // Stacked, a word too long for its line goes on to the next one whole, centred under it.
    lines: { lineHeight: 18, textAlign: 'center' },
    linesSmall: { lineHeight: 17, textAlign: 'center' },
  }),
);
