import { Image } from 'expo-image';
import { Check, Sparkles, VolumeX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { night, photo, radius, space, themed, useTheme } from '@/theme';
import { Icon, type IconComponent } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Waveform } from './rows';
import { Text, useWordRoom, WordRoom } from './text';

const SIGN_STROKE = 1.9;
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
  note?: string;
  spec?: string;
  icon?: IconComponent;
  uri?: string;
  picked?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const { roomy, room } = useWordRoom();
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
        roomy ? styles.whole : null,
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
      <View style={styles.templateTop}>
        {icon ? (
          <View style={styles.glass}>
            <Icon icon={icon} size={16} stroke={SIGN_STROKE} color={night.paper} />
          </View>
        ) : null}

        {spec ? (
          <View style={styles.templateSpec}>
            <Text role="metaTile" style={styles.onPhoto}>
              {spec}
            </Text>
          </View>
        ) : null}
      </View>
      <WordRoom.Provider value={room}>
        <View style={styles.templateFoot}>
          <Text role="tileTitle" style={styles.onPhoto}>
            {title}
          </Text>
          {note ? (
            <Text role="metaSm" style={styles.onPhotoQuiet}>
              {note}
            </Text>
          ) : null}
        </View>
      </WordRoom.Provider>
    </Pressable>
  );
}
export function PosterOrder({
  photos,
  template,
  templateIcon,
  length,
  shape,
  about,
  style,
}: {
  photos?: readonly string[];
  template?: string;
  templateIcon?: IconComponent;
  length: string;
  shape?: string;
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
          {templateIcon ? (
            <Icon icon={templateIcon} size={14} stroke={SIGN_STROKE} color={night.paper} />
          ) : null}
          <Text role="chipXs" style={styles.onPhoto}>
            {template}
          </Text>
        </View>
      ) : null}

      <View style={styles.posterFoot}>
        <Text role="figure" style={[styles.length, styles.onPhoto]}>
          {length}
        </Text>
        <View style={styles.posterShape}>
          {shape ? (
            <Text role="label" style={styles.onPhoto}>
              {shape}
            </Text>
          ) : null}

          {about ? (
            <Text role="metaSm" style={[styles.onPhotoQuiet, styles.toRight]}>
              {about}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
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
      {icon ? <Icon icon={icon} size={14} stroke={SIGN_STROKE} color={color.paper} /> : null}

      <Text role="chipXs">{label}</Text>
    </View>
  );
}
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
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
        {children}
      </View>
    </View>
  );
}
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
export function SummaryTrack({ title, note }: { title: string; note?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryTrack}>
      <View style={[styles.grow, styles.trackWords]}>
        <Text role="row">{title}</Text>
        {note ? <Text role="meta">{note}</Text> : null}
      </View>
      <Waveform />
    </View>
  );
}
export function BlockPicked({
  title,
  count,
  empty,
  director,
  children,
  style,
}: {
  title: string;
  count?: string;
  empty?: {
    title: string;
    note: string;
  };
  director?: {
    title: string;
    note: string;
  };
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const held = empty ?? director;
  return (
    <View style={[styles.picked, held ? styles.pickedEmpty : null, style]}>
      <View style={[styles.pickedHead, held ? null : styles.pickedHeadOverRows]}>
        <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.lead}>
          {title.toUpperCase()}
        </Text>

        {count ? <Text role="meta">{count}</Text> : null}
      </View>
      {held ? (
        <View accessible style={styles.silence}>
          <View style={styles.silenceSign}>
            <Icon
              icon={empty ? VolumeX : Sparkles}
              size={18}
              color={empty ? color.muted : color.paper}
            />
          </View>
          <View style={[styles.grow, styles.silenceWords]}>
            <Text role="row">{held.title}</Text>
            <Text role="meta">{held.note}</Text>
          </View>
        </View>
      ) : (
        children
      )}
    </View>
  );
}
export function CardDirector({
  title,
  note,
  picked,
  label,
  onPress,
  style,
}: {
  title: string;
  note: string;
  picked?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!picked }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.director,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
        style,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.directorSign}
      >
        <Icon icon={Sparkles} size={16} color={color.paper} />
      </View>
      <View style={[styles.grow, styles.silenceWords]}>
        <Text role="row">{title}</Text>

        <Text role="meta">{note}</Text>
      </View>
      <View style={[styles.directorTick, picked ? styles.directorTickOn : null]}>
        {picked ? <Icon icon={Check} size={15} stroke={3} color={color.ink} /> : null}
      </View>
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    template: {
      minHeight: 118,
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    whole: { width: '100%' },
    templatePicked: { borderWidth: 1.5, borderColor: color.accent },
    dimmed: { opacity: 0.4 },
    under: { opacity: 0.42 },
    templateScrim: { experimental_backgroundImage: photo.template },
    templateTop: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: space.s2,
      paddingTop: 12,
      paddingLeft: 12,
      paddingRight: 10,
    },
    glass: {
      width: 30,
      height: 30,
      borderRadius: radius.queue,
      backgroundColor: photo.signGlass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateSpec: {
      flexShrink: 1,
      marginTop: 1,
      marginLeft: 'auto',
      paddingVertical: 3,
      paddingHorizontal: space.s2,
      borderRadius: radius.pill,
      backgroundColor: photo.plateQuiet,
    },
    templateFoot: { marginTop: 'auto', padding: 12, gap: 2 },
    onPhoto: { color: photo.on },
    onPhotoQuiet: { color: photo.onQuiet },
    toRight: { textAlign: 'right' },
    grow: { flex: 1, minWidth: 0 },
    lead: { flexGrow: 1 },
    poster: {
      minHeight: 136,
      gap: space.s2,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    posterShots: { flexDirection: 'row', gap: 2 },
    posterCell: { flex: 1, backgroundColor: color.raise, overflow: 'hidden' },
    posterLead: { flex: 1.3 },
    posterScrim: { experimental_backgroundImage: photo.posterOrder },
    posterPlate: {
      alignSelf: 'flex-start',
      marginLeft: 14,
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 26,
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
      minHeight: 32,
      paddingLeft: space.s2,
      paddingRight: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.plateEdge,
      backgroundColor: color.accentSoft,
    },
    templateChipBare: { paddingLeft: 12 },
    posterFoot: {
      marginTop: 'auto',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: space.s3,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    length: { flexGrow: 1 },
    posterShape: { flexShrink: 1, marginLeft: 'auto', alignItems: 'flex-end', paddingBottom: 3 },
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
    trackWords: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: space.s3,
    },
    picked: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    pickedEmpty: { paddingTop: space.s3, paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
    pickedHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: space.s2,
    },
    pickedHeadOverRows: { paddingTop: space.s3, paddingHorizontal: 14, paddingBottom: 6 },
    silence: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    silenceSign: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    silenceWords: { gap: 2 },
    director: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    directorSign: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directorTick: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directorTickOn: { backgroundColor: color.paper, borderColor: color.paper },
  }),
);
