import { Check } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Icon, type IconComponent } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.3, detail 21 — the choice card: one meaning at two heights. A tile 92 tall where two of
 * them stand side by side («Общий / Личный»), and a row where one of them stands alone («Без
 * музыки»). Both say the same thing — this is what you have chosen, and here is what it means —
 * which is why they are one part and not two.
 *
 * `readOnly` is the third state (spec 10.8.1): the choice was made and cannot be made again, so
 * there is no button at all. It is drawn as chosen but quiet — `accentSoft` under a `line` border,
 * the glyph and the words in `muted` — and it is read out as a value. Never a greyed-out button: a
 * disabled button promises that one day it will press.
 */
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
  /** What choosing it means — «видят все участники», «Только живой звук из видео». */
  note?: string;
  variant?: 'tile' | 'row';
  selected?: boolean;
  /** Made already and not up for discussion: drawn as chosen, quiet, and not a button. */
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
      {/* The tick on the right belongs to the row alone: a tile is chosen by its own border, and a
          row is a line of things where one of them has to be marked. */}
      {!tile && selected && !readOnly ? (
        <View style={styles.tick}>
          <Icon icon={Check} size={13} color={color.onFill} />
        </View>
      ) : null}
    </>
  );

  const shape = [
    tile ? styles.tile : styles.row,
    // A read-only card is the choice that was made — there is no other state for it to be in — so
    // it wears the chosen fill whether or not the caller also said `selected`.
    selected || readOnly ? styles.chosen : tile ? styles.plainTile : styles.plainRow,
    readOnly ? styles.quiet : null,
    style,
  ];

  if (readOnly) {
    return (
      // Not a button and not a disabled one — a value, with the words it is made of read out as one.
      // No `selected` state either: that would read it out as a choice on offer, which it is not.
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
      // A radio and not a button: these stand in twos and threes and exactly one of them is on,
      // which is the whole meaning of the part. The group around them belongs to the screen.
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={note}
      // The `aria-` spelling rather than `accessibilityState`: React Native takes both and maps this
      // one onto the other, and it is the one react-native-web actually draws — so the state is
      // provable in a story instead of being taken on trust.
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
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
      paddingHorizontal: space.s4 - 2,
      borderRadius: radius.section,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    // Spec 7.3: chosen is the accent's own quiet fill under a 1.5 accent border — the one place
    // `accentSoft` is used outside the director's own plates.
    chosen: { backgroundColor: color.accentSoft, borderColor: color.accent },
    // A tile stands on a sheet, which is `surface`, so an unchosen one drops to `ink`; a row stands
    // on a screen, which is `ink`, so an unchosen one rises to `surface`. Same rule, both ways up.
    plainTile: { backgroundColor: color.ink, borderColor: color.line, borderWidth: 1 },
    plainRow: { backgroundColor: color.surface, borderColor: color.line, borderWidth: 1 },
    // Chosen, and nothing to do about it: the fill stays, the border goes quiet.
    quiet: { borderColor: color.line },
    hover: { backgroundColor: color.raise },
    tileWords: { gap: 2 },
    // A tile is 92 with a glyph on top of it: the line under the name gets the smaller of the two
    // meta sizes, or the two of them together push the glyph off.
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
