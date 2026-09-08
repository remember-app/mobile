import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, Download, Plus, Trash2, TriangleAlert, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
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
import { formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
import { frameIndex, frameOf, mayOpen, shotBy, stillPreparing, type Frame } from '@/frames';
import {
  ActionBar,
  Banner,
  Button,
  ConfirmSheet,
  Empty,
  IconButton,
  RailH,
  SHEET_GAP,
  Text,
  Tile,
} from '@/kit';
import { useStrings } from '@/language';
import { MemoryHead, type Head } from '@/memory/head';
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

/**
 * The first face of a memory (kit, «Экраны» 4): what everybody put in, as everybody sees it — a
 * viewer included (architecture.md, «Проверка прав»). The grid is the kit's contact sheet
 * (section 8); tapping one frame opens it on the whole screen, with its actions over it and the rest
 * of the gallery in a strip underneath to walk along («Кадр на весь экран»). A video plays its 720p
 * preview straight from R2 rather than downloading first. Only «Download» reaches past the
 * derivatives: the original as it was sent, saved into the phone's gallery, one file or the lot.
 *
 * The lot of them is the one icon this memory's appbar carries, and it is carried on this face
 * alone — the kit puts «Скачать всю галерею» in the corner and leaves «Добавить кадры» the whole of
 * the footer.
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
  /** The filmstrip, so it can be walked to the open frame once it knows how wide it is. */
  const strip = useRef<FlatList<MediaItem>>(null);
  /**
   * Whether the strip has already been walked to the frame that is open. The walk itself is down
   * in the strip and carries the long version of why this exists; the short one is that
   * «once the content is laid out» and «every time the content is laid out» are the same callback
   * in React Native, and only the first of them was ever wanted.
   */
  const walked = useRef(false);
  // Re-armed by opening another frame and by nothing else — so the strip walks once per opening,
  // the second opening of the same frame included, and never because the gallery grew underneath.
  useEffect(() => {
    walked.current = false;
  }, [open]);

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
            setItems(media);
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
  useFocusEffect(load);

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
  /** The open record read the way the grid reads it — one answer, two places drawing it. */
  const openFrame = shown === null ? null : frameOf(shown);

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
   * The whole gallery, one file after another. One ask for all the links, then a save each — and a
   * file that will not come down is counted rather than fatal, because the person wanting all of
   * it wants the rest of it too. The count is the only progress there is: a save is atomic here.
   */
  async function saveEverything() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const files = await downloadAllMedia(token, id);
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
          // The one icon the kit allows this appbar, and it is on this face alone: taking the whole
          // memory home is about the sheet under it and about nothing else. It used to be a second
          // wide button in the footer beside «Добавить кадры» — two glowing-sized actions where the
          // kit draws one (kit, «Экраны» 4). Everyone's, a viewer included: what somebody who may
          // only look is here for. Off while busy, and while there is nothing to take.
          <IconButton
            icon={Download}
            label={s.gallery.downloadAll}
            onPress={() => void saveEverything()}
            disabled={busy || items === null || items.length === 0}
          />
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
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            // Still here, and now only for the person who would rather not wait: the re-read above
            // already answers both the fifteen-minute links and a record turning `ready`.
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
            renderItem={({ item }) => {
              // What a record is on screen is `@/frames` and not this line: the viewer below draws
              // off the same reading, and the two must not drift.
              const frame = frameOf(item);
              return (
                <Tile
                  style={cell}
                  state={frame.state}
                  uri={frame.uri ?? undefined}
                  caption={s.gallery.waiting[item.status]}
                  // The kit marks a video by its length in the corner; a record that came without
                  // one still says what it is, in the same place.
                  length={
                    item.kind === 'video'
                      ? (formatRuntime(item.duration_seconds) ?? s.media.video)
                      : undefined
                  }
                  // Read out, never drawn — so it says «Photo» and not the api's own `photo`.
                  label={nameOf(item, frame)}
                  // The same gate the strip below puts on the same record, and for the same
                  // reason: a frame still being made has nothing behind it to open, so opening it
                  // lands on a whole screen saying «Preparing…» — which is the third of the three
                  // reports this milestone came from. The kit agrees on both sheets: a waiting
                  // frame is a `<span>` on the contact sheet as well as in the strip, never a
                  // `<button>`. A fallen one still opens — that is where the delete lives.
                  onPress={mayOpen(item) ? () => setOpen(item.id) : undefined}
                />
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
                  mayUpload
                    ? styles.notice
                    : { marginTop: space.s3, marginBottom: Math.max(insets.bottom, space.s4) }
                }
              />
            ) : null}
            {/* The kit leaves this face one footer button, and «Скачать всё» went to the corner
                above to make room for it. «Добавить кадры», gated on the level and on nothing else
                — whoever may only look has no footer at all (kit, «Экраны» 4, «Края»).
                Off while busy, like everything else here: this one only pushes a screen in front
                (the memory stays mounted and keeps its summary), but sending a batch up while a
                batch is coming down is two errands over one connection and one progress line
                between them. What the departure itself costs is handled by `onScreen`. */}
            {mayUpload ? (
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
                      <Image
                        source={{ uri: openFrame.uri }}
                        style={styles.big}
                        resizeMode="contain"
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
                      style={[styles.viewerBar, { paddingTop: insets.top + space.s2 }]}
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

                  {/* The kit's `.filmstrip`: the whole contact sheet rolled into one row, and the
                      only thing under the frame. The same list the grid draws — no second read —
                      with every frame dimmed but the open one. */}
                  <View
                    style={[styles.filmstrip, { paddingBottom: Math.max(insets.bottom, space.s2) }]}
                  >
                    <RailH />
                    <FlatList
                      ref={strip}
                      horizontal
                      data={items}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.track}
                      // A fixed tile and a fixed gutter, so the strip can be walked to any frame
                      // without measuring anything: opening the fortieth frame from the grid must
                      // put the fortieth tile under it, not the first.
                      getItemLayout={(_, index) => ({
                        length: STRIP_TILE,
                        offset: (STRIP_TILE + STRIP_GAP) * index,
                        index,
                      })}
                      // Walked to, not started at. `initialScrollIndex` reads like the prop for
                      // exactly this and is what cost the strip its head: it does not merely position
                      // the row, it pins the render window on the frame it names and holds it pinned
                      // until a scroll event arrives. A strip whose frames all fit on screen has
                      // nothing to scroll, so that event never comes and the window never widens —
                      // every frame before the open one stays a blank nothing can reach, which is
                      // what was reported of a gallery of seven opened on its fifth. Asking for the
                      // same position once the content is laid out leaves the window alone: the whole
                      // gallery is in the strip from the first frame on, and scrolling reaches it all.
                      //
                      // Once, though, and the latch is what says so. `onContentSizeChange` reads
                      // like «when the content has been laid out» and is really «whenever the
                      // content is laid out»: React Native gives the scroll row its own `onLayout`
                      // and calls this from it, so it comes back every time that row changes size —
                      // and the row changes size whenever a frame lands, which on a live memory is
                      // every few seconds, while the upload queue is still sending and the worker
                      // still developing what it sent. Unlatched, each of those hauled the strip
                      // back to the open frame from wherever the person had scrolled it: the strip
                      // reads as one that will not scroll, and a tile that jumps out from under a
                      // finger between the press and the release never fires its press, so it reads
                      // as one that will not open a frame either — both of the things reported off a
                      // real phone (TASK-106). A settled gallery on a simulator never grows, which
                      // is why neither was ever seen there. React Native runs this same
                      // `scrollToIndex` from this same place for `initialScrollIndex`, behind
                      // exactly this latch (`_hasTriggeredInitialScrollToIndex`); it is the half of
                      // that prop worth having, and the frozen render window above is the half that
                      // is not.
                      onContentSizeChange={() => {
                        if (walked.current) return;
                        walked.current = true;
                        strip.current?.scrollToIndex({
                          index: frameIndex(items, open),
                          animated: false,
                        });
                      }}
                      renderItem={({ item }) => {
                        const frame = frameOf(item);
                        const current = item.id === shown.id;
                        return (
                          <Tile
                            // The sheet's own tile, handed a width and a dimming — the kit's strip is
                            // the same frame smaller and in shadow, with the open one lit and ringed
                            // in ember, the mark a picked frame already wears. `filter: brightness`
                            // is the kit's spelling; over ink, opacity is the same thing everywhere.
                            style={[styles.stripTile, current ? null : styles.stripDim]}
                            // The mark itself is the tile's, not this face's. It was a border here
                            // until the designer measured it: a border is taken out of the tile's own
                            // 52px, so the open frame — the one frame that must stand out — sat 4px
                            // smaller than its neighbours and lost its picture to the ring. The kit
                            // draws it as a layer over the frame (`.tile--current::after`).
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
                            // A frame still developing stays in the strip and stays shut: there is
                            // nothing behind it to open yet.
                            onPress={mayOpen(item) ? () => setOpen(item.id) : undefined}
                          />
                        );
                      }}
                    />
                  </View>
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
    grid: { flexGrow: 1, gap: SHEET_GAP },
    gridRow: { gap: SHEET_GAP },
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
      // The kit's own gradient, written the way React Native takes one — no library for a
      // background. It fades to nothing so the frame is never cut in half by an edge. The same
      // darkening in both themes, and the icons over it are `onScrim` for the same reason the kit
      // gives: this lies on a photograph, not on the interface, and has to read on snow and on a
      // night sky alike.
      // ponytail: the property is still `experimental_` in RN 0.86. Renamed or dropped, it goes
      // quiet — the icons stay paper-white but lose their darkening over a bright frame; the upgrade
      // is the settled name, or `expo-linear-gradient` if it never settles.
      experimental_backgroundImage: 'linear-gradient(rgba(20,17,15,.86), rgba(20,17,15,0))',
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
