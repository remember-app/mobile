import { ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Label } from '@/models';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

import { LabelMark } from '../common/label';

export function SelectionBar({
  top,
  labelMode,
  activeLabel,
  selectedCount,
  onMenu,
}: {
  top: number;
  labelMode: boolean;
  activeLabel?: Label;
  selectedCount: number;
  onMenu: () => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  return (
    <View style={[styles.bar, { top }]}>
      {labelMode && activeLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={activeLabel.name}
          onPress={onMenu}
          style={[styles.labelPill, { backgroundColor: color.surface, borderColor: color.line }]}
        >
          <LabelMark tint={activeLabel.color} size={18} />
          <Text role="row" numberOfLines={1} style={styles.labelName}>
            {activeLabel.name}
          </Text>
          <ChevronDown size={16} color={color.muted} />
        </Pressable>
      ) : (
        <View
          style={[
            styles.selectionPill,
            { backgroundColor: color.surface, borderColor: color.line },
          ]}
        >
          <Text role="row">{t('project.selected', { count: selectedCount })}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  labelPill: {
    maxWidth: '60%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  labelName: {
    flexShrink: 1,
  },
  selectionPill: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
});
