import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ProjectCard as Project } from '@/models/project';
import { dateRange } from '@/ui/format';
import { AvatarStack } from '@/ui/kit/primitives/avatar';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

type Props = {
  project: Project;
  covers?: readonly string[];
  onPress: () => void;
};

export function ProjectCard({ project, covers, onPress }: Props) {
  const styles = useStyles();
  const { color } = useTheme();
  const press = useSharedValue(1);
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const frames = covers ?? [];
  const total = frames.length;
  const source = frames[0] ?? null;
  const empty = !source;

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
        style={[styles.card, empty ? styles.cardEmpty : null]}
      >
        {source ? (
          <Image
            source={source}
            group={project.id}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            pointerEvents="none"
          />
        ) : null}
        {total > 0 ? (
          <>
            <View pointerEvents="none" style={[styles.shade, styles.shadeTop]} />
            <View pointerEvents="none" style={[styles.shade, styles.shadeBottom]} />
          </>
        ) : (
          <Image
            source={require('../../../../assets/logo/logo-heart-2-outline.png')}
            style={styles.emptyMark}
            contentFit="contain"
            cachePolicy="memory"
            pointerEvents="none"
          />
        )}
        <Text
          role="title"
          tone={total > 0 ? 'onFill' : 'paper'}
          numberOfLines={2}
          style={styles.title}
        >
          {project.title}
        </Text>
        <View style={styles.foot}>
          <AvatarStack
            faces={project.members.map((member) => ({
              name: member.name,
              username: member.username,
              uri: member.avatarUrl,
            }))}
            total={project.memberCount}
            on={total > 0 ? 'rgba(0,0,0,0.45)' : color.ink}
          />
          <Text role="meta" tone={total > 0 ? 'onFill' : 'paper'}>
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
    cardEmpty: {
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    emptyMark: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 128,
      height: 128,
      transform: [{ translateX: -64 }, { translateY: -64 }],
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
