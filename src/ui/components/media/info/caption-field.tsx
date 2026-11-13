import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { font, radius, space, themed, useTheme } from '@/ui/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onEndEditing?: () => void;
};

const LINE = 22;

export function CaptionField({ value, onChangeText, onEndEditing }: Props) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        placeholder={t('photo.caption')}
        placeholderTextColor={color.faint}
        selectionColor={color.accent}
        returnKeyType="done"
        maxLength={200}
        multiline
        scrollEnabled={false}
        autoFocus
        style={styles.input}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value.trim() || t('photo.caption')}
      onPress={() => setOpen(true)}
      style={styles.box}
    >
      <Text numberOfLines={3} style={[styles.caption, value ? null : { color: color.faint }]}>
        {value || t('photo.caption')}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    box: {
      minHeight: 52,
      borderRadius: radius.field,
      backgroundColor: color.surface,
      paddingHorizontal: space.s4,
      paddingVertical: space.s4,
    },
    caption: {
      color: color.paper,
      fontFamily: font.regular,
      fontSize: 16,
      lineHeight: LINE,
    },
    input: {
      minHeight: 52,
      borderRadius: radius.field,
      backgroundColor: color.surface,
      paddingHorizontal: space.s4,
      paddingVertical: space.s4,
      textAlignVertical: 'top',
      color: color.paper,
      fontFamily: font.regular,
      fontSize: 16,
      lineHeight: LINE,
    },
  }),
);
