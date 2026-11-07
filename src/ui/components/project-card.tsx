import { Image, type ImageSource } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ProjectCard as Project } from '@/models/project';
import { dateRange } from '@/ui/format';
import { AvatarStack } from '@/ui/kit/avatar';
import { Text } from '@/ui/kit/text';
import { radius, space, themed } from '@/ui/theme';

type Props = {
  project: Project;
  cover: ImageSource | null;
  covers?: readonly ImageSource[];
  people: readonly string[];
  onPress: () => void;
};

export function ProjectCard({ project, cover, covers = [], people, onPress }: Props) {
  const styles = useStyles();
  const press = useSharedValue(1);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const frames = covers.length > 0 ? covers : cover ? [cover] : [];
  const total = frames.length;
  const [sources, setSources] = useState<[ImageSource | null, ImageSource | null]>(() => [
    frames[0] ?? null,
    frames[1] ?? frames[0] ?? null,
  ]);
  const [active, setActive] = useState<0 | 1>(0);
  const cursor = useRef(0);
  const opacity0 = useSharedValue(1);
  const opacity1 = useSharedValue(0);

  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(
      () => {
        const next =
          total > 1 ? (cursor.current + 1 + Math.floor(Math.random() * (total - 1))) % total : 0;
        const target = active === 0 ? 1 : 0;
        const shown = frames[next] ?? null;
        setSources(([first, second]) => (target === 0 ? [shown, second] : [first, shown]));
        const into = target === 0 ? opacity0 : opacity1;
        const out = active === 0 ? opacity0 : opacity1;
        into.value = 0;
        into.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) });
        out.value = withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) });
        setActive(target);
        cursor.current = next;
      },
      5 * 60 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [active, frames, opacity0, opacity1, total]);

  const style0 = useAnimatedStyle(() => ({ opacity: opacity0.value }));
  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));

  return (
    <Animated.View style={scale}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={project.title}
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(0.985, { duration: 110 });
        }}
        onPressOut={() => {
          press.value = withTiming(1, { duration: 170 });
        }}
        style={styles.card}
      >
        <Animated.View style={[StyleSheet.absoluteFill, style0]} pointerEvents="none">
          {sources[0] ? (
            <Image
              source={sources[0]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, style1]} pointerEvents="none">
          {sources[1] ? (
            <Image
              source={sources[1]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
        </Animated.View>
        <View pointerEvents="none" style={[styles.shade, styles.shadeTop]} />
        <View pointerEvents="none" style={[styles.shade, styles.shadeBottom]} />
        <Text role="title" tone="onFill" numberOfLines={2} style={styles.title}>
          {project.title}
        </Text>
        <View style={styles.foot}>
          <AvatarStack names={people} size={36} limit={7} />
          <Text role="meta" tone="onFill">
            {dateRange(project.eventStart, project.eventEnd)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      aspectRatio: 4 / 3,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    shade: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: '52%',
    },
    shadeTop: {
      top: 0,
      experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.62), rgba(0,0,0,0))',
    },
    shadeBottom: {
      bottom: 0,
      experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))',
    },
    title: {
      position: 'absolute',
      top: space.s4,
      left: space.s4,
      right: space.s4,
    },
    foot: {
      position: 'absolute',
      left: space.s4,
      right: space.s4,
      bottom: space.s4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
    },
  }),
);
