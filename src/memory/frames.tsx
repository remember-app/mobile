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
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  deleteMedia,
  downloadAllMedia,
  errorMessage,
  listMedia,
  listMembers,
  mayContribute,
  memberName,
  type MediaItem,
  type Member,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatEventDates, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone, shareFile } from '@/downloads';
import {
  arranged,
  FILTER_NONE,
  filtering,
  frameOf,
  framesByDay,
  framesMatching,
  groupFrames,
  keepReady,
  mayOpen,
  mayPick,
  megabytesOf,
  SORT_DEFAULT,
  stillPreparing,
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
  DayMark,
  Empty,
  FEED_GAP,
  IconButton,
  Tile,
  Waiting,
} from '@/kit';
import { useStrings } from '@/language';
import { Films } from '@/memory/films';
import { FrameViewer } from '@/memory/frame-viewer';
import { FilterSheet, SortSheet } from '@/memory/frames-sheets';
import { BlockHead, MemoryHead, type Head } from '@/memory/head';
import { board, height, space, themed, useTheme } from '@/theme';

/**
 * How long the feed waits before looking again while the worker is still making something. A
 * thumbnail takes it seconds, so this is about the time somebody spends noticing the frame is not
 * finished yet.
 */
const WHILE_PREPARING_MS = 3000;

/** One line of the feed: a heading, or up to three of the frames standing under it. */
type Row =
  | { key: string; group: FrameGroup; frames?: undefined }
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
  const { width } = useWindowDimensions();
  const cell = { width: (width - FEED_GAP * 2) / 3 };
  // null means «not loaded yet», the distinction the montage block draws too: a reload after a
  // delete keeps the feed on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  /** Everybody in this memory: where the caller stands, the names over the groups and the frames. */
  const [roster, setRoster] = useState<Member[] | null>(null);
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
      Promise.all([listMedia(token, id), listMembers(token, id)])
        .then(
          ([media, members]) => {
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
      return () => setOpen(null);
    }, [load]),
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
        { key: group.key, group },
        ...Array.from({ length: Math.ceil(group.frames.length / 3) }, (_, i) => ({
          key: group.frames[i * 3].id,
          frames: group.frames.slice(i * 3, i * 3 + 3),
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

  /** Everybody who actually brought something, for the chips the filter sheet offers. */
  const brought = useMemo(() => {
    const ids = [...new Set((items ?? []).map((item) => item.uploaded_by))];
    return ids.map((who) => ({
      id: who,
      name: memberName(roster?.find((member) => member.id === who) ?? null),
    }));
  }, [items, roster]);

  /** Every day the memory holds, newest first — the other row of chips on that sheet. */
  const days = useMemo(() => framesByDay(items ?? []).map((day) => day.at), [items]);

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

  /** What stands at the two ends of a heading: the group said in words, and who it belongs to. */
  function headingOf(group: FrameGroup): { label: string; avatar?: string; organizer?: boolean } {
    if (group.by === 'day') return { label: formatDay(new Date(group.at)) };
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
    setPicked((have) =>
      have.size >= markable.length ? new Set() : new Set(markable.map((item) => item.id)),
    );
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
   * ponytail: one system sheet per file, because neither React Native's own `Share` nor
   * `expo-sharing` takes more than one attachment — several frames means several sheets, one after
   * the other. A native share of many items is the upgrade; until then this at least hands every
   * marked frame on instead of silently dropping all but the first.
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
    const gone = new Set<string>();
    try {
      for (const item of deletable) {
        if (!onScreen.current) break;
        await deleteMedia(token, id, item.id);
        gone.add(item.id);
      }
    } catch (e) {
      setNotice(
        e instanceof ApiError && e.status === 403 ? s.gallery.deleteDenied : errorMessage(e),
      );
    } finally {
      if (gone.size > 0) setItems((have) => have?.filter((one) => !gone.has(one.id)) ?? null);
      setBusy(false);
    }
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
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
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
            <View>
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
                // The seam holds one count, and while the mode is on the whole band becomes the
                // button that takes the group (spec 7.8).
                count={s.memory.frames(picking ? markable.length : group.frames.length)}
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
              // The sheet of labels is the labels milestone's (`SheetLabels`, spec 8) and lands
              // right here, on this button. Until it does there is nothing to open: an empty
              // sheet would be worse than a button that says it is not ready.
              disabled
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
    notice: { marginHorizontal: space.s4, marginTop: space.s3 },
    // Where the one action of the screen would stand for somebody who may add to it.
    grow: { flex: 1 },
  }),
);
