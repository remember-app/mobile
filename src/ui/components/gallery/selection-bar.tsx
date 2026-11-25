import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

export function SelectionBar({ top, selectedCount }: { top: number; selectedCount: number }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  return (
    <View style={[styles.bar, { top }]}>
      <View
        style={[styles.selectionPill, { backgroundColor: color.surface, borderColor: color.line }]}
      >
        <Text role="row">{t('project.selected', { count: selectedCount })}</Text>
      </View>
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
  selectionPill: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
});
