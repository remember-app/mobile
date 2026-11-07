import { useRouter } from 'expo-router';
import { CheckCircle2, CircleDashed, Clock } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Contribution } from '@/ui/components/contribution';
import { confirmAction } from '@/ui/confirm';
import { Avatar } from '@/ui/kit/avatar';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { type MockMember, setContribution } from '@/ui/mocks/members';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { radius, space, themed, useTheme } from '@/ui/theme';

import { gigabytes } from './member-list';

const CONTRIBUTIONS = [
  { value: 'not_started', icon: CircleDashed, label: 'members.notStarted' },
  { value: 'more_coming', icon: Clock, label: 'members.moreComing' },
  { value: 'done', icon: CheckCircle2, label: 'members.done' },
] as const;

export function MemberSheet({
  projectId,
  member,
  onClose,
}: {
  projectId: string;
  member: MockMember | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const { color } = useTheme();
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
                  {t('members.files')}
                </Text>
              </View>
              <View style={styles.tile}>
                <Text role="row">{gigabytes(member.gigabytes)}</Text>
                <Text role="noteSm" tone="muted">
                  {t('members.storage')}
                </Text>
              </View>
              <View style={styles.tile}>
                <Contribution contribution={member.contribution} />
                <Text role="noteSm" tone="muted">
                  {t('members.contribution')}
                </Text>
              </View>
            </View>
          )}

          {self && member.role !== 'viewer' ? (
            <View style={styles.switch}>
              {CONTRIBUTIONS.map(({ value, icon: Icon, label }) => {
                const on = member.contribution === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={t(label)}
                    aria-checked={on}
                    onPress={() => setContribution(projectId, member.id, value)}
                    style={[
                      styles.switchOption,
                      { backgroundColor: on ? color.paper : 'transparent' },
                    ]}
                  >
                    <Icon size={22} color={on ? color.ink : color.muted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {self ? (
            <Button
              label={t('members.leave')}
              variant="danger"
              onPress={() =>
                confirmAction({
                  confirm: t('action.leave'),
                  destructive: true,
                  onConfirm: () => {
                    onClose();
                    router.replace('/home');
                  },
                })
              }
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
    switch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      padding: space.s1,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.ink,
    },
    switchOption: {
      flex: 1,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
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
