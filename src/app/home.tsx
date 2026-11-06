import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingFinal } from '@/ui/components/onboarding/final';
import { ProjectCard } from '@/ui/components/project-card';
import { Button, IconButton } from '@/ui/kit/button';
import { MOCK_PROJECTS, type MockProject } from '@/ui/mocks/projects';
import { space, useTheme } from '@/ui/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const { celebrate } = useLocalSearchParams<{ celebrate?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const list = useRef<FlashListRef<MockProject>>(null);
  const anchored = useRef(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <>
      <View style={[styles.root, { backgroundColor: color.ink }]}>
        <FlashList
          ref={list}
          data={MOCK_PROJECTS}
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
          renderItem={({ item }) => (
            <ProjectCard
              project={item.project}
              cover={item.cover}
              people={item.people}
              onPress={() =>
                router.push({ pathname: '/project/[id]', params: { id: item.project.id } })
              }
            />
          )}
        />
        <IconButton
          icon={User}
          label="Профиль"
          tone="ghost"
          size={48}
          style={[styles.profile, { top: insets.top + space.s1 }]}
          onPress={() => router.push('/profile')}
        />
        <View
          pointerEvents="box-none"
          style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
        >
          <Button
            label="Новое воспоминание"
            variant="primary"
            onPress={() => router.push('/create')}
          />
        </View>
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
