import { Lock, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Animated,
  PanResponder,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  editMedia,
  type FrameInfo,
  fetchFrameInfo,
  type Label,
  type MediaItem,
  memberName,
  removeLabelMedia,
} from '@/api';
import {
  Avatar,
  Banner,
  Chip,
  IconButton,
  RowEdit,
  RowFilmAt,
  RowSummary,
  ShotCells,
  Spinner,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatDayShort, formatRuntime, formatTime } from '@/lib/dates';
import { type Failure, failure } from '@/lib/failure';
import { frameFacts, shotCells } from '@/lib/frames';
import { usePlaceName } from '@/lib/geocoder';
import { letGo, SIDEWAYS } from '@/lib/gesture';
import { labelTint } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { FrameComments } from '@/screens/memory/frame-comments';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { ShotEditor } from '@/screens/mine/shot-editor';
import { board, height, radius, space, themed, useTheme } from '@/theme';

/**
 * `FrameInfo` — everything about the open frame that the picture itself does not say (spec 8), and
 * this time **a screen over the viewer rather than a sheet over it** (TASK-478): the frame gives up
 * the top of the window, this panel takes the rest of it and scrolls, and the pill in the header is
 * held in while it stands — the same press that brought the panel up takes it back down.
 *
 * It lives here and not in `frames-sheets.tsx` because it is no longer a sheet: nothing about it
 * rises from the bottom edge, and the frame it is about is still on the screen above it. Since
 * TASK-540 the window raises it as one movement with the frame shrinking above it (spec 10.14.3),
 * and a finger coming down the panel puts it away again (10.14.4) — the panel is where that gesture
 * is caught, because the scroll inside it is the one thing a downward drag there can also mean.
 *
 * Its own file reads the frame itself, which is what the sheet used to have handed in. Mounted by
 * being opened, so the one read happens on the opening and the panel says nothing until it answers.
 *
 * The rule the whole panel is built on is the rule the sheet was built on: **a line the server
 * knows nothing about is not drawn**. The camera, the place and the movies are written by the
 * montage worker, so an older frame legitimately has none of them; `frameFacts` is where that is
 * decided, and «В роликах» disappears with its own rows the same way. What the layout draws on top
 * of that — the ISO strip, the format and verdict badges, the map — is drawn by fields the api does
 * not send in `FrameInfo` at all, and is left out rather than guessed at.
 */
