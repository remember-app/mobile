import { useRouter } from 'expo-router';
import { CheckCircle2, CircleDashed, Clock, Coins, HardDrive, LogOut } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { removeMember, setContribution, setRole } from '@/functionality';
import type { Member } from '@/models';
import type { ProjectId } from '@/types/id';
import { Person } from '@/ui/components/person';
import { confirmAction } from '@/ui/confirm';
import { number } from '@/ui/format';
import { useProjectCard, useSession } from '@/ui/hooks';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { IconButton } from '@/ui/kit/button';
import { CircularProgress } from '@/ui/kit/circular-progress';
import { Segment } from '@/ui/kit/segment';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

const ROLES = [
  { value: 'admin', label: 'members.roles.admin' },
  { value: 'contributor', label: 'members.roles.contributor' },
  { value: 'viewer', label: 'members.roles.viewer' },
] as const;

const CONTRIBUTIONS = [
  { value: 'not_started', icon: CircleDashed, label: 'members.notStarted' },
  { value: 'more_coming', icon: Clock, label: 'members.moreComing' },
  { value: 'done', icon: CheckCircle2, label: 'members.done' },
] as const;

const share = (part: number, whole: number): number =>
  whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;

export function MemberSheet({
  projectId,
  member,
  onClose,
}: {
  projectId: ProjectId;
  member: Member | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useSession();
  const project = useProjectCard(projectId);
  const account = 'account' in session ? session.account : undefined;
  const { color } = useTheme();
  const styles = useStyles();
  const self = member !== null && member.userId === account?.id;
  const [switchWidth, setSwitchWidth] = useState(0);
  const options = member
    ? CONTRIBUTIONS.filter(
        (option) => option.value !== 'more_coming' || member.consumables.storage.spend > 0,
      )
    : CONTRIBUTIONS;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === member?.contribution),
  );
  const thumbWidth =
    switchWidth > 0 ? (switchWidth - (options.length + 1) * space.s1) / options.length : 0;
  const slide = useSharedValue(index);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
  useEffect(() => {
    slide.value = withTiming(index * (thumbWidth + space.s1), { duration: 220 });
  }, [index, slide, thumbWidth]);

  return (
    <BottomSheet visible={member !== null} onClose={onClose}>
      {member ? (
        <View style={styles.body}>
          <View style={styles.profile}>
            <Person
              name={member.name ?? ''}
              username={member.username ?? ''}
              size={72}
              heading
              right={
                self ? (
                  <IconButton
                    icon={LogOut}
                    label={t('members.leave')}
                    tone="ghost"
                    size={44}
                    onPress={() =>
                      confirmAction({
                        confirm: t('members.leave'),
                        destructive: true,
                        onConfirm: () => {
                          if (!account) return;
                          onClose();
                          void removeMember(projectId, account.id).finally(() =>
                            router.replace('/home'),
                          );
                        },
                      })
                    }
                  />
                ) : undefined
              }
            />
          </View>

          {project?.myRole === 'admin' && !self ? (
            <Segment
              label={t('members.role')}
              options={ROLES.map(({ value, label }) => ({ value, label: t(label) }))}
              value={member.role}
              onChange={(role) => void setRole(projectId, member.userId, role)}
            />
          ) : null}

          {member.role === 'viewer' ? null : (
            <View style={styles.stats}>
              <StatTile
                value={share(
                  member.consumables.tokens.tokens,
                  project?.consumables.tokens.tokens ?? 0,
                )}
                amount={number(member.consumables.tokens.tokens)}
                label={t('members.shared')}
                icon={<Coins size={18} color={color.muted} />}
              />
              <StatTile
                value={share(
                  member.consumables.tokens.spend,
                  project?.consumables.tokens.tokens ?? 0,
                )}
                amount={number(member.consumables.tokens.spend)}
                label={t('members.spent')}
                icon={<Coins size={18} color={color.muted} />}
              />
              <StatTile
                value={share(
                  member.consumables.storage.bytes,
                  project?.consumables.storage.bytes ?? 0,
                )}
                amount={number(member.consumables.storage.bytes / 1024 ** 3)}
                label={t('members.shared')}
                icon={<HardDrive size={18} color={color.muted} />}
              />
              <StatTile
                value={share(
                  member.consumables.storage.spend,
                  project?.consumables.storage.bytes ?? 0,
                )}
                amount={number(member.consumables.storage.spend / 1024 ** 3)}
                label={t('members.spent')}
                icon={<HardDrive size={18} color={color.muted} />}
              />
            </View>
          )}

          {self && member.role !== 'viewer' ? (
            <View
              style={styles.switch}
              onLayout={(event) => setSwitchWidth(event.nativeEvent.layout.width)}
            >
              <Animated.View
                pointerEvents="none"
                style={[styles.thumb, { width: thumbWidth }, thumbStyle]}
              />
              {options.map(({ value, icon: Icon, label }) => {
                const on = member.contribution === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={t(label)}
                    aria-checked={on}
                    onPress={() => void setContribution(projectId, value)}
                    style={styles.switchOption}
                  >
                    <Icon size={22} color={on ? color.ink : color.muted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function StatTile({
  value,
  amount,
  label,
  icon,
}: {
  value: number;
  amount: string;
  label: string;
  icon: ReactNode;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  return (
    <View style={styles.tile}>
      <View style={styles.circle}>
        <CircularProgress value={value} size={44} stroke={4} track={color.line} />
        <View style={styles.icon} pointerEvents="none">
          {icon}
        </View>
      </View>
      <View style={styles.tileWords}>
        <Text role="row">{amount}</Text>
        <Text role="noteSm" tone="muted">
          {label}
        </Text>
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      gap: space.s4,
    },
    profile: {
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.card,
      backgroundColor: color.raise,
      padding: space.s4,
    },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: space.s2,
    },
    switch: {
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      padding: space.s1,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.raise,
    },
    thumb: {
      position: 'absolute',
      top: space.s1,
      bottom: space.s1,
      left: space.s1,
      borderRadius: radius.pill,
      backgroundColor: color.paper,
    },
    switchOption: {
      flex: 1,
      height: 40,
      zIndex: 1,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circle: {
      position: 'relative',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tile: {
      flexGrow: 1,
      flexBasis: '48%',
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      borderRadius: radius.field,
      backgroundColor: color.raise,
      paddingHorizontal: space.s3,
      paddingVertical: space.s2,
    },
    tileWords: {
      flex: 1,
      gap: 2,
    },
  }),
);
