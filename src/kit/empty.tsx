import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { color, space } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { useLoop } from './interaction';
import { Text } from './text';

/**
 * Section 6 of the kit — nothing here yet, and waiting for something.
 */

/**
 * The kit's `.spinner`: a ring with one lit segment, turning once every 700ms. The only thing in the
 * product allowed to move on its own — and even it stops when the phone says to reduce motion, which
 * is why the still ring below is a real state and not a fallback.
 *
 * The busy button borrows it with its own colours: `track` currentColor, `head` transparent.
 */
export function Spinner({
  size = 22,
  track = color.line,
  head = color.ember,
}: {
  size?: number;
  track?: string;
  head?: string;
}) {
  const turn = useLoop(700);
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    // The kit draws the ring at 2 everywhere and has no modifier for it.
    borderWidth: 2,
    borderColor: track,
    borderTopColor: head,
  };

  if (!turn) return <View style={ring} />;

  return (
    <Animated.View
      style={[
        ring,
        {
          transform: [
            { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          ],
        },
      ]}
    />
  );
}

/**
 * The kit's `.empty`. Empty is an invitation, not a report — so the text is the next step and
 * `children` is the button that takes it. Pass `busy` instead of an `icon` for the waiting version:
 * it holds the place of the list rather than blinking over it.
 */
export function Empty({
  icon,
  busy,
  text,
  children,
}: {
  icon?: IconComponent;
  busy?: boolean;
  text: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {busy ? <Spinner /> : null}
      {/* The icon only ever repeats the text below it, so screen readers are spared it. */}
      {!busy && icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon icon={icon} size={28} color={color.muted} />
        </View>
      ) : null}
      <Text style={styles.text}>{text}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s8,
    paddingHorizontal: space.s5,
  },
  // 15/1.45 muted, held to the kit's 34ch so the line never runs the width of a tablet.
  text: { fontSize: 15, lineHeight: 21.75, color: color.muted, textAlign: 'center', maxWidth: 260 },
});
