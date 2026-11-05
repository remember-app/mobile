import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProjectCard as Project } from '@/models/project';
import { AvatarStack } from '@/ui/kit/avatar';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

type Props = {
  project: Project;
  cover: ImageSource | null;
  people: readonly string[];
  onPress: () => void;
};

function day(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(value);
}

function dates(start: Date, end: Date | null): string {
  if (!end || day(start) === day(end)) return day(start);
  return `${day(start)} — ${day(end)}`;
}

export function ProjectCard({ project, cover, people, onPress }: Props) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={project.title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      {cover ? (
        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color.raise }]} />
      )}
      <View pointerEvents="none" style={[styles.shade, styles.shadeTop]} />
      <View pointerEvents="none" style={[styles.shade, styles.shadeBottom]} />
      <Text role="title" tone="onFill" numberOfLines={2} style={styles.title}>
        {project.title}
      </Text>
      <View style={styles.foot}>
        <AvatarStack names={people} size={36} />
        <Text role="meta" tone="onFill">
          {dates(project.eventStart, project.eventEnd)}
        </Text>
      </View>
    </Pressable>
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
    pressed: {
      transform: [{ scale: 0.985 }],
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
