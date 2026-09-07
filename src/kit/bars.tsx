import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, themed, useTheme } from '@/theme';

import { ICO, Icon, type IconComponent } from './icon';
import { hitSlop, useFocusRing, useHoverFocus } from './interaction';
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
  const styles = useStyles();

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
  tint,
  disabled,
  style,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
  size?: number;
  /**
   * What it is drawn in when untouched — `.viewer__bar .iconbtn{color:var(--paper)}`, the kit's one
   * override of the muted default. Over an open frame there is no surface behind the icon, so muted
   * is the difference between an action and a smudge.
   */
  tint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

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
      <Icon icon={icon} size={size} color={hovered ? color.paper : (tint ?? color.muted)} />
    </Pressable>
  );
}

/**
 * The kit's `.appbar`: whatever is on the left, the screen's name, whatever is on the right. The
 * title is `display` at 24 — the kit steps it down from 32 here so a long memory name still fits
 * between two icon buttons.
 *
 * Four screens of one memory wear its own title, so the title alone cannot say which of them is
 * open — that was the report (TASK-76): an unlabelled corner icon was the only difference between
 * the guest list, the movies, the frames and the upload. `subtitle` is the section's own name, in
 * the kit's `.t-meta` under the title: the same pairing section 2 already draws everywhere else,
 * and no new surface for it.
 */
export function AppBar({
  title,
  subtitle,
  left,
  right,
  style,
}: {
  title: string;
  /** Which part of the thing above is open. Left off on a screen that is the only one of itself. */
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.appbar, style]}>
      {left}
      {/* The kit's `flex:1; min-width:0` moves onto the pair, so the two lines share one column
          between the buttons and a long memory name still truncates instead of pushing them off. */}
      <View style={styles.appbarText}>
        {/* The native header carried the heading; with it off app-wide, this is the only thing left
            that can say «this is the top of the screen» to a rotor. `role` here is the kit's
            typographic one — the spoken role is a separate prop. */}
        <Text accessibilityRole="header" role="display" style={styles.appbarTitle} numberOfLines={1}>
          {title}
        </Text>
        {/* Under the heading and not inside it: a rotor jumping the headings of a screen should
            land on the memory's name, and read where it is on the way past. */}
        {subtitle === undefined ? null : (
          <Text role="meta" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
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
  const styles = useStyles();

  return (
    <View style={[styles.actionbar, { paddingBottom: Math.max(insets.bottom, space.s4) }, style]}>
      {children}
    </View>
  );
}

const useStyles = themed(({ color, shade }) =>
  StyleSheet.create({
    // 4.8px holes, first centred 6.5 in, one every 13 — the card's rail laid on its side.
    railH: {
      height: 7,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 4.1,
      gap: 8.2,
      overflow: 'hidden',
    },
    railDot: { width: 4.8, height: 4.8, borderRadius: 2.4, backgroundColor: shade.perf },
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
    appbarText: { flex: 1, minWidth: 0 },
    // The kit's -.02em, re-resolved for 24px — it is a ratio in CSS and a flat number here.
    appbarTitle: { fontSize: 24, lineHeight: 25.2, letterSpacing: -0.48 },
    actionbar: {
      flexDirection: 'row',
      gap: space.s3,
      paddingTop: space.s3,
      borderTopWidth: 1,
      borderTopColor: color.line,
      backgroundColor: color.ink,
    },
  }),
);
