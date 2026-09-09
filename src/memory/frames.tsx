import { Image } from 'expo-image';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Camera,
  Download,
  Plus,
  SquareCheckBig,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
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
  downloadMedia,
  errorMessage,
  listMedia,
  listMembers,
  mayContribute,
  type MediaItem,
  type Member,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
import {
  frameIndex,
  frameOf,
  framesByDay,
  keepReady,
  mayOpen,
  mayPick,
  openFrameOf,
  shotBy,
  stillPreparing,
  type Frame,
  type FrameDay,
} from '@/frames';
import {
  ActionBar,
  Banner,
  Button,
  ConfirmSheet,
  DayMark,
  Empty,
  IconButton,
  RailH,
  SHEET_GAP,
  Text,
  Tile,
} from '@/kit';
import { useStrings } from '@/language';
import { MemoryHead, type Head } from '@/memory/head';
import { useTurnsWithPhone } from '@/orientation';
import { onScrim, space, themed, themes, ThemePin, useTheme } from '@/theme';

/**
 * How long the face waits before looking again while the worker is still making something. A
 * thumbnail takes it seconds, so this is about the time somebody spends noticing the sheet is not
 * finished yet.
 */
const WHILE_PREPARING_MS = 3000;

/** The kit's filmstrip tile — 52px, and the contact sheet's own gutter after it. */
const STRIP_TILE = 52;
const STRIP_GAP = SHEET_GAP;

/** One line of the contact sheet: a day of the memory, or up to three of the frames shot on it. */
type Row =
  | { key: string; day: FrameDay; frames?: undefined }
  | { key: string; frames: MediaItem[]; day?: undefined };

