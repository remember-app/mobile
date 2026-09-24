import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
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
import {
  Animated,
  PanResponder,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadAllMedia,
  errorMessage,
  listLabels,
  listMedia,
  listMembers,
  mayContribute,
  memberName,
  type Label,
  type MediaItem,
  type Member,
} from '@/api';
import { useAuth } from '@/auth';
import {
  formatDayShort,
  formatDayTiny,
  formatEventDates,
  formatRuntime,
  formatWeekday,
} from '@/dates';
import { maySaveToPhone, saveToPhone, shareFile } from '@/downloads';
import {
  arranged,
  COLUMNS,
  dateMarks,
  FILTER_NONE,
  filtering,
  frameOf,
  framesByDay,
  framesMatching,
  groupFrames,
  keepLabels,
  keepReady,
  mayOpen,
  mayPick,
  megabytesOf,
  removeFrames,
  SORT_DEFAULT,
  stillPreparing,
  toggleEvery,
  type Filter,
  type Frame,
  type FrameGroup,
  type Sort,
} from '@/frames';
import {
  ActionBar,
  Banner,
  Button,
  ConfirmSheet,
  DateSpine,
  DayMark,
  Empty,
  EASE,
  FEED_GAP,
  IconButton,
  Tile,
  useReducedMotion,
  Waiting,
} from '@/kit';
import { filed } from '@/labels';
import { useStrings } from '@/language';
import { Films } from '@/memory/films';
import { FrameViewer } from '@/memory/frame-viewer';
import { FilterSheet, SortSheet } from '@/memory/frames-sheets';
import { LabelSheets } from '@/memory/label-sheets';
import { BlockHead, MemoryHead, type Head } from '@/memory/head';
import { board, duration, height, space, themed, useTheme } from '@/theme';

/**
 * How long the feed waits before looking again while the worker is still making something. A
 * thumbnail takes it seconds, so this is about the time somebody spends noticing the frame is not
 * finished yet.
 */
const WHILE_PREPARING_MS = 3000;

/** How long the date spine stands after the feed stops, before it goes (spec 6). */
const SPINE_HOLD_MS = 1000;

/**
 * How wide a strip of the right edge the spine answers a finger in. Wider than the hairline and the
 * pills it carries, narrower than a tap target: it is live only while the spine itself is visible,
 * and a strip as wide as a thumb would be swallowing flicks meant for the feed underneath.
 */
const SPINE_GRAB = 32;

/**
 * A pill on the spine is 16 tall and stands centred on the seam between two rows (spec 7.8, detail
 * 66): half a gutter above the row that opens the day, and half its own height above that. What
 * `dateMarks` hands over is where the row starts, so this is how far above it the pill's top edge
 * goes — without it the pill sits inside the first row of its day, 9 short of the layout.
 */
const SEAM_LIFT = FEED_GAP / 2 + 8;

/** A seam over a strip of frames — every cut but the one that has no seam at all. */
type Seam = Exclude<FrameGroup, { by: 'all' }>;

