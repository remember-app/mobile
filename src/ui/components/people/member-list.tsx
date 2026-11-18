import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Member } from '@/models';
import { CollapsibleList } from '@/ui/components/common/collapsible-list';
import { MemberRowsSkeleton } from '@/ui/components/feedback/skeletons';
import { Contribution } from '@/ui/components/people/contribution';
import { Person } from '@/ui/components/people/person';
import { useAccount } from '@/ui/hooks';
import { AddRow } from '@/ui/kit/primitives/bits';
import { Card } from '@/ui/kit/primitives/card';
import { Text } from '@/ui/kit/primitives/text';
import { space, themed } from '@/ui/theme';

export function MemberList({
  members,
  loading,
  onSelect,
  onAdd,
}: {
  members: readonly Member[];
  loading?: boolean;
  onSelect?: (member: Member) => void;
  onAdd?: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const account = useAccount();
  const isSelf = (member: Member) => member.userId === account?.id;
  const order = (list: readonly Member[]) =>
    [...list].sort((a, b) => Number(isSelf(b)) - Number(isSelf(a)));
  const contributors = order(members.filter((member) => member.role !== 'viewer'));
  const viewers = order(members.filter((member) => member.role === 'viewer'));

  if (loading) return <MemberRowsSkeleton rows={4} />;

  const row = (member: Member) => {
    const face = (
      <Person
        name={member.name ?? ''}
        username={member.username ?? ''}
        size={44}
        uri={member.avatarUrl}
        accent={isSelf(member)}
        style={styles.member}
        right={
          <View style={styles.standing}>
            <Contribution contribution={member.contribution} />
          </View>
        }
      />
    );
    return onSelect ? (
      <Pressable key={member.userId} onPress={() => onSelect(member)} accessibilityRole="button">
        {face}
      </Pressable>
    ) : (
      <View key={member.userId}>{face}</View>
    );
  };

  return (
    <Card clip>
      {onAdd ? <AddRow label={t('members.add')} onPress={onAdd} /> : null}
      {members.length === 0 ? null : (
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
    </Card>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    member: {
      minHeight: 56,
      paddingHorizontal: space.s4,
    },
    standing: {
      width: 44,
      alignItems: 'center',
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
