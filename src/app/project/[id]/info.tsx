import { useLocalSearchParams, useRouter } from 'expo-router';
import { Coins, HardDrive, Settings2, Users } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { loadMembers, loadProjects, shareProjectConsumables } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { InviteBlocks } from '@/ui/components/invite-blocks';
import { LabelsManager } from '@/ui/components/labels-manager';
import { MemberList } from '@/ui/components/member-list';
import { MemberSheet } from '@/ui/components/member-sheet';
import { confirmAction } from '@/ui/confirm';
import { number } from '@/ui/format';
import { useMembers, useProjectCard, useSession } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button, IconButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { CircularProgress } from '@/ui/kit/circular-progress';
import { Empty } from '@/ui/kit/empty';
import { Slider } from '@/ui/kit/slider';
import { Text } from '@/ui/kit/text';
import { space, themed, useTheme } from '@/ui/theme';

type Metric = 'people' | 'gb' | 'tokens';

const TITLES = {
  people: 'info.invite',
  gb: 'info.storage',
  tokens: 'info.tokens',
} as const;

const GIB = 1024 ** 3;

export default function ProjectInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { color } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = id as ProjectId;
  const project = useProjectCard(projectId);
  const membersState = useMembers(projectId);
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [metric, setMetric] = useState<Metric | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gbAmount, setGbAmount] = useState(1);
  const [tokenAmount, setTokenAmount] = useState(10);

  useEffect(() => {
    void loadProjects();
    void loadMembers(projectId);
  }, [projectId]);

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            boxed
            title={t('project.title')}
            left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
          />
        }
      >
        <Empty sign="dashed" title={t('project.notFound')} />
      </Board>
    );
  }

  const members = membersState.members;
  const selected = selectedId
    ? (members.find((member) => member.userId === selectedId) ?? null)
    : null;
  const storage = project.consumables.storage;
  const tokens = project.consumables.tokens;
  const ownStorage = account
    ? Math.max(0, (account.consumables.storage.bytes - account.consumables.storage.spend) / GIB)
    : 0;
  const ownTokens = account
    ? Math.max(0, account.consumables.tokens.tokens - account.consumables.tokens.spend)
    : 0;
  const gbMax = Math.max(1, Math.floor(ownStorage));
  const gbValue = Math.min(gbAmount, gbMax);
  const tokenMax = Math.max(1, Math.floor(ownTokens));
  const tokenValue = Math.min(tokenAmount, tokenMax);
  const used = storage.spend / GIB;
  const capacity = storage.bytes / GIB;
  const leftTokens = Math.max(0, tokens.tokens - tokens.spend);

  const shareStorage = () => {
    confirmAction({
      confirm: t('info.share'),
      onConfirm: () => {
        void shareProjectConsumables(projectId, { storageBytes: gbValue * GIB }).then(() =>
          setGbAmount(1),
        );
      },
    });
  };

  const shareTokens = () => {
    confirmAction({
      confirm: t('info.share'),
      onConfirm: () => {
        void shareProjectConsumables(projectId, { tokens: tokenValue }).then(() =>
          setTokenAmount(10),
        );
      },
    });
  };

  return (
    <Board
      body={pageBody}
      bar={
        <AppBar
          boxed
          title={project.title}
          left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
          right={
            <IconButton
              icon={Settings2}
              label={t('project.settings')}
              tone="surface"
              size={44}
              onPress={() =>
                router.navigate({ pathname: '/project/[id]/settings', params: { id: projectId } })
              }
            />
          }
        />
      }
    >
      <Card style={styles.stats}>
        <Stat
          icon={<Users size={26} color={color.paper} />}
          value={project.memberCount > 0 ? project.sharedCount / project.memberCount : 0}
          label={`${project.sharedCount} / ${project.memberCount}`}
          onPress={() => setMetric('people')}
        />
        <Stat
          icon={<HardDrive size={26} color={color.paper} />}
          value={capacity > 0 ? used / capacity : 0}
          label={`${number(used)} / ${number(capacity)}`}
          onPress={() => setMetric('gb')}
        />
        <Stat
          icon={<Coins size={26} color={color.paper} />}
          value={tokens.tokens > 0 ? leftTokens / tokens.tokens : 0}
          label={`${number(leftTokens)} / ${number(tokens.tokens)}`}
          onPress={() => setMetric('tokens')}
        />
      </Card>

      <MemberList
        members={members}
        loading={membersState.status === 'loading'}
        onSelect={(member) => setSelectedId(member.userId)}
        onAdd={() => setMetric('people')}
      />

      <LabelsManager projectId={projectId} />

      <MemberSheet projectId={projectId} member={selected} onClose={() => setSelectedId(null)} />

      <BottomSheet
        visible={metric !== null}
        onClose={() => setMetric(null)}
        title={metric ? t(TITLES[metric]) : undefined}
      >
        {metric === 'people' ? (
          <InviteBlocks projectId={projectId} projectTitle={project.title} />
        ) : null}
        {metric === 'gb' ? (
          <>
            <Slider
              value={gbValue}
              onChange={setGbAmount}
              min={1}
              max={gbMax}
              valueLabel={`${number(gbValue)} ${t('unit.gb')}`}
              minLabel={`1 ${t('unit.gb')}`}
              maxLabel={`${number(gbMax)} ${t('unit.gb')}`}
              label={t('info.shareStorage')}
            />
            <Button
              label={t('info.share')}
              variant="secondary"
              disabled={ownStorage < 1}
              onPress={shareStorage}
            />
          </>
        ) : null}
        {metric === 'tokens' ? (
          <>
            <Slider
              value={tokenValue}
              onChange={setTokenAmount}
              min={1}
              max={tokenMax}
              valueLabel={`${number(tokenValue)}`}
              minLabel="1"
              maxLabel={`${number(tokenMax)}`}
              label={t('info.shareTokens')}
            />
            <Button
              label={t('info.share')}
              variant="secondary"
              disabled={ownTokens < 1}
              onPress={shareTokens}
            />
          </>
        ) : null}
      </BottomSheet>
    </Board>
  );
}

function Stat({
  icon,
  value,
  label,
  onPress,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.stat}>
      <View style={styles.circle}>
        <CircularProgress value={value} size={68} stroke={6} />
        <View style={styles.icon} pointerEvents="none">
          {icon}
        </View>
      </View>
      <Text role="meta" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    stats: {
      flexDirection: 'row',
      padding: space.s4,
      gap: space.s3,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: space.s2,
    },
    circle: {
      width: 68,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
