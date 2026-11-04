import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { faceOf, font, height, radius, space, themed, useTheme } from '@/theme';
import { Divider, LiveDot } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

const LETTERS: Record<number, number> = {
  16: 6,
  18: 7,
  24: 9,
  26: 10,
  28: 10,
  30: 11,
  32: 11,
  36: 12,
  38: 13,
  42: 14,
  48: 15,
  64: 18,
};
const BOLD = new Set([16, 18, 24, 28, 36, 38, 48]);
export function Avatar({
  name,
  size = 42,
  uri,
  ring,
  gone,
  display,
  stacked,
  style,
}: {
  name: string;
  size?: number;
  uri?: string | null;
  ring?: boolean;
  gone?: boolean;
  display?: boolean;
  stacked?: {
    letters: number;
    covered: number;
  };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        circle,
        ring ? { boxShadow: `0 0 0 1.5px ${color.spark}` } : null,
        { backgroundColor: gone ? color.surface : faceOf(name) },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} contentFit="cover" style={[StyleSheet.absoluteFill, circle]} />
      ) : (
        <Text
          role={display ? 'subtitleDisplay' : 'row'}
          tone={gone ? 'faint' : 'paper'}
          maxFontSizeMultiplier={1}
          style={
            stacked
              ? {
                  fontSize: stacked.letters,
                  fontFamily: font.bold,
                  paddingRight: stacked.covered,
                }
              : {
                  fontSize: display
                    ? Math.round(size * 0.3)
                    : (LETTERS[size] ?? Math.round(size / 3)),
                  ...(!display && BOLD.has(size) ? { fontFamily: font.bold } : null),
                  letterSpacing: 0,
                }
          }
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = lead(words[0]);
  const second = lead(words.length > 1 ? words[1] : words[0].slice(first.length));
  return (first + second).toUpperCase();
}
const LEAD =
  /^(?:\p{Regional_Indicator}{2}|.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*(?:\u200D.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*)*)/u;
