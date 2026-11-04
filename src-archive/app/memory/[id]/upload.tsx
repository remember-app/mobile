import { Image } from 'expo-image';
import type * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, Check, ChevronLeft, CircleCheckBig, Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listMedia, listMemories, type MediaItem, type Memory } from '@/api';
import {
  ActionBar,
  Banner,
  BlockStuck,
  Board,
  Button,
  ConfirmSheet,
  DashedNote,
  DayHead,
  DayMark,
  FEED_GAP,
  GlassBar,
  HintNote,
  Icon,
  IconButton,
  Sheet,
  seamsOver,
  Text,
  Tile,
  Upload,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatRuntime, formatWeekday } from '@/lib/dates';
import { useDensity } from '@/lib/density';
import { type Failure, failure } from '@/lib/failure';
import { rowsOf } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { assetsByDay, type ShootingDay } from '@/lib/media-window';
import { alreadyThere } from '@/lib/upload/already';
import { type ParkedFile, parkedReason, progress } from '@/lib/upload/queue';
import { answerAskAll, drop, enqueue, useAskAll, useUploads, wake } from '@/lib/upload/send';
import { DensityPill, useDensityPinch } from '@/screens/memory/frames-density';
import { NoFeed } from '@/screens/upload/message';
import { useRoll } from '@/screens/upload/roll';
import {
  board,
  height,
  radius,
  space,
  ThemePin,
  themed,
  themes,
  uploadGaps,
  useTheme,
} from '@/theme';

const room = themes.dark.color;
type Row =
  | {
      key: string;
      day: ShootingDay<MediaLibrary.Asset>;
      frames?: undefined;
      unseen?: undefined;
    }
  | {
      key: string;
      frames: MediaLibrary.Asset[];
      lead: boolean;
      day?: undefined;
      unseen?: undefined;
    }
  | {
      key: string;
      unseen: true;
      day?: undefined;
      frames?: undefined;
    };
