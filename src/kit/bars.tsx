import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, radius, space } from '@/theme';

import { ICO, Icon, type IconComponent } from './icon';
import { focusRing, hitSlop, useHoverFocus } from './interaction';
import { shade } from './shades';
import { Text } from './text';

/**
 * Section 14 — the top of a screen and the bottom of it. The native header is off everywhere
 * (`headerShown: false`), so a screen draws its own with these.
 */

/**
 * The kit's `.rail-h`: the same film perforation as the memory card's, punched across instead of
 * down. The kit allows it in exactly two places — that card and the top of a screen — so it sits
 * above the appbar and nowhere else. CSS repeats a gradient over whatever width it is given; here
 * the strip counts its own width out into dots at the same 13px pitch.
 */
export function RailH({ style }: { style?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[styles.railH, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: Math.ceil(width / 13) }, (_, i) => (
        <View key={i} style={styles.railDot} />
      ))}
    </View>
  );
}

/**
 * The kit's `.iconbtn`: 40×40 and round, drawn muted until it is touched. `label` is not optional —
 * an icon alone says nothing to a screen reader, and the kit does not let one through unlabelled.
 */
export function IconButton({
  icon,
  label,
  onPress,
  size = ICO,
  disabled,
  style,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      // Drawn at 40, felt at 44.
      hitSlop={hitSlop(40)}
      onPress={onPress}
      {...props}
      style={[
        styles.iconbtn,
        hovered ? styles.iconbtnHover : null,
        focused ? focusRing : null,
        disabled ? styles.off : null,
        style,
      ]}
    >
      <Icon icon={icon} size={size} color={hovered ? color.paper : color.muted} />
    </Pressable>
  );
}

/**
 * The kit's `.appbar`: whatever is on the left, the screen's name, whatever is on the right. The
 * title is `display` at 24 — the kit steps it down from 32 here so a long memory name still fits
 * between two icon buttons.
 */
export function AppBar({
  title,
  left,
  right,
  style,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.appbar, style]}>
      {left}
      <Text role="display" style={styles.appbarTitle} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/**
 * The kit's `.actionbar`: the one action of the screen, held at the bottom above a hairline. Adds
 * the phone's own bottom inset so the button never sits under the home indicator.
 */
export function ActionBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.actionbar, { paddingBottom: Math.max(insets.bottom, space.s4) }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 4.8px holes, first centred 6.5 in, one every 13 — the card's rail laid on its side.
  railH: {
    height: 7,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4.1,
    gap: 8.2,
    overflow: 'hidden',
  },
  railDot: { width: 4.8, height: 4.8, borderRadius: 2.4, backgroundColor: shade.perforation },
  iconbtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconbtnHover: { backgroundColor: color.raise },
  off: { opacity: 0.45 },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingTop: space.s4,
    paddingBottom: space.s3,
  },
  // The kit's -.02em, re-resolved for 24px — it is a ratio in CSS and a flat number here.
  appbarTitle: { flex: 1, fontSize: 24, lineHeight: 25.2, letterSpacing: -0.48 },
  actionbar: {
    flexDirection: 'row',
    gap: space.s3,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.ink,
  },
});
