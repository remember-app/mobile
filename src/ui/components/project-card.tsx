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

function frames(count: number): string {
  const whole = Math.abs(count) % 100;
  const last = whole % 10;
  if (whole > 10 && whole < 20) return `${count} кадров`;
  if (last === 1) return `${count} кадр`;
  if (last >= 2 && last <= 4) return `${count} кадра`;
  return `${count} кадров`;
}

function day(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(value);
}

function dates(start: Date, end: Date | null): string {
  if (!end || day(start) === day(end)) return day(start);
  return `${day(start)} — ${day(end)}`;
}

export function ProjectCard({ project, cover, people, onPress }: Props) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.cover}>
        {cover ? (
          <Image
            source={cover}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.raise }]} />
        )}
      </View>
      <View style={styles.body}>
        <Text role="title" numberOfLines={2}>
          {project.title}
        </Text>
        <Text role="noteSm" tone="muted">
          {`${dates(project.eventStart, project.eventEnd)} · ${frames(project.itemCount)}`}
        </Text>
        <View style={styles.foot}>
          <AvatarStack names={people} size={26} on={color.surface} />
          {project.memberCount > 1 ? (
            <Text role="metaSm" tone="faint">
              {`${project.sharedCount} из ${project.memberCount} поделились`}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    cover: {
      aspectRatio: 4 / 3,
      backgroundColor: color.raise,
    },
    body: {
      padding: space.s4,
      gap: space.s1,
    },
    foot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s3,
      paddingTop: space.s2,
    },
  }),
);
