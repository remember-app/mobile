import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Label } from '@/models';
import type { LabelId } from '@/types/id';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

import { LabelMark } from '../label';

export function LabelMenu({
  top,
  labels,
  activeLabel,
  onChoose,
  onClose,
}: {
  top: number;
  labels: readonly Label[];
  activeLabel: Label;
  onChoose: (labelId: LabelId) => void;
  onClose: () => void;
}) {
  const { color } = useTheme();
  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.wrap, { top }]}>
        <View style={[styles.menu, { backgroundColor: color.surface, borderColor: color.line }]}>
          {labels.map((label) => (
            <Pressable
              key={label.id}
              accessibilityRole="button"
              accessibilityLabel={label.name}
              onPress={() => onChoose(label.id)}
              style={styles.option}
            >
              <LabelMark tint={label.color} size={18} />
              <Text role="row" numberOfLines={1} style={styles.name}>
                {label.name}
              </Text>
              {label.id === activeLabel.id ? <Check size={16} color={color.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  menu: {
    width: 260,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.s1,
  },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
  },
  name: {
    flexShrink: 1,
  },
});
