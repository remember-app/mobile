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
import { formatDayShort, formatEventDates, formatRuntime, formatWeekday } from '@/lib/dates';
import {
  allTaken,
  arranged,
  COLUMNS,
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
  SORT_DEFAULT,
  type Sort,
  toggleDay,
  toggleEvery,
} from '@/lib/frames';
import { filed } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { Films } from '@/screens/memory/films';
import { FrameViewer } from '@/screens/memory/frame-viewer';
import { useMarkedErrands } from '@/screens/memory/frames-errands';
import { useMaterial } from '@/screens/memory/frames-material';
import { FilterSheet, SortSheet } from '@/screens/memory/frames-sheets';
import { SpineLayer, useSpine } from '@/screens/memory/frames-spine';
import { BlockHead, type Head, HeadTrouble, MemoryHead } from '@/screens/memory/head';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { board, height, space, themed, type, useTheme } from '@/theme';

/** A seam over a strip of frames — every cut but the one that has no seam at all. */
type Seam = Exclude<FrameGroup, { by: 'all' }>;

/** One line of the feed: a seam, or up to three of the frames standing under it. */
type Row =
  | { key: string; group: Seam; frames?: undefined }
  | { key: string; frames: MediaItem[]; group?: undefined };

const SeamCell = seamsOver<Row>((row) => row.group !== undefined);

/** Which of the two sheets the feed is being tuned from, if either. */
type Tuning = 'filter' | 'sort';

/**
 * A memory, whole: `MemoryFrames` of spec 8. One screen and no tabs — the frames run the width of
 * the phone and everything else lies over them: the glass bar at the top, the «Ролики» block first
 * on the feed, and the bottom layer with the filters, the one action and the arrangement.
 *
 * This one screen draws the layout's five states of it: `MemoryFrames` itself, `FramesEmpty` when
 * nothing has been brought yet, `FilmsEmpty` when there is material but no film (the block says so
 * itself), `FramesByPeople` when the arrangement is by whoever brought it, and `FramesPicking`
 * while frames are being marked to do something with.
 *
 * What everybody put in, as everybody sees it, a viewer included (doc-01, «Проверка прав»): the
 * level only decides who may add, who may delete and who may order a film, and the api is the
 * authority on all three.
 */
