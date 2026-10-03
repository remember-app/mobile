import { Lock, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  errorMessage,
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
  RowFilmAt,
  RowSummary,
  Spinner,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDayShort, formatRuntime } from '@/lib/dates';
import { frameFacts } from '@/lib/frames';
import { usePlaceName } from '@/lib/geocoder';
import { labelTint } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { board, height, radius, space, themed, useTheme } from '@/theme';

/**
 * `FrameInfo` — everything about the open frame that the picture itself does not say (spec 8), and
 * this time **a screen over the viewer rather than a sheet over it** (TASK-478): the frame gives up
 * the top of the window, this panel takes the rest of it and scrolls, and the pill in the header is
 * held in while it stands — the same press that brought the panel up takes it back down.
 *
 * It lives here and not in `frames-sheets.tsx` because it is no longer a sheet: nothing about it
 * rises from the bottom edge, and the frame it is about is still on the screen above it.
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
  style,
}: {
  memoryId: string;
  /** The record the panel is about, as the viewer's own list holds it. */
  item: MediaItem;
  /** «В роликах» — the one row here that leads anywhere, and to the film's own screen. */
  onFilm: (montageId: string) => void;
  /** How much of the window the panel takes — what the frame above it gave up. */
  style?: StyleProp<ViewStyle>;
}) {
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Whether an errand is in the air — the chips stop taking presses while one is. */
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  const place = usePlaceName(info?.latitude, info?.longitude);

  /**
   * The one read behind the panel, asked for when it opens and not before, and asked again after
   * the labels sheet has filed something into this frame — a chip has to appear under the finger
   * that put the frame in, and the sheet answers with what changed rather than with the whole read.
   *
   * `clear` says whether the panel empties itself first: opening does, re-reading after the sheet
   * does not, because everything already standing is still true and a spinner over it would be the
   * panel saying «I know nothing» about a frame it was saying everything about a moment ago.
   */
  const read = useCallback(
    (clear: boolean) => {
      if (clear) {
        setInfo(null);
        setFailed(null);
      }
      if (!token) return;
      let live = true;
      fetchFrameInfo(token, memoryId, item.id).then(
        (got) => live && setInfo(got),
        (e: unknown) => live && setFailed(errorMessage(e)),
      );
      return () => {
        live = false;
      };
    },
    [token, memoryId, item.id],
  );

  useEffect(() => read(true), [read]);

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
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
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
    <View style={[styles.panel, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, board.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {failed === null ? null : <Banner tone="error" text={failed} />}

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

            <View style={styles.facts}>
              {frameFacts(info, s, undefined, place).map((fact, at) => (
                <RowSummary key={fact.label} label={fact.label} value={fact.value} divider={at > 0} />
              ))}
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
    // Spec 8, `SheetFrameInfo`: «В роликах» and the movies under it, 8 apart.
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