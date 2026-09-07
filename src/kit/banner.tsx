import { Check, Info, TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme, type Theme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { Text } from './text';

/** `.banner-error` and `.banner-done`; left off, it is the plain one. */
export type BannerTone = 'error' | 'done';

/**
 * The kit's `.banner`, section 12. It lives in the flow of the screen rather than over it, so it can
 * be read without hurrying — there are no toasts in this kit, and nothing here disappears on a timer.
 *
 * `children` is what can be done about it: a quiet «retry», a secondary «allow». The icon repeats
 * the tone the words already carry, so it is not offered to screen readers.
 */
export function Banner({
  tone,
  text,
  children,
  style,
}: {
  tone?: BannerTone;
  text: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[
        styles.banner,
        tone === 'error' ? styles.error : null,
        tone === 'done' ? styles.done : null,
        style,
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon icon={defaultIcon(tone)} color={iconColor(theme, tone)} />
      </View>
      <Text style={styles.text}>{text}</Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

function defaultIcon(tone: BannerTone | undefined): IconComponent {
  if (tone === 'error') return TriangleAlert;
  if (tone === 'done') return Check;
  return Info;
}

function iconColor({ color, shade }: Theme, tone: BannerTone | undefined): string {
  if (tone === 'error') return shade.rustText;
  if (tone === 'done') return color.fixed;
  return color.muted;
}

const useStyles = themed(({ color, shade }) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      paddingVertical: space.s3,
      paddingHorizontal: space.s4,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    error: { borderColor: shade.rustLine, backgroundColor: shade.rustFill },
    done: { borderColor: shade.fixedLine },
    text: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21 },
    actions: { flexShrink: 0 },
  }),
);
