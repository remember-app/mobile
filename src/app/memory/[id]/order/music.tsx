import { getDocumentAsync } from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Pause, Pencil, Play, Plus, VolumeX, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, View } from 'react-native';

import type { MusicTrackId } from '@/api';
import { useAuth } from '@/auth';
import { formatRuntime } from '@/dates';
import {
  BlockPicked,
  Button,
  ChoiceCard,
  Field,
  IconButton,
  RowTrack,
  Text,
  TRACK_ROW,
} from '@/kit';
import { useStrings } from '@/language';
import {
  movedTrack,
  NOTE_LIMIT,
  pickedSeconds,
  shelfTrack,
  TRACKS,
  type PickedTrack,
} from '@/montage';
import { sendOwnTrack, useTrackPreview } from '@/music';
import { refusal, useOrder, useStillHere, WizardStep } from '@/order-wizard';
import { radius, space, themed, useTheme } from '@/theme';

/**
 * Step 3, `MontageMusic` — the shelf of five, tracks off this phone beside them, and the answer
 * that is neither: nothing at all, and the video's own sound carries the film.
 *
 * Two blocks, and the top one has two faces. With nothing taken it is the «Без музыки» card,
 * chosen and saying what choosing it gives you; with anything taken it is «Выбрано» — the tracks
 * in the order they will play, and under them the one line about how to use them. Taking the last
 * one back brings the card straight back, and the line goes with it: a wish about music nobody
 * picked is what the api answers 400 to, and what it is *about* has just left the order anyway.
 *
 * The order of that list is the order they play in (doc-03), so it can be dragged: a row is taken
 * by its wave — the one part of it that is not already a button — and rows are counted rather than
 * measured, because every one of them is exactly as tall as the next.
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
  const { id, order, change } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();
  const { playing, toggle } = useTrackPreview(token);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const gone = useStillHere();
  const picked = order.tracks;

  /** What a chosen track is called: one of the five has a word here, a file has its own name. */
  const nameOf = (track: PickedTrack, shelf: MusicTrackId | null) =>
    shelf === null ? (track.name ?? s.montage.ownTrackShort) : s.montage.track[shelf];
  const inOrder = (key: string) => picked.some((track) => track.key === key);

  /**
   * Taking one back. The last one takes the wish with it — a line about how to use tracks that are
   * no longer in the order would go out with whatever is picked next.
   */
  const drop = (key: string) => {
    const tracks = picked.filter((track) => track.key !== key);
    change(tracks.length === 0 ? { tracks, note: '' } : { tracks });
  };

  /** One tap on a shelf row: the track goes on the end of the list, or comes off it. */
  const flip = (key: MusicTrackId) =>
    inOrder(key) ? drop(key) : change({ tracks: [...picked, { key, name: null }] });

  const move = (from: number, to: number) =>
    change({ tracks: movedTrack(picked, from, Math.max(0, Math.min(picked.length - 1, to))) });

  /**
   * The row a finger has hold of, taken the moment it lands: where the row stood, where it is now,
   * where the finger came down and the list as it was. A swap re-renders the list, and the
   * responder then answers the next move with the new render's handlers, whose own `gesture.dy`
   * starts again from zero — counted from that, the row ran ahead of the finger. Every move is
   * worked out from this grab instead, whichever render's handler is asked.
   */
  const grab = useRef({ from: 0, to: 0, y: 0, list: picked });
  const gripFor = (from: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        grab.current = { from, to: from, y: e.nativeEvent.pageY, list: picked };
      },
      onPanResponderMove: (e) => {
        const held = grab.current;
        const to = Math.max(
          0,
          Math.min(
            held.list.length - 1,
            held.from + Math.round((e.nativeEvent.pageY - held.y) / TRACK_ROW),
          ),
        );
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
    // Busy from the moment the phone's own picker is up: the wizard cannot move on while the track
    // it is about to be cut to is still being chosen, let alone sent.
    setBusy(true);
    setNotice(null);
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
    >
      <ScrollView contentContainerStyle={styles.body}>
        {picked.length === 0 ? (
          /* Chosen, and the only way out of it is taking a track: a second press on it would have
             to undo something that is already nothing. */
          <ChoiceCard
            variant="row"
            icon={VolumeX}
            title={s.montage.noMusic}
            note={s.montage.noMusicNote}
            selected
          />
        ) : (
          <BlockPicked
            title={s.montage.picked}
            count={
              total === null
                ? s.montage.tracksPicked(picked.length)
                : `${s.montage.tracksPicked(picked.length)} · ${formatRuntime(total) ?? ''}`
            }
            footer={
              <Field
                variant="wish"
                label={s.montage.musicNote}
                labelHidden
                icon={Pencil}
                placeholder={s.montage.musicNotePlaceholder}
                maxLength={NOTE_LIMIT}
                value={order.note}
                onChangeText={(note) => change({ note })}
              />
            }
          >
            {picked.map((track, i) => {
              // Which kind of track this is, asked the one way there is to ask it: the five have a
              // word in the dictionary, and anything else is a file somebody sent up themselves.
              const shelf = shelfTrack(track.key);
              const name = nameOf(track, shelf);
              const heard = shelf !== null && playing?.track === shelf;

              return (
                <RowTrack
                  key={track.key}
                  title={name}
                  length={shelf === null ? s.montage.ownTrackShort : lengthOf(shelf)}
                  playing={heard}
                  wave
                  divider={i > 0}
                  // The wave is the handle (spec 7.7). Dragging says nothing to a screen reader, so
                  // the same two moves are offered as actions on it — one row up, one row down.
                  grip={{
                    accessibilityRole: 'adjustable',
                    accessibilityLabel: s.montage.moveTrack(name),
                    accessibilityActions: MOVES,
                    onAccessibilityAction: (e) =>
                      move(i, e.nativeEvent.actionName === 'increment' ? i + 1 : i - 1),
                    ...gripFor(i),
                  }}
                  play={
                    shelf === null ? undefined : (
                      <IconButton
                        icon={heard ? Pause : Play}
                        label={heard ? s.montage.stopTrack(name) : s.montage.listen(name)}
                        size={36}
                        tone="paper"
                        onPress={() => listen(shelf)}
                      />
                    )
                  }
                  action={
                    <IconButton
                      icon={X}
                      label={s.montage.dropTrack(name)}
                      size={36}
                      onPress={() => drop(track.key)}
                    />
                  }
                />
              );
            })}
          </BlockPicked>
        )}

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text role="eyebrow" accessibilityRole="header" style={styles.grow}>
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
                  play={
                    <IconButton
                      icon={heard ? Pause : Play}
                      label={heard ? s.montage.stopTrack(name) : s.montage.listen(name)}
                      size={40}
                      tone="raise"
                      onPress={() => listen(track.id)}
                    />
                  }
                  // Spec 7.7 — the row no longer picks; the 36 on its right does, and it says which
                  // way it is: the plus takes the track, the tick gives it back.
                  action={
                    <IconButton
                      icon={taken ? Check : Plus}
                      label={taken ? s.montage.dropTrack(name) : s.montage.addTrack(name)}
                      size={36}
                      tone="ghost"
                      on={taken}
                      // Outlined and read at full voice, the way the layout draws it: this one is
                      // an offer and not a quiet aside, and `muted` inside a hairline is a hint.
                      tint={color.paper}
                      style={taken ? undefined : styles.add}
                      onPress={() => flip(track.id)}
                    />
                  }
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </WizardStep>
  );
}

/** The running time of one of the five, written out — the shelf holds it as seconds. */
const lengthOf = (id: MusicTrackId): string =>
  formatRuntime(TRACKS.find((track) => track.id === id)?.seconds ?? null) ?? '';

/** What a screen reader may do to a list it cannot drag: one row up, one row down. */
const MOVES = [{ name: 'increment' }, { name: 'decrement' }];

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s5 },
    block: { gap: 10 },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingLeft: 2 },
    // The five stand inside one surface with the corners cut off it, so the hairline between two
    // rows never reaches the rounding.
    card: {
      borderRadius: radius.section,
      overflow: 'hidden',
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    // «Добавить» on a row nobody picked: the outlined one, drawn in the louder of the two borders.
    add: { borderColor: color.lineStrong },
  }),
);