function lead(word: string): string {
  return LEAD.exec(word)?.[0] ?? '';
}
const STACK = {
  36: { overlap: 12, halo: 2, letters: 11 },
  24: { overlap: 7, halo: 0, letters: 8 },
  26: { overlap: -5, halo: 0, letters: 10 },
} as const;
export function AvatarStack({
  names,
  on,
  size = 36,
}: {
  names: readonly string[];
  on?: string;
  size?: keyof typeof STACK;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();
  const under = on ?? color.surface;
  const { overlap, halo, letters } = STACK[size];
  const apart = overlap < 0;
  const collar = apart
    ? null
    : halo
      ? { boxShadow: `0 0 0 ${halo}px ${under}` }
      : { borderWidth: 1, borderColor: under };
  const over = { marginLeft: -overlap };
  const rest = names.length > 4 ? names.length - 3 : 0;
  const faces = rest ? names.slice(0, 3) : names.slice(0, 4);
  const last = rest ? -1 : faces.length - 1;
  return (
    <View style={styles.row}>
      {faces.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          stacked={{ letters, covered: i === last || apart ? 0 : overlap + halo }}
          style={[collar, i === 0 ? null : over]}
        />
      ))}
      {rest ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.more, collar, over, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text
            role="row"
            tone={apart ? 'muted' : undefined}
            maxFontSizeMultiplier={1}
            style={[
              { fontSize: letters, fontFamily: font.bold },
              apart ? styles.moreFigures : null,
            ]}
          >
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
export function FaceToggle({
  name,
  selected,
  excluded,
  onPress,
}: {
  name: string;
  selected: boolean;
  excluded?: boolean;
  onPress: () => void;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useFaceStyles();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.face,
        selected
          ? { boxShadow: `0 0 0 2px ${color.surface}, 0 0 0 4px ${color.paper}` }
          : excluded
            ? styles.dim
            : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      <Avatar name={name} size={height.face} />
      {selected ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={9} color={color.ink} />
        </View>
      ) : null}
    </Pressable>
  );
}
const FACE_AIR = space.s2;
const FACE_EDGE = 2;
export function faceGap(width: number, count: number): number | undefined {
  const across = Math.floor((width + FACE_AIR) / (height.face + FACE_AIR));
  if (count <= across || across < 2) return undefined;
  return Math.floor((width - across * height.face) / (across - 1));
}
export function FaceRow({
  faces,
  onToggle,
}: {
  faces: readonly {
    id: string;
    name: string;
    selected: boolean;
  }[];
  onToggle: (id: string) => void;
}) {
  const styles = useFaceStyles();
  const [width, setWidth] = useState(0);
  const gap = faceGap(width - FACE_EDGE * 2, faces.length);
  const filtering = faces.some((face) => face.selected);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.row, gap === undefined ? styles.spread : { columnGap: gap }]}
    >
      {faces.map((face) => (
        <FaceToggle
          key={face.id}
          name={face.name}
          selected={face.selected}
          excluded={filtering && !face.selected}
          onPress={() => onToggle(face.id)}
        />
      ))}
    </View>
  );
}
const useFaceStyles = themed(({ color }) =>
  StyleSheet.create({
    face: { width: height.face, height: height.face, borderRadius: radius.pill },
    dim: { opacity: 0.5 },
    tick: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: radius.pill,
      backgroundColor: color.paper,
      borderWidth: 2,
      borderColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: space.s3,
      paddingTop: FACE_EDGE,
      paddingHorizontal: FACE_EDGE,
    },
    spread: { justifyContent: 'space-between' },
  }),
);
export function WatchingPill({
  names,
  count,
  label,
  style,
}: {
  names: readonly string[];
  count: number;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();
  return (
    <View accessible accessibilityLabel={label} style={[styles.pill, style]}>
      <AvatarStack names={names} size={24} on={color.ink} />
      <View style={styles.pillCount}>
        <LiveDot />
        <Text role="meta" style={styles.pillFigure}>
          {count}
        </Text>
      </View>
    </View>
  );
}
const useStackStyles = themed(({ color }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    more: {
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreFigures: { fontVariant: ['tabular-nums'] },
    pill: {
      height: height.watchPill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: space.s3 - 2,
      borderRadius: radius.pill,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    pillCount: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
    pillFigure: { color: color.paper, fontFamily: font.semi },
  }),
);
export function RowMember({
  name,
  meta,
  status,
  divider,
  gone,
  uri,
}: {
  name: string;
  meta?: string;
  status?: ReactNode;
  divider?: boolean;
  gone?: boolean;
  uri?: string | null;
}) {
  const styles = useStyles();
  return (
    <View>
      {divider ? <Divider soft style={styles.inset} /> : null}
      <View style={styles.member}>
        <Avatar name={name} size={38} uri={uri} gone={gone} />
        <View style={styles.rowWords}>
          <Text role="row" tone={gone ? 'faint' : 'paper'}>
            {name}
          </Text>
          {meta ? <Text role="meta">{meta}</Text> : null}
        </View>
        {status}
      </View>
    </View>
  );
}
export function RowContact({
  name,
  handle,
  variant = 'saved',
  divider,
  children,
}: {
  name: string;
  handle?: string;
  variant?: 'saved' | 'found' | 'gone';
  divider?: boolean;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const gone = variant === 'gone';
  return (
    <View>
      {divider && variant === 'saved' ? <Divider /> : null}
      <View style={[styles.contact, variant === 'found' ? styles.card : null]}>
        <Avatar name={name} size={42} gone={gone} />
        <View style={styles.contactWords}>
          <Text role="row" tone={gone ? 'faint' : 'paper'}>
            {name}
          </Text>

          {handle ? (
            <Text role="meta" tone={gone ? 'faint' : 'muted'} fit>
              {handle}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    avatar: { backgroundColor: color.raise, alignItems: 'center', justifyContent: 'center' },
    contact: {
      minHeight: height.row,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: 11,
    },
    member: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: 14,
    },
    inset: { marginLeft: 64 },
    card: {
      paddingVertical: 10,
      paddingLeft: 10,
      paddingRight: space.s3,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.field,
    },
    rowWords: { flex: 1, minWidth: 0, gap: 2 },
    contactWords: { flex: 1, minWidth: '40%', gap: 2 },
    rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    grow: { flexShrink: 1 },
  }),
);
