import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, radius, space, themed, useTheme } from '@/theme';

import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/**
 * Section 7 — who is in a memory. Plus the invite link of section 11, which is how they get there.
 */

/**
 * The kit's 40-wide `.avatar`. Named for the same reason `SHEET_GAP` is: a screen hanging something
 * under a member's name has to start it where the name starts, and that offset is this plus the
 * row's own gap — measured by hand it drifts out of its column the day the circle changes size.
 */
export const AVATAR = 40;

/**
 * The kit's `.avatar`: one letter of the name in a circle. It only repeats the name written beside
 * it, so screen readers step over it.
 */
export function Avatar({ name, style }: { name: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();

  return (
    <View
      style={[styles.avatar, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/**
 * The kit's `.chip`: a role, read as a word and not as a colour. `organizer` is the one that gets
 * the ember dot — the kit gives the colour to exactly one of the three.
 */
export function Chip({ label, organizer }: { label: string; organizer?: boolean }) {
  const styles = useStyles();

  return (
    <View style={[styles.chip, organizer ? styles.chipOrganizer : null]}>
      {organizer ? <View style={styles.chipDot} /> : null}
      <Text style={[styles.chipLabel, organizer ? styles.chipLabelOrganizer : null]}>{label}</Text>
    </View>
  );
}

/**
 * The kit's `.chip-action`: the one chip in the product that is pressed rather than read. A chip
 * and not a small button, because it stands exactly where a status word stands and is exactly as
 * tall as one — «ростом ровно с надпись, которую она заменяет». That is the whole point of it: the
 * row carrying it is no taller than the row next to it, and the stack of people keeps one edge.
 */
export function ChipAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      // `.chip-action::after{inset:-9px -6px}` — drawn 26 high, felt at the kit's 44.
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      onPress={onPress}
      {...props}
      style={[
        styles.chip,
        hovered ? styles.chipHover : null,
        focused ? focusRing : null,
        disabled ? styles.off : null,
      ]}
    >
      <Text style={[styles.chipLabel, styles.chipLabelAction]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The kit's `.status`: a dot and the word for where something stands. `ready` is `.status-ready`,
 * the kit's one green — on the roster it belongs to «Всё загрузил» alone, which is what lets the
 * organizer see in one glance who is still owed.
 */
export function Status({ text, ready }: { text: string; ready?: boolean }) {
  const { color } = useTheme();
  const styles = useStyles();
  const tint = ready ? color.fixed : color.muted;

  return (
    <View style={styles.status}>
      <View style={[styles.statusDot, { backgroundColor: tint }]} />
      <Text style={[styles.statusText, { color: tint }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/**
 * The kit's `.row-member`: two lines beside one avatar. The top one carries the name and whatever
 * the screen puts on the end of it — a role chip, and for the organizer the cross that removes
 * somebody. The bottom one is that person's contribution: their username, where they stand, and how
 * many frames they have brought. It runs the full width *under* the chip and the cross rather than
 * in what is left beside them, because a whole phrase of a standing has nowhere else to live.
 *
 * Both lines are held to a constant the kit sets (28 and 26), so a row with a pressable chip in it
 * is exactly as tall as a row with a word in the same place, and the stack keeps one edge.
 *
 * CSS draws the hairline with `.row-member + .row-member`; React Native has no sibling selector, so
 * a list passes `divider` for every row but the first.
 */
export function RowMember({
  name,
  meta,
  status,
  count,
  divider,
  children,
}: {
  name: string;
  /** `.row-member__who` — the username. The one part of the line that gives way when it is tight. */
  meta?: string;
  /**
   * Where they stand: a `Status`, or on one's own row the `ChipAction` that sets it. A node rather
   * than a word, because the kit puts that switch in the very place the word would stand.
   */
  status?: ReactNode;
  /** `.row-member__count` — what they have brought so far, held right and never cut. */
  count?: string;
  divider?: boolean;
  children?: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <Avatar name={name} />
      <View style={styles.rowBody}>
        {/* One line and never two: on a 390pt phone the chip and the cross leave the name about
            140pt, and a name long enough to wrap would break the row onto a height the kit never
            drew. So it clips instead of wrapping. */}
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {children}
        </View>
        {meta || status || count ? (
          <View style={styles.metaLine}>
            {meta ? (
              <Text role="meta" numberOfLines={1} style={styles.who}>
                {meta}
              </Text>
            ) : null}
            {status}
            {count ? (
              <Text role="meta" style={styles.count}>
                {count}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The kit's `.invite`: the link, and next to it whatever the screen offers to do with it — copying
 * it, mostly. Revoking sits quietly underneath rather than inside, because a link gets replaced
 * often and that is not a red-button moment.
 */
export function Invite({ url, children }: { url: string; children?: ReactNode }) {
  const styles = useStyles();

  return (
    <View style={styles.invite}>
      <Text style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      {children}
    </View>
  );
}

const useStyles = themed(({ color, shade }) =>
  StyleSheet.create({
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
      borderWidth: 1,
      borderColor: color.line,
    },
    initial: { fontFamily: font.display, fontSize: 15, lineHeight: 18 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.raise,
    },
    chipOrganizer: { borderColor: shade.emberLine },
    chipHover: { borderColor: shade.lineHi },
    chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ember },
    chipLabel: { fontSize: 13, lineHeight: 13, fontWeight: '500', color: color.muted },
    chipLabelOrganizer: { color: color.paper },
    // `.chip-action{color:var(--paper)}` — it is read as a thing to press, not as a fact.
    chipLabelAction: { color: color.paper },
    off: { opacity: 0.45 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusText: { fontSize: 13, lineHeight: 13, fontWeight: '500' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
    divider: { borderTopWidth: 1, borderTopColor: color.line },
    rowBody: { flex: 1, minWidth: 0, gap: space.s1 },
    // The kit's two constants. The name holds the top line at 28 through its own leading; the
    // bottom one is floored at the height of a chip, so putting one there costs the row nothing.
    line: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 26 },
    // Only the username gives way. Both are spelled out: React Native shrinks nothing unless told
    // to, the web shrinks everything unless told not to, and this line has to break the same way on
    // both. The count is pushed to the edge so it stands in one column down the whole stack —
    // `role="meta"` is already tabular, which is what keeps that column from dancing.
    who: { flexShrink: 1, minWidth: 0 },
    count: { flexShrink: 0, marginLeft: 'auto' },
    name: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 28, fontWeight: '500' },
    invite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      padding: space.s2,
      paddingLeft: space.s4,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.card,
    },
    url: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 18, color: color.muted },
  }),
);
