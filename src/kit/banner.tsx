import { Check, Info, TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, space } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { shade } from './shades';
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
  icon,
  children,
  style,
}: {
  tone?: BannerTone;
  text: string;
  icon?: IconComponent;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
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
        <Icon icon={icon ?? defaultIcon(tone)} color={iconColor(tone)} />
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

function iconColor(tone: BannerTone | undefined): string {
  if (tone === 'error') return shade.danger;
  if (tone === 'done') return color.fixed;
  return color.muted;
}

const styles = StyleSheet.create({
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
  error: { borderColor: shade.dangerLine, backgroundColor: shade.dangerBanner },
  done: { borderColor: shade.fixedBanner },
  text: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21 },
  actions: { flexShrink: 0 },
});
