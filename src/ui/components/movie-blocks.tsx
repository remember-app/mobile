import { Image } from 'expo-image';
import { AudioLines, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Item } from '@/models';
import { duration } from '@/ui/format';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Card } from '@/ui/kit/card';
import type { IconComponent } from '@/ui/kit/icon';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

export type Chip = { icon?: IconComponent; text: string };

function seedIndex(seed: string, length: number): number {
  if (length === 0) return 0;
  let hash = 0;
  for (let at = 0; at < seed.length; at += 1) {
    hash = (hash * 31 + seed.charCodeAt(at)) >>> 0;
  }
  return hash % length;
}

export function MontageBackdrop({
  frames,
  seed,
  cycling,
}: {
  frames: string[];
  seed: string;
  cycling: boolean;
}) {
  const [index, setIndex] = useState(() => seedIndex(seed, frames.length));

  useEffect(() => {
    setIndex(seedIndex(seed, frames.length));
  }, [frames.length, seed]);

  useEffect(() => {
    if (!cycling || frames.length < 2) return;
    const timer = setInterval(() => {
      setIndex((was) => (was + 1) % frames.length);
    }, 20_000);
    return () => clearInterval(timer);
  }, [cycling, frames.length]);

  const source = frames[index % Math.max(frames.length, 1)] ?? null;
  if (!source) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0.18))',
        }}
      />
    </View>
  );
}

export type MusicEntry = { id: string; name?: string; author?: string };

export function VideoDetailsCard({
  title,
  durationSeconds,
  meta = [],
  chips = [],
  children,
}: {
  title?: string;
  durationSeconds?: number | null;
  meta?: string[];
  chips?: Chip[];
  children?: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      {title ? (
        <Text role="title" numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {durationSeconds != null || meta.length > 0 ? (
        <View style={styles.top}>
          {durationSeconds != null ? (
            <Text role="title">{duration(durationSeconds)}</Text>
          ) : (
            <View />
          )}
          {meta.length > 0 ? (
            <View style={styles.meta}>
              {meta.map((line) => (
                <Text key={line} role="meta" tone="muted">
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip, at) => (
            <ChipView key={at} chip={chip} />
          ))}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

export function MontageConfigCard({
  prompt,
  items,
  music,
  director,
  onFrames,
  children,
}: {
  prompt: string | null;
  items: Item[];
  music: MusicEntry[];
  director?: boolean;
  onFrames?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card style={styles.card}>
        {prompt ? (
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
            <Text role="body" numberOfLines={3}>
              {prompt}
            </Text>
          </Pressable>
        ) : null}

        {items.length > 0 ? (
          onFrames ? (
            <Pressable accessibilityRole="button" onPress={onFrames} style={styles.files}>
              <View style={styles.thumbs}>
                {items.slice(0, 4).map((item) => {
                  const source = item.links.thumbnail ?? item.links.preview ?? item.links.original;
                  return source ? (
                    <Image
                      key={item.id}
                      source={source}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : null;
                })}
                {items.length > 4 ? (
                  <View style={[styles.thumb, styles.more, { backgroundColor: color.raise }]}>
                    <Text role="meta" tone="muted">
                      +{items.length - 4}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ChevronRight size={18} color={color.muted} />
            </Pressable>
          ) : (
            <View style={styles.files}>
              <View style={styles.thumbs}>
                {items.slice(0, 4).map((item) => {
                  const source = item.links.thumbnail ?? item.links.preview ?? item.links.original;
                  return source ? (
                    <Image
                      key={item.id}
                      source={source}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : null;
                })}
                {items.length > 4 ? (
                  <View style={[styles.thumb, styles.more, { backgroundColor: color.raise }]}>
                    <Text role="meta" tone="muted">
                      +{items.length - 4}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )
        ) : null}

        <View style={styles.music}>
          <AudioLines size={18} color={color.muted} />
          <View style={styles.musicWords}>
            {director ? (
              <Text role="meta" tone="muted">
                {t('montage.order.directorChoice')}
              </Text>
            ) : music.length === 0 ? (
              <Text role="meta" tone="muted">
                {t('montage.movie.noMusic')}
              </Text>
            ) : (
              music.map((track) => (
                <Text key={track.id} role="meta" tone="muted">
                  {track.name ?? track.id}
                  {track.author ? ` · ${track.author}` : ''}
                </Text>
              ))
            )}
          </View>
        </View>
        {children}
      </Card>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('montage.movie.prompt')}>
        <Text role="body">{prompt ?? ''}</Text>
      </BottomSheet>
    </>
  );
}

function ChipView({ chip }: { chip: Chip }) {
  const { color } = useTheme();
  const Icon = chip.icon;
  return (
    <View style={[styles.chip, { backgroundColor: color.raise }]}>
      {Icon ? <Icon size={16} color={color.muted} /> : null}
      <Text role="meta" tone="muted">
        {chip.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.s4,
    gap: space.s4,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
    borderRadius: radius.pill,
  },
  files: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  thumbs: {
    flexDirection: 'row',
    gap: space.s1,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  music: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
  musicWords: {
    flexShrink: 1,
    gap: 2,
  },
});
