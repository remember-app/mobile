import { Check } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, themed, useTheme } from '@/ui/theme';
import { Icon, type IconComponent } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export function ChoiceCard({
  icon,
  title,
  note,
  variant = 'tile',
  selected,
  readOnly,
  onPress,
  style,
}: {
  icon: IconComponent;
  title: string;
  note?: string;
  variant?: 'tile' | 'row';
  selected?: boolean;
  readOnly?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const tile = variant === 'tile';
  const glyph = readOnly ? color.muted : selected ? color.paper : color.muted;
  const body = (
    <>
      {tile ? (
        <Icon icon={icon} size={18} color={glyph} />
      ) : (
        <View style={[styles.round, selected && !readOnly ? styles.roundOn : styles.roundOff]}>
          <Icon icon={icon} size={18} color={selected && !readOnly ? color.onFill : color.muted} />
        </View>
      )}
      <View style={tile ? styles.tileWords : styles.rowWords}>
        <Text role={tile ? 'controlSm' : 'row'} tone={readOnly ? 'muted' : 'paper'}>
          {title}
        </Text>
        {note ? (
          <Text role="meta" tone="muted" style={tile ? styles.tileNote : null}>
            {note}
          </Text>
        ) : null}
      </View>

      {!tile && selected && !readOnly ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={13} color={color.onFill} />
        </View>
      ) : null}
    </>
  );
  const shape = [
    tile ? styles.tile : styles.row,
    selected || readOnly ? styles.chosen : tile ? styles.plainTile : styles.plainRow,
    readOnly ? styles.quiet : null,
    style,
  ];
  if (readOnly) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={note ? `${title}. ${note}` : title}
        style={shape}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={note}
      aria-checked={!!selected}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        ...shape,
        hovered && !selected ? styles.hover : null,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {body}
    </Pressable>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      minWidth: 0,
      height: 92,
      padding: space.s3,
      justifyContent: 'space-between',
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
      paddingHorizontal: space.s4 - 2,
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chosen: { backgroundColor: color.accentSoft, borderColor: color.accent },
    plainTile: { backgroundColor: color.ink, borderColor: color.line },
    plainRow: { backgroundColor: color.surface, borderColor: color.line },
    quiet: { borderColor: color.line },
    hover: { backgroundColor: color.raise },
    tileWords: { gap: 2 },
    tileNote: { fontSize: 11, lineHeight: 14 },
    rowWords: { flex: 1, minWidth: 0, gap: 2 },
    round: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundOn: { backgroundColor: color.accent },
    roundOff: { backgroundColor: color.raise },
    tick: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      backgroundColor: color.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
