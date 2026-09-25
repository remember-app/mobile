import { Children, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { duration as motion, photo, radius, space, ThemePin } from '@/theme';

import { useFadeIn } from './interaction';
import { useScrimTap, useShutOnBlur } from './sheet';

/**
 * Spec 7.1, detail 9 — the action menu: 278 of glass that falls out of the «⋯» button it was opened
 * from, and not up from the bottom of the screen. A sheet is a place the product takes you; this is
 * a list of what can be done to the thing already under your finger, so it stands where that thing
 * is and the button it came from stays visible behind it.
 *
 * What goes inside is rows — `RowAction` — and the menu draws the hairline between them itself,
 * because on glass that rule is white at 8% and not the `line` a list on a surface uses.
 */
export function ActionMenu({
  visible,
  onCancel,
  top,
  right = space.s3,
  gapBefore,
  children,
  style,
}: {
  visible: boolean;
  /** A tap beside the menu, the back button, and leaving the screen under it. */
  onCancel: () => void;
  /** Where the bottom of the button it fell out of is, measured from the top of the screen. */
  top: number;
  right?: number;
  /**
   * Which row the 6px of darkness stands before — the dangerous one, which the layout always puts
   * last. Left off, every row is separated by the hairline alone.
   */
  gapBefore?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useShutOnBlur(visible, onCancel);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      {/* Like the sheet: `Modal` renders nothing while hidden, so this mounts on each open and the
          opening plays once. */}
      {/* The menu is glass over a photograph in both themes — see the styles below — so the rows in
          it are read in the night's ink whatever the app is in, and a caller does not have to know. */}
      <ThemePin value="dark">
        <Fall onCancel={onCancel} top={top} right={right} gapBefore={gapBefore} style={style}>
          {children}
        </Fall>
      </ThemePin>
    </Modal>
  );
}

function Fall({
  onCancel,
  top,
  right,
  gapBefore,
  children,
  style,
}: {
  onCancel: () => void;
  top: number;
  right: number;
  gapBefore?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fall = useFadeIn(motion.menu);
  const onScrimTap = useScrimTap(onCancel);
  const rows = Children.toArray(children);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* No darkness behind it, unlike a sheet: the menu is small and the screen it stands on is
          still the subject. The scrim is only there to catch the tap that closes it. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onScrimTap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.menu,
          { top, right, boxShadow: photo.menuShadow },
          {
            opacity: fall,
            // Spec 6: it opens from its own top right corner — the corner the button is at.
            transform: [
              { scale: fall.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
            transformOrigin: 'top right',
          },
          style,
        ]}
      >
        {rows.map((row, i) => (
          <View key={i}>
            {i === 0 ? null : i === gapBefore ? (
              <View style={styles.gap} />
            ) : (
              <View style={styles.rule} />
            )}
            {row}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// Glass and nothing else, so there is no second set of these: the menu stands over a photograph in
// both themes, the same way the viewer does.
const styles = StyleSheet.create({
  // Spec 7.1, detail 9: 278 by the outer edge — rows of 276 inside a hairline either side.
  menu: {
    position: 'absolute',
    width: 278,
    borderRadius: radius.field,
    backgroundColor: photo.menu,
    borderWidth: 1,
    borderColor: photo.menuEdge,
    overflow: 'hidden',
  },
  rule: { height: 1, backgroundColor: photo.menuLine },
  // Not a rule but a cut: what is under it costs something, and the eye is made to step over it.
  gap: { height: 6, backgroundColor: photo.menuGap },
});
