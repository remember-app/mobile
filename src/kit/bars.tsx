import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { board, height, photo, radius, space, themed, useTheme } from '@/theme';

import { StepScale } from './bits';
import { Icon } from './icon';
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
 * The bar at the top of a screen (spec 7.1), in the kinds that carry words:
 *
 * - **root** — the screen's own name in `displaySm` and one round button on the right;
 * - **inner** — a back button, the name in `barTitle`, truncated rather than wrapped;
 * - **inner with a subtitle** — a `meta` line under the name, the whole `Upload*` family;
 * - **inner with a right action** — the same plus a round button, or the «смотрят сейчас» pill;
 * - **live** — the same two floors a shade smaller (17/21), because the bar over a montage on air
 *   carries a name, a line of meta and a pill of faces in one row.
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
  variant?: 'root' | 'inner' | 'live';
  left?: ReactNode;
  /** A round button, or the pill saying who is watching — it is a slot, not a kind. */
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
          role={variant === 'root' ? 'displaySm' : variant === 'live' ? 'barTitleLive' : 'barTitle'}
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
 * The wizard's bar (spec 7.1, detail 3): a 74-wide block on each side so the step counter sits dead
 * centre whatever the words in those blocks are, the step scale under it, and the step's own heading
 * under that — the heading belongs to the bar and not to the body, because the body scrolls and this
 * does not.
 *
 * `summary` is the last face of it, the one the order's own total wears: no scale, because there is
 * no step after it, and the heading comes up to meet the row.
 */
