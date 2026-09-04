import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, duration as motion, space } from '@/theme';

import { Button } from './button';
import { useFadeIn } from './interaction';
import { shade } from './shades';
import { Text } from './text';

type ConfirmProps = {
  visible: boolean;
  title: string;
  /** The consequence, spelled out. The kit asks for what will be lost, not for «are you sure». */
  text: string;
  /** The verb from the title — «Исключить», never «ОК». */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The kit's `.confirm`, section 13: what cannot be undone is asked for on a sheet from the bottom of
 * the screen, and the sheet names the consequence. This is what stands in for `Alert.alert` on
 * delete, leave and remove — the system dialog has none of the kit and none of its wording.
 *
 * A plain React Native `Modal` and nothing else: the kit's rise is 280ms of translate and fade, and
 * a bottom-sheet library would bring gestures the kit never asked for.
 */
export function ConfirmSheet(props: ConfirmProps) {
  return (
    <Modal
      visible={props.visible}
      transparent
      // The rise below is the animation; the platform's own would play on top of it.
      animationType="none"
      statusBarTranslucent
      onRequestClose={props.onCancel}
    >
      {/* Modal renders nothing while hidden, so this mounts on each open — and so does the rise. */}
      <Sheet {...props} />
    </Modal>
  );
}

function Sheet({ title, text, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmProps) {
  const insets = useSafeAreaInsets();
  const rise = useFadeIn(motion.slow);

  return (
    <View style={styles.root}>
      {/* Tapping beside the sheet is the same as declining. Hidden from screen readers: they have
          the cancel button below, and a full-screen button in front of it only gets in the way. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.backdrop, { opacity: rise }]} />
      </Pressable>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, space.s5) },
          {
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.grip} />
        <View>
          <Text role="title">{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
        <View style={styles.actions}>
          <Button variant="danger-solid" wide label={confirmLabel} onPress={onConfirm} />
          <Button variant="quiet" wide label={cancelLabel} onPress={onCancel} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: shade.scrim },
  sheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingTop: space.s6,
    paddingHorizontal: space.s5,
    gap: space.s4,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line,
    alignSelf: 'center',
    marginTop: -space.s3,
  },
  text: { color: color.muted, marginTop: space.s2 },
  actions: { gap: space.s2 },
});
