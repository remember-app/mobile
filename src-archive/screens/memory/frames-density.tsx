import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { EASE, Text, useReducedMotion } from '@/kit';
import {
  currentDensity,
  DENSITY_DEFAULT,
  type Density,
  densityWalked,
  setDensity,
} from '@/lib/density';
import { useStrings } from '@/lib/language';
import { duration, height, photo, radius, themed } from '@/theme';

function spread(
  touches: readonly {
    pageX: number;
    pageY: number;
  }[],
): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}
export function useDensityPinch(): {
  pinching: boolean;
  leaving: boolean;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
} {
  const [pinching, setPinching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const reduced = useReducedMotion();
  const base = useRef(0);
  const from = useRef<Density>(DENSITY_DEFAULT);
  const applied = useRef<Density>(DENSITY_DEFAULT);
  const away = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (away.current !== null) clearTimeout(away.current);
    },
    [],
  );
  const letGo = useCallback(() => {
    setPinching(false);
    setLeaving(true);
    away.current = setTimeout(() => {
      away.current = null;
      setLeaving(false);
    }, duration.banner);
  }, []);
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          base.current = spread(event.nativeEvent.touches);
          from.current = currentDensity();
          applied.current = currentDensity();
          if (away.current !== null) {
            clearTimeout(away.current);
            away.current = null;
          }
          setLeaving(false);
          setPinching(true);
        },
        onPanResponderMove: (event) => {
          if (base.current <= 0) return;
          const next = densityWalked(
            from.current,
            spread(event.nativeEvent.touches) / base.current,
          );
          if (next === applied.current) return;
          applied.current = next;
          void setDensity(next);
        },
        onPanResponderRelease: letGo,
        onPanResponderTerminate: letGo,
      }).panHandlers,
    [letGo],
  );
  return { pinching: !reduced && pinching, leaving: !reduced && leaving, panHandlers };
}
export function DensityPill({ value, leaving }: { value: Density; leaving: boolean }) {
  const s = useStrings();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!leaving) {
      fade.setValue(1);
      return;
    }
    const run = Animated.timing(fade, {
      toValue: 0,
      duration: reduced ? 0 : duration.banner,
      easing: EASE,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [leaving, reduced, fade]);
  const one = value === 1;
  return (
    <Animated.View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={one ? s.gallery.onePerRow : s.gallery.framesPerRow(value)}
      pointerEvents="none"
      style={[styles.slot, { opacity: fade }]}
    >
      <View style={styles.pill}>
        <Text role="pillTitle" style={styles.figure}>
          {String(value)}
        </Text>
        <Text role="metaSm" style={styles.caption}>
          {one ? s.gallery.onePerRow : s.gallery.framesPerRowWords}
        </Text>
      </View>
    </Animated.View>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
    pill: {
      maxWidth: '100%',
      minHeight: height.roundViewer,
      paddingHorizontal: 22,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: photo.pillHeldEdge,
      backgroundColor: photo.pillHeld,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    figure: {
      fontSize: 16,
      lineHeight: 19,
      letterSpacing: -0.32,
      color: photo.pillHeldInk,
      fontVariant: ['tabular-nums'],
    },
    caption: { color: photo.pillHeldMeta },
  }),
);
