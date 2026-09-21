import { getDocumentAsync } from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Pause, Play, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage, type MusicTrackId } from '@/api';
import { useAuth } from '@/auth';
import { Button, IconButton, RowTrack } from '@/kit';
import { useStrings } from '@/language';
import { TRACKS } from '@/montage';
import { sendOwnTrack, useTrackPreview } from '@/music';
import { useOrder, useStillHere, WizardStep } from '@/order-wizard';
import { radius, space, themed } from '@/theme';

/**
 * Step 3, `MontageMusic` — the shelf of five, and tracks off this phone beside them. Several can
 * be taken at once and the order they were taken in is the order they play in, which is what the
 * api reads (doc-03): one list, shelf ids and own keys mixed.
 *
 * Listening is not picking: the round button on the left plays the track where it stands and
 * leaves the choice alone, so the shelf can be heard through without anything being decided. The
 * player is this screen's own — leaving the step is the music stopping, whether that is the step
 * after it or the wizard closing.
 *
 * ponytail: this is the step as it stood before the new layout, carried onto the list; the «Без
 * музыки» card, the block of what was taken and the line about how to use it are TASK-217's, and
 * this file is the one it rewrites.
 */
export default function MusicStep() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, order, change } = useOrder();
  const styles = useStyles();
  const { playing, toggle } = useTrackPreview(token);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const gone = useStillHere();

  const inOrder = (key: string) => order.tracks.some((track) => track.key === key);
  /** One tap on a shelf row: the track goes on the end of the list, or comes off it. */
  const flip = (key: MusicTrackId) =>
    change({
      tracks: inOrder(key)
        ? order.tracks.filter((track) => track.key !== key)
        : [...order.tracks, { key, name: null }],
    });

  /**
   * «Свой трек с телефона»: picked, sent and held by the key R2 answers with. Sent the moment it
   * is picked rather than at the order, so that the last button of the wizard is one call and not
   * two — and a wizard abandoned after this leaves one small object in the bucket, which is the
   * price of not making somebody wait through an upload while the order is in flight.
   */
  async function pickOwnTrack() {
    if (!token) return;
    // Busy from the moment the phone's own picker is up: the wizard cannot move on while the track
    // it is about to be cut to is still being chosen, let alone sent.
    setBusy(true);
    setNotice(null);
    try {
      const picked = await getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      const file = picked.assets?.[0];
      if (picked.canceled || !file) return;

      const key = await sendOwnTrack(token, id, { uri: file.uri, name: file.name });
      if (gone.current) return;
      change({ tracks: [...order.tracks, { key, name: file.name }] });
    } catch (e) {
      if (!gone.current) setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

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
        <View>
          {TRACKS.map((track, i) => {
            const name = s.montage.track[track.id];
            /** How far into this one, or null while it is not the one sounding. */
            const heard = playing?.track === track.id ? playing.at : null;
            const picked = inOrder(track.id);

            return (
              <RowTrack
                key={track.id}
                title={name}
                length={track.length}
                playing={heard !== null}
                divider={i > 0}
                play={
                  <IconButton
                    icon={heard !== null ? Pause : Play}
                    label={heard !== null ? s.montage.stopTrack(name) : s.montage.listen(name)}
                    size={40}
                    tone="surface"
                    onPress={() => {
                      setNotice(null);
                      void toggle(track.id).catch((e: unknown) => setNotice(errorMessage(e)));
                    }}
                  />
                }
                // Spec 7.7 — the row no longer picks; the 36 on its right does, and it says which
                // way it is: the plus takes the track, the tick gives it back.
                action={
                  <IconButton
                    icon={picked ? Check : Plus}
                    label={picked ? s.montage.stopTrack(name) : name}
                    size={36}
                    tone={picked ? 'surface' : 'ghost'}
                    on={picked}
                    style={picked ? undefined : styles.listen}
                    onPress={() => flip(track.id)}
                  />
                }
              />
            );
          })}
          {/* Their own, once they are up: the same row, under the name the file carries on the
              phone — which is a person's own word and stays as it is. */}
          {order.tracks
            .filter((track) => track.name !== null)
            .map((track) => (
              <RowTrack
                key={track.key}
                title={track.name ?? ''}
                length={s.montage.ownTrackShort}
                wave
                divider
                action={
                  <IconButton
                    icon={Check}
                    label={track.name ?? ''}
                    size={36}
                    tone="surface"
                    on
                    onPress={() =>
                      change({ tracks: order.tracks.filter((one) => one.key !== track.key) })
                    }
                  />
                }
              />
            ))}
        </View>

        {/* Spec 7.6: the one dashed button in the product, and it is the kit's outlined button
            wearing the dashed border and the 18 radius that entry asks for. */}
        <Button
          icon={Plus}
          label={s.montage.ownTrack}
          disabled={busy}
          style={styles.dashed}
          onPress={() => void pickOwnTrack()}
        />
      </ScrollView>
    </WizardStep>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s5 },
    // Spec 7.6, «свой трек с телефона»: a dashed `handle` border at the field's own radius.
    dashed: { borderStyle: 'dashed', borderColor: color.handle, borderRadius: radius.field },
    // «Послушать» on a row nobody picked: the outlined one, drawn in the louder of the two borders.
    listen: { borderColor: color.lineStrong },
  }),
);
