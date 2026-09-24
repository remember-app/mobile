import { useVideoPlayer, VideoView } from 'expo-video';
import { Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import type { Montage } from '@/api';
import { ActionBar, Banner, Button } from '@/kit';
import { formatDay, formatRuntime } from '@/lib/dates';
import { maySaveToPhone, saveAndShare, saveToPhone, shareFile } from '@/lib/downloads';
import { useStrings } from '@/lib/language';
import { useTurnsWithPhone } from '@/lib/orientation';
import type { Strings } from '@/strings';
import { space, ThemePin, themes } from '@/theme';

/**
 * The finished film itself: the one window it is watched in, the two things that can be done with
 * it, and what it is called. Its own module because there are two places a film is watched from —
 * the strip on a memory's feed (`films.tsx`) and its own page (`MontageLiveDone`, TASK-222) — and
 * there is exactly one player in this product: a second one would be a second set of answers about
 * orientation, about the signed link, and about what «Поделиться» actually sends.
 */

/**
 * What a montage is called on screen: how long it runs once it does, and the day it was asked for
 * until then — a length is the one thing about it that is worth a title, and there is none to say
 * until the worker has made it.
 */
export const montageTitle = (montage: Montage, s: Strings) => {
  const runtime = formatRuntime(montage.duration_seconds);
  return runtime ? s.montage.ofLength(runtime) : s.montage.fromDay(formatDay(montage.created_at));
};

/** Keeping the film, handing it on, or the one press that does both. */
export type WithFilm = 'save' | 'share' | 'both';

/**
 * The finished video onto the phone and out of it — one busy flag and one line about how it went,
 * shared by every button that does either. Nothing here is the api's doing: the link came with the
 * list, and past that it is the download, the phone's gallery and its own share sheet.
 *
 * The share sheet is opened on the local copy and never on `video_url`: the link is signed and dies
 * in a quarter of an hour, so whoever it was sent to would get a refusal instead of a video.
 */
export function useFilmActions() {
  const s = useStrings();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (film: Montage, what: WithFilm) => {
      if (film.video_url === null) return;
      setBusy(true);
      // The whole of the progress there is: a save is atomic, the same way the gallery's is, and
      // handing one on is the download and then the phone's own sheet.
      setNotice(what === 'share' ? s.viewer.sharing : s.save.montage);
      const file = { id: film.id, kind: 'video', url: film.video_url } as const;
      try {
        if (what === 'share') {
          await shareFile(file);
          // Nothing to report: what happened next happened in the phone's own sheet.
          setNotice(null);
          return;
        }
        if (!(await maySaveToPhone())) {
          setNotice(s.error.galleryRefused);
          return;
        }
        await (what === 'both' ? saveAndShare : saveToPhone)(file);
        setNotice(s.save.done);
      } catch {
        setNotice(what === 'share' ? s.montage.shareFailed : s.save.failedMontage);
      } finally {
        setBusy(false);
      }
    },
    [s],
  );

  return { busy, notice, run };
}

/**
 * The finished video played where it lies: `expo-video` streams it from the signed link rather than
 * downloading it first. A modal and not a screen — there is nothing to do in here but watch it,
 * keep it and close it.
 *
 * Nothing but the film is asked for: `null` is the window shut, which is how both screens hold it.
 * Whoever mounts it shuts it again when they lose focus — a `router.push` off a tapped push leaves
 * the screen under it mounted, and a playing montage would otherwise stand over whatever came next
 * (TASK-94).
 */
export function FilmPlayer({ film, onClose }: { film: Montage | null; onClose: () => void }) {
  const s = useStrings();
  const { busy, notice, run } = useFilmActions();

  // A wide montage is worth turning the phone for — and since TASK-126 wide is what was asked for at
  // the order rather than what every montage is. The player is left free both ways all the same: a
  // standing montage has no reason to be turned and nothing breaks if it is. The
  // `supportedOrientations` below only says which ways up the window may be drawn — this is what
  // lets the app leave portrait at all, and it is given back the moment the window shuts.
  useTurnsWithPhone(film !== null);

  return (
    <Modal
      visible={film !== null}
      animationType="fade"
      onRequestClose={onClose}
      // Landscape too: a montage ordered wide is worth turning the phone for, and the rest of the
      // app is portrait-only.
      supportedOrientations={['portrait', 'landscape']}
    >
      {film === null || film.video_url === null ? null : (
        <View style={styles.viewer}>
          {/* The pin, and not only the `room.ink` under it: the bar is the kit's own and draws its
              `ink` and its hairline, which in daylight is a pale strip across the bottom of the dark
              room. Everything inside the player takes the dark set. */}
          <ThemePin value="dark">
            <Playing url={film.video_url} />
            {notice ? <Banner text={notice} style={styles.aside} /> : null}
            {/* Spec 7.2 gives «Закрыть» the outlined button, which is what it wears on `SheetFrame`
                and on the consent too (TASK-177, off a device: a quiet one stood as a line of text
                in the left corner and read as nothing the app draws). Beside it the one thing to be
                done with a finished montage, in the glowing weight. */}
            <ActionBar>
              <Button label={s.action.close} onPress={onClose} />
              <Button
                variant="primary"
                wide
                icon={Download}
                label={s.montage.saveShare}
                disabled={busy}
                onPress={() => void run(film, 'both')}
              />
            </ActionBar>
          </ThemePin>
        </View>
      )}
    </Modal>
  );
}

/**
 * The montage, played from its signed link. Its own component because the player is a hook, and this
 * one is mounted only while the video is on screen — leaving it releases the player.
 *
 * The open frame has these same three lines for its previews, down to the style. Not shared, and not
 * because the two differ: it is one `useVideoPlayer` call, and a module of its own around it would
 * be the bigger thing. Worth making the moment a third screen plays a video, or the moment these two
 * disagree.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

/**
 * The player is held in the dark set in every theme — spec 8 gives it a background darker than `ink`
 * (`photo.viewer`) so the video is the only light thing on the screen. `frame-viewer.tsx` says the
 * same at more length; the two draw the same kind of room, and this is the one value in this sheet
 * that has an opinion.
 */
const room = themes.dark.color;

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  big: { flex: 1, width: '100%' },
  // The line a press answered with keeps the screen's own margins.
  aside: { marginHorizontal: space.s4 },
});
