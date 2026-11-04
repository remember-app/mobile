import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowUpDown,
  CircleCheckBig,
  Download,
  Funnel,
  ImageIcon,
  Plus,
  Share,
  Tag,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Label, type MediaItem, mayContribute, memberName } from '@/api';
import {
  ActionBar,
  Banner,
  Button,
  ConfirmSheet,
  DayMark,
  Empty,
  FEED_GAP,
  IconButton,
  seamsOver,
  Tile,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import {
  formatDayShort,
  formatDayTiny,
  formatEventDates,
  formatRuntime,
  formatWeekday,
} from '@/lib/dates';
import { useDensity } from '@/lib/density';
import {
  allTaken,
  arranged,
  dayOf,
  FILTER_NONE,
  type Filter,
  type Frame,
  type FrameGroup,
  filterDays,
  filtering,
  frameOf,
  framesMatching,
  groupFrames,
  keepLabels,
  mayOpen,
  mayPick,
  megabytesOf,
  rowsOf,
  SORT_DEFAULT,
  type Sort,
  singleFrameOf,
  toggleDay,
  toggleEvery,
} from '@/lib/frames';
import { filed } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { Films } from '@/screens/memory/films';
import { FrameViewer } from '@/screens/memory/frame-viewer';
import { useDensityPinch } from '@/screens/memory/frames-density';
import { useMarkedErrands } from '@/screens/memory/frames-errands';
import { useMaterial } from '@/screens/memory/frames-material';
import { FilterSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { SeamDay, SpineLayer, useSpine } from '@/screens/memory/frames-spine';
import { BlockHead, type Head, HeadTrouble, MemoryHead } from '@/screens/memory/head';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { board, duration, height, space, themed, type, useTheme } from '@/theme';

type Seam = Exclude<
  FrameGroup,
  {
    by: 'all';
  }
>;
type Row =
  | {
      key: string;
      group: Seam;
      frames?: undefined;
    }
  | {
      key: string;
      frames: MediaItem[];
      group?: undefined;
    };
const SeamCell = seamsOver<Row>((row) => row.group !== undefined);
type Tuning = 'filter' | 'sort';
export function Frames({ id, head }: { id: string; head: Head }) {
  const { token, user, datesBetweenDays } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height: screen, fontScale } = useWindowDimensions();
  const density = useDensity();
  const single = density === 1;
  const gap = single ? 0 : FEED_GAP;
  const cell = { width: (width - gap * 2) / density };
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [dropping, setDropping] = useState(false);
  const [proposal, setProposal] = useState<'idle' | 'nothing'>('idle');
  const [proposed, setProposed] = useState<'nothing' | 'failed' | null>(null);
  const [labelling, setLabelling] = useState(false);
  const [filter, setFilter] = useState<Filter>(FILTER_NONE);
  const [sort, setSort] = useState<Sort>(SORT_DEFAULT);
  const [tuning, setTuning] = useState<Tuning | null>(null);
  const onScreen = useRef(true);
  useEffect(
    () => () => {
      onScreen.current = false;
    },
    [],
  );
  const list = useRef<Animated.FlatList<Row>>(null);
  const scrollTo = useCallback(
    (offset: number) => list.current?.scrollToOffset({ offset, animated: false }),
    [],
  );
  const { items, roster, labels, error, loading, link, hushed, read, readLabels, wrote } =
    useMaterial({
      memoryId: id,
      token,
      onLabels: useCallback(
        (all: Label[]) =>
          setFilter((have) => keepLabels(have, (one) => all.some((label) => label.id === one))),
        [],
      ),
    });
  useFocusEffect(useCallback(() => () => setOpen(null), []));
  useEffect(() => {
    if (proposed === null) return;
    const leaves = setTimeout(() => setProposed(null), duration.hold);
    return () => clearTimeout(leaves);
  }, [proposed]);
  const memory = head.memory;
  const role = roster?.find((member) => member.id === user?.id)?.role ?? null;
  const mayDelete = (item: MediaItem) => item.uploaded_by === user?.id || role === 'organizer';
  const mayUpload = mayContribute(role);
  const shown = items?.find((item) => item.id === open) ?? null;
  const any = items !== null && items.length > 0;
  const marked = items?.filter((item) => picked.has(item.id)) ?? [];
  const deletable = marked.filter(mayDelete);
  const kept = useMemo(() => framesMatching(items ?? [], filter), [items, filter]);
  const dated = datesBetweenDays && !single;
  const rows = useMemo(
    () =>
      groupFrames(kept, sort, dated).flatMap((group): Row[] => [
        ...(group.by === 'all' ? [] : [{ key: group.key, group }]),
        ...rowsOf(group.frames, density).map((frames) => ({ key: frames[0].id, frames })),
      ]),
    [kept, sort, dated, density],
  );
  const sheet = useMemo(() => rows.flatMap((row) => row.frames ?? []), [rows]);
  const seamDays = useMemo(() => {
    if (!single || sort.by !== 'none') return null;
    let day: number | null = null;
    return rows.map((row) => {
      const first = row.frames?.[0];
      if (first === undefined) return null;
      const on = dayOf(first);
      const opens = on !== day;
      day = on;
      return opens ? formatDayTiny(new Date(on)) : null;
    });
  }, [rows, single, sort.by]);
  const { spine, onScroll, onContentSizeChange, onLayout, onHeaderLayout } = useSpine({
    frames: sheet,
    plain: !single && sort.by === 'none' && !dated,
    columns: density,
    rowPitch: cell.width + gap,
    scrollTo,
  });
  const pinch = useDensityPinch();
  const [layer, setLayer] = useState(0);
  const [troubled, setTroubled] = useState(0);
  const [emptied, setEmptied] = useState(0);
  const top = insets.top + height.roundViewer + space.s4;
  const bottom = Math.max(board.footerGallery, layer);
  const liftUnder = (taken: number) =>
    rows.length === 0
      ? Math.max(0, Math.min(bottom - top, screen - top - bottom - emptied - taken))
      : 0;
  const lineEnds = insets.top + height.roundViewer + space.s2 + troubled;
  const floats =
    lineEnds + layer + type.body.lineHeight * fontScale <= screen &&
    (any || top + (screen - top - bottom - emptied + liftUnder(0)) / 2 >= lineEnds);
  const lift = liftUnder(head.error !== null && !floats ? troubled : 0);
  const trouble =
    head.error === null ? null : (
      <HeadTrouble
        error={head.error}
        reload={head.reload}
        onLayout={(e) => setTroubled(e.nativeEvent.layout.height)}
      />
    );
  const plate =
    !any || link === 'ok' || link === 'hushed' ? null : link === 'gone' ? (
      <Banner
        text={s.state.offline}
        hide={{ label: s.action.hide, onPress: hushed }}
        style={styles.plate}
      />
    ) : (
      <Banner tone="done" text={s.state.online} style={styles.plate} />
    );
  const brought = useMemo(() => {
    const ids = [...new Set((items ?? []).map((item) => item.uploaded_by))];
    return ids.map((who) => ({
      id: who,
      name: memberName(roster?.find((member) => member.id === who) ?? null),
    }));
  }, [items, roster]);
  const days = useMemo(() => filterDays(items ?? []), [items]);
  const nameOf = (item: MediaItem, frame: Frame, current?: boolean) =>
    [
      s.media[item.kind],
      frame.state === 'ready' ? null : s.gallery.waiting[item.status],
      current ? s.gallery.open : null,
    ]
      .filter(Boolean)
      .join(', ');
  function headingOf(group: Seam): {
    label: string;
    avatar?: string;
    organizer?: boolean;
  } {
    if (group.by === 'day') {
      const at = new Date(group.at);
      return { label: `${formatDayShort(at)}, ${formatWeekday(at)}` };
    }
    if (group.by === 'kind') return { label: s.media[group.kind] };
    const who = roster?.find((member) => member.id === group.who) ?? null;
    const name = memberName(who);
    return { label: name, avatar: name, organizer: who?.role === 'organizer' };
  }
  const pick = (mediaId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(mediaId)) next.add(mediaId);
      return next;
    });
  function pickEverything() {
    const markable = kept.filter(mayPick);
    setPicked((have) => toggleEvery(markable, have));
  }
  function togglePicking() {
    setPicked(new Set());
    setProposal('idle');
    setProposed(null);
    setPicking((on) => !on);
  }
  function propose() {
    setProposed(null);
    try {
      const offered = kept.filter(
        (item) => item.screening_rejected === true && mayPick(item) && mayDelete(item),
      );
      if (offered.length === 0) {
        setProposal('nothing');
        setProposed('nothing');
        return;
      }
      setPicked(new Set(offered.map((item) => item.id)));
    } catch {
      setProposed('failed');
    }
  }
  const { busy, notice, save, share, drop } = useMarkedErrands({
    memoryId: id,
    token,
    picked,
    deletable,
    onScreen,
    onGone: (gone) => wrote((have) => have?.filter((one) => !gone.has(one.id)) ?? null),
  });
  const dates = memory === null ? '' : formatEventDates(memory.event_start, memory.event_end);
  const holds = any && memory !== null ? s.memory.people(memory.member_count) : s.memory.nothingYet;
  const name = memory?.title ?? s.memory.fallbackTitle;
  const weight = megabytesOf(marked);
  const madeOf = [
    weight === null ? null : s.viewer.size(weight),
    s.gallery.pickedKinds(
      marked.filter((item) => item.kind === 'photo').length,
      marked.filter((item) => item.kind === 'video').length,
    ),
  ]
    .filter(Boolean)
    .join(' · ');
  const capsule = picking
    ? marked.length === 0
      ? s.gallery.pickNothing
      : s.gallery.picked(marked.length)
    : name;
  const under = picking
    ? marked.length === 0
      ? undefined
      : madeOf
    : [dates, holds].filter(Boolean).join(' · ');
  return (
    <>
      <View style={styles.feedWrap} testID="density-pinch" {...pinch.panHandlers}>
        <Animated.FlatList<Row>
          ref={list}
          data={rows}
          keyExtractor={(row) => row.key}
          CellRendererComponent={SeamCell}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          contentContainerStyle={[
            styles.feed,
            single ? styles.tight : null,
            { paddingTop: top },
            rows.length === 0 ? styles.feedEmpty : null,
            { paddingBottom: bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => read()}
              tintColor={color.accent}
              colors={[color.accent]}
              progressBackgroundColor={color.surface}
            />
          }
          ListHeaderComponent={
            any || !floats || plate ? (
              <View onLayout={onHeaderLayout}>
                {plate}
                {floats ? null : trouble}
                {any ? (
                  <>
                    <Films id={id} memory={memory} />
                    <BlockHead
                      title={s.memory.framesPlain}
                      count={s.memory.frames(kept.length)}
                      style={styles.framesHead}
                    />
                  </>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View
              onLayout={(e) => setEmptied(e.nativeEvent.layout.height)}
              style={{ marginTop: lift }}
            >
              {error !== null && items === null ? (
                <Banner tone="error" failure={error}>
                  <Button variant="quiet" size="xs" label={s.action.retry} onPress={() => read()} />
                </Banner>
              ) : items === null ? (
                <Waiting text={s.state.loading} />
              ) : (
                <Empty icon={ImageIcon} title={s.gallery.emptyTitle} text={s.gallery.empty} />
              )}
            </View>
          }
          renderItem={({ item: row, index }) => {
            if (row.group) {
              const group = row.group;
              const markable = group.frames.filter(mayPick);
              const heading = headingOf(group);
              return (
                <DayMark
                  {...heading}
                  count={
                    picking || group.by !== 'day'
                      ? String(picking ? markable.length : group.frames.length)
                      : undefined
                  }
                  picked={allTaken(markable, picked)}
                  onPress={
                    picking && markable.length > 0
                      ? () => setPicked((have) => toggleDay(markable, have))
                      : undefined
                  }
                  pressLabel={`${heading.label}, ${s.gallery.selectDay(markable.length)}`}
                  style={[styles.seam, single ? styles.tightSeam : null]}
                />
              );
            }
            const day = seamDays?.[index];
            return (
              <View style={[styles.feedRow, single ? styles.tight : null]}>
                {day ? <SeamDay label={day} /> : null}
                {row.frames.map((item) => {
                  const frame = single ? singleFrameOf(item) : frameOf(item);
                  const pickable = picking && mayPick(item);
                  return (
                    <Tile
                      key={item.id}
                      lane="feed"
                      single={single}
                      style={cell}
                      state={frame.state}
                      uri={frame.uri ?? undefined}
                      cacheKey={frame.key}
                      ratio={single ? frame.ratio : undefined}
                      caption={s.gallery.waiting[item.status]}
                      length={
                        item.kind === 'video'
                          ? (formatRuntime(item.duration_seconds) ?? s.media.video)
                          : undefined
                      }
                      label={nameOf(item, frame)}
                      pick={pickable ? (picked.has(item.id) ? 'send' : 'off') : undefined}
                      onPress={
                        picking
                          ? pickable
                            ? () => pick(item.id)
                            : undefined
                          : mayOpen(item)
                            ? () => setOpen(item.id)
                            : undefined
                      }
                    />
                  );
                })}
              </View>
            );
          }}
        />
      </View>

      <SpineLayer {...spine} />

      <MemoryHead
        title={capsule}
        meta={under}
        capsuleLabel={picking ? `${capsule}. ${s.gallery.selectAll}` : s.memory.settings(name)}
        onCapsule={
          picking
            ? pickEverything
            : () => router.push({ pathname: '/memory/[id]/settings', params: { id } })
        }
        left={
          picking ? (
            <IconButton
              icon={Tag}
              tone="glass"
              size={height.roundViewer}
              label={s.gallery.labelsPut}
              onPress={() => setLabelling(true)}
              disabled={busy || marked.length === 0}
            />
          ) : undefined
        }
        right={
          picking || any ? (
            <IconButton
              icon={CircleCheckBig}
              tone="glass"
              size={height.roundViewer}
              label={picking ? s.gallery.leaveSelect : s.gallery.select}
              on={picking}
              onPress={togglePicking}
              disabled={busy}
            />
          ) : undefined
        }
      >
        {floats ? trouble : null}
      </MemoryHead>

      <View
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(e) => setLayer(e.nativeEvent.layout.height)}
      >
        {proposed === null ? null : (
          <Banner
            tone={proposed === 'nothing' ? 'done' : 'error'}
            icon={proposed === 'nothing' ? undefined : TriangleAlert}
            text={proposed === 'nothing' ? s.gallery.proposeNothing : s.gallery.proposeFailed}
            style={styles.proposalNotice}
          />
        )}

        {notice ? <Banner failure={notice} style={styles.notice} /> : null}

        {picking ? (
          <ActionBar
            footer="gallery"
            start={
              <IconButton
                icon={Share}
                tone="glass"
                size={height.round}
                label={s.action.share}
                onPress={() => void share()}
                disabled={busy || marked.length === 0}
              />
            }
            end={
              <IconButton
                icon={Trash2}
                tone="glass"
                tint={color.dangerText}
                size={height.round}
                label={s.action.delete}
                onPress={() => setDropping(true)}
                disabled={busy || deletable.length === 0}
              />
            }
          >
            {marked.length > 0 ? (
              <Button
                variant="primary"
                wide
                icon={Download}
                label={s.gallery.download(marked.length)}
                onPress={() => void save()}
                disabled={busy}
              />
            ) : proposal === 'nothing' ? (
              <Button variant="primary" wide label={s.gallery.nothingPicked} disabled />
            ) : (
              <Button
                variant="secondary"
                wide
                label={s.gallery.proposeToRemove}
                onPress={propose}
                disabled={busy}
              />
            )}
          </ActionBar>
        ) : any || mayUpload ? (
          <ActionBar
            footer="gallery"
            start={
              any ? (
                <IconButton
                  icon={Funnel}
                  label={s.gallery.filters}
                  size={height.round}
                  tone="glass"
                  dot={filtering(filter)}
                  onPress={() => setTuning('filter')}
                  disabled={busy}
                />
              ) : undefined
            }
            end={
              any ? (
                <IconButton
                  icon={ArrowUpDown}
                  label={s.gallery.sorting}
                  size={height.round}
                  tone="glass"
                  dot={arranged(sort)}
                  onPress={() => setTuning('sort')}
                  disabled={busy}
                />
              ) : undefined
            }
          >
            {mayUpload ? (
              <Button
                variant="primary"
                wide
                icon={Plus}
                label={any ? s.gallery.addMore : s.gallery.add}
                disabled={busy}
                onPress={() => {
                  router.push({ pathname: '/memory/[id]/mine', params: { id } });
                  router.push({ pathname: '/memory/[id]/upload', params: { id } });
                }}
              />
            ) : (
              <View style={styles.grow} />
            )}
          </ActionBar>
        ) : null}
      </View>

      {tuning === 'filter' ? (
        <FilterSheet
          people={brought}
          labels={labels}
          days={days}
          value={filter}
          count={(draft) => framesMatching(items ?? [], draft).length}
          onApply={(next) => {
            setFilter(next);
            setTuning(null);
          }}
          onCancel={() => setTuning(null)}
        />
      ) : null}
      {tuning === 'sort' ? (
        <SortSheet value={sort} onChange={setSort} onDone={() => setTuning(null)} />
      ) : null}

      {labelling ? (
        <LabelSheets
          memoryId={id}
          frames={marked}
          onFiled={(labelId, ids, now) => {
            wrote((have) => filed(have, labelId, ids, now));
            if (ids === null) setFilter((have) => keepLabels(have, (one) => one !== labelId));
          }}
          onClose={() => {
            setLabelling(false);
            readLabels();
          }}
        />
      ) : null}

      <ConfirmSheet
        visible={dropping}
        thumb={deletable[0]?.thumbnail_url ?? undefined}
        title={
          deletable.length === 1
            ? s.gallery.deleteAsk(deletable[0].kind)
            : s.gallery.deleteAskMany(deletable.length)
        }
        meta={deletable.length < marked.length ? s.gallery.deleteDenied : undefined}
        text={s.gallery.deleteText}
        confirmLabel={s.action.delete}
        cancelLabel={s.gallery.keep}
        onConfirm={() => {
          setDropping(false);
          void drop();
        }}
        onCancel={() => setDropping(false)}
      />

      {shown === null ? null : (
        <FrameViewer
          memoryId={id}
          item={shown}
          frames={sheet}
          roster={roster}
          memory={memory}
          mayDelete={mayDelete}
          nameOf={nameOf}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
          onRemoved={(gone) => {
            wrote((have) => have?.filter((one) => one.id !== gone) ?? null);
            setOpen(null);
          }}
          onEdited={(edited) =>
            wrote((have) => have?.map((one) => (one.id === edited.id ? edited : one)) ?? null)
          }
        />
      )}
    </>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    feedWrap: { flex: 1 },
    feed: { flexGrow: 1, gap: FEED_GAP },
    tight: { gap: 0 },
    tightSeam: { marginVertical: 0 },
    feedEmpty: { justifyContent: 'center', paddingHorizontal: space.s4 },
    feedRow: { flexDirection: 'row', gap: FEED_GAP, position: 'relative' },
    seam: { marginVertical: -FEED_GAP },
    framesHead: { marginTop: 22, marginBottom: 10 },
    plate: { marginHorizontal: space.s3, marginBottom: space.s2 },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    notice: { marginHorizontal: space.s4, marginTop: space.s3 },
    proposalNotice: { marginHorizontal: space.s4, marginBottom: 10 },
    grow: { flex: 1 },
  }),
);