/**
 * The first face of a memory (kit, «Экраны» 4): what everybody put in, as everybody sees it — a
 * viewer included (architecture.md, «Проверка прав»). The grid is the kit's contact sheet
 * (section 8); tapping one frame opens it on the whole screen, with its actions over it and the rest
 * of the gallery in a strip underneath to walk along («Кадр на весь экран»). A video plays its 720p
 * preview straight from R2 rather than downloading first. Only «Download» reaches past the
 * derivatives: the original as it was sent, saved into the phone's gallery, one file or the lot.
 *
 * Taking material home is picking it first: the one icon this appbar carries is the switch into the
 * picking mode and back out of it, and it is carried on this face alone. There is no separate
 * «скачать всю галерею» beside it — «это тот же выбор, только весь», and two icons about one thing
 * would push the memory's own name out of the bar (kit, «Экраны» 4, «Выбор»). While the mode is on,
 * a tap marks a frame instead of opening it and the footer's one button changes what it is about:
 * «Скачать 4 файла» where «Добавить кадры» stands the rest of the time.
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
   * One column of the contact sheet, worked out rather than flexed. The kit's sheet is three `1fr`
   * columns, and a `1fr` column is the same width in a last row of one as in a full row of three.
   * `flex: 1/3` is not: it hands each frame a third of what the row has left after its gaps, and a
   * row with one frame in it has no gaps to leave — so the last frame of the sheet came out 2pt
   * wider than every frame above it, which is what the designer measured. This sheet runs edge to
   * edge, so its row is as wide as the window, and rotating the phone re-reads that.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - SHEET_GAP * 2) / 3 };
  // null means «not loaded yet», the distinction the other faces draw: a reload after a delete
  // keeps the grid on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  /** Everybody in this memory: where the caller stands, and the name over every open frame. */
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
  /** Whether the delete sheet is up over the viewer. What it asks about is the open record. */
  const [confirming, setConfirming] = useState(false);
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
      // what, and who brought the frame that is open. The roster answers both in one read, the way
      // the people face reads its own — and it works however this screen was reached.
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
  // And the viewer is shut on the way out (TASK-94, extended here in review): leaving this face
  // without closing it — a tapped push, a deep link, anything that is not the cross, the delete or
  // the hardware key — left the frame standing on a window of its own over whatever screen came
  // next, because the memory stays mounted behind a `router.push`. Since TASK-124 it cost a second
  // thing: `useTurnsWithPhone` below follows the viewer and not the mount, so nothing cleaned it up
  // and every screen after this one was left free to turn with the phone.
  //
  // The delete confirmation is not in here: it is the kit's `ConfirmSheet`, and since TASK-129 a
  // sheet shuts itself when the screen under it loses focus. This window is a `Modal` of this
  // face's own and stays this face's business.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setOpen(null);
    }, [load]),
  );

  // And the same reason again with nobody navigating: a record turns `ready` while this face is
  // open and on screen, and until this loop existed nothing ever told it — the sheet stayed in
  // «Preparing…» for as long as the person kept looking, which is exactly what they reported. Only
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
  const shown = items?.find((item) => item.id === open) ?? null;

  // A frame shot sideways is worth turning the phone for. The `supportedOrientations` on the modal
  // below only says which ways up it may be drawn — this is what lets the app leave portrait at all.
  // Which is given back on the cleanup, so what has to be true is that the viewer is shut on every
  // way out of this face — the focus effect above is where that is done.
  useTurnsWithPhone(shown !== null);

  /**
   * The open record read for the whole of the phone and not for a tile: the big derivative, with
   * the grid's thumbnail behind it for a record that has none. The tiles keep `frameOf` — a
   * miniature is what a miniature is for.
   */
  const openFrame = shown === null ? null : openFrameOf(shown);
  /**
   * What is marked *and* still in the sheet. `picked` is only ever emptied by leaving the mode or
   * by «Снять», and the sheet moves underneath it on its own — the three-second re-read, the read
   * on focus, the pull. Somebody else deleting a marked frame left the button counting it: it said
   * «Скачать 3 файла», came back «Сохранено 0 файлов», and had signed the gallery to find that
   * out. The button says what it will actually take home by being asked the same question the
   * download is.
   */
  const marked = items?.filter((item) => picked.has(item.id)) ?? [];

  /**
   * The sheet as the kit lays it out: the day, then that day's frames three to a row, then the next
   * day — the newest day first («порядок: дни сверху вниз, свежий первый»). Flat, and three to a
   * row by hand, because that is what `numColumns` does to a list underneath and a list cannot do
   * it around the days standing between the strips. The «Выбор кадров» screen cuts the phone's own
   * roll the same way, for the same reason.
   *
   * Held across renders: every tap on a frame is a render, and the whole sheet is re-cut here.
   */
  const rows = useMemo(
    () =>
      framesByDay(items ?? []).flatMap((day): Row[] => [
        { key: `day-${day.at}`, day },
        ...Array.from({ length: Math.ceil(day.frames.length / 3) }, (_, i) => ({
          key: day.frames[i * 3].id,
          frames: day.frames.slice(i * 3, i * 3 + 3),
        })),
      ]),
    [items],
  );

  /**
   * The same sheet, flat — the order the strip under an open frame walks along. The strip is the
   * contact sheet rolled into one row and has to read in the same direction it does, which stopped
   * being `items` the moment the sheet was cut into days: the api sends the oldest frame first and
   * the sheet is read newest day down, so the tile at the top left of the grid was the one at the
   * far end of the strip, and walking the strip forward walked the sheet backwards (found in
   * review, TASK-121).
   */
  const sheet = useMemo(() => rows.flatMap((row) => row.frames ?? []), [rows]);

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

  /** Tap to mark, tap again to unmark — the «Выбор кадров» screen's own gesture, same as sending. */
  const pick = (mediaId: string) =>
    setPicked((have) => {
      const next = new Set(have);
      if (!next.delete(mediaId)) next.add(mediaId);
      return next;
    });

  /**
   * The day's own action, «Выбрать все 9» — and the day it means is the one on the strip it stands
   * over, never the whole sheet. It only ever adds: what is marked on another day stays marked, and
   * the way anything leaves the selection is a second tap on it or the footer's «Снять». Handed the
   * day's markable frames rather than the day, so the button's count and the button's press cannot
   * disagree about what «все» is.
   */
  function pickDay(frames: readonly MediaItem[]) {
    setPicked((have) => new Set([...have, ...frames.map((item) => item.id)]));
  }

  /**
   * The corner switch, both ways. Leaving drops the marks — the kit says so («нажали ещё — вышли,
   * отметки сняты»), and a selection kept in the dark would come back on the next entry as marks
   * nobody made. Clearing on the way in costs nothing and says the same thing once.
   */
  function togglePicking() {
    setPicked(new Set());
    setPicking((on) => !on);
  }

  async function remove(item: MediaItem) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteMedia(token, id, item.id);
    } catch (e) {
      // 404 is «it is already gone» — somebody else got there first, which is what was wanted
      // anyway. Everything else stays on screen with a reason.
      if (!(e instanceof ApiError && e.status === 404)) {
        setNotice(
          e instanceof ApiError && e.status === 403 ? s.gallery.deleteDenied : errorMessage(e),
        );
        return;
      }
    } finally {
      setBusy(false);
    }
    setItems((have) => have?.filter((one) => one.id !== item.id) ?? null);
    setOpen(null);
  }

  /** The grant, asked for at the moment it is needed, with this face's place to say «no». */
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(s.error.galleryRefused);
    return granted;
  }

  /** The open file, kept. The link is asked for here and not held: it dies in a quarter hour. */
  async function save(item: MediaItem) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      // The viewer's actions are icons, and an icon has no spinner in it — this line is where «it is
      // doing something» is said, and the next one replaces it with how it went.
      setNotice(s.save.one);
      const { url } = await downloadMedia(token, id, item.id);
      await saveToPhone({ id: item.id, kind: item.kind, url });
      setNotice(s.save.done);
    } catch (e) {
      // The api's own wording when it is the one refusing; past that it is the download or the
      // phone's gallery, and neither is worth blaming the api for.
      setNotice(e instanceof ApiError ? e.message : s.save.failedOne);
    } finally {
      setBusy(false);
    }
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

  return (
    <>
      <MemoryHead
        {...head}
        right={
          // The one icon the kit allows this appbar, and it is on this face alone: it is the switch
          // into picking, and picking is the only way anything is taken home from here. Everyone's,
          // a viewer included — what somebody who may only look is here for. Absent rather than
          // greyed while the sheet is empty or still arriving: «пустой галерее переключателя выбора
          // в шапке нет — выбирать нечего». Once the mode is on it stays, empty sheet or not:
          // somebody else can delete the last frame from under a picking that is already open, and
          // the switch is the only way out of it. Off while busy, so the mode cannot be walked out
          // of from under a download that is still running.
          picking || (items !== null && items.length > 0) ? (
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
            <Button variant="quiet" sm label={s.action.retry} onPress={() => load()} />
          </Banner>
        </View>
      ) : items === null ? (
        <View style={styles.centered}>
          <Empty busy text={s.state.loading} />
        </View>
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.grid}
            // Still here, and mostly for the person who would rather not wait: a record turning
            // `ready` is answered by the re-read above on its own. Not the fifteen-minute links,
            // though — that read deliberately leaves a finished record's own url where it is
            // (`keepReady`), so on a face left open past the quarter hour a pull is the short way
            // to freshly signed ones, and the read on focus is the other.
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => load()}
                tintColor={color.ember}
                colors={[color.ember]}
                progressBackgroundColor={color.surface}
              />
            }
            ListEmptyComponent={<Empty icon={Camera} text={s.gallery.empty} />}
            renderItem={({ item: row }) => {
              // The day over its own strip (kit, «Экраны» 4, «День»): the date in words at one edge,
              // and at the other the one thing that belongs to this day — how many frames it holds
              // while the sheet is being looked at, «Выбрать все 9» while it is being picked from.
              // The kit's own 16 comes back on this face: its sheet is bled to the edges of the
              // screen, and a daymark with no inset would stand off the edge of the frames it names.
              if (row.day) {
                // What «все» is on this day: the frames a mark would actually mean something on, by
                // the very rule the single tap below is gated on. A day still being developed whole
                // has nothing to offer, so the action is off rather than counting to zero — the same
                // answer the footer gives to the same emptiness.
                const markable = row.day.frames.filter(mayPick);
                return (
                  <DayMark style={styles.pad} label={formatDay(new Date(row.day.at))}>
                    {picking ? (
                      <Button
                        sm
                        variant="quiet"
                        label={s.gallery.selectDay(markable.length)}
                        disabled={markable.length === 0}
                        onPress={() => pickDay(markable)}
                      />
                    ) : (
                      // The memory's one word for its material — the word on the card and on the
                      // switch — counting a single day of it here.
                      <Text role="meta">{s.memory.frames(row.day.frames.length)}</Text>
                    )}
                  </DayMark>
                );
              }
              return (
                <View style={styles.gridRow}>
                  {row.frames.map((item) => {
                    // What a record is on screen is `@/frames` and not this line: the viewer below
                    // draws off the same reading, and the two must not drift.
                    const frame = frameOf(item);
                    // «Ждущие и упавшие кадры не отмечаются: скачивать нечего» — asked of `@/frames`
                    // so the day's own count above cannot come to a different answer than the tap.
                    const pickable = picking && mayPick(item);
                    return (
                      <Tile
                        key={item.id}
                        style={cell}
                        state={frame.state}
                        uri={frame.uri ?? undefined}
                        caption={s.gallery.waiting[item.status]}
                        // The kit marks a video by its length in the corner; a record that came
                        // without one still says what it is, in the same place.
                        length={
                          item.kind === 'video'
                            ? (formatRuntime(item.duration_seconds) ?? s.media.video)
                            : undefined
                        }
                        // Read out, never drawn — so it says «Photo» and not the api's own `photo`.
                        label={nameOf(item, frame)}
                        // The kit's one mark for a picked frame — the ember ring and the tick, the
                        // same as on «Выбор кадров». Only while the mode is on and only where a mark
                        // means something: handed `undefined`, the tile is a button again rather
                        // than a checkbox that is permanently off.
                        selected={pickable ? picked.has(item.id) : undefined}
                        // «Тап по кадру теперь не открывает его, а отмечает» — while the mode is on.
                        // Off it, the same gate the strip below puts on the same record, and for the
                        // same reason: a frame still being made has nothing behind it to open, so
                        // opening it lands on a whole screen saying «Preparing…» — which is the third
                        // of the three reports this milestone came from. The kit agrees on both
                        // sheets: a waiting frame is a `<span>` on the contact sheet as well as in
                        // the strip, never a `<button>`. A fallen one still opens — that is where
                        // the delete lives.
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

          <View style={styles.pad}>
            {/* Where «X of N» is read while the lot comes down, and the summary after it. The open
                file has its own copy of this line — only one of the two is ever on screen. Without a
                footer under it, it carries the phone's own bottom inset itself. */}
            {notice ? (
              <Banner
                text={notice}
                style={
                  mayUpload || picking
                    ? styles.notice
                    : { marginTop: space.s3, marginBottom: Math.max(insets.bottom, space.s4) }
                }
              />
            ) : null}
            {/* One button at the bottom, in the same place and the same weight either way — «меняется
                слово и дело». Picking, it is «Скачать 4 файла» over the kit's quiet «Снять», and it
                is there for everybody: «в режиме выбора подвал есть и у него — скачивать может
                каждый, кто видит» (kit, «Экраны» 4, «Края»). The rest of the time it is «Добавить
                кадры», gated on the level and on nothing else, and whoever may only look has no
                footer at all. Adding stays reachable at every other moment — it only steps aside for
                the seconds somebody is marking frames (TASK-108, уточнено человеком).

                Off while busy in both shapes: sending a batch up while a batch is coming down is two
                errands over one connection and one progress line between them, and the download
                itself must not be started twice. What leaving the face costs is handled by
                `onScreen`. */}
            {picking ? (
              <ActionBar>
                <Button
                  variant="quiet"
                  label={s.action.clear}
                  onPress={() => setPicked(new Set())}
                  disabled={busy || marked.length === 0}
                />
                <Button
                  variant="primary"
                  wide
                  // No glyph: the kit's «Скачать 4 файла» is words alone, where «Добавить кадры»
                  // carries one. The count rides in the label — it is what the button is about to
                  // take home. With nothing marked the button is off and says why: «Скачать 0
                  // файлов» reads as a button that would take nothing if only it worked.
                  label={
                    marked.length === 0
                      ? s.gallery.nothingPicked
                      : s.gallery.download(marked.length)
                  }
                  onPress={() => void savePicked()}
                  disabled={busy || marked.length === 0}
                />
              </ActionBar>
            ) : mayUpload ? (
              <ActionBar>
                <Button
                  variant="primary"
                  wide
                  icon={Plus}
                  label={s.gallery.addMore}
                  disabled={busy}
                  onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
                />
              </ActionBar>
            ) : null}
          </View>

          <Modal
            visible={shown !== null}
            animationType="fade"
            onRequestClose={() => setOpen(null)}
            // Landscape too: a video shot sideways is worth turning the phone for, and the rest of
            // the app is portrait-only.
            supportedOrientations={['portrait', 'landscape']}
          >
            {shown === null ? null : (
              <View style={styles.viewer}>
                {/* The room is pinned for everything the kit puts inside `.viewer`, not just for
                    the two backgrounds below: a tile, a banner and an `Empty` in here all read
                    `useTheme()`, and in daylight they would answer with the light set — a pale
                    frame around a photograph, which is the one thing block 0.2 forbids. The
                    confirm sheet is left out on purpose: the kit's `.confirm` is its own overlay
                    over the screen, not a child of the viewer. */}
                <ThemePin value="dark">
                  <View style={styles.frame}>
                    {shown.kind === 'video' && shown.preview_url !== null ? (
                      // Keyed by the record: walking from one video to the next along the strip
                      // mounts a fresh player on the new file, which is what starts it playing —
                      // the same component handed a new url would be a player already made.
                      <Playing key={shown.id} url={shown.preview_url} />
                    ) : openFrame !== null && openFrame.uri !== null ? (
                      // Whole and not cropped, the kit's `.viewer__frame img`: the frame is shown as
                      // it was shot even when that is not the shape of the phone, and what is left
                      // over at the sides is ink rather than a border.
                      //
                      // `expo-image` and not React Native's own, for the disk behind it: the same
                      // frame opened a second time should come off the phone rather than down the
                      // wire, and only this one keeps a disk at all. What it is filed under has to
                      // be said outright, though. The default key is the url, and the api signs a
                      // fresh one for the same bytes on every read of the gallery — a quarter of an
                      // hour each (`R2_DOWNLOAD_TTL_SECONDS`) — so a key made of the url is a fresh
                      // download every time the list is re-read. The record's id is the thing that
                      // does not move. Which derivative it is rides in the key as well: a photo
                      // whose big copy the worker has since made must not go on being served the
                      // thumbnail that was filed under the same id.
                      <Image
                        source={{
                          uri: openFrame.uri,
                          cacheKey: `${shown.id}:${openFrame.uri === shown.preview_url ? 'preview' : 'thumb'}`,
                        }}
                        style={styles.big}
                        contentFit="contain"
                      />
                    ) : (
                      // Nothing was ever made for this one. Said here as well as on the tile, because
                      // this is the screen the delete button is on — a failed record is one somebody
                      // may want rid of rather than looked at.
                      <View style={[styles.big, styles.blank]}>
                        <Empty icon={TriangleAlert} text={s.gallery.waiting[shown.status]} />
                      </View>
                    )}

                    {/* The kit's `.viewer__bar`: what can be done to the frame stands over it on a
                        darkening, not under it — «без кнопок снизу», which is what was asked for, and
                        what every phone's own gallery does. `box-none` so the darkening itself never
                        swallows a touch meant for the frame. */}
                    <View
                      style={[
                        styles.viewerBar,
                        {
                          paddingTop: insets.top + space.s2,
                          // The darkening lives here and not in the sheet because it is measured
                          // off the same inset the padding is. The kit's bar is 72px — `s2`, a
                          // 40px icon, `s6` — and its fade spends all 86% of itself over exactly
                          // that. This bar is that one with the phone's safe area added on top, so
                          // the kit's fade written the kit's way — two stops, no positions — is
                          // stretched over 131px on an iPhone with a notch, and most of it is
                          // spent on the strip behind the status bar where there is nothing to
                          // read. The name sits two thirds down instead of a third: .29 of ink
                          // under it where the kit draws .52, and a line already at 76% paper
                          // stops being readable over a bright frame. That is the report. Held at
                          // full strength to the end of the safe area and faded from there, what
                          // is under the row is the kit's own 72px fade on every phone, notch or
                          // no notch.
                          experimental_backgroundImage: `linear-gradient(rgba(20,17,15,.86), rgba(20,17,15,.86) ${insets.top}px, rgba(20,17,15,0))`,
                        },
                      ]}
                      pointerEvents="box-none"
                    >
                      <IconButton
                        icon={X}
                        label={s.action.close}
                        tint={onScrim}
                        onPress={() => setOpen(null)}
                        disabled={busy}
                      />
                      {/* `.viewer__who` — the person who brought this frame and the day of the
                          event, «Марина · 3 сентября». Not the file's own metadata: it used to say
                          the login of whoever uploaded it and the day the camera stamped the file,
                          which for anything sent out of an old album dated the event years wrong. */}
                      <Text role="meta" numberOfLines={1} style={styles.who}>
                        {shotBy(shown, roster, head.memory)}
                      </Text>
                      {/* Not gated on anything: a viewer may take home what they are looking at, and
                          the api says the same — the download route asks for membership and nothing
                          more. */}
                      <IconButton
                        icon={Download}
                        label={s.action.download}
                        tint={onScrim}
                        onPress={() => void save(shown)}
                        disabled={busy}
                      />
                      {mayDelete(shown) ? (
                        <IconButton
                          icon={Trash2}
                          label={s.action.delete}
                          tint={onScrim}
                          onPress={() => setConfirming(true)}
                          disabled={busy}
                        />
                      ) : null}
                    </View>

                    {notice ? <Banner text={notice} style={styles.viewerNotice} /> : null}
                  </View>

                  <Filmstrip
                    items={sheet}
                    open={shown.id}
                    onOpen={setOpen}
                    nameOf={nameOf}
                    bottom={Math.max(insets.bottom, space.s2)}
                  />
                </ThemePin>

                {/* Irreversible, and the api takes the bytes with it — worth one question first,
                    asked on the kit's sheet (section 13) and not by the system dialog. Inside the
                    viewer because that is the only place the delete is offered from, and a modal
                    over a modal has to be its child. */}
                <ConfirmSheet
                  visible={confirming}
                  title={s.gallery.deleteAsk(shown.kind)}
                  text={s.gallery.deleteText}
                  confirmLabel={s.action.delete}
                  cancelLabel={s.gallery.keep}
                  onConfirm={() => {
                    setConfirming(false);
                    void remove(shown);
                  }}
                  onCancel={() => setConfirming(false)}
                />
              </View>
            )}
          </Modal>
        </>
      )}
    </>
  );
}

/**
 * The kit's `.filmstrip`: the whole contact sheet rolled into one row, and the only thing under the
 * open frame. The same list the grid draws — no second read — with every frame dimmed but the open
 * one, and a tap along it changes which frame that is.
 *
 * Its own component because the walk below has to be its own. It is mounted by the viewer being
 * open and unmounted by it closing, so «once per opening» is what a ref born with it already says —
 * there is no latch to re-arm from the face above, and nothing above has to know when to.
 *
 * @param open the record the frame above is showing, which is the tile this strip stands on
 * @param bottom the phone's own bottom inset, so the strip clears the home indicator
 */
function Filmstrip({
  items,
  open,
  onOpen,
  nameOf,
  bottom,
}: {
  items: readonly MediaItem[];
  open: string;
  onOpen: (id: string) => void;
  /** What a tile is called out loud — the face's own answer, so both sheets read a record alike. */
  nameOf: (item: MediaItem, frame: Frame, current?: boolean) => string;
  bottom: number;
}) {
  const s = useStrings();
  const styles = useStyles();
  const strip = useRef<FlatList<MediaItem>>(null);
  /**
   * The width the strip was last walked at, and `null` until it has been walked at all. Not a
   * boolean, and that is the whole of the fix below.
   */
  const walkedAt = useRef<number | null>(null);

  return (
    <View style={[styles.filmstrip, { paddingBottom: bottom }]}>
      <RailH />
      <FlatList
        ref={strip}
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // A fixed tile and a fixed gutter, so the strip can be walked to any frame without
        // measuring anything: opening the fortieth frame from the grid must put the fortieth tile
        // under it, not the first.
        getItemLayout={(_, index) => ({
          length: STRIP_TILE,
          offset: (STRIP_TILE + STRIP_GAP) * index,
          index,
        })}
        // Walked to, not started at. `initialScrollIndex` reads like the prop for exactly this and
        // is what cost the strip its head: it does not merely position the row, it pins the render
        // window on the frame it names and holds it pinned until a scroll event arrives. A strip
        // whose frames all fit on screen has nothing to scroll, so that event never comes and the
        // window never widens — every frame before the open one stays a blank nothing can reach,
        // which is what was reported of a gallery of seven opened on its fifth (TASK-70).
        //
        // Once per width, and that is neither «once» nor «every time». `onContentSizeChange` used
        // to be where this hung, latched to fire a single time, and both halves of that were wrong
        // on a real phone (TASK-123):
        //
        // Unlatched it fires far too often — it is the scroll row's own `onLayout`, so it comes
        // back every time the row changes size, and the row changes size every time a frame lands.
        // On a live memory that is every few seconds while the queue is still sending and the
        // worker still developing, and each one hauled the strip back to the open frame from
        // wherever the person had scrolled it: a strip that reads as one that will not scroll, and
        // a tile that jumps out from under a finger between the press and the release never fires
        // its press, so one that will not open a frame either (TASK-106).
        //
        // Latched to fire once it fires at the wrong moment, and that is why the same two symptoms
        // came back off a real phone. An iOS modal is laid out twice. The first commit sizes the
        // whole modal from `ModalHostViewScreenSize()`, which is `RCTScreenSize()`, which swaps
        // width for height on `[[UIDevice currentDevice] orientation]` — the way the phone is
        // physically being held, not the way the app is allowed to draw. Somebody lying down and
        // tapping a photo hands this strip a viewport a whole screen wide; the real size only
        // arrives on the modal controller's `viewDidLayoutSubviews`, as a second commit. And the
        // content of a horizontal strip is `55n` wide however wide its viewport is — so the size of
        // the content never changes between those two commits, `onContentSizeChange` fires exactly
        // once, on the wrong one, and the walk it fired was clamped to nothing by a scroll view
        // that thought it had no scrolling to do. The latch then spent itself, and the strip stood
        // at its head for the rest of the opening with the open frame off the end of it. A
        // simulator has no accelerometer, so `UIDevice.orientation` is portrait there and the first
        // commit is already right — which is why this was only ever seen on a phone.
        //
        // `onLayout` is the event that actually says what went wrong: the strip's own viewport, the
        // thing the walk has to be clamped against. React Native hands it over after it has updated
        // the list's own `visibleLength` from it, so the walk runs against a strip that knows how
        // wide it is. Keyed on the width and not on a boolean, the walk happens again exactly when
        // the width it was computed for is no longer the width the strip has — the second commit,
        // and a rotation, and nothing else. A frame landing does not resize the strip, only its
        // content, so the strip stays where the finger left it and TASK-106's fix stands.
        onLayout={(e) => {
          const { width } = e.nativeEvent.layout;
          if (walkedAt.current === width) return;
          walkedAt.current = width;
          strip.current?.scrollToIndex({ index: frameIndex(items, open), animated: false });
        }}
        renderItem={({ item }) => {
          const frame = frameOf(item);
          const current = item.id === open;
          return (
            <Tile
              // The sheet's own tile, handed a width and a dimming — the kit's strip is the same
              // frame smaller and in shadow, with the open one lit and ringed in ember, the mark a
              // picked frame already wears. `filter: brightness` is the kit's spelling; over ink,
              // opacity is the same thing everywhere.
              style={[styles.stripTile, current ? null : styles.stripDim]}
              // The mark itself is the tile's, not this face's. It was a border here until the
              // designer measured it: a border is taken out of the tile's own 52px, so the open
              // frame — the one frame that must stand out — sat 4px smaller than its neighbours and
              // lost its picture to the ring. The kit draws it as a layer over the frame
              // (`.tile--current::after`).
              current={current}
              state={frame.state}
              uri={frame.uri ?? undefined}
              // No caption: at 52px there are no words to read, only the safelight.
              length={
                item.kind === 'video'
                  ? (formatRuntime(item.duration_seconds) ?? s.media.video)
                  : undefined
              }
              label={nameOf(item, frame, current)}
              // A frame still developing stays in the strip and stays shut: there is nothing behind
              // it to open yet.
              onPress={mayOpen(item) ? () => onOpen(item.id) : undefined}
            />
          );
        }}
      />
    </View>
  );
}

/**
 * The 720p preview, played where it lies: `expo-video` streams from the signed url and the file
 * was written with its index at the front, so playback starts before the whole thing is down
 * (architecture.md, «Видео в галерее»). Its own component because the player is a hook, and this
 * one is mounted only while a video is on screen — leaving it releases the player.
 *
 * It plays the moment it opens and wears the platform's own transport, which is what a phone's
 * gallery does with a video. The kit's `.viewer__play` is not missing from above: it stands on a
 * drawing that has no video in it to start, and there is nothing here for it to start.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  const styles = useStyles();
  return <VideoView player={player} style={styles.big} />;
}

/**
 * The open frame is a dark room in both themes — the kit pins `.viewer` to the dark set on purpose
 * (kit.html, block 0.2): «вокруг фотографии не должно быть ничего светлее её самой», or the mount
 * pulls the eye off the photograph. The filmstrip is inside the viewer in the kit's own markup and
 * inherits that pin, and so does the ember ring on the open frame; the kit demonstrates it with a
 * `data-theme="light"` figure holding a viewer that is still dark.
 *
 * The same rule `scrim` and `onScrim` are shared under, one step further out: this is the room the
 * photograph is looked at in, and it is not the interface around it. The face behind it is interface
 * and does turn with the theme.
 */
const room = themes.dark.color;

// No colour of its own left in here: the ink behind the face belongs to the screen around it
// (`app/memory/[id].tsx`), and everything else on it is a kit component drawing itself. Still a
// `themed` sheet rather than a module-scope one — the pinned room below is the only thing in it that
// has an opinion about the theme, and it says so by name.
const useStyles = themed(() =>
  StyleSheet.create({
    // The appbar and the bottom action stand off the edge; the sheet between them does not.
    pad: { paddingHorizontal: space.s4 },
    centered: { flex: 1, justifyContent: 'center', padding: space.s4 },
    // The kit's contact sheet: a 3px gutter and nothing else, so the material reads as a lot of it.
    // The column itself is measured out above — the row only holds the gutters between them.
    // Between one day's strip and the next it is the daymark's own padding that opens the gap.
    grid: { flexGrow: 1, gap: SHEET_GAP },
    // Its own row now, and not a `columnWrapperStyle`: the list is flat so the days can stand
    // between the strips, which means the three across are laid out here.
    gridRow: { flexDirection: 'row', gap: SHEET_GAP },
    notice: { marginTop: space.s3 },
    // The open frame is the whole screen: the frame takes what is left after the strip, and the bar
    // lies over it rather than beside it. `room` and not `color` from here down — see above.
    viewer: { flex: 1, backgroundColor: room.ink },
    frame: { flex: 1, justifyContent: 'center' },
    big: { flex: 1, width: '100%' },
    blank: { justifyContent: 'center' },
    viewerBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s2,
      paddingBottom: space.s6,
      // The darkening itself is not here: it is measured off the safe-area inset and so is written
      // where that inset is known, over the bar in the tree above. The same darkening in both
      // themes, and the icons on it are `onScrim` for the reason the kit gives — this lies on a
      // photograph, not on the interface, and has to read on snow and on a night sky alike.
      //
      // It is React Native's own gradient and not a library, and the `experimental_` in the name is
      // only a name: RN 0.86 carries the prop the whole way down — `ReactNativeStyleAttributes`
      // parses the CSS in JS, `BaseViewProps` reads that exact key in C++, and iOS draws it as a
      // `CAGradientLayer` in `RCTViewComponentView`. Nothing about it is quiet on a device, which is
      // why what came back from one was a fade in the wrong place rather than no fade at all.
    },
    // On the darkening and not on the screen, so it is `onScrim` softened, in both themes.
    who: { flex: 1, paddingLeft: space.s1, color: 'rgba(242,236,227,.76)' },
    // Over the frame and at the foot of it: the strip below must stay the only thing under it.
    viewerNotice: { position: 'absolute', left: space.s4, right: space.s4, bottom: space.s4 },
    filmstrip: { backgroundColor: room.ink },
    track: { gap: STRIP_GAP, paddingHorizontal: space.s2, paddingTop: space.s2 },
    stripTile: { width: STRIP_TILE },
    stripDim: { opacity: 0.42 },
  }),
);
