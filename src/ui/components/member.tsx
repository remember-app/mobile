import { Check } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Avatar, AvatarStack } from '@/ui/kit/avatar';
import { Divider, LiveDot } from '@/ui/kit/bits';
import { Icon } from '@/ui/kit/icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from '@/ui/kit/interaction';
import { Text } from '@/ui/kit/text';
import { font, height, radius, space, themed, useTheme } from '@/ui/theme';

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
