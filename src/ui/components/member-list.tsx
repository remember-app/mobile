import { Pressable, StyleSheet, View } from 'react-native';

import { Contribution } from '@/ui/components/contribution';
import { Avatar } from '@/ui/kit/avatar';
import { Text } from '@/ui/kit/text';
import type { MockMember } from '@/ui/mocks/members';
import { radius, space, themed } from '@/ui/theme';

export const gigabytes = (value: number): string =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)} ГБ`;

export function MemberList({
  members,
  onSelect,
}: {
  members: readonly MockMember[];
  onSelect?: (member: MockMember) => void;
}) {
  const styles = useStyles();
  const contributors = members.filter((member) => member.role !== 'viewer');
  const viewers = members.filter((member) => member.role === 'viewer');

  const group = (list: readonly MockMember[]) => (
    <View style={styles.card}>
      {list.map((member) => {
        const row = (
          <View style={styles.member}>
            <Avatar name={member.name} size={44} />
            <View style={styles.words}>
              <Text role="row">{member.name}</Text>
              <Text role="noteSm" tone="muted">{`@${member.username}`}</Text>
            </View>
            <View style={styles.standing}>
              <Contribution contribution={member.contribution} />
            </View>
          </View>
        );
        return onSelect ? (
          <Pressable key={member.id} onPress={() => onSelect(member)} accessibilityRole="button">
            {row}
          </Pressable>
        ) : (
          <View key={member.id}>{row}</View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.groups}>
      {group(contributors)}
      {viewers.length > 0 ? group(viewers) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    groups: {
      gap: space.s3,
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s4,
    },
    member: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    standing: {
      maxWidth: '48%',
      alignItems: 'flex-end',
    },
  }),
);
