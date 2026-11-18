import { useRouter } from 'expo-router';
import { Clapperboard, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { movieOfMontage } from '@/models';
import type { ProjectId } from '@/types/id';
import { useMontages, useMovies } from '@/ui/hooks';
import { HeaderTitle } from '@/ui/kit/chrome/header-title';
import { BackButton, IconButton } from '@/ui/kit/controls/button';
import { radius, space, useTheme } from '@/ui/theme';

import { MontageCard, openMontage } from '../montage/montage-card';

export function ProjectHeader({
  projectId,
  title,
  card,
  progress,
  onBack,
  onMembers,
}: {
  projectId: ProjectId;
  title: string;
  card: number;
  progress: SharedValue<number>;
  onBack: () => void;
  onMembers: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { color } = useTheme();
  const montages = useMontages(projectId);
  const movies = useMovies(projectId);
  const shown = montages.items.slice(0, 3);
  const hasShown = shown.length > 0;
  const [full, setFull] = useState(0);
  const [head, setHead] = useState(0);
  const side = space.s4 + 44 + space.s3;
  const widest = Math.max(0, full - side * 2);
  const collapsed = Math.min(head > 0 ? head : widest, widest);

  const capsule = useAnimatedStyle(() => {
    const p = progress.value;
    if (!hasShown) {
      return {
        width: collapsed,
        height: 44,
        borderRadius: radius.pill,
      };
    }
    return {
      width: full - (full - collapsed) * p,
      height: 44 + (1 - p) * (space.s2 * 2 + card) + 2,
      borderRadius: radius.card + (radius.pill - radius.card) * p,
    };
  });
  const strip = useAnimatedStyle(() => {
    const p = Math.min(1, progress.value * 1.7);
    return {
      height: (1 - progress.value) * card,
      opacity: 1 - p,
      marginTop: (1 - progress.value) * space.s2,
      marginBottom: (1 - progress.value) * space.s2,
      transform: [{ scale: 1 - progress.value * 0.5 }],
    };
  });
  const ringLook = useAnimatedStyle(() => {
    if (!hasShown) return { opacity: 1, transform: [{ scale: 1 }] };
    return { opacity: progress.value, transform: [{ scale: progress.value }] };
  });

  return (
    <View style={styles.bar} onLayout={(event) => setFull(event.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.capsule,
          capsule,
          { backgroundColor: color.surface, borderColor: color.line },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('montage.title')}
          onPress={() =>
            router.navigate({ pathname: '/project/[id]/movies', params: { id: projectId } })
          }
        >
          <HeaderTitle
            title={title}
            icon={<Clapperboard size={18} color={color.paper} />}
            maxWidth={widest || undefined}
          />
        </Pressable>
        {shown.length > 0 ? (
          <Animated.View style={[styles.strip, strip]}>
            <View style={styles.row}>
              {shown.map((montage) => {
                const movie = movieOfMontage(movies.items, montage.id);
                return (
                  <View key={montage.id} style={{ width: card }}>
                    <MontageCard
                      montage={montage}
                      movie={movie}
                      onPress={() => openMontage(router, projectId, montage, movie)}
                    />
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
      <View pointerEvents="box-none" style={styles.buttons}>
        <View style={styles.side}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { backgroundColor: color.surface, borderColor: color.line },
              ringLook,
            ]}
          />
          <BackButton label={t('action.back')} size={44} tone="ghost" onPress={onBack} />
        </View>
        <View style={styles.side}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { backgroundColor: color.surface, borderColor: color.line },
              ringLook,
            ]}
          />
          <IconButton
            icon={Users}
            label={t('project.members')}
            tone="ghost"
            size={44}
            onPress={onMembers}
          />
        </View>
      </View>
      <View
        pointerEvents="none"
        style={styles.measure}
        onLayout={(event) => setHead(event.nativeEvent.layout.width)}
      >
        <HeaderTitle
          title={title}
          icon={<Clapperboard size={18} color={color.paper} />}
          maxWidth={widest || undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  capsule: {
    alignSelf: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  strip: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: space.s2,
    paddingHorizontal: space.s2,
  },
  buttons: {
    position: 'absolute',
    top: 0,
    left: space.s4,
    right: space.s4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 22,
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
});
