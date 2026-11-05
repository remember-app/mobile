import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { height, radius, space, themed, useTheme } from '@/ui/theme';
import { Hint } from './field';
import { hitSlop, TAP, useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';
export type SegmentOption<T extends string | number> = {
  value: T;
  label: string;
};
export type SegmentProps<T extends string | number> = {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  small?: boolean;
  onSurface?: boolean;
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
};
const STACKED = 22;
export function rowHolds(width: number, words: readonly number[]): boolean {
  const cell = (width - 2 * (space.s1 + 1) - space.s1 * (words.length - 1)) / words.length;
  return words.every((word) => word <= cell - 2 * space.s1);
}
export function Segment<T extends string | number>({
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
  switchable: boolean;
  onPress: () => void;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
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
    unseen: { opacity: 0 },
    measure: { position: 'absolute', top: 0, left: 0, alignItems: 'flex-start', opacity: 0 },
    option: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    optionRow: { flexGrow: 1, flexBasis: 0, paddingHorizontal: space.s1 },
    optionStacked: {
      paddingVertical: space.s2,
      paddingHorizontal: space.s3,
      borderRadius: STACKED - space.s1,
    },
    checked: { backgroundColor: color.paper },
    small: { fontSize: 13 },
    lines: { lineHeight: 18, textAlign: 'center' },
    linesSmall: { lineHeight: 17, textAlign: 'center' },
  }),
);
