import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './text';

/**
 * Spec 7.3, detail 80 — the head of a block: its name on the left in the eyebrow, and on the right
 * whatever speaks for the whole block — «Все» over a section of the filter, with the calendar after
 * it over the days. The words are the caller's, caps and all.
 *
 * The name takes the width and the tail never gives; on the largest type the tail goes under the
 * name rather than squeeze it to a letter a line.
 *
 * `tone="danger"` is the name turned into the answer — «КОД НЕ ПОДОШЁЛ» over the cells of a code the
 * api refused (detail 12).
 */
export function BlockHead({
  label,
  tone = 'muted',
  children,
}: {
  label: string;
  tone?: 'muted' | 'danger';
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text role="eyebrow" tone={tone} accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  label: { flexGrow: 1 },
});
