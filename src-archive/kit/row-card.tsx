import { ChevronRight } from 'lucide-react-native';
import { Children, type ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, themed, useTheme } from '@/theme';
import { Divider } from './bits';
import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';
import { AvatarStack } from './member';
import { Text } from './text';
import { Track } from './toggle';
export function RowCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, style]}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <Divider soft style={styles.rule} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}
export function RowProp({
  label,
  value,
  empty,
  faces,
  busy,
  onPress,
}: {
  label: string;
  value?: string;
  empty: string;
  faces?: readonly string[];
  busy?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const said = value || empty;
  return (
    <Row label={`${label}: ${said}`} onPress={onPress} busy={busy} style={styles.prop}>
      <Text role="note" style={styles.propLabel}>
        {label}
      </Text>
      {faces ? (
        <View style={[styles.grow, styles.faces]}>
          {faces.length > 0 ? <AvatarStack names={faces} size={26} /> : null}
          <Text role="note">{said}</Text>
        </View>
      ) : (
        <Text role="rowSm" tone={value ? 'paper' : 'muted'} style={styles.grow}>
          {said}
        </Text>
      )}
      {busy ? (
        <Spinner size={16} />
      ) : onPress ? (
        <Icon icon={ChevronRight} size={17} stroke={2} color={color.faint} />
      ) : null}
    </Row>
  );
}
export function RowDo({
  icon,
  label,
  note,
  danger,
  on,
  busy,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  note?: string;
  danger?: boolean;
  on?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const tint = danger ? color.dangerText : color.paper;
  return (
    <Row
      label={label}
      hint={note}
      checked={on}
      busy={busy}
      onPress={onPress}
      style={[styles.act, note ? styles.actNoted : null]}
    >
      <View style={note ? styles.iconTop : null}>
        {busy ? <Spinner size={16} /> : <Icon icon={icon} size={19} stroke={1.8} color={tint} />}
      </View>
      <View style={[styles.grow, styles.actWords]}>
        <Text role="row" style={{ color: tint }}>
          {label}
        </Text>
        {note ? (
          <Text role="noteSm" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {on === undefined ? null : (
        <View style={styles.switchAt}>
          <Track value={on} />
        </View>
      )}
    </Row>
  );
}
function Row({
  label,
  hint,
  checked,
  busy,
  onPress,
  style,
  children,
}: {
  label: string;
  hint?: string;
  checked?: boolean;
  busy?: boolean;
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { focused, props } = useHoverFocus();
  const focusRing = useFocusRing();
  if (!onPress)
    return (
      <View accessible accessibilityLabel={label} style={style}>
        {children}
      </View>
    );
  return (
    <Pressable
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ busy: !!busy, disabled: !!busy, checked }}
      disabled={busy}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [style, pressed ? styles.pressed : null, focused ? focusRing : null]}
    >
      {children}
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.ink,
      overflow: 'hidden',
    },
    rule: { marginLeft: space.s4 },
    grow: { flex: 1, minWidth: 0 },
    pressed: { backgroundColor: color.raise },
    prop: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingVertical: space.s2,
    },
    propLabel: { width: 92 },
    faces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2 },
    act: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingVertical: space.s2,
    },
    actNoted: { minHeight: 60, alignItems: 'flex-start', paddingVertical: space.s3 },
    iconTop: { paddingTop: 1 },
    switchAt: { alignSelf: 'center' },
    actWords: { gap: 2 },
  }),
);
