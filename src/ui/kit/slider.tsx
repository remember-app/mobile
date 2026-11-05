import NativeSlider from '@react-native-community/slider';
import { Minus, Plus } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/ui/theme';

import { IconButton } from './button';
import { drawnAs } from './icon';
import { Text } from './text';

const NUDGE = 5;
const NUDGE_GLYPH = { size: 18, stroke: 2.2 } as const;
const LESS = drawnAs(Minus, 12 / 14);
const MORE = drawnAs(Plus, 12 / 14);

export type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  valueLabel: string;
  note?: string;
  minLabel: string;
  maxLabel: string;
  label: string;
  shorterLabel: string;
  longerLabel: string;
  style?: StyleProp<ViewStyle>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

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
  shorterLabel,
  longerLabel,
  style,
}: SliderProps) {
  const styles = useStyles();
  const { color } = useTheme();
  const move = (by: number) => onChange(clamp(value + by, min, max));

  return (
    <View style={[styles.card, style]}>
      <View style={styles.figureRow}>
        <IconButton
          icon={LESS}
          label={shorterLabel}
          tone="raise"
          glyph={NUDGE_GLYPH}
          onPress={() => move(-NUDGE)}
          disabled={value <= min}
        />
        <View style={styles.figureWords}>
          <Text role="figureSm">{valueLabel}</Text>
          {note ? <Text role="meta">{note}</Text> : null}
        </View>
        <IconButton
          icon={MORE}
          label={longerLabel}
          tone="raise"
          glyph={NUDGE_GLYPH}
          onPress={() => move(NUDGE)}
          disabled={value >= max}
        />
      </View>

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

      <View style={styles.ends}>
        <Text role="metaSm">{minLabel}</Text>
        <Text role="metaSm" style={styles.endRight}>
          {maxLabel}
        </Text>
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
    figureRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    figureWords: { flex: 1, alignItems: 'center', gap: 1 },
    track: { width: '100%', height: 40 },
    ends: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s3 },
    endRight: { marginLeft: 'auto', textAlign: 'right' },
  }),
);
