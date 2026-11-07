import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Member } from '@/models';
import { CollapsibleList } from '@/ui/components/collapsible-list';
import { Contribution } from '@/ui/components/contribution';
import { Person } from '@/ui/components/person';
import { MemberRowsSkeleton } from '@/ui/components/skeletons';
import { useSession } from '@/ui/hooks';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
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
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
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
    </Card>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    empty: {
      paddingVertical: space.s5,
      textAlign: 'center',
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
      paddingHorizontal: space.s4,
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