export function WizardBar({
  step,
  steps,
  label,
  title,
  note,
  variant = 'step',
  back,
  cancel,
  style,
}: {
  step: number;
  steps: number;
  /** «Шаг 2 из 4», «Итог» — a sentence, so the screen writes it. */
  label: string;
  /** «Как собрать» — the step's own heading. */
  title?: string;
  /** The line under it, where a step needs one: «Без музыки или один-несколько треков.» */
  note?: string;
  variant?: 'step' | 'summary';
  back?: ReactNode;
  cancel?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const summary = variant === 'summary';

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
      {summary ? null : <StepScale steps={steps} done={step} style={styles.wizardScale} />}
      {title ? (
        <View style={[styles.wizardWords, summary ? styles.wizardWordsUp : null]}>
          <Text role="display" accessibilityRole="header">
            {title}
          </Text>
          {note ? (
            <Text role="note" tone="muted" style={styles.wizardNote}>
              {note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The glass bar over a memory's feed (spec 7.1, detail 4) — the one that replaced the memory's tabs.
 * Three pieces of glass floating over the frames: a round 48 on each side and, between them, the
 * capsule carrying the memory's name and what it holds.
 *
 * The capsule is a button like the other two: in the feed it opens the memory's settings, in picking
 * mode it takes every frame. A long name is cut with an ellipsis and not shrunk — the whole bar's
 * rhythm hangs off that 14 (spec 10.6) — so the sentence a screen reader gets is the caller's
 * `capsuleLabel`, which carries the name in full.
 *
 * It draws its own darkening: 176 of gradient behind it, which is what keeps a white glyph readable
 * when the frame under the bar happens to be a white wall.
 */
export function GlassBar({
  title,
  meta,
  capsuleLabel,
  onCapsule,
  left,
  right,
  style,
}: {
  title: string;
  meta?: string;
  /** «Свадьба Лизы и Марка. Настройки воспоминания и люди» — the sentence, from the screen. */
  capsuleLabel: string;
  onCapsule?: () => void;
  left?: ReactNode;
  /** Empty on `FramesEmpty`: with no frames there is nothing to pick. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.glassBar, { paddingTop: insets.top }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { bottom: undefined, height: board.headGallery, experimental_backgroundImage: photo.headGallery },
        ]}
      />
      {left}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={capsuleLabel}
        onPress={onCapsule}
        style={styles.capsule}
      >
        <View style={styles.capsuleLine}>
          <Text role="pillTitle" numberOfLines={1} style={styles.shrink}>
            {title}
          </Text>
          <Icon icon={ChevronDown} size={12} color={color.muted} />
        </View>
        {meta ? (
          <Text role="meta" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </Pressable>
      {right}
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
  label,
  onPress,
  left,
  right,
  style,
}: {
  date: string;
  meta: string;
  /**
   * The whole pill read out in one sentence — «Сведения о кадре: 13 сентября, 21:47 · Марк
   * Ковалёв». Only where the pill leads somewhere: a pill that is not a button is two lines of
   * words and is read as such.
   */
  label?: string;
  onPress?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.bar, style]}>
      {left}
      {/* Spec 7.1, detail 5: the pill is a button — it is the road to the frame's own sheet, and
          the `chevron-down` on it is what says so. A `Pressable` with nothing to press stays a
          plain block of glass, which is what the layout draws where there is nowhere to go. */}
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? label : undefined}
        onPress={onPress}
        disabled={!onPress}
        style={styles.viewerPill}
      >
        <View style={styles.viewerWords}>
          <Text role="label" numberOfLines={1} style={styles.onPhoto}>
            {date}
          </Text>
          <Text role="meta" numberOfLines={1} style={styles.onPhotoMeta}>
            {meta}
          </Text>
        </View>
        {onPress ? <Icon icon={ChevronDown} size={12} color={photo.dot} /> : null}
      </Pressable>
      {right}
    </View>
  );
}

/**
 * How deep the gradient under the bottom layer runs, and what it is made of (spec 2 and 7.1). Four
 * of them fade the screen's own `ink` upwards; two lie over photographs instead — the gallery's wall
 * of frames and the queue on `Upload` — and those stay dark in daylight for the same reason a cover's
 * darkening does.
 */
export type Footer = 'plain' | 'count' | 'gallery' | 'upload' | 'live';

const FOOTERS: Record<Footer, { height: number; over?: string; stop: string }> = {
  plain: { height: board.footer, stop: '58%' },
  count: { height: board.footerTall, stop: '62%' },
  gallery: { height: board.footerGallery, over: photo.footerGallery, stop: '' },
  upload: { height: board.footerUpload, over: photo.footerUpload, stop: '' },
  live: { height: board.footerLive, stop: '60%' },
};

/**
 * The bottom layer (spec 7.1): a gradient footer fading up into the screen, and the screen's action
 * standing on it 30 from the bottom. The gradient never catches a press — the buttons over it do.
 *
 * Five depths, because what the footer has to hide differs: 132 under one button, 176 when a line of
 * counting stands over it, 190 over the gallery, 210 over the sending queue, 120 under the one pill
 * of a montage on air. The row itself takes whatever it is given — one button, three across, a pill,
 * two stacked — so a kind of bottom layer is never a flag here.
 *
 * `experimental_backgroundImage` and not a gradient library: React Native takes the spec's own CSS
 * string, the same way `boxShadow` already does.
 */
export function ActionBar({
  children,
  above,
  footer,
  style,
}: {
  children: ReactNode;
  /** «Выбрано 12 из 61» and a quiet «Снять» — spec 7.1, kind 3. */
  above?: ReactNode;
  /** Left off: 176 when something stands above the button, 132 when nothing does. */
  footer?: Footer;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const styles = useStyles();
  const kind = FOOTERS[footer ?? (above ? 'count' : 'plain')];

  return (
    <View style={[styles.layer, { paddingBottom: Math.max(insets.bottom, board.bottom) }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            top: undefined,
            height: kind.height,
            experimental_backgroundImage:
              kind.over ?? `linear-gradient(to top, ${color.ink} ${kind.stop}, transparent)`,
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
    // Spec 7.1: the glass bar keeps 12 on each side instead of the screen's 16 — the two round
    // buttons are glass and float, and glass hung on the margin reads as stuck to the edge.
    glassBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s3,
    },
    capsule: {
      flex: 1,
      minWidth: 0,
      height: height.roundViewer,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: photo.bar,
      borderWidth: 1,
      borderColor: photo.barEdge,
    },
    capsuleLine: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
    shrink: { flexShrink: 1 },
    wizardScale: { marginHorizontal: space.s4, marginTop: space.s3 },
    // Spec 7.1: 18 under the scale, and 12 where there is no scale to stand under.
    wizardWords: { marginHorizontal: space.s4, marginTop: 18 },
    wizardWordsUp: { marginTop: space.s3 },
    wizardNote: { marginTop: 10 },
    wizardSide: { width: 74, alignItems: 'flex-start' },
    wizardRight: { alignItems: 'flex-end' },
    wizardStep: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
    viewerPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s2,
      paddingVertical: space.s2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: photo.glass,
    },
    // Two floors beside the chevron, not above it — and they give way first: a long name is
    // truncated, the sign that the pill opens something never is.
    viewerWords: { flexShrink: 1, minWidth: 0, alignItems: 'center', gap: 2 },
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.dot },
    layer: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
    layerAbove: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  }),
);
