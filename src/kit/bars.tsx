import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { board, height, photo, radius, space, themed, useTheme } from '@/theme';

import { StepScale } from './bits';
import { Text } from './text';

/**
 * Spec 7.1 — the frame of a screen: the board it is drawn on, the bar at the top, the layer at the
 * bottom. The native header is off everywhere (`headerShown: false`), so a screen draws its own.
 */

/**
 * The board (spec 7.1). Background `ink`, the device's status line left empty at the top, and the
 * body as its own layer between the bar and the bottom layer — the body is the only thing that
 * scrolls.
 *
 * The spec's 52 is the drawn phone's status bar; here the phone says how tall its own is, which is
 * the same thing measured rather than assumed.
 */
export function Board({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  return <View style={[styles.board, { paddingTop: insets.top }, style]}>{children}</View>;
}

/**
 * The bar at the top of a screen (spec 7.1), in the four kinds that carry words:
 *
 * - **root** — the screen's own name in `displaySm` and one round button on the right;
 * - **inner** — a back button, the name in `barTitle`, truncated rather than wrapped;
 * - **inner with a subtitle** — a `meta` line under the name, the whole `Upload*` family;
 * - **inner with a right action** — the same plus a round button.
 *
 * The other two kinds have components of their own: `WizardBar` and `ViewerBar`. The bar never
 * scrolls, whichever it is.
 */
export function AppBar({
  title,
  subtitle,
  variant = 'inner',
  left,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  variant?: 'root' | 'inner';
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  // Spec 7.1: an inner bar closes to 8 and hangs its round buttons 10 outside the screen's margin,
  // so the glyph inside them lines up with the words below rather than the button's own edge. The
  // root bar keeps 12 and its one button stays inside the margin — it is filled, and a filled
  // button pulled out would read as falling off the screen.
  const inner = variant !== 'root';

  return (
    <View style={[styles.bar, inner ? styles.barInner : null, style]}>
      {left ? <View style={inner ? styles.pullLeft : null}>{left}</View> : null}
      <View style={styles.barWords}>
        {/* With the native header off app-wide, this is the only thing left that can say «this is
            the top of the screen» to a rotor. `role` here is the typographic one — the spoken role
            is a separate prop. */}
        <Text
          accessibilityRole="header"
          role={variant === 'root' ? 'displaySm' : 'barTitle'}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text role="meta" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={inner ? styles.pullRight : null}>{right}</View> : null}
    </View>
  );
}

/**
 * The wizard's bar (spec 7.1, kind 5): a 74-wide block on each side so the step counter sits dead
 * centre whatever the words in those blocks are, and the step scale under it.
 */
export function WizardBar({
  step,
  steps,
  label,
  back,
  cancel,
  style,
}: {
  step: number;
  steps: number;
  /** «Шаг 2 из 4» — a sentence, so the screen writes it. */
  label: string;
  back?: ReactNode;
  cancel?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={style}>
      <View style={styles.bar}>
        <View style={styles.wizardSide}>{back}</View>
        <Text role="label" tone="muted" style={styles.wizardStep}>
          {label}
        </Text>
        <View style={[styles.wizardSide, styles.wizardRight]}>{cancel}</View>
      </View>
      {/* Inside the screen's own margins, like everything else in a bar: the row above pads itself
          and the scale is its sibling, so without this it would run edge to edge under it. */}
      <StepScale steps={steps} done={step} style={styles.wizardScale} />
    </View>
  );
}

/**
 * The viewer's floating bar (spec 7.1, kind 6): three pieces of glass over the photograph — close
 * on the left, a pill carrying when and who in the middle, «ещё» on the right. It floats because
 * there is no surface under it; the frame is the surface.
 */
export function ViewerBar({
  date,
  meta,
  left,
  right,
  style,
}: {
  date: string;
  meta: string;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.bar, style]}>
      {left}
      <View style={styles.viewerPill}>
        <Text role="label" style={styles.onPhoto}>
          {date}
        </Text>
        <Text role="meta" style={styles.onPhotoMeta}>
          {meta}
        </Text>
      </View>
      {right}
    </View>
  );
}

/**
 * The bottom layer (spec 7.1): a gradient footer fading up into the screen, and the screen's action
 * standing on it 30 from the bottom. The gradient never catches a press — the buttons over it do —
 * and it grows from 132 to 176 when a line of counting stands above the button.
 *
 * `experimental_backgroundImage` and not a gradient library: React Native takes the spec's own CSS
 * string, the same way `boxShadow` already does.
 */
export function ActionBar({
  children,
  above,
  style,
}: {
  children: ReactNode;
  /** «Выбрано 12 из 61» and a quiet «Снять» — spec 7.1, kind 3. */
  above?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const styles = useStyles();
  const tall = !!above;

  return (
    <View style={[styles.layer, { paddingBottom: Math.max(insets.bottom, board.bottom) }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            top: undefined,
            height: tall ? board.footerTall : board.footer,
            experimental_backgroundImage: `linear-gradient(to top, ${color.ink} ${
              tall ? '62%' : '58%'
            }, transparent)`,
          },
        ]}
      />
      {above ? <View style={styles.layerAbove}>{above}</View> : null}
      <View style={styles.layerRow}>{children}</View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    board: { flex: 1, backgroundColor: color.ink },
    bar: {
      minHeight: height.bar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
    },
    barInner: { gap: space.s2 },
    pullLeft: { marginLeft: -10 },
    pullRight: { marginRight: -10 },
    // `flex: 1` with `minWidth: 0` is what makes a long name truncate instead of pushing the button
    // on the right off the screen.
    barWords: { flex: 1, minWidth: 0, gap: 2 },
    wizardScale: { marginHorizontal: space.s4, marginTop: space.s3 },
    wizardSide: { width: 74, alignItems: 'flex-start' },
    wizardRight: { alignItems: 'flex-end' },
    wizardStep: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
    viewerPill: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: space.s2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: photo.glass,
    },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.dot },
    layer: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
    layerAbove: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  }),
);
