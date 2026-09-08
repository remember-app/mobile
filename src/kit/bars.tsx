import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, themed, useTheme } from '@/theme';

import { ICO, ICO_S, Icon, type IconComponent } from './icon';
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
  sm,
  size,
  tint,
  on,
  disabled,
  style,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
  /**
   * `.iconbtn-sm` — 28×28 with the small glyph, for a button that stands inside a row of text
   * rather than in a bar of its own. The slop below keeps the finger target at 44 all the same.
   */
  sm?: boolean;
  size?: number;
  /**
   * What it is drawn in when untouched — `.viewer__bar .iconbtn{color:var(--paper)}`, the kit's one
   * override of the muted default. Over an open frame there is no surface behind the icon, so muted
   * is the difference between an action and a smudge.
   */
  tint?: string;
  /**
   * `.iconbtn[aria-pressed]` — a button that stays in rather than firing and letting go: the frames'
   * corner icon is the way into picking and the way out of it again. Passing it at all is what makes
   * this a switch; left off, the button is a plain one and says so out loud, because `checked: false`
   * on something that does not toggle reads as an unticked box.
   */
  on?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole={on === undefined ? 'button' : 'togglebutton'}
      accessibilityLabel={label}
      accessibilityState={
        on === undefined ? { disabled: !!disabled } : { disabled: !!disabled, checked: on }
      }
      disabled={disabled}
      // Drawn at 40 (or 28), felt at 44 either way.
      hitSlop={hitSlop(sm ? 28 : 40)}
      onPress={onPress}
      {...props}
      style={[
        styles.iconbtn,
        sm ? styles.iconbtnSm : null,
        on ? styles.iconbtnOn : null,
        hovered ? styles.iconbtnHover : null,
        focused ? focusRing : null,
        disabled ? styles.off : null,
        style,
      ]}
    >
      <Icon
        icon={icon}
        size={size ?? (sm ? ICO_S : ICO)}
        // Held in, it reads at full strength: the kit's pressed icon is `--paper`, the same as under
        // a finger. Muted is the resting state, and a switch that is on is not resting.
        color={hovered || on ? color.paper : (tint ?? color.muted)}
      />
    </Pressable>
  );
}

/**
 * The kit's `.appbar`: whatever is on the left, the screen's name, whatever is on the right. The
 * title is `display` at 24 — the kit steps it down from 32 here so a long memory name still fits
 * between two icon buttons.
 *
 * One line and no second one. There used to be a `subtitle` under the title, because four screens of
 * one memory wore its name and only an unlabelled corner icon told them apart (TASK-76). The kit's
 * «Экраны» dissolved that: the memory is one screen with three faces named in the switch under this
 * bar, and the screen next to it is called «Ваши кадры» after the phone's roll. Nothing was left to
 * disambiguate, and `.appbar` has no second line in the kit.
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
  const styles = useStyles();

  return (
    <View style={[styles.appbar, style]}>
      {left}
      {/* The native header carried the heading; with it off app-wide, this is the only thing left
          that can say «this is the top of the screen» to a rotor. `role` here is the kit's
          typographic one — the spoken role is a separate prop. */}
      <Text accessibilityRole="header" role="display" style={styles.appbarTitle} numberOfLines={1}>
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
    iconbtnSm: { width: 28, height: 28 },
    // `.iconbtn[aria-pressed="true"]` — filled and outlined, the same pair the segment's chosen pill
    // wears. It is the only state of this button that survives the finger coming off it.
    iconbtnOn: { backgroundColor: color.raise, borderColor: shade.lineHi },
    iconbtnHover: { backgroundColor: color.raise },
    off: { opacity: 0.45 },
    appbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingTop: space.s4,
      paddingBottom: space.s3,
    },
    // The kit's -.02em, re-resolved for 24px — it is a ratio in CSS and a flat number here; and its
    // `flex:1; min-width:0`, which is what makes a long name truncate rather than push.
    appbarTitle: { flex: 1, minWidth: 0, fontSize: 24, lineHeight: 25.2, letterSpacing: -0.48 },
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
