import { StyleSheet, TextInput } from 'react-native';

import { font, night, radius, space } from '@/ui/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
};

export function CaptionField({ value, onChangeText }: Props) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Добавить подпись"
      placeholderTextColor={night.muted}
      selectionColor={night.accent}
      returnKeyType="done"
      maxLength={200}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: night.surface,
    paddingHorizontal: space.s4,
    color: night.paper,
    fontFamily: font.regular,
    fontSize: 16,
  },
});
