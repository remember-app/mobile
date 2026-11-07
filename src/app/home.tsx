import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NetworkBanner } from '@/ui/components/network-banner';
import { OnboardingFinal } from '@/ui/components/onboarding/final';
import { ProjectCard } from '@/ui/components/project-card';
import { ProjectCardSkeleton } from '@/ui/components/skeletons';
import { Button, IconButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { photosForLabel, subscribeLabels } from '@/ui/mocks/labels';
import { loadingState, subscribeLoading } from '@/ui/mocks/loading';
import { profileState, subscribeProfile } from '@/ui/mocks/profile';
import { type MockProject, projectsState, subscribeProjects } from '@/ui/mocks/projects';
import { radius, space, useTheme } from '@/ui/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { celebrate } = useLocalSearchParams<{ celebrate?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const projects = useSyncExternalStore(subscribeProjects, projectsState);
  const profile = useSyncExternalStore(subscribeProfile, profileState);
  const loading = useSyncExternalStore(subscribeLoading, loadingState);
  const coverPhotos = useCallback(() => photosForLabel('cover'), []);
  const coverFrames = useSyncExternalStore(subscribeLabels, coverPhotos);
  const covers = useMemo(
    () =>
      coverFrames.flatMap((photo) =>
        photo.source && typeof photo.source !== 'string' ? [photo.source] : [],
      ),
    [coverFrames],
  );
  const list = useRef<FlashListRef<MockProject>>(null);
  const anchored = useRef(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  useEffect(() => {
    list.current?.scrollToEnd({ animated: true });
  }, [projects.length]);

  return (
    <>
      <View style={[styles.root, { backgroundColor: color.ink }]}>
        {loading ? (
          <View
            style={[styles.loading, { paddingTop: insets.top, paddingBottom: insets.bottom + 92 }]}
          >
            {[0, 1, 2].map((key) => (
              <ProjectCardSkeleton key={key} />
            ))}
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyFill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.create')}
              onPress={() => router.navigate('/create')}
              style={[
                styles.newCard,
                {
                  backgroundColor: color.surface,
                  borderColor: color.line,
                  borderStyle: covers[0] ? 'solid' : 'dashed',
                },
              ]}
            >
              {covers[0] ? (
                <>
                  <Image source={covers[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={[StyleSheet.absoluteFill, styles.newShade]} />
                </>
              ) : null}
              <Plus size={28} color={covers[0] ? color.onFill : color.muted} />
              <Text role="title" tone={covers[0] ? 'onFill' : 'paper'}>
                {t('home.create')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlashList
            ref={list}
            data={projects}
            keyExtractor={(entry) => entry.project.id}
            onContentSizeChange={(_width, height) => {
              if (anchored.current || height <= 0) return;
              anchored.current = true;
              list.current?.scrollToEnd({ animated: false });
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.muted} />
            }
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 92,
              paddingHorizontal: space.s4,
            }}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            renderItem={({ item }) => {
              const first = profile.name.split(' ')[0] ?? profile.name;
              const people = item.people.some((name) => name === profile.name || name === first)
                ? item.people
                : [profile.name, ...item.people];
              return (
                <ProjectCard
                  project={item.project}
                  cover={item.cover}
                  covers={covers}
                  people={people}
                  onPress={() =>
                    router.navigate({ pathname: '/project/[id]', params: { id: item.project.id } })
                  }
                />
              );
            }}
          />
        )}
        <IconButton
          icon={User}
          label={t('home.profile')}
          tone="ghost"
          size={48}
          tint={color.paper}
          style={[styles.profile, { top: insets.top + space.s1 }]}
          onPress={() => router.navigate('/profile')}
        />
        {projects.length > 0 ? (
          <View
            pointerEvents="box-none"
            style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
          >
            <Button
              label={t('home.create')}
              variant="primary"
              onPress={() => router.navigate('/create')}
            />
          </View>
        ) : null}
        <NetworkBanner />
      </View>
      {celebrate ? (
        <OnboardingFinal
          name={celebrate}
          onDone={() => router.setParams({ celebrate: undefined })}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  emptyFill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.s4,
  },
  loading: {
    flex: 1,
    paddingHorizontal: space.s4,
    gap: space.s3,
  },
  newCard: {
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
  },
  newShade: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  profile: {
    position: 'absolute',
    right: space.s4,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
  },
  gap: {
    height: space.s3,
  },
});
