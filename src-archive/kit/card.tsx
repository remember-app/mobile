import { Check, WifiOff, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { font, height, radius, space, themed, useTheme } from '@/theme';
import { Button, IconButton } from './button';
import { Icon, type IconComponent } from './icon';
import { Text } from './text';
export function CardMessage({
  icon,
  text,
  children,
  style,
}: {
  icon?: IconComponent;
  text: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.message, style]}>
      {icon ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.square}
        >
          <Icon icon={icon} size={24} stroke={1.7} color={color.paper} />
        </View>
      ) : null}

      <Text role="bodySm" tone="muted">
        {text}
      </Text>
      {children}
    </View>
  );
}
export function HintNote({
  icon,
  tone = 'muted',
  text,
  action,
  style,
}: {
  icon?: IconComponent;
  tone?: 'spark' | 'muted';
  text: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.note, style]}>
      {icon ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.noteIcon}
        >
          <Icon
            icon={icon}
            size={19}
            stroke={1.8}
            color={tone === 'spark' ? color.spark : color.muted}
          />
        </View>
      ) : null}
      <View style={styles.noteWords}>
        <Text role="note">{text}</Text>
        {action ? (
          <Button
            size="xs"
            wide={false}
            label={action.label}
            onPress={action.onPress}
            style={styles.noteAction}
          />
        ) : null}
      </View>
    </View>
  );
}
export type BannerTone = 'error' | 'done';
const said: unique symbol = Symbol('said');
export type Said = {
  readonly [said]: string;
};
export type Failure = {
  text: Said;
  icon?: IconComponent;
};
export const saying = (text: string): Said => ({ [said]: text });
export const read = (these: Said): string => these[said];
export function Banner({
  text,
  tone = 'error',
  icon,
  failure,
  hide,
  children,
  style,
}: {
  text?: string;
  tone?: BannerTone;
  icon?: IconComponent;
  failure?: Failure;
  hide?: {
    label: string;
    onPress: () => void;
  };
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const done = tone === 'done';
  const words = failure ? read(failure.text) : (text ?? '');
  const sign = failure ? failure.icon : icon;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, done ? styles.bannerDone : styles.bannerError, style]}
    >
      {done ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={13} color={color.sparkInk} />
        </View>
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon icon={sign ?? WifiOff} size={19} color={color.dangerText} />
        </View>
      )}
      <Text role="banner" style={[styles.grow, done ? styles.firm : null]}>
        {words}
      </Text>
      {done ? null : children}
      {done || !hide ? null : (
        <IconButton
          icon={X}
          label={hide.label}
          size={height.roundTiny}
          tone="danger"
          glyph={CROSS}
          onPress={hide.onPress}
        />
      )}
    </View>
  );
}
const CROSS = { size: 15, stroke: 2.2 } as const;
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    message: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s5,
      gap: space.s4,
    },
    square: {
      width: 52,
      height: 52,
      borderRadius: radius.cell,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingVertical: 14,
      paddingHorizontal: space.s4,
    },
    noteWords: { flex: 1, minWidth: 0, gap: space.s3 },
    noteAction: { alignSelf: 'flex-start', paddingHorizontal: space.s4 },
    noteIcon: { paddingTop: 1 },
    banner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      paddingLeft: space.s4,
    },
    bannerError: {
      backgroundColor: color.bannerSoft,
      borderColor: color.bannerEdge,
      paddingVertical: space.s3,
      paddingRight: space.s3,
    },
    bannerDone: {
      backgroundColor: color.sparkSoft,
      borderColor: color.sparkEdge,
      paddingVertical: 13,
      paddingRight: space.s4,
    },
    firm: { fontFamily: font.semi },
    tick: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grow: { flex: 1, minWidth: '50%' },
  }),
);
