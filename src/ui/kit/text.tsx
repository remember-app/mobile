import { Text as RNText, type TextProps } from 'react-native';

import { type, useTheme } from '@/ui/theme';

export type TypeRole = keyof typeof type;

export type TextTone =
  | 'paper'
  | 'muted'
  | 'faint'
  | 'dayOff'
  | 'accent'
  | 'spark'
  | 'sparkInk'
  | 'danger'
  | 'onFill'
  | 'quote';

type Props = Omit<TextProps, 'role'> & {
  role?: TypeRole;
  tone?: TextTone;
};

export function Text({ role = 'body', tone = 'paper', style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <RNText
      allowFontScaling={false}
      style={[type[role], { color: theme.color[tone] }, style]}
      {...rest}
    />
  );
}
