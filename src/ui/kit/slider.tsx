import NativeSlider from '@react-native-community/slider';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/ui/theme';

import { Text } from './text';

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  valueLabel: string;
  note?: string;
  minLabel: string;
  maxLabel: string;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function Slider({
  value,
  onChange,
  min,
  max,
  valueLabel,
  note,
  minLabel,
  maxLabel,
  label,
  style,
}: SliderProps) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View style={[styles.card, style]}>
      <View style={styles.figureWords}>
        <Text role="figureSm">{valueLabel}</Text>
        {note ? <Text role="meta">{note}</Text> : null}
      </View>

      <View style={styles.range}>
        <Text role="metaSm">{minLabel}</Text>
        <NativeSlider
          style={styles.track}
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={1}
          onValueChange={(next) => onChange(Math.round(next))}
          minimumTrackTintColor={color.accent}
          maximumTrackTintColor={color.line}
          thumbTintColor={color.onFill}
          accessibilityLabel={label}
        />
        <Text role="metaSm">{maxLabel}</Text>
      </View>
    </View>
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
    figureWords: { alignItems: 'center', gap: 1 },
    range: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    track: { flex: 1, height: 40 },
  }),
);
