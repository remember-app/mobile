import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, space, themed, useTheme } from '@/theme';

import { useReach } from './interaction';
import { Text } from './text';

/**
 * Spec 7.9 — the small parts. None of them is a component in its own right on any screen; every one
 * of them is a piece another component is built from, and they live together so that the hairline in
 * a list and the hairline in a group heading cannot drift apart.
 */

/** A 1px rule. `grow` is the version that stretches between a label and a count. */
export function Divider({ grow, style }: { grow?: boolean; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.divider, grow ? styles.dividerGrow : null, style]} />;
}

/**
 * The 3px dot between two pieces of meta, and nowhere else in the product. Over a photograph it is
 * drawn in white at 45%, because `lineStrong` would disappear into the picture.
 */
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

/**
 * The wizard's step scale: equal 3px segments with 6 between them. The passed ones and the current
 * one are `accent`; the future ones are `line`.
 *
 * `tone="spark"` is the five-segment variant on the card of a montage being built, where what is
 * done is done rather than in hand — `spark` behind, `accent` on the one running now.
 */
export function StepScale({
  steps,
  done,
  tone = 'accent',
  style,
}: {
  steps: number;
  /** How many are behind, the current one included. */
  done: number;
  tone?: 'accent' | 'spark';
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: steps, now: done }}
      style={[styles.scale, style]}
    >
      {Array.from({ length: steps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.scaleStep,
            i < done - 1 && tone === 'spark' ? styles.scaleSpark : null,
            i < done && (tone === 'accent' || i === done - 1) ? styles.scaleAccent : null,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * A progress bar: 4px filled in `spark` for what the participants have brought, 6px filled in
 * `accent` for what is being sent. It reaches for a new value over 300ms and never runs backwards
 * (spec 6), and it is never drawn without a number beside it — a bar on its own says nothing.
 */
export function Progress({
  value,
  tone = 'accent',
  onPhoto,
  label,
  style,
}: {
  /** 0…1 */
  value: number;
  tone?: 'accent' | 'spark';
  /** Over a cover the track is white at 22%, not `line`. */
  onPhoto?: boolean;
  /** For a screen reader: what this bar is counting. */
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

/**
 * The video scrubber (spec 7.9): timecode, the bar with its `spark` handle, the running time, and
 * the sound button. It stands on a line of its own above the filmstrip so that two horizontal
 * gestures never fight over the same finger.
 */
export function VideoTrack({
  at,
  of,
  value,
  sound,
  label,
}: {
  /** The timecode played so far, «0:24» — a number the screen formats. */
  at: string;
  /** The whole running time, «1:08». */
  of: string;
  /** 0…1 */
  value: number;
  /** The sound button, 36 and round; handed in so this part knows nothing about buttons. */
  sound?: ReactNode;
  label?: string;
}) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View style={styles.videoRow}>
      <Text role="meta" style={styles.onPhoto}>
        {at}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        style={styles.videoTrack}
      >
        <View style={[styles.videoFill, { width: `${clamped * 100}%` }]} />
        <View style={[styles.videoHandle, { left: `${clamped * 100}%` }]} />
      </View>
      <Text role="meta" style={styles.onPhoto}>
        {of}
      </Text>
      {sound}
    </View>
  );
}

/**
 * The stack of frames over the onboarding screens (spec 7.9): three photographs at −9°, +8° and
 * −1.5°, the middle one larger and above the other two. `small` is the squeezed version on
 * `Consent`, where a block of three promises has to fit underneath.
 */
export function PhotoStack({
  photos,
  small,
  style,
}: {
  /**
   * A url, or a picture that ships with the app — the onboarding screens stand before any session
   * and have no frames of a memory to draw. `expo-image` takes either unchanged (`src/image.d.ts`).
   */
  photos: readonly (string | number)[];
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const side = small ? styles.stackSideSm : styles.stackSide;
  const mid = small ? styles.stackMidSm : styles.stackMid;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[small ? styles.stackSmall : styles.stack, style]}
    >
      {/* Keyed by place and not by what is in it: the three stand in fixed positions, and a picture
          that ships with the app is a number the bundler chose. */}
      {photos.slice(0, 3).map((shot, i) => (
        <Image
          key={i}
          source={shot}
          contentFit="cover"
          style={[
            styles.stackShot,
            i === 1 ? mid : side,
            i === 0 ? styles.stackLeft : i === 1 ? styles.stackCentre : styles.stackRight,
          ]}
        />
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    divider: { height: 1, backgroundColor: color.line },
    dividerGrow: { flex: 1 },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color.lineStrong },
    dotOnPhoto: { backgroundColor: photo.dot },
    scale: { flexDirection: 'row', gap: 6 },
    scaleStep: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: color.line },
    scaleAccent: { backgroundColor: color.accent },
    scaleSpark: { backgroundColor: color.spark },
    track: { height: 6, borderRadius: radius.pill, backgroundColor: color.line, overflow: 'hidden' },
    trackThin: { height: 4 },
    trackOnPhoto: { backgroundColor: photo.track },
    fill: { height: '100%', borderRadius: radius.pill },
    fillAccent: { backgroundColor: color.accent },
    fillSpark: { backgroundColor: color.spark },
    videoRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    videoTrack: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: photo.glass },
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
    onPhoto: { color: photo.on },
    stack: { width: 300, height: 220, alignItems: 'center', justifyContent: 'center' },
    stackSmall: { width: 250, height: 180, alignItems: 'center', justifyContent: 'center' },
    stackShot: { position: 'absolute', borderRadius: radius.field },
    stackSide: { width: 144, height: 178 },
    stackMid: { width: 168, height: 196, zIndex: 1 },
    stackSideSm: { width: 120, height: 148 },
    stackMidSm: { width: 140, height: 162, zIndex: 1 },
    stackLeft: { left: 0, transform: [{ rotate: '-9deg' }] },
    stackCentre: { transform: [{ rotate: '-1.5deg' }] },
    stackRight: { right: 0, transform: [{ rotate: '8deg' }] },
  }),
);

/** The dashed empty frame the layout puts where a strip of photographs would be (spec 7.6). */
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
