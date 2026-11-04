import { useVideoPlayer, VideoView } from 'expo-video';
import { Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import type { Montage } from '@/api';
import { ActionBar, Banner, Button } from '@/kit';
import { maySaveToPhone, saveAndShare, saveToPhone, shareFile } from '@/lib/downloads';
import { useStrings } from '@/lib/language';
import { useTurnsWithPhone } from '@/lib/orientation';
import { space, ThemePin, themes } from '@/theme';
export type WithFilm = 'save' | 'share' | 'both';
export function useFilmActions() {
  const s = useStrings();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useCallback(
    async (film: Montage, what: WithFilm) => {
      if (film.video_url === null) return;
      setBusy(true);
      setNotice(what === 'share' ? s.viewer.sharing : s.save.montage);
      const file = { id: film.id, kind: 'video', url: film.video_url } as const;
      try {
        if (what === 'share') {
          await shareFile(file);
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
export function FilmPlayer({ film, onClose }: { film: Montage | null; onClose: () => void }) {
  const s = useStrings();
  const { busy, notice, run } = useFilmActions();
  useTurnsWithPhone(film !== null);
  return (
    <Modal
      visible={film !== null}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      {film === null || film.video_url === null ? null : (
        <View style={styles.viewer}>
          <ThemePin value="dark">
            <Playing url={film.video_url} />
            {notice ? <Banner text={notice} style={styles.aside} /> : null}

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
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}
const room = themes.dark.color;
const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  big: { flex: 1, width: '100%' },
  aside: { marginHorizontal: space.s4 },
});
