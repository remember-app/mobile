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
import { type Failure, failure } from '@/lib/failure';
import { byDay, COLUMNS, frameOf, removeFrames, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { type ParkedFile, progress } from '@/lib/upload/queue';
import { useUploads } from '@/lib/upload/send';
import { useMaterial } from '@/screens/memory/frames-material';
import { FrameSheet, type Own } from '@/screens/mine/frame-sheet';
import { board, height, space, themed } from '@/theme';

/**
 * One line of the feed: a day, or up to three of one's own frames shot on it — `lead` for the first
 * strip of a day, which stands flush with the day where the others keep a gutter (as on `Upload`).
 */
type Row =
  | { key: string; day: number; count: number; frames?: undefined }
  | { key: string; frames: Own[]; lead: boolean; day?: undefined };

/**
 * «Мои кадры» (spec 8, `MyFrames`) — what somebody has given a memory and what became of it: their
 * own feed, by the day it was shot, with each tile saying by itself whether it is on its way up,
 * stuck on the way, or hidden from the shared feed. Over it the sending in one line, which leads to
 * the queue; under it the way to add more. A tile opens the frame's own sheet (`SheetMyFrame`).
 *
 * What is on its way comes from the phone's own queue, not from the api — the api lists nothing
 * until the bytes are in. A file the api has taken leaves the queue, and the feed is read again to
 * bring it back as the record it has become.
 */
export default function MyFramesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cell = { width: (width - FEED_GAP * 2) / 3 };
  const { items, roster, error, read, wrote } = useMaterial({ memoryId: id, token, hidden: true });
  const uploads = useUploads();
  /** The frame whose sheet is up, by its key — a re-read hands the sheet the fresh record. */
  const [open, setOpen] = useState<string | null>(null);
  /** The frame «Удалить у всех» asked about, until the answer. */
  const [dropping, setDropping] = useState<MediaItem | null>(null);
  const [dropFailed, setDropFailed] = useState<Failure | null>(null);

  // Held, so the feed below is cut again only when the queue itself moves.
  const queued = useMemo(() => uploads.filter((file) => file.memoryId === id), [uploads, id]);
  const flying = queued.filter((file) => file.error === undefined);
  const stuck = queued.filter((file): file is ParkedFile => file.error !== undefined);
  const sending = flying[0];
  const role = roster?.find((member) => member.id === user?.id)?.role ?? null;

  // A file leaving the queue has been taken in — or let go of — and the listing is what says which.
  const inQueue = useRef(queued.length);
  useEffect(() => {
    if (queued.length < inQueue.current) read(true);
    inQueue.current = queued.length;
  }, [queued.length, read]);

  /**
   * One's own, newest first by when it was shot — the shared feed's order (spec 8). A file whose
   * record the listing already carries is drawn as the record, never twice.
   */
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

  /** Every day with its count over its frames, three to a row — dates always, as on `Upload`. */
  const rows = useMemo(
    () =>
      byDay(own, (one) => one.at).flatMap(({ at, frames }): Row[] => [
        { key: `day-${at}`, day: at, count: frames.length },
        ...Array.from({ length: Math.ceil(frames.length / COLUMNS) }, (_, i) => ({
          key: frames[i * COLUMNS].key,
          frames: frames.slice(i * COLUMNS, i * COLUMNS + COLUMNS),
          lead: i === 0,
        })),
      ]),
    [own],
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

  // The shared feed's own rule: a frame already gone from the server is gone here too, not a failure.
  async function remove(item: MediaItem) {
    if (!token) return;
    setDropFailed(null);
    const { failure: refused } = await removeFrames([item], (one) =>
      deleteMedia(token, id, one.id),
    );
    if (refused !== undefined) return setDropFailed(failure(refused));
    wrote((have) => have?.filter((one) => one.id !== item.id) ?? null);
  }

  // The sending in one line (spec detail 48): what is going up and how much is left, and what did
  // not go — the whole line leads to the queue, where the failures are sorted out.
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
        // «Отправляем, осталось 9, 5 файлов не ушли. Разобрать» (spec detail 48).
        label={[going, left, failedLine && `${failedLine}. ${s.upload.sortOut}`]
          .filter(Boolean)
          .join(', ')}
        onPress={() => router.push({ pathname: '/memory/[id]/queue', params: { id } })}
      />
    ) : null;

  const failed = error ?? dropFailed;

  return (
    // The feed runs under the status line and to the bottom edge; the glass and the layer float.
    <Board
      style={styles.bleed}
      list={() => (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={[
            styles.feed,
            // Spec 8: from 108 under the glass bar, and clear of the bottom layer's 190.
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
              <View style={[styles.strip, { marginTop: row.lead ? 0 : FEED_GAP }]}>
                {row.frames.map(tileOf)}
              </View>
            )
          }
        />
      )}
    >
      <GlassBar
        style={styles.glass}
        title={s.mine.title}
        meta={meta}
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
            // One action in two places: «Добавить кадры» while there is nothing yet (spec 9).
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

      {/* `SheetConfirmDelete`, the same as the viewer's: «навсегда» is said only there. */}
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
    feedEmpty: { justifyContent: 'center', paddingHorizontal: space.s4 },
    // The line over the feed keeps the screen's 16, and the first day stands 14 under it.
    head: { gap: space.s3, paddingHorizontal: space.s4, paddingBottom: 14 },
    strip: { flexDirection: 'row', gap: FEED_GAP },
    glass: { position: 'absolute', left: 0, right: 0, top: 0 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  }),
);
