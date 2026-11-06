import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ImageOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type DeviceAsset,
  type DeviceCollection,
  deviceMediaAllowed,
  loadDeviceAssets,
} from '@/functionality';
import {
  type MeasureTile,
  PHOTO_COLUMNS,
  type Photo,
  PhotoGrid,
  type Rect,
} from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { BlurBar } from '@/ui/kit/blur-bar';
import { BackButton, Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { enqueueMockUploads } from '@/ui/mocks/uploads';
import { radius, space, useTheme } from '@/ui/theme';

const PAGE = 60;
const SKELETON = 24;

const COLLECTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'favorites', label: 'Избранные' },
  { value: 'videos', label: 'Видео' },
  { value: 'photos', label: 'Фото' },
] as const satisfies readonly { value: DeviceCollection; label: string }[];

const EMPTY = {
  all: 'Здесь пока нет фото',
  favorites: 'Нет избранных',
  videos: 'Нет видео',
  photos: 'Нет фото',
} as const;

function duration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export default function PickScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [assets, setAssets] = useState<DeviceAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<DeviceCollection>('all');
  const [menu, setMenu] = useState(false);
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const loadingMore = useRef(false);
  const [selected, setSelected] = useState<DeviceAsset[]>([]);
  const [preview, setPreview] = useState<{ index: number; rect?: Rect } | null>(null);
  const measureTile = useRef<MeasureTile | null>(null);
  const ordered = assets;
  const cell = Math.floor(width / PHOTO_COLUMNS);
  const label = COLLECTIONS.find((item) => item.value === collection)?.label ?? 'Все';

  useEffect(() => {
    let live = true;
    setLoading(true);
    setDenied(false);
    setAssets([]);
    setCursor(null);
    void (async () => {
      const allowed = await deviceMediaAllowed();
      if (!live) return;
      if (!allowed) {
        setDenied(true);
        setLoading(false);
        return;
      }
      const page = await loadDeviceAssets(undefined, PAGE, collection);
      if (!live) return;
      setAssets(page.assets);
      setCursor(page.next);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [collection]);

  const loadMore = useCallback(async () => {
    if (loadingMore.current || !cursor) return;
    loadingMore.current = true;
    const asked = collection;
    try {
      const page = await loadDeviceAssets(cursor, PAGE, asked);
      if (collectionRef.current !== asked) return;
      setAssets((was) => [...was, ...page.assets]);
      setCursor(page.next);
    } finally {
      loadingMore.current = false;
    }
  }, [collection, cursor]);

  const toggle = (asset: DeviceAsset) => {
    setSelected((was) =>
      was.some((entry) => entry.id === asset.id)
        ? was.filter((entry) => entry.id !== asset.id)
        : [...was, asset],
    );
  };

  const confirm = () => {
    if (!selected.length || !id) return;
    enqueueMockUploads(
      id,
      selected.map((asset) => ({
        source: { uri: asset.uri },
        video: asset.kind === 'video',
        assetId: asset.id,
        width: asset.width,
        height: asset.height,
      })),
    );
    router.back();
  };

  const order = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((asset, index) => {
      map.set(asset.id, index + 1);
    });
    return map;
  }, [selected]);

  const photos = useMemo<Photo[]>(
    () =>
      ordered.map((asset) => ({
        id: asset.id,
        source: asset.uri,
        video: asset.kind === 'video',
        select: order.get(asset.id) ?? null,
        note: asset.kind === 'video' ? duration(asset.duration) : undefined,
      })),
    [order, ordered],
  );

  const viewerPhotos = useMemo(
    () =>
      ordered.map((asset) => ({
        id: asset.id,
        source: asset.uri,
        width: asset.width,
        height: asset.height,
        video: asset.kind === 'video',
        assetId: asset.id,
      })),
    [ordered],
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: preview === null }} />
      <View style={[styles.root, { backgroundColor: color.ink }]}>
        <View style={styles.fill}>
          {denied ? (
            <View style={styles.centre}>
              <ImageOff size={40} color={color.muted} />
              <Text role="body" tone="muted">
                Нет доступа к фото
              </Text>
              <Button
                label="Открыть настройки"
                variant="secondary"
                wide={false}
                onPress={() => void Linking.openSettings()}
              />
            </View>
          ) : loading ? (
            <View
              style={[
                styles.skeleton,
                {
                  paddingTop: insets.top + 60,
                  paddingBottom: insets.bottom + 76,
                },
              ]}
            >
              {Array.from({ length: SKELETON }, (_, index) => (
                <View key={index} style={{ width: cell, height: cell, padding: 1 }}>
                  <View
                    style={{ flex: 1, backgroundColor: color.raise, borderRadius: radius.tile }}
                  />
                </View>
              ))}
            </View>
          ) : ordered.length === 0 ? (
            <View style={styles.centre}>
              <ImageOff size={40} color={color.muted} />
              <Text role="body" tone="muted">
                {EMPTY[collection]}
              </Text>
            </View>
          ) : (
            <PhotoGrid
              key={collection}
              photos={photos}
              onOpen={(index, rect) => setPreview({ index, rect })}
              onSelect={(index) => {
                const asset = ordered[index];
                if (asset) toggle(asset);
              }}
              blankIndex={preview?.index ?? null}
              measureRef={measureTile}
              padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
              onLoadOlder={() => void loadMore()}
            />
          )}
        </View>
        <BlurBar edge="top" style={styles.top}>
          <BackButton label="Назад" onPress={() => router.back()} />
          <Pressable onPress={() => setMenu((was) => !was)} style={styles.title}>
            <Text role="barTitle">{label}</Text>
            <ChevronDown size={18} color={color.paper} />
          </Pressable>
          <View style={styles.spacer} />
        </BlurBar>
        {menu ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
            <View
              style={[
                styles.menu,
                {
                  top: insets.top + 56,
                  left: (width - 240) / 2,
                  backgroundColor: color.surface,
                  borderColor: color.line,
                },
              ]}
            >
              {COLLECTIONS.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setCollection(item.value);
                    setMenu(false);
                    setPreview(null);
                  }}
                  style={styles.option}
                >
                  <Text role="row" tone={item.value === collection ? 'paper' : 'muted'}>
                    {item.label}
                  </Text>
                  {item.value === collection ? <Check size={18} color={color.accent} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <View
          pointerEvents="box-none"
          style={[styles.bottom, { paddingBottom: insets.bottom + space.s2 }]}
        >
          <Button
            label={selected.length ? `Добавить ${selected.length}` : 'Добавить'}
            variant="primary"
            disabled={selected.length === 0}
            onPress={confirm}
          />
        </View>
        {preview === null ? null : (
          <PhotoViewer
            photos={viewerPhotos}
            initialIndex={preview.index}
            origin={preview.rect}
            onClose={() => setPreview(null)}
            onIndex={(next) =>
              measureTile.current?.(next, (rect) =>
                setPreview((was) => (was === null ? was : { index: next, rect })),
              )
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s3,
    minHeight: 52,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  spacer: {
    width: 44,
  },
  menu: {
    position: 'absolute',
    width: 240,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.s1,
    zIndex: 30,
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s4,
  },
  fill: { flex: 1 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s4,
    paddingTop: space.s2,
  },
  skeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    paddingHorizontal: space.s6,
  },
});
