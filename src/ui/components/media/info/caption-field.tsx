import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput } from 'react-native';

import { font, radius, space, themed, useTheme } from '@/ui/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

export function CaptionField({ value, onChangeText }: Props) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={t('photo.caption')}
      placeholderTextColor={color.faint}
      selectionColor={color.accent}
      returnKeyType="done"
      maxLength={200}
      style={styles.input}
    />
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    input: {
      height: 52,
      borderRadius: radius.field,
      backgroundColor: color.surface,
      paddingHorizontal: space.s4,
      color: color.paper,
      fontFamily: font.regular,
      fontSize: 16,
    },
  }),
);
