import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { night, photo, radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Waveform } from './rows';
import { Text } from './text';

/**
 * Spec 7.6 — what a person sees while they are ordering a montage: the templates they can start
 * from, the poster of what they have asked for, and the summary of it they read before pressing the
 * one button that spends fifteen minutes of somebody's machine.
 */

/**
 * Spec 7.6 — one template, 118 tall. A frame of the memory's own under a darkening, the character
 * of the template as a glyph on glass, its length and shape on a plate, and two lines saying what
 * kind of film it is. Pressing one runs the whole wizard by itself (spec 6), which is why it is a
 * card and not a chip: it is the single biggest decision on the screen.
 *
 * `dimmed` is what the others do once the autopilot has taken one of them.
 */
export function TileTemplate({
  title,
  note,
  spec,
  icon,
  uri,
  picked,
  dimmed,
  onPress,
  style,
}: {
  title: string;
  /** «Лица, тепло, чуть медленнее» — the character in one line. */
  note?: string;
  /** «2:30 · 16:9» — the plate at the top right. */
  spec?: string;
  /** What kind of film it is: a heart, a bolt, a document, a house, a sun (spec 5). */
  icon?: IconComponent;
  uri?: string;
  /** Taken by the autopilot: this one is ringed and the rest go down. */
  picked?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!picked }}
      accessibilityLabel={[title, note, spec].filter(Boolean).join('. ')}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.template,
        picked ? styles.templatePicked : null,
        dimmed ? styles.dimmed : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          style={[StyleSheet.absoluteFill, styles.under]}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.templateScrim]} />
      {icon ? (
        <View style={styles.glass}>
          {/* On glass over a photograph: the night's paper in both themes, like the words beside it. */}
          <Icon icon={icon} size={16} color={night.paper} />
        </View>
      ) : null}
      {spec ? (
        <View style={styles.templateSpec}>
          <Text role="meta" style={styles.onPhoto}>
            {spec}
          </Text>
        </View>
      ) : null}
      <View style={styles.templateFoot}>
        <Text role="label" numberOfLines={2} style={styles.onPhoto}>
          {title}
        </Text>
        {note ? (
          <Text role="badgeSm" numberOfLines={1} style={styles.onPhotoQuiet}>
            {note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Spec 7.6 — the poster of the film that has been asked for but does not exist yet: three of its
 * frames, the template it is being cut to, and its length printed big. The shape of the montage is
 * *named* rather than drawn — a 9:16 film does not make this a tall card, because at this point
 * there is nothing to show at that shape and a person reads «Вертикальный» faster than they measure
 * a rectangle.
 */
export function PosterOrder({
  photos,
  template,
  templateIcon,
  length,
  shape,
  about,
  style,
}: {
  /** Three frames, in the layout's own 1.3 / 1 / 1. */
  photos?: readonly string[];
  /** «Для родителей» — the template's name, on the plate. */
  template?: string;
  templateIcon?: IconComponent;
  /** «2:30» — the number the whole poster is built around. */
  length: string;
  /** «Горизонтальный» — the shape said in a word. */
  shape?: string;
  /** «16:9 · Свадьба Лизы и Марка». */
  about?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const cells = photos ?? [];

  return (
    <View style={[styles.poster, style]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, styles.posterShots]}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <View key={cells[i] ?? i} style={[styles.posterCell, i === 0 ? styles.posterLead : null]}>
            {cells[i] ? (
              <Image
                source={{ uri: cells[i] }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        ))}
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.posterScrim]} />
      {template ? (
        <View style={styles.posterPlate}>
          {templateIcon ? <Icon icon={templateIcon} size={14} color={night.paper} /> : null}
          <Text role="label" style={styles.onPhoto}>
            {template}
          </Text>
        </View>
      ) : null}
      <View style={styles.posterFoot}>
        <Text role="figure" style={[styles.grow, styles.onPhoto]}>
          {length}
        </Text>
        <View style={styles.posterShape}>
          {shape ? (
            <Text role="label" style={styles.onPhoto}>
              {shape}
            </Text>
          ) : null}
          {about ? (
            <Text role="meta" numberOfLines={1} style={styles.onPhotoQuiet}>
              {about}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Spec 8, `MontageStory` — the plate over the story: which template the words in the box came
 * from, or that they are the person's own. 30 tall on `accentSoft` under the accent's hairline,
 * which is the pair of tokens the theme keeps for exactly this plate and the chosen choice card.
 *
 * Not a chip: nothing about it can be pressed. It reports which text is in the box, and the way to
 * change that is to write in the box — a plate that took a finger would be a second place where
 * the same thing is decided.
 */
export function ChipTemplate({
  label,
  icon,
  style,
}: {
  label: string;
  icon?: IconComponent;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.templateChip, icon ? null : styles.templateChipBare, style]}>
      {icon ? <Icon icon={icon} size={14} color={color.paper} /> : null}
      <Text role="label">{label}</Text>
    </View>
  );
}

/**
 * Spec 7.6 — the order read back in one card, in sections with a hairline between them. Nothing in
 * it can be touched: the way to change an answer is to walk back to the step that gave it, and a
 * field here would be a second place where the same thing is decided.
 */
export function BlockSummary({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.summary, style]}>{children}</View>;
}

/** One of its sections: the eyebrow, and whatever that section is made of. */
export function SummarySection({
  title,
  divider,
  children,
}: {
  title: string;
  divider?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View>
      {divider ? <View style={styles.rule} /> : null}
      <View style={styles.section}>
        <Text role="eyebrow" accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
        {children}
      </View>
    </View>
  );
}

/** The six frames across a summary section — 44 tall, and they only ever say «this much material». */
export function SummaryShots({ photos }: { photos: readonly string[] }) {
  const styles = useStyles();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.shots}
    >
      {photos.slice(0, 6).map((uri) => (
        <Image key={uri} source={{ uri }} contentFit="cover" style={styles.shot} />
      ))}
    </View>
  );
}

