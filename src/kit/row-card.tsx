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

/**
 * Spec 7.7, detail 77 — what one thing in a sheet is and what can be done with it, as rows in a card
 * on `ink` (`SheetMyFrame`, `SheetFilmInfo`). Unlike a summary row or a menu action, these stand in
 * a card of their own, and a property in it may be pressed to change it.
 */

/** The card: rows one under another, a `raise` hairline between two, 16 in from the left. */
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

/**
 * A property — «Снято», «Место»: its name in a column of 92 and what it is, which wraps (it is the
 * sense of the row). With `onPress` it leads somewhere and wears the chevron; `busy` stands the
 * spinner in its place. No value is said in `muted` — `empty`, «Не указано».
 *
 * With `faces` it is «Посмотрели» (`SheetFilmInfo`): the people in a row of 26 (detail 32) and the
 * value after them as a count, 13 / 500 `muted` — «4 из 6». Nobody yet is the count alone.
 */
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
  /** What stands for no value at all. */
  empty: string;
  /** The names of the people the value counts. */
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

/**
 * An action — «Удалить у всех» in `danger`, always the last row of its card. With `note` it says
 * what the action leads to under its name, «Останется у вас, в ролик не попадёт»; with `on` it is a
 * switch, and the switch stands at its end.
 */
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
  /** A switch, and whether it is on. */
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

/** The press, the focus ring and the busy state every row of the card answers with. */
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
    // 52 a floor: the value wraps and the row grows down with it.
    prop: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingVertical: space.s2,
    },
    propLabel: { width: 92 },
    // The count goes under the faces, rather than squeeze them, once the two no longer share a line.
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
