import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, font, radius, space } from '@/theme';

import { shade } from './shades';
import { Text } from './text';

/**
 * Section 7 — who is in a memory. Plus the invite link of section 11, which is how they get there.
 */

/**
 * The kit's `.avatar`: one letter of the name in a circle. It only repeats the name written beside
 * it, so screen readers step over it.
 */
export function Avatar({ name, style }: { name: string; style?: StyleProp<ViewStyle> }) {
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
  divider,
  children,
}: {
  name: string;
  meta?: string;
  divider?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <Avatar name={name} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>{name}</Text>
        {meta ? <Text role="meta">{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The kit's `.invite`: the link, and next to it whatever the screen offers to do with it — copying
 * it, mostly. Revoking sits quietly underneath rather than inside, because a link gets replaced
 * often and that is not a red-button moment.
 */
export function Invite({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <View style={styles.invite}>
      <Text style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
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
  chipOrganizer: { borderColor: shade.organizerLine },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.ember },
  chipLabel: { fontSize: 13, lineHeight: 13, fontWeight: '500', color: color.muted },
  chipLabelOrganizer: { color: color.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  rowBody: { flex: 1, minWidth: 0 },
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
});
