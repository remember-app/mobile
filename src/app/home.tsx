import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadMoreProjects, loadProjects, projectCoverFrames } from '@/functionality';
import type { ProjectCard as ProjectCardModel } from '@/models';
import { NetworkBanner } from '@/ui/components/network-banner';
import { OnboardingFinal } from '@/ui/components/onboarding/final';
import { ProjectCard } from '@/ui/components/project-card';
import { ProjectCardSkeleton } from '@/ui/components/skeletons';
import { useProjects } from '@/ui/hooks';
import { ActionBar } from '@/ui/kit/action-bar';
import { Button, IconButton } from '@/ui/kit/button';
import { space, useTheme } from '@/ui/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { celebrate } = useLocalSearchParams<{ celebrate?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [covers, setCovers] = useState<Record<string, string[]>>({});
  const state = useProjects();
  const cards = state.cards;
  const loading = state.status === 'loading' && cards.length === 0;
  const list = useRef<FlashListRef<ProjectCardModel>>(null);
  const anchored = useRef(false);

  useEffect(() => {
    void loadProjects();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadProjects(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    list.current?.scrollToEnd({ animated: true });
  }, [cards.length]);

  useEffect(() => {
    let live = true;
    void Promise.all(
      cards.map(async (card) => [card.id, await projectCoverFrames(card.id)] as const),
    ).then((entries) => {
      if (live) setCovers(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, [cards]);

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
        ) : cards.length === 0 ? (
          <View style={styles.emptyFill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.create')}
              onPress={() => router.navigate('/create')}
              style={styles.newCard}
            >
              <Image
                source={require('../../assets/images/create-empty.png')}
                style={styles.newArt}
                contentFit="contain"
              />
            </Pressable>
          </View>
        ) : (
          <FlashList
            ref={list}
            data={cards}
            keyExtractor={(entry) => entry.id}
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
            onEndReached={() => void loadMoreProjects()}
            onEndReachedThreshold={0.6}
            renderItem={({ item }) => (
              <ProjectCard
                project={item}
                covers={covers[item.id]}
                onPress={() =>
                  router.navigate({ pathname: '/project/[id]', params: { id: item.id } })
                }
              />
            )}
          />
        )}
        <IconButton
          icon={User}
          label={t('home.profile')}
          tone="surface"
          size={48}
          style={[styles.profile, { top: insets.top + space.s1 }]}
          onPress={() => router.navigate('/profile')}
        />
        {cards.length > 0 ? (
          <ActionBar>
            <Button
              label={t('home.create')}
              variant="primary"
              onPress={() => router.navigate('/create')}
            />
          </ActionBar>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
  },
  newArt: {
    width: 360,
    height: 270,
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