/** The track named in a summary section, with the waveform drawn out to the right edge. */
export function SummaryTrack({ title, note }: { title: string; note?: string }) {
  const styles = useStyles();

  return (
    <View style={styles.summaryTrack}>
      <Text role="row">{title}</Text>
      {note ? <Text role="meta">{note}</Text> : null}
      <View style={styles.grow} />
      <Waveform wide />
    </View>
  );
}

/**
 * Spec 7.7 — «Выбрано»: the tracks that have been taken, in the accent's own block so they read as
 * a decision rather than as more of the library below them. It holds the rows themselves and,
 * underneath, the one line a person can say about how to use them.
 *
 * There is no empty version of this block. With nothing taken its place is held by the «Без музыки»
 * choice card, because a film with no music is a decision too.
 */
export function BlockPicked({
  title,
  count,
  children,
  footer,
  style,
}: {
  /** «ВЫБРАНО». */
  title: string;
  /** «2 трека · 3:45» — written by the screen. */
  count?: string;
  /** The `RowTrack`s that were taken. */
  children: ReactNode;
  /** The 44 «как использовать треки» field. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.picked, style]}>
      <View style={styles.pickedHead}>
        <Text role="eyebrow" accessibilityRole="header" style={styles.grow}>
          {title.toUpperCase()}
        </Text>
        {count ? <Text role="meta">{count}</Text> : null}
      </View>
      {children}
      {footer ? <View style={styles.pickedFoot}>{footer}</View> : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    template: {
      height: 118,
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    templatePicked: { borderWidth: 1.5, borderColor: color.accent },
    // What every other template does once one of them has been taken.
    dimmed: { opacity: 0.4 },
    // The frame is the mood of the template and not its subject, so it stays well under the words.
    under: { opacity: 0.42 },
    templateScrim: {
      experimental_backgroundImage:
        'linear-gradient(to top, rgba(11,11,18,0.94) 20%, rgba(11,11,18,0.35) 100%)',
    },
    // Spec 1.8 — glass, because it is lying on a photograph.
    glass: {
      position: 'absolute',
      left: 12,
      top: 12,
      width: 30,
      height: 30,
      borderRadius: radius.queue,
      backgroundColor: photo.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateSpec: {
      position: 'absolute',
      right: 10,
      top: 13,
      paddingVertical: 3,
      paddingHorizontal: space.s2,
      borderRadius: radius.pill,
      backgroundColor: photo.plate,
    },
    templateFoot: { marginTop: 'auto', padding: 12, gap: 2 },
    onPhoto: { color: photo.on },
    onPhotoQuiet: { color: photo.onQuiet },
    grow: { flex: 1, minWidth: 0 },
    poster: {
      height: 136,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    posterShots: { flexDirection: 'row', gap: 2 },
    // Spec 7.6 — 1.3fr 1fr 1fr: the first frame leads and the other two answer it.
    posterCell: { flex: 1, backgroundColor: color.raise, overflow: 'hidden' },
    posterLead: { flex: 1.3 },
    posterScrim: {
      experimental_backgroundImage:
        'linear-gradient(to top, rgba(9,9,14,0.9) 10%, rgba(9,9,14,0.1) 70%)',
    },
    posterPlate: {
      position: 'absolute',
      left: 14,
      top: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingLeft: 7,
      paddingRight: 10,
      borderRadius: radius.pill,
      backgroundColor: photo.plate,
    },
    templateChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 30,
      paddingLeft: space.s2,
      paddingRight: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.accentEdge,
      backgroundColor: color.accentSoft,
    },
    // Without a glyph in front, the words stand in the middle of the plate rather than off to one
    // side: the 8 on the left is room for the icon and not a margin.
    templateChipBare: { paddingLeft: 12 },
    posterFoot: {
      marginTop: 'auto',
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.s3,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    posterShape: { alignItems: 'flex-end', paddingBottom: 3 },
    summary: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    rule: { height: 1, backgroundColor: color.raise },
    section: { paddingVertical: 13, paddingHorizontal: space.s4, gap: space.s2 },
    shots: { flexDirection: 'row', gap: space.s1 },
    shot: { flex: 1, height: 44, borderRadius: 8, backgroundColor: color.raise },
    summaryTrack: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    picked: {
      borderRadius: radius.section,
      borderWidth: 1.5,
      borderColor: color.accent,
      backgroundColor: color.accentSoft,
      overflow: 'hidden',
    },
    pickedHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.s2,
      paddingTop: space.s3,
      paddingHorizontal: 14,
      paddingBottom: space.s1,
    },
    pickedFoot: { paddingHorizontal: 10, paddingTop: space.s2, paddingBottom: 10 },
  }),
);
