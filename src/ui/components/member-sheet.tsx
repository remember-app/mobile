import { useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { Contribution } from '@/ui/components/contribution';
import { Avatar } from '@/ui/kit/avatar';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import type { MockMember } from '@/ui/mocks/members';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { radius, space, themed } from '@/ui/theme';

import { gigabytes } from './member-list';

export function MemberSheet({
  member,
  onClose,
}: {
  member: MockMember | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const styles = useStyles();
  const self = member !== null && member.username === profile.username;

  return (
    <BottomSheet visible={member !== null} onClose={onClose}>
      {member ? (
        <View style={styles.body}>
          <View style={styles.person}>
            <Avatar name={member.name} size={72} />
            <View style={styles.words}>
              <View style={styles.nameRow}>
                <Text role="title" numberOfLines={1} style={styles.name}>
                  {member.name}
                </Text>
                <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
                  {`@${member.username}`}
                </Text>
              </View>
            </View>
          </View>

          {member.role === 'viewer' ? null : (
            <View style={styles.stats}>
              <View style={styles.tile}>
                <Text role="row">{member.files}</Text>
                <Text role="noteSm" tone="muted">
                  Файлы
                </Text>
              </View>
              <View style={styles.tile}>
                <Text role="row">{gigabytes(member.gigabytes)}</Text>
                <Text role="noteSm" tone="muted">
                  Хранилище
                </Text>
              </View>
              <View style={styles.tile}>
                <Contribution contribution={member.contribution} />
                <Text role="noteSm" tone="muted">
                  Вклад
                </Text>
              </View>
            </View>
          )}

          {self ? (
            <Button
              label="Выйти из воспоминания"
              variant="danger"
              onPress={() => {
                onClose();
                router.replace('/home');
              }}
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      gap: space.s4,
    },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      flexShrink: 1,
    },
    nick: {
      flexShrink: 1,
    },
    stats: {
      flexDirection: 'row',
      gap: space.s2,
    },
    tile: {
      flex: 1,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: radius.field,
      backgroundColor: color.raise,
      paddingHorizontal: space.s2,
    },
  }),
);
