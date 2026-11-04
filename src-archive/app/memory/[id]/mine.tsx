import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ImageIcon, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteMedia, type MediaItem, mayContribute } from '@/api';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  DayMark,
  Empty,
  FEED_GAP,
  GlassBar,
  IconButton,
  Tile,
  UploadLine,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatRuntime, formatWeekday } from '@/lib/dates';
import { useDensity } from '@/lib/density';
import { type Failure, failure } from '@/lib/failure';
import { byDay, frameOf, removeFrames, rowsOf, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { type ParkedFile, progress } from '@/lib/upload/queue';
import { useUploads } from '@/lib/upload/send';
import { DensityPill, useDensityPinch } from '@/screens/memory/frames-density';
import { useMaterial } from '@/screens/memory/frames-material';
import { FrameSheet, type Own } from '@/screens/mine/frame-sheet';
import { board, height, space, themed } from '@/theme';

type Row =
  | {
      key: string;
      day: number;
      count: number;
      frames?: undefined;
    }
  | {
      key: string;
      frames: Own[];
      lead: boolean;
      day?: undefined;
    };
export default function MyFramesScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const density = useDensity();
  const gap = density === 1 ? 0 : FEED_GAP;
  const cell = { width: (width - gap * 2) / density };
  const pinch = useDensityPinch();
  const { items, roster, error, read, wrote } = useMaterial({ memoryId: id, token, hidden: true });
  const uploads = useUploads();
  const [open, setOpen] = useState<string | null>(null);
  const [dropping, setDropping] = useState<MediaItem | null>(null);
  const [dropFailed, setDropFailed] = useState<Failure | null>(null);
  const queued = useMemo(() => uploads.filter((file) => file.memoryId === id), [uploads, id]);
  const flying = queued.filter((file) => file.error === undefined);
  const stuck = queued.filter((file): file is ParkedFile => file.error !== undefined);
  const sending = flying[0];
  const role = roster?.find((member) => member.id === user?.id)?.role ?? null;
  const inQueue = useRef(queued.length);
  useEffect(() => {
    if (queued.length < inQueue.current) read('under still');
    inQueue.current = queued.length;
  }, [queued.length, read]);
  const own = useMemo(() => {
    const mine = (items ?? []).filter((item) => item.uploaded_by === user?.id);
    const listed = new Set(mine.map((item) => item.id));
    const now = Date.now();
    return [
      ...queued
        .filter((file) => file.mediaId === undefined || !listed.has(file.mediaId))
        .map(
          (file): Own => ({
            key: `queue-${file.assetId}`,
            at: Date.parse(file.capturedAt ?? '') || now,
            file,
          }),
        ),
      ...mine.map((item): Own => ({ key: item.id, at: shotAt(item), item })),
    ].sort((a, b) => b.at - a.at);
  }, [items, queued, user]);
  const rows = useMemo(
    () =>
      byDay(own, (one) => one.at).flatMap(({ at, frames }): Row[] => [
        { key: `day-${at}`, day: at, count: frames.length },
        ...rowsOf(frames, density).map((strip, i) => ({
          key: strip[0].key,
          frames: strip,
          lead: i === 0,
        })),
      ]),
    [own, density],
  );
  const inMemory = (items ?? []).filter((item) => item.uploaded_by === user?.id).length;
  const meta =
    items === null
      ? undefined
      : [s.mine.inMemory(inMemory), flying.length > 0 ? s.mine.flying(flying.length) : null]
          .filter(Boolean)
          .join(' · ');
  const shown = own.find((one) => one.key === open) ?? null;
  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/memory/[id]', params: { id } });
  function tileOf(one: Own) {
    const press = () => setOpen(one.key);
    if (one.file) {
      const file = one.file;
      const percent = `${Math.round(progress(file) * 100)}%`;
      return (
        <Tile
          key={one.key}
          lane="feed"
          style={cell}
          state="ready"
          uri={file.uri}
          own={file.error ? 'stuck' : 'flying'}
          percent={file.error ? undefined : percent}
          length={file.kind === 'video' ? formatRuntime(file.durationSeconds) : undefined}
          label={`${file.filename}, ${file.error ? s.mine.stuck : s.mine.sending(percent)}`}
          onPress={press}
        />
      );
    }
    const item = one.item;
    const frame = frameOf(item);
    return (
      <Tile
        key={one.key}
        lane="feed"
        style={cell}
        state={frame.state}
        uri={frame.uri ?? undefined}
        cacheKey={frame.key}
        caption={s.gallery.waiting[item.status]}
        own={item.hidden ? 'hidden' : undefined}
        length={
          item.kind === 'video'
            ? (formatRuntime(item.duration_seconds) ?? s.media.video)
            : undefined
        }
        label={[
          s.media[item.kind],
          frame.state === 'ready' ? null : s.gallery.waiting[item.status],
          item.hidden ? s.mine.hidden : null,
        ]
          .filter(Boolean)
          .join(', ')}
        onPress={press}
      />
    );
  }
  async function remove(item: MediaItem) {
    if (!token) return;
    setDropFailed(null);
    const { failure: refused } = await removeFrames([item], (one) =>
      deleteMedia(token, id, one.id),
    );
    if (refused !== undefined) return setDropFailed(failure(refused));
    wrote((have) => have?.filter((one) => one.id !== item.id) ?? null);
  }
  const going = sending ? (sending.cloud ? s.upload.fromCloud : s.state.sending) : undefined;
  const left = flying.length > 0 ? s.upload.left(flying.length) : undefined;
  const failedLine = stuck.length > 0 ? s.upload.notSentLine(stuck.length) : undefined;
  const line =
    queued.length > 0 ? (
      <UploadLine
        title={going}
        meta={left}
        value={sending ? progress(sending) : 0}
        failed={failedLine}
        action={s.upload.sortOut}
        label={[going, left, failedLine && `${failedLine}. ${s.upload.sortOut}`]
          .filter(Boolean)
          .join(', ')}
        onPress={() => router.push({ pathname: '/memory/[id]/queue', params: { id } })}
      />
    ) : null;
  const failed = error ?? dropFailed;
  return (
    <Board
      style={styles.bleed}
      list={() => (
        <View style={styles.feedWrap} testID="density-pinch" {...pinch.panHandlers}>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={[
              styles.feed,
              {
                paddingTop: insets.top + height.roundViewer + space.s2,
                paddingBottom: board.footerGallery,
              },
              rows.length === 0 ? styles.feedEmpty : null,
            ]}
            ListHeaderComponent={
              line || failed !== null ? (
                <View style={styles.head}>
                  {failed !== null ? (
                    <Banner tone="error" failure={failed}>
                      <Button
                        variant="quiet"
                        size="xs"
                        label={s.action.retry}
                        onPress={() => {
                          setDropFailed(null);
                          read();
                        }}
                      />
                    </Banner>
                  ) : null}
                  {line}
                </View>
              ) : null
            }
            ListEmptyComponent={
              items === null ? (
                failed === null ? (
                  <Waiting text={s.state.loading} />
                ) : null
              ) : (
                <Empty icon={ImageIcon} title={s.mine.emptyTitle} text={s.mine.emptyText} />
              )
            }
            renderItem={({ item: row }) =>
              row.day !== undefined ? (
                <DayMark
                  label={`${formatDay(new Date(row.day))}, ${formatWeekday(new Date(row.day))}`}
                  count={String(row.count)}
                />
              ) : (
                <View style={[styles.strip, { gap, marginTop: row.lead ? 0 : gap }]}>
                  {row.frames.map(tileOf)}
                </View>
              )
            }
          />
        </View>
      )}
    >
      <GlassBar
        style={styles.glass}
        title={s.mine.title}
        meta={meta}
        middle={
          pinch.pinching || pinch.leaving ? (
            <DensityPill value={density} leaving={pinch.leaving} />
          ) : undefined
        }
        capsuleLabel={meta ? `${s.mine.title}, ${meta}` : s.mine.title}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.mine.back}
            tone="glass"
            size={height.roundViewer}
            onPress={leave}
          />
        }
      />

      {mayContribute(role) ? (
        <ActionBar footer="gallery" style={styles.layer}>
          <Button
            variant="primary"
            wide
            icon={Plus}
            label={own.length > 0 ? s.gallery.addMore : s.gallery.add}
            onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
          />
        </ActionBar>
      ) : null}

      {shown ? (
        <FrameSheet
          key={shown.key}
          memoryId={id}
          own={shown}
          onEdited={(item) =>
            wrote((have) => have?.map((one) => (one.id === item.id ? item : one)) ?? null)
          }
          onRemove={(item) => {
            setOpen(null);
            setDropping(item);
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}

      <ConfirmSheet
        visible={dropping !== null}
        thumb={dropping?.thumbnail_url ?? undefined}
        title={s.gallery.deleteAsk(dropping?.kind ?? 'photo')}
        text={s.gallery.deleteText}
        confirmLabel={s.action.delete}
        cancelLabel={s.gallery.keep}
        onConfirm={() => {
          if (dropping) void remove(dropping);
          setDropping(null);
        }}
        onCancel={() => setDropping(null)}
      />
    </Board>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    bleed: { paddingTop: 0 },
    feed: { flexGrow: 1 },
    feedWrap: { flex: 1 },
    feedEmpty: { justifyContent: 'center', paddingHorizontal: space.s4 },
    head: { gap: space.s3, paddingHorizontal: space.s4, paddingBottom: 14 },
    strip: { flexDirection: 'row' },
    glass: { position: 'absolute', left: 0, right: 0, top: 0 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  }),
);
