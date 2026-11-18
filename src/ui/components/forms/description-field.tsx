import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Field } from '@/ui/kit/controls/field';

export function DescriptionField({
  value,
  onChangeText,
  onEndEditing,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onEndEditing?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Field
      label={t('project.descriptionPlaceholder')}
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder={t('project.descriptionPlaceholder')}
      maxLength={2000}
      multiline
      scrollEnabled={false}
      style={styles.note}
    />
  );
}

const styles = StyleSheet.create({
  note: { textAlignVertical: 'top' },
});
