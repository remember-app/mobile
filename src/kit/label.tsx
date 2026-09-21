import { Check, Lock, Plus, Tag as TagIcon, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Divider } from './bits';
import { Icon } from './icon';
import { PRESS, useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/**
 * Spec 7.7 — labels: the boxes a person puts frames into. A label is a colour, a name and who can
 * see it, and the row below is the only place in the product where all three are drawn at once.
 */

/** Who a label is for (spec 7.7). The two are drawn differently because they mean opposite things. */
export type LabelScope = 'shared' | 'own';

/**
 * The coloured square a label is known by: 30 in its own row, 64 on the sheet that asks whether to
 * delete it, 18 on the chip that filters by it (spec 10.8.1, 10.8.2). The `tag` glyph inside it is
 * always read in `ink` — the eight label colours are all light, and this is the one place the
 * product puts dark on colour.
 */
export function LabelMark({ tint, size = 30 }: { tint: string; size?: 30 | 64 | 18 }) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size === 18 ? 6 : size === 64 ? 14 : 9 },
        { backgroundColor: tint },
      ]}
    >
      <Icon icon={TagIcon} size={size === 64 ? 30 : size === 18 ? 10 : 15} color={color.ink} />
    </View>
  );
}

/**
 * Spec 7.7 — one label, 56 tall. The whole row is the button: a press puts the chosen frames in,
 * another takes them back out, and the circle on the right is what says which it is now. There is
 * no second «apply» anywhere — a label is a box, and putting something in a box is the whole
 * gesture.
 *
 * `actions` is the edit mode of the same sheet (spec 10.8.1): the circle gives way to the pair of
 * buttons that rename and delete, and the row stops putting anything anywhere. A label somebody
 * else owns gets no pair at all, so it goes on being a row that files.
 *
 * A row with no `onPress` — a shared label the server will not let this person add to — has no
 * circle either: the circle is what says «press me to file», and drawing it over a row that does
 * not press is the dead button the kit refuses everywhere else (README, «Библиотека деталей»).
 */
export function RowLabel({
  name,
  count,
  scope,
  scopeLabel,
  inside,
  onPress,
  actions,
  divider,
  tint,
}: {
  name: string;
  /** «23 кадра» — written by the screen; the scope's own word follows it. */
  count?: string;
  scope: LabelScope;
  /** «видят все» / «только вы» — the glyph's own reading, and the screen writes it. */
  scopeLabel: string;
  /** Whether what is chosen is already in this label. */
  inside?: boolean;
  onPress?: () => void;
  /** The rename / delete pair, while the sheet is being edited. */
  actions?: ReactNode;
  divider?: boolean;
  /** The label's own colour, from the palette of eight. */
  tint: string;
}): ReactNode {
  const { color } = useTheme();
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const shared = scope === 'shared';

  const inner = (
    <>
      <LabelMark tint={tint} />
      <View style={styles.words}>
        <Text role="row" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          {count ? <Text role="meta">{count} ·</Text> : null}
          <Icon icon={shared ? Users : Lock} size={12} color={color.muted} />
          <Text role="meta">{scopeLabel}</Text>
        </View>
      </View>
      {actions ??
        (onPress ? (
          <View style={[styles.circle, inside ? styles.circleIn : null]}>
            <Icon
              icon={inside ? Check : Plus}
              size={inside ? 14 : 15}
              color={inside ? color.onFill : color.paper}
            />
          </View>
        ) : null)}
    </>
  );

  return (
    <View>
      {divider ? <Divider soft style={styles.inset} /> : null}
      {actions || !onPress ? (
        <View style={styles.row}>{inner}</View>
      ) : (
        <Pressable
          // `aria-pressed`, not `checked`: the row does a thing to what is chosen rather than
          // standing for a value of its own (spec 7.7).
          accessibilityRole="button"
          accessibilityState={{ selected: !!inside }}
          accessibilityLabel={name}
          onPress={onPress}
          {...props}
          style={({ pressed }) => [
            styles.row,
            hovered ? styles.hover : null,
            pressed && !reduced ? PRESS : null,
            focused ? focusRing : null,
          ]}
        >
          {inner}
        </Pressable>
      )}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    mark: { alignItems: 'center', justifyContent: 'center' },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s3,
    },
    hover: { backgroundColor: color.raise },
    inset: { marginLeft: 56 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    // The name is cut short when it has to be; the meta never is — «только вы» is the whole point
    // of the line it stands in.
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    circle: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleIn: { backgroundColor: color.accent, borderColor: color.accent },
  }),
);
