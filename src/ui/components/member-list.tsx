import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CollapsibleList } from '@/ui/components/collapsible-list';
import { Contribution } from '@/ui/components/contribution';
import { MemberRowsSkeleton } from '@/ui/components/skeletons';
import { i18n, locale } from '@/ui/i18n';
import { Avatar } from '@/ui/kit/avatar';
import { Text } from '@/ui/kit/text';
import { loadingState, subscribeLoading } from '@/ui/mocks/loading';
import type { MockMember } from '@/ui/mocks/members';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { radius, space, themed } from '@/ui/theme';

export const gigabytes = (value: number): string =>
  `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(value)} ${i18n.t('unit.gb')}`;

export function MemberList({
  members,
  onSelect,
  onAdd,
}: {
  members: readonly MockMember[];
  onSelect?: (member: MockMember) => void;
  onAdd?: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const loading = useSyncExternalStore(subscribeLoading, loadingState);
  const isSelf = (member: MockMember) => member.username === profile.username;
  const order = (list: readonly MockMember[]) =>
    [...list].sort((a, b) => Number(isSelf(b)) - Number(isSelf(a)));
  const contributors = order(members.filter((member) => member.role !== 'viewer'));
  const viewers = order(members.filter((member) => member.role === 'viewer'));

  if (loading) return <MemberRowsSkeleton rows={4} />;

  const row = (member: MockMember) => {
    const face = (
      <View style={styles.member}>
        <Avatar name={member.name} size={44} />
        <View style={styles.words}>
          <View style={styles.nameRow}>
            <Text
              role="row"
              tone={isSelf(member) ? 'accent' : 'paper'}
              numberOfLines={1}
              style={styles.name}
            >
              {member.name}
            </Text>
            <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
              {`@${member.username}`}
            </Text>
          </View>
        </View>
        <View style={styles.standing}>
          <Contribution contribution={member.contribution} />
        </View>
      </View>
    );
    return onSelect ? (
      <Pressable key={member.id} onPress={() => onSelect(member)} accessibilityRole="button">
        {face}
      </Pressable>
    ) : (
      <View key={member.id}>{face}</View>
    );
  };

  return (
    <View style={styles.card}>
      {onAdd ? (
        <>
          <Pressable accessibilityRole="button" onPress={onAdd} style={styles.add}>
            <Text role="row" tone="accent">
              {t('members.add')}
            </Text>
          </Pressable>
          <View style={styles.divider} />
        </>
      ) : null}
      {members.length === 0 ? (
        <Text role="note" tone="muted" style={styles.empty}>
          {t('members.empty')}
        </Text>
      ) : (
        <CollapsibleList collapsed={320} expanded={512}>
          {contributors.map(row)}
          {viewers.length > 0 ? (
            <View style={styles.break}>
              <View style={styles.line} />
              <Text role="metaSm" tone="muted">
                {t('members.viewers')}
              </Text>
              <View style={styles.line} />
            </View>
          ) : null}
          {viewers.map(row)}
        </CollapsibleList>
      )}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    empty: {
      paddingVertical: space.s5,
      textAlign: 'center',
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      overflow: 'hidden',
    },
    add: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    member: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
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
    standing: {
      maxWidth: '48%',
      alignItems: 'flex-end',
    },
    break: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: space.s2,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
  }),
);
