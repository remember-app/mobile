import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { photo, radius, space, themed, useTheme } from '@/theme';

import { type MontageState } from './badge';
import { StepScale } from './bits';
import { Spinner } from './empty';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.6 — a montage, in the three states that are three different bodies rather than three
 * colours of one:
 *
 * - **ready** — a poster with the play circle on it, the name, what it was made of, and the way to
 *   keep it;
 * - **pending** — no poster at all, because there is nothing to show yet: a five-segment scale and
 *   the stage it is on, named in words. «73 %» tells a person nothing; «Режиссёр строит историю»
 *   does;
 * - **failed** — the dangerous border, a line saying where it broke, and the way to try again.
 */
export function CardMontage({
  title,
  meta,
  state,
  poster,
  length,
  vertical,
  caption,
  badge,
  step,
  onPlay,
  playLabel,
  onPress,
  children,
  style,
}: {
  title: string;
  /** «13 сентября · горизонтальный · Яркая» — written by the screen. */
  meta?: string;
  state: MontageState;
  poster?: string | null;
  /** The running time in the poster's corner, «1:04». */
  length?: string;
  /** A vertical montage gets a taller poster; the frame inside it is never stretched either way. */
  vertical?: boolean;
  /** «Мы сообщим, когда будет готов» / «Сборка оборвалась на полпути». */
  caption?: string;
  /** The state badge — its words belong to the screen. */
  badge?: ReactNode;
  /** Where the building has got to: five segments, the stage's own name, and «3 из 5». */
  step?: { done: number; of: number; label: string; count: string };
  onPlay?: () => void;
  playLabel?: string;
  /** The whole card leads somewhere while it is building. */
  onPress?: () => void;
  /** «Сохранить и поделиться», «Повторить» — a secondary button the screen names. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color, shadow } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.card,
        { boxShadow: shadow.card },
        state === 'failed' ? styles.failed : null,
        hovered && onPress ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {state === 'ready' && poster ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playLabel ?? title}
          disabled={!onPlay}
          onPress={onPlay}
          style={[styles.poster, vertical ? styles.posterTall : null]}
        >
          <Image
            source={{ uri: poster }}
            contentFit={vertical ? 'contain' : 'cover'}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.posterScrim]} />
          <View style={styles.play}>
            <Icon icon={Play} size={24} color={color.ink} fill={color.ink} />
          </View>
          {length ? (
            <View style={styles.length}>
              <Text role="meta" style={styles.onPhoto}>
                {length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.body}>
        <Text role="title" numberOfLines={2}>
          {title}
        </Text>
        {meta ? <Text role="meta">{meta}</Text> : null}
        {caption ? (
          <Text role="meta" tone={state === 'failed' ? 'danger' : 'muted'}>
            {caption}
          </Text>
        ) : null}

        {step ? (
          <View style={styles.step}>
            <StepScale steps={step.of} done={step.done} tone="spark" />
            <View style={styles.stepLine}>
              <Spinner size={16} />
              <Text role="meta" tone="paper" style={styles.grow}>
                {step.label}
              </Text>
              <Text role="meta">{step.count}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.foot}>
          {badge}
          <View style={styles.grow} />
          {children}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    // Spec 10.5 settles one dangerous border for every dangerous surface in the product.
    failed: { borderColor: color.dangerEdge },
    hover: { backgroundColor: color.raise },
    poster: { height: 200, backgroundColor: color.ink },
    posterTall: { aspectRatio: 4 / 5, height: undefined },
    posterScrim: { backgroundColor: photo.picked },
    play: {
      alignSelf: 'center',
      marginTop: 'auto',
      marginBottom: 'auto',
      width: 62,
      height: 62,
      borderRadius: radius.pill,
      backgroundColor: photo.on,
      alignItems: 'center',
      justifyContent: 'center',
    },
    length: {
      position: 'absolute',
      right: space.s2,
      bottom: space.s2,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
    },
    onPhoto: { color: photo.on },
    body: { padding: space.s4, gap: space.s2 },
    step: { gap: space.s2, paddingVertical: space.s1 },
    stepLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingTop: space.s1 },
    grow: { flex: 1, minWidth: 0 },
  }),
);