export function FrameInfoPanel({
  memoryId,
  item,
  onFilm,
  onEdited,
  style,
  rise,
  onLetGo,
}: {
  memoryId: string;
  /** The record the panel is about, as the viewer's own list holds it. */
  item: MediaItem;
  /** «В роликах» — the one row here that leads anywhere, and to the film's own screen. */
  onFilm: (montageId: string) => void;
  /** The record as it now stands, once the panel has changed the date on it. */
  onEdited: (item: MediaItem) => void;
  /** How much of the window the panel takes — what the frame above it gave up. */
  style?: StyleProp<ViewStyle>;
  /**
   * The window's own arrival, 0 with the panel away and 1 with it settled — handed in so that a
   * finger dragging the panel down carries the frame above it with it rather than the two parting
   * (TASK-540, AC #2). A panel drawn outside a window that animates it takes nothing.
   */
  rise?: Animated.Value;
  /**
   * The finger let go of the panel: `true` when it meant to put it away, `false` when it was only
   * feeling for it. What that means — the details going, or coming back — is the window's, which is
   * also where the animation lives.
   */
  onLetGo?: (goes: boolean) => void;
}) {
  const { token, user } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  /** Whether an errand is in the air — the chips stop taking presses while one is. */
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  /** The date row, opened: the editor stands under it until the shot is saved or left. */
  const [editingShot, setEditingShot] = useState(false);
  const [savingShot, setSavingShot] = useState(false);
  const place = usePlaceName(info?.latitude, info?.longitude);
  /** Where the panel's own scroll is, which is what tells a drag from a scroll (TASK-540). */
  const down = useRef(0);
  /**
   * How tall the panel came out — the distance a downward drag is measured against, so that the
   * frame above gives its room back in step with the finger rather than all at once. A ref and not
   * state: nothing about the panel is drawn from it, and a layout that re-rendered the whole read
   * behind it would be a render for a number the gesture is the only reader of.
   */
  const tall = useRef(0);
  // Read through refs like the rest of this file's gesture: the responder below is built once and
  // outlives every render of a panel that is redrawn as its own read answers.
  const carry = useRef(rise);
  carry.current = rise;
  const letGoOf = useRef(onLetGo);
  letGoOf.current = onLetGo;

  /**
   * The panel is put away by a finger coming down it (TASK-540, spec 10.14.4) — and the panel is the
   * one place in the window where a downward drag has two meanings, because it scrolls. So the
   * gesture is caught by the same rule the sheet's is, asked of the scroll instead of the handle:
   * while the panel is scrolled down its own content the drag is the scroll's and this never sees
   * it, and once it is at the top the same drag is «put this away».
   *
   * What it moves is the window's own value, so the frame above gives its room back as the panel
   * comes — one movement under the finger and not two (AC #2). Let go of past the drop and the
   * details go; short of it, the panel climbs back and nothing has happened.
   */
  const pull = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          down.current <= 0 && g.dy > SIDEWAYS && g.dy > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const how = Math.max(1, tall.current);
          carry.current?.setValue(Math.max(0, Math.min(1, 1 - g.dy / how)));
        },
        onPanResponderRelease: (_, g) => letGoOf.current?.(letGo(g)),
        onPanResponderTerminate: () => letGoOf.current?.(false),
      }).panHandlers,
    [],
  );

  /**
   * The one read behind the panel, asked for when it opens and not before, and asked again after
   * the labels sheet has filed something into this frame — a chip has to appear under the finger
   * that put the frame in, and the sheet answers with what changed rather than with the whole read.
   *
   * `clear` says whether the panel empties itself first: opening does, re-reading after the sheet
   * does not, because everything already standing is still true and a spinner over it would be the
   * panel saying «I know nothing» about a frame it was saying everything about a moment ago.
   *
   * Only the latest read may answer in. Two of them can be in the air at once — the sheet files
   * something and is then shut, and each says so — and the first to land would put the frame as it
   * was before the press under the finger that has already moved on.
   */
  const asking = useRef(0);

  const read = useCallback(
    (clear: boolean) => {
      if (clear) {
        setInfo(null);
        setFailed(null);
      }
      if (!token) return;
      const mine = ++asking.current;
      fetchFrameInfo(token, memoryId, item.id).then(
        (got) => {
          if (asking.current === mine) setInfo(got);
        },
        (e: unknown) => {
          if (asking.current === mine) setFailed(failure(e));
        },
      );
    },
    [token, memoryId, item.id],
  );

  // The read belongs to the mounting: a panel that is shut mid-air has nothing to answer into, and
  // neither has the next one — it asks again for itself on being opened.
  useEffect(() => {
    read(true);
    return () => {
      asking.current++;
    };
  }, [read]);

  /**
   * A chip is where this frame lies, and pressing it takes the frame back out of that box
   * (spec 10.8.2, detail 18) — the other way round, into a box the frame is not in yet, is the
   * sheet's own: `+` below the chips opens it over this one frame.
   *
   * A box the api will not let this person file into has no press at all rather than a press that
   * refuses: `can_add_media` is the server's own answer about this asker, and the rule is never
   * worked out on the phone.
   */
  async function takeOut(label: Label): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await removeLabelMedia(token, memoryId, label.id, [item.id]);
      setInfo((was) =>
        was === null ? was : { ...was, labels: was.labels.filter((one) => one.id !== label.id) },
      );
    } catch (e) {
      setFailed(failure(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * A new date for when this frame was shot, and the record told about it — the panel's own read
   * (so the row under the editor says the new day) and the list above it (so the pill over the
   * picture and the day the frame is filed under stop saying the old one). The editor itself is
   * `ShotEditor`, the one «Мои кадрах» opens: two editors of the same field would be two rules for
   * it, and they would part ways.
   */
  async function changeShot(at: Date): Promise<void> {
    if (!token) return;
    const captured_at = at.toISOString();
    setSavingShot(true);
    setFailed(null);
    try {
      await editMedia(token, memoryId, item.id, { captured_at });
      setInfo((was) => (was === null ? was : { ...was, captured_at }));
      onEdited({ ...item, captured_at });
      setEditingShot(false);
    } catch (e) {
      setFailed(failure(e));
    } finally {
      setSavingShot(false);
    }
  }

  /**
   * The frame as the labels sheet is handed it: one marked frame, carrying the boxes the panel's
   * own read says it lies in rather than the gallery's older list. The sheet decides what a press
   * on a row means from `label_ids` alone, and this is the reading that is in step with the chips
   * standing right behind it.
   */
  const marked = useMemo(
    () => [{ ...item, label_ids: (info?.labels ?? []).map((one) => one.id) }],
    [item, info],
  );

  const theme = useTheme();

  return (
    // The finger that puts the panel away is caught here, on the panel itself (TASK-540): the
    // gesture is decided by where the panel's own scroll stands, which is the one thing about it
    // that this view is not told by its props.
    <View
      style={[styles.panel, style]}
      onLayout={(e) => {
        tall.current = e.nativeEvent.layout.height;
      }}
      {...pull}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, board.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        // Where the panel stands in its own content, kept for the gesture above: at the top a
        // downward drag is «put this away», and anywhere below it the same drag is the scroll's.
        onScroll={(e) => {
          down.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {failed === null ? null : <Banner tone="error" failure={failed} />}

        {info === null ? (
          // Wordless on purpose (spec 9): what is missing is one short read, and the frame it is
          // about is still on the screen above this panel.
          failed === null ? (
            <View style={styles.waiting}>
              <Spinner />
            </View>
          ) : null
        ) : (
          <>
            {/* What people wrote under this frame (`FrameInfo.html` lines 33–49), the block the
                layout puts above the boxes. Its own file: it has a field, a list that scrolls
                inside itself and two errands of its own, and none of that is the panel's business.

                Drawn only where the api sent the field at all. `[]` is a fact about the frame and
                the block says so in words; a missing field is not, and the panel's own rule says a
                line the server knows nothing about is not drawn — which is not the same answer and
                must not be read as one. */}
            {info.comments === undefined ? null : (
              <FrameComments
                memoryId={memoryId}
                mediaId={item.id}
                comments={info.comments}
                // The api hands back the row it wrote in the form the read would have given, so
                // the list grows by one line rather than by a second round trip (TASK-497).
                onSent={(comment) =>
                  setInfo((was) =>
                    was === null ? was : { ...was, comments: [...(was.comments ?? []), comment] },
                  )
                }
                onGone={(id) =>
                  setInfo((was) =>
                    was === null
                      ? was
                      : {
                          ...was,
                          comments: (was.comments ?? []).filter((one) => one.id !== id),
                        },
                  )
                }
              />
            )}

            {/* Spec 10.8.2, detail 18 — the boxes this frame lies in, and the way into the rest of
                them. Shared and personal are told apart by the mark: a colour for a box everybody
                sees, a lock for one that is only this person's. A frame in no box has no block here
                at all — the api sends an empty array and not a null, and there is nothing to draw.

                The order is the api's — shared first, by title within — and is not sorted again
                here: the filter over the gallery reads the same order, and a second sort would
                show the picker a different one. */}
            {info.labels.length === 0 ? null : (
              <View style={styles.labels}>
                <Text role="meta" tone="muted">
                  {s.gallery.whichLabels}
                </Text>
                <View style={styles.chips}>
                  {info.labels.map((label) => (
                    <Chip
                      key={label.id}
                      size={height.chipXs}
                      label={label.title}
                      // The colour is the label's own palette cell read as paint, and it is a dot
                      // in front of the name whatever kind of box this is.
                      swatch={labelTint(label.color, theme)}
                      icon={label.shared ? undefined : Lock}
                      name={s.labels.takeOut(label.title)}
                      disabled={!label.can_add_media || busy}
                      onPress={label.can_add_media ? () => void takeOut(label) : undefined}
                      style={styles.chip}
                    />
                  ))}
                  <IconButton
                    icon={Plus}
                    label={s.labels.putInto}
                    size={height.chipXs}
                    tone="outline"
                    onPress={() => setFiling(true)}
                  />
                </View>
              </View>
            )}

            {/* The person, on `ink` inside the panel's own surface — the one block here that is
                about somebody rather than about a file. */}
            <View style={styles.author}>
              <Avatar name={memberName(info.uploaded_by)} size={32} />
              <View style={styles.authorWords}>
                <Text role="rowSm">{memberName(info.uploaded_by)}</Text>
                <Text role="meta">
                  {s.viewer.brought(formatDayShort(info.created_at), info.uploaded_by.media_count)}
                </Text>
              </View>
            </View>

            {/* Spec 8, `FrameInfo`: the card of what the file is starts with when it was shot, and
                it is the one line of the card a person can change — the api gives 404 on a frame
                that is not the asker's own, so the words are drawn for the one they brought and
                for nobody else's (doc-13: the app never repeats the api's own rule).

                The date is not one of `frameFacts`' lines and is drawn apart from them because the
                server always knows it — it is in every frame's record, `null` for a file that
                never said — while the lines below it are the worker's to have written or not. */}
            <View style={styles.facts}>
              <RowEdit
                value={
                  info.captured_at
                    ? `${formatDay(info.captured_at)}, ${formatTime(info.captured_at)}`
                    : s.mine.none
                }
                edit={s.viewer.editShot}
                onEdit={info.uploaded_by.id === user?.id ? () => setEditingShot(true) : undefined}
              />
              {editingShot ? (
                <ShotEditor
                  from={info.captured_at}
                  busy={savingShot}
                  onSave={(at) => void changeShot(at)}
                />
              ) : null}
              {frameFacts(info, s, undefined, place).map((fact) => (
                <RowSummary key={fact.label} label={fact.label} value={fact.value} divider />
              ))}
              {/* The shooting settings, at the foot of the card and under the last of its lines
                  (`FrameInfo.html` e76–82): ISO · мм · ev · ƒ · выдержка, five equal cells split by
                  hairlines. `shotCells` is what says which of them there is — a value the worker
                  never read is no cell at all, and an exposure of `0` is a cell like any other. */}
              <ShotCells cells={shotCells(info, s)} />
            </View>

            {info.montages.length === 0 ? null : (
              <View style={styles.group}>
                <Text role="meta" accessibilityRole="header">
                  {s.viewer.inFilms}
                </Text>
                {info.montages.map((film) => {
                  const runtime = formatRuntime(film.duration_seconds);
                  return (
                    <RowFilmAt
                      // One frame may stand in the same movie twice — the second is part of the key.
                      key={`${film.id}:${film.start_seconds}`}
                      title={runtime ? s.montage.ofLength(runtime) : s.montage.count(1)}
                      at={s.viewer.at(formatRuntime(film.start_seconds) ?? '')}
                      onPress={() => onFilm(film.id)}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* `SheetLabels` — the way into every other box of this memory, raised over the one frame the
          panel is about rather than over a selection on the feed. Everything it does to that frame
          is answered by re-reading the panel behind it, which is why a chip is there before the
          sheet is shut. */}
      {filing && info !== null ? (
        <LabelSheets
          memoryId={memoryId}
          frames={marked}
          onFiled={() => read(false)}
          onClose={() => {
            setFiling(false);
            read(false);
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8, `FrameInfo`: the panel is the foot of the window — `surface` under a `line` hairline,
    // square at the top because it is not a sheet rising from the edge.
    panel: {
      backgroundColor: color.surface,
      borderTopWidth: 1,
      borderColor: color.line,
    },
    scroll: { flexGrow: 0 },
    // 12 down, 16 in, and 14 between every block and the next.
    body: { gap: 14, paddingTop: space.s3, paddingHorizontal: space.s4 },
    // Spec 8, `FrameInfo`: «В роликах» and the movies under it, 8 apart.
    group: { gap: space.s2 },
    // The heading of the labels block and the row of chips it introduces.
    labels: { gap: 10 },
    // A row of chips that wraps as it needs to — the panel scrolls, and a box nobody can reach is
    // a box that is not there.
    chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    // On `surface` a chip of its own is an `ink` well with a `line` ring, the way the layout draws
    // the labels on this screen.
    chip: { backgroundColor: color.ink, borderColor: color.line },
    // Spec 8: the person stands on `ink` inside the panel's own surface, ringed like a field — the
    // face 32, the name 14 / 600 10 after it and the line right under.
    author: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: space.s3,
      borderRadius: radius.cell,
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    authorWords: { flex: 1, minWidth: 0, gap: 1 },
    // The summary rows carry the screen's own 16 inside them, and the panel has already spent it.
    facts: { marginHorizontal: -space.s4 },
    waiting: { alignItems: 'center', paddingVertical: space.s5 },
  }),
);
