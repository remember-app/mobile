import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { font, radius, space, themed } from '@/theme';

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
 * The kit's `.row-member`: avatar, who they are, then whatever the screen puts on the end — a role
 * chip, and for the organizer an icon button to remove them.
 *
 * CSS draws the hairline with `.row-member + .row-member`; React Native has no sibling selector, so
 * a list passes `divider` for every row but the first.
 */
export function RowMember({
  name,
  meta,
  tail,
  divider,
  children,
}: {
  name: string;
  meta?: string;
  /**
   * The end of the meta line, after the kit's «·» — the standing in «@marina · 42 кадра». It keeps
   * its whole width and `meta` gives way to it, because this is the part the screen is read for
   * and the username in front of it is already spelled out on the line above.
   */
  tail?: string;
  divider?: boolean;
  children?: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <Avatar name={name} />
      {/* One line each, and never more. The kit draws this row two lines tall beside a 40pt
          avatar, and on a 390pt phone the chip and the remove button leave the two of them about
          140pt: a name or a meta long enough to wrap breaks the row into a third height that
          swallows whatever the screen hung underneath it. So they clip instead of wrapping. */}
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {meta || tail ? (
          <View style={styles.metaLine}>
            {meta ? (
              <Text role="meta" numberOfLines={1} style={styles.metaGiving}>
                {meta}
              </Text>
            ) : null}
            {tail ? (
              <Text role="meta" numberOfLines={1} style={styles.metaKeeping}>
                {/* The space before the kit's «·» is non-breaking because it opens a text node,
                    and a plain space there is one the web throws away. */}
                {meta ? `\u00a0· ${tail}` : tail}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The kit's `.row-member--head`: the same row turned on the person reading it, and the top of the
 * profile (screen 8). The row is the subject of the screen instead of an item in a list, so the
 * circle is the larger one and the name is read in full voice; the hairline under it is the first of
 * that screen's two, and it is what ends «кто вы».
 *
 * No chip and nothing on the end: alone with your own account there is no role to state and nobody
 * to remove.
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
          <View style={styles.headMeta}>
            {username ? (
              <Text role="meta" numberOfLines={1}>
                {username}
              </Text>
            ) : null}
            {/* The address is the one that gives way: a username is short by the rules that let it
                be claimed, an address is not. */}
            {email ? (
              <Text role="meta" numberOfLines={1} style={styles.metaGiving}>
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
    chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ember },
    chipLabel: { fontSize: 13, lineHeight: 13, fontWeight: '500', color: color.muted },
    chipLabelOrganizer: { color: color.paper },
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
    rowBody: { flex: 1, minWidth: 0 },
    metaLine: { flexDirection: 'row', minWidth: 0 },
    // The kit's `.row-member__meta` gap, which the list rows spend on the «·» instead: here the two
    // are separate facts about one account, not one sentence.
    headMeta: { flexDirection: 'row', minWidth: 0, gap: space.s2 },
    // Only the first half gives way, so what follows the «·» is never the thing that gets cut.
    // Both are spelled out: React Native shrinks nothing unless told to, the web shrinks
    // everything unless told not to, and this line has to break the same way on both.
    metaGiving: { flexShrink: 1 },
    metaKeeping: { flexShrink: 0 },
    name: { fontSize: 16, lineHeight: 19.2, fontWeight: '500' },
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
