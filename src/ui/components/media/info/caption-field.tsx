import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { font, radius, space, themed, useTheme } from '@/ui/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onEndEditing?: () => void;
  placeholder?: string;
  maxLength?: number;
};

const LINE = 22;

export function CaptionField({
  value,
  onChangeText,
  onEndEditing,
  placeholder,
  maxLength = 200,
}: Props) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const hint = placeholder ?? t('photo.caption');

  if (open) {
    return (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        placeholder={hint}
        placeholderTextColor={color.faint}
        selectionColor={color.accent}
        returnKeyType="done"
        maxLength={maxLength}
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
      accessibilityLabel={value.trim() || hint}
      onPress={() => setOpen(true)}
      style={styles.box}
    >
      <Text numberOfLines={3} style={[styles.caption, value ? null : { color: color.faint }]}>
        {value || hint}
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
