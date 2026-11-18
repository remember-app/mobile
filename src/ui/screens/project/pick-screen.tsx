import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ImageOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type DeviceAsset,
  type DeviceCollection,
  deviceMediaAllowed,
  enqueueUploads,
  loadDeviceAssets,
  loadProjects,
  refreshGalleryAll,
  resolveDeviceAsset,
} from '@/functionality';
import { fileDigest } from '@/integrations/files/parts';
import type { ProjectId } from '@/types/id';
import { goBack } from '@/ui/back';
import { PHOTO_COLUMNS, type Photo, PhotoGrid } from '@/ui/components/media/photo-grid';
import { PhotoViewer } from '@/ui/components/media/photo-viewer';
import { usePhotoViewer } from '@/ui/components/media/use-photo-viewer';
import { duration } from '@/ui/format';
import { useProjectCard, useUploads } from '@/ui/hooks';
import { NoticeBanner } from '@/ui/kit/chrome/banner';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { ActionBar } from '@/ui/kit/controls/action-bar';
import { BackButton, Button, IconButton } from '@/ui/kit/controls/button';
import { Text } from '@/ui/kit/primitives/text';
import { orderOf } from '@/ui/selection';
import { radius, space, useTheme } from '@/ui/theme';

const PAGE = 60;
const SKELETON = 24;
const PREPARE_BATCH = 3;

const COLLECTIONS = [
  'all',
  'favorites',
  'videos',
  'photos',
] as const satisfies readonly DeviceCollection[];

const LABELS = {
  all: 'picker.all',
  favorites: 'picker.favorites',
  videos: 'picker.videos',
  photos: 'picker.photos',
} as const;

