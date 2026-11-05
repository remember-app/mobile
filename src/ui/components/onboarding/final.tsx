import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/ui/kit/text';
import { useTheme } from '@/ui/theme';

const COLORS = ['spark', 'accent', 'danger', 'paper', 'quote'] as const;
const PIECES = 26;

function Piece({ index, height, color }: { index: number; height: number; color: string }) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.value = withDelay(
      index * 70,
      withRepeat(
        withTiming(1, {
          duration: 1900 + (index % 5) * 350,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
  }, [fall, index]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -40 + fall.value * (height + 80) },
      { rotate: `${fall.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: `${(index * 37) % 100}%`,
          width: 6 + (index % 3),
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function OnboardingFinal({ name, onDone }: { name: string; onDone: () => void }) {
  const { height } = useWindowDimensions();
  const { color } = useTheme();
  const fade = useSharedValue(1);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = useCallback(() => done.current(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fade.value = withTiming(
        0,
        { duration: 1100, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) scheduleOnRN(finish);
        },
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [fade, finish]);

  const sheet = useAnimatedStyle(() => ({
    transform: [{ scale: fade.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.sheet, { backgroundColor: color.ink }, sheet]}
    >
      {Array.from({ length: PIECES }, (_, index) => (
        <Piece
          key={index}
          index={index}
          height={height}
          color={color[COLORS[index % COLORS.length]]}
        />
      ))}
      <View style={styles.centre} pointerEvents="none">
        <Text role="heroSm" tone="paper" style={styles.name}>
          {`@${name}`}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: 'hidden',
    zIndex: 10,
  },
  piece: {
    position: 'absolute',
    top: 0,
    height: 10,
    borderRadius: 2,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  name: {
    textAlign: 'center',
  },
});
