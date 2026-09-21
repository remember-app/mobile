import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { ArrowUpDown, Download, Funnel, ImageIcon, Plus, SquareCheckBig } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
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
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
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
  DayMark,
  Empty,
  IconButton,
  GRID_GAP,
  Text,
  Tile,
  Waiting,
} from '@/kit';
import { useStrings } from '@/language';
import { FrameViewer } from '@/memory/frame-viewer';
import { FilterSheet, SortSheet } from '@/memory/frames-sheets';
import { MemoryHead, type Head } from '@/memory/head';
import { board, height, space, themed, useTheme } from '@/theme';

/**
 * How long the face waits before looking again while the worker is still making something. A
 * thumbnail takes it seconds, so this is about the time somebody spends noticing the sheet is not
 * finished yet.
 */
const WHILE_PREPARING_MS = 3000;

/** One line of the contact sheet: a heading, or up to three of the frames standing under it. */
type Row =
  | { key: string; group: FrameGroup; frames?: undefined }
  | { key: string; frames: MediaItem[]; group?: undefined };

/** Which of the two sheets the gallery is being tuned from, if either. */
type Tuning = 'filter' | 'sort';

/**
 * The first face of a memory — `MemoryFrames` in the layout: what everybody put in, as everybody
 * sees it, a viewer included (doc-01, «Проверка прав»). The body is the contact sheet, three frames
 * to a row over a heading that says what the row under it has in common; the bottom layer is the
 * layout's second kind — the one action of the screen between two round buttons, filters on the
 * left and the arrangement on the right (spec 7.1).
 *
 * The same sheet in the layout's other three states, and this one face draws all four: `FramesEmpty`
 * when nothing has been brought yet, `FramesByPeople` when the arrangement is by whoever brought it,
 * `FramesPicking` while things are being marked to take home.
 *
 * Taking material home is picking it first: the one icon this appbar carries is the switch into that
 * mode and back out of it, and it is carried on this face alone. While the mode is on, a tap marks a
 * frame instead of opening it, the day's own count gives way to «Выбрать все N», and the footer is
 * the layout's third kind — «Выбрано 3» over «Скачать 3 файла».
 */
