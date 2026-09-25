import { getDocumentAsync } from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Pencil, Plus, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import type { MusicTrackId } from '@/api';
import { BlockPicked, Button, Field, IconButton, RowTrack, soften, Text, TRACK_ROW } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  landing,
  movedTrack,
  type PickedTrack,
  pickedSeconds,
  shelfTrack,
  TRACK_LIMIT,
  TRACKS,
  WISH_LIMIT,
} from '@/lib/montage/order';
import { sendOwnTrack, useTrackPreview } from '@/lib/music';
import { refusal, useOrder, useStillHere, WizardStep } from '@/screens/order/wizard';
import { radius, space, themed, useTheme, wizardLead } from '@/theme';

/**
 * Step 3, `MontageMusicNone` / `MontageMusic` — what the film is cut to: nothing at all and the
 * video's own sound, or any number of tracks off the shelf of five or off this phone.
 *
 * Two blocks. On top «Выбрано», which is never away: with nothing in it, it says the film will have
 * no music — a state, not a choice to press; with tracks in it, it holds them in the order they
 * will play, each with its own wish. Under it the shelf, where the plus takes a track up and the
 * tick gives it back.
 *
 * A wish belongs to one track (spec 7.7, detail 54). The pencil in a chosen row unfolds a field
 * under that row, one field at a time; when the field lets go of the keyboard it folds away, and
 * what was written stands as a line under the track's name. The wish is held on the track itself,
 * so a track taken out takes its wish with it and a track dragged somewhere else carries it along.
 *
 * The order of the chosen is the order they play in (doc-03), so it can be dragged: a row is taken
 * by its name — the part of it that is not a button. The rows are not one height (a wish under the
 * name makes one taller, an open field taller still), so each is measured as it is drawn and the
 * drag walks past what it measured.
 *
 * Listening is not picking: the round button on the left plays the track where it stands and
 * leaves the choice alone, so the shelf can be heard through without anything being decided. The
 * player is this screen's own — leaving the step is the music stopping, whether that is the step
 * after it or the wizard closing. Their own track has no button: nothing here has a link to a file
 * this app itself sent up, and a dead «Послушать» is worse than none.
 */
