import { getDocumentAsync } from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Pencil, Plus, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { MusicTrackId } from '@/api';
import {
  BlockPicked,
  Button,
  CardDirector,
  DRAWN,
  Field,
  IconButton,
  RowTrack,
  soften,
  Text,
  TRACK_ROW,
  WISH_GLYPH,
} from '@/kit';
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
  const [open, setOpen] = useState<string | null>(null);
  const tall = useRef<Record<string, number>>({});
  const gone = useStillHere();
  const picked = order.tracks;
  const nameOf = (track: PickedTrack, shelf: MusicTrackId | null) =>
    shelf === null ? (track.name ?? s.montage.ownTrackShort) : s.montage.track[shelf];
  const inOrder = (key: string) => picked.some((track) => track.key === key);
  const full = picked.length + (busy ? 1 : 0) >= TRACK_LIMIT;
  const drop = (key: string) => {
    setOpen((was) => (was === key ? null : was));
    change({ tracks: picked.filter((track) => track.key !== key) });
  };
  const flip = (key: MusicTrackId) => {
    setNotice(null);
    if (inOrder(key)) drop(key);
    else if (full) setNotice(s.montage.tracksFull(TRACK_LIMIT));
    else change({ tracks: [...picked, { key, name: null }], director: false });
  };
  const flipDirector = () => {
    setNotice(null);
    stop();
    change((was) => ({ director: !was.director, tracks: [] }));
  };
  const move = (from: number, to: number) =>
    change({ tracks: movedTrack(picked, from, Math.max(0, Math.min(picked.length - 1, to))) });
  const write = (key: string, wish: string) => {
    stop();
    change((was) => ({
      tracks: was.tracks.map((track) => (track.key === key ? { ...track, wish } : track)),
    }));
  };
  const unfold = (key: string) => {
    stop();
    soften(UNFOLD_MS);
    setOpen((was) => (was === key ? null : key));
  };
  const fold = (key: string) => {
    soften(UNFOLD_MS);
    setOpen((was) => (was === key ? null : was));
  };
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
  async function pickOwnTrack() {
    if (!token) return;
    setNotice(null);
    if (full) {
      setNotice(s.montage.tracksFull(TRACK_LIMIT));
      return;
    }
    setBusy(true);
    try {
      const file = (await getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true }))
        .assets?.[0];
      if (!file) return;
      const key = await sendOwnTrack(token, id, { uri: file.uri, name: file.name });
      if (gone.current) return;
      change((was) => ({ tracks: [...was.tracks, { key, name: file.name }], director: false }));
    } catch (e) {
      if (!gone.current) setNotice(refusal(e).text);
    } finally {
      setBusy(false);
    }
  }
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
      body={styles.body}
    >
      {order.director ? (
        <BlockPicked
          title={s.montage.picked}
          count={s.montage.directorHead}
          director={{ title: s.montage.directorBlockTitle, note: s.montage.directorBlockNote }}
        />
      ) : picked.length === 0 ? (
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
                  wish={unfolded ? undefined : written || undefined}
                  playing={heard}
                  divider={i > 0}
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
                      <IconButton
                        icon={DRAWN.pen}
                        label={written ? s.montage.wishEdit(name) : s.montage.wishAbout(name)}
                        size={36}
                        glyph={WISH_GLYPH}
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

      <CardDirector
        title={s.montage.directorChoice}
        note={s.montage.directorChoiceNote}
        picked={order.director}
        label={order.director ? s.montage.directorPicked : s.montage.directorOffer}
        onPress={flipDirector}
      />

      <View style={[styles.block, order.director ? styles.dimmed : null]}>
        <View style={styles.blockHead}>
          <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.grow}>
            {s.montage.music.toUpperCase()}
          </Text>

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
                action={
                  <IconButton
                    icon={taken ? Check : Plus}
                    label={taken ? s.montage.unpickTrack(name) : s.montage.addTrack(name)}
                    size={36}
                    tone={taken ? 'paper' : 'ghost'}
                    on={taken}
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
const lengthOf = (id: MusicTrackId): string =>
  formatRuntime(TRACKS.find((track) => track.id === id)?.seconds ?? null) ?? '';
const MOVES = [{ name: 'increment' }, { name: 'decrement' }];
const UNFOLD_MS = 200;
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flexGrow: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.music,
      paddingBottom: space.s6,
      gap: 18,
    },
    block: { gap: 10 },
    dimmed: { opacity: 0.4 },
    blockHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s2,
      paddingLeft: 2,
    },
    card: {
      borderRadius: radius.section,
      overflow: 'hidden',
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    outlined: { borderColor: color.lineStrong },
  }),
);