export function Frames({ id, head }: { id: string; head: Head }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  // The pull-to-refresh spinner is drawn by the platform and takes its colours as props.
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  /**
   * One column of the contact sheet, worked out rather than flexed. The sheet is three `1fr`
   * columns inside the screen's own 16, and a `1fr` column is the same width in a last row of one as
   * in a full row of three. `flex: 1/3` is not: it hands each frame a third of what the row has left
   * after its gaps, and a row with one frame in it has no gaps to leave — so the last frame of the
   * sheet came out wider than every frame above it, which is what the designer measured. Rotating
   * the phone re-reads the width.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - GRID_GAP * 2) / 3 };
  // null means «not loaded yet», the distinction the other faces draw: a reload after a delete
  // keeps the grid on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  /** Everybody in this memory: where the caller stands, the names over the groups and the frames. */
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** The record the viewer is showing, held by id so a reload hands it a fresh signed url. */
  const [open, setOpen] = useState<string | null>(null);
  /**
   * Whether the sheet is being picked from rather than looked at — the corner switch's own state.
   * It is what a tap on a frame means, what the footer's button is about, and nothing else.
   */
  const [picking, setPicking] = useState(false);
  /** What is marked for taking home, by record id — the same set the «Выбор кадров» screen keeps. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** What of the gallery is shown, and how it is laid out — the two sheets at the foot of it. */
  const [filter, setFilter] = useState<Filter>(FILTER_NONE);
  const [sort, setSort] = useState<Sort>(SORT_DEFAULT);
  const [tuning, setTuning] = useState<Tuning | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Whether this face is still the one the batch below is saving for. `busy` cannot answer that:
   * it lives in state that goes with the face, and «Download all» outlives it — `router.back()`, the
   * swipe, the hardware key and now the switch to another face all take this one down while the loop
   * is still going. Left alone, that loop keeps writing to the phone's gallery with nothing able to
   * stop it, and coming back gives a fresh face with `busy` false, so a second «Download all» runs on
   * top of the first and every file lands twice.
   */
  const onScreen = useRef(true);
  useEffect(() => () => {
    onScreen.current = false;
  }, []);

  const load = useCallback(
    // `quiet` belongs to the re-read below: that one happens on its own every few seconds, and it
    // must not light the pull-to-refresh spinner over a grid somebody is looking at, nor blank the
    // sheet back to «Loading…» on the one read that fails.
    (quiet = false) => {
      if (!token) return;
      if (!quiet) {
        setError(null);
        setLoading(true);
      }
      // The gallery carries neither a role nor a name, and this face needs both: who may delete
      // what, and who brought the frame that is open or the strip that is grouped by them. The
      // roster answers all of it in one read, the way the people face reads its own.
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
  // the worker's side, and the signed urls die in a quarter hour, so a face that read once when it
  // was first opened is showing whatever was true then. It runs on mount too, which is what reads
  // the material when this face is switched to.
  //
  // And the open frame is shut on the way out (TASK-94, extended here in review): leaving this face
  // without closing it — a tapped push, a deep link, anything that is not the cross, the delete or
  // the hardware key — left the frame standing on a window of its own over whatever screen came
  // next, because the memory stays mounted behind a `router.push`. Since TASK-124 it cost a second
  // thing as well: the window is what hands the app its freedom to turn, and nothing was giving it
  // back, so every screen after this one was left free to turn with the phone.
  //
  // The sheets are not in here: they are the kit's own `Sheet`, and since TASK-129 a sheet shuts
  // itself when the screen under it loses focus. The window is a `Modal` raised from this face and
  // which record it shows is this face's state, so it is this line that takes it down.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setOpen(null);
    }, [load]),
  );

  // And the same reason again with nobody navigating: a record turns `ready` while this face is
  // open and on screen, and until this loop existed nothing ever told it — the sheet stayed in
  // «Проявляем…» for as long as the person kept looking, which is exactly what they reported. Only
  // while something is actually being made, and only while this screen is the one in front:
  // «Add more» leaves the whole memory mounted behind it.
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

  // The caller's own standing, read off their row the way the people face reads it.
  const role = roster?.find((member) => member.id === user?.id)?.role ?? null;
  // Ownership and not role: a viewer may delete what they brought, a contributor may not delete a
  // neighbour's. The api is the authority — this only decides whether to draw the button.
  const mayDelete = (item: MediaItem) => item.uploaded_by === user?.id || role === 'organizer';
  // Material goes in during the event and long after the montage was made (doc-02); the only thing
  // in the way is the level, which is the same one the people face gates its invite on.
  const mayUpload = mayContribute(role);
  /**
   * The record the viewer is showing, if any. Held by id and looked up here, so a re-read hands the
   * open frame a freshly signed url and a record somebody else deleted takes its own window down.
   */
  const shown = items?.find((item) => item.id === open) ?? null;
  /** Whether anything has been brought at all — which is what tells `MemoryFrames` from `FramesEmpty`. */
  const any = items !== null && items.length > 0;

  /**
   * What is marked *and* still in the sheet. `picked` is only ever emptied by leaving the mode or
   * by «Снять», and the sheet moves underneath it on its own — the three-second re-read, the read
   * on focus, the pull. Somebody else deleting a marked frame left the button counting it: it said
   * «Скачать 3 файла», came back «Сохранено 0 файлов», and had signed the gallery to find that
   * out. The button says what it will actually take home by being asked the same question the
   * download is.
   */
  const marked = items?.filter((item) => picked.has(item.id)) ?? [];

  /** The gallery as the filter leaves it — what every count, every group and the strip are cut from. */
  const kept = useMemo(() => framesMatching(items ?? [], filter), [items, filter]);

  /**
   * The sheet as the layout lays it out: a heading, then the frames under it three to a row, then
   * the next heading. What the headings are about is the sort's business (`@/frames`); this only
   * flattens the groups into rows, because three to a row has to be cut by hand — `numColumns` lays
   * out the list underneath and cannot do it around the headings standing between the strips. The
   * «Выбор кадров» screen cuts the phone's own roll the same way, for the same reason.
   *
   * Held across renders: every tap on a frame is a render, and the whole sheet is re-cut here.
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
   * The same sheet, flat — the order the strip under an open frame walks along. The strip is the
   * contact sheet rolled into one row and has to read in the same direction it does, whichever way
   * that is: the api sends the oldest frame first, and by default the sheet is read newest day down,
   * so the tile at the top left of the grid was the one at the far end of a strip cut from `items`
   * (found in review, TASK-121). Both are cut from the same rows.
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

  /** Every day the gallery holds, newest first — the other row of chips on that sheet. */
  const days = useMemo(() => framesByDay(items ?? []).map((day) => day.at), [items]);

  /**
   * What a tile is called out loud: what it is, what has become of it, and whether it is the frame
   * the strip has open — «Видео», «Фото, Проявляем…», «Фото, открыто».
   *
   * Whether there is anything to say past the first word is the *frame's* question and not the
   * record's: `frameOf` turns a `ready` record with no derivative into the fallen frame, and that
   * tile drew «Показывать нечего» while announcing itself as a plain «Фото». The words themselves
   * are then the record's own, so a tile is read out in the line it is drawn with. One helper for
   * both sheets, so the strip and the grid cannot drift apart again.
   */
  // `current` and not `open`: `open` is this face's own state a few lines up — the id of the
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

  /** Tap to mark, tap again to unmark — the «Выбор кадров» screen's own gesture, same as sending. */
  const pick = (mediaId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(mediaId)) next.add(mediaId);
      return next;
    });

  /**
   * The group's own action, «Выбрать все 174» — and what it means is the strip it stands over,
   * never the whole sheet. It only ever adds: what is marked under another heading stays marked, and
   * the way anything leaves the selection is a second tap on it or the footer's «Снять». Handed the
   * markable frames rather than the group, so the button's count and the button's press cannot
   * disagree about what «все» is.
   */
  function pickDay(frames: readonly MediaItem[]) {
    setPicked((have) => new Set([...have, ...frames.map((item) => item.id)]));
  }

  /**
   * The corner switch, both ways. Leaving drops the marks — the layout says so («нажали ещё —
   * вышли, отметки сняты»), and a selection kept in the dark would come back on the next entry as
   * marks nobody made. Clearing on the way in costs nothing and says the same thing once.
   */
  function togglePicking() {
    setPicked(new Set());
    setPicking((on) => !on);
  }

  /** The grant, asked for at the moment it is needed, with this face's place to say «no». */
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(s.error.galleryRefused);
    return granted;
  }

  /**
   * What is marked, one file after another. One ask for all the links, then a save each — and a
   * file that will not come down is counted rather than fatal, because the person wanting several
   * of them wants the rest of them too. The count is the only progress there is: a save is atomic
   * here.
   */
  async function savePicked() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      // The whole-gallery route, cut down to what is marked. It signs a link for every record in the
      // memory to take a handful of them, which is what «скачать всё» has always cost and is why the
      // route exists at all.
      // ponytail: a link per marked record is the upgrade, and it would fix the expiry below too —
      // worth it the day a memory is big enough for the signing itself to be felt.
      const files = (await downloadAllMedia(token, id)).filter((file) => picked.has(file.id));
      let failed = 0;
      for (const [index, file] of files.entries()) {
        // Between files and not mid-file: whoever walked out of the gallery is not waiting on the
        // rest of it, and the one already coming down may as well land. What must not happen is
        // this going on unattended — see `onScreen`.
        if (!onScreen.current) return;
        setNotice(s.save.nth(index + 1, files.length));
        try {
          await saveToPhone(file);
        } catch {
          // ponytail: the links are signed in one go and live about fifteen minutes, so a gallery
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

  /** Whether anything at all stands at the foot of the screen — see the footer itself below. */
  const footer = picking || any || mayUpload;

  return (
    <>
      <MemoryHead
        {...head}
        right={
          // The one icon this appbar carries, and it is on this face alone: it is the switch into
          // picking, and picking is the only way anything is taken home from here. Everyone's, a
          // viewer included — what somebody who may only look is here for. Absent rather than greyed
          // while the sheet is empty or still arriving: `FramesEmpty` has no switch in its bar,
          // there being nothing to pick. Once the mode is on it stays, empty sheet or not: somebody
          // else can delete the last frame from under a picking that is already open, and the switch
          // is the only way out of it. Off while busy, so the mode cannot be walked out of from
          // under a download that is still running.
          picking || any ? (
            <IconButton
              icon={SquareCheckBig}
              label={picking ? s.gallery.leaveSelect : s.gallery.select}
              on={picking}
              onPress={togglePicking}
              disabled={busy}
            />
          ) : undefined
        }
      />

      {error !== null ? (
        <View style={styles.centered}>
          <Banner tone="error" text={error}>
            {/* Wrapped rather than handed `load` itself: a press hands its own argument along,
                and the first one here is «read quietly». */}
            <Button variant="quiet" size="xs" label={s.action.retry} onPress={() => load()} />
          </Banner>
        </View>
      ) : items === null ? (
        <View style={styles.centered}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            // An empty sheet is one block in the middle of the body; a full one starts at the top
            // and runs under the bottom layer, with room left at its tail for the layer's own
            // gradient — the sheet passes under that fade rather than stopping in a line above it.
            contentContainerStyle={[
              styles.grid,
              rows.length === 0 ? styles.gridEmpty : null,
              { paddingBottom: footer ? (picking ? board.footerTall : board.footer) : 0 },
            ]}
            // Still here, and mostly for the person who would rather not wait: a record turning
            // `ready` is answered by the re-read above on its own. Not the fifteen-minute links,
            // though — that read deliberately leaves a finished record's own url where it is
            // (`keepReady`), so on a face left open past the quarter hour a pull is the short way
            // to freshly signed ones, and the read on focus is the other.
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => load()}
                tintColor={color.accent}
                colors={[color.accent]}
                progressBackgroundColor={color.surface}
              />
            }
            // `FramesEmpty`: the dashed circle, what is missing, and what to do about it. The
            // action itself is in the bottom layer and not in here (spec 7.8).
            ListEmptyComponent={
              <Empty icon={ImageIcon} title={s.gallery.emptyTitle} text={s.gallery.empty} />
            }
            renderItem={({ item: row }) => {
              // The heading over its own strip (spec 7.7): what the frames under it have in common
              // at one edge, and at the other the one thing that belongs to that group — how many
              // frames it holds while the sheet is being looked at, «Выбрать все 174» while it is
              // being picked from.
              if (row.group) {
                const group = row.group;
                // What «все» is here: the frames a mark would actually mean something on, by the
                // very rule the single tap below is gated on. A group still being developed whole
                // has nothing to offer, so the action is off rather than counting to zero — the
                // same answer the footer gives to the same emptiness.
                const markable = group.frames.filter(mayPick);
                return (
                  <DayMark
                    {...headingOf(group)}
                    // The seam holds one count, and while the mode is on the whole band becomes
                    // the button that takes the group (spec 7.8) — «Выбрать все 174» is the band
                    // itself now, not a pill hanging off its right edge.
                    count={s.memory.frames(
                      picking ? markable.length : group.frames.length,
                    )}
                    onPress={
                      picking && markable.length > 0 ? () => pickDay(markable) : undefined
                    }
                    pressLabel={s.gallery.selectDay(markable.length)}
                  />
                );
              }
              return (
                <View style={styles.gridRow}>
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
                        // Spec 1.7 gives this direction to `spark`: the frame is already ours
                        // and is being taken home. Only while the mode is on and only where a mark
                        // means something: handed `undefined`, the tile is a button again rather
                        // than a checkbox that is permanently off.
                        pick={pickable ? (picked.has(item.id) ? 'keep' : 'off') : undefined}
                        // «Тап по кадру теперь не открывает его, а отмечает» — while the mode is on.
                        // Off it, the same gate the strip below puts on the same record, and for the
                        // same reason: a frame still being made has nothing behind it to open, so
                        // opening it lands on a whole screen saying «Проявляем…» — which is the
                        // third of the three reports that milestone came from. The layout agrees on
                        // both sheets: a waiting frame is not a button on the contact sheet any more
                        // than in the strip. A fallen one still opens — that is where the delete
                        // lives.
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

          {/* The bottom layer lies over the sheet rather than beside it (spec 7.1): its gradient is
              what the last frames of the sheet scroll under, and only the buttons on it catch a
              press. `box-none` so the space around them belongs to the sheet underneath. */}
          <View style={styles.bottom} pointerEvents="box-none">
            {/* Where «X of N» is read while the lot comes down, and the summary after it. The open
                file has its own copy of this line — only one of the two is ever on screen. Without
                a bottom layer under it, it carries the phone's own bottom inset itself. */}
            {notice ? (
              <Banner
                text={notice}
                style={
                  footer
                    ? styles.notice
                    : [styles.notice, { marginBottom: Math.max(insets.bottom, space.s4) }]
                }
              />
            ) : null}

            {/* The layer itself, in the two kinds this face wears. Picking, it is the layout's
                third: «Выбрано 3» and a quiet «Снять» over the one glowing button, «Скачать 3
                файла», and it is there for everybody — taking home is what somebody who may only
                look is here for. The rest of the time it is the layout's second: the filters at one
                end, the way the sheet is laid out at the other, and between them the single action
                of the screen — «Добавить ещё», or «Добавить кадры» where there is nothing yet to
                add to. Whoever may only look keeps the two round buttons and has no button between
                them.

                Off while busy in both shapes: sending a batch up while a batch is coming down is
                two errands over one connection and one progress line between them, and the download
                itself must not be started twice. What leaving the face costs is handled by
                `onScreen`. */}
            {picking ? (
              <ActionBar
                above={
                  <>
                    <Text role="label" style={styles.count}>
                      {s.gallery.picked(marked.length)}
                    </Text>
                    <Button
                      variant="quiet"
                      label={s.action.clear}
                      onPress={() => setPicked(new Set())}
                      disabled={busy || marked.length === 0}
                    />
                  </>
                }
              >
                <Button
                  variant="primary"
                  wide
                  icon={Download}
                  // The count rides in the label — it is what the button is about to take home.
                  // With nothing marked the button is off and says why: «Скачать 0 файлов» reads as
                  // a button that would take nothing if only it worked.
                  label={
                    marked.length === 0
                      ? s.gallery.nothingPicked
                      : s.gallery.download(marked.length)
                  }
                  onPress={() => void savePicked()}
                  disabled={busy || marked.length === 0}
                />
              </ActionBar>
            ) : any || mayUpload ? (
              <ActionBar>
                {/* Nothing brought yet is nothing to sift or to lay out, so `FramesEmpty` carries
                    neither button — «раскладывать нечего». The spark dot on either of them means
                    the same thing: this one is no longer at its default (spec 7.4). */}
                {any ? (
                  <IconButton
                    icon={Funnel}
                    label={s.gallery.filters}
                    size={height.round}
                    tone="surface"
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
                    // One action in two places, and the only difference is whether there is
                    // anything here yet (spec 9).
                    label={any ? s.gallery.addMore : s.gallery.add}
                    disabled={busy}
                    onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
                  />
                ) : (
                  // Whoever may only look still gets the two round buttons at the two ends they
                  // belong at, with nothing between them.
                  <View style={styles.grow} />
                )}
                {any ? (
                  <IconButton
                    icon={ArrowUpDown}
                    label={s.gallery.sorting}
                    size={height.round}
                    tone="surface"
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
              // Asked rather than told: the material is this face's, and the sheet's own button has
              // to count what a draft would leave on screen before anybody applies it.
              count={(draft) => framesMatching(items, draft).length}
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

          {/* `Viewer` / `ViewerVideo`: one frame on the whole of the phone, and everything that
              can be done with it. Mounted by a frame being opened and gone with it — which is what
              starts a video playing and what hands the phone back to portrait on the way out. The
              material stays this face's: the window is told when a record goes. */}
          {shown === null ? null : (
            <FrameViewer
              memoryId={id}
              item={shown}
              frames={sheet}
              roster={roster}
              memory={head.memory}
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
      )}
    </>
  );
}

// No colour of its own in the face: the ink behind it belongs to the screen around it
// (`app/memory/[id].tsx`), and everything else on it is a kit component drawing itself. The open
// frame is a dark room and says so in its own file (`frame-viewer.tsx`).
const useStyles = themed(() =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', padding: space.s4 },
    /**
     * The contact sheet: three columns inside the screen's own 16, a 3px gutter between the frames
     * and nothing else, so the material reads as a lot of it. The column itself is measured out
     * above — the row only holds the gutters between them. Between one strip and the next it is the
     * heading's own padding that opens the gap.
     */
    grid: { flexGrow: 1, gap: GRID_GAP, paddingHorizontal: space.s4 },
    gridEmpty: { justifyContent: 'center' },
    // The bottom layer stands over the sheet and takes no room from it: the gradient inside it is
    // what the sheet's last frames pass under.
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    // Its own row now, and not a `columnWrapperStyle`: the list is flat so the headings can stand
    // between the strips, which means the three across are laid out here.
    gridRow: { flexDirection: 'row', gap: GRID_GAP },
    notice: { marginHorizontal: space.s4, marginTop: space.s3 },
    // «Выбрано 3» takes the line and pushes the quiet «Снять» to the far end of it.
    count: { flex: 1, fontVariant: ['tabular-nums'] },
    // Where the one action of the screen would stand for somebody who may add to it.
    grow: { flex: 1 },
  }),
);
