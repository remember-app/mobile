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
import { duration as motion, photo, radius, space, ThemePin } from '@/ui/theme';
import { useFadeIn } from './interaction';
import { useScrimTap, useShutOnBlur } from './sheet';
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
  onCancel: () => void;
  top: number;
  right?: number;
  gapBefore?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useShutOnBlur(visible, onCancel);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
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
const styles = StyleSheet.create({
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
  gap: { height: 6, backgroundColor: photo.menuGap },
});
