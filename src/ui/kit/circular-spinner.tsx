import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/ui/theme';

export function CircularSpinner({ size = 16, stroke = 2 }: { size?: number; stroke?: number }) {
  const { color } = useTheme();
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
  }, [turn]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));

  const radius = (size - stroke) / 2;
  const around = 2 * Math.PI * radius;
  const centre = size / 2;

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size}>
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={color.line}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={color.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${around * 0.28} ${around * 0.72}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
