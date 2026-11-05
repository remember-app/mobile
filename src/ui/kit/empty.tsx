import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { radius, space, spinner, themed, useTheme } from '@/ui/theme';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';
export type SpinnerSize = (typeof spinner)[keyof typeof spinner];
export function Spinner({
  size = spinner.join,
  head,
}: {
  size?: SpinnerSize | number;
  track?: string;
  head?: string;
  ring?: number;
}) {
  const { color } = useTheme();
  const small = typeof size === 'number' ? size <= 24 : size <= 26;
  return <ActivityIndicator size={small ? 'small' : 'large'} color={head ?? color.muted} />;
}
export type EmptySign = 'dashed' | 'line' | 'spark';
const SIGN = { dashed: 'signDashed', line: 'signLine', spark: 'signSpark' } as const;
export function Empty({
  sign = 'dashed',
  icon,
  busy,
  title,
  text,
  children,
}: {
  sign?: EmptySign;
  icon?: IconComponent;
  busy?: boolean;
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      {busy ? (
        <Spinner size={spinner.screen} />
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.sign, styles[SIGN[sign]]]}>
            {icon ? (
              <Icon
                icon={icon}
                size={sign === 'dashed' ? 38 : 40}
                color={sign === 'spark' ? color.paper : color.faint}
              />
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.words}>
        {title ? (
          <Text role="emptyTitle" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {text ? (
          <Text role="body" tone="muted" style={styles.text}>
            {text}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    empty: {
      alignItems: 'center',
      gap: 22,
      paddingVertical: space.s7,
      paddingHorizontal: space.s5,
    },
    words: { alignItems: 'center', gap: space.s3 },
    sign: {
      width: 96,
      height: 96,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signDashed: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: color.dashed,
      backgroundColor: color.hollowSoft,
    },
    signLine: { borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
    signSpark: { boxShadow: `0 0 0 2px ${color.spark}`, backgroundColor: color.surface },
    title: { textAlign: 'center' },
    text: { textAlign: 'center' },
  }),
);
