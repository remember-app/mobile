import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Photo, PhotoGrid } from '@/ui/kit/photo-grid';
import { PhotoViewer } from '@/ui/kit/photo-viewer';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

const sources = [
  require('../../assets/images/onboarding/f01.jpg'),
  require('../../assets/images/onboarding/f02.jpg'),
  require('../../assets/images/onboarding/f03.jpg'),
  require('../../assets/images/onboarding/f04.jpg'),
  require('../../assets/images/onboarding/f05.jpg'),
  require('../../assets/images/onboarding/f06.jpg'),
  require('../../assets/images/onboarding/f07.jpg'),
  require('../../assets/images/onboarding/f08.jpg'),
  require('../../assets/images/onboarding/f09.jpg'),
  require('../../assets/images/onboarding/f10.jpg'),
  require('../../assets/images/onboarding/f11.jpg'),
];

export default function LabScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [columns, setColumns] = useState(3);
  const [loaded, setLoaded] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const photos = useMemo<Photo[]>(
    () =>
      Array.from({ length: 64 }, (_, index) => ({
        id: `mock-${index}`,
        source: loaded ? sources[index % sources.length] : null,
      })),
    [loaded],
  );

  const reload = () => {
    if (timer.current) clearTimeout(timer.current);
    setLoaded(false);
    timer.current = setTimeout(() => setLoaded(true), 1500);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.color.ink }]}>
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.head}>
          <Text role="displaySm">Лаборатория</Text>
          <Text role="noteSm" tone="muted">
            Листай сетку, открой кадр, щипай и тяни вниз
          </Text>
        </View>
        <View style={styles.toolbar}>
          <View style={styles.pills}>
            {[1, 3, 5, 7].map((value) => (
              <Pressable
                key={value}
                onPress={() => setColumns(value)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: columns === value ? theme.color.accent : theme.color.raise,
                  },
                ]}
              >
                <Text
                  role="chipXs"
                  tone={columns === value ? 'onFill' : 'muted'}
                >{`${value}`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.links}>
            <Pressable onPress={reload} style={styles.link}>
              <Text role="controlSm" tone="accent">
                Данные 1,5 с
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.link}>
              <Text role="controlSm" tone="muted">
                Назад
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.root}>
          <PhotoGrid photos={photos} columns={columns} onColumns={setColumns} onOpen={setOpen} />
        </View>
      </SafeAreaView>
      {open === null ? null : (
        <PhotoViewer photos={photos} initialIndex={open} onClose={() => setOpen(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
    paddingBottom: space.s1,
    gap: space.s1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s4,
    paddingBottom: space.s2,
    gap: space.s2,
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
  },
  pill: {
    width: 30,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  link: {
    paddingVertical: space.s1,
  },
});