export default function PickScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProjectCard(id as ProjectId);
  const uploads = useUploads();
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
  const loadingRange = useRef(false);
  const [selected, setSelected] = useState<DeviceAsset[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [datesOnly, setDatesOnly] = useState(false);
  const { viewer: preview, setViewer: setPreview, measureTile, onIndex } = usePhotoViewer();
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const [slow, setSlow] = useState(false);
  const [storageWarning, setStorageWarning] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const sizes = useRef<Record<string, number>>({});
  const resolved = useRef(new Map<string, Awaited<ReturnType<typeof resolveDeviceAsset>>>());
  const resolving = useRef(
    new Map<string, Promise<Awaited<ReturnType<typeof resolveDeviceAsset>>>>(),
  );
  const measureQueue = useRef<Promise<void>>(Promise.resolve());
  const reserved = uploads.items
    .filter((upload) => upload.projectId === (id as ProjectId))
    .reduce((sum, upload) => sum + upload.sizeBytes, 0);
  const available = project
    ? Math.max(0, project.consumables.storage.bytes - project.consumables.storage.spend - reserved)
    : null;
  const availableRef = useRef(available);
  availableRef.current = available;
  const from = project?.eventStart ? project.eventStart.getTime() : null;
  const to = project?.eventEnd
    ? project.eventEnd.getTime()
    : from === null
      ? null
      : from + 24 * 60 * 60 * 1000;
  const inDates = (asset: DeviceAsset) => {
    if (from === null || to === null) return true;
    const at = new Date(asset.createdAt).getTime();
    return at >= from && at <= to;
  };
  const ordered = datesOnly ? assets.filter(inDates) : assets;
  const cell = Math.floor(width / PHOTO_COLUMNS);
  const label = t(LABELS[collection]);

  useEffect(() => {
    void loadProjects();
  }, []);

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
    if (loadingMore.current || !cursor || datesOnly) return;
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
  }, [collection, cursor, datesOnly]);

  const localOf = useCallback((asset: DeviceAsset) => {
    const cached = resolved.current.get(asset.id);
    if (cached) return Promise.resolve(cached);
    const running = resolving.current.get(asset.id);
    if (running) return running;
    const promise = resolveDeviceAsset(asset.id)
      .then((local) => {
        resolved.current.set(asset.id, local);
        return local;
      })
      .finally(() => {
        resolving.current.delete(asset.id);
      });
    resolving.current.set(asset.id, promise);
    return promise;
  }, []);

  const measure = useCallback(
    (asset: DeviceAsset) => {
      measureQueue.current = measureQueue.current
        .then(() => localOf(asset))
        .then((local) => {
          const next = { ...sizes.current, [asset.id]: local.sizeBytes };
          sizes.current = next;
          const total = selectedRef.current.reduce((sum, entry) => sum + (next[entry.id] ?? 0), 0);
          const limit = availableRef.current;
          if (limit !== null && total > limit) {
            setSelected((was) => was.filter((entry) => entry.id !== asset.id));
            setStorageWarning((value) => value + 1);
          }
        })
        .catch(() => undefined);
    },
    [localOf],
  );

  useEffect(() => {
    if (!checking) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(timer);
  }, [checking]);

  useEffect(() => {
    if (storageWarning === 0) return;
    const timer = setTimeout(() => setStorageWarning(0), 4000);
    return () => clearTimeout(timer);
  }, [storageWarning]);

  const toggle = (asset: DeviceAsset) => {
    setDuplicates(new Set());
    if (selectedRef.current.some((entry) => entry.id === asset.id)) {
      setSelected((was) => was.filter((entry) => entry.id !== asset.id));
      return;
    }
    const known = sizes.current[asset.id];
    const limit = availableRef.current;
    if (known !== undefined && limit !== null) {
      const total = selectedRef.current.reduce(
        (sum, entry) => sum + (sizes.current[entry.id] ?? 0),
        0,
      );
      if (total + known > limit) {
        setStorageWarning((value) => value + 1);
        return;
      }
    }
    setSelected((was) => [...was, asset]);
    if (known === undefined) measure(asset);
  };

  const loadRange = async () => {
    if (from === null || loadingRange.current) return;
    loadingRange.current = true;
    const all: DeviceAsset[] = [...assets];
    const seen = new Set(all.map((asset) => asset.id));
    const asked = collection;
    let next = cursor;
    try {
      while (next) {
        const page = await loadDeviceAssets(next, PAGE, asked);
        if (collectionRef.current !== asked) return;
        for (const asset of page.assets) {
          if (!seen.has(asset.id)) {
            seen.add(asset.id);
            all.push(asset);
          }
        }
        next = page.next;
        const oldest = page.assets[page.assets.length - 1];
        if (!oldest || new Date(oldest.createdAt).getTime() < from) break;
      }
    } finally {
      loadingRange.current = false;
    }
    setAssets(all);
    setCursor(next);
    setDatesOnly(true);
    requestAnimationFrame(() => measureTile.current?.(0, () => undefined));
  };

  const selectAll = () => {
    const picked = ordered.filter(inDates);
    setSelected(picked);
    setDuplicates(new Set());
    if (picked.length > 0) {
      requestAnimationFrame(() => measureTile.current?.(0, () => undefined));
    }
  };

  const confirm = async () => {
    if (!selected.length || !id || checking) return;
    const projectId = id as ProjectId;
    const chosen = selected;
    setChecking(true);
    setPreparing({ done: 0, total: chosen.length });
    try {
      const items = await refreshGalleryAll(projectId);
      const known = new Set(
        items.map((item) => item.media.fingerprint).filter((fingerprint) => fingerprint !== ''),
      );
      const knownSizes = new Set(items.map((item) => item.media.bytes));
      const prepared: {
        assetId: string;
        fingerprint: string | null;
        file: Parameters<typeof enqueueUploads>[0][number];
      }[] = [];
      for (let at = 0; at < chosen.length; at += PREPARE_BATCH) {
        const batch = chosen.slice(at, at + PREPARE_BATCH);
        const entries = await Promise.all(
          batch.map(async (asset) => {
            const local = await localOf(asset);
            return {
              assetId: asset.id,
              fingerprint: knownSizes.has(local.sizeBytes) ? await fileDigest(local.uri) : null,
              file: {
                projectId,
                uri: local.uri,
                previewUri: local.previewUri,
                fileName: local.fileName,
                kind: local.kind,
                sizeBytes: local.sizeBytes,
                capturedAt: local.capturedAt,
                durationSeconds: local.durationSeconds,
              },
            };
          }),
        );
        prepared.push(...entries);
        setPreparing({ done: prepared.length, total: chosen.length });
      }
      const used = prepared.reduce((sum, entry) => sum + entry.file.sizeBytes, 0);
      const limit = availableRef.current;
      if (limit !== null && used > limit) {
        setStorageWarning((value) => value + 1);
        return;
      }
      const dup = new Set(
        prepared
          .filter((entry) => entry.fingerprint !== null && known.has(entry.fingerprint))
          .map((entry) => entry.assetId),
      );
      const upload = (entries: typeof prepared) =>
        enqueueUploads(entries.map((entry) => ({ ...entry.file, fingerprint: entry.fingerprint })));
      if (dup.size === 0) {
        upload(prepared);
        goBack(router);
        return;
      }
      Alert.alert(t('picker.duplicatesTitle'), t('picker.duplicatesMessage', { count: dup.size }), [
        {
          text: t('picker.showDuplicates'),
          onPress: () => setDuplicates(dup),
        },
        {
          text: t('picker.excludeDuplicates'),
          style: 'destructive',
          onPress: () => {
            const rest = prepared.filter((entry) => !dup.has(entry.assetId));
            setSelected((was) => was.filter((asset) => !dup.has(asset.id)));
            setDuplicates(new Set());
            if (rest.length === 0) return;
            upload(rest);
            goBack(router);
          },
        },
        {
          text: t('picker.uploadAnyway'),
          onPress: () => {
            setDuplicates(new Set());
            upload(prepared);
            goBack(router);
          },
        },
      ]);
    } catch {
      Alert.alert(t('picker.checkFailed'));
    } finally {
      setChecking(false);
      setPreparing(null);
    }
  };

  const order = useMemo(() => orderOf(selected.map((asset) => asset.id)), [selected]);

  const photos = useMemo<Photo[]>(
    () =>
      ordered.map((asset) => ({
        id: asset.id,
        source: asset.uri,
        video: asset.kind === 'video',
        select: order.get(asset.id) ?? null,
        accent: duplicates.has(asset.id),
        note: asset.kind === 'video' ? duration(asset.duration) : undefined,
      })),
    [duplicates, order, ordered],
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
        capturedAt: new Date(asset.createdAt),
      })),
    [ordered],
  );

  const actionLabel = checking
    ? slow && preparing
      ? t('picker.preparing', { done: preparing.done, total: preparing.total })
      : t('picker.checking')
    : selected.length
      ? t('picker.addCount', { count: selected.length })
      : datesOnly
        ? t('picker.selectAll')
        : t('picker.dates');

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: preview === null }} />
      <View style={styles.root}>
        <View style={styles.fill}>
          {denied ? (
            <View style={styles.centre}>
              <ImageOff size={40} color={color.muted} />
              <Text role="body" tone="muted">
                {t('picker.denied')}
              </Text>
              <Button
                label={t('picker.settings')}
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
          ) : ordered.length === 0 ? null : (
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
              mark="check"
              padding={{ top: insets.top + 60, bottom: insets.bottom + 76 }}
              onLoadOlder={() => void loadMore()}
            />
          )}
        </View>
        <BlurBar edge="top" style={styles.top}>
          <BackButton label={t('action.back')} onPress={() => goBack(router)} />
          <View style={styles.headCentre}>
            <Pressable
              onPress={() => setMenu((was) => !was)}
              style={[styles.title, { backgroundColor: color.surface, borderColor: color.line }]}
            >
              <Text role="barTitle">{label}</Text>
              <ChevronDown size={18} color={color.paper} />
            </Pressable>
          </View>
          <IconButton
            icon={X}
            label={t('picker.clear')}
            tone="surface"
            size={44}
            on={selected.length > 0 || datesOnly}
            onPress={() => {
              if (selected.length > 0) setSelected([]);
              else if (datesOnly) setDatesOnly(false);
              setDuplicates(new Set());
            }}
          />
        </BlurBar>
        {storageWarning > 0 ? (
          <NoticeBanner top={insets.top + 60} text={t('picker.storageExceeded')} />
        ) : null}
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
                  key={item}
                  onPress={() => {
                    setCollection(item);
                    setMenu(false);
                    setPreview(null);
                    setSelected([]);
                    setDatesOnly(false);
                    setDuplicates(new Set());
                  }}
                  style={styles.option}
                >
                  <Text role="row" tone={item === collection ? 'paper' : 'muted'}>
                    {t(LABELS[item])}
                  </Text>
                  {item === collection ? <Check size={18} color={color.accent} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <ActionBar>
          <Button
            label={actionLabel}
            variant="primary"
            disabled={checking}
            onPress={() => {
              if (selected.length > 0) void confirm();
              else if (datesOnly) selectAll();
              else void loadRange();
            }}
          />
        </ActionBar>
        {preview === null ? null : (
          <PhotoViewer
            photos={viewerPhotos}
            initialIndex={preview.index}
            origin={preview.rect}
            onClose={() => setPreview(null)}
            onLoadMore={() => void loadMore()}
            onIndex={onIndex}
            selected={
              preview ? selected.some((asset) => asset.id === ordered[preview.index]?.id) : false
            }
            onSelect={() => {
              const asset = preview ? ordered[preview.index] : undefined;
              if (asset) toggle(asset);
            }}
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
    gap: space.s3,
    paddingHorizontal: space.s4,
    minHeight: 44,
  },
  headCentre: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
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