const SeamCell = seamsOver<Row>((row) => row.day !== undefined);
export default function UploadScreen({ queue = false }: { queue?: boolean }) {
  const { id, sent: handed } = useLocalSearchParams<{
    id: string;
    sent?: string;
  }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const { color } = useTheme();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const underBar = insets.top + height.roundViewer + space.s2;
  const density = useDensity();
  const pinch = useDensityPinch();
  const uploads = useUploads();
  const {
    access,
    ask,
    granted,
    limited,
    assets: gallery,
    reading,
    error: galleryError,
    again,
    chooseMore,
  } = useRoll();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [picking, setPicking] = useState(true);
  const [open, setOpen] = useState<MediaLibrary.Asset | null>(null);
  const [sent, setSent] = useState(() => Number(handed) || 0);
  const [unfolded, setUnfolded] = useState(false);
  const [apiError, setApiError] = useState<Failure | null>(null);
  const [brought, setBrought] = useState<MediaItem[] | null>(null);
  const [repeat, setRepeat] = useState<{
    all: MediaLibrary.Asset[];
    fresh: MediaLibrary.Asset[];
    count: number;
  } | null>(null);
  const rows = useMemo(
    () =>
      assetsByDay(memory, gallery).flatMap((day): Row[] => [
        { key: `day-${day.at}`, day },
        ...rowsOf(day.assets, density).map((strip, i) => ({
          key: strip[0].id,
          frames: strip,
          lead: i === 0,
        })),
        ...(limited ? [{ key: `unseen-${day.at}`, unseen: true as const }] : []),
      ]),
    [memory, gallery, limited, density],
  );
  const load = useCallback(() => {
    if (!token) return;
    setApiError(null);
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setApiError(failure(e)),
    );
  }, [token, id]);
  useEffect(load, [load]);
  const me = user?.id;
  const readBrought = useCallback(async (): Promise<MediaItem[]> => {
    if (!token || me === undefined) return [];
    const all = await listMedia(token, id, { hidden: true });
    return all.filter((item) => item.uploaded_by === me);
  }, [token, id, me]);
  useEffect(() => {
    let live = true;
    readBrought().then(
      (own) => live && setBrought(own),
      () => live && setBrought([]),
    );
    return () => {
      live = false;
    };
  }, [readBrought]);
  function retry() {
    load();
    again();
  }
  const queued = queue ? uploads.filter((file) => file.memoryId === id) : [];
  const sending = queued.find((file) => file.error === undefined);
  const stuck = queued.filter((file): file is ParkedFile => file.error !== undefined);
  const asking = useAskAll() === id && sent > 0 && queued.length === 0;
  const feed = granted && rows.length > 0;
  const choosing = picking || !feed;
  const gap = density === 1 ? 0 : FEED_GAP;
  const cell = { width: (width - gap * 2) / density };
  const dayTaken = (day: ShootingDay<MediaLibrary.Asset>) =>
    day.assets.every((asset) => picked.has(asset.id));
  const toggle = (assetId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(assetId)) next.add(assetId);
      return next;
    });
  function toggleDay(day: ShootingDay<MediaLibrary.Asset>) {
    setPicked((have) => {
      const next = new Set(have);
      const whole = day.assets.every((asset) => have.has(asset.id));
      for (const asset of day.assets) {
        if (whole) next.delete(asset.id);
        else next.add(asset.id);
      }
      return next;
    });
  }
  async function send() {
    const chosen = gallery.filter((asset) => picked.has(asset.id));
    if (chosen.length === 0) return;
    const own = brought ?? (await readBrought().catch(() => [] as MediaItem[]));
    const repeats = await alreadyThere(chosen, own);
    if (repeats.size === 0) return hand(chosen);
    setRepeat({
      all: chosen,
      fresh: chosen.filter((asset) => !repeats.has(asset.id)),
      count: repeats.size,
    });
  }
  function hand(chosen: readonly MediaLibrary.Asset[]) {
    if (chosen.length === 0) {
      setPicked(new Set());
      return;
    }
    enqueue(id, chosen);
    setPicked(new Set());
    if (!queue) {
      router.replace({
        pathname: '/memory/[id]/queue',
        params: { id, sent: String(sent + chosen.length) },
      });
      return;
    }
    setSent((n) => n + chosen.length);
  }
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const nameOf = (asset: MediaLibrary.Asset) =>
    `${asset.mediaType === 'video' ? s.media.video : s.media.photo} ${asset.filename}`;
  const said = apiError !== null || queued.length > 0 || limited || (reading && rows.length > 0);
  function blocks() {
    return (
      <>
        {apiError !== null ? (
          <Banner tone="error" failure={apiError}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : null}

        {queued.length > 0 ? (
          <Upload
            title={sending?.cloud ? s.upload.fromCloud : s.state.sending}
            meta={s.upload.stillToSend(queued.length)}
            value={sending ? progress(sending) : 0}
            hint={s.upload.carriesOn}
          />
        ) : null}

        {stuck.length > 0 ? (
          <BlockStuck
            title={s.upload.notSent(stuck.length)}
            retry={{ label: s.upload.again, onPress: wake }}
            lines={[...stuck].reverse().map((file) => ({
              key: file.assetId,
              name: file.filename,
              reason: parkedReason(s, file.error),
              dropLabel: s.upload.dropFile(file.filename),
              onDrop: () => drop(id, file.assetId),
            }))}
            open={unfolded}
            onToggle={() => setUnfolded((was) => !was)}
            more={s.upload.folded(stuck.length - 2)}
            less={s.upload.fold}
          />
        ) : null}

        {limited ? (
          <HintNote
            icon={Info}
            tone="spark"
            text={s.upload.limited}
            action={{ label: s.upload.chooseMore, onPress: () => void chooseMore() }}
          />
        ) : null}

        {reading && rows.length > 0 ? <Text role="meta">{s.upload.reading}</Text> : null}
      </>
    );
  }
  const layer =
    feed && choosing && (picked.size > 0 || queued.length === 0) ? (
      <ActionBar
        style={styles.layer}
        footer={limited ? undefined : 'upload'}
        above={
          limited && picked.size > 0 ? (
            <>
              <Text role="label" style={styles.grow}>
                {reading
                  ? s.upload.picked(picked.size)
                  : s.upload.pickedOf(picked.size, gallery.length)}
              </Text>

              <Button
                variant="quiet"
                labelRole="controlSm"
                label={s.action.clear}
                onPress={() => setPicked(new Set())}
              />
            </>
          ) : undefined
        }
      >
        <Button
          variant="primary"
          wide
          icon={ArrowUp}
          disabled={picked.size === 0}
          label={picked.size > 0 ? s.upload.send(picked.size) : s.action.send}
          onPress={send}
        />
      </ActionBar>
    ) : null;
  function dayOf(day: ShootingDay<MediaLibrary.Asset>) {
    const at = new Date(day.at);
    const frames = day.assets.length;
    const takes = choosing && !limited && !reading;
    if (limited) {
      return <DayHead label={s.upload.shotOn(formatDay(at))} count={s.memory.frames(frames)} />;
    }
    const label = `${formatDay(at)}, ${formatWeekday(at)}`;
    return (
      <DayMark
        label={label}
        count={String(frames)}
        picked={dayTaken(day)}
        onPress={takes ? () => toggleDay(day) : undefined}
        pressLabel={dayTaken(day) ? s.upload.leaveDay(label) : s.upload.takeDay(label)}
      />
    );
  }
  return (
    <View style={styles.screen}>
      <Board
        style={styles.bleed}
        body={styles.body}
        list={
          feed
            ? () => (
                <View style={styles.pinch} testID="density-pinch" {...pinch.panHandlers}>
                  <FlatList
                    data={rows}
                    keyExtractor={(row) => row.key}
                    CellRendererComponent={SeamCell}
                    contentContainerStyle={[
                      styles.feed,
                      {
                        paddingTop: underBar,
                        paddingBottom: picking ? board.footerTall : space.s5,
                      },
                    ]}
                    ListHeaderComponent={
                      said ? (
                        <View style={[styles.head, styles.headFeed, styles.headSaid]}>
                          {blocks()}
                        </View>
                      ) : null
                    }
                    renderItem={({ item: row }) =>
                      row.day ? (
                        dayOf(row.day)
                      ) : row.unseen ? (
                        <DashedNote text={s.upload.restUnseen} style={styles.unseen} />
                      ) : (
                        <View style={[styles.strip, { gap, marginTop: row.lead ? 0 : gap }]}>
                          {row.frames.map((item) => (
                            <Tile
                              key={item.id}
                              state="ready"
                              lane="feed"
                              uri={item.uri}
                              pick={choosing ? (picked.has(item.id) ? 'send' : 'off') : undefined}
                              length={
                                item.mediaType === 'video'
                                  ? formatRuntime(item.duration)
                                  : undefined
                              }
                              label={nameOf(item)}
                              onPress={() => (choosing ? toggle(item.id) : setOpen(item))}
                              style={cell}
                            />
                          ))}
                        </View>
                      )
                    }
                  />
                </View>
              )
            : undefined
        }
      >
        {feed ? null : (
          <>
            {said ? (
              <View style={[styles.head, styles.headSaid, { marginTop: underBar }]}>
                {blocks()}
              </View>
            ) : null}
            <NoFeed
              error={galleryError}
              access={access}
              ask={ask}
              reading={reading}
              onRetry={retry}
              top={said ? 0 : underBar}
            />
          </>
        )}
        {feed ? layer : null}

        <Modal
          visible={open !== null}
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setOpen(null)}
        >
          <ThemePin value="dark">
            <View style={styles.room}>
              {open ? (
                <Image
                  source={{ uri: open.uri }}
                  contentFit="contain"
                  accessibilityLabel={nameOf(open)}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View style={[styles.roomBar, { paddingTop: insets.top }]}>
                <IconButton
                  icon={X}
                  label={s.action.close}
                  tone="viewer"
                  size={height.roundViewer}
                  onPress={() => setOpen(null)}
                />
              </View>
            </View>
          </ThemePin>
        </Modal>

        <Sheet
          visible={asking}
          onCancel={() => answerAskAll(null)}
          head={
            <View style={styles.result}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.tick}
              >
                <Icon icon={Check} size={15} color={color.sparkInk} />
              </View>
              <Text role="rowSm">{s.upload.sentToMemory(sent)}</Text>
            </View>
          }
          title={s.upload.askAll}
          lead={
            <Text role="bodySm" tone="muted">
              {s.upload.askAllText}
            </Text>
          }
          footer={
            <>
              <Button
                variant="paper"
                label={s.upload.thatsAll}
                onPress={() => answerAskAll('done')}
              />
              <Button
                variant="secondary"
                label={s.upload.moreToCome}
                onPress={() => answerAskAll('more_coming')}
              />
            </>
          }
        />

        <ConfirmSheet
          visible={repeat !== null}
          variant="gentle"
          title={s.upload.alreadyThere(repeat?.count ?? 0)}
          text={s.upload.alreadyThereText}
          confirmLabel={s.upload.alreadyYes}
          cancelLabel={s.upload.alreadyNo}
          onConfirm={() => {
            const chosen = repeat?.all ?? [];
            setRepeat(null);
            hand(chosen);
          }}
          onCancel={() => {
            const chosen = repeat?.fresh ?? [];
            setRepeat(null);
            hand(chosen);
          }}
        />
      </Board>

      <GlassBar
        style={styles.glass}
        title={s.upload.title}
        meta={memory ? s.upload.into(memory.title) : undefined}
        middle={
          feed && (pinch.pinching || pinch.leaving) ? (
            <DensityPill value={density} leaving={pinch.leaving} />
          ) : undefined
        }
        capsuleLabel={memory ? `${s.upload.title}, ${s.upload.into(memory.title)}` : s.upload.title}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            tone="glass"
            size={height.roundViewer}
            onPress={leave}
          />
        }
        right={
          feed ? (
            <IconButton
              icon={CircleCheckBig}
              label={s.upload.picking}
              tone="glass"
              size={height.roundViewer}
              on={picking}
              onPress={() => setPicking((was) => !was)}
            />
          ) : undefined
        }
      />
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    bleed: { paddingTop: 0 },
    feed: { flexGrow: 1 },
    screen: { flex: 1 },
    body: { paddingHorizontal: space.s4 },
    pinch: { flex: 1 },
    strip: { flexDirection: 'row' },
    head: { gap: space.s4 },
    headFeed: { paddingHorizontal: space.s4 },
    headSaid: { paddingBottom: space.s4 },
    glass: { position: 'absolute', left: 0, right: 0, top: 0 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    unseen: { marginTop: uploadGaps.unseen },
    grow: { flex: 1, minWidth: 0 },
    room: { flex: 1, backgroundColor: room.ink },
    roomBar: { paddingHorizontal: space.s3 },
    result: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    tick: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
