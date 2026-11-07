import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Avatar } from '@/ui/kit/avatar';
import { Text } from '@/ui/kit/text';
import { space } from '@/ui/theme';

export function Person({
  name,
  username,
  size = 40,
  heading,
  note,
  accent,
  uri,
  right,
  style,
}: {
  name: string;
  username: string;
  size?: number;
  heading?: boolean;
  note?: string;
  accent?: boolean;
  uri?: string | null;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.person, style]}>
      <Avatar name={name} size={size} uri={uri} />
      <View style={styles.words}>
        <View style={styles.nameRow}>
          <Text
            role={heading ? 'title' : 'row'}
            tone={accent ? 'accent' : 'paper'}
            numberOfLines={1}
            style={styles.name}
          >
            {name}
          </Text>
          <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
            {`@${username}`}
          </Text>
        </View>
        {note ? (
          <Text role="noteSm" tone="faint">
            {note}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1 },
  nick: { flexShrink: 1 },
});
