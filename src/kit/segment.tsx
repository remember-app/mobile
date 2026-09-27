import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { height, radius, space, themed, useTheme } from '@/theme';

import { Hint } from './field';
import { hitSlop, TAP, useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/** One of the values on offer, and the word it is offered under. */
export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentProps<T extends string> = {
  /**
   * The heading over the row, and the radiogroup's name for a screen reader. Drawn the way the
   * layout draws every heading over a group — the eyebrow, in caps, `muted` («ФОРМАТ», «ТЕМА»).
   */
  label: string;
  /**
   * Drawn without that heading, which is then only the spoken one — the row under a screen's bar is
   * titled by the screen itself, and a second heading over it would name the same thing twice.
   */
  hideLabel?: boolean;
  /** Where the setting reaches, said once and quietly, under the row. */
  hint?: string;
  /** Spec 7.3, detail 18: the words at 13 and not 14 — «Тема» on `Account` alone, as drawn. */
  small?: boolean;
  /** Inside a sheet the container is `ink`, because the sheet itself is already `surface`. */
  onSurface?: boolean;
  options: readonly SegmentOption<T>[];
  /** No cell chosen — only ever so in a group that can be let go of (`onClear`). */
  value: T | null;
  onChange: (value: T) => void;
  /**
   * The group may stand with no cell chosen (spec 7.3, detail 18 — the filters): a tap on the chosen
   * cell lets it go. Read out as a row of switches rather than a radiogroup: a radio cannot be
   * unchecked.
   */
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
};

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
  hint,
  small,
  onSurface,
  options,
  value,
  onChange,
  onClear,
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
      {hideLabel ? null : (
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {label.toUpperCase()}
        </Text>
      )}
      <View
        style={[
          styles.segment,
          onSurface ? styles.onSurface : null,
          stacked ? styles.stacked : null,
          measured ? null : styles.unseen,
        ]}
        accessibilityRole={onClear ? undefined : 'radiogroup'}
        accessibilityLabel={label}
        // Read out with the group rather than left to the eye: the line says what picking here
        // actually does, and a screen reader stepping over it would leave the switch unexplained.
        accessibilityHint={hint}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Option
              key={option.value}
              label={option.label}
              small={small}
              stacked={stacked}
              checked={checked}
              switchable={!!onClear}
              onPress={checked && onClear ? onClear : () => onChange(option.value)}
            />
          );
        })}
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
          <Text
            key={option.value}
            role="controlSm"
            style={small ? styles.small : null}
            onLayout={(event) => {
              const word = event.nativeEvent.layout.width;
              setWords((had) => (had[at] === word ? had : Object.assign([...had], { [at]: word })));
            }}
          >
            {option.label}
          </Text>
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
  small,
  stacked,
  checked,
  switchable,
  onPress,
}: {
  label: string;
  small?: boolean;
  stacked: boolean;
  checked: boolean;
  /** A cell of a group that may be left with none chosen: a switch, not a radio. */
  switchable: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  // In the row a cell is drawn at 40 and felt at 44; stacked, it is never under 44 to begin with.
  const tall = stacked ? TAP : height.segment;

  return (
    <Pressable
      accessibilityRole={switchable ? 'togglebutton' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={hitSlop(TAP, tall)}
      onPress={onPress}
      {...props}
      style={[
        styles.option,
        { minHeight: tall },
        stacked ? styles.optionStacked : styles.optionRow,
        checked ? styles.checked : null,
        focused ? focusRing : null,
      ]}
    >
      <Text
        role="controlSm"
        style={[
          small ? styles.small : null,
          stacked ? (small ? styles.linesSmall : styles.lines) : null,
          // Chosen is read on `paper` in `ink`; the rest stay muted — and on web the one under the
          // cursor lights up on its way to being picked.
          { color: checked ? color.ink : hovered ? color.paper : color.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    group: { gap: space.s2 },
    segment: {
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
    stacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      borderRadius: STACKED,
    },
    // Until its words are measured the group does not know which way it stands, so it is not seen.
    unseen: { opacity: 0 },
    measure: { position: 'absolute', top: 0, left: 0, alignItems: 'flex-start', opacity: 0 },
    option: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    // Equal parts, 4 to spare on each side of the word: the row stands only while every word fits
    // whole in that (`rowHolds`).
    optionRow: { flexGrow: 1, flexBasis: 0, paddingHorizontal: space.s1 },
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
