import { Image } from 'expo-image';
import { Sparkles } from 'lucide-react-native';
import { Children, type ReactNode, useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  PanResponder,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { night, photo, radius, space, themed, useTheme } from '@/theme';
import { Icon } from './icon';
import { useReach } from './interaction';
import { Text, useWordRoom, WordRoom } from './text';
export function Divider({
  grow,
  soft,
  style,
}: {
  grow?: boolean;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.divider,
        soft ? styles.dividerSoft : null,
        grow ? styles.dividerGrow : null,
        style,
      ]}
    />
  );
}
export function Shares({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { roomy, way, room } = useWordRoom();
  return (
    <WordRoom.Provider value={room}>
      <View style={[shares.row, roomy ? shares.column : null, style]}>
        {Children.map(children, (child) =>
          child ? (
            <View key={way} style={roomy ? shares.whole : shares.share}>
              {child}
            </View>
          ) : null,
        )}
      </View>
    </WordRoom.Provider>
  );
}
const shares = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.s2 },
  column: { flexDirection: 'column' },
  share: { flex: 1, minWidth: 0 },
  whole: { flex: 0, alignSelf: 'stretch' },
});
export function MetaDot({ onPhoto }: { onPhoto?: boolean }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, onPhoto ? styles.dotOnPhoto : null]}
    />
  );
}
export function LiveDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.live, style]}
    />
  );
}
export function SparkMark({ style }: { style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.sparkMark, style]}
    >
      <Icon icon={Sparkles} size={12} stroke={2.4} color={color.sparkInk} />
    </View>
  );
}
export function StepScale({
  steps,
  done,
  tone = 'accent',
  stopped,
  label,
  style,
}: {
  steps: number;
  done: number;
  tone?: 'accent' | 'spark' | 'paper';
  stopped?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const reach = useReach(done);
  const paper = tone === 'paper';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: paper ? 1 : 0, max: steps, now: done }}
      style={[styles.scale, style]}
    >
      {Array.from({ length: steps }, (_, i) =>
        paper ? (
          <View key={i} style={[styles.scaleStep, styles.scaleStepPaper]}>
            <Animated.View
              style={[
                styles.scaleFill,
                i === done - 1 && stopped ? styles.scaleStopped : null,
                {
                  width: reach.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        ) : (
          <View
            key={i}
            style={[
              styles.scaleStep,
              i < done - 1 && tone === 'spark' ? styles.scaleSpark : null,
              i < done && (tone === 'accent' || i === done - 1) ? styles.scaleAccent : null,
            ]}
          />
        ),
      )}
    </View>
  );
}
export function Progress({
  value,
  tone = 'accent',
  onPhoto,
  label,
  style,
}: {
  value: number;
  tone?: 'accent' | 'spark';
  onPhoto?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, value));
  const width = useReach(clamped * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        styles.track,
        tone === 'spark' ? styles.trackThin : null,
        onPhoto ? styles.trackOnPhoto : null,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          tone === 'spark' ? styles.fillSpark : styles.fillAccent,
          { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}
const STEP = 0.05;
const STEPS = [{ name: 'increment' }, { name: 'decrement' }];
export function VideoTrack({
  at,
  of,
  value,
  onSeek,
  sound,
  label,
}: {
  at: string;
  of: string;
  value: number;
  onSeek?: (value: number) => void;
  sound?: ReactNode;
  label?: string;
}) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, value));
  const [held, setHeld] = useState<number | null>(null);
  const width = useRef(0);
  const shown = held ?? clamped;
  const reached = useReach(shown * 100);
  const place =
    held === null
      ? reached.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
      : (`${held * 100}%` as `${number}%`);
  const take = (e: GestureResponderEvent) => {
    const to =
      width.current === 0 ? 0 : Math.max(0, Math.min(1, e.nativeEvent.locationX / width.current));
    setHeld(to);
    onSeek?.(to);
  };
  const pan = !onSeek
    ? null
    : PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: take,
        onPanResponderMove: take,
        onPanResponderRelease: (e) => {
          take(e);
          setHeld(null);
        },
        onPanResponderTerminate: () => setHeld(null),
      });
  return (
    <View style={styles.videoRow}>
      <Text role="timecode" style={styles.elapsed}>
        {at}
      </Text>
      <View
        accessibilityRole={onSeek ? 'adjustable' : 'progressbar'}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
        accessibilityActions={onSeek ? STEPS : undefined}
        onAccessibilityAction={
          onSeek &&
          ((e) =>
            onSeek(
              Math.max(
                0,
                Math.min(1, shown + (e.nativeEvent.actionName === 'decrement' ? -STEP : STEP)),
              ),
            ))
        }
        style={styles.videoPad}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        {...pan?.panHandlers}
      >
        <View style={styles.videoTrack} pointerEvents="none">
          <Animated.View style={[styles.videoFill, { width: place }]} />
          <Animated.View style={[styles.videoHandle, { left: place }]} />
        </View>
      </View>
      <Text role="timecode" style={styles.runs}>
        {of}
      </Text>
      {sound}
    </View>
  );
}
export function PhotoStack({
  photos,
  style,
}: {
  photos: readonly (string | number)[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const place = [styles.stackLeft, styles.stackCentre, styles.stackRight];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stack, style]}
    >
      {photos.slice(0, 3).map((shot, i) => (
        <Image key={i} source={shot} contentFit="cover" style={[styles.stackShot, place[i]]} />
      ))}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    divider: { height: 1, backgroundColor: color.line },
    dividerSoft: { backgroundColor: color.raise },
    dividerGrow: { flex: 1 },
    dashedNote: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.line,
      borderRadius: radius.field,
      paddingVertical: 23,
      paddingHorizontal: space.s4,
    },
    centred: { textAlign: 'center' },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color.lineStrong },
    dotOnPhoto: { backgroundColor: photo.dot },
    live: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.danger },
    sparkMark: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scale: { flexDirection: 'row', gap: 6 },
    scaleStep: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: color.line },
    scaleStepPaper: { height: 4, backgroundColor: color.line, overflow: 'hidden' },
    scaleFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.paper },
    scaleStopped: { backgroundColor: color.dangerText },
    scaleAccent: { backgroundColor: color.accent },
    scaleSpark: { backgroundColor: color.spark },
    track: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: color.line,
      overflow: 'hidden',
    },
    trackThin: { height: 4 },
    trackOnPhoto: { backgroundColor: photo.track },
    fill: { height: '100%', borderRadius: radius.pill },
    fillAccent: { backgroundColor: color.accent },
    fillSpark: { backgroundColor: color.spark },
    videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    videoPad: { flex: 1, justifyContent: 'center', paddingVertical: space.s4 },
    videoTrack: { height: 4, borderRadius: radius.pill, backgroundColor: photo.videoTrack },
    videoFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.spark },
    videoHandle: {
      position: 'absolute',
      width: 14,
      height: 14,
      top: -5,
      marginLeft: -7,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
    },
    elapsed: { color: night.paper },
    runs: { color: photo.viewerMeta },
    stack: { width: '100%', maxWidth: 390, height: 176, alignItems: 'center', overflow: 'hidden' },
    stackShot: { position: 'absolute' },
    stackLeft: {
      left: 34,
      top: 12,
      width: 116,
      height: 144,
      borderRadius: radius.cell,
      transform: [{ rotate: '-9deg' }],
    },
    stackCentre: {
      top: 16,
      width: 136,
      height: 158,
      borderRadius: radius.field,
      zIndex: 1,
      transform: [{ rotate: '-1.5deg' }],
    },
    stackRight: {
      right: 34,
      top: 6,
      width: 116,
      height: 144,
      borderRadius: radius.cell,
      transform: [{ rotate: '8deg' }],
    },
  }),
);
export function DashedNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.dashedNote, style]}>
      <Text role="note" style={styles.centred}>
        {text}
      </Text>
    </View>
  );
}
export function DashedFrame({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: color.dashed,
          borderRadius: radius.strip,
          backgroundColor: color.raise,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s2,
          padding: space.s4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
