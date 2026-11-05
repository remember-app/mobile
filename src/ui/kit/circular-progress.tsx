import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/ui/theme';

type Props = {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
};

export function CircularProgress({ value, size = 28, stroke = 3, color, track }: Props) {
  const theme = useTheme();
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const share = Math.min(Math.max(value, 0), 1);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track ?? theme.color.raise}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.color.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - share)}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