/** One line of the feed: a seam, or up to three of the frames standing under it. */
type Row =
  | { key: string; group: Seam; frames?: undefined }
  | { key: string; frames: MediaItem[]; group?: undefined };

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
  const { token, user } = useAuth();
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
  const { width, height: screen } = useWindowDimensions();
  const cell = { width: (width - FEED_GAP * 2) / 3 };
  // null means «not loaded yet», the distinction the montage block draws too: a reload after a
  // delete keeps the feed on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  /** Everybody in this memory: where the caller stands, the names over the groups and the frames. */
  const [roster, setRoster] = useState<Member[] | null>(null);
  /**
   * The boxes of this memory as this person may see them — the «ЛЕЙБЛЫ» row of the filter sheet
   * (spec 10.8.2). Nothing but that row is cut from them: which frames lie in a box is the frames'
   * own `label_ids`, and that comes down with the gallery.
   */
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The record the viewer is showing, held by id so a reload hands it a fresh signed url. */
  const [open, setOpen] = useState<string | null>(null);
  /**
   * Whether the feed is being picked from rather than looked at — the select button's own state.
   * It is what a tap on a frame means, what the bottom layer is about, and nothing else.
   */
  const [picking, setPicking] = useState(false);
  /** What is marked, by record id — the same set the «Ваши кадры» screen keeps. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** Whether the sheet that asks about deleting what is marked is up. */
  const [dropping, setDropping] = useState(false);
  /** And whether the labels of the memory are up over it (spec 7.7, `SheetLabels`). */
  const [labelling, setLabelling] = useState(false);
  /** What of the memory is shown, and how it is laid out — the two sheets at the foot of it. */
  const [filter, setFilter] = useState<Filter>(FILTER_NONE);
  const [sort, setSort] = useState<Sort>(SORT_DEFAULT);
  const [tuning, setTuning] = useState<Tuning | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Whether this screen is still the one the errand below is running for. `busy` cannot answer
   * that: it lives in state that goes with the screen, and saving or sharing an armful outlives it —
   * `router.back()`, the swipe and the hardware key all take this down while the loop is still
   * going. Left alone, that loop keeps writing to the phone's gallery with nothing able to stop it,
   * and coming back gives a fresh screen with `busy` false, so a second press runs on top of the
   * first and every file lands twice.
   */
  const onScreen = useRef(true);
  useEffect(() => () => {
    onScreen.current = false;
  }, []);
  /**
   * How many times this screen has written the feed itself — a frame deleted, a label filed. That
   * answer is newer than any quiet read already in flight, and such a read landing afterwards would
   * put the api's older snapshot back over it: the deleted frame would come back, and with nothing
   * left developing in that snapshot the loop below would stop and never read again. So a quiet read
   * carries the count it started under and drops its answer when that has moved (the films strip
   * keeps the same guard for the same reason).
   */
  const writes = useRef(0);

  /**
   * The date spine (spec 7.8, detail 66, and `MemoryScrub`). Four things are needed to draw it and
   * none of them is in the material: how far the list has been moved, how tall the block of films
   * over the frames came out, and how the whole of the feed compares to the screen it is being read
   * through — a feed shorter than the screen has no spine at all.
   *
   * The offset is an `Animated.Value` written straight from the scroll on the native side, and the
   * marks ride on it as one translated layer: they stand on the seams of the feed, so they have to
   * move exactly as the photographs do, and doing that through React state would be re-rendering
   * this whole screen sixty times a second.
   */
  const list = useRef<Animated.FlatList<Row>>(null);
  const scrolled = useRef(new Animated.Value(0)).current;
  const spineFade = useRef(new Animated.Value(0)).current;
  const [scrolling, setScrolling] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [feed, setFeed] = useState({ content: 0, view: 0 });
  const reduced = useReducedMotion();
  /** The timer that ends the spine's stay; null while it is not standing. */
  const stay = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Spec 6 — the spine proves while a finger is moving the feed and goes a second after it stops:
   * 120 coming, 400 going, and neither under «уменьшить движение», where it simply is or is not.
   * Every scroll event lands here, so the arrival is only played once a burst and the rest of the
   * burst just pushes the departure back.
   */
  const moving = useCallback(() => {
    const fade = (toValue: number, ms: number) =>
      Animated.timing(spineFade, {
        toValue,
        duration: reduced ? 0 : ms,
        easing: EASE,
        useNativeDriver: true,
      }).start();
    // The arrival, and the one re-render the whole burst costs: sixty events a second must not be
    // sixty dispatches at a screen holding a wall of photographs.
    if (stay.current === null) {
      fade(1, duration.spineIn);
      setScrolling(true);
    } else {
      clearTimeout(stay.current);
    }
    stay.current = setTimeout(() => {
      stay.current = null;
      setScrolling(false);
      fade(0, duration.spineOut);
    }, SPINE_HOLD_MS);
  }, [spineFade, reduced]);

  // The timer outlives the screen otherwise: it holds `setScrolling`, and a memory left while the
  // spine is still up would be writing state into a screen that has gone.
  useEffect(
    () => () => {
      if (stay.current !== null) clearTimeout(stay.current);
    },
    [],
  );

  const load = useCallback(
    // `quiet` belongs to the re-read below: that one happens on its own every few seconds, and it
    // must not light the pull-to-refresh spinner over a feed somebody is looking at, nor blank it
    // back to «Loading…» on the one read that fails.
    (quiet = false) => {
      if (!token) return;
      if (!quiet) {
        setError(null);
        setLoading(true);
      }
      // The listing carries neither a role nor a name, and this screen needs both: who may delete
      // what, and who brought the frame that is open or the strip that is grouped by them. The
      // roster answers all of it in one read.
      const startedAt = writes.current;
      Promise.all([listMedia(token, id), listMembers(token, id)])
        .then(
          ([media, members]) => {
            // Stale by the time it landed — see `writes`. A read somebody asked for is never stale.
            if (quiet && writes.current !== startedAt) return;
            // A quiet read is looking for what the worker has finished, and it must not disturb
            // what was already finished: `keepReady` holds every `ready` record's own object, so
            // the urls behind the frames on screen do not move and nothing is fetched twice.
            setItems((have) => (quiet ? keepReady(have, media) : media));
            setRoster(members);
            setError(null);
          },
          (e: unknown) => {
            if (!quiet) setError(errorMessage(e));
          },
        )
        .finally(() => {
          if (!quiet) setLoading(false);
        });
    },
    [token, id],
  );

  /**
   * The labels, read on their own rather than as a third hand in the listing above. Three reasons,
   * and each of them is why this is not in `load`: the quiet re-read runs every three seconds while
   * the worker is finishing something and a box does not move on its own; a labels read that will
   * not come back must not put an error over a feed that is perfectly fine — the row simply is not
   * offered; and this is read again at the one moment the boxes actually change, which is the labels
   * sheet closing over this very screen (spec 10.8.2: the row answers a box made, renamed, deleted
   * or filled without the app being restarted).
   */
  const loadLabels = useCallback(() => {
    if (!token) return;
    listLabels(token, id).then((all) => {
      setLabels(all);
      // A box somebody else deleted leaves the filter too, the way one deleted here does.
      setFilter((have) => keepLabels(have, (one) => all.some((label) => label.id === one)));
    }, () => {});
  }, [token, id]);

  // On focus rather than on mount, the way the home screen does it: what is drawn here changes on
  // the worker's side, and the signed urls die in a quarter hour, so a screen that read once when it
  // was first opened is showing whatever was true then.
  //
  // And the open frame is shut on the way out (TASK-94, extended in review): leaving without
  // closing it — a tapped push, a deep link, anything that is not the cross, the delete or the
  // hardware key — left the frame standing on a window of its own over whatever screen came next,
  // because the memory stays mounted behind a `router.push`. Since TASK-124 it cost a second thing
  // as well: the window is what hands the app its freedom to turn, and nothing was giving it back.
  //
  // The sheets are not in here: they are the kit's own `Sheet`, and since TASK-129 a sheet shuts
  // itself when the screen under it loses focus.
  useFocusEffect(
    useCallback(() => {
      load();
      loadLabels();
      return () => setOpen(null);
    }, [load, loadLabels]),
  );

  // And the same reason again with nobody navigating: a record turns `ready` while this screen is
  // open and in front, and until this loop existed nothing ever told it — the frame stayed in
  // «Проявляем…» for as long as the person kept looking, which is exactly what they reported. Only
  // while something is actually being made, and only while this screen is the one in front:
  // «Добавить ещё» leaves the whole memory mounted behind it.
  const preparing = stillPreparing(items);
  const focused = useIsFocused();
  useEffect(() => {
    if (!preparing || !focused) return;
    // An interval and not a timeout chained off each read: a single read that comes back on a bad
    // connection would end the chain, and it would end it silently — the quiet read is quiet about
    // failing too. This one keeps its own time and is cleared the moment there is nothing left
    // being made, the screen goes behind another, or it unmounts.
    const timer = setInterval(() => load(true), WHILE_PREPARING_MS);
    return () => clearInterval(timer);
  }, [preparing, focused, load]);

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
   * «Скачать 3 файла», came back «Сохранено 0 файлов», and had signed the gallery to find that out.
   * Every button counts what it will actually reach.
   */
  const marked = items?.filter((item) => picked.has(item.id)) ?? [];
  /** And of those, the ones this person is allowed to take out for good. */
  const deletable = marked.filter(mayDelete);

  /** The memory as the filter leaves it — what every count, every group and the strip are cut from. */
  const kept = useMemo(() => framesMatching(items ?? [], filter), [items, filter]);

  /**
   * The feed as the layout lays it out: a heading, then the frames under it three to a row, then
   * the next heading. What the headings are about is the sort's business (`@/frames`); this only
   * flattens the groups into rows, because three to a row has to be cut by hand — `numColumns` lays
   * out the list underneath and cannot do it around the headings standing between the strips. The
   * «Ваши кадры» screen cuts the phone's own roll the same way, for the same reason.
   *
   * Held across renders: every tap on a frame is a render, and the whole feed is re-cut here.
   */
  const rows = useMemo(
    () =>
      groupFrames(kept, sort).flatMap((group): Row[] => [
        // The wall has no seam over it at all (`MemoryFrames`, `MemoryScrub`): with the dates off
        // and nothing grouped, the days are read off the spine at the edge instead.
        ...(group.by === 'all' ? [] : [{ key: group.key, group }]),
        ...Array.from({ length: Math.ceil(group.frames.length / COLUMNS) }, (_, i) => ({
          key: group.frames[i * COLUMNS].id,
          frames: group.frames.slice(i * COLUMNS, i * COLUMNS + COLUMNS),
        })),
      ]),
    [kept, sort],
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
   * Where the first row of frames starts, in points down the list's own content: the top the feed
   * is pushed down by to clear the glass, the block of films over it as it actually came out, and
   * the one gutter between that block and the frames. Everything below rides a row's pitch — a
   * square tile and the gutter under it.
   */
  const feedTop = insets.top + height.roundViewer + space.s4 + headerHeight + FEED_GAP;
  const rowPitch = cell.width + FEED_GAP;
  /** How much of the feed is out of sight — nothing at all, on one shorter than the screen. */
  const reach = feed.content - feed.view;

  /**
   * The marks on the spine: one per day, on the seam between the two rows where that day begins
   * (spec 7.8). Only on the wall — cut into days, people or kinds, the seam itself says where a day
   * begins — and only when there is something to scroll: «лента короче экрана — стержня нет вовсе».
   */
  const spine = useMemo(
    () =>
      sort.by !== 'none' || sort.dates || headerHeight === 0 || reach <= 0
        ? []
        : dateMarks(sheet, { top: feedTop, row: rowPitch }).map((mark) => ({
            label: formatDayTiny(new Date(mark.at)),
            top: mark.top - SEAM_LIFT,
          })),
    [sort, sheet, headerHeight, reach, feedTop, rowPitch],
  );

  /** Where the strip the spine is grabbed by begins and how tall it is: between the two glasses. */
  const grabTop = insets.top + height.roundViewer;
  const grabSpan = Math.max(1, screen - board.footerGallery - grabTop);

  /**
   * Dragging the spine throws the feed (spec 7.8): where the finger stands on the strip is where the
   * feed stands in itself. It only answers touches that *begin* on the strip, and only while the
   * spine is visible — otherwise a flick along the right edge would stop being a flick halfway
   * through it.
   */
  const pan = useMemo(() => {
    const jump = (pageY: number) => {
      if (reach <= 0) return;
      const part = Math.min(1, Math.max(0, (pageY - grabTop) / grabSpan));
      list.current?.scrollToOffset({ offset: part * reach, animated: false });
      // A finger holding the spine still is holding the spine: the feed sends nothing while it
      // does not move, and the thing being held must not fade out from under it.
      moving();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => jump(e.nativeEvent.pageY),
      onPanResponderMove: (e) => jump(e.nativeEvent.pageY),
    });
  }, [reach, grabTop, grabSpan, moving]);

  /**
   * The scroll itself, hung once rather than rebuilt on every render: it carries a native animation
   * on one end and this screen's own fade on the other, and re-attaching it mid-flick is a dropped
   * frame under the finger.
   */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrolled } } }], {
        useNativeDriver: true,
        listener: moving,
      }),
    [scrolled, moving],
  );

  /** Everybody who actually brought something, for the chips the filter sheet offers. */
  const brought = useMemo(() => {
    const ids = [...new Set((items ?? []).map((item) => item.uploaded_by))];
    return ids.map((who) => ({
      id: who,
      name: memberName(roster?.find((member) => member.id === who) ?? null),
    }));
  }, [items, roster]);

  /**
   * Every day the memory holds, newest first, each with what it holds — the other row of chips on
   * that sheet, and the counts are of the whole memory rather than of what is on screen: a chip
   * says what pressing it would bring back, not what the filter has already left.
   */
  const days = useMemo(
    () => framesByDay(items ?? []).map((day) => ({ at: day.at, count: day.frames.length })),
    [items],
  );

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

  /** Tap to mark, tap again to unmark — the «Ваши кадры» screen's own gesture, same as sending. */
  const pick = (mediaId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(mediaId)) next.add(mediaId);
      return next;
    });

  /**
   * The group's own action, «Выбрать все 174» — and what it means is the strip it stands over,
   * never the whole feed. It only ever adds: what is marked under another heading stays marked, and
   * the way anything leaves the selection is a second tap on it or the capsule. Handed the markable
   * frames rather than the group, so the button's count and the button's press cannot disagree
   * about what «все» is.
   */
  function pickDay(frames: readonly MediaItem[]) {
    setPicked((have) => new Set([...have, ...frames.map((item) => item.id)]));
  }

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

  /** The grant, asked for at the moment it is needed, with this screen's place to say «no». */
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(s.error.galleryRefused);
    return granted;
  }

  /**
   * The links to the originals of what is marked. One ask for the lot rather than one per file,
   * which is what «скачать всё» has always cost and is why the route exists at all.
   *
   * ponytail: a link per marked record is the upgrade, and it would fix the expiry below too —
   * worth it the day a memory is big enough for the signing itself to be felt.
   */
  async function markedFiles(session: string) {
    return (await downloadAllMedia(session, id)).filter((file) => picked.has(file.id));
  }

  /**
   * What is marked, one file after another onto the phone. A file that will not come down is
   * counted rather than fatal, because the person wanting several of them wants the rest of them
   * too. The count is the only progress there is: a save is atomic here.
   */
  async function savePicked() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const files = await markedFiles(token);
      let failed = 0;
      for (const [index, file] of files.entries()) {
        // Between files and not mid-file: whoever walked out of the memory is not waiting on the
        // rest of it, and the one already coming down may as well land. What must not happen is
        // this going on unattended — see `onScreen`.
        if (!onScreen.current) return;
        setNotice(s.save.nth(index + 1, files.length));
        try {
          await saveToPhone(file);
        } catch {
          // ponytail: the links are signed in one go and live about fifteen minutes, so a selection
          // too big to save inside that window loses its tail to this counter. Re-signing per file
          // is the upgrade, and the summary already tells the person to tap again.
          failed += 1;
        }
      }
      setNotice(
        failed === 0 ? s.save.all(files.length) : s.save.some(files.length - failed, files.length),
      );
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : s.save.failedAll);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The same armful handed on instead of kept — the left button of the picking mode. Each file goes
   * out as a local copy and never as the link the api signed: that one dies in a quarter of an hour,
   * so whoever it reached would get a refusal instead of a photograph.
   *
   * ponytail: one system sheet per file, because `expo-sharing` takes one file per call — several
   * frames means several sheets, one after the other. A native share of many items is the upgrade;
   * until then this at least hands every marked frame on instead of silently dropping all but the
   * first.
   */
  async function sharePicked() {
    if (!token) return;
    setBusy(true);
    setNotice(s.viewer.sharing);
    try {
      for (const file of await markedFiles(token)) {
        if (!onScreen.current) return;
        await shareFile(file);
      }
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : s.viewer.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  /**
   * What is marked, out of the memory for good — and only what this person may take out: their own
   * frames, or anybody's if they are the organizer. The api refuses the rest, so the sheet counts
   * what will actually go and never promises the rest.
   *
   * Whatever did go leaves the feed even if the run stopped halfway: the records are gone on the
   * server, and a feed still drawing them would open windows onto nothing.
   */
  async function deletePicked() {
    if (!token) return;
    setDropping(false);
    setBusy(true);
    setNotice(null);
    // A frame somebody else already took out is gone all the same, and does not stop the run.
    const { gone, failure } = await removeFrames(
      deletable,
      (item) => deleteMedia(token, id, item.id),
      () => onScreen.current,
    );
    if (gone.size > 0) {
      writes.current += 1;
      setItems((have) => have?.filter((one) => !gone.has(one.id)) ?? null);
    }
    if (failure !== undefined) {
      setNotice(
        failure instanceof ApiError && failure.status === 403
          ? s.gallery.deleteDenied
          : errorMessage(failure),
      );
    }
    setBusy(false);
  }

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
        // What the spine is hung on: the offset goes to the native side, where the marks are moved
        // with the photographs, and the listener is what lights the thing and puts it out again.
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The two numbers that say whether there is anything to scroll at all, and how far a drag
        // on the spine reaches. Guarded, because a list writes both on every layout pass.
        onContentSizeChange={(_width, content) =>
          setFeed((was) => (was.content === content ? was : { ...was, content }))
        }
        onLayout={(e) => {
          const view = e.nativeEvent.layout.height;
          setFeed((was) => (was.view === view ? was : { ...was, view }));
        }}
        // The feed runs under the glass bar and under the bottom layer, and starts far enough down
        // for the block over it to clear the bar. An empty one is one block in the middle instead.
        contentContainerStyle={[
          styles.feed,
          { paddingTop: insets.top + height.roundViewer + space.s4 },
          rows.length === 0 ? styles.feedEmpty : null,
          { paddingBottom: board.footerGallery },
        ]}
        // Still here, and mostly for the person who would rather not wait: a record turning `ready`
        // is answered by the re-read above on its own. Not the fifteen-minute links, though — that
        // read deliberately leaves a finished record's own url where it is (`keepReady`), so on a
        // screen left open past the quarter hour a pull is the short way to freshly signed ones.
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => load()}
            tintColor={color.accent}
            colors={[color.accent]}
            progressBackgroundColor={color.surface}
          />
        }
        // The head of the feed (spec 8): the films first — the thing the whole memory is being
        // filled up for — and under them the material itself, named and counted. Neither is drawn
        // over `FramesEmpty`: with nothing brought there is no film to cut and nothing to count.
        ListHeaderComponent={
          any ? (
            // Measured rather than reckoned: the films are a block whose height is its own business
            // — a strip, an empty state, nothing at all while it reads — and the spine's marks are
            // counted from the first row of frames, which stands under it.
            <View
              onLayout={(e) => {
                const tall = e.nativeEvent.layout.height;
                setHeaderHeight((was) => (was === tall ? was : tall));
              }}
            >
              <Films id={id} memory={memory} />
              <BlockHead
                title={s.memory.framesPlain}
                count={s.memory.frames(kept.length)}
                style={styles.framesHead}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          error !== null ? (
            <Banner tone="error" text={error}>
              {/* Wrapped rather than handed `load` itself: a press hands its own argument along,
                  and the first one here is «read quietly». */}
              <Button variant="quiet" size="xs" label={s.action.retry} onPress={() => load()} />
            </Banner>
          ) : items === null ? (
            <Waiting text={s.state.loading} />
          ) : (
            // `FramesEmpty`: the dashed circle, what is missing, and what to do about it. The
            // action itself is in the bottom layer and not in here (spec 7.9).
            <Empty icon={ImageIcon} title={s.gallery.emptyTitle} text={s.gallery.empty} />
          )
        }
        renderItem={({ item: row }) => {
          // The seam over its own strip (spec 7.8): what the frames under it have in common at one
          // edge, and at the other the one thing that belongs to that group — how many frames it
          // holds while the feed is being looked at, «Выбрать все 174» while it is being picked
          // from. What decides whether a seam is drawn at all is the sort, and the dates on the
          // feed are their own task on this screen.
          if (row.group) {
            const group = row.group;
            // What «все» is here: the frames a mark would actually mean something on, by the very
            // rule the single tap below is gated on. A group still being developed whole has
            // nothing to offer, so the action is off rather than counting to zero.
            const markable = group.frames.filter(mayPick);
            return (
              <DayMark
                {...headingOf(group)}
                // The seam holds one figure and never a sentence (spec 7.8): how many that person
                // brought, and over a day nothing at all — `MemoryDated` writes the date alone.
                // While the mode is on every seam counts, because the whole band is then the button
                // that takes the group.
                count={
                  picking || group.by !== 'day'
                    ? String(picking ? markable.length : group.frames.length)
                    : undefined
                }
                onPress={picking && markable.length > 0 ? () => pickDay(markable) : undefined}
                pressLabel={s.gallery.selectDay(markable.length)}
              />
            );
          }
          return (
            <View style={styles.feedRow}>
              {row.frames.map((item) => {
                // What a record is on screen is `@/frames` and not this line: the viewer below
                // draws off the same reading, and the two must not drift.
                const frame = frameOf(item);
                // «Ждущие и упавшие кадры не отмечаются: скачивать нечего» — asked of `@/frames`
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
                    // Spec 1.7 gives this direction to `spark`: the frame is already ours and is
                    // being done something with. Only while the mode is on and only where a mark
                    // means something: handed `undefined`, the tile is a button again rather than
                    // a checkbox that is permanently off.
                    pick={pickable ? (picked.has(item.id) ? 'keep' : 'off') : undefined}
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

      {/* `MemoryScrub` — the spine at the right edge: a hairline with a pill on every seam where a
          day begins, proving while the feed is moving and gone a second after it stops. It lies
          over the photographs and takes no room from them, and it is not there at all when the
          dates are written between the days, when the feed is cut by people or by kind, or when
          there is less of it than a screen.

          The marks are moved by the scroll itself rather than by this screen re-rendering: they are
          drawn where the feed's own seams are, and translated by however far it has been moved. */}
      {spine.length === 0 ? null : (
        <Animated.View
          // Dead to a finger unless the spine can be seen: what is drawn at nought opacity is still
          // a thing in the way of the feed underneath.
          pointerEvents={scrolling ? 'box-none' : 'none'}
          style={[styles.spine, { opacity: spineFade }]}
        >
          <Animated.View
            style={[
              styles.spineFeed,
              { height: feed.content, transform: [{ translateY: Animated.multiply(scrolled, -1) }] },
            ]}
          >
            <DateSpine marks={spine} />
          </Animated.View>
          <View style={[styles.grab, { top: grabTop, height: grabSpan }]} {...pan.panHandlers} />
        </Animated.View>
      )}

      {/* Spec 7.1, detail 4 — the glass over the feed. In the feed it is «Назад», the memory's name
          and the way into picking; while picking it is the labels, what is marked, and the same
          button held in to leave. A memory with nothing in it has no select button at all: the
          right slot of `FramesEmpty` is empty, there being nothing to pick. */}
      <MemoryHead
        error={head.error}
        reload={head.reload}
        title={capsule}
        meta={under}
        // The capsule is a door in the feed and an action while picking, so only one of the two
        // wears the chevron (spec 7.1).
        chevron={!picking}
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
      />

      {/* The bottom layer lies over the feed rather than beside it (spec 7.1): its gradient is what
          the last frames scroll under, and only the buttons on it catch a press. `box-none` so the
          space around them belongs to the feed underneath. */}
      <View style={styles.bottom} pointerEvents="box-none">
        {/* Where «X of N» is read while the lot comes down, and the summary after it. The open file
            has its own copy of this line — only one of the two is ever on screen. */}
        {notice ? <Banner text={notice} style={styles.notice} /> : null}

        {/* The layer in the two shapes this screen wears, and both are the layout's second kind: a
            round 56 at either end with the one action between them. Picking, they are «Поделиться»,
            «Скачать N файлов» and «Удалить»; the rest of the time the filters, «Добавить ещё» and
            the arrangement. Whoever may only look keeps the two round buttons and has nothing
            between them.

            Off while busy in both shapes: sending a batch up while a batch is coming down is two
            errands over one connection, and neither errand must be started twice. What leaving the
            screen costs is handled by `onScreen`. */}
        {picking ? (
          <ActionBar footer="gallery">
            <IconButton
              icon={Share}
              tone="glass"
              size={height.round}
              label={s.action.share}
              onPress={() => void sharePicked()}
              disabled={busy || marked.length === 0}
            />
            <Button
              variant="primary"
              wide
              icon={Download}
              // The count rides in the label — it is what the button is about to take home. With
              // nothing marked the button is off and says why: «Скачать 0 файлов» reads as a button
              // that would take nothing if only it worked.
              label={
                marked.length === 0 ? s.gallery.nothingPicked : s.gallery.download(marked.length)
              }
              onPress={() => void savePicked()}
              disabled={busy || marked.length === 0}
            />
            {/* Spec 7.2 — the dangerous round one is glass with a `dangerText` glyph: red is the
                colour of the word, not a fill under it. Off when nothing marked is this person's
                to remove, which on somebody else's frames is every time. */}
            <IconButton
              icon={Trash2}
              tone="glass"
              tint={color.dangerText}
              size={height.round}
              label={s.action.delete}
              onPress={() => setDropping(true)}
              disabled={busy || deletable.length === 0}
            />
          </ActionBar>
        ) : any || mayUpload ? (
          <ActionBar footer="gallery">
            {/* Nothing brought yet is nothing to sift or to lay out, so `FramesEmpty` carries
                neither button. The spark dot on either of them means the same thing: this one is
                no longer at its default (spec 7.4). */}
            {any ? (
              <IconButton
                icon={Funnel}
                label={s.gallery.filters}
                size={height.round}
                tone="glass"
                dot={filtering(filter)}
                onPress={() => setTuning('filter')}
                disabled={busy}
              />
            ) : null}
            {mayUpload ? (
              <Button
                variant="primary"
                wide
                icon={Plus}
                // One action in two places, and the only difference is whether there is anything
                // here yet (spec 9).
                label={any ? s.gallery.addMore : s.gallery.add}
                disabled={busy}
                onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
              />
            ) : (
              <View style={styles.grow} />
            )}
            {any ? (
              <IconButton
                icon={ArrowUpDown}
                label={s.gallery.sorting}
                size={height.round}
                tone="glass"
                dot={arranged(sort)}
                onPress={() => setTuning('sort')}
                disabled={busy}
              />
            ) : null}
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
            writes.current += 1;
            setItems((have) => filed(have, labelId, ids, now));
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
            loadLabels();
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
        onConfirm={() => void deletePicked()}
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
            writes.current += 1;
            setItems((have) => have?.filter((one) => one.id !== gone) ?? null);
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
    // Spec 8: 22 between the films and the heading over the material, 10 down to the first row.
    framesHead: { marginTop: 22, marginBottom: 10 },
    // The bottom layer stands over the feed and takes no room from it: the gradient inside it is
    // what the last frames pass under.
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    // The spine's own layer: the whole screen, so the hairline runs its full height (spec 7.8).
    spine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    // And inside it the feed's own coordinates — as tall as everything there is to scroll, moved
    // up by however much of it has been. The line and the marks live in here together, so both
    // stand still against the photographs instead of against the phone.
    spineFeed: { position: 'absolute', top: 0, left: 0, right: 0 },
    // Where a finger takes hold of it: the right edge between the two glasses, drawn by nothing.
    grab: { position: 'absolute', right: 0, width: SPINE_GRAB },
    notice: { marginHorizontal: space.s4, marginTop: space.s3 },
    // Where the one action of the screen would stand for somebody who may add to it.
    grow: { flex: 1 },
  }),
);
