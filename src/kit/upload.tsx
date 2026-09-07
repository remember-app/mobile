import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { duration as motion, radius, space, themed } from '@/theme';

import { EASE, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Section 9 — sending. One bar for the whole batch, never one per file.
 */

/**
 * The kit's `.progress`. `value` is 0…1. The fill is the one thing moving on the screen while an
 * upload runs, and it moves because a person started it — so it still animates under reduced
 * motion settings only by jumping straight to the number.
 */
export function Progress({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const styles = useStyles();
  const filled = useRef(new Animated.Value(clamp(value))).current;

  useEffect(() => {
    const to = clamp(value);
    if (reduced) {
      filled.setValue(to);
      return;
    }
    // Width is a layout property, so this one cannot ride the native driver.
    const run = Animated.timing(filled, {
      toValue: to,
      duration: motion.slow,
      easing: EASE,
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [value, reduced, filled]);

  return (
    <View
      style={[styles.progress, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value) * 100) }}
    >
      <Animated.View
        style={[
          styles.bar,
          { width: filled.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/**
 * The kit's `.upload`: what is being sent, how far along, and the line underneath that says the
 * phone can be put away. Every word comes from the screen — this only sets the ritual.
 */
export function Upload({
  title,
  meta,
  value,
  hint,
  style,
}: {
  title: string;
  meta?: string;
  value: number;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.upload, style]}>
      <View style={styles.head}>
        <Text role="subtitle" style={styles.headTitle}>
          {title}
        </Text>
        {meta ? <Text role="meta">{meta}</Text> : null}
      </View>
      <Progress value={value} />
      {hint ? <Text role="meta">{hint}</Text> : null}
    </View>
  );
}

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    progress: {
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: color.line,
      overflow: 'hidden',
    },
    bar: { height: '100%', backgroundColor: color.ember, borderRadius: radius.pill },
    upload: { alignSelf: 'stretch', gap: space.s3 },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.s3,
    },
    headTitle: { flexShrink: 1 },
  }),
);