export default function MusicStep() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, order, change, stop } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();
  const { playing, toggle } = useTrackPreview(token);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** The chosen track whose wish field is unfolded — one at a time, or none. */
  const [open, setOpen] = useState<string | null>(null);
  /** How tall each chosen row stood when last drawn, field and all: what a drag walks past. */
  const tall = useRef<Record<string, number>>({});
  const gone = useStillHere();
  const picked = order.tracks;

  /** What a chosen track is called: one of the five has a word here, a file has its own name. */
  const nameOf = (track: PickedTrack, shelf: MusicTrackId | null) =>
    shelf === null ? (track.name ?? s.montage.ownTrackShort) : s.montage.track[shelf];
  const inOrder = (key: string) => picked.some((track) => track.key === key);
  /**
   * No room for one more under the api's ceiling. A file still going up already holds its place:
   * the shelf stays pressable meanwhile, and must not fill the place the file is about to land in.
   */
  const full = picked.length + (busy ? 1 : 0) >= TRACK_LIMIT;

  /**
   * Taking one back — and its wish, which is held on it, goes too. So does its field, if it was
   * open: taken again later, the track comes back as new, folded and with nothing written.
   */
  const drop = (key: string) => {
    setOpen((was) => (was === key ? null : was));
    change({ tracks: picked.filter((track) => track.key !== key) });
  };

  /**
   * One tap on the shelf's plus or tick: the track goes on the end of the list, or comes off it —
   * and with the list full it stays where it is, and the step says why.
   */
  const flip = (key: MusicTrackId) => {
    setNotice(null);
    if (inOrder(key)) drop(key);
    else if (full) setNotice(s.montage.tracksFull(TRACK_LIMIT));
    else change({ tracks: [...picked, { key, name: null }] });
  };

  const move = (from: number, to: number) =>
    change({ tracks: movedTrack(picked, from, Math.max(0, Math.min(picked.length - 1, to))) });

  /**
   * The words typed under one chosen track, onto that track and no other. Typing takes the wheel,
   * as it does in the story: a template still walking would lay its tracks over these words.
   */
  const write = (key: string, wish: string) => {
    stop();
    change((was) => ({
      tracks: was.tracks.map((track) => (track.key === key ? { ...track, wish } : track)),
    }));
  };

  /**
   * The pencil: that row's field unfolds and any other folds away; pressed again, it folds. It takes
   * the wheel as typing does — a template still walking would turn the step over under the field.
   */
  const unfold = (key: string) => {
    stop();
    soften(UNFOLD_MS);
    setOpen((was) => (was === key ? null : key));
  };

  /** The field let go of the keyboard: it folds — unless another one has been unfolded since. */
  const fold = (key: string) => {
    soften(UNFOLD_MS);
    setOpen((was) => (was === key ? null : was));
  };

  /**
   * The row a finger has hold of, taken the moment it lands: where the row stood, where it is now,
   * where the finger came down, the list as it was and how tall each of its rows stood. A swap
   * re-renders the list, and the responder then answers the next move with the new render's
   * handlers, whose own `gesture.dy` starts again from zero — counted from that, the row ran ahead
   * of the finger. Every move is worked out from this grab instead, whichever render's handler is
   * asked. A row not measured yet counts as the kit's own height.
   */
  const grab = useRef({ from: 0, to: 0, y: 0, list: picked, heights: [] as number[] });
  const gripFor = (from: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        grab.current = {
          from,
          to: from,
          y: e.nativeEvent.pageY,
          list: picked,
          heights: picked.map((track) => tall.current[track.key] ?? TRACK_ROW),
        };
      },
      onPanResponderMove: (e) => {
        const held = grab.current;
        const to = landing(held.heights, held.from, e.nativeEvent.pageY - held.y);
        if (to === held.to) return;
        held.to = to;
        change({ tracks: movedTrack(held.list, held.from, to) });
      },
    }).panHandlers;

  /**
   * «Свой трек»: picked, sent and held by the key R2 answers with. Sent the moment it is picked
   * rather than at the order, so that the last button of the wizard is one call and not two — and
   * a wizard abandoned after this leaves one small object in the bucket, which is the price of not
   * making somebody wait through an upload while the order is in flight.
   */
  async function pickOwnTrack() {
    if (!token) return;
    setNotice(null);
    // Said before the phone's picker opens, not after a file has been hunted down for nothing.
    if (full) {
      setNotice(s.montage.tracksFull(TRACK_LIMIT));
      return;
    }
    // Busy from the moment the phone's own picker is up: the wizard cannot move on while the track
    // it is about to be cut to is still being chosen, let alone sent.
    setBusy(true);
    try {
      const file = (await getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true }))
        .assets?.[0];
      if (!file) return;

      const key = await sendOwnTrack(token, id, { uri: file.uri, name: file.name });
      if (gone.current) return;
      // Onto the list as it is now: the shelf stays pressable while the file goes up.
      change((was) => ({ tracks: [...was.tracks, { key, name: file.name }] }));
    } catch (e) {
      if (!gone.current) setNotice(refusal(e).text);
    } finally {
      setBusy(false);
    }
  }

  /** One press on «Послушать», and whatever it fails at is this screen's line to say. */
  function listen(track: MusicTrackId) {
    setNotice(null);
    void toggle(track).catch((e: unknown) => setNotice(refusal(e).text));
  }

  const total = pickedSeconds(picked);

  return (
    <WizardStep
      step={3}
      title={s.montage.musicTitle}
      note={s.montage.musicHint}
      notice={notice}
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.next}
          busy={busy}
          busyLabel={s.montage.sendingTrack}
          onPress={() => router.push({ pathname: '/memory/[id]/order/build', params: { id } })}
        />
      }
      // The board's body keeps a press on another row's pencil, a cross or the shelf while a wish
      // is being typed, rather than spending it on putting the keyboard away.
      body={styles.body}
    >
      {picked.length === 0 ? (
        <BlockPicked
          title={s.montage.picked}
          count={s.montage.nothingAdded}
          empty={{ title: s.montage.noMusic, note: s.montage.noMusicNote }}
        />
      ) : (
        <BlockPicked
          title={s.montage.picked}
          count={
            total === null
              ? s.montage.tracksPicked(picked.length)
              : `${s.montage.tracksPicked(picked.length)} · ${formatRuntime(total) ?? ''}`
          }
        >
          {picked.map((track, i) => {
            // Which kind of track this is, asked the one way there is to ask it: the five have a
            // word in the dictionary, and anything else is a file somebody sent up themselves.
            const shelf = shelfTrack(track.key);
            const name = nameOf(track, shelf);
            const length = shelf === null ? s.montage.ownTrackShort : lengthOf(shelf);
            const heard = shelf !== null && playing?.track === shelf;
            const written = track.wish?.trim() ?? '';
            const unfolded = open === track.key;

            return (
              <View
                key={track.key}
                onLayout={(e) => {
                  tall.current[track.key] = e.nativeEvent.layout.height;
                }}
              >
                <RowTrack
                  picked
                  title={name}
                  length={length}
                  // While the field is open the words are in it; folded, they stand under the name.
                  wish={unfolded ? undefined : written || undefined}
                  playing={heard}
                  divider={i > 0}
                  // Held by its name (spec 7.7). Dragging says nothing to a screen reader, so the
                  // same two moves are offered as actions on it — one row up, one row down.
                  grip={{
                    accessible: true,
                    accessibilityRole: 'adjustable',
                    accessibilityLabel: [s.montage.moveTrack(name), length, written]
                      .filter(Boolean)
                      .join('. '),
                    accessibilityActions: MOVES,
                    onAccessibilityAction: (e) =>
                      move(i, e.nativeEvent.actionName === 'increment' ? i + 1 : i - 1),
                    ...gripFor(i),
                  }}
                  play={
                    shelf === null
                      ? undefined
                      : {
                          label: heard ? s.montage.stopTrack(name) : s.montage.listen(name),
                          onPress: () => listen(shelf),
                        }
                  }
                  action={
                    <>
                      {/* Spec 7.7, detail 54 — filled once something is written, outlined while
                          nothing is: the button says which of the two it would open on. */}
                      <IconButton
                        icon={Pencil}
                        label={written ? s.montage.wishEdit(name) : s.montage.wishAbout(name)}
                        size={36}
                        tone={written ? 'raise' : 'ghost'}
                        style={written ? undefined : styles.outlined}
                        onPress={() => unfold(track.key)}
                      />
                      <IconButton
                        icon={X}
                        label={s.montage.dropTrack(name)}
                        size={36}
                        tint={color.faint}
                        onPress={() => drop(track.key)}
                      />
                    </>
                  }
                >
                  {unfolded ? (
                    <Field
                      variant="wish"
                      label={s.montage.wishAbout(name)}
                      labelHidden
                      icon={Pencil}
                      placeholder={s.montage.wishAbout(name)}
                      maxLength={WISH_LIMIT}
                      autoFocus
                      returnKeyType="done"
                      value={track.wish ?? ''}
                      onChangeText={(wish) => write(track.key, wish)}
                      onBlur={() => fold(track.key)}
                    />
                  ) : null}
                </RowTrack>
              </View>
            );
          })}
        </BlockPicked>
      )}

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.grow}>
            {s.montage.music.toUpperCase()}
          </Text>
          {/* Spec 7.2 — the one dashed button in the product, at the smaller of its two heights:
              a pill in the row of the heading, not a block under the list. */}
          <Button
            variant="dashed"
            size="xxs"
            wide={false}
            icon={Plus}
            label={s.montage.ownTrackShort}
            disabled={busy}
            onPress={() => void pickOwnTrack()}
          />
        </View>

        <View style={styles.card}>
          {TRACKS.map((track, i) => {
            const name = s.montage.track[track.id];
            const heard = playing?.track === track.id;
            const taken = inOrder(track.id);

            return (
              <RowTrack
                key={track.id}
                title={name}
                length={lengthOf(track.id)}
                playing={heard}
                divider={i > 0}
                play={{
                  label: heard ? s.montage.stopTrack(name) : s.montage.listen(name),
                  onPress: () => listen(track.id),
                }}
                // Spec 7.7, detail 53 — the row does not pick; the 36 on its right does, and it
                // says which way it is: the plus takes the track, the tick gives it back. The
                // tick is `paper` and not `accent`: the track is not going anywhere.
                action={
                  <IconButton
                    icon={taken ? Check : Plus}
                    label={taken ? s.montage.unpickTrack(name) : s.montage.addTrack(name)}
                    size={36}
                    tone={taken ? 'paper' : 'ghost'}
                    on={taken}
                    // Outlined and read at full voice, the way the layout draws it: this one is
                    // an offer and not a quiet aside, and `muted` inside a hairline is a hint.
                    tint={taken ? undefined : color.paper}
                    style={taken ? undefined : styles.outlined}
                    onPress={() => flip(track.id)}
                  />
                }
              />
            );
          })}
        </View>
      </View>
    </WizardStep>
  );
}

/** The running time of one of the five, written out — the shelf holds it as seconds. */
const lengthOf = (id: MusicTrackId): string =>
  formatRuntime(TRACKS.find((track) => track.id === id)?.seconds ?? null) ?? '';

/** What a screen reader may do to a list it cannot drag: one row up, one row down. */
const MOVES = [{ name: 'increment' }, { name: 'decrement' }];

/** Spec 6 — the wish field unfolding under its row, and folding back into the line under the name. */
const UNFOLD_MS = 200;

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The heading keeps the width of its word: on the largest type «Свой трек» moves under it rather
    // than squeeze it a letter a line.
    grow: { flexGrow: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.music,
      paddingBottom: space.s6,
      gap: 18,
    },
    block: { gap: 10 },
    blockHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s2,
      paddingLeft: 2,
    },
    // The five stand inside one surface with the corners cut off it, so the hairline between two
    // rows never reaches the rounding.
    card: {
      borderRadius: radius.section,
      overflow: 'hidden',
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    // A round 36 that is an offer rather than a state — the shelf's plus, a pencil with nothing
    // written behind it: no fill, and the louder of the two borders.
    outlined: { borderColor: color.lineStrong },
  }),
);
