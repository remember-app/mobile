import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, radius, space, themed, useTheme } from '@/theme';

import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';

/**
 * Section 7 — who is in a memory. Plus the invite link of section 11, which is how they get there.
 */

/** The kit's 40-wide `.avatar`. */
const AVATAR = 40;

/**
 * The kit's `.avatar`: one letter of the name in a circle. It only repeats the name written beside
 * it, so screen readers step over it.
 */
export function Avatar({
  name,
  lg,
  style,
}: {
  name: string;
  /** `.avatar-lg` — «тот же кружок крупнее, там, где человек смотрит на себя, а не на список». */
  lg?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    <View
      style={[styles.avatar, lg ? styles.avatarLg : null, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, lg ? styles.initialLg : null]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
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
  checked,
  onPress,
  disabled,
}: {
  label: string;
  /**
   * `.chip-action[aria-pressed="true"]` — the chip did not move and now states what it did, with
   * the kit's green check in front of the word. What it says changes by a letter or two, so the
   * caller passes the new wording along with this: «В контакты» becomes «В контактах».
   */
  checked?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!checked }}
      disabled={disabled}
      // `.chip-action::after{inset:-9px -6px}` — drawn 26 high, felt at the kit's 44.
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      onPress={onPress}
      {...props}
      style={[
        styles.chip,
        checked ? styles.chipChecked : null,
        hovered ? styles.chipHover : null,
        focused ? focusRing : null,
        disabled ? styles.off : null,
      ]}
    >
      {/* The kit's own `.ico-s` at 13 and stroke 3, the weight it draws a check at everywhere —
          the same one the selected frame carries in its corner. */}
      {checked ? <Check size={13} color={color.fixed} strokeWidth={3} /> : null}
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
  gone,
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
  /**
   * `.row-member--gone` — the row of somebody just taken off a list, still standing in its own
   * place. Only the name goes muted, which is the whole modifier in the kit: nothing moves, so the
   * way back is under the same finger that made the mistake.
   */
  gone?: boolean;
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
          <Text style={[styles.name, gone ? styles.nameGone : null]} numberOfLines={1}>
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
 * The kit's `.row-member--head`: the same row turned on the person reading it, and the top of the
 * profile (screen 8). The row is the subject of the screen instead of an item in a list, so the
 * circle is the larger one and the name is read in full voice; the hairline under it is the first of
 * that screen's two, and it is what ends «кто вы».
 *
 * The second line is the row's own — the kit gives the head the same `.row-member__meta` — but it
 * carries two facts about one account instead of a standing: the username and the address. No chip
 * and nothing on the end: alone with your own account there is no standing to state and nobody to
 * remove.
 */
export function MemberHead({
  name,
  username,
  email,
}: {
  name: string;
  username?: string;
  email?: string;
}) {
  const styles = useStyles();

  return (
    <View style={styles.head}>
      <Avatar name={name} lg />
      <View style={styles.rowBody}>
        {/* The kit's «Края»: a long name and a long address each cut with an ellipsis rather than
            wrapping, so the circle and the hairline under them never move. */}
        <Text role="title" numberOfLines={1}>
          {name}
        </Text>
        {username || email ? (
          <View style={styles.metaLine}>
            {username ? (
              <Text role="meta" numberOfLines={1}>
                {username}
              </Text>
            ) : null}
            {/* The address gives way, the same half of the line that gives way in a roster row: a
                username is short by the rules that let it be claimed, an address is not. */}
            {email ? (
              <Text role="meta" numberOfLines={1} style={styles.who}>
                {email}
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
    // `.avatar-lg{width:56px; height:56px; font-size:20px}`.
    avatarLg: { width: 56, height: 56 },
    initial: { fontFamily: font.display, fontSize: 15, lineHeight: 18 },
    initialLg: { fontSize: 20, lineHeight: 24 },
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
    // `.chip-action[aria-pressed="true"]{border-color:var(--fixed-line)}` — the one line that
    // changes when the chip has been pressed; the word beside the check does the rest.
    chipChecked: { borderColor: shade.fixedLine },
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
    // `.row-member--head{padding:0 0 var(--s5); border-bottom:1px solid var(--line)}` — the row
    // stands at the very top of the body, so it takes nothing above itself.
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingBottom: space.s5,
      borderBottomWidth: 1,
      borderBottomColor: color.line,
    },
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
    // `.row-member--gone .row-member__name{color:var(--muted)}` — the one thing the modifier does.
    nameGone: { color: color.muted },
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