export function Frames({ id, head }: { id: string; head: Head }) {
  // «Даты между днями» is the account's, one for every feed: `MemoryDated` on, `MemoryScrub` off.
  const { token, user, datesBetweenDays } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  // The pull-to-refresh spinner is drawn by the platform and takes its colours as props; the
  // dangerous glyph at the foot of the picking mode is a tint the kit takes as one.
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  /**
   * One column of the feed, worked out rather than flexed. The feed is three `1fr` columns running
   * the whole width of the phone with a 2px gutter and no margins (spec 7.8), and a `1fr` column is
   * the same width in a last row of one as in a full row of three. `flex: 1/3` is not: it hands each
   * frame a third of what the row has left after its gaps, and a row with one frame in it has no
   * gaps to leave — so the last frame of the feed came out wider than every frame above it, which is
   * what the designer measured. Rotating the phone re-reads the width.
   */
  const { width, height: screen, fontScale } = useWindowDimensions();
  const cell = { width: (width - FEED_GAP * 2) / 3 };
  /** The record the viewer is showing, held by id so a reload hands it a fresh signed url. */
  const [open, setOpen] = useState<string | null>(null);
  /**
   * Whether the feed is being picked from rather than looked at — the select button's own state.
   * It is what a tap on a frame means, what the bottom layer is about, and nothing else.
   */
  const [picking, setPicking] = useState(false);
  /** What is marked, by record id — the same set the «Добавить кадры» screen keeps. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** Whether the sheet that asks about deleting what is marked is up. */
  const [dropping, setDropping] = useState(false);
  /** And whether the labels of the memory are up over it (spec 7.7, `SheetLabels`). */
  const [labelling, setLabelling] = useState(false);
  /** What of the memory is shown, and how it is laid out — the two sheets at the foot of it. */
  const [filter, setFilter] = useState<Filter>(FILTER_NONE);
  const [sort, setSort] = useState<Sort>(SORT_DEFAULT);
  const [tuning, setTuning] = useState<Tuning | null>(null);
  /**
   * Whether this screen is still the one the errand below is running for. `busy` cannot answer
   * that: it lives in state that goes with the screen, and saving or sharing an armful outlives it —
   * `router.back()`, the swipe and the hardware key all take this down while the loop is still
   * going. Left alone, that loop keeps writing to the phone's gallery with nothing able to stop it,
   * and coming back gives a fresh screen with `busy` false, so a second press runs on top of the
   * first and every file lands twice.
   */
  const onScreen = useRef(true);
  useEffect(
    () => () => {
      onScreen.current = false;
    },
    [],
  );
  /** The feed itself, for the one thing outside it that moves it: a finger on the spine. */
  const list = useRef<Animated.FlatList<Row>>(null);
  const scrollTo = useCallback(
    (offset: number) => list.current?.scrollToOffset({ offset, animated: false }),
    [],
  );

  /**
   * What the memory holds and how it is kept fresh — its own module: when to read, what a read may
   * overwrite and what to do with one that comes back too late is a subject of its own, and none of
   * it is about drawing a wall of frames.
   */
  const { items, roster, labels, error, loading, read, readLabels, wrote } = useMaterial({
    memoryId: id,
    token,
    // A box somebody else deleted leaves the filter too, the way one deleted here does.
    onLabels: useCallback(
      (all: Label[]) =>
        setFilter((have) => keepLabels(have, (one) => all.some((label) => label.id === one))),
      [],
    ),
  });

  // The open frame is shut on the way out of the screen (TASK-94, extended in review): leaving
  // without closing it — a tapped push, a deep link, anything that is not the cross, the delete or
  // the hardware key — left the frame standing on a window of its own over whatever screen came
  // next, because the memory stays mounted behind a `router.push`. Since TASK-124 it cost a second
  // thing as well: the window is what hands the app its freedom to turn, and nothing was giving it
  // back.
  //
  // The sheets are not in here: they are the kit's own `Sheet`, and since TASK-129 a sheet shuts
  // itself when the screen under it loses focus.
  useFocusEffect(useCallback(() => () => setOpen(null), []));

  const memory = head.memory;
  // The caller's own standing, read off their row the way the roster is read.
  const role = roster?.find((member) => member.id === user?.id)?.role ?? null;
  // Ownership and not role: a viewer may delete what they brought, a contributor may not delete a
  // neighbour's. The api is the authority — this only decides whether to draw the button.
  const mayDelete = (item: MediaItem) => item.uploaded_by === user?.id || role === 'organizer';
  // Material goes in during the event and long after the montage was made (doc-02); the only thing
  // in the way is the level, which is the same one the invite is gated on.
  const mayUpload = mayContribute(role);
  /**
   * The record the viewer is showing, if any. Held by id and looked up here, so a re-read hands the
   * open frame a freshly signed url and a record somebody else deleted takes its own window down.
   */
  const shown = items?.find((item) => item.id === open) ?? null;
  /** Whether anything has been brought at all — which is what tells `MemoryFrames` from `FramesEmpty`. */
  const any = items !== null && items.length > 0;

  /**
   * What is marked *and* still in the memory. `picked` is only ever emptied by leaving the mode or
   * by the capsule, and the feed moves underneath it on its own — the three-second re-read, the read
   * on focus, the pull. Somebody else deleting a marked frame left the button counting it: it said
   * «Скачать 3», came back «Сохранено 0 файлов», and had signed the gallery to find that out.
   * Every button counts what it will actually reach.
   */
  const marked = items?.filter((item) => picked.has(item.id)) ?? [];
  /** And of those, the ones this person is allowed to take out for good. */
  const deletable = marked.filter(mayDelete);

  /** The memory as the filter leaves it — what every count, every group and the strip are cut from. */
  const kept = useMemo(() => framesMatching(items ?? [], filter), [items, filter]);

  /**
   * The feed as the layout lays it out: a heading, then the frames under it three to a row, then
   * the next heading. What the headings are about is the sort's business (`@/lib/frames`); this only
   * flattens the groups into rows, because three to a row has to be cut by hand — `numColumns` lays
   * out the list underneath and cannot do it around the headings standing between the strips. The
   * «Добавить кадры» screen cuts the phone's own roll the same way, for the same reason.
   *
   * Held across renders: every tap on a frame is a render, and the whole feed is re-cut here.
   */
  const rows = useMemo(
    () =>
      groupFrames(kept, sort, datesBetweenDays).flatMap((group): Row[] => [
        // The wall has no seam over it at all (`MemoryFrames`, `MemoryScrub`): with the dates off
        // and nothing grouped, the days are read off the spine at the edge instead.
        ...(group.by === 'all' ? [] : [{ key: group.key, group }]),
        ...Array.from({ length: Math.ceil(group.frames.length / COLUMNS) }, (_, i) => ({
          key: group.frames[i * COLUMNS].id,
          frames: group.frames.slice(i * COLUMNS, i * COLUMNS + COLUMNS),
        })),
      ]),
    [kept, sort, datesBetweenDays],
  );

  /**
   * The same feed, flat — the order the strip under an open frame walks along. The strip is the
   * feed rolled into one row and has to read in the same direction it does, whichever way that is:
   * the api sends the oldest frame first, and by default the feed is read newest day down, so the
   * tile at the top left of the grid was the one at the far end of a strip cut from `items` (found
   * in review, TASK-121). Both are cut from the same rows.
   */
  const sheet = useMemo(() => rows.flatMap((row) => row.frames ?? []), [rows]);

  /**
   * The date spine at the right edge (spec 7.8, detail 66, `MemoryScrub`): its own module, because
   * none of it is about the frames — it measures the feed, fades itself in and out and answers a
   * finger, and all it wants from here is what is being drawn and how tall a row of it is.
   */
  const { spine, onScroll, onContentSizeChange, onLayout, onHeaderLayout } = useSpine({
    frames: sheet,
    // Cut into people or kinds, or with the dates written between the days, the seams already say
    // where a day begins and there is nothing for a spine to add.
    plain: sort.by === 'none' && !datesBetweenDays,
    rowPitch: cell.width + FEED_GAP,
    scrollTo,
  });

  /**
   * What floats over the feed, as it came out rather than as the layout draws it (TASK-372). The
   * bottom layer's button wraps on large system type, and a feed padded by the drawing alone leaves
   * its last frames under it where no finger reaches — so the feed clears the taller of the two.
   * The line about a memory that would not read floats under the glass while it, the layer and a
   * line of the feed fit the phone — and, over a feed with nothing to scroll, while the block in the
   * middle of it stands clear of the line — and scrolls at the head of the feed when not.
   */
  const [layer, setLayer] = useState(0);
  const [troubled, setTroubled] = useState(0);
  const [emptied, setEmptied] = useState(0);
  const top = insets.top + height.roundViewer + space.s4;
  const bottom = Math.max(board.footerGallery, layer);
  // `FramesEmpty` (spec 4): the body's layer of the feed is the whole screen, 0…844 — the glass and
  // the bottom layer lie over it — so what stands in an empty feed is centred on the screen and not
  // on the room between the two, which the taller layer pushes up. It is let down by the difference,
  // as far as the room under it allows — less the line at the head of the feed, when it stands there:
  // never under the bottom layer.
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

  /** Everybody who actually brought something, for the faces the filter sheet offers. */
  const brought = useMemo(() => {
    const ids = [...new Set((items ?? []).map((item) => item.uploaded_by))];
    return ids.map((who) => ({
      id: who,
      name: memberName(roster?.find((member) => member.id === who) ?? null),
    }));
  }, [items, roster]);

  /** Every day the memory holds, counted and weighed for the day tiles on that sheet. */
  const days = useMemo(() => filterDays(items ?? []), [items]);

  /**
   * What a tile is called out loud: what it is, what has become of it, and whether it is the frame
   * the strip has open — «Видео», «Фото, Проявляем…», «Фото, открыто».
   *
   * Whether there is anything to say past the first word is the *frame's* question and not the
   * record's: `frameOf` turns a `ready` record with no derivative into the fallen frame, and that
   * tile drew «Показывать нечего» while announcing itself as a plain «Фото». The words themselves
   * are then the record's own, so a tile is read out in the line it is drawn with. One helper for
   * both grids, so the strip and the feed cannot drift apart again.
   */
  // `current` and not `open`: `open` is this screen's own state a few lines up — the id of the
  // record being shown — and a boolean of the same name in here reads as that one.
  const nameOf = (item: MediaItem, frame: Frame, current?: boolean) =>
    [
      s.media[item.kind],
      frame.state === 'ready' ? null : s.gallery.waiting[item.status],
      current ? s.gallery.open : null,
    ]
      .filter(Boolean)
      .join(', ');

  /** What stands at the two ends of a seam: the group said in words, and who it belongs to. */
  function headingOf(group: Seam): { label: string; avatar?: string; organizer?: boolean } {
    // `MemoryDated` — «13 сентября, суббота»: the day and the name of it, and no year. Which year
    // the wedding was is settled by the memory this feed belongs to.
    if (group.by === 'day') {
      const at = new Date(group.at);
      return { label: `${formatDayShort(at)}, ${formatWeekday(at)}` };
    }
    // Photo against video: the material's own two kinds, under the words one record is named by.
    if (group.by === 'kind') return { label: s.media[group.kind] };
    // `FramesByPeople`: the circle in front of the name, with the spark collar if this is the
    // organizer. Somebody who has since left the memory is off the roster and their frames stay.
    const who = roster?.find((member) => member.id === group.who) ?? null;
    const name = memberName(who);
    return { label: name, avatar: name, organizer: who?.role === 'organizer' };
  }

  /** Tap to mark, tap again to unmark — the «Добавить кадры» screen's own gesture, same as sending. */
  const pick = (mediaId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(mediaId)) next.add(mediaId);
      return next;
    });

  /**
   * The capsule while the mode is on (spec 8, `FramesPicking`): it takes every frame on the feed,
   * and once they are all taken the same press gives them back. Everything the filter is holding
   * back is left alone — «все» is what is on the screen, which is what the count over it says too.
   */
  function pickEverything() {
    const markable = kept.filter(mayPick);
    setPicked((have) => toggleEvery(markable, have));
  }

  /**
   * The select button, both ways. Leaving drops the marks — the layout says so, and a selection
   * kept in the dark would come back on the next entry as marks nobody made. Clearing on the way in
   * costs nothing and says the same thing once.
   */
  function togglePicking() {
    setPicked(new Set());
    setPicking((on) => !on);
  }

  /**
   * Keeping what is marked, handing it on, taking it out — the three errands of the picking mode,
   * in their own module: each outlives the press that started it, and all three share one «busy»
   * and one banner.
   */
  const { busy, notice, save, share, drop } = useMarkedErrands({
    memoryId: id,
    token,
    picked,
    deletable,
    onScreen,
    onGone: (gone) => wrote((have) => have?.filter((one) => !gone.has(one.id)) ?? null),
  });

  /** The days of the event under the memory's name, and what it holds — the capsule's second line. */
  const dates = memory === null ? '' : formatEventDates(memory.event_start, memory.event_end);
  const holds = any && memory !== null ? s.memory.people(memory.member_count) : s.memory.nothingYet;
  const name = memory?.title ?? s.memory.fallbackTitle;
  /** And the same capsule while picking: what is marked, how heavy it is and what it is made of. */
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
  /** The two lines of the capsule, whichever of its two states the screen is in. */
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
      <Animated.FlatList<Row>
        ref={list}
        data={rows}
        keyExtractor={(row) => row.key}
        // A group's band, while it picks, lies over the rows either side of it (spec detail 65).
        CellRendererComponent={SeamCell}
        // What the spine is hung on: the offset goes to the native side, where the marks are moved
        // with the photographs, and the listener is what lights the thing and puts it out again.
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The spine is this feed's scroll indicator (`MemoryScrub`), and the seams are where the
        // dates stand when it is off; the platform's own bar beside it is a second one.
        showsVerticalScrollIndicator={false}
        // What the spine measures itself against: how much there is to scroll, and how much of it
        // is in view.
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        // The feed runs under the glass bar and under the bottom layer, and starts far enough down
        // for the block over it to clear the bar. An empty one is one block in the middle instead.
        contentContainerStyle={[
          styles.feed,
          { paddingTop: top },
          rows.length === 0 ? styles.feedEmpty : null,
          { paddingBottom: bottom },
        ]}
        // Still here, and mostly for the person who would rather not wait: a record turning `ready`
        // is answered by the re-read above on its own. Not the fifteen-minute links, though — that
        // read deliberately leaves a finished record's own url where it is (`keepReady`), so on a
        // screen left open past the quarter hour a pull is the short way to freshly signed ones.
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => read()}
            tintColor={color.accent}
            colors={[color.accent]}
            progressBackgroundColor={color.surface}
          />
        }
        // The head of the feed (spec 8): the films first — the thing the whole memory is being
        // filled up for — and under them the material itself, named and counted. Neither is drawn
        // over `FramesEmpty`: with nothing brought there is no film to cut and nothing to count.
        ListHeaderComponent={
          any || !floats ? (
            // Measured rather than reckoned: the films are a block whose height is its own business
            // — a strip, an empty state, nothing at all while it reads — and the spine's marks are
            // counted from the first row of frames, which stands under it.
            <View onLayout={onHeaderLayout}>
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
          // Only over a feed that was never read. A read somebody asked for that fails over frames
          // already on screen leaves them where they are, and its reason must not come back later
          // as the answer to «nothing here» — every frame deleted afterwards is an empty feed, and
          // an empty feed is `FramesEmpty`, not a connection that failed a minute ago.
          <View
            onLayout={(e) => setEmptied(e.nativeEvent.layout.height)}
            style={{ marginTop: lift }}
          >
            {error !== null && items === null ? (
              <Banner tone="error" failure={error}>
                {/* Wrapped rather than handed `load` itself: a press hands its own argument along,
                    and the first one here is «read quietly». */}
                <Button variant="quiet" size="xs" label={s.action.retry} onPress={() => read()} />
              </Banner>
            ) : items === null ? (
              <Waiting text={s.state.loading} />
            ) : (
              // `FramesEmpty`: the dashed circle, what is missing, and what to do about it. The
              // action itself is in the bottom layer and not in here (spec 7.9).
              <Empty icon={ImageIcon} title={s.gallery.emptyTitle} text={s.gallery.empty} />
            )}
          </View>
        }
        renderItem={({ item: row }) => {
          // The seam over its own strip (spec 7.8): what the frames under it have in common at one
          // edge, and at the other the one thing that belongs to that group — how many frames it
          // holds while the feed is being looked at, «Выбрать все 174» while it is being picked
          // from. What decides whether a seam is drawn at all is the sort and the account's dates.
          if (row.group) {
            const group = row.group;
            // What «все» is here: the frames a mark would actually mean something on, by the very
            // rule the single tap below is gated on. A group still being developed whole has
            // nothing to offer, so the action is off rather than counting to zero.
            const markable = group.frames.filter(mayPick);
            const heading = headingOf(group);
            return (
              <DayMark
                {...heading}
                // The seam holds one figure and never a sentence (spec 7.8): how many that person
                // brought, and over a day nothing at all — `MemoryDated` writes the date alone.
                // While the mode is on every seam counts, because the whole band is then the button
                // that takes the group.
                count={
                  picking || group.by !== 'day'
                    ? String(picking ? markable.length : group.frames.length)
                    : undefined
                }
                // The seam is the group's own switch: its circle says whether all of it is taken,
                // and a second press gives it back.
                picked={allTaken(markable, picked)}
                onPress={
                  picking && markable.length > 0
                    ? () => setPicked((have) => toggleDay(markable, have))
                    : undefined
                }
                // Read out in place of the band's own words, so it names whose frames it takes:
                // «Выбрать все 5» alone would be every seam of the feed at once.
                pressLabel={`${heading.label}, ${s.gallery.selectDay(markable.length)}`}
                style={styles.seam}
              />
            );
          }
          return (
            <View style={styles.feedRow}>
              {row.frames.map((item) => {
                // What a record is on screen is `@/lib/frames` and not this line: the viewer below
                // draws off the same reading, and the two must not drift.
                const frame = frameOf(item);
                // «Ждущие и упавшие кадры не отмечаются: скачивать нечего» — asked of `@/lib/frames`
                // so the group's own count above cannot come to a different answer than the tap.
                const pickable = picking && mayPick(item);
                return (
                  <Tile
                    key={item.id}
                    lane="feed"
                    style={cell}
                    state={frame.state}
                    uri={frame.uri ?? undefined}
                    caption={s.gallery.waiting[item.status]}
                    // The layout marks a video by its length in the corner; a record that came
                    // without one still says what it is, in the same place.
                    length={
                      item.kind === 'video'
                        ? (formatRuntime(item.duration_seconds) ?? s.media.video)
                        : undefined
                    }
                    // Read out, never drawn — so it says «Photo» and not the api's own `photo`.
                    label={nameOf(item, frame)}
                    // Spec 7.4, detail 26: a frame marked in the feed wears `accent` with a white
                    // collar (`FramesPicking`) — `spark` is the wizard's «taken into the film».
                    // Only while the mode is on and only where a mark means something: handed
                    // `undefined`, the tile is a button again rather than a checkbox that is
                    // permanently off.
                    pick={pickable ? (picked.has(item.id) ? 'send' : 'off') : undefined}
                    // While the mode is on a tap marks the frame instead of opening it. Off it,
                    // the same gate the strip below puts on the same record, and for the same
                    // reason: a frame still being made has nothing behind it to open, so opening it
                    // lands on a whole screen saying «Проявляем…». A fallen one still opens — that
                    // is where the delete lives.
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

      {/* The spine at the right edge, over the photographs and taking no room from them. */}
      <SpineLayer {...spine} />

      {/* Spec 7.1, detail 4 — the glass over the feed. In the feed it is «Назад», the memory's name
          and the way into picking; while picking it is the labels, what is marked, and the same
          button held in to leave. A memory with nothing in it has no select button at all: the
          right slot of `FramesEmpty` is empty, there being nothing to pick. */}
      <MemoryHead
        title={capsule}
        meta={under}
        // Read out in full either way: the drawn name is cut with an ellipsis, and a count on its
        // own does not say that pressing it takes everything.
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
              // `SheetLabels` (spec 7.7, TASK-213) — the boxes what is marked goes into. Nothing
              // marked is nothing to file, and the button says so by being off, the way the three
              // in the bottom layer do.
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

      {/* The bottom layer lies over the feed rather than beside it (spec 7.1): its gradient is what
          the last frames scroll under, and only the buttons on it catch a press. `box-none` so the
          space around them belongs to the feed underneath. */}
      <View
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(e) => setLayer(e.nativeEvent.layout.height)}
      >
        {/* Where «X of N» is read while the lot comes down, and the summary after it. The open file
            has its own copy of this line — only one of the two is ever on screen. */}
        {notice ? <Banner failure={notice} style={styles.notice} /> : null}

        {/* The layer in the two shapes this screen wears, and both are the layout's second kind: a
            round 56 at either end with the one action between them. Picking, they are «Поделиться»,
            «Скачать N» and «Удалить»; the rest of the time the filters, «Добавить ещё» and
            the arrangement. Whoever may only look keeps the two round buttons and has nothing
            between them.

            Off while busy in both shapes: sending a batch up while a batch is coming down is two
            errands over one connection, and neither errand must be started twice. What leaving the
            screen costs is handled by `onScreen`. */}
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
            // Spec 7.2 — the dangerous round one is glass with a `dangerText` glyph: red is the
            // colour of the word, not a fill under it. Off when nothing marked is this person's to
            // remove, which on somebody else's frames is every time.
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
            <Button
              variant="primary"
              wide
              icon={Download}
              // The count rides in the label — it is what the button is about to take home. With
              // nothing marked the button is off and says why: «Скачать 0» reads as a button
              // that would take nothing if only it worked.
              label={
                marked.length === 0 ? s.gallery.nothingPicked : s.gallery.download(marked.length)
              }
              onPress={() => void save()}
              disabled={busy || marked.length === 0}
            />
          </ActionBar>
        ) : any || mayUpload ? (
          <ActionBar
            footer="gallery"
            // Nothing brought yet is nothing to sift or to lay out, so `FramesEmpty` carries neither
            // button. The spark dot on either of them means the same thing: this one is no longer
            // at its default (spec 7.4).
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
                // One action in two places, and the only difference is whether there is anything
                // here yet (spec 9).
                label={any ? s.gallery.addMore : s.gallery.add}
                disabled={busy}
                // Straight to the picking, with «Мои кадры» laid under it: the plus promises to
                // add, and what was given is one «Назад» away (spec 8, `Upload`; 10.9, q. 10).
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

      {/* Both sheets are mounted by being opened, which is what seeds the filter's draft with
          whatever is applied right now. */}
      {tuning === 'filter' ? (
        <FilterSheet
          people={brought}
          labels={labels}
          days={days}
          value={filter}
          // Asked rather than told: the material is this screen's, and the sheet's own button has
          // to count what a draft would leave on screen before anybody applies it.
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

      {/* The labels of the memory over what is marked (spec 7.7). What comes back is a change to
          the records themselves — a box added to or taken off `label_ids` — so the feed keeps it
          the way it keeps a delete: in its own state, without a re-read. A fresh listing would not
          even carry it, since the quiet one deliberately keeps finished records where they are. */}
      {labelling ? (
        <LabelSheets
          memoryId={id}
          frames={marked}
          onFiled={(labelId, ids, now) => {
            wrote((have) => filed(have, labelId, ids, now));
            // A box that has gone — «ids null» is the whole feed losing it — takes itself out of the
            // filter as well (spec 10.8.2). Left in, it would be narrowing the feed to a label no
            // frame carries any more, with no chip anywhere to press it off again.
            if (ids === null) setFilter((have) => keepLabels(have, (one) => one !== labelId));
          }}
          // The row of boxes on the filter sheet is read again on the way out: this is the one place
          // a label is made, renamed, deleted or filled, and the row has to say so without the app
          // being restarted.
          onClose={() => {
            setLabelling(false);
            readLabels();
          }}
        />
      ) : null}

      {/* `SheetConfirmDelete` with a count (spec 8): the price is named as a number before the
          press, and the number is what will actually go — one frame is named the way the open frame
          names it, several are counted. A selection holding somebody else's frames says why fewer
          are going than were marked. */}
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

      {/* `Viewer` / `ViewerVideo`: one frame on the whole of the phone, and everything that can be
          done with it. Mounted by a frame being opened and gone with it — which is what starts a
          video playing and what hands the phone back to portrait on the way out. The material stays
          this screen's: the window is told when a record goes. */}
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
        />
      )}
    </>
  );
}

// No colour of its own on this screen: the ink behind it belongs to the route around it
// (`app/memory/[id].tsx`), and everything else on it is a kit component drawing itself. The open
// frame is a dark room and says so in its own file (`frame-viewer.tsx`).
const useStyles = themed(() =>
  StyleSheet.create({
    /**
     * The feed: three columns running the whole width of the phone, a 2px gutter between the frames
     * and no margins at all, so the material reads as a wall of it (spec 7.8). The column itself is
     * measured out above — the row only holds the gutters between them.
     */
    feed: { flexGrow: 1, gap: FEED_GAP },
    // An empty state stands in the middle of the body rather than at the top of nothing, and keeps
    // the screen's own margins, which the feed does not have.
    feedEmpty: { justifyContent: 'center', paddingHorizontal: space.s4 },
    feedRow: { flexDirection: 'row', gap: FEED_GAP },
    // A seam takes the place of the gutter on each side of it rather than standing between two
    // (spec detail 65, `MemoryDated`): the row over it ends on its top edge, the next starts on its
    // bottom one.
    seam: { marginVertical: -FEED_GAP },
    // Spec 8: 22 between the films and the heading over the material, 10 down to the first row.
    framesHead: { marginTop: 22, marginBottom: 10 },
    // The bottom layer stands over the feed and takes no room from it: the gradient inside it is
    // what the last frames pass under.
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    notice: { marginHorizontal: space.s4, marginTop: space.s3 },
    // Where the one action of the screen would stand for somebody who may add to it.
    grow: { flex: 1 },
  }),
);
