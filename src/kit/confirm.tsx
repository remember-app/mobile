import { StyleSheet, View } from 'react-native';

import { space, themed } from '@/theme';

import { Button } from './button';
import { Sheet } from './sheet';
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
 * The sheet itself is `./sheet`; this is the question that goes on one.
 */
export function ConfirmSheet({
  visible,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const styles = useStyles();

  return (
    <Sheet visible={visible} onCancel={onCancel}>
      <View>
        <Text accessibilityRole="header" role="title">
          {title}
        </Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.actions}>
        <Button variant="danger-solid" wide label={confirmLabel} onPress={onConfirm} />
        <Button variant="quiet" wide label={cancelLabel} onPress={onCancel} />
      </View>
    </Sheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    text: { color: color.muted, marginTop: space.s2 },
    actions: { gap: space.s2 },
  }),
);
