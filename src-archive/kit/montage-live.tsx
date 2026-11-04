import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Animated,
  Pressable,
  Text as RNText,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { photo, radius, space, themed, useTheme } from '@/theme';
import { SparkMark } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useLoop, useReducedMotion } from './interaction';
import { Text } from './text';

const BLINK = 1000;
function Said({ said, unsaid }: { said?: string; unsaid?: string }) {
  return (
    <>
      {said}
      {unsaid ? (
        <>
          <Cursor />
          <RNText style={unsaidStyle}>{unsaid}</RNText>
        </>
      ) : null}
    </>
  );
}
const unsaidStyle = { color: 'transparent' } as const;
function Cursor() {
  const styles = useStyles();
  const beat = useLoop(BLINK);
  if (!beat) return null;
  return (
    <Animated.View
      style={[
        styles.cursor,
        { opacity: beat.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] }) },
      ]}
    />
  );
}
export function NoteThought({
  text,
  unsaid,
  style,
}: {
  text: string;
  unsaid?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.plateNote, style]}>
      <SparkMark />
      <Text role="log" style={styles.grow}>
        <Said said={text} unsaid={unsaid} />
      </Text>
    </View>
  );
}
export function LogEntry({
  time,
  fresh,
  uri,
  length,
  photos,
  source,
  text,
  unsaid,
  marks,
  children,
  onPress,
}: {
  time: string;
  fresh?: boolean;
  uri?: string;
  length?: string;
  photos?: readonly string[];
  source?: string;
  text?: string;
  unsaid?: string;
  marks?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const body = (
    <>
      {photos?.length ? (
        <View style={styles.series}>
          {photos.slice(0, 4).map((shot) => (
            <Image key={shot} source={{ uri: shot }} contentFit="cover" style={styles.seriesShot} />
          ))}
        </View>
      ) : null}

      {source ? <Text role="metaSm">{source}</Text> : null}
      {text || unsaid ? (
        <Text role="log">
          <Said said={text} unsaid={unsaid} />
        </Text>
      ) : null}
      {marks ? <View style={styles.marks}>{marks}</View> : null}
    </>
  );
  return (
    <View style={styles.entry}>
      <View style={[styles.dot, fresh ? styles.dotFresh : null]} />

      <Text role="metaTile" tone={fresh ? 'paper' : 'muted'}>
        {time}
      </Text>
      {children ?? (
        <Touch onPress={uri ? onPress : undefined}>
          {uri ? (
            <View style={styles.entryFile}>
              <View style={styles.shotSmall}>
                <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                {length ? (
                  <Text role="runtimeXs" style={styles.shotLength}>
                    {length}
                  </Text>
                ) : null}
              </View>
              <View style={styles.grow}>{body}</View>
            </View>
          ) : (
            body
          )}
        </Touch>
      )}
    </View>
  );
}
export function Journal({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.journal, style]}>
      <JournalLine />
      {children}
    </View>
  );
}
export function JournalLine() {
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.journalLine}
    />
  );
}
function Touch({
  label,
  onPress,
  style,
  children,
}: {
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        style,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
export function RowFilmAt({
  title,
  at,
  onPress,
}: {
  title: string;
  at: string;
  onPress?: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <Touch label={`${title} ${at}`} onPress={onPress} style={styles.filmAt}>
      <Icon icon={Play} size={16} color={color.paper} fill={color.paper} />
      <Text role="label" style={styles.grow}>
        {title}
      </Text>
      <Text role="meta" tone="accent">
        {at}
      </Text>
    </Touch>
  );
}
export function TileNumber({ figure, label }: { figure: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.number}>
      <Text role="figureTile">{figure}</Text>
      <Text role="metaSm">{label}</Text>
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    onPhoto: { color: photo.on },
    cursor: { width: 2, height: 15, marginLeft: 2, backgroundColor: color.spark },
    plateNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.accentEdge,
      backgroundColor: color.accentNote,
    },
    grow: { flex: 1, minWidth: 0 },
    journal: { paddingLeft: 22, gap: 18 },
    journalLine: {
      position: 'absolute',
      left: 5,
      top: 8,
      bottom: 0,
      width: 1,
      backgroundColor: color.line,
    },
    entry: { gap: 7 },
    dot: {
      position: 'absolute',
      left: -21,
      top: 5,
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: color.lineStrong,
      boxShadow: `0 0 0 3px ${color.ink}`,
    },
    dotFresh: { backgroundColor: color.spark },
    entryFile: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
    shotSmall: {
      width: 62,
      height: 62,
      borderRadius: radius.thumb,
      overflow: 'hidden',
      backgroundColor: color.raise,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    shotLength: { color: photo.on, paddingRight: 3, paddingBottom: 2 },
    series: { flexDirection: 'row', gap: space.s1 },
    seriesShot: { width: 44, height: 44, borderRadius: 9, backgroundColor: color.raise },
    marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    filmAt: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s3,
      borderRadius: radius.thumb,
      borderWidth: 1,
      borderColor: color.accentEdge,
      backgroundColor: color.accentNote,
    },
    number: {
      flexGrow: 1,
      gap: 2,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
  }),
);
