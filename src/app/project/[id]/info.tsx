import { useLocalSearchParams, useRouter } from 'expo-router';
import { Coins, HardDrive, Users } from 'lucide-react-native';
import { type ReactNode, useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InviteBlocks } from '@/ui/components/invite-blocks';
import { MemberList } from '@/ui/components/member-list';
import { MemberSheet } from '@/ui/components/member-sheet';
import { AppBar, Board } from '@/ui/kit/bars';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { BackButton, Button } from '@/ui/kit/button';
import { CircularProgress } from '@/ui/kit/circular-progress';
import { Empty } from '@/ui/kit/empty';
import { Slider } from '@/ui/kit/slider';
import { Text } from '@/ui/kit/text';
import { type MockMember, membersOf, subscribeMembers } from '@/ui/mocks/members';
import { donateStorage, donateTokens, profileState, subscribeProfile } from '@/ui/mocks/profile';
import { MOCK_PROJECTS } from '@/ui/mocks/projects';
import {
  receiveStorage,
  receiveTokens,
  resourcesOf,
  subscribeResources,
} from '@/ui/mocks/resources';
import { radius, space, themed, useTheme } from '@/ui/theme';

type Metric = 'people' | 'gb' | 'tokens';

const TITLES: Record<Metric, string> = {
  people: 'Пригласить',
  gb: 'Место',
  tokens: 'Токены',
};

const number = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

export default function ProjectInfoScreen() {
  const router = useRouter();
  const { color } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = MOCK_PROJECTS.find((entry) => entry.project.id === id);
  const getMembers = useCallback(() => membersOf(id), [id]);
  const getResources = useCallback(() => resourcesOf(id), [id]);
  const members = useSyncExternalStore(subscribeMembers, getMembers);
  const resources = useSyncExternalStore(subscribeResources, getResources);
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [selected, setSelected] = useState<MockMember | null>(null);
  const [gbAmount, setGbAmount] = useState(1);
  const [tokenAmount, setTokenAmount] = useState(10);

  if (!project) {
    return (
      <Board
        bar={
          <AppBar
            title="Воспоминание"
            left={<BackButton label="Назад" onPress={() => router.back()} />}
          />
        }
      >
        <Empty sign="dashed" title="Воспоминание не найдено" />
      </Board>
    );
  }

  const shared = members.filter((member) => member.files > 0).length;
  const total = members.length;
  const used = members.reduce((sum, member) => sum + member.gigabytes, 0);
  const ownStorage = profile.storageTotalGb - profile.storageUsedGb;
  const gbMax = Math.max(1, Math.floor(ownStorage));
  const gbValue = Math.min(gbAmount, gbMax);
  const tokenMax = Math.max(10, Math.floor(profile.tokens));
  const tokenValue = Math.min(tokenAmount, tokenMax);

  const shareStorage = () => {
    if (ownStorage < gbValue) return;
    if (donateStorage(gbValue)) {
      receiveStorage(id, gbValue);
      setGbAmount(1);
    }
  };

  const shareTokens = () => {
    if (profile.tokens < tokenValue) return;
    if (donateTokens(tokenValue)) {
      receiveTokens(id, tokenValue);
      setTokenAmount(10);
    }
  };

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar
          title={project.project.title}
          left={<BackButton label="Назад" onPress={() => router.back()} />}
        />
      }
    >
      <View style={[styles.card, styles.stats]}>
        <Stat
          icon={<Users size={26} color={color.paper} />}
          value={total > 0 ? shared / total : 0}
          label={`${shared} / ${total}`}
          onPress={() => setMetric('people')}
        />
        <Stat
          icon={<HardDrive size={26} color={color.paper} />}
          value={resources.storageGb > 0 ? used / resources.storageGb : 0}
          label={`${number(used)} / ${number(resources.storageGb)}`}
          onPress={() => setMetric('gb')}
        />
        <Stat
          icon={<Coins size={26} color={color.paper} />}
          value={resources.tokensTotal > 0 ? resources.tokensLeft / resources.tokensTotal : 0}
          label={`${resources.tokensLeft} / ${resources.tokensTotal}`}
          onPress={() => setMetric('tokens')}
        />
      </View>

      <MemberList members={members} onSelect={setSelected} />

      <MemberSheet member={selected} onClose={() => setSelected(null)} />

      <BottomSheet
        visible={metric !== null}
        onClose={() => setMetric(null)}
        title={metric ? TITLES[metric] : undefined}
      >
        {metric === 'people' ? (
          <InviteBlocks projectId={id} projectTitle={project.project.title} />
        ) : null}
        {metric === 'gb' ? (
          <>
            <Slider
              value={gbValue}
              onChange={setGbAmount}
              min={1}
              max={gbMax}
              valueLabel={`${gbValue} ГБ`}
              minLabel="1 ГБ"
              maxLabel={`${gbMax} ГБ`}
              label="Поделиться местом"
            />
            <Button
              label="Поделиться"
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
              min={10}
              max={tokenMax}
              valueLabel={`${tokenValue}`}
              minLabel="10"
              maxLabel={`${tokenMax}`}
              label="Поделиться токенами"
            />
            <Button
              label="Поделиться"
              variant="secondary"
              disabled={profile.tokens < 10}
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

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: space.s5,
      paddingTop: space.s5,
      paddingBottom: space.s7,
      gap: space.s4,
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
    },
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
