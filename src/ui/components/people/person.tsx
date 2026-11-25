import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';
import { Avatar } from '@/ui/kit/primitives/avatar';
import { Text } from '@/ui/kit/primitives/text';
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
  nameStyle,
}: {
  name: string | null | undefined;
  username: string | null | undefined;
  size?: number;
  heading?: boolean;
  note?: string;
  accent?: boolean;
  uri?: string | null;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  nameStyle?: StyleProp<TextStyle>;
}) {
  const own = name?.trim() ?? '';
  const nick = username?.trim() ?? '';
  const title = own || (nick ? `@${nick}` : '');
  return (
    <View style={[styles.person, style]}>
      <Avatar name={own} username={nick} size={size} uri={uri} />
      <View style={styles.words}>
        <View style={styles.nameRow}>
          <Text
            role={heading ? 'title' : 'row'}
            tone={accent ? 'accent' : 'paper'}
            numberOfLines={1}
            style={[styles.name, nameStyle]}
          >
            {title}
          </Text>
          {own && nick ? (
            <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
              {`@${nick}`}
            </Text>
          ) : null}
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
