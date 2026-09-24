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
  /** Inside a sheet the container is `ink`, because the sheet itself is already `surface`. */
  onSurface?: boolean;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Spec 7.3 — a choice of two or three, drawn as a row of pills inside one. Every value is visible at
 * once on purpose: nobody opens a list to find out what a product even offers.
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
  onSurface,
  options,
  value,
  onChange,
  style,
}: SegmentProps<T>) {
  const styles = useStyles();
  // Spec 7.3: a long word steps down to 13 rather than wrapping or being cut.
  const long = options.some((option) => option.label.length > 11);

  return (
    <View style={[styles.group, style]}>
      {hideLabel ? null : <Text role="label">{label}</Text>}
      <View
        style={[styles.segment, onSurface ? styles.onSurface : null, wide ? styles.wide : null]}
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
            long={long}
            checked={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
      {hint ? <Hint>{hint}</Hint> : null}
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
  long,
  checked,
  onPress,
}: {
  label: string;
  wide?: boolean;
  sm?: boolean;
  long?: boolean;
  checked: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const tall = sm ? height.segmentSm : height.segment;

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
        wide ? styles.optionWide : null,
        checked ? styles.checked : null,
        focused ? focusRing : null,
      ]}
    >
      <RNText
        numberOfLines={1}
        style={[
          type.controlSm,
          long ? styles.long : null,
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
    option: {
      paddingHorizontal: space.s3,
      // Below the smallest phone, or with huge type on, a pill that gives way beats a row that runs
      // off the screen.
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    optionWide: { flexGrow: 1, flexBasis: 0, paddingHorizontal: space.s2 },
    checked: { backgroundColor: color.paper },
    long: { fontSize: 13 },
  }),
);
