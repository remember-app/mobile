import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { TAP, hitSlop, useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/** One of the values on offer, and the word it is offered under. */
export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentProps<T extends string> = {
  /** The `t-label` above the row, and the radiogroup's name for a screen reader. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The kit's switch of two or three, section 15 — a radiogroup drawn as a row of pills. Every value
 * is visible at once on purpose: nobody opens a list to find out what a product even offers. This
 * is the kit's answer to a picker, and to the platform's own `Switch`, which is neither of the two
 * lights nor any of the kit's shapes.
 *
 * Controlled, and stateless like everything else in the kit: the caller holds the value and says
 * what the words are. Two callers so far — the theme and the language, side by side in the profile.
 */
export function Segment<T extends string>({ label, options, value, onChange }: SegmentProps<T>) {
  const styles = useStyles();

  return (
    <View style={styles.group}>
      <Text role="label">{label}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => (
          <Option
            key={option.value}
            label={option.label}
            checked={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * One `input + label` pair. Its own component and not a branch of the loop above because hover and
 * focus are per pill, and a hook cannot be called inside a `map`.
 *
 * The kit hides the radio from the eye but not from the keyboard or the voice; React Native has no
 * radio to hide, so the pill is the control and carries the role itself.
 */
function Option({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color, shade } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      // The pill is drawn 38 high, the kit's floor for a finger is 44; the slop is the difference,
      // which is also exactly the padding the row holds it in.
      hitSlop={hitSlop(TAP, 38)}
      onPress={onPress}
      {...props}
      style={[
        styles.option,
        checked ? { backgroundColor: color.raise, borderColor: shade.lineHi } : null,
        focused ? focusRing : null,
      ]}
    >
      <RNText
        numberOfLines={1}
        // Checked is read in paper, the rest stay muted — and on web the one under the cursor
        // lights up on its way to being picked.
        style={[styles.label, { color: checked || hovered ? color.paper : color.muted }]}
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
      // The kit's `inline-flex`: the row is as wide as its words and no wider.
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      padding: 3,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.pill,
    },
    option: {
      // The one number that is not the kit's: a phone is narrower than the page the kit is drawn
      // on. At the kit's `--s4` the three-way theme row measures 332 against the 327 a 375pt phone
      // leaves between the profile's margins, so «Как в телефоне» would lose its last letters on
      // every phone in service. `--s3` is the kit's own padding for a control drawn tighter
      // (`.btn-sm`, `.btn-quiet`, and this pill is 38 high like them), and it brings the row to
      // 308 — inside a 360pt Android too. Every word stays whole and at full size, which is what
      // the kit is actually asking for.
      paddingHorizontal: space.s3,
      // And below that — a phone smaller still, or a person running huge type — a pill that gives
      // way is better than a row that runs off the screen.
      flexShrink: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: radius.pill,
    },
    label: { fontSize: 14, lineHeight: 14, fontWeight: '600' },
  }),
);
